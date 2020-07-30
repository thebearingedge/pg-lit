import { InsertInto } from './partials'
import { Row, Many } from './types'

export default function insertInto<T>(table: string, row: Many<Row>, ...keys: string[]): InsertInto<T> {
  return new InsertInto<T>(table, row, keys)
}
