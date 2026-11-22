import assert from 'node:assert/strict'
import { test } from 'node:test'
import { formatDate, vietnamDay } from '../src/customer/components/format.js'

test('a UTC moment falls on its Vietnam day', () => {
  assert.equal(vietnamDay('2026-10-20T16:59:59Z'), '2026-10-20') // 23:59
  assert.equal(vietnamDay('2026-10-20T17:00:00Z'), '2026-10-21') // 00:00
  assert.equal(vietnamDay('2026-10-20T23:59:59.9999999Z'), '2026-10-21') // 06:59, the API's seven decimals
  assert.equal(vietnamDay('2026-10-21T00:00:00Z'), '2026-10-21') // 07:00
  assert.equal(vietnamDay('2026-10-20T17:00:00'), '2026-10-21') // no Z is still UTC
  assert.equal(vietnamDay('2026-10-20T23:00:00+07:00'), '2026-10-20')
  assert.equal(formatDate('2026-12-31T17:00:00Z'), '01/01/2027')
})

test('a calendar date is never shifted', () => {
  assert.equal(vietnamDay('2026-10-20'), '2026-10-20')
  assert.equal(formatDate('2026-01-01'), '01/01/2026')
  assert.equal(formatDate(null), '—')
  assert.equal(formatDate(''), '—')
})
