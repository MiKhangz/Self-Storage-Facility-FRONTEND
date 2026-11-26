import { apiRequest } from '../auth.js'
import { canExtendVisit, expectedCheckoutAt } from './logic.js'

// Missing backend routes are in-memory previews; they reset when the page reloads.
export const USE_MOCK_ACTIVE_STORAGE = true

const authorizedByContract = new Map()
const grants = new Map()
const visitMeta = new Map()
let nextGrantId = 1

const missing = name => { throw new Error(`TODO backend: ${name} endpoint is not implemented.`) }
const pageAll = async (path, query = {}) => {
  const items = []
  let page = 1
  let totalCount = Infinity
  while (items.length < totalCount) {
    const params = new URLSearchParams({ ...query, page: String(page), pageSize: '100' })
    const result = await apiRequest(`${path}?${params}`)
    items.push(...(result.items ?? []))
    totalCount = result.totalCount ?? items.length
    if (!(result.items ?? []).length) break
    page++
  }
  return items
}

// GET /api/reservations?status=HandedOver — authenticated; facility staff/manager are facility-scoped.
export async function listActiveRentals({ facilityId = '', search = '', page = 1, pageSize = 20 } = {}) {
  const query = new URLSearchParams({ status: 'HandedOver', page: String(page), pageSize: String(pageSize) })
  if (facilityId) query.set('facilityId', facilityId)
  if (search.trim()) query.set('search', search.trim())
  return apiRequest(`/api/reservations?${query}`)
}

// GET contract, access code, handover evidence, identity checklist and invoices for the selected rental.
export async function getRentalData(rental) {
  const [contractResult, checklistResult, handoversResult, accessCodeResult] = await Promise.allSettled([
    rental.contractId ? apiRequest(`/api/contracts/${rental.contractId}`) : Promise.reject(new Error('No contract is linked to this rental.')),
    apiRequest(`/api/reservations/${rental.reservationId}/handover`),
    apiRequest('/api/handovers?status=Completed&page=1&pageSize=100'),
    rental.contractId ? apiRequest(`/api/contracts/${rental.contractId}/access-code`) : Promise.reject(new Error('No contract')),
  ])
  if (contractResult.status === 'rejected') throw contractResult.reason
  if (checklistResult.status === 'rejected') throw checklistResult.reason
  const invoices = await pageAll('/api/invoices')
  return {
    contract: contractResult.value,
    checklist: checklistResult.value,
    handover: handoversResult.status === 'fulfilled' ? (handoversResult.value.items ?? []).find(row => row.reservationId === rental.reservationId) ?? null : null,
    accessCode: accessCodeResult.status === 'fulfilled' ? accessCodeResult.value : null,
    invoices: invoices.filter(invoice => invoice.contractId === rental.contractId),
    optionalError: handoversResult.status === 'rejected' || accessCodeResult.status === 'rejected',
  }
}

// TODO backend: authorized-person GET/PUT endpoints do not exist; mock starts with the primary renter.
export async function listAuthorizedPersons(contractId, primary = {}) {
  if (!USE_MOCK_ACTIVE_STORAGE) return missing('authorized-person list')
  if (!authorizedByContract.has(contractId)) authorizedByContract.set(contractId, [{
    id: `primary-${contractId}`,
    name: primary.name || 'Primary renter',
    idNumber: primary.idNumber || '',
    primary: true,
  }])
  return structuredClone(authorizedByContract.get(contractId))
}

// TODO backend: authorized-person edit endpoint does not exist; this mock is temporary and not rendered as persisted.
export async function saveAuthorizedPersons(contractId, people) {
  if (!USE_MOCK_ACTIVE_STORAGE) return missing('authorized-person edit')
  if (!people.length) throw new Error('Select at least one authorized person.')
  authorizedByContract.set(contractId, structuredClone(people))
  return structuredClone(people)
}

// TODO backend: access-grant endpoint and Granted visit status do not exist; grant is kept in memory.
export async function grantVisitAccess({ contractId, customerName, unitCode, visitorNames, staffName }) {
  if (!USE_MOCK_ACTIVE_STORAGE) return missing('grant access')
  if (!visitorNames.length) throw new Error('Choose at least one authorized visitor.')
  const grant = {
    id: `grant-${nextGrantId++}`, contractId, customerName, unitCode,
    visitorName: visitorNames.join(', '), staffName, status: 'Granted',
    grantedAt: new Date().toISOString(), durationMinutes: 15,
  }
  grants.set(grant.id, grant)
  return structuredClone(grant)
}

