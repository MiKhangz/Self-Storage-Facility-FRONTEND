import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { staffApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { Roles } from '../../features/auth/roles';
import Icon from '../../customer/components/Icon.jsx';
import { PasswordInput } from '../../customer/auth/AuthShell.jsx';
import { PageHeader } from '../components/ui.jsx';
import { ROLE_INFO } from '../permissions.js';
import { useFacilities } from '../queries.js';
import { PermissionMatrix } from './UsersPage.jsx';

// Facility roles work at specific sites; the two head-office roles see every facility.
const NEEDS_FACILITY = [Roles.FacilityManager, Roles.FacilityStaff];

/** A21: create a staff account with a role and facilities. */
export default function InviteUserPage() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const facilities = useFacilities().data ?? [];
    const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', password: '', role: Roles.FacilityStaff });
    const [facilityIds, setFacilityIds] = useState([]);
    const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
    const needsFacility = NEEDS_FACILITY.includes(form.role);
    const strong = form.password.length >= 8 && /\d/.test(form.password);
    const valid = form.fullName.trim() && /^\S+@\S+\.\S+$/.test(form.email) && form.phoneNumber.trim() && strong && (!needsFacility || facilityIds.length);

    const create = useMutation({
        mutationFn: async () => {
            const user = await staffApi.create({ ...form, fullName: form.fullName.trim(), email: form.email.trim() });
            if (needsFacility) await staffApi.facilities(user.userId, { facilityIds });
        },
        onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['staff'] }); navigate('/admin/users'); },
    });

    return (
        <>
            <Link to="/admin/users" className="se-back"><Icon name="arrowLeft" size={16} /> Back to users</Link>
            <PageHeader title="Add a staff user" subtitle="Create a staff account and choose what the person can do">
                <Link to="/admin/users" className="se-btn se-btn-ghost">Cancel</Link>
                <button type="submit" form="invite" className="se-btn se-btn-primary" disabled={!valid || create.isPending}>{create.isPending ? 'Creating…' : 'Create account'}</button>
            </PageHeader>
            {create.isError && <div className="se-alert" role="alert">{errorMessage(create.error)}</div>}
            <div className="sa-grid-2 sa-grid-flip">
                <form id="invite" className="se-panel se-form" onSubmit={(e) => { e.preventDefault(); if (valid) create.mutate(); }}>
                    <h2>New user</h2>
                    <label><span className="se-label">Full name *</span><div className="se-input"><input value={form.fullName} onChange={set('fullName')} required /></div></label>
                    <label><span className="se-label">Work email *</span><div className="se-input"><Icon name="mail" size={16} /><input type="email" value={form.email} onChange={set('email')} required /></div></label>
                    <label><span className="se-label">Phone *</span><div className="se-input"><input type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} required /></div></label>
                    <label><span className="se-label">Temporary password *</span><PasswordInput value={form.password} onChange={set('password')} invalid={form.password && !strong} autoComplete="new-password" />
                        <p className="se-hint">At least 8 characters and 1 number. Share it privately; the person should change it after signing in.</p></label>
                    <span className="se-label">Role *</span>
                    <div className="sa-unit-options" role="radiogroup" aria-label="Role">
                        {ROLE_INFO.map((r) => (
                            <label key={r.role} className={`sa-unit-option${form.role === r.role ? ' active' : ''}`}>
                                <input type="radio" name="role" aria-label={r.title} checked={form.role === r.role} onChange={() => setForm({ ...form, role: r.role })} />
                                <span><strong>{r.title}</strong><small>{r.text}</small></span>
                            </label>
                        ))}
                    </div>
                    {needsFacility && (
                        <>
                            <span className="se-label">Assigned facilities *</span>
                            <div className="sa-checklist">
                                {facilities.map((f) => (
                                    <label key={f.facilityId} className="se-check"><input type="checkbox" checked={facilityIds.includes(f.facilityId)}
                                        onChange={() => setFacilityIds(facilityIds.includes(f.facilityId) ? facilityIds.filter((x) => x !== f.facilityId) : [...facilityIds, f.facilityId])} /><span>{f.name}</span></label>
                                ))}
                            </div>
                        </>
                    )}
                </form>
                <section className="se-panel">
                    <h2>What a {ROLE_INFO.find((r) => r.role === form.role)?.title} can do</h2>
                    <p className="sa-muted">Permissions are fixed per role by the API; the highlighted column is the role you picked.</p>
                    <PermissionMatrix highlight={form.role} />
                </section>
            </div>
        </>
    );
}
