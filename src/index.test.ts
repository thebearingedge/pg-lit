import pgLit from '.'

describe('sql', () => {

  const sql = pgLit()

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

})
