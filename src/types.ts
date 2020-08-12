import { Pool, PoolClient } from 'pg'

export type Field =
  | boolean
  | null
  | number
  | string
  | Field[]
  | { toJSON(): string }
  | { [key: string]: Field }

export type First<T extends Row> = [T]

export type Row = Record<string, Field>

export type Many<T> = T | T[]

export type PgDriver = Pool | PoolClient
