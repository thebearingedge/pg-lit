import createSql from './create-sql'

describe('createSql', () => {

  const sql = createSql()

  it('does', () => {
    const firstName = 'foo'

    const query = sql`
      with "inserted" as (
        ${sql.insertInto('users', { firstName })}
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

})
