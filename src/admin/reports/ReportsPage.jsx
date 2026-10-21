import { useEffect, useRef, useState } from 'react';
import { apiRequest, readSession } from '../auth.js';
import { Roles } from '../../features/auth/roles';
import './ReportsPage.css';

const today = () => {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
};
const monthStart = () => `${today().slice(0, 7)}-01`;
const money = value => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value ?? 0)} ₫`;
const number = value => new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 }).format(value ?? 0);
const methodName = method => ({ Cash: 'Cash', BankTransfer: 'Bank transfer', Gateway: 'Online gateway', Card: 'Card' })[method] ?? method;
const csvCell = value => {
  const text = String(value ?? '');
  const safe = typeof value === 'string' && /^[=+@\-]/.test(text) ? `'${text}` : text;
  return `"${safe.replaceAll('"', '""')}"`;
};

function downloadCsv(data, from, to) {
  if (!data) return;
  const rows = [
    ['Reports & Exports', `${from} to ${to}`],
    [],
    ['Revenue summary'],
    ['Collected', data.revenue?.collected ?? 0],
    ['Refunded', data.revenue?.refunded ?? 0],
    ['Net', data.revenue?.net ?? 0],
    [],
    ['Monthly revenue', 'Collected', 'Refunded', 'Net', 'Payments'],
    ...(data.revenue?.months ?? []).map(row => [row.month, row.collected, row.refunded, row.net, row.payments]),
    [],
    ['Payment method', 'Collected', 'Payments'],
    ...(data.revenue?.methods ?? []).map(row => [methodName(row.method), row.collected, row.payments]),
    [],
    ['Occupancy by facility and unit type'],
    ['Facility', 'Unit type', 'Total', 'Occupied', 'Available', 'Reserved', 'Maintenance', 'Occupancy %'],
    ...(data.occupancy ?? []).map(row => [row.facilityName, row.unitTypeCode, row.total, row.occupied, row.available, row.reserved, row.maintenance, row.occupancyRate]),
    [],
    ['Dashboard summary', 'Value'],
    ['Total units', data.dashboard?.totalUnits],
    ['Active contracts', data.dashboard?.activeContracts],
    ['Outstanding', data.dashboard?.outstandingAmount],
    ['Open overdue cases', data.dashboard?.openOverdueCases],
    ['Average occupancy %', data.dashboard?.occupancyRate],
  ];
  const csv = `\uFEFF${rows.map(row => row.map(csvCell).join(',')).join('\r\n')}`;
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `storease-report-${from}-to-${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function RevenueBars({ months }) {
  const max = Math.max(1, ...months.map(item => item.collected ?? 0));
  if (!months.length) return <p className="reports-empty">No payments for this period.</p>;
  return <div className="reports-month-chart" role="img" aria-label="Monthly revenue collected">
    {months.map(item => <div className="reports-month-bar" key={item.month} title={`${item.month}: ${money(item.collected)}`}>
      <span className="reports-month-value">{money(item.collected)}</span>
      <span className="reports-bar-fill" style={{ height: `${Math.max(3, (item.collected / max) * 100)}%` }} />
      <span className="reports-month-label">{item.month}</span>
    </div>)}
  </div>;
}

function OccupancyRows({ rows, groupBy }) {
  const ordered = [...rows].sort((a, b) => groupBy === 'unitType'
    ? (a.unitTypeCode ?? '').localeCompare(b.unitTypeCode ?? '') || (a.facilityName ?? '').localeCompare(b.facilityName ?? '')
    : (a.facilityName ?? '').localeCompare(b.facilityName ?? '') || (a.unitTypeCode ?? '').localeCompare(b.unitTypeCode ?? ''));
  if (!ordered.length) return <p className="reports-empty">No occupancy figures for this scope.</p>;
  return <div className="reports-occupancy-chart" aria-label="Occupancy by facility and unit type">
    {ordered.map(row => <div className="reports-occupancy-row" key={`${row.facilityId}-${row.unitTypeId}`}>
      <div className="reports-occupancy-label"><strong>{groupBy === 'unitType' ? row.unitTypeCode : row.facilityName}</strong><span>{groupBy === 'unitType' ? row.facilityName : row.unitTypeCode}</span></div>
      <div className="reports-occupancy-track"><span style={{ width: `${Math.min(100, row.occupancyRate ?? 0)}%` }} /></div>
      <strong className="reports-occupancy-rate">{number(row.occupancyRate)}%</strong>
    </div>)}
  </div>;
}

export default function ReportsPage({ user, facilities = [], facilityId = '', canSelectFacility, onFacilityChange }) {
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);
  const [applied, setApplied] = useState({ from: monthStart(), to: today() });
  const [reportType, setReportType] = useState('all');
  const [groupBy, setGroupBy] = useState('facility');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [validation, setValidation] = useState('');
  const [exportError, setExportError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const requestId = useRef(0);

  useEffect(() => {
    const id = ++requestId.current;
    setLoading(true);
    setError('');
    setData(null);
    const scope = facilityId ? { facilityId: Number(facilityId) } : {};
    const query = new URLSearchParams(scope);
    const queryString = query.toString();
    const revenueQuery = new URLSearchParams({ from: applied.from, to: applied.to, ...scope });
    Promise.all([
      apiRequest(`/api/reports/dashboard${queryString ? `?${queryString}` : ''}`),
      apiRequest(`/api/reports/occupancy${queryString ? `?${queryString}` : ''}`),
      apiRequest(`/api/reports/revenue?${revenueQuery}`),
    ]).then(([dashboard, occupancy, revenue]) => {
      if (id === requestId.current) setData({ dashboard, occupancy, revenue });
    }).catch(reason => {
      if (id === requestId.current) setError(reason.message);
    }).finally(() => {
      if (id === requestId.current) setLoading(false);
    });
    return () => { requestId.current += 1; };
  }, [facilityId, applied.from, applied.to, user?.userId, refreshKey]);

  const runReport = event => {
    event.preventDefault();
    if (!from || !to || from > to) {
      setValidation('Choose a valid date range. The end date must be on or after the start date.');
      return;
    }
    setValidation('');
    setApplied({ from, to });
    setRefreshKey(key => key + 1);
  };

  const exportContracts = async () => {
    setExportError('');
    try {
      const session = readSession();
      const response = await fetch('/api/contracts/export', { headers: session?.token ? { Authorization: `Bearer ${session.token}` } : {} });
      if (!response.ok) throw new Error(`Contract export failed (${response.status}).`);
      const url = URL.createObjectURL(await response.blob());
      const link = Object.assign(document.createElement('a'), { href: url, download: `contracts-${today()}.csv` });
      link.click();
      URL.revokeObjectURL(url);
    } catch (reason) {
      setExportError(reason.message);
    }
  };

  const dashboard = data?.dashboard;
  const revenue = data?.revenue;
  const occupancy = data?.occupancy ?? [];
  const isRevenue = reportType !== 'occupancy';
  const isOccupancy = reportType !== 'revenue';

  return <div className="reports-page">
    <div className="reports-heading">
      <div><h1>Reports &amp; exports</h1><p>Revenue, occupancy and collection figures across your accessible facilities</p></div>
      {user?.role === Roles.FacilityManager && <button className="reports-secondary" type="button" onClick={exportContracts}>⇩ Contracts CSV</button>}
      <button className="reports-primary" type="button" disabled={loading || !data} onClick={() => downloadCsv(data, applied.from, applied.to)}>⇩ Export report</button>
    </div>

    <form className="reports-filters" onSubmit={runReport}>
      <label>Report type<select value={reportType} onChange={event => setReportType(event.target.value)}><option value="all">Revenue &amp; occupancy</option><option value="revenue">Revenue</option><option value="occupancy">Occupancy</option></select></label>
      <label>Period<div className="reports-date-range"><input aria-label="Period from" type="date" value={from} onChange={event => setFrom(event.target.value)} /><span>to</span><input aria-label="Period to" type="date" value={to} onChange={event => setTo(event.target.value)} /></div></label>
      <label>Facility<select value={facilityId} disabled={!canSelectFacility} onChange={event => onFacilityChange?.(event.target.value)}><option value="">{canSelectFacility ? `All facilities (${facilities.length})` : `Assigned facilities (${facilities.length})`}</option>{facilities.map(facility => <option key={facility.facilityId} value={facility.facilityId}>{facility.name}</option>)}</select></label>
      {isOccupancy && <label>Group by<select value={groupBy} onChange={event => setGroupBy(event.target.value)}><option value="facility">Facility</option><option value="unitType">Unit type</option></select></label>}
      <button className="reports-run" type="submit" disabled={loading}>⌕ Run report</button>
    </form>
    {validation && <p className="reports-error" role="alert">{validation}</p>}
    {exportError && <p className="reports-error" role="alert">{exportError}</p>}
    {error && <div className="reports-error" role="alert">{error} <button type="button" onClick={() => setRefreshKey(key => key + 1)}>Retry</button></div>}
    {loading && <p className="reports-state" role="status">Loading report…</p>}

    {data && <>
      <section className="reports-metrics" aria-label="Report summary">
        {isRevenue && <>
          <article><span>Collected</span><strong>{money(revenue?.collected)}</strong><small>Selected reporting period</small></article>
          <article><span>Net after refunds</span><strong>{money(revenue?.net)}</strong><small>{money(revenue?.refunded)} refunded</small></article>
        </>}
        {isOccupancy && <article><span>Average occupancy</span><strong>{number(dashboard?.occupancyRate)}%</strong><small>{number(dashboard?.occupiedUnits)} of {number(dashboard?.totalUnits)} units occupied</small></article>}
        <article><span>Outstanding</span><strong>{money(dashboard?.outstandingAmount)}</strong><small>{dashboard?.openOverdueCases ?? 0} open overdue cases</small></article>
      </section>

      {isRevenue && <section className="reports-chart-grid">
        <article className="reports-card reports-revenue-card"><h2>Monthly collections</h2><p>{applied.from} – {applied.to}</p><RevenueBars months={revenue?.months ?? []} /></article>
        <article className="reports-card"><h2>Revenue mix by payment method</h2><p>Collected payments in selected period</p>
          {(revenue?.methods ?? []).length ? <ul className="reports-method-list">{revenue.methods.map(row => <li key={row.method}><span><i className={`reports-method-dot method-${String(row.method).toLowerCase()}`} />{methodName(row.method)}</span><strong>{money(row.collected)}</strong><small>{row.payments} payments</small></li>)}</ul> : <p className="reports-empty">No payment activity for this period.</p>}
        </article>
      </section>}

      {isOccupancy && <>
        <section className="reports-card reports-occupancy-card"><div className="reports-section-heading"><div><h2>Occupancy by {groupBy === 'facility' ? 'facility and unit type' : 'unit type and facility'}</h2><p>Occupied units as a share of active units</p></div></div><OccupancyRows rows={occupancy} groupBy={groupBy} /></section>
        <section className="reports-table-section"><h2>Detailed figures by facility</h2><div className="reports-table-wrap"><table><thead><tr><th>Facility</th><th>Unit type</th><th>Units rented</th><th>Units total</th><th>Occupancy</th><th>Available</th><th>Reserved</th><th>Maintenance</th></tr></thead><tbody>
          {occupancy.map(row => <tr key={`${row.facilityId}-${row.unitTypeId}`}><td>{row.facilityName}</td><td>{row.unitTypeCode}</td><td>{row.occupied}</td><td>{row.total}</td><td><div className="reports-table-rate"><span><i style={{ width: `${Math.min(100, row.occupancyRate ?? 0)}%` }} /></span>{number(row.occupancyRate)}%</div></td><td>{row.available}</td><td>{row.reserved}</td><td>{row.maintenance}</td></tr>)}
          {!occupancy.length && <tr><td colSpan="8" className="reports-empty">No occupancy figures for this scope.</td></tr>}
        </tbody></table></div></section>
      </>}

      <section className="reports-export-card"><div><h2>Export report</h2><p>Download the figures returned by the report APIs as a CSV file.</p></div><button className="reports-primary" type="button" disabled={loading} onClick={() => downloadCsv(data, applied.from, applied.to)}>⇩ Download CSV</button></section>
    </>}
  </div>;
}
