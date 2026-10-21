import { useCallback, useEffect, useState } from 'react'
import { apiRequest } from '../auth.js'
import { Roles } from '../../features/auth/roles'
import './HandoverDesk.css'

const tabs = ['Requested', 'Approved', 'Inspected', 'Completed']
const queues = ['Check-in', 'Move-out']
const money = value => `${new Intl.NumberFormat('vi-VN').format(value ?? 0)} ₫`
const date = value => value ? new Date(value).toLocaleDateString() : '—'

export default function HandoverDesk({ user }) {
  const canCheckIn = [Roles.FacilityStaff, Roles.FacilityManager].includes(user?.role)
  const [queue, setQueue] = useState('Check-in')
  const [status, setStatus] = useState('Requested')
  const [rows, setRows] = useState([])
  const [selected, setSelected] = useState(null)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [slot, setSlot] = useState('')
  const [condition, setCondition] = useState('Good')
  const [charges, setCharges] = useState({ cleaningFee: 0, repairCharge: 0, otherDeduction: 0 })
  const [checklist, setChecklist] = useState(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [inspectionChecked, setInspectionChecked] = useState(false)
  const [conditionNote, setConditionNote] = useState('')
  const [lockSerial, setLockSerial] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [photos, setPhotos] = useState([])
  const [checkInBusy, setCheckInBusy] = useState(false)
  const [contractBusy, setContractBusy] = useState(false)
  const [notice, setNotice] = useState('')

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const url = queue === 'Check-in'
        ? '/api/reservations?status=Confirmed&page=1&pageSize=100'
        : `/api/handovers?${new URLSearchParams({ status, page: 1, pageSize: 100 })}`
      const result = await apiRequest(url)
      setRows(result.items ?? [])
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [queue, status])

  useEffect(() => { load() }, [load])
  useEffect(() => {
    let active = true
    if (!selected?.handoverId) return
    apiRequest(`/api/handovers/${selected.handoverId}`).then(value => { if (active) setSelected(value) }).catch(e => { if (active) setError(e.message) })
    return () => { active = false }
  }, [selected?.handoverId])

  useEffect(() => {
    let active = true
    setChecklist(null); setInspectionChecked(false); setConditionNote(''); setLockSerial(''); setCardNumber(''); setPhotos([])
    if (queue !== 'Check-in' || !selected?.reservationId) return
    setChecklistLoading(true)
    apiRequest(`/api/reservations/${selected.reservationId}/check-in`)
      .then(value => { if (active) setChecklist(value) })
      .catch(e => { if (active) setError(e.message) })
      .finally(() => { if (active) setChecklistLoading(false) })
    return () => { active = false }
  }, [queue, selected?.reservationId])

  async function act(action) {
    setBusy(true); setError('')
    try {
      if (action === 'approve') {
        if (!slot) throw new Error('Choose an inspection time.')
        await apiRequest(`/api/handovers/${selected.handoverId}/approve`, { method: 'POST', body: JSON.stringify({ inspectionSlot: new Date(slot).toISOString() }) })
      } else {
        await apiRequest(`/api/handovers/${selected.handoverId}/inspection`, { method: 'POST', body: JSON.stringify({ conditionResult: condition, ...Object.fromEntries(Object.entries(charges).map(([key, value]) => [key, Number(value)])) }) })
      }
      await load()
      setSelected(await apiRequest(`/api/handovers/${selected.handoverId}`))
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  async function refreshCheckInChecklist() {
    const value = await apiRequest(`/api/reservations/${selected.reservationId}/check-in`)
    setChecklist(value)
    return value
  }

  async function createDeskContract() {
    if (!selected?.reservationId || !canCheckIn) return
    setContractBusy(true); setError(''); setNotice('')
    try {
      const paymentDay = Math.max(1, Math.min(Number(String(selected.moveInDate).slice(-2)), 28))
      const contract = await apiRequest('/api/contracts', { method: 'POST', body: JSON.stringify({ reservationId: selected.reservationId, paymentDay }) })
      setNotice(`Contract ${contract.contractNumber} is ready. Prepare the paper copy and have the customer sign it in person.`)
      await refreshCheckInChecklist()
    } catch (e) { setError(e.message) }
    finally { setContractBusy(false) }
  }

  async function recordDeskSignature() {
    if (!checklist?.contractId || !canCheckIn || !window.confirm('Confirm the customer has signed the paper contract in person at the facility.')) return
    setContractBusy(true); setError(''); setNotice('')
    try {
      await apiRequest(`/api/contracts/${checklist.contractId}/sign-at-desk`, { method: 'POST' })
      await refreshCheckInChecklist()
      setNotice('In-person signature recorded. The handover checklist has been refreshed.')
    } catch (e) { setError(e.message) }
    finally { setContractBusy(false) }
  }

  async function completeCheckIn() {
    if (!selected?.reservationId || !checklist?.readyForCheckIn || !inspectionChecked || !lockSerial.trim() || !cardNumber.trim()) return
    if (!canCheckIn) return
    if (photos.some(photo => !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type) || photo.size > 5 * 1024 * 1024)) {
      setError('Each condition photo must be JPEG, PNG or WebP and no larger than 5 MB.')
      return
    }
    setCheckInBusy(true); setError(''); setNotice('')
    try {
      const completed = await apiRequest('/api/check-ins', { method: 'POST', body: JSON.stringify({
        reservationId: selected.reservationId,
        contractId: checklist.contractId,
        lockSerial: lockSerial.trim(),
        cardNumber: cardNumber.trim(),
        conditionNote: [`Condition: ${condition}`, conditionNote.trim()].filter(Boolean).join(' · '),
      }) })
      let photoError = ''
      for (const photo of photos) {
        const body = new FormData()
        body.append('file', photo)
        try { await apiRequest(`/api/check-ins/${completed.checkInId}/photos`, { method: 'POST', body }) }
        catch (e) { photoError = e.message; break }
      }
      setNotice(photoError
        ? `Check-in completed. Access code: ${completed.accessCode}. Photo upload failed: ${photoError}`
        : `Check-in completed. Access code: ${completed.accessCode}`)
      setSelected(null); setChecklist(null); await load()
    } catch (e) { setError(e.message) }
    finally { setCheckInBusy(false) }
  }

  const visible = rows.filter(row => [row.customerName, row.contractNumber, row.unitCode].some(value => value?.toLowerCase().includes(search.toLowerCase())))
  const visibleCheckIns = rows.filter(row => [row.customerName, row.reservationCode, row.unitTypeName, row.facilityName, row.unitCode].some(value => value?.toLowerCase().includes(search.toLowerCase())))
  return <section className="hd-page">
    <header className="hd-header"><div><h1>Check-in &amp; handover</h1><p>Confirmed reservations ready for check-in, plus customer move-out requests.</p></div><button type="button" onClick={load}>Refresh</button></header>
    <nav className="hd-tabs" aria-label="Check-in or move-out queue">{queues.map(value => <button type="button" key={value} className={queue === value ? 'active' : ''} aria-pressed={queue === value} onClick={() => { setQueue(value); setSelected(null); setSearch('') }}>{value}</button>)}</nav>
    {queue === 'Move-out' && <nav className="hd-tabs hd-status-tabs" aria-label="Move-out handover status">{tabs.map(value => <button type="button" key={value} className={status === value ? 'active' : ''} aria-pressed={status === value} onClick={() => { setStatus(value); setSelected(null) }}>{value}</button>)}</nav>}
    {notice && <p className="hd-saved" role="status">{notice}</p>}
    <div className="hd-filter"><input aria-label={queue === 'Check-in' ? 'Search confirmed reservations' : 'Search handovers'} placeholder={queue === 'Check-in' ? 'Search customer, reservation, unit type or facility' : 'Search customer, contract or unit'} value={search} onChange={event => setSearch(event.target.value)} /></div>
    {error && <p className="hd-error" role="alert">{error} <button type="button" onClick={load}>Retry</button></p>}
    <div className={`hd-layout ${selected ? 'selected' : ''}`}>
      <div className="hd-list">{loading ? <p className="hd-state" role="status">Loading {queue === 'Check-in' ? 'confirmed reservations' : 'handovers'}…</p> : queue === 'Check-in' ? visibleCheckIns.map(row => <button type="button" className={`hd-row ${selected?.reservationId === row.reservationId ? 'active' : ''}`} key={row.reservationId} onClick={() => setSelected(row)}><span className="hd-time">{date(row.moveInDate)}</span><span className="hd-row-person"><strong>{row.customerName}</strong><small>{row.reservationCode} · {row.unitCode || row.unitTypeName} · {row.facilityName}</small></span><span className="hd-chip confirmed">Confirmed</span></button>) : visible.map(row => <button type="button" className={`hd-row ${selected?.handoverId === row.handoverId ? 'active' : ''}`} key={row.handoverId} onClick={() => setSelected(row)}><span className="hd-time">{date(row.plannedHandoverDate)}</span><span className="hd-row-person"><strong>{row.customerName}</strong><small>{row.unitCode} · {row.contractNumber}</small></span><span className="hd-chip">{row.status}</span></button>)}{!loading && !error && !(queue === 'Check-in' ? visibleCheckIns : visible).length && <p className="hd-state">{queue === 'Check-in' ? 'No confirmed reservations are waiting for check-in.' : `No ${status.toLowerCase()} handovers found.`}</p>}</div>
      {selected && queue === 'Check-in' && <article className="hd-detail"><button className="hd-close" type="button" aria-label="Close details" onClick={() => setSelected(null)}>×</button><header className="hd-detail-header"><div><h2>Handover · {selected.customerName} → Unit {selected.unitCode || '—'}</h2><p>{selected.reservationCode} · {selected.unitTypeName} · Move-in {date(selected.moveInDate)}</p></div><div className="hd-progress">{checklist ? `${checklist.items.filter(item => item.done).length + (inspectionChecked ? 1 : 0)} of ${checklist.items.length + 1} ready` : 'Loading checklist…'}<progress max={checklist?.items.length + 1 || 1} value={(checklist?.items.filter(item => item.done).length ?? 0) + (inspectionChecked ? 1 : 0)} /></div></header>
        <div className="hd-panel-body">{checklistLoading ? <p className="hd-state" role="status">Loading check-in requirements…</p> : checklist ? <>
          {['identity', 'deposit', 'unit'].map(key => { const item = checklist.items.find(value => value.key === key); return <div className={`hd-check-row ${item?.done ? 'done' : 'blocked'}`} key={key}><span aria-hidden="true">{item?.done ? '✓' : '!'}</span><div><strong>{key === 'identity' ? 'Verify identity' : key === 'deposit' ? 'Verify payment' : 'Verify assigned unit'}</strong><small>{item?.detail || item?.label || 'Requirement not satisfied'}</small></div></div> })}
          <section className="hd-checkin-card"><label className="hd-check-title"><input type="checkbox" checked={inspectionChecked} onChange={event => setInspectionChecked(event.target.checked)} /><span><strong>Inspect unit with customer</strong><small>Condition: {condition} · attach condition photos if needed</small></span></label><label>Condition<select value={condition} onChange={event => setCondition(event.target.value)}><option>Good</option><option>MinorDamage</option><option>MajorDamage</option></select></label><label>Inspection note<textarea maxLength={1000} value={conditionNote} onChange={event => setConditionNote(event.target.value)} placeholder="Record the unit condition or any issues." /></label><label>Condition photos<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => setPhotos(Array.from(event.target.files ?? []))} /></label>{photos.length > 0 && <small>{photos.length} photo(s) will upload after check-in is completed.</small>}</section>
          <section className="hd-checkin-card"><label className="hd-check-title"><input type="checkbox" checked={!!lockSerial.trim() && !!cardNumber.trim()} readOnly /><span><strong>Hand over disc lock &amp; access card</strong><small>Record the serial numbers given to the customer</small></span></label><div className="hd-field-pair"><label>Lock serial no.<input maxLength={30} value={lockSerial} onChange={event => setLockSerial(event.target.value)} required /></label><label>Access card no.<input maxLength={30} value={cardNumber} onChange={event => setCardNumber(event.target.value)} required /></label></div></section>
          <div className="hd-check-row"><span aria-hidden="true">⌁</span><div><strong>Activate personal access code</strong><small>The backend activates access automatically when check-in completes; it does not accept a customer-set PIN here.</small></div></div>
          {['contract', 'signed'].map(key => { const item = checklist.items.find(value => value.key === key); const unitReady = checklist.items.find(value => value.key === 'unit')?.done; return <div className={`hd-check-row ${item?.done ? 'done' : 'blocked'}`} key={key}><span aria-hidden="true">{item?.done ? '✓' : '!'}</span><div><strong>{key === 'signed' ? 'Customer signed contract' : 'Contract ready'}</strong><small>{item?.detail || item?.label || 'Requirement not satisfied'}</small>{canCheckIn && key === 'contract' && !item?.done && <><button className="hd-contract-action" type="button" disabled={contractBusy || !unitReady} onClick={createDeskContract}>{contractBusy ? 'Creating…' : 'Create contract record'}</button>{!unitReady && <small>Assign and reserve a unit before creating the contract.</small>}</>}{canCheckIn && key === 'signed' && item?.done === false && checklist.contractId && <><button className="hd-contract-action" type="button" disabled={contractBusy} onClick={recordDeskSignature}>{contractBusy ? 'Recording…' : 'Record paper signature'}</button><small>Use after the customer signs the paper contract in person.</small></>}</div></div> })}
          <div className="hd-unit-transition">Unit status after completion: <strong>Reserved</strong> → <strong>Occupied</strong></div>
          <footer className="hd-footer"><button type="button" disabled title="The backend does not support saving an incomplete check-in yet.">Save progress</button><button className="primary" type="button" disabled={checkInBusy || !canCheckIn || !checklist.readyForCheckIn || !inspectionChecked || !lockSerial.trim() || !cardNumber.trim()} onClick={completeCheckIn}>{checkInBusy ? 'Completing…' : '✓ Complete handover'}</button></footer>
          {!canCheckIn && <p className="hd-warning">Only Facility Staff and Facility Managers can complete check-in.</p>}
          {!checklist.readyForCheckIn && <p className="hd-warning">Complete the required identity, payment, unit and signed-contract items before check-in.</p>}
        </> : <p className="hd-error" role="alert">Could not load check-in requirements. Use Refresh to try again.</p>}</div></article>}
      {selected && queue === 'Move-out' && <article className="hd-detail"><button className="hd-close" type="button" aria-label="Close details" onClick={() => setSelected(null)}>×</button><header className="hd-detail-header"><div><h2>{selected.customerName} · Unit {selected.unitCode}</h2><p>{selected.contractNumber} · Planned {date(selected.plannedHandoverDate)}</p></div></header><div className="hd-panel-body"><p>Status: <strong>{selected.status}</strong></p><p>Reason: {selected.reason || '—'}</p>
        {selected.inspection && <section><h3>Inspection</h3><p>{selected.inspection.conditionResult} · Cleaning {money(selected.inspection.cleaningFee)} · Repair {money(selected.inspection.repairCharge)} · Other {money(selected.inspection.otherDeduction)}</p></section>}
        {selected.status === 'Requested' && [Roles.FacilityStaff, Roles.FacilityManager, Roles.SystemAdministrator].includes(user?.role) && <section><label>Inspection time<input type="datetime-local" value={slot} onChange={event => setSlot(event.target.value)} /></label><button className="primary" type="button" disabled={busy} onClick={() => act('approve')}>{busy ? 'Saving…' : 'Approve inspection'}</button></section>}
        {selected.status === 'Approved' && [Roles.FacilityStaff, Roles.FacilityManager].includes(user?.role) && <section><h3>Record inspection</h3><label>Unit condition<select value={condition} onChange={event => setCondition(event.target.value)}><option>Good</option><option>MinorDamage</option><option>MajorDamage</option></select></label>{Object.entries(charges).map(([key, value]) => <label key={key}>{key.replace(/([A-Z])/g, ' $1')} (₫)<input type="number" min="0" value={value} onChange={event => setCharges(current => ({ ...current, [key]: event.target.value }))} /></label>)}<button className="primary" type="button" disabled={busy} onClick={() => act('inspect')}>{busy ? 'Saving…' : 'Save inspection'}</button></section>}
      </div></article>}
    </div>
  </section>
}
