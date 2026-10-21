import { test, expect } from '@playwright/test'
import { ACCOUNTS, PASSWORD, apiAs, loginStaff, openAdmin, uniqueEmail } from './helpers.js'

// One rental from booking to check-in, each step a test. Later steps use what earlier ones made, so they run in order
// and stop at the first failure. The customer and the staff member each have their own browser window.
test.describe.serial('rental: book, deposit, assign, contract, check in, rent, renew, hand back', () => {
  const name = `Khách E2E ${Date.now()}`
  const email = uniqueEmail('rental')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  let customer, staff, staffApi, reservationCode, reservationId, contract

  test.beforeAll(async ({ browser, baseURL }) => {
    customer = await (await browser.newContext()).newPage()
    staff = await (await browser.newContext()).newPage()
    // window.confirm() guards money and contract actions; the tests always mean yes.
    for (const page of [customer, staff]) page.on('dialog', (d) => d.accept())
    staffApi = await apiAs(baseURL, ACCOUNTS.staff)
  })

  test.afterAll(async () => staffApi?.dispose())

  test('E02 a customer books a unit and pays the deposit', async () => {
    await customer.goto('/register')
    await customer.getByLabel('Họ và tên *').fill(name)
    await customer.getByLabel('Số điện thoại *').fill('0907654321')
    await customer.getByLabel('Email *').fill(email)
    await customer.getByLabel(/^Mật khẩu \*/).fill(PASSWORD)
    await customer.getByLabel(/^Nhập lại mật khẩu/).fill(PASSWORD)
    await customer.getByRole('checkbox').check()
    await customer.getByRole('button', { name: 'Tạo tài khoản' }).click()
    await expect(customer.getByRole('status')).toContainText('Đã tạo tài khoản')

    // Choosing a unit is public; the details step asks for a sign-in and comes back.
    await customer.goto('/booking')
    await customer.getByLabel('Cơ sở').selectOption({ label: 'StorEase Gò Vấp' })
    await customer.getByRole('radiogroup', { name: 'Kích thước kho' }).getByRole('radio').first().click()
    await customer.getByRole('radiogroup', { name: 'Thời hạn thuê' }).getByRole('radio', { name: /^1 tháng/ }).click()
    await customer.getByRole('button', { name: /Tiếp tục/ }).click()

    await expect(customer).toHaveURL(/\/login/)
    await customer.getByLabel('Email').fill(email)
    await customer.getByLabel(/^Mật khẩu/).fill(PASSWORD)
    await customer.getByRole('button', { name: 'Đăng nhập', exact: true }).click()

    await expect(customer).toHaveURL(/\/booking\/details/)
    await customer.getByRole('checkbox').check()
    await customer.getByRole('button', { name: /Xác nhận đặt kho/ }).click()

    await expect(customer).toHaveURL(/\/booking\/confirmed\//)
    reservationId = Number(customer.url().split('/').pop())
    reservationCode = (await customer.locator('.se-ticket-head strong').innerText()).trim()
    await customer.getByRole('button', { name: 'Thanh toán tiền cọc ngay' }).click()
    await expect(customer.getByText('Đã thanh toán')).toBeVisible()

    const reservation = await staffApi.get(`/api/reservations/${reservationId}`)
    expect(reservation.status).toBe('Pending')
    expect(reservation.depositStatus).toBe('Paid')
  })

  test('E03 staff assign a free unit', async () => {
    await loginStaff(staff, ACCOUNTS.staff)
    await openAdmin(staff, 'Reservations')
    await staff.getByRole('row', { name: new RegExp(reservationCode) }).click()
    await staff.getByRole('radiogroup', { name: 'Unit to assign' }).getByRole('radio').first().check()
    await staff.getByRole('button', { name: 'Confirm & assign' }).click()

    await expect.poll(async () => (await staffApi.get(`/api/reservations/${reservationId}`)).status).toBe('Confirmed')
  })

  test('E04 staff draft the contract and the customer signs it', async () => {
    await openAdmin(staff, 'Check-in')
    await staff.getByRole('button', { name: new RegExp(name) }).click()
    await staff.getByRole('button', { name: 'Draft contract' }).click()
    await expect(staff.getByRole('heading', { name: new RegExp(`Check-in · ${name}`) })).toBeVisible()

    await customer.getByRole('link', { name: 'Đến Kho của tôi' }).click()
    await customer.getByRole('link', { name: 'Xem chi tiết' }).first().click()
    await customer.getByRole('button', { name: 'Ký hợp đồng' }).click()
    await expect(customer.getByRole('button', { name: 'Ký hợp đồng' })).toBeHidden()
  })

  test('E05 staff complete the check-in and the contract becomes Active', async () => {
    // Reopen the desk so it reads the signature the customer just made.
    await openAdmin(staff, 'Reservations')
    await openAdmin(staff, 'Check-in')
    await staff.getByRole('button', { name: new RegExp(name) }).click()
    for (const step of ['Verify identity', 'Verify payment', 'Inspect unit with customer'])
      await staff.getByRole('checkbox', { name: new RegExp(step) }).check()
    await staff.getByLabel('Lock serial no.').fill('LOCK-E2E-1')
    await staff.getByLabel('Access card no.').fill('CARD-E2E-1')
    await staff.getByRole('button', { name: 'Complete check-in' }).click()

    await expect(staff.getByRole('heading', { name: /Check-in complete/ })).toBeVisible()
    const contracts = await staffApi.get(`/api/contracts?page=1&pageSize=100`)
    contract = contracts.items.find((c) => c.reservationId === reservationId)
    expect(contract.status).toBe('Active')
  })

  test('E06 the billing run issues rent and the customer pays it online', async ({ baseURL }) => {
    const ops = await apiAs(baseURL, ACCOUNTS.ops)
    await ops.post(`/api/billing/run?date=${today}`)
    await ops.dispose()

    await customer.getByRole('link', { name: 'Thanh toán và hóa đơn' }).click()
    await customer.getByRole('button', { name: 'Thanh toán ngay' }).click()
    await expect.poll(async () => {
      const invoices = (await staffApi.get('/api/invoices?page=1&pageSize=100')).items.filter((i) => i.contractId === contract.contractId)
      return invoices.length > 0 && invoices.every((i) => i.status === 'Paid')
    }).toBe(true)
  })

  test('E07 the customer asks for a renewal and the manager approves it', async ({ browser }) => {
    // The header and the account menu both link to it.
    await customer.getByRole('link', { name: 'Kho của tôi', exact: true }).first().click()
    await customer.getByRole('link', { name: 'Xem chi tiết' }).first().click()
    await customer.getByRole('radiogroup', { name: 'Thời gian gia hạn' }).getByRole('radio').first().click()
    await customer.getByRole('button', { name: 'Gửi yêu cầu gia hạn' }).click()

    const manager = await (await browser.newContext()).newPage()
    manager.on('dialog', (d) => d.accept())
    await loginStaff(manager, ACCOUNTS.manager)
    await openAdmin(manager, 'Customers & Contracts')
    await manager.getByRole('row', { name: new RegExp(contract.contractNumber) }).getByRole('button', { name: 'Approve' }).click()

    await expect.poll(async () => (await staffApi.get(`/api/contracts/${contract.contractId}`)).endDate).not.toBe(contract.endDate)
    await manager.context().close()
  })

  test('E08 the customer hands the unit back; staff inspect and ops settle the deposit', async ({ browser }) => {
    await customer.getByRole('link', { name: 'Yêu cầu trả kho' }).click()
    await customer.getByLabel('Ngày dự kiến trả kho').fill(today)
    for (const box of await customer.locator('.se-checklist').getByRole('checkbox').all()) await box.check()
    await customer.getByLabel('Cách nhận tiền cọc').selectOption('Cash')
    await customer.getByRole('button', { name: /Gửi yêu cầu trả kho/ }).click()
    await expect(customer.getByRole('button', { name: /Gửi yêu cầu trả kho/ })).toBeHidden()

    await openAdmin(staff, 'Handovers')
    await staff.getByRole('row', { name: new RegExp(name) }).click()
    await staff.getByRole('button', { name: 'Approve & book inspection' }).click()
    await staff.getByRole('tab', { name: /Approved/ }).click()
    await staff.getByRole('row', { name: new RegExp(name) }).click()
    await staff.getByRole('radiogroup', { name: 'Unit condition' }).getByRole('radio', { name: 'Good' }).click()
    await staff.getByRole('button', { name: 'Save inspection' }).click()

    const ops = await (await browser.newContext()).newPage()
    ops.on('dialog', (d) => d.accept())
    await loginStaff(ops, ACCOUNTS.ops)
    await openAdmin(ops, 'Handovers')
    await ops.getByRole('tab', { name: /Inspected/ }).click()
    await ops.getByRole('row', { name: new RegExp(name) }).click()
    await ops.getByRole('button', { name: 'Settle deposit & close' }).click()
    await expect(ops.getByText('Refund', { exact: true })).toBeVisible()

    expect((await staffApi.get(`/api/contracts/${contract.contractId}`)).status).toBe('Closed')
    await ops.context().close()
  })
})
