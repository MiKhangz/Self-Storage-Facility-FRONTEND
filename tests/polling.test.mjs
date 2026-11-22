import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pollIfOnePage } from '../src/staff/polling.js'

const list = (rows) => ({ state: { data: rows === null ? undefined : Array.from({ length: rows }) } })

test('a list polls only while one request fetches all of it', () => {
  assert.equal(pollIfOnePage(list(null)), 15_000) // not loaded yet, or failed: try again
  assert.equal(pollIfOnePage(list(100)), 15_000)
  assert.equal(pollIfOnePage(list(101)), false)
})
