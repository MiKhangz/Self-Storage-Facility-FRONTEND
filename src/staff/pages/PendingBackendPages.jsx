import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityLogsApi, facilitiesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate } from '../../customer/components/format.js';
import { NotWired, PageHeader, Status, TableState } from '../components/ui.jsx';
import { useUnitTypes } from '../queries.js';

// ponytail: walk-in booking still has no backend (POST /api/reservations is customer-only); it shows the Figma
// layout read-only until staff can create a reservation for a customer.

/** A16: system activity log — every write by a signed-in user, plus logins. */
export function ActivityLogPage() {
    const [action, setAction] = useState('');
    // ponytail: shows the newest 100 entries; add paging once someone needs to look further back.
    const logs = useQuery({
        queryKey: ['activity-logs', action],
        queryFn: () => activityLogsApi.list({ action: action.trim() || undefined, page: 1, pageSize: 100 }),
    });
    const rows = logs.data?.items ?? [];
    return (
        <>
            <PageHeader title="Activity log" subtitle="Every action taken in the system, with user and result" />
            <div className="se-input" style={{ maxWidth: 320, marginBottom: 16 }}>
                <input type="search" value={action} onChange={(e) => setAction(e.target.value)} placeholder="Filter by action" aria-label="Filter by action" />
            </div>
            <div className="se-card se-table-wrap">
                <table className="se-table">
                    <thead><tr><th>Time</th><th>User</th><th>Action</th><th>Entity</th><th>IP</th><th>Result</th></tr></thead>
                    <tbody>
                        {rows.map((l) => (
                            <tr key={l.logId}>
                                <td>{formatDate(l.createdAt)} {new Date(l.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
                                <td>{l.userName}<br /><small className="sa-muted">{l.userEmail}</small></td>
                                <td>{l.action}</td>
                                <td>{l.entityName}{l.entityId ? ` #${l.entityId}` : ''}</td>
                                <td>{l.ipAddress ?? '—'}</td>
                                <td><Status value={l.result} /></td>
                            </tr>
                        ))}
                        <TableState query={logs} rows={rows} cols={6} empty="No activity to show." />
                    </tbody>
                </table>
            </div>
        </>
    );
}

/** A18: reservation created by staff at the front desk. */
export function WalkInBookingPage() {
    const types = useUnitTypes().data ?? [];
    return (
        <>
            <Link to="/admin/reservations" className="se-back"><Icon name="arrowLeft" size={16} /> Back to reservations</Link>
            <PageHeader title="New walk-in booking" subtitle="Create a reservation for a customer at the desk" />
            <NotWired>Only customers can create reservations (POST /api/reservations is customer-only), and staff cannot register a customer yet. Until then, help the customer book on the website, then assign the unit under Reservations.</NotWired>
            <ol className="sa-steps">
                <li><span><strong>Customer</strong><small>New or existing customer, Citizen ID checked at the desk</small></span></li>
                <li><span><strong>Unit &amp; rental period</strong><small>Sizes offered: {types.map((t) => t.code).join(', ') || '—'}</small></span></li>
                <li><span><strong>Payment</strong><small>Deposit and first month taken at the desk</small></span></li>
                <li><span><strong>Check-in</strong><small>Continue in Check-in</small></span></li>
            </ol>
        </>
    );
}

export const FACILITY_FIELDS = [
    ['name', 'Facility name', true], ['code', 'Facility code', true], ['address', 'Street address', true],
    ['district', 'District', true], ['phone', 'Phone', false], ['openingHours', 'Opening hours', false],
];

/** A19: create a new storage location. */
export function AddFacilityPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(Object.fromEntries(FACILITY_FIELDS.map(([k]) => [k, ''])));
    const create = useMutation({
        mutationFn: () => facilitiesApi.create(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]))),
        onSuccess: (facility) => {
            queryClient.invalidateQueries({ queryKey: ['facilities'] });
            navigate(`/admin/facilities/${facility.facilityId}`);
        },
    });
    return (
        <>
            <Link to="/admin/facilities" className="se-back"><Icon name="arrowLeft" size={16} /> Back to facilities</Link>
            <PageHeader title="Add a facility" subtitle="Create a new storage location" />
            <form className="se-panel" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
                <h2>Basic information</h2>
                <div className="se-panel-grid">
                    {FACILITY_FIELDS.map(([key, label, required]) => (
                        <label key={key}><span className="se-label">{label}{required ? ' *' : ''}</span>
                            <div className="se-input"><input value={form[key]} required={required} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div></label>
                    ))}
                </div>
                {create.isError && <div className="se-alert" role="alert">{errorMessage(create.error)}</div>}
                <div className="sa-form-actions">
                    <button type="submit" className="se-btn se-btn-primary" disabled={create.isPending}>{create.isPending ? 'Creating…' : 'Create facility'}</button>
                </div>
            </form>
        </>
    );
}
