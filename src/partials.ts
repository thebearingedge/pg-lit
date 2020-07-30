import { Client } from 'pg'
import { Query, ExecutableQuery } from './query'
import { Row, Param, SqlFragment, Many } from './types'
import params from './params'

const { escapeIdentifier } = Client.prototype

export class ColumnsAndValues extends Query {

  constructor(private readonly row: Many<Row>, private readonly keys: string[]) {
    super()
  }

  toSql(param: Param): SqlFragment {
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

export class InsertInto<T> extends ExecutableQuery<T> {

  private readonly columnsAndValues: ColumnsAndValues

  constructor(private readonly table: string, row: Many<Row>, keys: string[]) {
    super()
    this.columnsAndValues = new ColumnsAndValues(row, keys)
  }

  toSql(param: Param = params()): SqlFragment {
    const { table } = this
    const { text, values } = this.columnsAndValues.toSql(param)
    return {
      text: `insert into ${escapeIdentifier(table)} ${text}`,
      values
    }
  }

}
