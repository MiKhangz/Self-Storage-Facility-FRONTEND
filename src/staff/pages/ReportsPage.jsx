import { useState } from 'react';
import { api, errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatVnd, todayIso } from '../../customer/components/format.js';
import { PageHeader, Stat, downloadFile } from '../components/ui.jsx';
import { useContracts, useFacilities, useInvoices, useUnits } from '../queries.js';
import { occupancy } from './DashboardPage.jsx';

/** Per-facility billed / collected / outstanding for invoices issued in one month (YYYY-MM). */
export function facilityFigures({ facilities, units, contracts, invoices, month }) {
    const facilityOfUnit = Object.fromEntries(units.map((u) => [u.storageUnitId, u.facilityId]));
    const facilityOfContract = Object.fromEntries(contracts.map((c) => [c.contractId, facilityOfUnit[c.storageUnitId]]));
    return facilities.map((f) => {
        const mine = units.filter((u) => u.facilityId === f.facilityId);
        const bills = invoices.filter((i) => i.issueDate?.startsWith(month) && facilityOfContract[i.contractId] === f.facilityId);
        return {
            facility: f,
            rented: mine.filter((u) => u.status === 'Occupied').length,
            total: mine.length,
            occupancy: occupancy(mine),
            billed: bills.reduce((s, i) => s + (i.totalAmount ?? 0), 0),
            collected: bills.reduce((s, i) => s + (i.paidAmount ?? 0), 0),
            outstanding: bills.reduce((s, i) => s + (i.outstandingAmount ?? 0), 0),
            overdue: bills.filter((i) => i.status === 'Overdue').length,
        };
    });
}

const csvCell = (v) => `"${String(v).replace(/"/g, '""')}"`;

/** A11: revenue, occupancy and collection by facility for a month, with CSV export. */
export default function ReportsPage() {
    const [month, setMonth] = useState(todayIso().slice(0, 7));
    const [error, setError] = useState('');
    const facilities = useFacilities().data ?? [];
    const units = useUnits().data ?? [];
    const contracts = useContracts().data ?? [];
    const invoices = useInvoices().data ?? [];
    const rows = facilityFigures({ facilities, units, contracts, invoices, month });
    const sum = (k) => rows.reduce((s, r) => s + r[k], 0);
    const maxBilled = Math.max(...rows.map((r) => r.billed), 1);

    const exportTable = () => {
        const lines = [['Facility', 'Units rented', 'Total units', 'Occupancy %', 'Billed', 'Collected', 'Outstanding', 'Overdue invoices'],
            ...rows.map((r) => [r.facility.name, r.rented, r.total, r.occupancy, r.billed, r.collected, r.outstanding, r.overdue])];
        // The BOM makes Excel read Vietnamese names as UTF-8, like the backend's contract export.
        const blob = new Blob(['﻿' + lines.map((l) => l.map(csvCell).join(',')).join('\r\n')], { type: 'text/csv' });
        const href = URL.createObjectURL(blob);
        Object.assign(document.createElement('a'), { href, download: `facility-report-${month}.csv` }).click();
        URL.revokeObjectURL(href);
    };

    return (
        <>
            <PageHeader title="Reports & exports" subtitle="Revenue, occupancy and collection figures across all facilities">
                <button type="button" className="se-btn se-btn-ghost" onClick={() => downloadFile(api, '/api/contracts/export', {}, `contracts-${todayIso()}.csv`).catch((e) => setError(errorMessage(e)))}>
                    <Icon name="file" size={16} /> Contracts CSV
                </button>
                <button type="button" className="se-btn se-btn-primary" onClick={exportTable}><Icon name="file" size={16} /> Export report</button>
            </PageHeader>
            {error && <div className="se-alert" role="alert">{error}</div>}
            <div className="sa-filters">
                <label><span className="se-label">Period</span><div className="se-input"><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></div></label>
            </div>
            <div className="sa-stats">
                <Stat icon="file" label="Rent billed" value={formatVnd(sum('billed'))} />
                <Stat icon="check" label="Collected" value={formatVnd(sum('collected'))} note={sum('billed') ? `${Math.round((sum('collected') / sum('billed')) * 100)}% of billed` : ''} />
                <Stat icon="clock" tone="bad" label="Outstanding" value={formatVnd(sum('outstanding'))} />
                <Stat icon="grid" label="Avg. occupancy" value={`${occupancy(units)}%`} />
            </div>
            <section className="se-panel" style={{ marginBottom: 20 }}>
                <div className="sa-card-title"><h2>Revenue by facility ({month})</h2></div>
                <div className="sa-occupancy">
                    {rows.map((r) => (
                        <div key={r.facility.facilityId}>
                            <div className="sa-occ-label"><span>{r.facility.name}</span><strong>{formatVnd(r.billed)}</strong></div>
                            <div className="se-progress flat"><span style={{ width: `${(r.billed / maxBilled) * 100}%` }} /></div>
                        </div>
                    ))}
                </div>
            </section>
            <h2 className="sa-section-title">Detailed figures by facility</h2>
            <div className="se-card se-table-wrap">
                <table className="se-table">
                    <thead><tr><th>Facility</th><th>Units rented</th><th>Occupancy</th><th>Billed</th><th>Collected</th><th>Outstanding</th><th>Overdue</th></tr></thead>
                    <tbody>
                        {rows.map((r) => (
                            <tr key={r.facility.facilityId}>
                                <td className="strong">{r.facility.name}</td><td>{r.rented} / {r.total}</td><td>{r.occupancy}%</td>
                                <td className="price">{formatVnd(r.billed)}</td><td>{formatVnd(r.collected)}</td>
                                <td className={r.outstanding ? 'sa-bad' : ''}>{formatVnd(r.outstanding)}</td><td>{r.overdue}</td>
                            </tr>
                        ))}
                    </tbody>
                    <tfoot><tr><td className="strong">Total · {rows.length} facilities</td><td /><td /><td className="price">{formatVnd(sum('billed'))}</td><td>{formatVnd(sum('collected'))}</td><td>{formatVnd(sum('outstanding'))}</td><td>{sum('overdue')}</td></tr></tfoot>
                </table>
            </div>
        </>
    );
}
