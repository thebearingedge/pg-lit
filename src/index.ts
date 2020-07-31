import { Pool, PoolConfig } from 'pg'
import { Sql, Transaction, createSql, createTransaction } from './create-sql'

export default function pgLit(config?: PoolConfig): Sql {
  const pool = new Pool(config)
  return createSql(pool, {
    begin: async <T extends Transaction>(transaction?: T) => {
      const driver = await pool.connect()
      const trx = createTransaction({ driver })
      try {
        await trx`begin`
        if (typeof transaction === 'undefined') return trx
        const result = await transaction(trx)
        if (trx.state === 'pending') await trx.commit()
        return result
      } catch (err) {
        await trx.rollback()
        throw err
      } finally {
        driver.release()
      }
    }
  })
}
