import assert from 'node:assert/strict'
import { test } from 'node:test'
import { depositDeadline } from '../src/customer/components/format.js'

test('the deposit is due 24 hours after booking, or when move-in day ends if sooner', () => {
  assert.equal(depositDeadline('2026-11-22T03:00:00Z', '2026-12-10'), '2026-11-23T03:00:00.000Z')
  assert.equal(depositDeadline('2026-11-22T03:00:00Z', '2026-11-22'), '2026-11-22T16:59:00.000Z') // 23:59 in Vietnam
})
