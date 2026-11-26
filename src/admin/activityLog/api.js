import { apiRequest } from '../auth.js'
import { isLogin, widenDateRange } from './logic.js'

const PAGE_SIZE = 100
// shortcut: the cap limits local processing; use server-side filtering for complete histories.
const MAX_LOG_PAGES = 50

async function fetchPages(path, params, maxPages = Infinity, signal) {
  const readPage = async page => {
    const query = new URLSearchParams({ ...params, page: String(page), pageSize: String(PAGE_SIZE) })
    const result = await apiRequest(`${path}?${query}`, { method: 'GET', signal })
    if (!Array.isArray(result?.items) || !Number.isInteger(result.totalCount) || result.totalCount < 0) {
      throw new Error('The server returned an invalid list. Please retry.')
    }
    return result
  }
  const first = await readPage(1)
  const rows = [...first.items]
  const totalPages = Math.ceil(first.totalCount / PAGE_SIZE)
  const lastPage = Math.min(totalPages, maxPages)
  for (let page = 2; page <= lastPage; page += 4) {
    const batch = await Promise.all(Array.from({ length: Math.min(4, lastPage - page + 1) }, (_, index) => readPage(page + index)))
    rows.push(...batch.flatMap(result => result.items))
  }
  return { rows, truncated: totalPages > maxPages }
}

export async function fetchAllLogs({ from, to, signal }) {
  const result = await fetchPages('/api/activity-logs', widenDateRange({ from, to }), MAX_LOG_PAGES, signal)
  // Offset pages can overlap when another event arrives during loading.
  const unique = new Map(result.rows.slice(0, 5000).map(row => [String(row.logId), row]))
  return { rows: [...unique.values()].filter(row => !isLogin(row)), truncated: result.truncated }
}

export async function fetchStaff({ signal } = {}) {
  return (await fetchPages('/api/staff', {}, Infinity, signal)).rows
}

export async function fetchFacilities({ signal } = {}) {
  return (await fetchPages('/api/facilities', { includeInactive: 'true' }, Infinity, signal)).rows
}
