import { QueryConfig } from 'pg'

export default function build(strings: TemplateStringsArray, ...inputs: any[]): QueryConfig {
  if (inputs.length === 0) {
    return { text: strings[0] }
  }
  const values = []
  const fragments = []
  for (let i = 0, j = 1; i < inputs.length; i++) {
    values.push(inputs[i])
    fragments.push(strings[i], `$${j++}`)
  }
  return {
    text: fragments.join(' ').trim().replace(/\s+/g, ' '),
    values
  }
}
