import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Roles } from '../../features/auth/roles'
import { fetchAllLogs, fetchFacilities, fetchStaff } from './api.js'
import { buildActionOptions, buildRoleMap, buildUserOptions, computeStats, filterRows, formatAction, formatEntity, toCsv, toVietnamTime, validateRange } from './logic.js'
import WipBadge from './WipBadge.jsx'
import './ActivityLog.css'

const PAGE_SIZE = 10
const wipTooltip = 'Needs backend support'

function Icon({ name }) {
  const paths = {
    download: 'M12 3v12m-4-4 4 4 4-4M5 15v5h14v-5',
    shield: 'm12 3 8 4v5c0 5-8 9-8 9s-8-4-8-9V7l8-4Zm-4 9 3 3 5-6',
    search: 'M21 21l-5-5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0',
    filter: 'M3 4h18l-7 8v7l-4 2v-9L3 4Z',
    activity: 'M2 12h5l3-8 4 16 3-8h5',
    lock: 'M6 10h12v11H6V10Zm2 0V6a4 4 0 0 1 8 0v4',
    users: 'M3 21v-3a4 4 0 0 1 4-4h6a4 4 0 0 1 4 4v3m-3-14a4 4 0 1 1-8 0 4 4 0 0 1 8 0m5 7a4 4 0 0 1 3 4v3',
    report: 'M5 3h10l4 4v14H5V3Zm10 0v5h4M8 12h8m-8 4h5',
    edit: 'm4 16 12-12 4 4L8 20H4v-4Zm10-10 4 4',
    down: 'm7 10 5 5 5-5',
    left: 'm14 6-6 6 6 6',
    right: 'm10 6 6 6-6 6',
  }
  return <svg className="al-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={paths[name]} /></svg>
}

function useReadResource(loader) {
  const [resource, setResource] = useState({ data: null, loading: true, error: '' })
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    let current = true
    setResource({ data: null, loading: true, error: '' })
    loader({ signal: controller.signal })
      .then(data => { if (current) setResource({ data, loading: false, error: '' }) })
      .catch(error => { if (current) setResource({ data: null, loading: false, error: error.message }) })
    return () => { current = false; controller.abort() }
  }, [loader, version])
  return { ...resource, retry: () => setVersion(value => value + 1) }
}

function WipButton({ children, primary = false, wide = false }) {
  return <span className={`al-disabled-control ${wide ? 'al-wide' : ''}`} title={wipTooltip}>
    <button type="button" disabled className={`al-button ${primary ? 'al-primary' : ''} ${wide ? 'al-wide' : ''}`}>{children}</button>
  </span>
}

function SecurityAlerts() {
  return <section className="al-card al-alert-card" aria-labelledby="al-alerts-heading">
    <div className="al-card-heading"><h2 id="al-alerts-heading">Security alerts</h2><WipBadge /></div>
    <div className="al-wip-content"><span className="al-stat-icon"><Icon name="shield" /></span><p>Security alerts are not available yet.</p></div>
    <WipButton wide>Review all alerts</WipButton>
  </section>
}

function SessionPolicy() {
  return <section className="al-card al-policy" aria-labelledby="al-policy-heading">
    <div className="al-card-heading"><h2 id="al-policy-heading">Log &amp; session policy</h2></div>
    <dl>{['Retention', 'Lock after', 'Lock duration', 'Session timeout', 'Export approval'].map(label => <div key={label}><dt>{label}</dt><dd><WipBadge /></dd></div>)}
      <div><dt>Log tampering</dt><dd><span className="al-result al-success" title="No update/delete log API is exposed; database immutability is not guaranteed.">Read-only</span></dd></div>
    </dl>
    <WipButton wide><Icon name="edit" />Edit policy</WipButton>
  </section>
}

function initialFilters() {
  const today = toVietnamTime(new Date()).date
  return { from: today, to: today, search: '', userId: '', action: '' }
}

