import { PoolClient } from 'pg'
import { Row, Many, Field, PgDriver } from './types'
import { QueryFragment, InsertInto, SqlQuery, ColumnsAndValues, SetClause } from './queries'

const uniqueId: () => string = (() => {
  let id = 0
  return () => {
    id = id === Number.MAX_SAFE_INTEGER ? /* istanbul ignore next */ 1 : id + 1
    return 'trx_' + id.toString()
  }
})()

export function createSql<T extends Transactor>(driver: PgDriver, transactor: T): Sql & T {
  function sql<T>(template: TemplateStringsArray, ...fields: Array<Field | QueryFragment>): SqlQuery<T> {
    return new SqlQuery<T>(driver, template, fields)
  }
  return Object.assign(sql, { driver }, transactor, {
    set: (updates: Row, ...keys: string[]) => new SetClause(updates, keys),
    insert: (row: Many<Row>, ...keys: string[]) => new ColumnsAndValues(row, keys),
    insertInto: <T>(table: string, row: Many<Row>, ...keys: string[]) => new InsertInto<T>(driver, table, row, keys)
  })
}

export function createTrx({ driver, parent }: TransactionConfig): Trx {

  const id = uniqueId()
  let state: TransactionState = 'pending'

  const sql = createSql(driver, {
    getState: () => state,
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
      state = 'committed'
      if (parent != null) return await parent.commit()
      await driver.query('commit')
      driver.release()
    },
    rollback: async () => {
      if (state !== 'pending') {
        throw new Error(`transaction may not be rolled back after being ${state}`)
      }
      state = 'rolled back'
      if (parent != null) return await parent.rollback()
      await driver.query('rollback')
      driver.release()
    },
    revert: async () => {
      if (state !== 'pending') {
        throw new Error(`transaction may not be reverted after being ${state}`)
      }
      await driver.query(`rollback to ${id}`)
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

/**
 * Calling the `sql` tag with a template literal produces a query that can be either executed or embedded within another `SqlQuery`. Values passed into the template string are **not concatenated into the query text** (because security), but instead gathered to be sent as query parameters with `pg`.
 *
 * ```js
 * const simple = sql`select 1 as "one"`
 *
 * const embedded = sql`
 *   with "selected" as (
 *     ${sql`select 1 as "one"`}
 *   )
 *   select "s"."one"
 *     from "selected" as "s"
 *    where "s"."one" = ${1}
 * `
 * ```
 */
type SqlTag = {
  <T>(template: TemplateStringsArray, ...fields: Array<Field | QueryFragment>): SqlQuery<T>
}

type QueryBuilder = {
  /**
   * Create a query fragment that takes care of the annoying parts of constructing the `set` clause of an `update` statement. **Note: this is not an executable query**.
   *
   * - `updates` is an object.
   * - `columns` are optional and by default will be inferred from the keys of the `updates` object.
   *
   * ```js
   * const updates = {
   *   isCompleted: false
   *   task: 'do it again'
   * }
   *
   * await sql`
   *   update "todos" ${sql.set(updates, 'task', 'isCompleted')}
   *    where "todoId" = 1
   * `
   *
   * {
   *   text: 'update "todos" set ("task", "isCompleted") = row($1, $2) where "todoId" = 1',
   *   values: ['do it again', false]
   * }
   * ```
   */
  set(updates: Row, ...keys: string[]): SetClause
  /**
   * Create a query fragment that takes care of the annoying parts of inserting records into a table while allowing an alias for the target table. **Note: this is not an executable query**.
   *
   * - `rows` can be an object or an array
   * - `columns` are optional and will be inferred from the first row being inserted by default.
   *
   * ```js
   * const users = [
   *   { username: 'bebop' },
   *   { username: 'rocksteady' }
   * ]
   *
   * const result = await sql`
   *   insert into "users"
   *   ${sql.insert(users, 'username')}
   *   returning *
   * `
   *
   * {
   *   text: 'insert into "users" ("username") values ($1), ($2)',
   *   values: ['bebop', 'rocksteady']
   * }
   * ```
   */
  insert(row: Many<Row>, ...keys: string[]): ColumnsAndValues
  /**
   * Create a query that takes care of the annoying parts of constructing a basic `insert` statement. Like any `SqlQuery`, it can be embedded into the template of another `SqlQuery`.
   *
   * - `table` the string name of the table to `insert into`.
   * - `rows` a single object or array of objects.
   * - `columns` are optional and by default will be inferred from the keys of first row being inserted.
   *
   * ```js
   * const users = [
   *   { username: 'bebop' },
   *   { username: 'rocksteady' }
   * ]
   *
   * await sql.insertInto('users', users, 'username')
   *
   * {
   *   text: 'insert into "users" ("username") values ($1), ($2)',
   *   values: ['bebop', 'rocksteady']
   * }
   *
   * const [bebop] = await sql`
   *   with "inserted" as (
   *     ${sql.insertInto('users', users)}
   *     returning *
   *   )
   *   select *
   *     from "inserted"
   *    where "username" = 'bebop'
   * `
   *
   * {
   *   text: `
   *     with "inserted" as (
   *       insert into "users" ("username")
   *       values ($1), $(2)
   *       returning *
   *     )
   *     select *
   *       from "inserted"
   *      where "username" = 'bebop'
   *   `,
   *   values: ['bebop', 'rocksteady']
   * }
   * ```
   */
  insertInto<T>(table: string, row: Many<Row>, ...keys: string[]): InsertInto<T>
}

type Transactor = {
  /**
   * In this form, you must manage the transaction yourself and ensure that either `commit` or `rollback` is called.
   *
   * ```js
   * const trx = await sql.begin()
   *
   * try {
   *   await trx.insertInto('users', [
   *     { username: 'bebop' },
   *     { username: 'rocksteady' }
   *   ])
   *   await trx.commit()
   * } catch (err) {
   *   await trx.rollback()
   * }
   * ```
   */
  begin(): Promise<Trx>
  /**
   * A convenience method for starting a database transaction.
   *
   * In this callback form, the transaction is managed for you by default. The return value of the callback is `await`ed and if this Promise is fulfilled, the transaction is committed. Otherwise, if this Promise is rejected, the transactions is rolled back.
   *
   * The return value of the callback is also the Promise value returned by `.begin()` in this form.
   *
   * ```js
   * try {
   *   const [inserted] = sql.begin(async sql => {
   *     // in here, sql is scoped to a specific client connection
   *     // to be used for the lifetime of the transaction
   *     return sql`
   *       insert into "users"
   *       ${sql.insert({ username: 'krang' })}
   *       returning *
   *     `
   *   })
   * } catch (err) {
   *   // transaction rolled back
   *   // deal with it
   * }
   * ```
   */
  begin<T extends Transaction>(transaction: T): Promise<ReturnType<T>>
}

export type Sql = SqlTag & QueryBuilder & Transactor & {
  driver: PgDriver
}

export type Transaction = (trx: Trx) => any

type TransactionConfig = {
  driver: PoolClient
  parent?: Trx
}

type TransactionState = 'pending' | 'committed' | 'rolled back'

export type Trx = Sql & {
  commit(): Promise<void>
  revert(): Promise<void>
  rollback(): Promise<void>
  savepoint(): Promise<void>
  getState(): TransactionState
}
