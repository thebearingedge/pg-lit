import { Pool, PoolConfig } from 'pg'
import { Sql, Trx, Transaction, createSql, createTrx } from './builders'

/**
 * Instantiates a [`pg.Pool`](https://node-postgres.com/api/pool) and wraps it in a template tag interface.
 * As with `pg.Pool`, [environment variables](https://www.postgresql.org/docs/12/libpq-envars.html) are used as a fallback for connection parameters.
 *
 * ```js
 * import { pgLit } from 'pg-lit'
 * const sql = pgLit({ ...PoolConfig })
 * ```
 */
export default function pgLit(config?: PoolConfig): PgLit {
  const pool = new Pool(config)
  const sql = createSql(pool, {
    begin: async <T extends Transaction>(transaction?: T) => {
      const client = await pool.connect()
      const trx = createTrx({ driver: client })
      try {
        await client.query('begin')
        if (typeof transaction === 'undefined') return trx
        const result = await transaction(trx)
        if (trx.getState() === 'pending') await trx.commit()
        return result
      } catch (err) {
        trx.getState() === 'pending' && await trx.rollback()
        throw err
      }
    }
  })
  return Object.assign(sql, { pool })
}

export { pgLit, Trx }

export type PgLit = Sql & {
  pool: Pool
}

export { First } from './types'
