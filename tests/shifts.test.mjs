import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextShift, shiftsOn } from '../src/staff/shifts.js'

test('a new shift starts at the next time still ahead', () => {
  const at = (day, now) => {
    const { shiftDate, shiftType, startTime, endTime } = nextShift(day, '2026-11-23', now)
    return `${shiftDate} ${shiftType} ${startTime}-${endTime}`
  }
  assert.equal(at('2026-11-23', '06:59'), '2026-11-23 Morning 07:00-15:00')
  assert.equal(at('2026-11-23', '07:00'), '2026-11-23 Afternoon 15:00-23:00') // already started
  assert.equal(at('2026-11-23', '15:30'), '2026-11-23 Night 23:00-07:00')
  assert.equal(at('2026-11-23', '23:00'), '2026-11-24 Morning 07:00-15:00')
  assert.equal(at('2026-11-30', '18:00'), '2026-11-30 Morning 07:00-15:00') // a coming week
  assert.equal(at('2026-11-16', '18:00'), '2026-11-23 Night 23:00-07:00') // a past week: from now
})

test("a day's schedule has its own shifts and the night before until it ends", () => {
  const shift = (shiftId, shiftDate, startTime, endTime) => ({ shiftId, shiftDate, startTime, endTime, endsNextDay: endTime <= startTime })
  const all = [
    shift(1, '2026-11-22', '23:00:00', '07:00:00'), // runs into the 23rd
    shift(2, '2026-11-22', '16:00:00', '00:00:00'), // over at midnight
    shift(3, '2026-11-22', '07:00:00', '15:00:00'),
    shift(4, '2026-11-23', '07:00:00', '15:00:00'),
    shift(5, '2026-11-23', '23:00:00', '07:00:00'),
    shift(6, '2026-11-24', '07:00:00', '15:00:00'),
  ]
  assert.deepEqual(shiftsOn(all, '2026-11-23').map((s) => `${s.shiftId} ${s.from}`), ['1 00:00', '4 07:00', '5 23:00'])
})

test('the timetable ticks and unticks a cell, and presets fill the usual weeks', async () => {
  const { PRESETS, toggleSlot } = await import('../src/staff/shifts.js')
  const on = toggleSlot([], 'Monday', 'Morning')
  assert.deepEqual(on, [{ day: 'Monday', shiftType: 'Morning' }])
  assert.deepEqual(toggleSlot(on, 'Monday', 'Afternoon').length, 2)
  assert.deepEqual(toggleSlot(on, 'Monday', 'Morning'), [])
  assert.equal(PRESETS['Full time Mon–Sat'].length, 6)
  assert.ok(!PRESETS['Full time Mon–Sat'].some((s) => s.day === 'Sunday'))
  assert.deepEqual(PRESETS['Mon · Wed · Fri'].map((s) => s.day), ['Monday', 'Wednesday', 'Friday'])
})
