import params from './params'
import { Field, Param, SqlFragment } from './types'

export abstract class Query {

  abstract toSql(param: Param): SqlFragment

}

export abstract class ExecutableQuery<T> extends Query {}

export class SqlQuery<T> extends ExecutableQuery<T> {

  constructor(private readonly template: TemplateStringsArray, private readonly fields: Array<Field | Query>) {
    super()
  }

  toSql(param: Param = params()): SqlFragment {
    const { template, fields } = this
    if (fields.length === 0) {
      return { text: template[0], values: [] }
    }
    const values = []
    const strings = []
    for (let i = 0; i < fields.length; i++) {
      const value = fields[i]
      if (value instanceof Query) {
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
