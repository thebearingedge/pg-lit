import { Client, QueryResult, QueryConfig, QueryArrayConfig } from 'pg'
import { Many, Row, Field, PgDriver } from './types'

const { escapeIdentifier } = Client.prototype

function params(start: number = 1) {
  return () => '$' + String(start++)
}

export abstract class QueryFragment {

  abstract toSql(param: Param): SqlQueryConfig

}

export class InsertColumnsAndValues extends QueryFragment {

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

export class SetColumnsAndValues extends QueryFragment {

  private readonly updates: Row
  private readonly keys: string[]

  constructor(updates: Row, keys: string[]) {
    super()
    this.updates = updates
    this.keys = keys
  }

  toSql(param: Param): SqlQueryConfig {
    const { updates, keys } = this
    const rawColumns = keys.length > 0 ? keys : Object.keys(updates)
    const values = rawColumns.map(key => updates[key])
    const columns = rawColumns.map(escapeIdentifier)
    const tuple = columns.map(() => param())
    const text = `set (${columns.join(', ')}) = row(${tuple.join(', ')})`
    return { text, values }
  }

}

abstract class Query<T> extends QueryFragment {

  constructor(protected driver: PgDriver) {
    super()
    this.driver = driver
  }

  /**
   * A `SqlQuery` is a thenable object, so you can either call `.then()` on it, to get a `Promise` for your result or `await` the result. This builds and sends a parameterized query through `pg` to the database.
   *
   * ```js
   * sql`select 1 as "one"`
   *   .then(result => {
   *     // got 'em
   *   })
   *   .catch(err => {
   *     // deal with it
   *   })
   *
   * try {
   *   const result = await sql`select 1 as "one"`
   *   // got 'em
   * } catch (err) {
   *   // deal with it
   * }
   * ```
   */
  then<F extends OnQueryFulfilled<T>>(onFulfilled: F, onRejected?: OnQueryRejected): Promise<ReturnType<F>> {
    return this.exec({}).then(onFulfilled, onRejected)
  }

  async exec(options: PartialQueryConfig): Promise<SqlResult<T>> {
    const { rows, ...result } = await this.driver.query({
      ...options,
      ...this.toSql(params())
    })
    return Object.assign(rows, result)
  }

}

export class InsertInto<T> extends Query<T> {

  private readonly table: string
  private readonly columnsAndValues: InsertColumnsAndValues

  constructor(driver: PgDriver, table: string, row: Many<Row>, keys: string[]) {
    super(driver)
    this.table = table
    this.columnsAndValues = new InsertColumnsAndValues(row, keys)
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

  toSql(param: Param): SqlQueryConfig {
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

type SqlQueryConfig = {
  text: string
  values: Field[]
}

type Param = ReturnType<typeof params>

type PartialQueryConfig = Partial<Pick<QueryConfig & QueryArrayConfig, 'name' | 'rowMode'>>

/**
 * The `SqlResult` is actually an `Array` of rows returned by your query.
 *
 * ```js
 * const todos = await sql`
 *   select *
 *     from "todos"
 * `
 *
 * todos.forEach(todo => {
 *   console.log(typeof todo) // 'object'
 * })
 * ```
 *
 * Usually the rows are what you're after, but properties of `pg`'s [`Result`](https://node-postgres.com/api/result) are mixed into the array in case you need them.
 *
 * - `SqlResult.fields`
 * - `SqlResult.command`
 * - `SqlResult.rowCount`
 */
type SqlResult<T> = QueryResult<T>['rows'] & Omit<QueryResult, 'rows'>

type OnQueryFulfilled<T> = (result: SqlResult<T>) => any

type OnQueryRejected = (reason: any) => any
