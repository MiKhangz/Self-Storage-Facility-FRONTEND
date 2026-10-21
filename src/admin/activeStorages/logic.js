export function accessEligibility({ accountNotSuspended, idVerified, storageStatus, paymentStatus }) {
  const reasons = []
  if (accountNotSuspended !== true) reasons.push('Account is suspended or its status is unavailable.')
  if (!idVerified) reasons.push('Customer identification is not verified.')
  if (storageStatus !== 'Active') reasons.push('Storage is not active.')
  if (paymentStatus !== 'Paid') reasons.push('Due payments are not fully paid.')
  return { eligible: reasons.length === 0, reasons }
}

export function expectedCheckoutAt(startAt, durationMinutes) {
  const start = new Date(startAt).getTime()
  return Number.isFinite(start) && Number.isFinite(durationMinutes) && durationMinutes > 0
    ? new Date(start + durationMinutes * 60000).toISOString()
    : null
}

export function overtimeMinutes(expectedAt, now = Date.now()) {
  if (!expectedAt) return 0
  const expected = new Date(expectedAt).getTime()
  return Number.isFinite(expected) && now > expected ? Math.ceil((now - expected) / 60000) : 0
}

export function canExtendVisit({ expectedCheckOutAt, durationMinutes, extendByMinutes, now = Date.now() }) {
  return !!expectedCheckOutAt && overtimeMinutes(expectedCheckOutAt, now) === 0
    && [15, 30, 60].includes(extendByMinutes)
    && durationMinutes + extendByMinutes <= 240
}

export function extensionOptions(visit, now = Date.now()) {
  return [15, 30, 60].filter(extendByMinutes => canExtendVisit({
    expectedCheckOutAt: visit.expectedCheckOutAt,
    durationMinutes: visit.durationMinutes,
    extendByMinutes,
    now,
  }))
}
