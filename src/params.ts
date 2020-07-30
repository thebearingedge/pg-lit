import { Param } from './types'

export default function params(start: number = 1): Param {
  return () => '$' + String(start++)
}