function ActivityLogContent({ user }) {
  const [draft, setDraft] = useState(initialFilters)
  const [applied, setApplied] = useState(() => draft)
  const [tab, setTab] = useState('activity')
  const [page, setPage] = useState(1)
  const [validation, setValidation] = useState('')
  const [exportError, setExportError] = useState('')
  const [exportNotice, setExportNotice] = useState('')
  const rangePicker = useRef(null)
  const sessionKey = `storease.activityLog.exports.${user.userId}`
  const [exports, setExports] = useState(() => {
    try { const count = Number(sessionStorage.getItem(sessionKey)); return Number.isSafeInteger(count) && count > 0 ? count : 0 }
    catch { return 0 }
  })
  const loadLogs = useCallback(({ signal }) => fetchAllLogs({ from: applied.from, to: applied.to, signal }), [applied.from, applied.to])
  const logs = useReadResource(loadLogs)
  const staff = useReadResource(fetchStaff)
  const facilities = useReadResource(fetchFacilities)
  const roles = useMemo(() => buildRoleMap(staff.data ?? []), [staff.data])
  const rangeRows = useMemo(() => filterRows(logs.data?.rows ?? [], { from: applied.from, to: applied.to }), [logs.data, applied.from, applied.to])
  const rows = useMemo(() => filterRows(rangeRows, applied), [rangeRows, applied])
  const users = useMemo(() => buildUserOptions(rangeRows), [rangeRows])
  const actions = useMemo(() => buildActionOptions(rangeRows), [rangeRows])
  const stats = useMemo(() => computeStats(rangeRows, exports), [rangeRows, exports])
  const pages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const currentPage = Math.min(page, pages)
  const visible = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE)
  const isToday = applied.from === toVietnamTime(new Date()).date && applied.from === applied.to
  const rangeText = value => value ? `${value.slice(8, 10)}/${value.slice(5, 7)}/${value.slice(0, 4)}` : 'DD/MM/YYYY'
  const changeDraft = (key, value) => setDraft(current => ({ ...current, [key]: value }))

  function applyFilters(event) {
    event.preventDefault()
    const error = validateRange(draft)
    setValidation(error)
    if (error) { rangePicker.current.open = true; return }
    setApplied({ ...draft }); setPage(1); setExportError(''); setExportNotice('')
    rangePicker.current.open = false
  }

  function changeDate(key, value) {
    setDraft(current => ({ ...current, [key]: value, userId: '', action: '' }))
  }

  function moveTab(event) {
    if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
    const buttons = [...event.currentTarget.querySelectorAll('[role="tab"]:not(:disabled)')]
    const index = buttons.indexOf(event.target)
    if (index < 0) return
    event.preventDefault()
    const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
      : (index + (event.key === 'ArrowRight' ? 1 : -1) + buttons.length) % buttons.length
    buttons[next].focus(); buttons[next].click()
  }

  function exportLog() {
    setExportError(''); setExportNotice('')
    let url
    let link
    try {
      url = URL.createObjectURL(new Blob([toCsv(rows, roles)], { type: 'text/csv;charset=utf-8' }))
      link = document.createElement('a')
      link.href = url
      link.download = `storease-activity-log-${applied.from}-to-${applied.to}.csv`
      document.body.append(link); link.click()
      const count = exports + 1
      setExports(count)
      try { sessionStorage.setItem(sessionKey, String(count)) } catch { /* The visible session counter still works if storage is unavailable. */ }
      setExportNotice(`CSV download started for ${rows.length.toLocaleString()} events.`)
    } catch { setExportError('The CSV download could not start. Please retry.') }
    finally { link?.remove(); if (url) setTimeout(() => URL.revokeObjectURL(url), 0) }
  }

  const statValue = value => logs.loading ? '…' : logs.error ? '-' : value.toLocaleString()
  const statError = logs.error ? <button className="al-inline-retry" type="button" onClick={logs.retry}>Could not load. Retry</button> : null

  return <section className="al-page">
    <header className="al-heading"><div><h1>Activity log</h1><p>Every recorded action, with user and result.</p></div><div className="al-heading-actions">
      <button type="button" className="al-button" disabled={logs.loading || !!logs.error || staff.loading || !rows.length} onClick={exportLog}><Icon name="download" />Export log</button>
      <WipButton primary><Icon name="shield" />Security settings</WipButton>
    </div></header>
    <nav className="al-tabs" role="tablist" aria-label="Activity and security" onKeyDown={moveTab}>
      <button type="button" role="tab" id="al-activity-tab" tabIndex={tab === 'activity' ? 0 : -1} aria-selected={tab === 'activity'} aria-controls="al-panel" className={tab === 'activity' ? 'al-selected' : ''} onClick={() => setTab('activity')}>Activity log</button>
      <span title={wipTooltip}><button type="button" role="tab" aria-selected="false" disabled>Login history <WipBadge /></button></span>
      <button type="button" role="tab" id="al-alerts-tab" tabIndex={tab === 'alerts' ? 0 : -1} aria-selected={tab === 'alerts'} aria-controls="al-panel" className={tab === 'alerts' ? 'al-selected' : ''} onClick={() => setTab('alerts')}>Security alerts <WipBadge /></button>
    </nav>
    <form className="al-filters" onSubmit={applyFilters} noValidate aria-label="Activity log filters">
      <label className="al-search"><Icon name="search" /><input aria-label="Search by user, entity or action" placeholder="Search by user, entity or action" value={draft.search} onChange={event => changeDraft('search', event.target.value)} /></label>
      <select aria-label="Filter by user" disabled={logs.loading || !!logs.error} value={draft.userId} onChange={event => changeDraft('userId', event.target.value)}><option value="">{logs.loading ? 'Loading users…' : users.length ? 'All users' : 'No users in range'}</option>{users.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
      <select aria-label="Filter by action type" disabled={logs.loading || !!logs.error} value={draft.action} onChange={event => changeDraft('action', event.target.value)}><option value="">{logs.loading ? 'Loading actions…' : actions.length ? 'All action types' : 'No actions in range'}</option>{actions.map(option => <option key={option.value} value={option.value} title={option.value}>{option.label} · {option.value.split('.').at(-1)}</option>)}</select>
      <label className="al-facility-filter" title={wipTooltip}><span className="al-sr-only">Facilities (needs backend support)</span><select disabled value="" aria-label="Facility filter unavailable"><option value="">{facilities.loading ? 'Loading facilities…' : facilities.error ? 'Facilities unavailable' : !facilities.data?.length ? 'No facilities' : 'All facilities'}</option>{(facilities.data ?? []).map(facility => <option key={facility.facilityId} value={facility.facilityId}>{facility.name}</option>)}</select><WipBadge /></label>
      <details className="al-range-picker" ref={rangePicker}><summary aria-label="Choose date range">{rangeText(draft.from)} – {rangeText(draft.to)}<Icon name="down" /></summary><div className="al-range-fields"><label>From<input type="date" min="0001-01-02" max="9999-12-29" value={draft.from} onChange={event => changeDate('from', event.target.value)} /></label><label>To<input type="date" min="0001-01-02" max="9999-12-29" value={draft.to} onChange={event => changeDate('to', event.target.value)} /></label><small>Vietnam time (UTC+7). Apply with Filter.</small></div></details>
      <button className="al-button" type="submit"><Icon name="filter" />Filter</button>
    </form>
    {validation && <div className="al-error" role="alert">{validation}</div>}
    <div className="al-lookup-status">
      {staff.loading ? <span role="status">Loading staff roles…</span> : staff.error ? <span className="al-error" role="alert">Staff roles unavailable: {staff.error} <button type="button" onClick={staff.retry}>Retry roles</button></span> : !staff.data?.length && <span>No staff roles available. Unmatched roles show “-”.</span>}
      {facilities.error && <span className="al-error" role="alert">Facilities unavailable: {facilities.error} <button type="button" onClick={facilities.retry}>Retry facilities</button></span>}
    </div>
    {exportError && <div className="al-error" role="alert">{exportError} <button type="button" onClick={exportLog}>Retry export</button></div>}
    {exportNotice && <p className="al-notice" role="status">{exportNotice}</p>}
    <div className="al-stats">
      <article className="al-card al-stat"><div className="al-stat-top"><span>{isToday ? 'Events today' : 'Events in range'}</span><span className="al-stat-icon"><Icon name="activity" /></span></div><strong>{statValue(stats.events)}</strong><small>{statError || <><WipBadge /> Facility count unavailable</>}</small></article>
      <article className="al-card al-stat"><div className="al-stat-top"><span>Failed logins</span><span className="al-stat-icon al-pink"><Icon name="lock" /></span></div><strong>-</strong><small><WipBadge /> Login metrics unavailable</small></article>
      <article className="al-card al-stat"><div className="al-stat-top"><span>Staff updates</span><span className="al-stat-icon"><Icon name="users" /></span></div><strong>{statValue(stats.staffUpdates)}</strong><small>{statError || <>Permission details <WipBadge /></>}</small></article>
      <article className="al-card al-stat"><div className="al-stat-top"><span>Data exports</span><span className="al-stat-icon"><Icon name="download" /></span></div><strong>{stats.exports.toLocaleString()}</strong><small>This session only <WipBadge /></small></article>
    </div>
    <div className="al-body">
      <section className="al-table-card" id="al-panel" role="tabpanel" tabIndex="0" aria-busy={tab === 'activity' && logs.loading} aria-labelledby={tab === 'activity' ? 'al-activity-tab' : 'al-alerts-tab'}>
        {tab === 'alerts' ? <div className="al-state al-alert-panel"><span className="al-stat-icon"><Icon name="shield" /></span><h2>Security alerts <WipBadge /></h2><p>Security alerts are not available yet.</p></div> : <>
          <div className="al-table-scroll"><table className="al-table"><caption className="al-sr-only">Activity events from {rangeText(applied.from)} to {rangeText(applied.to)}</caption><thead><tr><th scope="col">Time</th><th scope="col">User</th><th scope="col">Action</th><th scope="col">Entity</th><th scope="col">Facility <WipBadge /></th><th scope="col">Result</th></tr></thead><tbody>
            {logs.loading ? <tr><td colSpan="6"><div className="al-state" role="status">Loading activity events…</div></td></tr> : logs.error ? <tr><td colSpan="6"><div className="al-state al-table-error" role="alert"><strong>Could not load activity events</strong><p>{logs.error}</p><button type="button" className="al-button" onClick={logs.retry}>Retry</button></div></td></tr> : !rows.length ? <tr><td colSpan="6"><div className="al-state"><Icon name="report" /><strong>No activity events found</strong><p>{rangeRows.length ? 'Try changing the search or filters.' : 'There are no non-login events in this date range.'}</p><button type="button" className="al-button" onClick={logs.retry}>Refresh events</button></div></td></tr> : visible.map(row => {
              const time = toVietnamTime(row.createdAt)
              const role = staff.loading ? 'Loading role…' : roles.get(String(row.userId)) || '-'
              return <tr key={row.logId}><td><time dateTime={`${time.date}T${time.time}+07:00`} title={time.dateLabel}>{time.time}</time>{!isToday && <small>{time.dateLabel}</small>}</td><td><strong>{row.userName || row.userEmail || '-'}</strong><small title="Current role from the staff lookup; historical roles are not recorded.">{role}</small></td><td><strong title={row.action}>{formatAction(row.action)}</strong></td><td>{formatEntity(row)}</td><td>-</td><td><span className={`al-result ${row.result === 'Success' ? 'al-success' : row.result === 'Failure' ? 'al-failed' : ''}`}>{row.result === 'Success' ? 'Success' : row.result === 'Failure' ? 'Failed' : '-'}</span></td></tr>
            })}
          </tbody></table></div>
          <footer className="al-table-footer"><span>{logs.loading ? 'Loading events…' : logs.error ? 'Events unavailable' : `Showing ${visible.length} of ${rows.length.toLocaleString()} events`}</span><span>Retention policy: <WipBadge /></span></footer>
          <div className="al-pager"><span>Page {currentPage} of {pages}</span><div><button type="button" className="al-button" aria-label="Previous page" disabled={currentPage <= 1 || logs.loading || !!logs.error} onClick={() => setPage(currentPage - 1)}><Icon name="left" />Previous</button><button type="button" className="al-button" aria-label="Next page" disabled={currentPage >= pages || logs.loading || !!logs.error} onClick={() => setPage(currentPage + 1)}>Next<Icon name="right" /></button></div></div>
          {logs.data?.truncated && <p className="al-cap-note" role="status">Showing the latest 5,000 events in range. <span>The source-row cap applies before date and login filtering; counts and exports may be incomplete.</span></p>}
        </>}
      </section>
      <aside className="al-side"><SecurityAlerts /><SessionPolicy /></aside>
    </div>
  </section>
}

export default function ActivityLog({ user }) {
  if (user?.role !== Roles.SystemAdministrator) return <section className="al-page"><h1>Activity log</h1><div className="al-state al-no-access" role="alert"><Icon name="shield" /><h2>No access</h2><p>Activity logs are available to System Administrators only.</p></div></section>
  return <ActivityLogContent key={user.userId} user={user} />
}
