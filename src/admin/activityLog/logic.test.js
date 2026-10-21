import assert from 'node:assert/strict'
import test from 'node:test'
import { buildActionOptions, buildRoleMap, buildUserOptions, computeStats, filterRows, formatAction, formatEntity, inVietnamRange, isLogin, toCsv, toVietnamTime, validateRange, widenDateRange } from './logic.js'

const events = [
  { logId: 4, userId: 1, userName: 'Login only', action: 'LOGIN', createdAt: '2026-10-20T18:00:00Z' },
  { logId: 3, userId: 2, userName: 'Nguyễn Hải', userEmail: 'manager@example.vn', action: 'PUT Staff.Update', entityName: 'Staff', entityId: '17', result: 'Success', createdAt: '2026-10-20T17:00:00' },
  { logId: 2, userId: 2, userName: 'Nguyễn Hải', userEmail: 'manager@example.vn', action: 'POST Reservations.AssignUnit', entityName: 'Reservations', entityId: '21', result: 'Failure', createdAt: '2026-10-21T16:59:59.999Z' },
  { logId: 1, userId: 3, userName: 'Mai', action: 'POST Staff.Create', createdAt: '2026-10-21T17:00:00Z' },
]

test('LOGIN events never appear in options, statistics, filters or CSV', () => {
  assert.equal(isLogin({ action: ' login ' }), true)
  assert.equal(isLogin({ action: 'POST Auth.Login' }), true)
  assert.equal(isLogin({ action: 'POST Profile.ChangePassword' }), false)
  assert.deepEqual(buildUserOptions(events).map(option => option.value), ['3', '2'])
  assert.equal(buildActionOptions(events).some(option => isLogin({ action: option.value })), false)
  assert.deepEqual(computeStats(events, 2), { events: 3, staffUpdates: 2, exports: 2 })
  assert.deepEqual(filterRows(events).map(row => row.logId), [3, 2, 1])
  assert.equal(toCsv(events).includes('Login only'), false)
})

test('Vietnam calendar boundaries are inclusive and offset-free timestamps mean UTC', () => {
  assert.deepEqual(toVietnamTime('2026-10-20T17:00:00'), { date: '2026-10-21', dateLabel: '21/10/2026', time: '00:00:00' })
  assert.deepEqual(toVietnamTime('2026-10-21T00:00:00+07:00'), toVietnamTime('2026-10-20T17:00:00Z'))
  assert.equal(toVietnamTime('2026-10-20T17:00:00.1234567').date, '2026-10-21')
  const range = { from: '2026-10-21', to: '2026-10-21' }
  assert.equal(inVietnamRange('2026-10-20T16:59:59.999Z', range), false)
  assert.equal(inVietnamRange('2026-10-20T17:00:00Z', range), true)
  assert.equal(inVietnamRange('2026-10-21T16:59:59.999Z', range), true)
  assert.equal(inVietnamRange('2026-10-21T17:00:00Z', range), false)
  assert.equal(inVietnamRange('invalid', range), false)
  assert.equal(toVietnamTime(null).time, '-')
})

test('range widening handles month/year boundaries and rejects invalid dates', () => {
  assert.deepEqual(widenDateRange({ from: '2026-01-01', to: '2026-12-31' }), { from: '2025-12-31', to: '2027-01-01' })
  assert.match(validateRange({ from: '2026-02-30', to: '2026-03-01' }), /valid/)
  assert.match(validateRange({ from: '2026-99-99', to: '2026-10-21' }), /valid/)
  assert.match(validateRange({ from: '2026-11-01', to: '2026-10-21' }), /start date/)
  assert.throws(() => widenDateRange({ from: '', to: '2026-10-21' }), /valid/)
})

test('actions and entities use only recorded fields with raw fallbacks', () => {
  assert.equal(formatAction('POST Reservations.WalkIn'), 'Created reservation')
  assert.equal(formatAction('PUT PricingPolicies.SetUnitPrice'), 'Updated pricing policy')
  assert.equal(formatAction('PATCH Staff.Update'), 'Updated staff account')
  assert.equal(formatAction('DELETE Floors.Delete'), 'Deleted floor')
  assert.equal(formatAction('custom event'), 'custom event')
  assert.equal(formatAction('POST UnknownController.Run'), 'POST UnknownController.Run')
  assert.equal(formatEntity({ entityName: 'Staff', entityId: '17' }), 'Staff · 17')
  assert.equal(formatEntity({ entityName: 'Staff' }), 'Staff')
  assert.equal(formatEntity({ entityId: '17' }), '17')
  assert.equal(formatEntity({}), '-')
  assert.equal(buildRoleMap([{ userId: 2, role: 'FacilityManager' }]).get('2'), 'Facility Manager')
})

test('filters combine exact actor/action matches with text and Vietnam dates', () => {
  const range = { from: '2026-10-21', to: '2026-10-21' }
  assert.deepEqual(filterRows(events, { ...range, search: 'MANAGER@' }).map(row => row.logId), [3, 2])
  assert.deepEqual(filterRows(events, { ...range, userId: '2', action: 'PUT Staff.Update', search: 'Staff · 17' }).map(row => row.logId), [3])
  assert.equal(filterRows(events, { search: 'no matches' }).length, 0)
  assert.equal(filterRows(events, { ...range, search: 'created reservation' }).length, 1)
  assert.equal(buildUserOptions(events).length, 2)
})

test('CSV includes BOM, quotes safely, blocks formulas and exports all supplied non-login rows', () => {
  const csv = toCsv([{ ...events[1], userName: '=HYPERLINK("bad")', entityName: 'Unit, M\nsize', entityId: null }], buildRoleMap([{ userId: 2, role: 'SystemAdministrator' }]))
  assert.equal(csv.charCodeAt(0), 0xfeff)
  assert.ok(csv.includes('"\'=HYPERLINK(""bad"")"'))
  assert.ok(csv.includes('"Unit, M\nsize"'))
  assert.ok(csv.includes('"System Administrator"'))
  assert.ok(csv.includes('"21/10/2026","00:00:00"'))
  assert.equal(toCsv(events).split('\r\n').length, 4)
})
