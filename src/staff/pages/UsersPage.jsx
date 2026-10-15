import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../../customer/components/Icon.jsx';
import { formatDate } from '../../customer/components/format.js';
import { initials } from '../../customer/layout/CustomerLayout.jsx';
import { Filters, PageHeader, SearchFilter, SelectFilter, Status, TableState, matches } from '../components/ui.jsx';
import { PERMISSIONS, ROLE_INFO } from '../permissions.js';
import { humanize, useFacilities, useStaff } from '../queries.js';

const STATUSES = ['Active', 'Disabled'];

export function PermissionMatrix({ highlight }) {
    return (
        <div className="se-table-wrap">
            <table className="se-table sa-matrix">
                <thead><tr><th>Feature</th>{ROLE_INFO.map((r) => <th key={r.role} className={highlight === r.role ? 'hl' : ''} title={r.title}>{r.short}</th>)}</tr></thead>
                <tbody>
                    {PERMISSIONS.map((p) => (
                        <tr key={p.feature}>
                            <td>{p.feature}</td>
                            {ROLE_INFO.map((r) => (
                                <td key={r.role} className={highlight === r.role ? 'hl' : ''}>
                                    {p.roles.includes(r.role) ? <span className="sa-yes" aria-label="Allowed"><Icon name="check" size={12} /></span> : <span className="sa-no" aria-label="Not allowed" />}
                                </td>
                            ))}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function EditUser({ user, onClose }) {
    const queryClient = useQueryClient();
    const facilities = useFacilities();
    // The API refuses to let an admin lock or demote themselves (nobody could undo it), so don't offer it.
    const self = useAuth().session?.userId === user.userId;
    const [form, setForm] = useState({ fullName: user.fullName ?? '', phoneNumber: user.phoneNumber ?? '', role: user.role, status: user.status });
    const [facilityIds, setFacilityIds] = useState((user.facilities ?? []).map((f) => f.facilityId));
    const save = useMutation({
        mutationFn: async () => {
            await staffApi.update(user.userId, form);
            await staffApi.facilities(user.userId, { facilityIds });
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); onClose(); },
    });
    const toggle = (id) => setFacilityIds(facilityIds.includes(id) ? facilityIds.filter((x) => x !== id) : [...facilityIds, id]);

    return (
        <aside className="se-panel sa-side-panel">
            <div className="sa-card-title"><h2>Edit {user.fullName}</h2><button type="button" className="sa-close" onClick={onClose} aria-label="Close"><Icon name="arrowLeft" size={16} /></button></div>
            <p className="sa-muted">{user.email}</p>
            <label><span className="se-label">Full name</span><div className="se-input"><input value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} /></div></label>
            <label><span className="se-label">Phone</span><div className="se-input"><input value={form.phoneNumber} onChange={(e) => setForm({ ...form, phoneNumber: e.target.value })} /></div></label>
            <label><span className="se-label">Role</span>
                <div className="se-field"><select value={form.role} disabled={self} onChange={(e) => setForm({ ...form, role: e.target.value })}>{ROLE_INFO.map((r) => <option key={r.role} value={r.role}>{r.title}</option>)}</select></div></label>
            <label><span className="se-label">Status</span>
                <div className="se-field"><select value={form.status} disabled={self} onChange={(e) => setForm({ ...form, status: e.target.value })}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
                <p className="se-hint">{self ? 'You cannot change your own role or status.' : 'Disabled accounts cannot sign in or be assigned work.'}</p></label>
            <span className="se-label">Assigned facilities</span>
            <div className="sa-checklist">
                {(facilities.data ?? []).map((f) => (
                    <label key={f.facilityId} className="se-check"><input type="checkbox" checked={facilityIds.includes(f.facilityId)} onChange={() => toggle(f.facilityId)} /><span>{f.name}</span></label>
                ))}
            </div>
            {save.isError && <div className="se-alert" role="alert">{errorMessage(save.error)}</div>}
            <button type="button" className="se-btn se-btn-primary se-btn-block" disabled={save.isPending || !form.fullName.trim()} onClick={() => save.mutate()}>{save.isPending ? 'Saving…' : 'Save changes'}</button>
        </aside>
    );
}

/** A10: staff accounts, their roles and facilities, plus what each role may do. */
export default function UsersPage() {
    const [search, setSearch] = useState('');
    const [role, setRole] = useState('');
    const [selected, setSelected] = useState(null);
    const staff = useStaff();
    const all = staff.data ?? [];
    const shown = all.filter((u) => (!role || u.role === role) && matches(search, u.fullName, u.email));
    const current = all.find((u) => u.userId === selected);

    return (
        <>
            <PageHeader title="Users & roles" subtitle="Manage staff accounts, assign roles and control access by facility">
                <Link to="/admin/users/invite" className="se-btn se-btn-primary"><Icon name="shield" size={16} /> Add user</Link>
            </PageHeader>
            <Filters>
                <SearchFilter value={search} onChange={setSearch} placeholder="Search name or email" />
                <SelectFilter label="Role" value={role} onChange={setRole} all="All roles" options={ROLE_INFO.map((r) => ({ value: r.role, label: r.title }))} />
            </Filters>
            <div className="sa-split open">
                <div className="se-card se-table-wrap">
                    <table className="se-table sa-table">
                        <thead><tr><th>User</th><th>Role</th><th>Facilities</th><th>Status</th><th>Created</th></tr></thead>
                        <tbody>
                            {shown.map((u) => (
                                <tr key={u.userId} className={selected === u.userId ? 'active' : ''} onClick={() => setSelected(u.userId)}>
                                    <td><span className="sa-person"><span className="se-avatar">{initials(u.fullName)}</span><span><strong>{u.fullName}</strong><div className="sa-muted">{u.email}</div></span></span></td>
                                    <td><span className="se-badge info">{humanize(u.role)}</span></td>
                                    <td>{u.facilities?.map((f) => f.facilityName ?? f.facilityId).join(', ') || '—'}</td>
                                    <td><Status value={u.status} /></td>
                                    <td>{formatDate(u.createdAt)}</td>
                                </tr>
                            ))}
                            <TableState query={staff} rows={shown} cols={5} empty="No staff accounts match." />
                        </tbody>
                    </table>
                </div>
                {current
                    ? <EditUser key={current.userId} user={current} onClose={() => setSelected(null)} />
                    : <aside className="se-panel sa-side-panel"><h2>Permission matrix</h2><p className="sa-muted">SA · BO · FM · ST = the four staff roles, as enforced by the API.</p><PermissionMatrix /></aside>}
            </div>
        </>
    );
}
