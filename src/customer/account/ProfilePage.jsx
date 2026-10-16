import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { profileApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import { useAuth } from '../../features/auth/AuthContext';
import { PasswordInput } from '../auth/AuthShell.jsx';
import { todayIso } from '../components/format.js';
import { initials } from '../layout/CustomerLayout.jsx';
import { LIVE_CONTRACT, useMyContracts } from './queries.js';
import { PASSWORD_RULE } from '../auth/RegisterPage.jsx';

const ACCOUNT_STATUS = { Active: 'Đang hoạt động', Pending: 'Chờ kích hoạt', Suspended: 'Tạm khóa', Inactive: 'Ngừng hoạt động' };

const FIELDS = [
    ['fullName', 'Họ và tên', { autoComplete: 'name', required: true }],
    ['phoneNumber', 'Số điện thoại', { type: 'tel', autoComplete: 'tel' }],
    ['citizenId', 'Căn cước công dân (CCCD)', { inputMode: 'numeric', maxLength: 12 }],
    ['dateOfBirth', 'Ngày sinh', { type: 'date', max: todayIso() }],
    ['address', 'Địa chỉ', { autoComplete: 'street-address' }],
];
const NOTIFICATIONS = [
    ['emailReminders', 'Nhắc qua email trước hạn đóng tiền thuê'],
    ['smsReminders', 'Nhắc qua tin nhắn SMS'],
    ['marketingEmails', 'Nhận tin tức và ưu đãi qua email'],
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
            <Status m={save} ok="Đã lưu thông tin của bạn." />
            <button type="submit" className="se-btn se-btn-primary" disabled={save.isPending}>{save.isPending ? 'Đang lưu…' : 'Lưu thay đổi'}</button>
        </form>
    );
}

function PasswordForm() {
    const [form, setForm] = useState({ currentPassword: '', newPassword: '' });
    const change = useMutation({ mutationFn: () => profileApi.mePassword(form), onSuccess: () => setForm({ currentPassword: '', newPassword: '' }) });
    return (
        <form className="se-form" onSubmit={(e) => { e.preventDefault(); change.mutate(); }}>
            <label><span>Mật khẩu hiện tại</span>
                <PasswordInput value={form.currentPassword} onChange={(e) => setForm({ ...form, currentPassword: e.target.value })} autoComplete="current-password" />
            </label>
            <label><span>Mật khẩu mới</span>
                <PasswordInput value={form.newPassword} onChange={(e) => setForm({ ...form, newPassword: e.target.value })} autoComplete="new-password" />
                <p className="se-hint">{PASSWORD_RULE}</p>
            </label>
            <Status m={change} ok="Đã đổi mật khẩu." />
            <button type="submit" className="se-btn se-btn-outline" disabled={change.isPending || !form.currentPassword || !form.newPassword}>{change.isPending ? 'Đang đổi…' : 'Đổi mật khẩu'}</button>
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
            <Status m={save} ok="Đã lưu cài đặt thông báo." />
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
                <div><h1>Hồ sơ và cài đặt</h1><p>Thông tin cá nhân và tài khoản của bạn.</p></div>
            </div>
            <div className="se-detail-grid">
                <div>
                    <section className="se-panel">
                        <h2>Thông tin cá nhân</h2>
                        {me.isError && <div className="se-alert" role="alert">{errorMessage(me.error)}</div>}
                        {me.data && <DetailsForm profile={me.data} />}
                    </section>
                    <section className="se-panel">
                        <h2>Đổi mật khẩu</h2>
                        <PasswordForm />
                    </section>
                    <section className="se-panel">
                        <h2>Thông báo</h2>
                        <NotificationForm />
                    </section>
                </div>
                <aside>
                    <section className="se-panel" style={{ textAlign: 'center' }}>
                        <span className="se-avatar se-avatar-xl">{initials(name)}</span>
                        <h2 style={{ justifyContent: 'center', margin: '12px 0 4px' }}>{name}</h2>
                        <p className="se-hint">Mã khách hàng {session?.userId}</p>
                    </section>
                    <section className="se-panel">
                        <h2>Tài khoản</h2>
                        <dl className="se-kv">
                            <div><dt>Vai trò</dt><dd>Khách thuê kho</dd></div>
                            <div><dt>Kho đang thuê</dt><dd>{activeUnits}</dd></div>
                            <div><dt>Trạng thái</dt><dd><span className="se-badge">{ACCOUNT_STATUS[me.data?.status] ?? me.data?.status ?? 'Đang hoạt động'}</span></dd></div>
                        </dl>
                    </section>
                </aside>
            </div>
        </>
    );
}
