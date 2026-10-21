import assert from 'node:assert/strict'
import test from 'node:test'
import { accessEligibility, canExtendVisit, expectedCheckoutAt, extensionOptions, overtimeMinutes } from './logic.js'

test('access eligibility reports all unmet requirements', () => {
  assert.deepEqual(accessEligibility({ accountNotSuspended: false, idVerified: false, storageStatus: 'Reserved', paymentStatus: 'Overdue' }), {
    eligible: false,
    reasons: [
      'Account is suspended or its status is unavailable.',
      'Customer identification is not verified.',
      'Storage is not active.',
      'Due payments are not fully paid.',
    ],
  })
  assert.equal(accessEligibility({ accountNotSuspended: true, idVerified: true, storageStatus: 'Active', paymentStatus: 'Paid' }).eligible, true)
})

test('expected check-out is calculated from visit start and duration', () => {
  assert.equal(expectedCheckoutAt('2026-10-21T10:00:00Z', 30), '2026-10-21T10:30:00.000Z')
  assert.equal(expectedCheckoutAt('bad date', 30), null)
})

test('overtime minutes round up each started minute', () => {
  const end = Date.parse('2026-10-21T10:30:00Z')
  assert.equal(overtimeMinutes(end, end), 0)
  assert.equal(overtimeMinutes(end, end + 1), 1)
  assert.equal(overtimeMinutes(end, end + 60000), 1)
})

test('extensions are blocked when overtime or above the four-hour cap', () => {
  const visit = { expectedCheckOutAt: '2026-10-21T10:30:00Z', durationMinutes: 30 }
  assert.deepEqual(extensionOptions(visit, Date.parse('2026-10-21T10:20:00Z')), [15, 30, 60])
  assert.deepEqual(extensionOptions(visit, Date.parse('2026-10-21T10:31:00Z')), [])
  assert.equal(canExtendVisit({ expectedCheckOutAt: visit.expectedCheckOutAt, durationMinutes: 210, extendByMinutes: 30, now: Date.parse('2026-10-21T10:20:00Z') }), true)
  assert.equal(canExtendVisit({ expectedCheckOutAt: visit.expectedCheckOutAt, durationMinutes: 210, extendByMinutes: 60, now: Date.parse('2026-10-21T10:20:00Z') }), false)
})
