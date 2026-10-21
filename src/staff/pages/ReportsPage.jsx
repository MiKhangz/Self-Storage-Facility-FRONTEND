import { useState } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { reportsApi } from '../../api/generated';
import { api, errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatVnd, todayIso } from '../../customer/components/format.js';
import { PageHeader, Stat, TableState, downloadFile } from '../components/ui.jsx';

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;
const lastDayOf = (month) => { const [y, m] = month.split('-').map(Number); return `${month}-${String(new Date(y, m, 0).getDate()).padStart(2, '0')}`; };

/** One row per facility, summed over its unit sizes. */
function byFacility(rows) {
    const out = new Map();
    for (const r of rows) {
        const f = out.get(r.facilityId) ?? { facilityId: r.facilityId, name: r.facilityName, total: 0, occupied: 0, available: 0 };
        f.total += r.total; f.occupied += r.occupied; f.available += r.available;
        out.set(r.facilityId, f);
    }
    return [...out.values()];
}

/** A11 / TH-08: revenue and occupancy from the backend's report endpoints (managers see their own facilities). */
export default function ReportsPage() {
    const [month, setMonth] = useState(todayIso().slice(0, 7));
    const [error, setError] = useState('');
    const period = { from: `${month}-01`, to: lastDayOf(month) };
    const dashboard = useQuery({ queryKey: ['reports', 'dashboard'], queryFn: () => reportsApi.dashboard() });
    const occupancy = useQuery({ queryKey: ['reports', 'occupancy'], queryFn: () => reportsApi.occupancy() });
    const revenue = useQuery({ queryKey: ['reports', 'revenue', month], queryFn: () => reportsApi.revenue(period) });
    const facilities = byFacility(occupancy.data ?? []);
    // ponytail: one revenue call per facility; fine for a handful of facilities, add a grouped endpoint if there are dozens.
    const facilityRevenue = useQueries({
        queries: facilities.map((f) => ({
            queryKey: ['reports', 'revenue', month, f.facilityId],
            queryFn: () => reportsApi.revenue({ ...period, facilityId: f.facilityId }),
        })),
    });
    const rows = facilities.map((f, i) => ({ ...f, ...(facilityRevenue[i]?.data ?? {}), rate: f.total ? Math.round((f.occupied / f.total) * 100) : 0 }));
    const maxNet = Math.max(...rows.map((r) => r.net ?? 0), 1);
    const d = dashboard.data ?? {};
    const r = revenue.data ?? {};

    const exportTable = () => {
        const lines = [['Facility', 'Units rented', 'Total units', 'Occupancy %', 'Collected', 'Refunded', 'Net'],
            ...rows.map((x) => [x.name, x.occupied, x.total, x.rate, x.collected ?? 0, x.refunded ?? 0, x.net ?? 0])];
        // The BOM makes Excel read Vietnamese names as UTF-8, like the backend's contract export.
        const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' });
        const href = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href, download: `facility-report-${month}.csv` }).click();
        URL.revokeObjectURL(href);
    };

    return (
        <>
            <PageHeader title="Reports & exports" subtitle="Revenue, occupancy and collection figures by facility">
                <button type="button" className="se-btn se-btn-ghost" onClick={() => downloadFile(api, '/api/contracts/export', {}, `contracts-${todayIso()}.csv`).catch((e) => setError(errorMessage(e)))}>
                    <Icon name="file" size={16} /> Contracts CSV
                </button>
                <button type="button" className="se-btn se-btn-primary" onClick={exportTable}><Icon name="file" size={16} /> Export report</button>
            </PageHeader>
            {[error, dashboard.error && errorMessage(dashboard.error), revenue.error && errorMessage(revenue.error)].filter(Boolean)
                .map((m) => <div key={m} className="se-alert" role="alert">{m}</div>)}
            <div className="sa-filters">
                <label><span className="se-label">Period</span><div className="se-input"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div></label>
            </div>
            <div className="sa-stats">
                <Stat icon="check" label={`Collected (${month})`} value={formatVnd(r.collected ?? 0)} note={r.refunded ? `${formatVnd(r.refunded)} refunded` : ''} />
                <Stat icon="card" label="Net revenue" value={formatVnd(r.net ?? 0)} />
                <Stat icon="clock" tone="bad" label="Outstanding now" value={formatVnd(d.outstandingAmount ?? 0)} note={`${d.openOverdueCases ?? 0} open overdue cases`} />
                <Stat icon="grid" label="Occupancy now" value={`${Math.round(d.occupancyRate ?? 0)}%`} note={`${d.occupiedUnits ?? 0} of ${d.totalUnits ?? 0} units`} />
            </div>
            <section className="se-panel" style={{ marginBottom: 20 }}>
                <div className="sa-card-title"><h2>Net revenue by facility ({month})</h2></div>
                <div className="sa-occupancy">
                    {rows.map((x) => (
                        <div key={x.facilityId}>
                            <div className="sa-occ-label"><span>{x.name}</span><strong>{formatVnd(x.net ?? 0)}</strong></div>
                            <div className="se-progress flat"><span style={{ width: `${((x.net ?? 0) / maxNet) * 100}%` }} /></div>
                        </div>
                    ))}
                </div>
            </section>
            <h2 className="sa-section-title">Detailed figures by facility</h2>
            <div className="se-card se-table-wrap">
                <table className="se-table">
                    <thead><tr><th>Facility</th><th>Units rented</th><th>Occupancy</th><th>Collected</th><th>Refunded</th><th>Net</th></tr></thead>
                    <tbody>
                        {rows.map((x) => (
                            <tr key={x.facilityId}>
                                <td className="strong">{x.name}</td><td>{x.occupied} / {x.total}</td><td>{x.rate}%</td>
                                <td className="price">{formatVnd(x.collected ?? 0)}</td><td>{formatVnd(x.refunded ?? 0)}</td><td>{formatVnd(x.net ?? 0)}</td>
                            </tr>
                        ))}
                        <TableState query={occupancy} rows={rows} cols={6} empty="No facilities in your scope." />
                    </tbody>
                    <tfoot><tr><td className="strong">Total · {rows.length} facilities</td><td>{d.occupiedUnits ?? 0} / {d.totalUnits ?? 0}</td><td>{Math.round(d.occupancyRate ?? 0)}%</td>
                        <td className="price">{formatVnd(r.collected ?? 0)}</td><td>{formatVnd(r.refunded ?? 0)}</td><td>{formatVnd(r.net ?? 0)}</td></tr></tfoot>
                </table>
            </div>
            {!!r.methods?.length && (
                <>
                    <h2 className="sa-section-title">Collected by payment method ({month})</h2>
                    <div className="se-card se-table-wrap">
                        <table className="se-table">
                            <thead><tr><th>Method</th><th>Payments</th><th>Collected</th></tr></thead>
                            <tbody>{r.methods.map((m) => <tr key={m.method}><td className="strong">{m.method}</td><td>{m.payments}</td><td className="price">{formatVnd(m.collected)}</td></tr>)}</tbody>
                        </table>
                    </div>
                </>
            )}
        </>
    );
}
