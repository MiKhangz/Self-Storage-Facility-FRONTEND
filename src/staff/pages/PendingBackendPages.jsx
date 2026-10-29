import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityLogsApi, facilitiesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate } from '../../customer/components/format.js';
import { PageHeader, Status, TableState } from '../components/ui.jsx';
import { useT } from '../../i18n/I18n.jsx';

/** A16: system activity log — every write by a signed-in user, plus logins. */
export function ActivityLogPage() {
    const tr = useT();
    const [action, setAction] = useState('');
    // ponytail: shows the newest 100 entries; add paging once someone needs to look further back.
    const logs = useQuery({
        queryKey: ['activity-logs', action],
        queryFn: () => activityLogsApi.list({ action: action.trim() || undefined, page: 1, pageSize: 100 }),
    });
    const rows = logs.data?.items ?? [];
    return (
        <>
            <PageHeader title={tr('Activity log')} subtitle="Every action taken in the system, with user and result" />
            <div className="se-input" style={{ maxWidth: 320, marginBottom: 16 }}>
                <input type="search" value={action} onChange={(e) => setAction(e.target.value)} placeholder={tr('Filter by action')} aria-label={tr('Filter by action')} />
            </div>
            <div className="se-card se-table-wrap">
                <table className="se-table">
                    <thead><tr><th>{tr('Time')}</th><th>{tr('User')}</th><th>{tr('Action')}</th><th>{tr('Entity')}</th><th>{tr('IP')}</th><th>{tr('Result')}</th></tr></thead>
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

export const FACILITY_FIELDS = [
    ['name', 'Facility name', true], ['code', 'Facility code', true], ['address', 'Street address', true],
    ['district', 'District', true], ['phone', 'Phone', false], ['openingHours', 'Opening hours', false],
];

/** A19: create a new storage location. */
export function AddFacilityPage() {
    const tr = useT();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [form, setForm] = useState(Object.fromEntries(FACILITY_FIELDS.map(([k]) => [k, ''])));
    const create = useMutation({
        mutationFn: () => facilitiesApi.create(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]))),
        onSuccess: (facility) => {
            queryClient.invalidateQueries({ queryKey: ['facilities'] });
            navigate(`/admin/facilities/${facility.facilityId}`, { state: { setUp: true } });
        },
    });
    return (
        <>
            <Link to="/admin/facilities" className="se-back"><Icon name="arrowLeft" size={16} /> {tr('Back to facilities')}</Link>
            <PageHeader title={tr('Add a facility')} subtitle="Create a new storage location" />
            <form className="se-panel" onSubmit={(e) => { e.preventDefault(); create.mutate(); }}>
                <h2>{tr('Basic information')}</h2>
                <div className="se-panel-grid">
                    {FACILITY_FIELDS.map(([key, label, required]) => (
                        <label key={key}><span className="se-label">{tr(label)}{required ? ' *' : ''}</span>
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
