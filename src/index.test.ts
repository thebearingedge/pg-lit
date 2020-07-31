import pgLit, { PgLit } from '.'

describe('sql', () => {

  let sql: PgLit

  before(() => {
    sql = pgLit({
      connectionString: 'postgres://test:test@localhost/test'
    })
  })

  after(() => sql.pool.end())

  it('does', () => {
    const firstName = 'foo'

    const query = sql`
      with "inserted" as (
        ${sql.insertInto('users', { firstName })}
        returning *
      )
      delete from "users"
       where "firstName" = ${firstName}
    `

    const mixedQuery = query.toSql()

    console.log('MIXED', mixedQuery)
  })

  it('also', () => {
    const query = sql``.toSql()
    console.log('EMPTY', query)
  })

  it('query', async () => {
    type One = { one: number }
    const [row] = await sql<One>`select 1 as "one"`
    console.log(row)
  })

})
