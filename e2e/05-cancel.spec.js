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
