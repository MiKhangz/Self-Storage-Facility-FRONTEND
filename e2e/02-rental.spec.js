import { test, expect } from '@playwright/test'
import { ACCOUNTS, PASSWORD, apiAs, loginStaff, openAdmin, uniqueEmail } from './helpers.js'

// One rental from booking to handover, each step a test. Later steps use what earlier ones made, so they run in order
// and stop at the first failure. The customer and the staff member each have their own browser window.
test.describe.serial('rental: book, deposit, assign, contract, check in, rent, renew, hand back', () => {
  const name = `Khách E2E ${Date.now()}`
  const email = uniqueEmail('rental')
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })
  let customer, staff, staffApi, reservationCode, reservationId, contract, accessCode

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

  test('E04 at the handover the customer sees the unit, likes it and signs the paper contract', async () => {
    await openAdmin(staff, 'Handover')
    await staff.getByRole('button', { name: new RegExp(name) }).click()
    await expect(staff.getByRole('heading', { name: new RegExp(`Handover · ${name}`) })).toBeVisible()
    for (const step of ['Verify identity', 'Verify payment'])
      await staff.getByRole('checkbox', { name: new RegExp(step) }).check()
    // Nothing is signed before the customer has seen the unit.
    await expect(staff.getByRole('button', { name: 'Draft contract' })).toBeHidden()
    await staff.getByRole('button', { name: 'Customer likes it' }).click()
    await staff.getByRole('button', { name: 'Draft contract' }).click()

    // The customer sees the term, price and deposit bill before signing; staff print both.
    await expect(staff.locator('.sa-contract-summary')).toContainText('Monthly rent')
    const [contractDoc] = await Promise.all([staff.waitForEvent('popup'), staff.getByRole('button', { name: 'Print contract' }).click()])
    await expect(contractDoc.locator('body')).toContainText('HỢP ĐỒNG THUÊ KHO')
    await expect(contractDoc.locator('body')).toContainText('Tiền thuê mỗi tháng')
    await contractDoc.close()
    const [receipt] = await Promise.all([staff.waitForEvent('popup'), staff.getByRole('button', { name: 'Print deposit receipt' }).click()])
    await expect(receipt.locator('body')).toContainText('BIÊN LAI TIỀN CỌC')
    await expect(receipt.locator('body')).toContainText('Đã thanh toán đủ')
    await receipt.close()

    await staff.getByRole('button', { name: 'Customer signed on paper' }).click()
    await expect(staff.getByText(/signed \d/)).toBeVisible()

    // The customer sees the signed contract in their account.
    await customer.getByRole('link', { name: 'Đến Kho của tôi' }).click()
    await customer.getByRole('link', { name: 'Xem chi tiết' }).first().click()
    await expect(customer.getByRole('button', { name: 'Ký hợp đồng' })).toBeHidden()
  })

  test('E05 staff complete the handover and the contract becomes Active', async () => {
    await staff.getByRole('button', { name: 'Confirm lock given' }).click()
    await staff.getByRole('button', { name: 'Complete handover' }).click()

    await expect(staff.getByRole('heading', { name: /Handover complete/ })).toBeVisible()
    accessCode = (await staff.locator('.se-code-digits').innerText()).replace(/\D/g, '')
    const contracts = await staffApi.get(`/api/contracts?page=1&pageSize=100`)
    contract = contracts.items.find((c) => c.reservationId === reservationId)
    expect(contract.status).toBe('Active')
  })

  test('E05b the customer is inside after the handover; each visit ends with a new code, and staff fix a forgotten check-out', async () => {
    await openAdmin(staff, 'Check-in / out')
    const row = staff.getByRole('row', { name: new RegExp(name) })
    await expect(row).toContainText('Inside')
    const code = staff.getByLabel(/Customer's access code/)
    const find = async (pin) => { await code.fill(pin); await staff.getByRole('button', { name: 'Find' }).click() }

    await find(accessCode)
    await staff.getByRole('button', { name: 'Check out', exact: true }).click()
    await expect(row).toContainText('Out')

    // The code died with the visit: someone who overheard it gets nowhere.
    await find(accessCode)
    await expect(staff.getByRole('alert')).toContainText('No working access code matches')

    // The renter reads the new code in their account.
    await customer.reload()
    await customer.getByRole('button', { name: 'Hiện mã' }).click()
    const shown = customer.getByLabel(/^Mã ra vào \d{6}$/)
    await expect(shown).toBeVisible()
    const fresh = (await shown.getAttribute('aria-label')).replace(/\D/g, '')
    expect(fresh).not.toBe(accessCode)

    await find(fresh)
    await staff.getByRole('button', { name: 'Check in', exact: true }).click()
    await expect(row).toContainText('Inside')

    // They went home without saying their code: staff close the visit with a reason (the code changes again).
    await row.getByRole('button', { name: 'Mark as left' }).click()
    await staff.getByLabel('Reason *').fill('Forgot to check out at the desk')
    await staff.getByRole('dialog').getByRole('button', { name: 'Mark as left' }).click()
    await expect(row).toContainText('marked by staff')
    await find(fresh)
    await expect(staff.getByRole('alert')).toContainText('No working access code matches')

    // A renter reports a problem with their unit (needs the ticket categories every database is given).
    await customer.getByRole('link', { name: 'Báo sự cố' }).click()
    await customer.getByRole('radiogroup', { name: 'Loại vấn đề' }).getByRole('radio', { name: 'Hư hỏng / sửa chữa' }).click()
    await customer.getByLabel('Tiêu đề').fill('Trần bị dột')
    await customer.getByLabel('Mô tả chi tiết').fill('Nước nhỏ giọt từ trần kho.')
    await customer.getByRole('button', { name: /Gửi yêu cầu/ }).click()
    await expect(customer).toHaveURL(/\/support\/requests\/\d+$/)
    await customer.goto('/my-storage')
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

  test('E08 the customer hands the unit back; staff inspect, ops settle and pay back the deposit', async ({ browser }) => {
    await customer.getByRole('link', { name: 'Yêu cầu trả kho' }).click()
    await customer.getByLabel('Ngày dự kiến trả kho').fill(today)
    for (const box of await customer.locator('.se-checklist').getByRole('checkbox').all()) await box.check()
    await customer.getByLabel('Cách nhận tiền cọc').selectOption('Cash')
    await customer.getByRole('button', { name: /Gửi yêu cầu trả kho/ }).click()
    await expect(customer.getByRole('button', { name: /Gửi yêu cầu trả kho/ })).toBeHidden()

    await openAdmin(staff, 'Returns')
    await staff.getByRole('row', { name: new RegExp(name) }).click()
    await staff.getByRole('button', { name: 'Approve & book inspection' }).click()
    await staff.getByRole('tab', { name: /Approved/ }).click()
    await staff.getByRole('row', { name: new RegExp(name) }).click()
    await staff.getByRole('radiogroup', { name: 'Unit condition' }).getByRole('radio', { name: 'Good' }).click()
    await staff.getByRole('button', { name: 'Save inspection' }).click()

    const ops = await (await browser.newContext()).newPage()
    ops.on('dialog', (d) => d.accept())
    await loginStaff(ops, ACCOUNTS.ops)
    await openAdmin(ops, 'Returns')
    await ops.getByRole('tab', { name: /Inspected/ }).click()
    await ops.getByRole('row', { name: new RegExp(name) }).click()
    await ops.getByRole('button', { name: 'Settle deposit & close' }).click()
    await expect(ops.getByText('Refund', { exact: true })).toBeVisible()

    expect((await staffApi.get(`/api/contracts/${contract.contractId}`)).status).toBe('Closed')

    // The refund now waits in Deposit Refunds until ops pay it; then the customer sees it as paid back.
    await ops.getByRole('button', { name: 'Done' }).click()
    await openAdmin(ops, 'Deposit Refunds')
    await ops.getByRole('row', { name: new RegExp(name) }).click()
    await ops.getByRole('button', { name: 'Mark as paid' }).click()
    await expect(ops.getByRole('row', { name: new RegExp(name) })).toBeHidden()
    await ops.context().close()

    await customer.getByRole('link', { name: 'Thanh toán và hóa đơn' }).click()
    await expect(customer.getByText(/Đã hoàn/)).toBeVisible()
  })
})
