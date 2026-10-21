const vietnamFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
})

export function isLogin(row) {
  return /^(?:LOGIN|(?:POST|PUT|PATCH|DELETE)\s+Auth\.Login)$/i.test(String(row?.action ?? '').trim())
}

export function toVietnamTime(utc) {
  // Database DateTime values can lose their UTC suffix when serialized.
  const value = typeof utc === 'string' && !/(?:Z|[+-]\d{2}:?\d{2})$/i.test(utc)
    ? `${utc}Z` : utc
  const date = utc == null || utc === '' ? new Date(NaN) : new Date(value)
  if (!Number.isFinite(date.getTime())) return { date: '', dateLabel: '-', time: '-' }
  const parts = Object.fromEntries(vietnamFormatter.formatToParts(date).map(part => [part.type, part.value]))
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    dateLabel: `${parts.day}/${parts.month}/${parts.year}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  }
}

export function inVietnamRange(utc, { from, to } = {}) {
  const { date } = toVietnamTime(utc)
  return !!date && (!from || date >= from) && (!to || date <= to)
}

export function validateRange({ from, to }) {
  const valid = value => /^\d{4}-\d{2}-\d{2}$/.test(value ?? '')
    && value >= '0001-01-02' && value <= '9999-12-29'
    && Number.isFinite(new Date(`${value}T00:00:00Z`).getTime())
    && new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value
  if (!valid(from) || !valid(to)) return 'Choose valid start and end dates.'
  return from > to ? 'The start date must be on or before the end date.' : ''
}

export function widenDateRange(range) {
  const error = validateRange(range)
  if (error) throw new Error(error)
  const shift = (value, days) => {
    const date = new Date(`${value}T00:00:00Z`)
    date.setUTCDate(date.getUTCDate() + days)
    return date.toISOString().slice(0, 10)
  }
  return { from: shift(range.from, -1), to: shift(range.to, 1) }
}

const controllerNouns = {
  AccessCodes: 'access code', Billing: 'billing run', CheckIns: 'check-in', Contracts: 'contract',
  Facilities: 'facility', Floors: 'floor', Handovers: 'handover', Invoices: 'invoice',
  MaintenanceOrders: 'maintenance order', OverdueCases: 'overdue case', Payments: 'payment',
  PricingPolicies: 'pricing policy', Profile: 'profile', Renewals: 'renewal', Reservations: 'reservation',
  Shifts: 'shift', Staff: 'staff account', StaffTasks: 'staff task', StorageUnits: 'storage unit',
  SupportTickets: 'support ticket', TicketQueue: 'ticket', UnitTypes: 'unit type', UnitVisits: 'unit visit',
}

export function formatAction(action) {
  const raw = String(action ?? '').trim()
  const match = /^(POST|PUT|PATCH|DELETE) ([A-Za-z]+)\.([A-Za-z]+)$/.exec(raw)
  if (!match || !controllerNouns[match[2]]) return raw || '-'
  const verb = { POST: 'Created', PUT: 'Updated', PATCH: 'Updated', DELETE: 'Deleted' }[match[1]]
  return `${verb} ${controllerNouns[match[2]]}`
}

export function formatEntity(row) {
  return [row?.entityName, row?.entityId].map(value => String(value ?? '').trim()).filter(Boolean).join(' · ') || '-'
}

export function buildUserOptions(rows) {
  const users = new Map()
  for (const row of rows) {
    if (!isLogin(row) && row.userId != null) users.set(String(row.userId), {
      value: String(row.userId), label: row.userName || row.userEmail || `User ${row.userId}`,
    })
  }
  return [...users.values()].sort((a, b) => a.label.localeCompare(b.label))
}

export function buildActionOptions(rows) {
  return [...new Set(rows.filter(row => !isLogin(row)).map(row => row.action).filter(Boolean))]
    .map(value => ({ value, label: formatAction(value) }))
    .sort((a, b) => a.label.localeCompare(b.label) || a.value.localeCompare(b.value))
}

export function computeStats(rows, sessionExports = 0) {
  const events = rows.filter(row => !isLogin(row))
  return {
    events: events.length,
    staffUpdates: events.filter(row => /^(?:POST|PUT|PATCH) Staff\.(?:Create|Update|ChangeRole|SetRole)$/.test(row.action)).length,
    exports: sessionExports,
  }
}

export function filterRows(rows, { search = '', userId = '', action = '', from, to } = {}) {
  const query = search.trim().toLocaleLowerCase()
  return rows.filter(row => !isLogin(row)
    && inVietnamRange(row.createdAt, { from, to })
    && (!userId || String(row.userId) === String(userId))
    && (!action || row.action === action)
    && (!query || [row.userName, row.userEmail, formatEntity(row), formatAction(row.action), row.action]
      .some(value => String(value ?? '').toLocaleLowerCase().includes(query))))
}

export function buildRoleMap(staff) {
  const labels = {
    SystemAdministrator: 'System Administrator', BusinessOperationsManager: 'Business Ops',
    FacilityManager: 'Facility Manager', FacilityStaff: 'Facility Staff', StorageCustomer: 'Customer',
  }
  return new Map(staff.map(person => [String(person.userId), labels[person.role] || person.role || '-']))
}

export function toCsv(rows, roles = new Map()) {
  const cell = value => {
    const text = String(value ?? '')
    // Spreadsheet apps interpret formula prefixes, even after leading whitespace.
    const safe = /^(?:\s*[=+@-]|[\t\r\n])/.test(text) ? `'${text}` : text
    return `"${safe.replaceAll('"', '""')}"`
  }
  const data = [
    ['Log ID', 'Date', 'Time', 'User', 'Email', 'Role', 'Action', 'Entity', 'Facility', 'Result', 'IP address'],
    ...rows.filter(row => !isLogin(row)).map(row => {
      const time = toVietnamTime(row.createdAt)
      return [row.logId, time.dateLabel, time.time, row.userName || '-', row.userEmail || '-',
        roles.get(String(row.userId)) || '-', formatAction(row.action), formatEntity(row), '-',
        row.result === 'Failure' ? 'Failed' : row.result === 'Success' ? 'Success' : '-', row.ipAddress || '-']
    }),
  ]
  return `\uFEFF${data.map(row => row.map(cell).join(',')).join('\r\n')}`
}
