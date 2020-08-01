import { PoolClient } from 'pg'
import { Row, Many, Field, PgDriver } from './types'
import { QueryFragment, InsertInto, SqlQuery, InsertColumnsAndValues, SetColumnsAndValues } from './queries'

const uniqueId: () => string = (() => {
  let id = 0
  return () => {
    id = id === Number.MAX_SAFE_INTEGER ? /* istanbul ignore next */ 1 : id + 1
    return 'trx_' + id.toString()
  }
})()

type SqlHelper = {
  set(updates: Row, ...keys: string[]): SetColumnsAndValues
  insert(row: Many<Row>, ...keys: string[]): InsertColumnsAndValues
  insertInto<T>(table: string, row: Many<Row>, ...keys: string[]): InsertInto<T>
}

type QueryBuilder = {
  <T>(template: TemplateStringsArray, ...fields: Array<Field | QueryFragment>): SqlQuery<T>
}

export type Sql = SqlHelper & QueryBuilder & Transactor & {
  driver: PgDriver
}

export type Transaction = (trx: Trx) => any

type TransactionConfig = {
  driver: PoolClient
  parent?: Trx
}

interface Transactor {
  begin(): Promise<Trx>
  begin<T extends Transaction>(transaction: T): Promise<ReturnType<T>>
  begin<T extends Transaction>(transaction?: T): Promise<Trx | ReturnType<T>>
}

export type Trx = Sql & {
  commit(): Promise<void>
  rollback(): Promise<void>
  savepoint(): Promise<void>
  getState(): TransactionState
}

type TransactionState = 'pending' | 'committed' | 'rolled back'

export function createSql<T extends Transactor>(driver: PgDriver, methods: T): Sql & T {
  function sql<T>(template: TemplateStringsArray, ...fields: Array<Field | QueryFragment>): SqlQuery<T> {
    return new SqlQuery<T>(driver, template, fields)
  }
  return Object.assign(sql, { driver }, methods, {
    set: (updates: Row, ...keys: string[]) => new SetColumnsAndValues(updates, keys),
    insert: (row: Many<Row>, ...keys: string[]) => new InsertColumnsAndValues(row, keys),
    insertInto: <T>(table: string, row: Many<Row>, ...keys: string[]) => new InsertInto<T>(driver, table, row, keys)
  })
}

export function createTrx({ driver, parent }: TransactionConfig): Trx {

  const id = uniqueId()
  let state: TransactionState = 'pending'

  const sql = createSql(driver, {
    getState() { return state },
    begin: async <T extends Transaction>(transaction?: T) => {
      const trx = createTrx({ driver, parent: sql })
      try {
        await trx.savepoint()
        if (typeof transaction === 'undefined') return trx
        const result = await transaction(trx)
        if (trx.getState() === 'pending') await trx.savepoint()
        return result
      } catch (err) {
        await trx.rollback()
        throw err
      }
    },
    commit: async () => {
      if (state !== 'pending') {
        throw new Error(`transaction may not be committed after being ${state}`)
      }
      await driver.query('commit')
      state = 'committed'
    },
    rollback: async () => {
      if (state !== 'pending') {
        throw new Error(`transaction may not be rolled back after being ${state}`)
      }
      parent == null
        ? await driver.query('rollback')
        : await driver.query(`rollback to ${id}`)
      state = 'rolled back'
    },
    savepoint: async () => {
      if (state !== 'pending') {
        throw new Error(`transaction may not be saved after being ${state}`)
      }
      await driver.query(`savepoint ${id}`)
    }
  })

  return sql
}