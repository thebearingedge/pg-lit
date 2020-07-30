import insert from './insert'
import insertInto from './insert-into'
import { Field } from './types'
import { Query, SqlQuery } from './query'

type Builder = {
  <T>(template: TemplateStringsArray, ...fields: Array<Field | Query>): SqlQuery<T>
  insert: typeof insert
  insertInto: typeof insertInto
}

export default function createSql(): Builder {
  return Object.assign((template: TemplateStringsArray, ...fields: Array<Field | Query>) => {
    return new SqlQuery(template, fields)
  }, {
    insert,
    insertInto
  })
}
