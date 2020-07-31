import { Client, QueryResult } from 'pg'
import { Many, Row, Field, PgDriver } from './types'

const { escapeIdentifier } = Client.prototype

export default function params(start: number = 1) {
  return () => '$' + String(start++)
}

type SqlQueryConfig = {
  text: string
  values: Field[]
}

type Param = ReturnType<typeof params>

export abstract class QueryFragment {

  abstract toSql(param: Param): SqlQueryConfig

}

export class ColumnsAndValues extends QueryFragment {

  private readonly row: Many<Row>
  private readonly keys: string[]

  constructor(row: Many<Row>, keys: string[]) {
    super()
    this.row = row
    this.keys = keys
  }

  toSql(param: Param): SqlQueryConfig {
    const { row, keys } = this
    const rows = Array.isArray(row) ? row : [row]
    const columns = keys.length > 0 ? keys : Object.keys(rows[0])
    const values = []
    const tuples = []
    for (let r = 0; r < rows.length; r++) {
      const tuple = []
      for (let c = 0; c < columns.length; c++) {
        tuple.push(param())
        values.push(rows[r][columns[c]])
      }
      tuples.push(`(${tuple.join(', ')})`)
    }
    const text = `
      (${columns.map(escapeIdentifier).join(', ')})
      values ${tuples.join(', ')}
    `
    return { text, values }
  }

}

export type SqlResult<T> = T[] & Omit<QueryResult, 'rows'>

export type OnQueryFulfilled<T> = (result: SqlResult<T>) => any

export type OnQueryRejected = (reason: any) => any

export abstract class Query<T> extends QueryFragment {

  constructor(protected driver: PgDriver) {
    super()
    this.driver = driver
  }

  then<F extends OnQueryFulfilled<T>, R extends OnQueryRejected>(onFulfilled: F, onRejected?: R): Promise<ReturnType<F>> {
    return this.driver.query(this.toSql(params()))
      .then(({ rows, ...result }) => Object.assign(rows, result))
      .then(onFulfilled, onRejected)
  }

}

export class InsertInto<T> extends Query<T> {

  private readonly table: string
  private readonly columnsAndValues: ColumnsAndValues

  constructor(driver: PgDriver, table: string, row: Many<Row>, keys: string[]) {
    super(driver)
    this.table = table
    this.columnsAndValues = new ColumnsAndValues(row, keys)
  }

  toSql(param: Param): SqlQueryConfig {
    const { table } = this
    const { text, values } = this.columnsAndValues.toSql(param)
    return {
      text: `insert into ${escapeIdentifier(table)} ${text}`,
      values
    }
  }

}

export class SqlQuery<T> extends Query<T> {

  private readonly template: TemplateStringsArray
  private readonly fields: Array<Field | QueryFragment>

  constructor(driver: PgDriver, template: TemplateStringsArray, fields: Array<Field | QueryFragment>) {
    super(driver)
    this.template = template
    this.fields = fields
  }

  toSql(param: Param = params()): SqlQueryConfig {
    const { template, fields } = this
    if (fields.length === 0) {
      return { text: template[0], values: [] }
    }
    const values = []
    const strings = []
    for (let i = 0; i < fields.length; i++) {
      const value = fields[i]
      if (value instanceof QueryFragment) {
        const query = value.toSql(param)
        values.push(...query.values)
        strings.push(template[i], query.text)
      } else {
        values.push(value)
        strings.push(template[i], param())
      }
    }
    const text = strings.join('') + template[template.length - 1]
    return { text, values }
  }

}
