import 'mocha'
import { expect } from 'chai'
import build from './build'

const flat = (s: string): string => s.replace(/\s+/g, ' ').trim()

describe('build', () => {

  it('builds queries with no parameters', () => {
    const output = build`select * from "users"`
    expect(output).to.deep.equal({
      text: 'select * from "users"'
    })
  })

  it('builds queries with parameters', () => {
    const firstName = 'foo'
    const favoriteNumber = 1
    const output = build`
      select *
        from "users"
       where "firstName"      = ${firstName}
         and "favoriteNumber" = ${favoriteNumber}
    `
    expect(output).to.deep.equal({
      text: flat(`
        select *
          from "users"
         where "firstName"      = $1
           and "favoriteNumber" = $2
      `),
      values: [firstName, favoriteNumber]
    })
  })

})
