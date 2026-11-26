import assert from 'node:assert/strict'
import { test } from 'node:test'
import { renewedEndDate } from '../src/customer/components/format.js'

test('the renewal preview matches the end date the API gives', () => {
  assert.equal(renewedEndDate('2026-12-01', '2027-02-28', 1), '2027-03-31')
  assert.equal(renewedEndDate('2026-11-30', '2027-02-27', 1), '2027-03-29')
  assert.equal(renewedEndDate('2026-10-31', '2027-02-27', 1), '2027-03-30')
  assert.equal(renewedEndDate('2027-03-01', '2027-04-30', 6), '2027-10-31')
})
