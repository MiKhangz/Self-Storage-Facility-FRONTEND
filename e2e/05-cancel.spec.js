import { test, expect, request } from '@playwright/test'
import { ACCOUNTS, PASSWORD, apiAs, loginCustomer, loginStaff, openAdmin, uniqueEmail } from './helpers.js'

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Ho_Chi_Minh' })

/** A new customer with a booking at Gò Vấp whose deposit is paid, made through the API (E02 covers the screens). */
async function bookedCustomer(baseURL) {
  const email = uniqueEmail('cancel')
  const name = `Khách Huỷ ${Date.now()}`
  const anon = await request.newContext({ baseURL })
  expect((await anon.post('/api/auth/register', { data: { fullName: name, email, phoneNumber: '0909000111', password: PASSWORD } })).ok()).toBeTruthy()
  await anon.dispose()
  const me = await apiAs(baseURL, email)
  const facility = (await me.get('/api/facilities?page=1&pageSize=50')).items.find((f) => f.name === 'StorEase Gò Vấp')
  const type = (await me.get('/api/unit-types'))[0]
  const reservation = await me.post('/api/reservations', { facilityId: facility.facilityId, unitTypeId: type.unitTypeId, moveInDate: today(), rentalMonths: 1 })
  const intent = await me.post(`/api/invoices/${reservation.depositInvoiceId}/payments/online`, { amount: reservation.depositAmount, referenceNo: null })
  await me.post(`/api/payments/${intent.paymentCode}/simulate-success`)
  await me.dispose()
  return { email, name, reservation }
}

async function owedRefund(baseURL, reservationId) {
  const ops = await apiAs(baseURL, ACCOUNTS.ops)
  const refunds = (await ops.get('/api/deposit-refunds?page=1&pageSize=100')).items
  await ops.dispose()
  return refunds.find((r) => r.reservationId === reservationId)
}

test('E13 a customer cancels a fresh booking and the deposit is owed back', async ({ page, baseURL }) => {
  const { email, reservation } = await bookedCustomer(baseURL)
  page.on('dialog', (d) => d.accept())

  await loginCustomer(page, email)
  await page.getByRole('link', { name: 'Xem đơn đặt kho' }).click()
  await expect(page.getByText(/được hoàn lại/)).toBeVisible()
  await page.getByRole('button', { name: 'Huỷ đặt kho' }).click()

  await expect(page.getByRole('status')).toContainText('sẽ được hoàn lại')
  await page.getByRole('button', { name: 'Đóng' }).click()
  await expect(page.getByRole('heading', { name: 'Đơn đặt kho đã huỷ' })).toBeVisible()
  const refund = await owedRefund(baseURL, reservation.reservationId)
  expect(refund).toMatchObject({ source: 'Cancellation', status: 'Pending', amount: reservation.depositAmount })
})

test('E14 staff cancel a booking from Reservations and the deposit is owed back', async ({ page, baseURL }) => {
  const { name, reservation } = await bookedCustomer(baseURL)
  page.on('dialog', (d) => d.accept())

  await loginStaff(page, ACCOUNTS.staff)
  await openAdmin(page, 'Reservations')
  await page.getByRole('row', { name: new RegExp(reservation.reservationCode) }).click()
  // Its move-in date is today, so it is too early for a no-show.
  await expect(page.getByRole('button', { name: 'Mark no-show' })).toBeHidden()
  await page.getByLabel('Reason (optional)').fill('Khách gọi điện huỷ')
  await page.getByRole('button', { name: 'Cancel booking' }).click()

  await expect(page.getByRole('status')).toContainText('waits in Deposit Refunds')
  const refund = await owedRefund(baseURL, reservation.reservationId)
  expect(refund).toMatchObject({ source: 'Cancellation', status: 'Pending', customerName: name })
})

test('E15 ops pay a cancellation refund by bank transfer and the customer sees it paid back', async ({ page, browser, baseURL }) => {
  const { email, name, reservation } = await bookedCustomer(baseURL)
  const me = await apiAs(baseURL, email)
  await me.post(`/api/reservations/${reservation.reservationId}/cancel`, { reason: null })
  await me.dispose()
  page.on('dialog', (d) => d.accept())

  await loginStaff(page, ACCOUNTS.ops)
  await openAdmin(page, 'Deposit Refunds')
  await page.getByRole('row', { name: new RegExp(name) }).click()
  await page.getByLabel('Paid by').selectOption('BankTransfer')
  // A transfer cannot be recorded without the bank's reference.
  await expect(page.getByRole('button', { name: 'Mark as paid' })).toBeDisabled()
  await page.getByLabel(/^Transfer reference/).fill('FT2610220001')
  await page.getByRole('button', { name: 'Mark as paid' }).click()
  await expect(page.getByRole('row', { name: new RegExp(name) })).toBeHidden()

  const customer = await (await browser.newContext()).newPage()
  await loginCustomer(customer, email)
  await customer.getByRole('link', { name: 'Thanh toán và hóa đơn' }).click()
  await expect(customer.getByText(/Đã hoàn .* chuyển khoản/)).toBeVisible()
  await customer.context().close()
})
