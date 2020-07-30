import { ColumnsAndValues } from './partials'
import { Row, Many } from './types'

export default function insert(row: Many<Row>, ...keys: string[]): ColumnsAndValues {
  return new ColumnsAndValues(row, keys)
}
