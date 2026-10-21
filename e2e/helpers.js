import { expect, request } from '@playwright/test'

// Seeded by the backend's DbSeeder (password Demo@123); the E2E database is rebuilt before every run.
export const PASSWORD = 'Demo@123'
export const ACCOUNTS = {
  customer: 'customer@storease.vn',
  staff: 'staff@storease.vn',
  manager: 'manager@storease.vn',
  ops: 'ops@storease.vn',
  admin: 'admin@storease.vn',
}

/** A fresh address per call, so tests never collide on unique emails. */
export const uniqueEmail = (prefix = 'e2e') => `${prefix}.${Date.now()}.${Math.floor(Math.random() * 1e4)}@e2e.storease.vn`

/** Signs in on the customer site. The token lives in memory only, so never reload the page afterwards. */
export async function loginCustomer(page, email = ACCOUNTS.customer, password = PASSWORD) {
  await page.goto('/login')
  await page.getByLabel('Email').fill(email)
  // The password label also holds the show/hide button text, so match the start of its name.
  await page.getByLabel(/^Mật khẩu/).fill(password)
  await page.getByRole('button', { name: 'Đăng nhập', exact: true }).click()
  await expect(page).not.toHaveURL(/\/login/)
}

/** Signs in on the admin portal as one of the seeded staff accounts (or any staff email). */
export async function loginStaff(page, email) {
  await page.goto('/admin/login')
  await page.getByLabel('Work email').fill(email)
  await page.getByLabel(/^Password/).fill(PASSWORD)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page).toHaveURL(/\/admin$/)
}

/** Navigates inside the admin portal through the sidebar (a page load would sign the user out). */
export async function openAdmin(page, label) {
  // Some links carry a live counter ("Reservations 2") once their count loads; accept the label with or without it.
  // (Sidebar labels are plain words and "&", nothing a regular expression would read specially.)
  const name = new RegExp(`^${label}( \\d+)?$`)
  await page.getByRole('navigation').getByRole('link', { name }).click()
}

/**
 * Talks to the backend directly, through the frontend's /api proxy, to set up data or check a result
 * the screen does not show. Returns { get, post, put } bound to that account's token.
 */
export async function apiAs(baseURL, email, password = PASSWORD) {
  const ctx = await request.newContext({ baseURL })
  const login = await ctx.post('/api/auth/login', { data: { email, password } })
  expect(login.ok(), `login ${email}`).toBeTruthy()
  const { token } = await login.json()
  const headers = { Authorization: `Bearer ${token}` }
  const call = (method) => async (url, data) => {
    const res = await ctx[method](url, { headers, data })
    expect(res.ok(), `${method.toUpperCase()} ${url} -> ${res.status()} ${await res.text()}`).toBeTruthy()
    return res.status() === 204 ? null : res.json()
  }
  return { get: call('get'), post: call('post'), put: call('put'), dispose: () => ctx.dispose() }
}
