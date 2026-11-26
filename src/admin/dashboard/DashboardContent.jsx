import { useEffect, useState } from 'react';
import { apiRequest } from '../auth.js';
import './DashboardContent.css';

const money = value => `${new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 0 }).format(value ?? 0)} ₫`;
export default function DashboardContent({ user, facilityId = '' }) {
    const [data, setData] = useState(null);
    const [months, setMonths] = useState([]);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    useEffect(() => {
        let active = true;
        const scope = facilityId ? `?facilityId=${encodeURIComponent(facilityId)}` : '';
        const now = new Date();
        const from = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
        const to = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const revenueScope = new URLSearchParams({ from, to, ...(facilityId ? { facilityId } : {}) });
        setLoading(true); setError('');
        Promise.all([apiRequest(`/api/reports/dashboard${scope}`), apiRequest(`/api/reports/revenue?${revenueScope}`)])
            .then(([dashboard, revenue]) => { if (active) { setData(dashboard); setMonths(revenue.months ?? []); } })
            .catch(reason => { if (active) setError(reason.message); })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [facilityId, refreshKey]);
    const maxRevenue = Math.max(1, ...months.map(row => row.collected ?? 0));
    return (
        <div className="dashboard-grid-view">
            <div className="dashboard-greeting-bar">
                <h2>Welcome, {user?.fullName || 'Employee'}</h2>
                <p>{new Date().toLocaleDateString()} · {facilityId ? 'Selected facility' : 'All accessible facilities'}</p>
            </div>
            {error && <div role="alert" className="mg-error">{error} <button type="button" onClick={() => setRefreshKey(value => value + 1)}>Retry</button></div>}
            {loading && <p role="status">Loading dashboard…</p>}

            {/* CARD METRIC STRIP */}
            <div className="metrics-strip">
                <div className="metric-box">
                    <span className="box-title">Occupancy rate</span>
                    <h3>{data ? `${data.occupancyRate}%` : '—'}</h3>
                    <small>{data ? `${data.occupiedUnits} of ${data.totalUnits} units` : 'Current scope'}</small>
                </div>
                <div className="metric-box">
                    <span className="box-title">Revenue this month</span>
                    <h3>{data ? money(data.revenueThisMonth) : '—'}</h3>
                    <small>Collected this month</small>
                </div>
                <div className="metric-box">
                    <span className="box-title">Active contracts</span>
                    <h3>{data?.activeContracts ?? '—'}</h3>
                    <small>{data?.upcomingMoveIns ?? '—'} upcoming move-ins</small>
                </div>
                <div className="metric-box alert-card">
                    <span className="box-title">Outstanding payments</span>
                    <h3 className="text-danger">{data ? money(data.outstandingAmount) : '—'}</h3>
                    <small className="text-danger">{data?.openOverdueCases ?? '—'} open overdue cases</small>
                </div>
            </div>

            {/* SPLIT LAYOUT COLUMNS */}
            <div className="dashboard-row-split">
                {/* Left Side Layout Module */}
                <div className="split-column main-panel">
                    <div className="chart-placeholder-mock">
                        <h4>Monthly revenue trends</h4>
                        {months.length ? <div className="mock-graph" aria-label="Monthly revenue collected" style={{ alignItems: 'end', gap: 12, padding: 16 }}>{months.map(row => <div key={row.month} title={`${row.month}: ${money(row.collected)}`} style={{ height: `${Math.max(4, row.collected / maxRevenue * 90)}%`, flex: 1, background: '#118a7e', borderRadius: '4px 4px 0 0' }} />)}</div> : <div className="mock-graph">{loading ? 'Loading…' : 'No revenue data for this month.'}</div>}
                    </div>
                </div>

                {/* Right Side Layout Module */}
                <div className="split-column sidebar-panel">
                    <div className="attention-box-wrapper">
                        <h4>Needs attention</h4>
                        <div className="attention-item alert"><span>⚠️ {data?.openOverdueCases ?? '—'} overdue cases</span><small>{money(data?.outstandingAmount)} outstanding</small></div>
                        <div className="attention-item warning"><span>📅 {data?.upcomingMoveIns ?? '—'} upcoming move-ins</span><small>Within the next 7 days</small></div>
                        <div className="attention-item info"><span>💬 {data?.openTickets ?? '—'} open support tickets</span><small>Across your accessible facilities</small></div>
                    </div>
                </div>
            </div>
        </div>
    );
}

