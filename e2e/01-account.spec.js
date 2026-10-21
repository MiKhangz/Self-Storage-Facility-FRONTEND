import { test, expect } from '@playwright/test'
import { PASSWORD, loginCustomer, uniqueEmail } from './helpers.js'

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
