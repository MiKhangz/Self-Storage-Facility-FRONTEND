import { test, expect } from '@playwright/test'
import { ACCOUNTS, apiAs, loginStaff, openAdmin, uniqueEmail } from './helpers.js'

// A walk-in customer becomes a running rental at the desk, then falls behind on rent and is locked out.
test.describe.serial('front desk: walk-in, then overdue rent', () => {
  const name = `Khách Vãng Lai ${Date.now()}`
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  const daysFromToday = (n) => new Date(Date.parse(`${today}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10)
  let staff, staffApi, contract

  test.beforeAll(async ({ browser, baseURL }) => {
    staff = await (await browser.newContext()).newPage()
    staff.on('dialog', (d) => d.accept())
    staffApi = await apiAs(baseURL, ACCOUNTS.staff)
  })

  test.afterAll(async () => staffApi?.dispose())

  test('E09 staff book a walk-in, take the deposit in cash, record the paper signature and check in', async () => {
    await loginStaff(staff, ACCOUNTS.staff)
    await openAdmin(staff, 'Reservations')
    await staff.getByRole('link', { name: 'New walk-in booking' }).click()

    await staff.getByRole('tab', { name: 'New customer' }).click()
    await staff.getByLabel('Full name *').fill(name)
    await staff.getByLabel('Phone *').fill('0912345678')
    await staff.getByLabel('Email *').fill(uniqueEmail('walkin'))
    await staff.getByLabel('Facility *').selectOption({ label: 'StorEase Gò Vấp' })
    await staff.getByLabel('Size *').selectOption({ index: 1 })
    await staff.getByLabel('Unit *').selectOption({ index: 1 })
    await staff.getByRole('button', { name: 'Confirm booking & take deposit' }).click()
    await expect(staff.getByRole('heading', { name: 'Walk-in booked' })).toBeVisible()

    await staff.getByRole('link', { name: 'Go to handover' }).click()
    await staff.getByRole('button', { name: new RegExp(name) }).click()
    for (const step of ['Verify identity', 'Verify payment'])
      await staff.getByRole('checkbox', { name: new RegExp(step) }).check()
    await staff.getByRole('button', { name: 'Customer likes it' }).click()
    await staff.getByRole('button', { name: 'Draft contract' }).click()
    await staff.getByRole('button', { name: 'Customer signed on paper' }).click()
    await staff.getByRole('button', { name: 'Confirm lock given' }).click()
    await staff.getByRole('button', { name: 'Complete handover' }).click()
    await expect(staff.getByRole('heading', { name: /Handover complete/ })).toBeVisible()

    contract = (await staffApi.get('/api/contracts?status=Active&page=1&pageSize=100')).items.find((c) => c.customerName === name)
    expect(contract).toBeTruthy()
  })

  test('E10 unpaid rent opens an overdue case; the manager locks the customer out; paying at the desk restores access', async ({ browser, baseURL }) => {
    // Billing issues the first month today; a run 8 days later is past the 5-day grace period.
    const ops = await apiAs(baseURL, ACCOUNTS.ops)
    await ops.post(`/api/billing/run?date=${today}`)
    await ops.post(`/api/billing/run?date=${daysFromToday(8)}`)
    await ops.dispose()

    const manager = await (await browser.newContext()).newPage()
    manager.on('dialog', (d) => d.accept())
    await loginStaff(manager, ACCOUNTS.manager)
    await openAdmin(manager, 'Overdue Cases')
    await manager.getByRole('row', { name: new RegExp(name) }).click()
    await manager.getByRole('button', { name: 'Lock out' }).click()
    await expect(manager.getByRole('button', { name: 'Restore access' })).toBeVisible()
    expect((await staffApi.get(`/api/contracts/${contract.contractId}`)).status).toBe('Suspended')

    // The customer pays every open invoice in cash at the desk.
    await openAdmin(staff, 'Payments')
    // Wait for the list to load before counting, or an empty first render ends the loop at once.
    await expect(staff.getByRole('row', { name: new RegExp(name) }).first()).toBeVisible()
    while (await staff.getByRole('row', { name: new RegExp(name) }).count()) {
      await staff.getByRole('row', { name: new RegExp(name) }).first().click()
      await staff.getByRole('button', { name: /^Record / }).click()
      await expect(staff.getByText(/This invoice is paid/)).toBeVisible()
    }

    await expect.poll(async () => (await staffApi.get(`/api/contracts/${contract.contractId}`)).status).toBe('Active')
    await manager.context().close()
  })
})
