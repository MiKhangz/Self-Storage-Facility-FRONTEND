import { test, expect } from '@playwright/test'
import { ACCOUNTS, PASSWORD, loginCustomer, loginStaff, uniqueEmail } from './helpers.js'

test('E01 a new customer registers and signs in', async ({ page }) => {
  const email = uniqueEmail('register')

  await page.goto('/register')
  await page.getByLabel('Họ và tên *').fill('Khách E2E')
  await page.getByLabel('Số điện thoại *').fill('0901234567')
  await page.getByLabel('Email *').fill(email)
  await page.getByLabel(/^Mật khẩu \*/).fill(PASSWORD)
  await page.getByLabel(/^Nhập lại mật khẩu/).fill(PASSWORD)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Tạo tài khoản' }).click()

  // Development activates new accounts at once (no email step).
  await expect(page.getByRole('status')).toContainText('Đã tạo tài khoản')

  await loginCustomer(page, email)
  await expect(page.getByText('Khách E2E').first()).toBeVisible()
})

test('E20 a customer asks for a new verification email from a bad link and from a blocked sign-in', async ({ page }) => {
  await page.goto('/verify-email?token=bad')
  await expect(page.getByRole('heading', { name: 'Kích hoạt không thành công' })).toBeVisible()
  await page.getByLabel('Email').fill(uniqueEmail('resend'))
  await page.getByRole('button', { name: 'Gửi lại email xác nhận' }).click()
  await expect(page.getByRole('status')).toContainText('liên kết mới')
  await expect(page.getByRole('button', { name: /Gửi lại sau/ })).toBeDisabled()

  // Development activates every account, so the 403 of an unverified one is answered here.
  await page.route('**/api/auth/login', (r) => r.fulfill({ status: 403, json: { title: 'Please verify your email address before signing in.' } }))
  await page.goto('/login')
  await page.getByLabel('Email').fill(uniqueEmail('pending'))
  await page.getByLabel(/^Mật khẩu/).fill(PASSWORD)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await page.getByRole('button', { name: 'Gửi lại email xác nhận' }).click()
  await expect(page.getByRole('status')).toContainText('liên kết mới')
})

test('E21 two windows of one browser keep their own staff sign-in, through a reload and a log out', async ({ context }) => {
  const staff = await context.newPage()
  await loginStaff(staff, ACCOUNTS.staff)
  const admin = await context.newPage()
  await loginStaff(admin, ACCOUNTS.admin)
  const person = (page) => page.getByText(/^(Facility staff|System administrator)$/)

  await staff.reload()
  await admin.reload()
  await expect(person(staff)).toHaveText('Facility staff')
  await expect(person(admin)).toHaveText('System administrator')

  // A window opened afterwards starts from the latest sign-in.
  const third = await context.newPage()
  await third.goto('/admin')
  await expect(person(third)).toHaveText('System administrator')

  await staff.getByRole('button', { name: 'Log out' }).click()
  await admin.reload()
  await expect(person(admin)).toHaveText('System administrator')
})
