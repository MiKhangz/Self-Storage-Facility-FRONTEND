import { test, expect } from '@playwright/test'
import { ACCOUNTS, loginStaff, openAdmin } from './helpers.js'

test('E26 a manager ticks a usual week on the timetable and it fills the roster ahead', async ({ page }) => {
  await loginStaff(page, ACCOUNTS.manager)
  await openAdmin(page, 'Staff & Shifts')
  await page.getByLabel('Facility', { exact: true }).selectOption({ label: 'StorEase Gò Vấp' })
  await page.getByRole('button', { name: 'Weekly timetable' }).click()

  const panel = page.getByRole('region', { name: 'Weekly timetable' })
  await panel.getByLabel('Staff member').selectOption({ label: 'Nhân viên Demo' })
  await panel.getByRole('button', { name: 'Mon · Wed · Fri' }).click()
  await expect(panel.getByRole('checkbox', { name: 'Morning on Monday' })).toBeChecked()
  await expect(panel.getByRole('checkbox', { name: 'Morning on Tuesday' })).not.toBeChecked()
  await expect(panel).toContainText('3 shifts a week · 24 hours')
  // No night slot on the timetable.
  await expect(panel.getByRole('checkbox', { name: /^Night/ })).toHaveCount(0)
  await panel.getByRole('button', { name: 'Save timetable' }).click()
  await expect(panel.getByRole('status')).toContainText('Timetable saved.')

  // Next week is fully ahead, so all three mornings are there whatever the hour of the run.
  await page.getByRole('button', { name: 'Next week' }).click()
  const row = page.locator('table.sa-roster tbody tr').filter({ hasText: 'Nhân viên Demo' })
  const day = (i) => row.locator('td').nth(i + 1)
  await expect(day(0)).toContainText('07:00–15:00')
  await expect(day(1)).toContainText('Off')
  await expect(day(2)).toContainText('07:00–15:00')
  await expect(day(4)).toContainText('07:00–15:00')

  // Untick Wednesday, tick Saturday afternoon: the roster follows.
  await panel.getByRole('checkbox', { name: 'Morning on Wednesday' }).click({ force: true })
  await panel.getByRole('checkbox', { name: 'Afternoon on Saturday' }).click({ force: true })
  await panel.getByRole('button', { name: 'Save timetable' }).click()
  await expect(panel.getByRole('status')).toContainText('Timetable saved.')
  await expect(day(2)).toContainText('Off')
  await expect(day(5)).toContainText('15:00–23:00')

  // Reopened later, the timetable shows what was saved.
  await panel.getByRole('button', { name: 'Close' }).click()
  await page.getByRole('button', { name: 'Weekly timetable' }).click()
  await page.getByRole('region', { name: 'Weekly timetable' }).getByLabel('Staff member').selectOption({ label: 'Nhân viên Demo' })
  await expect(page.getByRole('checkbox', { name: 'Afternoon on Saturday' })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Morning on Wednesday' })).not.toBeChecked()
})
