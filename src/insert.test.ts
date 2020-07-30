import 'mocha'
import { expect, collapsed } from './test'
import params from './params'
import insert from './insert'

describe('insert', () => {

  it('builds columns and values from an object', () => {
    const keys = [
      'firstName',
      'favoriteNumber'
    ]
    const user = {
      firstName: 'foo',
      favoriteNumber: 1
    }
    const { text, values } = insert(user, ...keys).toSql(params())
    expect(collapsed(text)).to.equal(collapsed(`
      ("firstName", "favoriteNumber")
      values ($1, $2)
    `))
    expect(values).to.deep.equal(['foo', 1])
  })

  it('builds columns and values from multiple objects', () => {
    const keys = [
      'firstName',
      'favoriteNumber'
    ]
    const users = [
      {
        firstName: 'foo',
        favoriteNumber: 1
      },
      {
        firstName: 'bar',
        favoriteNumber: 2
      }
    ]
    const { text, values } = insert(users, ...keys).toSql(params())
    expect(collapsed(text)).to.equal(collapsed(`
      ("firstName", "favoriteNumber")
      values ($1, $2), ($3, $4)
    `))
    expect(values).to.deep.equal(['foo', 1, 'bar', 2])
  })

  it('infers the columns from the passed in object(s)', () => {
    const users = [
      {
        firstName: 'foo',
        favoriteNumber: 1
      },
      {
        firstName: 'bar',
        favoriteNumber: 2
      }
    ]
    const { text, values } = insert(users).toSql(params())
    expect(collapsed(text)).to.equal(collapsed(`
      ("firstName", "favoriteNumber")
      values ($1, $2), ($3, $4)
    `))
    expect(values).to.deep.equal(['foo', 1, 'bar', 2])
  })

})
