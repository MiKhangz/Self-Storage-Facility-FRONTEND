import { useEffect, useMemo, useState } from 'react'
import { apiRequest } from '../auth.js'
import { useData, money } from './common.jsx'
import './WalkInBooking.css'

const today = () => new Date(Date.now() + 7 * 3600000).toISOString().slice(0, 10)
const dateLabel = value => value ? new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeZone: 'Asia/Ho_Chi_Minh' }).format(new Date(`${value}T00:00:00+07:00`)) : '—'

export default function WalkInBooking({ close, created }) {
  const facilities = useData('/api/facilities/my-scope')
  const types = useData('/api/unit-types')
  const currentTerms = useData('/api/pricing-policies/current-terms')
  const [step, setStep] = useState(1)
  const [customerMode, setCustomerMode] = useState('new')
  const [customerSearch, setCustomerSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const customers = useData(debouncedSearch.length >= 2 ? `/api/customers?${new URLSearchParams({ search: debouncedSearch, page: 1, pageSize: 10 })}` : null)
  const [selectedCustomer, setSelectedCustomer] = useState(null)
  const [verifiedId, setVerifiedId] = useState(false)
  const [depositReceived, setDepositReceived] = useState(false)
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', citizenId: '', facilityId: '', unitTypeId: '', storageUnitId: '', moveInDate: today(), rentalMonths: 1 })
  const units = useData(form.facilityId && form.unitTypeId ? `/api/storage-units?${new URLSearchParams({ facilityId: form.facilityId, unitTypeId: form.unitTypeId, status: 'Available', page: 1, pageSize: 100 })}` : null)
  const quote = useData(form.facilityId && form.unitTypeId && form.moveInDate && Number(form.rentalMonths) >= 1 && Number(form.rentalMonths) <= 36
    ? `/api/unit-types/${form.unitTypeId}/quote?${new URLSearchParams({ facilityId: form.facilityId, moveInDate: form.moveInDate, rentalMonths: form.rentalMonths })}` : null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { const timer = setTimeout(() => setDebouncedSearch(customerSearch.trim()), 250); return () => clearTimeout(timer) }, [customerSearch])
  const availableFacilities = Array.isArray(facilities.data) ? facilities.data : []
  const availableTypes = Array.isArray(types.data) ? types.data : []
  const availableUnits = units.data?.items ?? []
  const selectedUnit = availableUnits.find(unit => String(unit.storageUnitId) === form.storageUnitId)
  const quoteReady = !!selectedUnit && !!quote.data && !quote.loading && !quote.error
  const selectedType = availableTypes.find(type => String(type.unitTypeId) === form.unitTypeId)
  useEffect(() => {
    if (availableFacilities.length === 1 && !form.facilityId)
      setForm(current => ({ ...current, facilityId: String(availableFacilities[0].facilityId) }))
  }, [availableFacilities, form.facilityId])
  const customerHasDetails = customerMode === 'existing'
    ? !!selectedCustomer?.userId && !!selectedCustomer?.fullName && !!selectedCustomer?.email && !!selectedCustomer?.phoneNumber && !!selectedCustomer?.citizenId
    : !!form.fullName.trim() && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()) && /^\+?[0-9 ]{8,20}$/.test(form.phoneNumber.trim()) && /^\d{9,12}$/.test(form.citizenId.trim())
  const customerReady = customerHasDetails && verifiedId
  const facility = availableFacilities.find(item => String(item.facilityId) === form.facilityId)
  const fees = quote.data?.fees ?? []
  const isLockCardFee = fee => /lock|card|disc[\s_-]*lock|disk[\s_-]*lock/i.test(`${fee.code ?? ''} ${fee.name ?? ''}`)
  const lockCardFee = fees.filter(isLockCardFee).reduce((sum, fee) => sum + (fee.amount ?? 0), 0)
  const otherFees = fees.filter(fee => !isLockCardFee(fee)).reduce((sum, fee) => sum + (fee.amount ?? 0), 0)
  const discount = useMemo(() => {
    if (!quote.data || !selectedType || quote.data.pricingPolicyId !== currentTerms.data?.pricingPolicyId) return null
    return Math.max(0, (selectedType.monthlyPrice ?? 0) * Number(form.rentalMonths) - (quote.data.rentSubtotal ?? 0))
  }, [quote.data, selectedType, currentTerms.data, form.rentalMonths])

  const update = (key, value) => {
    if (['facilityId', 'unitTypeId', 'moveInDate', 'rentalMonths', 'storageUnitId'].includes(key)) setDepositReceived(false)
    setForm(current => ({
      ...current,
      [key]: value,
      ...(key === 'facilityId' ? { unitTypeId: '', storageUnitId: '' } : {}),
      ...(key === 'unitTypeId' || key === 'moveInDate' ? { storageUnitId: '' } : {}),
    }))
  }

  function chooseMode(mode) {
    setCustomerMode(mode); setSelectedCustomer(null); setVerifiedId(false); setCustomerSearch('')
    setForm(current => ({ ...current, fullName: '', email: '', phoneNumber: '', citizenId: '' }))
  }

  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('')
    try {
      if (!customerReady) throw new Error('Complete the customer details and confirm the citizen ID before continuing.')
      if (!quoteReady) throw new Error('Choose an available unit and wait for its current price quote.')
      if (!depositReceived) throw new Error('Confirm that you have received the deposit before creating the booking.')
      const result = await apiRequest('/api/reservations/walk-in', { method: 'POST', body: JSON.stringify({
        customerId: customerMode === 'existing' ? selectedCustomer.userId : null,
        newCustomer: customerMode === 'new' ? { fullName: form.fullName.trim(), email: form.email.trim(), phoneNumber: form.phoneNumber.trim(), citizenId: form.citizenId.trim() } : null,
        facilityId: Number(form.facilityId), unitTypeId: Number(form.unitTypeId), storageUnitId: Number(form.storageUnitId),
        moveInDate: form.moveInDate, rentalMonths: Number(form.rentalMonths),
      }) })
      created(result)
    } catch (e) { setError(e.message) }
    finally { setBusy(false) }
  }

  return <section className="walk-in-page" aria-labelledby="walk-in-title">
    <form onSubmit={submit}>
      <header className="walk-in-header"><div><h2 id="walk-in-title">New walk-in booking</h2><p>Create a confirmed reservation for a customer at the desk.</p></div><button type="button" disabled={busy} onClick={close}>Cancel</button></header>
      <nav className="walk-in-steps" aria-label="Booking steps"><span className={step === 1 ? 'active' : 'done'}>1 <b>Customer</b></span><i /><span className={step === 2 ? (quoteReady ? 'done' : 'active') : ''}>2 <b>Unit &amp; rental period</b></span><i /><span className={quoteReady ? 'active' : ''}>3 <b>Payment</b></span></nav>
      {error && <p role="alert" className="rv-warning">{error}</p>}
      <div className="walk-in-body">
        <div className="walk-in-main">
          {step === 1 ? <section className="walk-in-card">
            <h3>1. Customer</h3>
            <div className="walk-in-toggle" role="group" aria-label="Customer type"><button type="button" className={customerMode === 'existing' ? 'selected' : ''} onClick={() => chooseMode('existing')}>Existing customer</button><button type="button" className={customerMode === 'new' ? 'selected' : ''} onClick={() => chooseMode('new')}>New customer</button></div>
            {customerMode === 'existing' ? <>
              <label>Find customer<input type="search" value={customerSearch} onChange={event => { setCustomerSearch(event.target.value); setSelectedCustomer(null); setVerifiedId(false) }} placeholder="Search by name, email or phone" /></label>
              {customers.loading && <p role="status">Searching customers…</p>}
              {customers.error && <p role="alert" className="rv-warning">{customers.error} <button type="button" onClick={customers.reload}>Retry</button></p>}
              {customerSearch.trim().length >= 2 && !customers.loading && !customers.error && !selectedCustomer && <div className="walk-in-customer-results">{(customers.data?.items ?? []).map(item => <button type="button" key={item.userId} onClick={() => { setSelectedCustomer(item); setVerifiedId(false); setCustomerSearch('') }}><strong>{item.fullName}</strong><small>{item.phoneNumber} · {item.email}</small></button>)}{!(customers.data?.items ?? []).length && <p>No matching customers.</p>}</div>}
              {selectedCustomer && <><div className="walk-in-fields"><label>Full name<input readOnly value={selectedCustomer.fullName} /></label><label>Phone number<input readOnly value={selectedCustomer.phoneNumber} /></label><label>Email<input readOnly value={selectedCustomer.email} /></label><label>Citizen ID (CCCD)<input readOnly value={selectedCustomer.citizenId || 'Not on file'} /></label></div><button className="walk-in-change-customer" type="button" onClick={() => { setSelectedCustomer(null); setVerifiedId(false) }}>Choose another customer</button></>}
              {selectedCustomer && !selectedCustomer.citizenId && <p className="walk-in-inline-warning">This customer has no citizen ID on file. Add it to their profile before walk-in check-in.</p>}
            </> : <div className="walk-in-fields">
              <label>Full name *<input required maxLength="100" value={form.fullName} onChange={event => update('fullName', event.target.value)} /></label>
              <label>Phone number *<input required type="tel" maxLength="20" value={form.phoneNumber} onChange={event => update('phoneNumber', event.target.value)} /></label>
              <label>Email *<input required type="email" maxLength="100" value={form.email} onChange={event => update('email', event.target.value)} /></label>
              <label>Citizen ID (CCCD) *<input required inputMode="numeric" pattern="[0-9]{9,12}" maxLength="12" value={form.citizenId} onChange={event => update('citizenId', event.target.value)} /></label>
            </div>}
            <label className={`walk-in-verify ${!customerHasDetails ? 'muted' : ''}`}><input type="checkbox" checked={verifiedId} disabled={!customerHasDetails} onChange={event => setVerifiedId(event.target.checked)} /><span><strong>I checked the customer’s citizen ID and confirmed it is genuine and matches their name.</strong><small>This is a staff confirmation; the current API does not store the confirmation itself.</small></span></label>
            <footer className="walk-in-footer"><button type="button" disabled={busy} onClick={close}>Cancel</button><button className="primary" type="button" disabled={!customerReady} onClick={() => { setStep(2); setError('') }}>Continue to unit selection →</button></footer>
          </section> : <>
            <section className="walk-in-card">
              <div className="walk-in-card-title"><h3>2. Unit &amp; rental period</h3><button type="button" onClick={() => setStep(1)}>Edit customer</button></div>
              {facilities.error && <p role="alert" className="rv-warning">Could not load facilities: {facilities.error} <button type="button" onClick={facilities.reload}>Retry</button></p>}
              {types.error && <p role="alert" className="rv-warning">Could not load unit sizes: {types.error} <button type="button" onClick={types.reload}>Retry</button></p>}
              {(facilities.loading || types.loading) && <p role="status">Loading facility and unit options…</p>}
              <div className="walk-in-fields three">
                <label>Facility<select required value={form.facilityId} onChange={event => update('facilityId', event.target.value)}><option value="">Choose facility</option>{availableFacilities.map(item => <option key={item.facilityId} value={item.facilityId}>{item.name}</option>)}</select></label>
                <label>Unit size<select required disabled={!form.facilityId || types.loading} value={form.unitTypeId} onChange={event => update('unitTypeId', event.target.value)}><option value="">Choose size</option>{availableTypes.map(item => <option key={item.unitTypeId} value={item.unitTypeId}>{item.code} · {item.areaM2} m²</option>)}</select></label>
                <label>Move-in date<input required type="date" min={today()} value={form.moveInDate} onChange={event => update('moveInDate', event.target.value)} /></label>
                <label>Rental period (months)<input required type="number" min="1" max="36" value={form.rentalMonths} onChange={event => update('rentalMonths', event.target.value)} /></label>
              </div>
              {form.facilityId && form.unitTypeId && <div className="walk-in-units"><strong>Available units</strong>{units.loading ? <p role="status">Loading units…</p> : units.error ? <p role="alert" className="rv-warning">{units.error} <button type="button" onClick={units.reload}>Retry</button></p> : availableUnits.length ? <div className="walk-in-unit-options">{availableUnits.map(unit => <button type="button" key={unit.storageUnitId} className={form.storageUnitId === String(unit.storageUnitId) ? 'selected' : ''} onClick={() => update('storageUnitId', String(unit.storageUnitId))}>{unit.unitCode} · {unit.floorName || 'Floor N/A'}{unit.zone ? ` · ${unit.zone}` : ''}</button>)}</div> : <p>No available units match this size at the selected facility.</p>}</div>}
              {selectedUnit && <div className="walk-in-selected-unit"><div className="walk-in-unit-icon">◇</div><div><strong>{selectedUnit.unitCode} · Size {selectedType?.code} ({selectedUnit.areaM2 ?? selectedType?.areaM2} m²)</strong><small>{selectedUnit.floorName || 'Floor not provided'}{selectedUnit.zone ? ` · Zone ${selectedUnit.zone}` : ''}{selectedType?.width && selectedType?.depth && selectedType?.height ? ` · ${selectedType.width} × ${selectedType.depth} × ${selectedType.height} m` : ''}{selectedUnit.note ? ` · ${selectedUnit.note}` : ''}</small></div><b>{quoteReady ? `${money(quote.data.monthlyRent)} / month` : quote.loading ? 'Loading quote…' : 'Quote unavailable'}</b></div>}
            </section>
            {quoteReady && <section className="walk-in-card walk-in-payment">
              <h3>3. Payment at the desk</h3>
              <div className="walk-in-payment-methods" role="group" aria-label="Payment method">
                <button type="button" className="selected" aria-pressed="true">▣ Cash</button>
                {['Card (POS)', 'VNPay QR', 'Transfer'].map(method => <button type="button" key={method} disabled title="This payment method is not available in the backend yet">{method}</button>)}
              </div>
              <label className="walk-in-amount">Amount received<input readOnly value={money(quote.data.totalAmount)} /></label>
              <label className="walk-in-deposit-check"><input type="checkbox" checked={depositReceived} onChange={event => setDepositReceived(event.target.checked)} /><span><strong>Have received the deposit</strong></span></label>
              <p className="walk-in-inline-warning">The current walk-in API records the deposit as cash. It does not record the full quote amount or the other payment methods.</p>
            </section>}
            <footer className="walk-in-footer walk-in-bottom"><button type="button" disabled={busy} onClick={() => setStep(1)}>← Back</button><button className="primary" type="submit" disabled={busy || !customerReady || !quoteReady || !depositReceived}>{busy ? 'Creating booking…' : 'Create booking & start handover'}</button></footer>
          </>}
        </div>
        {step === 2 && <aside className="walk-in-summary">
          <section className="walk-in-card"><h3>Order summary</h3>
            {!quoteReady ? <p className="walk-in-summary-placeholder">Select a facility, unit size, move-in date, rental period and available unit to see the quote.</p> : <div className="walk-in-summary-unit"><div className="walk-in-unit-icon">◇</div><div><strong>{selectedUnit.unitCode} · Size {selectedType?.code}</strong><small>{facility?.name || 'Choose a facility'}</small></div></div>}
            <dl>
              <div><dt>Move-in</dt><dd>{quoteReady ? dateLabel(form.moveInDate) : '—'}</dd></div>
              <div><dt>Period</dt><dd>{quoteReady ? `${form.rentalMonths} month${Number(form.rentalMonths) === 1 ? '' : 's'}` : '—'}</dd></div>
              <div><dt>Monthly rent</dt><dd>{quoteReady ? money(quote.data.monthlyRent) : '—'}</dd></div>
              <div><dt>Discount</dt><dd>{!quoteReady ? '—' : discount === null ? 'Included in quote' : `− ${money(discount)}`}</dd></div>
              <div><dt>Deposit</dt><dd>{quoteReady ? money(quote.data.depositAmount) : '—'}</dd></div>
              <div><dt>Disc lock + card</dt><dd>{quoteReady ? money(lockCardFee) : '—'}</dd></div>
              {quoteReady && otherFees > 0 && <div><dt>Other fees</dt><dd>{money(otherFees)}</dd></div>}
              <div className="walk-in-summary-total"><dt>Collect today</dt><dd>{quoteReady ? money(quote.data.totalAmount) : '—'}</dd></div>
            </dl>
            {quote.error && <p className="walk-in-inline-warning">{quote.error}</p>}
            {quoteReady && <small className="walk-in-summary-note">The current walk-in API records the deposit as cash; it does not collect rent or lock/card fees here.</small>}
          </section>
          <section className="walk-in-callout"><strong>Before booking</strong><p>Confirm the selected unit, move-in date and rental period with the customer. Contract setup is not included in this step.</p></section>
        </aside>}
      </div>
    </form>
  </section>
}
