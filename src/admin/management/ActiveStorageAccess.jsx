import { useCallback, useEffect, useMemo, useState } from 'react'
import { Roles } from '../../features/auth/roles'
import { accessEligibility, canExtendVisit, expectedCheckoutAt, extensionOptions, overtimeMinutes } from '../activeStorages/logic.js'
import { checkInVisit, checkOutVisit, extendVisit, getRentalData, grantVisitAccess, listActiveRentals, listAuthorizedPersons, listVisitActivity, listVisitHistory, saveAuthorizedPersons, USE_MOCK_ACTIVE_STORAGE } from '../activeStorages/api.js'
import './ActiveStorageAccess.css'

const tabs = ['Active rentals', 'Check-in', 'On-site']
const valueOrNA = value => value == null || value === '' ? 'N/A' : value
const dateLabel = value => value ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'N/A'
const timeLabel = value => value ? new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(value)) : 'N/A'
const dateTimeLabel = value => value ? `${dateLabel(value)} ${timeLabel(value)}` : 'N/A'
const maskedId = value => value ? `${String(value).slice(0, 3)}${'•'.repeat(Math.max(3, String(value).length - 5))}${String(value).slice(-2)}` : 'N/A'
const todayInVietnam = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date())

export default function ActiveStorageAccess({ user, facilityId = '' }) {
  const canVisit = [Roles.FacilityStaff, Roles.FacilityManager].includes(user?.role)
  const [tab, setTab] = useState(tabs[0])
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [rentals, setRentals] = useState({ items: [], totalCount: 0 })
  const [rentalLoading, setRentalLoading] = useState(true)
  const [rentalError, setRentalError] = useState('')
  const [selectedRental, setSelectedRental] = useState(null)
  const [rentalDetail, setRentalDetail] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [detailError, setDetailError] = useState('')
  const [people, setPeople] = useState([])
  const [selectedPeople, setSelectedPeople] = useState([])
  const [visits, setVisits] = useState([])
  const [visitLoading, setVisitLoading] = useState(true)
  const [visitError, setVisitError] = useState('')
  const [selectedVisitId, setSelectedVisitId] = useState('')
  const [duration, setDuration] = useState(15)
  const [actionBusy, setActionBusy] = useState(false)
  const [actionError, setActionError] = useState('')
  const [notice, setNotice] = useState('')
  const [now, setNow] = useState(Date.now())
  const [dialog, setDialog] = useState('')
  const [editPeople, setEditPeople] = useState([])
  const [logRows, setLogRows] = useState([])
  const [logLoading, setLogLoading] = useState(false)
  const [logError, setLogError] = useState('')

  const loadRentals = useCallback(async () => {
    setRentalLoading(true); setRentalError('')
    try { setRentals(await listActiveRentals({ facilityId, search, page })) }
    catch (error) { setRentalError(error.message) }
    finally { setRentalLoading(false) }
  }, [facilityId, search, page])

  const loadVisits = useCallback(async () => {
    setVisitLoading(true); setVisitError('')
    try { setVisits(await listVisitActivity()) }
    catch (error) { setVisitError(error.message) }
    finally { setVisitLoading(false) }
  }, [])

  useEffect(() => { loadRentals() }, [loadRentals])
  useEffect(() => { if (!rentalLoading) loadVisits() }, [loadVisits, rentalLoading])
  useEffect(() => { const timer = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(timer) }, [])
  useEffect(() => { setSelectedRental(null); setRentalDetail(null); setPage(1) }, [facilityId])

  async function openRental(rental) {
    setSelectedRental(rental); setRentalDetail(null); setPeople([]); setSelectedPeople([]); setDetailLoading(true); setDetailError(''); setActionError('')
    try {
      const data = await getRentalData(rental)
      const identity = data.checklist.citizenId
      const authorizedPersons = await listAuthorizedPersons(data.contract.contractId, { name: data.contract.customerName, idNumber: identity })
      setRentalDetail(data); setPeople(authorizedPersons); setSelectedPeople(authorizedPersons.filter(person => person.primary).map(person => person.id))
    } catch (error) { setDetailError(error.message) }
    finally { setDetailLoading(false) }
  }

  const rentalByContract = useMemo(() => new Map(rentals.items.map(rental => [Number(rental.contractId), rental])), [rentals.items])
  const selectedVisit = visits.find(visit => String(visit.id) === String(selectedVisitId))
  const selectedVisitRental = selectedVisit ? rentalByContract.get(Number(selectedVisit.contractId)) : null
  const grantedVisits = visits.filter(visit => visit.status === 'Granted')
  const onSiteVisits = visits.filter(visit => visit.status === 'On-site')
  const eligibility = useMemo(() => {
    if (!rentalDetail || !selectedRental) return { eligible: false, reasons: [] }
    const identityVerified = rentalDetail.checklist.items.find(item => item.key === 'identity')?.done === true
    const dueInvoices = rentalDetail.invoices.filter(invoice => invoice.dueDate <= todayInVietnam())
    const paymentStatus = ['Overdue', 'Suspended'].includes(rentalDetail.contract.status) || !dueInvoices.every(invoice => invoice.status === 'Paid') ? 'Unpaid' : 'Paid'
    return accessEligibility({
      accountNotSuspended: rentalDetail.contract.status !== 'Suspended',
      idVerified: identityVerified,
      storageStatus: selectedRental.status === 'CheckedIn' ? 'Active' : selectedRental.status,
      paymentStatus,
    })
  }, [rentalDetail, selectedRental])

  async function grantAccess() {
    if (!selectedRental || !rentalDetail || !canVisit || !eligibility.eligible || !selectedPeople.length) return
    if (visits.some(visit => visit.contractId === rentalDetail.contract.contractId && visit.status === 'On-site')) {
      setActionError('This rental already has a visit on-site. Check it out before granting another visit.')
      return
    }
    setActionBusy(true); setActionError(''); setNotice('')
    try {
      const visitorNames = people.filter(person => selectedPeople.includes(person.id)).map(person => person.name)
      const visit = await grantVisitAccess({ contractId: rentalDetail.contract.contractId, customerName: selectedRental.customerName, unitCode: selectedRental.unitCode, visitorNames, staffName: user?.fullName || user?.name || 'Staff' })
      setNotice('Access granted for check-in. The visit is waiting in the Check-in tab.')
      setSelectedVisitId(visit.id); setTab('Check-in'); await loadVisits()
    } catch (error) { setActionError(error.message) }
    finally { setActionBusy(false) }
  }

  async function doCheckIn() {
    if (!selectedVisit || selectedVisit.status !== 'Granted' || !duration || !canVisit) return
    setActionBusy(true); setActionError(''); setNotice('')
    try {
      const checkedIn = await checkInVisit({ grantId: selectedVisit.id, contractId: selectedVisit.contractId, visitorName: selectedVisit.visitorName, durationMinutes: Number(duration) })
      await loadVisits(); setSelectedVisitId(checkedIn.id); setTab('On-site'); setNotice(`${selectedVisit.visitorName} checked in.`)
    } catch (error) { setActionError(error.message) }
    finally { setActionBusy(false) }
  }

  async function saveExtension(minutes) {
    if (!selectedVisit || !canExtendVisit({ expectedCheckOutAt: selectedVisit.expectedCheckOutAt, durationMinutes: selectedVisit.durationMinutes, extendByMinutes: minutes, now })) return
    setActionBusy(true); setActionError('')
    try {
      const updated = await extendVisit(selectedVisit, minutes)
      setVisits(current => current.map(visit => visit.id === updated.id ? updated : visit))
      setDialog(''); setNotice(`Visit extended by ${minutes} minutes.`)
    } catch (error) { setActionError(error.message) }
    finally { setActionBusy(false) }
  }

  async function confirmCheckOut() {
    if (!selectedVisit || selectedVisit.status !== 'On-site' || !canVisit) return
    setActionBusy(true); setActionError('')
    const overtime = overtimeMinutes(selectedVisit.expectedCheckOutAt, now)
    try {
      await checkOutVisit(selectedVisit, overtime)
      setDialog(''); setNotice(overtime ? `Visit checked out. ${overtime} overtime minute(s) recorded in this session.` : 'Visit checked out.')
      setSelectedVisitId(''); await loadVisits()
    } catch (error) { setActionError(error.message) }
    finally { setActionBusy(false) }
  }

  async function openLog() {
    if (!rentalDetail) return
    setDialog('log'); setLogLoading(true); setLogError(''); setLogRows([])
    try { setLogRows(await listVisitHistory(rentalDetail.contract.contractId)) }
    catch (error) { setLogError(error.message) }
    finally { setLogLoading(false) }
  }

  function openEdits() { setEditPeople(people.map(person => ({ ...person }))); setDialog('edits') }
  async function saveEdits() {
    setActionError('')
    if (editPeople.some(person => !person.name.trim() || !person.idNumber.trim())) { setActionError('Enter a name and ID number for every authorized person.'); return }
    setActionBusy(true)
    try { setPeople(await saveAuthorizedPersons(rentalDetail.contract.contractId, editPeople)); setDialog(''); setNotice('Authorized persons updated in the temporary preview.') }
    catch (error) { setActionError(error.message) }
    finally { setActionBusy(false) }
  }

  function retrySelectedRental() { if (selectedRental) openRental(selectedRental) }
  function togglePerson(id) { setSelectedPeople(current => current.includes(id) ? current.filter(value => value !== id) : [...current, id]) }
  function visitOvertime(visit) { return overtimeMinutes(visit.expectedCheckOutAt, now) }

  return <section className="asa-page">
    <header className="asa-header"><div><h1>Active Storage &amp; Access</h1><p>Manage active rentals, customer visits, and unit access.</p></div><button type="button" onClick={() => { loadRentals(); loadVisits() }}>Refresh</button></header>
    {notice && <p className="asa-notice" role="status">{notice}</p>}
    <nav className="asa-tabs" aria-label="Storage and access sections">{tabs.map(name => <button key={name} type="button" className={tab === name ? 'selected' : ''} aria-pressed={tab === name} onClick={() => { setTab(name); setSelectedVisitId(''); setActionError('') }}><span>{name}</span><small>{name === 'Active rentals' ? rentals.totalCount : name === 'Check-in' ? grantedVisits.length : onSiteVisits.length}</small></button>)}</nav>

    {tab === 'Active rentals' ? <>
      <div className="asa-filter"><input aria-label="Search active rentals" placeholder="Search customer, unit, facility or reservation…" value={search} onChange={event => { setSearch(event.target.value); setPage(1) }} /></div>
      {rentalError && <p className="asa-error" role="alert">{rentalError} <button type="button" onClick={loadRentals}>Retry</button></p>}
      <div className={`asa-layout ${selectedRental ? 'has-detail' : ''}`}>
        <div className="asa-rental-list" aria-label="Active rentals">
          {rentalLoading ? <p className="asa-empty" role="status">Loading active rentals…</p> : rentals.items.map(rental => <button type="button" key={rental.reservationId} className={`asa-rental ${selectedRental?.reservationId === rental.reservationId ? 'selected' : ''}`} onClick={() => openRental(rental)}><strong>{rental.customerName}</strong><span>{valueOrNA(rental.unitCode)} · {valueOrNA(rental.unitTypeName)}</span><small>{rental.facilityName}</small></button>)}
          {!rentalLoading && !rentals.items.length && !rentalError && <p className="asa-empty">No active rentals found.</p>}
          <footer className="asa-pager"><span>{rentals.totalCount} active rentals</span><div><button type="button" disabled={page <= 1 || rentalLoading} onClick={() => setPage(value => value - 1)}>Previous</button><span>{page} / {Math.max(1, Math.ceil(rentals.totalCount / 20))}</span><button type="button" disabled={page >= Math.max(1, Math.ceil(rentals.totalCount / 20)) || rentalLoading} onClick={() => setPage(value => value + 1)}>Next</button></div></footer>
        </div>
        {selectedRental && <article className="asa-detail">
          <button type="button" className="asa-close" aria-label="Close rental details" onClick={() => { setSelectedRental(null); setRentalDetail(null) }}>×</button>
          {detailLoading ? <p className="asa-empty" role="status">Loading rental details…</p> : detailError ? <p className="asa-error" role="alert">{detailError} <button type="button" onClick={retrySelectedRental}>Retry</button></p> : rentalDetail && <>
            <header><div className="asa-avatar">{(selectedRental.customerName || '?').trim().split(/\s+/).slice(-2).map(word => word[0]).join('').toUpperCase()}</div><div><strong>{selectedRental.customerName} → Unit {valueOrNA(selectedRental.unitCode)}</strong><small>{selectedRental.reservationCode} · {rentalDetail.contract.contractNumber} · {dateLabel(rentalDetail.contract.startDate)} – {dateLabel(rentalDetail.contract.endDate)} · {selectedRental.facilityName}</small></div></header>
            <section><h2>Information</h2><dl>
              <div><dt>Account status</dt><dd>{rentalDetail.contract.status === 'Suspended' ? 'Suspended' : 'Not suspended'}</dd></div>
              <div><dt>Identification verified</dt><dd>{rentalDetail.checklist.items.find(item => item.key === 'identity')?.done ? 'Verified' : 'Not verified'}</dd></div>
              <div><dt>Storage status</dt><dd>{selectedRental.status === 'CheckedIn' ? 'Active' : selectedRental.status}</dd></div>
              <div><dt>Payment status</dt><dd>{eligibility.reasons.includes('Due payments are not fully paid.') ? 'Unpaid' : 'Paid'}</dd></div>
              <div><dt>Last check-in</dt><dd>{dateTimeLabel(rentalDetail.checkIn?.checkInTime)}</dd></div>
              <div><dt>Monthly rent</dt><dd>{rentalDetail.contract.monthlyRent == null ? 'N/A' : `${new Intl.NumberFormat('vi-VN').format(rentalDetail.contract.monthlyRent)} ₫`}</dd></div>
            </dl>{rentalDetail.optionalError && <p className="asa-inline-error" role="alert">Some access details could not load. <button type="button" onClick={retrySelectedRental}>Retry</button></p>}</section>
            <section><h2>Access</h2><dl>
              <div><dt>Access card</dt><dd>{valueOrNA(rentalDetail.checkIn?.cardNumber)}</dd></div>
              <div><dt>PIN</dt><dd>N/A</dd></div>
              <div><dt>Lock</dt><dd>{valueOrNA(rentalDetail.checkIn?.lockSerial)}</dd></div>
              <div><dt>Access code</dt><dd>{rentalDetail.accessCode?.isActive && new Date(rentalDetail.accessCode.expiresAt) > new Date(now) ? 'Active' : 'Disabled / N/A'}</dd></div>
              <div><dt>Code expiry</dt><dd>{dateLabel(rentalDetail.accessCode?.expiresAt)}</dd></div>
            </dl></section>
            <section><div className="asa-section-head"><h2>Authorized persons</h2></div>
              <div className="asa-people">{people.map(person => <label key={person.id}><input type="checkbox" checked={selectedPeople.includes(person.id)} onChange={() => togglePerson(person.id)} /><span><strong>{person.name}</strong><small>{maskedId(person.idNumber)}{person.primary ? ' · Primary renter' : ''}</small></span></label>)}</div>
              {!people.length && <p className="asa-empty">No authorized persons are listed.</p>}
              {USE_MOCK_ACTIVE_STORAGE && <small className="asa-preview-note">Authorized-person records are a temporary frontend preview and reset on reload.</small>}
            </section>
            <section className="asa-access-log-link"><button type="button" onClick={openLog}>Check access log</button></section>
            <footer className="asa-detail-footer"><div className="asa-footer-actions"><button type="button" title="Preview only: the backend has no authorized-person edit endpoint." onClick={openEdits}>Edits</button><button type="button" className="asa-grant" disabled={!canVisit || !eligibility.eligible || !selectedPeople.length || actionBusy} onClick={grantAccess}>{actionBusy ? 'Granting…' : 'Grant access for check-in'}</button></div>
              {!selectedPeople.length && <small>Select at least one authorized visitor.</small>}
              {!canVisit && <small>Only Facility Staff and Facility Managers can grant access.</small>}
              {eligibility.reasons.map(reason => <small key={reason}>{reason}</small>)}
              {actionError && <p className="asa-inline-error" role="alert">{actionError}</p>}
            </footer>
          </>}
        </article>}
      </div>
    </> : <>
      {visitError && <p className="asa-error" role="alert">{visitError} <button type="button" onClick={loadVisits}>Retry</button></p>}
      <div className={`asa-layout ${selectedVisit ? 'has-detail' : ''}`}>
        <div className="asa-rental-list" aria-label={tab === 'Check-in' ? 'Granted visits waiting for check-in' : 'On-site visits'}>
          {visitLoading ? <p className="asa-empty" role="status">Loading {tab.toLowerCase()} visits…</p> : (tab === 'Check-in' ? grantedVisits : onSiteVisits).map(visit => {
            const late = visit.status === 'On-site' ? visitOvertime(visit) : 0
            return <button type="button" key={visit.id} className={`asa-rental ${String(selectedVisitId) === String(visit.id) ? 'selected' : ''}`} onClick={() => setSelectedVisitId(visit.id)}><strong>{visit.visitorName || visit.customerName}</strong><span>{valueOrNA(visit.unitCode)} · {valueOrNA(rentalByContract.get(Number(visit.contractId))?.unitTypeName)}</span><small>{visit.status === 'Granted' ? 'Waiting for check-in' : `${timeLabel(visit.checkInAt)} · ${visit.staffName || 'Staff N/A'}`}</small>{late > 0 && <b className="asa-overtime-pill">Over time · {late} min</b>}</button>
          })}
          {!visitLoading && !(tab === 'Check-in' ? grantedVisits : onSiteVisits).length && !visitError && <p className="asa-empty">{tab === 'Check-in' ? 'No visits are waiting for check-in.' : 'No customers are currently on-site.'}</p>}
        </div>
        {selectedVisit && <article className="asa-detail asa-visit-detail">
          <button type="button" className="asa-close" aria-label="Close visit details" onClick={() => setSelectedVisitId('')}>×</button>
          <header><div className={`asa-avatar ${visitOvertime(selectedVisit) ? 'late' : ''}`}>{visitOvertime(selectedVisit) ? '!' : (selectedVisit.visitorName || selectedVisit.customerName || '?').trim().split(/\s+/).slice(-2).map(word => word[0]).join('').toUpperCase()}</div><div><strong>{selectedVisit.visitorName || selectedVisit.customerName} → Unit {valueOrNA(selectedVisit.unitCode)}</strong><small>{selectedVisitRental?.reservationCode || selectedVisit.contractNumber} · {selectedVisitRental?.facilityName || ''}</small>{selectedVisit.status === 'On-site' && visitOvertime(selectedVisit) > 0 && <b className="asa-overtime-title">⚠ Over time by {visitOvertime(selectedVisit)} minutes</b>}</div></header>
          {tab === 'Check-in' && selectedVisit.status === 'Granted' ? <section><h2>Check-in</h2><dl><div><dt>Visitor</dt><dd>{selectedVisit.visitorName}</dd></div><div><dt>Unit</dt><dd>{selectedVisit.unitCode}</dd></div><div><dt>Check-in at</dt><dd>{dateTimeLabel(new Date(now).toISOString())}</dd></div><div><dt>Staff</dt><dd>{selectedVisit.staffName || user?.fullName || user?.name || 'Staff'}</dd></div></dl><label className="asa-duration">Set duration<select value={duration} onChange={event => setDuration(Number(event.target.value))}>{[15, 30, 60, 120].map(minutes => <option key={minutes} value={minutes}>{minutes} minutes</option>)}</select></label><p className="asa-preview-note">Expected check-out: {dateTimeLabel(expectedCheckoutAt(new Date(now).toISOString(), duration))}</p><button type="button" className="asa-grant" disabled={!canVisit || !duration || actionBusy} onClick={doCheckIn}>{actionBusy ? 'Checking in…' : 'Check in'}</button>{actionError && <p className="asa-inline-error" role="alert">{actionError}</p>}</section> : <section><h2>On-site visit</h2><dl><div><dt>Check-in at</dt><dd>{dateTimeLabel(selectedVisit.checkInAt)}</dd></div><div><dt>Check-in by</dt><dd>{selectedVisit.staffName || 'N/A'}</dd></div><div><dt>Allowed duration</dt><dd>{selectedVisit.durationMinutes} minutes{selectedVisit.durationEstimated ? ' (estimated)' : ''}</dd></div><div><dt>Expected check-out</dt><dd>{dateTimeLabel(selectedVisit.expectedCheckOutAt)}</dd></div>{visitOvertime(selectedVisit) > 0 && <div className="asa-overdue-row"><dt>Overtime</dt><dd>{visitOvertime(selectedVisit)} minutes</dd></div>}</dl>{selectedVisit.durationEstimated && <p className="asa-preview-note">The backend does not store visit duration; this older visit is shown with the 15-minute default.</p>}<div className="asa-visit-actions"><button type="button" disabled={!canVisit || actionBusy || visitOvertime(selectedVisit) > 0 || !extensionOptions(selectedVisit, now).length} onClick={() => { setDialog('extend'); setActionError('') }}>Extend time</button><button type="button" className="asa-checkout" disabled={!canVisit || actionBusy} onClick={() => { setDialog('checkout'); setActionError('') }}>Check out</button></div>{actionError && <p className="asa-inline-error" role="alert">{actionError}</p>}</section>}
        </article>}
      </div>
    </>}

    {dialog === 'log' && <div className="asa-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDialog('') }}><aside className="asa-drawer" role="dialog" aria-modal="true" aria-labelledby="asa-log-title"><header><div><h2 id="asa-log-title">Visit access log</h2><p>{selectedRental?.customerName} · {selectedRental?.unitCode}</p></div><button type="button" aria-label="Close access log" onClick={() => setDialog('')}>×</button></header>{logLoading ? <p className="asa-empty" role="status">Loading visit history…</p> : logError ? <p className="asa-error" role="alert">{logError} <button type="button" onClick={openLog}>Retry</button></p> : logRows.length ? <><p className="asa-preview-note">Visit durations and overtime are not stored by the backend. Historical rows use the 15-minute default estimate.</p><div className="asa-log-list">{logRows.map(visit => { const late = visit.overtimeMinutes || (visit.checkOutAt ? overtimeMinutes(visit.expectedCheckOutAt, new Date(visit.checkOutAt).getTime()) : 0); return <article key={visit.id}><strong>{visit.visitorName}</strong><small>In {dateTimeLabel(visit.checkInAt)} · Out {dateTimeLabel(visit.checkOutAt)}</small><small>Staff {valueOrNA(visit.staffName)} · {visit.durationMinutes}{visit.durationEstimated ? ' estimated' : ''} minutes{late ? ` · ${late} overtime minutes` : ''}</small></article> })}</div></> : <p className="asa-empty">No past visits found.</p>}</aside></div>}

    {dialog === 'edits' && <div className="asa-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDialog('') }}><section className="asa-dialog" role="dialog" aria-modal="true" aria-labelledby="asa-edit-title"><h2 id="asa-edit-title">Edit authorized persons</h2><p className="asa-preview-note">Preview only. The backend has no authorized-person endpoint; these changes reset when the page reloads.</p>{editPeople.map((person, index) => <div className="asa-edit-person" key={person.id}><label>Name<input required value={person.name} onChange={event => setEditPeople(current => current.map((item, i) => i === index ? { ...item, name: event.target.value } : item))} /></label><label>ID number<input required value={person.idNumber} onChange={event => setEditPeople(current => current.map((item, i) => i === index ? { ...item, idNumber: event.target.value } : item))} /></label><button type="button" aria-label={`Remove ${person.name || 'person'}`} onClick={() => setEditPeople(current => current.filter((_, i) => i !== index))}>Remove</button></div>)}<button type="button" onClick={() => setEditPeople(current => [...current, { id: `person-${Date.now()}`, name: '', idNumber: '', primary: false }])}>Add person</button>{actionError && <p className="asa-inline-error" role="alert">{actionError}</p>}<footer><button type="button" onClick={() => setDialog('')}>Cancel</button><button type="button" className="asa-grant" disabled={actionBusy || !editPeople.length} onClick={saveEdits}>{actionBusy ? 'Saving…' : 'Save preview'}</button></footer></section></div>}

    {dialog === 'extend' && selectedVisit && <div className="asa-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDialog('') }}><section className="asa-dialog" role="dialog" aria-modal="true" aria-labelledby="asa-extend-title"><h2 id="asa-extend-title">Extend visit time</h2><p>Current duration: {selectedVisit.durationMinutes} minutes. Maximum total: 240 minutes.</p><div className="asa-dialog-actions">{extensionOptions(selectedVisit, now).map(minutes => <button type="button" key={minutes} disabled={actionBusy} onClick={() => saveExtension(minutes)}>+{minutes} minutes</button>)}</div>{!extensionOptions(selectedVisit, now).length && <p className="asa-inline-error">Extension is unavailable after overtime or at the four-hour limit.</p>}{actionError && <p className="asa-inline-error" role="alert">{actionError}</p>}<footer><button type="button" onClick={() => setDialog('')}>Cancel</button></footer></section></div>}

    {dialog === 'checkout' && selectedVisit && <div className="asa-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDialog('') }}><section className="asa-dialog" role="dialog" aria-modal="true" aria-labelledby="asa-checkout-title"><h2 id="asa-checkout-title">Check out customer?</h2><p>{selectedVisit.visitorName} · Unit {selectedVisit.unitCode}</p><p>Overtime: <strong>{visitOvertime(selectedVisit)} minutes</strong></p>{visitOvertime(selectedVisit) > 0 && <p className="asa-inline-error">The visit is overdue. Overtime minutes are recorded in this browser session; the backend has no overtime field.</p>}{actionError && <p className="asa-inline-error" role="alert">{actionError}</p>}<footer><button type="button" onClick={() => setDialog('')}>Cancel</button><button type="button" className="asa-checkout" disabled={actionBusy} onClick={confirmCheckOut}>{actionBusy ? 'Checking out…' : 'Confirm check out'}</button></footer></section></div>}
  </section>
}
