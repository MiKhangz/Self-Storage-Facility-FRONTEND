import axios, { AxiosError } from 'axios'

/** The single HTTP client. Every request goes through here so the bearer token and error shape stay consistent. */
export const api = axios.create({
  // Empty in development: requests go to /api on the Vite server, which proxies them to the backend.
  baseURL: import.meta.env.VITE_API_BASE_URL ?? '',
  headers: { 'Content-Type': 'application/json' },
})

// The token lives only in memory (React state in AuthProvider), never in localStorage. The provider hands it
// over here so requests made outside components still carry it.
let accessToken: string | null = null
let onUnauthorized: (() => void) | null = null

export function setAccessToken(token: string | null) {
  accessToken = token
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    // A failed login is also a 401, but there is no session to end yet.
    if (error.response?.status === 401 && accessToken) onUnauthorized?.()
    return Promise.reject(error)
  },
)

type ProblemDetails = { title?: string; errors?: Record<string, string[]> }

/** The message to show the user: the API's ProblemDetails title, or every field error for a 400. */
export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ProblemDetails>(error)) {
    if (!error.response) return 'Không kết nối được máy chủ. Vui lòng thử lại.'
    const problem = error.response.data
    const fieldErrors = problem?.errors ? Object.values(problem.errors).flat() : []
    if (fieldErrors.length) return fieldErrors.join(' ')
    if (problem?.title) return problem.title
  }
  return 'Đã có lỗi xảy ra. Vui lòng thử lại.'
}
