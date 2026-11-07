import { Fragment, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { activityLogsApi, facilitiesApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate } from '../../customer/components/format.js';
import { Filters, PageHeader, SearchFilter, SelectFilter, Status, TableState } from '../components/ui.jsx';
import { ROLE_INFO } from '../permissions.js';
import { humanize } from '../queries.js';
import { AREAS, describe, isThisComputer } from '../activityLabels.js';
import { useT } from '../../i18n/I18n.jsx';

const LOG_PAGE_SIZE = 50;
const LOG_ROLES = [...ROLE_INFO.map((r) => ({ value: r.role, label: r.title })), { value: Roles.StorageCustomer, label: 'Storage customer' }];

/** A16: system activity log — every write by a signed-in user of any role, plus sign-ins. `?userId=` opens one person's log. */
export function ActivityLogPage() {
    const tr = useT();
    const [params, setParams] = useSearchParams();
    const userId = Number(params.get('userId')) || undefined;
    const [filters, setFilters] = useState({ search: '', role: '', areas: '', signIns: true });
    const [page, setPage] = useState(1);
    const change = (key, value) => { setFilters({ ...filters, [key]: value }); setPage(1); };
    const logs = useQuery({
        queryKey: ['activity-logs', userId, filters, page],
        queryFn: () => activityLogsApi.list({
            userId, role: filters.role || undefined, search: filters.search.trim() || undefined,
            areas: filters.areas || undefined, signIns: filters.signIns, page, pageSize: LOG_PAGE_SIZE,
        }),
        placeholderData: keepPreviousData,
    });
    const rows = logs.data?.items ?? [];
    const pages = Math.max(1, Math.ceil((logs.data?.totalCount ?? 0) / LOG_PAGE_SIZE));
    const person = rows[0]?.userName;
    const today = formatDate(new Date().toISOString());
    const yesterday = formatDate(new Date(Date.now() - 864e5).toISOString());
    const dayOf = (iso) => { const d = formatDate(iso); return d === today ? tr('Today') : d === yesterday ? tr('Yesterday') : d; };
    return (
        <>
            <PageHeader title={tr('Activity log')} subtitle="Every action taken in the system by users of every role, with result" />
            {userId && (
                <div className="se-alert info" style={{ marginBottom: 16 }}>
                    {tr('Showing the log of {name}', { name: person ?? `#${userId}` })}{' '}
                    <button type="button" className="se-link" onClick={() => { setParams({}); setPage(1); }}>{tr('Show everyone')}</button>
                </div>
            )}
            <Filters>
                {!userId && <SearchFilter value={filters.search} onChange={(v) => change('search', v)} placeholder="Search name or email" />}
                <SelectFilter label="Role" value={filters.role} onChange={(v) => change('role', v)} all="All roles" options={LOG_ROLES} />
                <SelectFilter label="Action type" value={filters.areas} onChange={(v) => change('areas', v)} all="All actions" options={AREAS} />
                <label className="se-check"><input type="checkbox" checked={filters.signIns} onChange={(e) => change('signIns', e.target.checked)} /><span>{tr('Include sign-ins')}</span></label>
            </Filters>
            <div className="se-card se-table-wrap">
                <table className="se-table">
                    <thead><tr><th>{tr('Time')}</th><th>{tr('User')}</th><th>{tr('What happened')}</th><th>{tr('From')}</th><th>{tr('Result')}</th></tr></thead>
                    <tbody>
                        {rows.map((l, i) => {
                            const d = describe(l);
                            const day = dayOf(l.createdAt);
                            return (
                                <Fragment key={l.logId}>
                                    {(i === 0 || dayOf(rows[i - 1].createdAt) !== day) && <tr className="sa-day-row"><th colSpan={5} scope="rowgroup">{day}</th></tr>}
                                    <tr className={l.result === 'Failure' ? 'sa-row-failed' : ''}>
                                        <td>{new Date(l.createdAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}</td>
                                        <td>{userId ? <strong>{l.userName}</strong> : <Link to={`?userId=${l.userId}`} onClick={() => setPage(1)}><strong>{l.userName}</strong></Link>}
                                            <br /><small className="sa-muted">{l.userEmail}</small>
                                            <br /><span className="se-badge info">{tr(humanize(l.userRole))}</span></td>
                                        <td><strong title={d.raw}>{tr(d.label)}</strong>
                                            {d.record && <><br /><small className="sa-muted">{d.link ? <Link to={d.link}>{tr(d.record)} #{d.recordId}</Link> : `${tr(d.record)}${d.recordId ? ` #${d.recordId}` : ''}`}</small></>}
                                            {l.subject && <><br /><small className="sa-muted">{tr('For')} {l.subjectUserId && l.subjectUserId !== userId ? <Link to={`?userId=${l.subjectUserId}`} onClick={() => setPage(1)}>{l.subject}</Link> : l.subject}</small></>}</td>
                                        <td title={l.ipAddress ?? undefined}>{isThisComputer(l.ipAddress) ? tr('This computer') : (l.ipAddress ?? '—')}</td>
                                        <td>{l.result === 'Failure' ? <span className="se-badge none">{tr('Failed')}</span> : <Status value={l.result} />}</td>
                                    </tr>
                                </Fragment>
                            );
                        })}
                        <TableState query={logs} rows={rows} cols={5} empty="No activity to show." />
                    </tbody>
                </table>
            </div>
            {pages > 1 && (
                <div className="sa-filters" style={{ justifyContent: 'flex-end', marginTop: 12 }}>
                    <button type="button" className="se-btn se-btn-ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>{tr('Previous')}</button>
                    <span>{tr('Page {page} of {pages}', { page, pages })}</span>
                    <button type="button" className="se-btn se-btn-ghost" disabled={page >= pages} onClick={() => setPage(page + 1)}>{tr('Next')}</button>
                </div>
            )}
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
                    <button type="submit" className="se-btn se-btn-primary" disabled={create.isPending}>{create.isPending ? tr('Creating…') : tr('Create facility')}</button>
                </div>
            </form>
        </>
    );
}
