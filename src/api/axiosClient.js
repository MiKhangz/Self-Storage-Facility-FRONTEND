import axios from 'axios'

/** The single HTTP client. Every request goes through here so the bearer token and error shape stay consistent. */
export const api = axios.create({
  // Empty in development: requests go to /api on the Vite server, which proxies them to the backend.
  // Set VITE_API_URL (e.g. https://api.example.com) only for a build that calls the API on another origin.
  baseURL: import.meta.env.VITE_API_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
})

// The token lives only in memory (React state in AuthProvider), never in localStorage. The provider hands it
// over here so requests made outside components still carry it.
/** @type {string|null} */
let accessToken = null
/** @type {(() => void)|null} */
let onUnauthorized = null

/** @param {string|null} token */
export function setAccessToken(token) {
  accessToken = token
}

/** @param {(() => void)|null} handler */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // A failed login is also a 401, but there is no session to end yet.
    if (error.response?.status === 401 && accessToken) onUnauthorized?.()
    return Promise.reject(error)
  },
)

/** @typedef {{ title?: string, errors?: Object<string, string[]> }} ProblemDetails RFC 7807 error body */

/**
 * The message to show the user: the API's ProblemDetails title, or every field error for a 400.
 * @param {unknown} error
 * @returns {string}
 */
export function errorMessage(error) {
  if (axios.isAxiosError(error)) {
    if (!error.response) return 'Không kết nối được máy chủ. Vui lòng thử lại.'
    /** @type {ProblemDetails|undefined} */
    const problem = error.response.data
    const fieldErrors = problem?.errors ? Object.values(problem.errors).flat() : []
    if (fieldErrors.length) return fieldErrors.join(' ')
    if (problem?.title) return problem.title
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}
