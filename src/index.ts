import { Pool, PoolConfig } from 'pg'
import { Sql, Transaction, createSql, createTrx } from './builders'

export type PgLit = Sql & {
  pool: Pool
}

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