// POST /api/check-ins/check-in — Facility Staff/Manager; body ContractId > 0, Note <= 200 characters.
export async function checkInVisit({ grantId, contractId, visitorName, durationMinutes }) {
  if (!(Number(contractId) > 0) || ![15, 30, 60, 120].includes(Number(durationMinutes))) throw new Error('Choose a valid contract and visit duration.')
  const result = await apiRequest('/api/check-ins/check-in', {
    method: 'POST', body: JSON.stringify({ contractId, note: `${visitorName} · ${durationMinutes} minutes`.slice(0, 200) }),
  })
  visitMeta.set(result.checkInId, { visitorName, durationMinutes, expectedCheckOutAt: expectedCheckoutAt(result.checkInAt, durationMinutes) })
  const grant = grants.get(grantId)
  if (grant) Object.assign(grant, { status: 'On-site', checkInId: result.checkInId })
  return presentVisit(result)
}

// POST /api/check-ins/{id}/check-out — Facility Staff/Manager.
export async function checkOutVisit(visit, overtime = 0) {
  if (!visit.checkInId) return missing('visit check-out')
  const result = await apiRequest(`/api/check-ins/${visit.checkInId}/check-out`, { method: 'POST' })
  const meta = visitMeta.get(result.checkInId) ?? { visitorName: visit.visitorName, durationMinutes: visit.durationMinutes, expectedCheckOutAt: visit.expectedCheckOutAt }
  meta.overtimeMinutes = overtime
  visitMeta.set(result.checkInId, meta)
  const grant = [...grants.values()].find(row => row.checkInId === result.checkInId)
  if (grant) grant.status = 'Completed'
  return presentVisit(result)
}

// GET /api/check-ins?contractId=... — authenticated; staff sees visits within assigned facilities.
export async function listVisitHistory(contractId) {
  const query = contractId ? { contractId: String(contractId) } : {}
  return (await pageAll('/api/check-ins', query)).map(presentVisit)
}

export async function listVisitActivity() {
  const visits = await listVisitHistory()
  const granted = [...grants.values()].filter(row => row.status === 'Granted')
  return [...granted, ...visits]
}

// TODO backend: visit duration/extension fields and extension endpoint do not exist; preview is held in memory.
export async function extendVisit(visit, minutes) {
  if (!USE_MOCK_ACTIVE_STORAGE) return missing('visit extension')
  const meta = visitMeta.get(visit.checkInId) ?? {
    visitorName: visit.visitorName ?? visit.customerName,
    durationMinutes: visit.durationMinutes ?? 15,
    expectedCheckOutAt: visit.expectedCheckOutAt ?? expectedCheckoutAt(visit.checkInAt, visit.durationMinutes ?? 15),
  }
  if (!canExtendVisit({ expectedCheckOutAt: meta.expectedCheckOutAt, durationMinutes: meta.durationMinutes, extendByMinutes: minutes })) throw new Error('Extension is unavailable after overtime or beyond the four-hour visit limit.')
  meta.durationMinutes += minutes
  meta.expectedCheckOutAt = expectedCheckoutAt(visit.checkInAt, meta.durationMinutes)
  visitMeta.set(visit.checkInId, meta)
  return { ...visit, ...meta }
}

// GET /api/access-logs?storageUnitId=... — Facility Manager only; operational UI uses visit history instead.
export async function listAccessLogs({ storageUnitId, customerId, page = 1, pageSize = 100 } = {}) {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
  if (storageUnitId) query.set('storageUnitId', storageUnitId)
  if (customerId) query.set('customerId', customerId)
  return apiRequest(`/api/access-logs?${query}`)
}

function presentVisit(visit) {
  const meta = visitMeta.get(visit.checkInId) ?? {}
  const durationMinutes = meta.durationMinutes ?? 15
  return {
    ...visit,
    id: String(visit.checkInId),
    status: visit.checkOutAt ? 'Completed' : 'On-site',
    visitorName: meta.visitorName ?? visit.customerName,
    staffName: visit.recordedByName,
    durationMinutes,
    durationEstimated: !meta.durationMinutes,
    overtimeMinutes: meta.overtimeMinutes ?? 0,
    expectedCheckOutAt: meta.expectedCheckOutAt ?? expectedCheckoutAt(visit.checkInAt, durationMinutes),
  }
}
