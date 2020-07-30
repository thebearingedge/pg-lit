export { expect } from 'chai'

before(() => {

})

beforeEach(() => {

})

afterEach(() => {

})

after(() => {

})

export function collapsed(string: string): string {
  return string.replace(/\s+/g, ' ').trim()
}
