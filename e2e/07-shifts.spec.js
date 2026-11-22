import { test, expect } from '@playwright/test'
import { ACCOUNTS, PASSWORD, apiAs, loginStaff, openAdmin, uniqueEmail } from './helpers.js'

test('E25 a manager plans a shift and the staff member sees it on the Dashboard and in their week', async ({ browser, baseURL }) => {
  const vietnam = (options) => new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Ho_Chi_Minh', ...options })
  const today = vietnam().slice(0, 10)
  // Sorts first by name and works at no facility, so must never be offered.
  const outsider = `Aaa Chưa Phân Công ${Date.now()}`
  const admin = await apiAs(baseURL, ACCOUNTS.admin)
  await admin.post('/api/staff', { fullName: outsider, email: uniqueEmail('outsider'), phoneNumber: '0909000222', password: PASSWORD, role: 'FacilityStaff' })
  await admin.dispose()

  const manager = await (await browser.newContext()).newPage()
  await loginStaff(manager, ACCOUNTS.manager)
  await openAdmin(manager, 'Staff & Shifts')
  await manager.getByLabel('Facility', { exact: true }).selectOption({ label: 'StorEase Gò Vấp' })
  const add = manager.getByRole('button', { name: 'Add shift' })
  const form = manager.locator('form.sa-inline-form')
  const person = form.getByLabel('Staff member')

  // As it opens, the form can be saved: someone who works here, at a time still ahead.
  await add.click()
  await expect(person.locator('option', { hasText: 'Nhân viên Demo' })).toHaveCount(1)
  await expect(person.locator('option', { hasText: outsider })).toHaveCount(0)
  const start = `${await form.getByLabel('Date').inputValue()} ${await form.locator('input[type=time]').first().inputValue()}`
  expect(start > vietnam().slice(0, 16), `${start} is still ahead`).toBe(true)

  await person.selectOption({ label: 'Quản lý Demo' })
  await form.getByRole('button', { name: 'Save shift' }).click()
  await expect(form).toBeHidden()

  // One for today, whatever the hour of the run.
  await add.click()
  await person.selectOption({ label: 'Nhân viên Demo' })
  await form.getByLabel('Date').fill(today)
  await form.locator('input[type=time]').first().fill('23:58')
  await form.locator('input[type=time]').last().fill('23:59')
  await form.getByRole('button', { name: 'Save shift' }).click()
  await expect(form).toBeHidden()

  const schedule = (page) => page.locator('section').filter({ has: page.getByRole('heading', { name: "Today's schedule" }) })
  const staff = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage()
  await loginStaff(staff, ACCOUNTS.staff)
  const row = schedule(staff).getByRole('row').filter({ hasText: '23:58–23:59' })
  await expect(row).toContainText('Shift')
  await expect(row).toContainText('StorEase Gò Vấp')
  await expect(row).toContainText('Nhân viên Demo')
  await expect(schedule(staff)).not.toContainText('Quản lý Demo') // staff see only their own
  expect(await schedule(staff).locator('.se-table-wrap').evaluate((el) => el.scrollWidth - el.clientWidth), 'columns cut off').toBeLessThanOrEqual(0)

  await openAdmin(staff, 'Staff & Shifts')
  await expect(staff.locator('table.sa-roster')).toContainText('23:58–23:59')
  await expect(staff.locator('table.sa-roster')).toContainText('StorEase Gò Vấp')
  await expect(staff.getByRole('button', { name: 'Add shift' })).toHaveCount(0)

  await openAdmin(manager, 'Dashboard')
  await expect(schedule(manager).getByRole('row').filter({ hasText: '23:58–23:59' })).toContainText('Nhân viên Demo')

  await staff.context().close()
  await manager.context().close()
})
