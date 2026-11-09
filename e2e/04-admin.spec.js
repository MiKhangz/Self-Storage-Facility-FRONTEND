import { test, expect } from '@playwright/test'
import { ACCOUNTS, PASSWORD, apiAs, loginCustomer, loginStaff, openAdmin, uniqueEmail, autoConfirm } from './helpers.js'

test('E11 an admin opens a facility with a floor and a unit, and customers can see it', async ({ page, browser }) => {
  const stamp = Date.now().toString().slice(-6)
  const facility = `StorEase E2E ${stamp}`

  await loginStaff(page, ACCOUNTS.admin)
  await openAdmin(page, 'Facilities')
  await page.getByRole('link', { name: 'Add facility' }).click()
  await page.getByLabel('Facility name *').fill(facility)
  await page.getByLabel('Facility code *').fill(`E${stamp}`)
  await page.getByLabel('Street address *').fill('12 Đường Thử')
  await page.getByLabel('District *').fill('Quận 1')
  await page.getByRole('button', { name: 'Create facility' }).click()
  await expect(page).toHaveURL(/\/admin\/facilities\/\d+$/)

  await page.getByLabel('Floor number *').fill('1')
  await page.getByRole('button', { name: 'Add floor' }).click()
  await expect(page.getByRole('listitem').filter({ hasText: 'Floor 1' })).toBeVisible()
  await page.getByLabel('Size *').selectOption({ index: 1 })
  await page.getByLabel('Unit code *').fill('E2E-101')
  await page.getByRole('button', { name: 'Add unit' }).click()
  await expect(page.getByRole('status')).toContainText('Unit E2E-101 added')

  // A floor closes for renovation and opens again.
  await page.getByRole('button', { name: 'Edit floor 1' }).click()
  await page.getByLabel('Status').first().selectOption('Renovation')
  await page.getByRole('button', { name: 'Save floor' }).click()
  await expect(page.locator('.sa-floor-row').filter({ hasText: 'Floor 1' })).toContainText('Renovation')
  await page.getByRole('button', { name: 'Edit floor 1' }).click()
  await page.getByLabel('Status').first().selectOption('Open')
  await page.getByRole('button', { name: 'Save floor' }).click()
  await expect(page.locator('.sa-floor-row').filter({ hasText: 'Floor 1' })).toContainText('Open')

  // Nobody works there yet, so customers do not see it.
  const visitor = await (await browser.newContext()).newPage()
  await visitor.goto('/locations')
  await expect(visitor.getByRole('heading', { level: 1 })).toBeVisible()
  await expect(visitor.getByText(facility)).toHaveCount(0)

  // Once it has a manager, they do.
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Edit facility' }).click()
  await page.getByLabel('Manager').selectOption({ label: 'Quản lý Demo · manager@storease.vn' })
  await page.getByRole('button', { name: 'Save facility' }).click()
  await expect(page.getByRole('status')).toContainText('Facility saved')
  await visitor.reload()
  await expect(visitor.getByText(facility).first()).toBeVisible()
  await visitor.context().close()
})

