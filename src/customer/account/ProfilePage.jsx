import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { PasswordInput } from '../auth/AuthShell.jsx';
import { todayIso } from '../components/format.js';
import { initials } from '../layout/CustomerLayout.jsx';
import { LIVE_CONTRACT, useMyContracts } from './queries.js';

const FIELDS = [
    ['fullName', 'Full name', { autoComplete: 'name', required: true }],
    ['phoneNumber', 'Phone number', { type: 'tel', autoComplete: 'tel' }],
    ['citizenId', 'Citizen ID (CCCD)', { inputMode: 'numeric', maxLength: 12 }],
    ['dateOfBirth', 'Date of birth', { type: 'date', max: todayIso() }],
    ['address', 'Address', { autoComplete: 'street-address' }],
];
const NOTIFICATIONS = [
    ['emailReminders', 'Email reminders before rent is due'],
    ['smsReminders', 'SMS reminders'],
    ['marketingEmails', 'News and offers by email'],
];

/** Mutation status line shared by the three forms. */
const Status = ({ m, ok }) => m.isError ? <div className="se-alert" role="alert">{errorMessage(m.error)}</div>
    : m.isSuccess ? <div className="se-alert info" role="status">{ok}</div> : null;

function DetailsForm({ profile }) {
    const queryClient = useQueryClient();
    const [form, setForm] = useState(() => Object.fromEntries(FIELDS.map(([k]) => [k, profile[k] ?? ''])));
    const save = useMutation({
        // Empty optional fields go back as null so the API clears them instead of validating ''.
        mutationFn: () => profileApi.putMe(Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim() || null]))),
        onSuccess: (saved) => queryClient.setQueryData(['me'], saved),
    });
    return (
        <form className="se-form" onSubmit={(e) => { e.preventDefault(); save.mutate(); }}>
            {FIELDS.map(([key, label, props]) => (
                <label key={key}><span>{label}</span>
                    <div className="se-input"><input {...props} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} /></div>
                </label>
            ))}
            <span className="se-label">Email</span>
            <div className="se-field" aria-readonly="true">{profile.email}</div>
            <Status m={save} ok="Your details are saved." />
            <button type="submit" className="se-btn se-btn-primary" disabled={save.isPending}>{save.isPending ? 'Saving…' : 'Save changes'}</button>
        </form>
    );
}

function PasswordForm() {
    const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
    const change = useMutation({ mutationFn: () => profileApi.mePassword(form), onSuccess: () => setForm({ currentPassword: '', newPassword: '' }) });
    return (
        <form className="se-form" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
            <label><span>Current password</span>
                <PasswordInput value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" />
            </label>
            <label><span>New password</span>
                <PasswordInput value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" />
                <p className="se-hint">At least 8 characters, with a letter and a number</p>
            </label>
            <Status m={change} ok="Password changed." />
            <button type="submit" className="se-btn se-btn-primary" disabled={change.isPending || !form.currentPassword || !form.newPassword}>Change password</button>
        </form>
    );
}

function NotificationForm() {
    const queryClient = useQueryClient();
    const settings = useQuery({ queryKey: ['me', 'notifications'], queryFn: profileApi.getMeNotificationSettings });
    const save = useMutation({
        mutationFn: profileApi.putMeNotificationSettings,
        onSuccess: (saved) => queryClient.setQueryData(['me', 'notifications'], saved),
    });
    if (!settings.data) return settings.isError ? <div className="se-alert" role="alert">{errorMessage(settings.error)}</div> : null;
    return (
        <div className="se-form">
            {NOTIFICATIONS.map(([key, label]) => (
                <label key={key} className="se-check">
                    <input type="checkbox" checked={!!settings.data[key]} disabled={save.isPending}
                        onChange={(e) => save.mutate({ ...settings.data, [key]: e.target.checked })} />
                    <span>{label}</span>
                </label>
            ))}
            <Status m={save} ok="Notification settings saved." />
        </div>
    );
}

/** U13: the signed-in customer's account. */
export default function ProfilePage() {
    const { session } = useAuth();
    const me = useQuery({ queryKey: ['me'], queryFn: profileApi.getMe });
    const contracts = useMyContracts();
    const activeUnits = (contracts.data?.items ?? []).filter((c) => LIVE_CONTRACT.includes(c.status) && c.status !== 'Draft').length;
    const name = me.data?.fullName ?? session?.fullName;

    return (
        <>
            <div className="se-account-title">
                <div><h1>Profile &amp; settings</h1><p>Your personal details and account.</p></div>
            </div>
            <div className="se-detail-grid">
                <div>
                    <section className="se-panel">
                        <h2>Personal information</h2>
                        {me.isError && <div className="se-alert" role="alert">{errorMessage(me.error)}</div>}
                        {me.data && <DetailsForm profile={me.data} />}
                    </section>
                    <section className="se-panel">
                        <h2>Change password</h2>
                        <PasswordForm />
                    </section>
                    <section className="se-panel">
                        <h2>Notifications</h2>
                        <NotificationForm />
                    </section>
                </div>
                <aside>
                    <section className="se-panel" style={{ textAlign: 'center' }}>
                        <span className="se-avatar se-avatar-xl">{initials(name)}</span>
                        <h2 style={{ justifyContent: 'center', margin: '12px 0 4px' }}>{name}</h2>
                        <p className="se-hint">Customer no. {session?.userId}</p>
                    </section>
                    <section className="se-panel">
                        <h2>Account</h2>
                        <dl className="se-kv">
                            <div><dt>Role</dt><dd>Storage customer</dd></div>
                            <div><dt>Active units</dt><dd>{activeUnits}</dd></div>
                            <div><dt>Status</dt><dd><span className="se-badge">{me.data?.status ?? 'Active'}</span></dd></div>
                        </dl>
                    </section>
                </aside>
            </div>
        </>
    );
}
