import { test, expect } from '@playwright/test'
import { ACCOUNTS, PASSWORD, apiAs, loginStaff, openAdmin, uniqueEmail } from './helpers.js'

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

test('E16 an admin copies the live price version into a draft, then deletes the draft', async ({ page }) => {
  page.on('dialog', (d) => d.accept())
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

  await page.getByRole('button', { name: 'Delete draft' }).click()
  await expect(versions.locator('option')).toHaveCount(before)
  await expect(page.getByRole('button', { name: /^Copy version \d+ to a new draft$/ })).toBeVisible()
})
