import { QueryResult } from 'pg'

export type Field =
  | boolean
  | null
  | number
  | string
  | Field[]
  | { toJSON: () => string }
  | { [key: string]: Field }

export type Param = () => string

export type Row = Record<string, Field>

export type Many<T> = T | T[]

export type SqlFragment = {
  text: string
  values: Field[]
}

export type PgLitResult<T> = T[] & Omit<QueryResult, 'rows'>