test('E12 an admin creates a staff account; a manager can change only their own facility for it', async ({ page, browser, baseURL }) => {
  const email = uniqueEmail('staff')

  await loginStaff(page, ACCOUNTS.admin)
  await openAdmin(page, 'Users & Roles')
  // The role help: searching narrows the matrix to the matching feature.
  await page.getByRole('button', { name: 'Who can do what?' }).click()
  await page.getByLabel('Find a feature').fill('refund')
  await expect(page.getByRole('dialog').getByRole('row', { name: /Settle a deposit refund/ })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close' }).click()
  await page.getByRole('link', { name: 'Add user' }).click()
  await page.getByLabel('Full name *').fill('Nhân viên E2E')
  await page.getByLabel('Work email *').fill(email)
  await page.getByLabel('Phone *').fill('0933000111')
  await page.getByLabel(/^Temporary password/).fill(PASSWORD)
  await page.getByRole('radio', { name: 'Facility Staff' }).check()
  await page.getByRole('button', { name: 'Choose facilities' }).click()
  const picker = page.getByRole('dialog')
  await picker.getByLabel('Search by name').fill('Gò Vấp')
  await expect(picker.getByRole('checkbox')).toHaveCount(1)
  await picker.getByRole('checkbox', { name: /StorEase Gò Vấp/ }).check()
  await picker.getByRole('button', { name: 'Done' }).click()
  await expect(page.locator('.sa-chip')).toContainText('StorEase Gò Vấp')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL(/\/admin\/users$/)

  const manager = await (await browser.newContext()).newPage()
  await loginStaff(manager, ACCOUNTS.manager)
  await openAdmin(manager, 'Users & Roles')
  await manager.getByRole('row', { name: new RegExp(email) }).click()
  const panel = manager.locator('.sa-side-panel')
  await panel.getByRole('button', { name: 'Choose facilities' }).click()
  const managerPicker = manager.getByRole('dialog')
  // Other facilities are not the manager's to give or take away.
  for (const box of await managerPicker.getByRole('checkbox').all())
    if (!(await box.isChecked())) await expect(box).toBeDisabled()
  await managerPicker.getByRole('checkbox', { name: /StorEase Gò Vấp/ }).uncheck()
  await managerPicker.getByRole('button', { name: 'Done' }).click()
  await panel.getByRole('button', { name: 'Save changes' }).click()

  const admin = await apiAs(baseURL, ACCOUNTS.admin)
  await expect.poll(async () => {
    const staff = (await admin.get('/api/staff?page=1&pageSize=100')).items.find((u) => u.email === email)
    return staff.facilities.length
  }).toBe(0)
  await admin.dispose()
  await manager.context().close()
})

test('E16 an admin copies the live price version into a draft; Cancel keeps it, Confirm deletes it', async ({ page }) => {
  await loginStaff(page, ACCOUNTS.admin)
  await openAdmin(page, 'Pricing & Policies')
  const versions = page.getByLabel('Policy version')
  await expect(versions).toBeVisible() // count only once the versions have loaded
  const before = await versions.locator('option').count()

  await page.getByRole('button', { name: /^Copy version \d+ to a new draft$/ }).click()
  await expect(page.getByRole('button', { name: /^Publish version/ })).toBeVisible()
  // The draft starts with the copied prices, not zeros.
  await expect(page.getByLabel('S5 basePricePerMonth')).toHaveValue('900000')
  await expect(versions.locator('option')).toHaveCount(before + 1)

  // Answered by hand: Cancel must leave the draft, and screen readers must hear the question.
  await page.getByRole('button', { name: 'Delete draft' }).click()
  const ask = page.getByRole('dialog', { name: /^Delete draft version \d+\?/ })
  await ask.getByRole('button', { name: 'Cancel' }).click()
  await expect(ask).toHaveCount(0)
  await expect(versions.locator('option')).toHaveCount(before + 1)

  await page.getByRole('button', { name: 'Delete draft' }).click()
  await ask.getByRole('button', { name: 'Confirm' }).click()
  await expect(versions.locator('option')).toHaveCount(before)
  await expect(page.getByRole('button', { name: /^Copy version \d+ to a new draft$/ })).toBeVisible()
})

test('E19 ops add, edit and delete a unit size', async ({ page }) => {
  await autoConfirm(page)
  const code = `T${Date.now() % 100000}`
  await loginStaff(page, ACCOUNTS.ops)
  await page.getByRole('navigation').getByRole('link', { name: 'Unit Sizes' }).click()

  await page.getByRole('button', { name: 'New size' }).click()
  await page.getByLabel('Code').fill(code)
  await page.getByLabel('Name').fill('Test size')
  await page.getByLabel('Area (m²)').fill('7.5')
  await page.getByLabel('Width (m)').fill('2.5')
  await page.getByLabel('Depth (m)').fill('3')
  await page.getByLabel('Height (m)').fill('2.4')
  await page.getByRole('button', { name: 'Save size' }).click()
  const row = page.getByRole('row', { name: new RegExp(code) })
  await expect(row.getByRole('link', { name: 'Set a price' })).toBeVisible()

  await row.getByRole('cell', { name: 'Test size' }).click()
  await page.getByLabel('Name').fill('Renamed size')
  await page.getByRole('button', { name: 'Save size' }).click()
  await expect(row.getByRole('cell', { name: 'Renamed size' })).toBeVisible()

  await row.getByRole('cell', { name: 'Renamed size' }).click()
  await page.getByRole('button', { name: 'Delete size' }).click()
  await expect(row).toBeHidden()

  // A size in use stays: units and prices refer to it.
  await page.locator('tbody tr').first().click()
  await page.getByRole('button', { name: 'Delete size' }).click()
  await expect(page.getByRole('alert')).toContainText('cannot be deleted')
})

test('E22 an admin checks the log of users of every role, from the log, the Users page and a customer page', async ({ page, browser }) => {
  // A sign-in each, so a fresh database holds a customer's and a staff member's log.
  await loginCustomer(await (await browser.newContext()).newPage())
  await loginStaff(await (await browser.newContext()).newPage(), ACCOUNTS.staff)

  await loginStaff(page, ACCOUNTS.admin)
  await openAdmin(page, 'Activity Log')
  await page.getByLabel('Role').selectOption('StorageCustomer')
  const rows = page.locator('tbody tr:not(.sa-day-row)') // day headings are not entries
  await expect(rows.first()).toContainText('Storage customer')
  await expect(rows.filter({ hasNotText: 'Storage customer' })).toHaveCount(0)
  await expect(rows.filter({ hasText: 'Signed in' }).first()).toBeVisible()
  await page.getByLabel('Include sign-ins').uncheck()
  await expect(rows.filter({ hasText: 'Signed in' })).toHaveCount(0)

  await openAdmin(page, 'Users & Roles')
  await page.getByRole('row', { name: new RegExp(ACCOUNTS.staff) }).click()
  await page.getByRole('link', { name: 'View activity log' }).click()
  await expect(page.getByText(/^Showing the log of/)).toBeVisible()
  await expect(rows.filter({ hasNotText: ACCOUNTS.staff })).toHaveCount(0)

  await page.getByRole('button', { name: 'Show everyone' }).click()
  await page.getByRole('link', { name: 'Khách Demo' }).first().click()
  await expect(page).toHaveURL(/userId=\d+/)
  await expect(rows.filter({ hasNotText: ACCOUNTS.customer })).toHaveCount(0)
})

test('E23 ops publish their own prices for one facility; its quote changes and another facility keeps the standard', async ({ page, baseURL }) => {
  await autoConfirm(page)
  // E11's facility: no other test books there, so its own prices change nothing elsewhere.
  const ops = await apiAs(baseURL, ACCOUNTS.ops)
  const facilities = (await ops.get('/api/facilities?page=1&pageSize=100')).items
  const mine = facilities.find((f) => f.name.startsWith('StorEase E2E'))
  const size = (await ops.get(`/api/facilities/${mine.facilityId}`)).unitTypes.find((t) => t.availableUnits > 0)
  // Another facility with a free unit of that size, to quote the standard price.
  let other
  for (const f of facilities.filter((x) => x.facilityId !== mine.facilityId)) {
    if ((await ops.get(`/api/facilities/${f.facilityId}`)).unitTypes.some((t) => t.unitTypeId === size.unitTypeId && t.availableUnits > 0)) { other = f; break }
  }
  const moveInDate = new Date(Date.now() + 2 * 864e5).toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  const quote = async (facilityId) => (await ops.get(`/api/unit-types/${size.unitTypeId}/quote?facilityId=${facilityId}&moveInDate=${moveInDate}&rentalMonths=1`)).monthlyRent
  const standard = await quote(other.facilityId)

  await loginStaff(page, ACCOUNTS.ops)
  await openAdmin(page, 'Pricing & Policies')
  await page.getByLabel('Price list').selectOption({ label: mine.name })
  await expect(page.getByText(/uses the company standard prices/)).toBeVisible()
  await page.getByRole('button', { name: 'Edit prices' }).click()

  const row = page.getByRole('table', { name: 'Facility prices' }).getByRole('row').filter({ hasText: size.code }).first()
  await row.getByRole('checkbox').check()
  await row.getByRole('spinbutton').first().fill('1234000')
  await page.getByRole('button', { name: 'Save changes' }).click()
  await expect(page.getByRole('button', { name: 'Save changes' })).toBeDisabled()
  await page.getByRole('button', { name: 'Publish' }).click()
  await expect(page.getByText(/version 1 live since/)).toBeVisible()
  await expect(row).toContainText('Own price')

  // The history names who published version 1 and shows the new price against the company standard.
  await page.getByText('History', { exact: true }).click()
  await page.locator('.sa-history-entry summary').first().click()
  await expect(page.getByText(/published by .+ on/)).toBeVisible()
  const change = page.getByRole('table', { name: 'Changes in version 1' }).getByRole('row').filter({ hasText: size.code })
  await expect(change).toContainText('1.234.000')
  await expect(change).toContainText('Now own price, was the company standard')

  expect(await quote(mine.facilityId)).toBe(1234000)
  expect(await quote(other.facilityId)).toBe(standard)
  await ops.dispose()
})
