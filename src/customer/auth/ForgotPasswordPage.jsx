import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import { PasswordInput } from './AuthShell.jsx';
import { useT } from '../../i18n/I18n.jsx';
import './ForgotPasswordPage.css';

const requestReset = (email) => authApi.forgotPassword({ email });
const saveNewPassword = (token, newPassword) => authApi.resetPassword({ token, newPassword });

function maskEmail(email) {
    const [name, domain] = email.split('@');
    return domain ? `${name.slice(0, 2)}•••@${domain}` : email;
}

function RequestStep({ onSent }) {
    const t = useT();
    const [email, setEmail] = useState('');
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            await requestReset(email);
            onSent(email);
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <span className="se-step-pill">{t('Bước 1 · Nhận liên kết')}</span>
            <span className="se-reset-icon"><Icon name="lock" size={22} /></span>
            <h1>{t('Quên mật khẩu?')}</h1>
            <p className="se-auth-lead">{t('Nhập email của tài khoản. Chúng tôi sẽ gửi liên kết đặt lại mật khẩu, có hiệu lực trong 30 phút.')}</p>
            <form className="se-form" onSubmit={submit}>
                <label><span>Email</span>
                    <div className="se-input"><Icon name="mail" size={16} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                    </div>
                </label>
                {error && <div className="se-alert" role="alert">{error}</div>}
                <button type="submit" className="se-btn se-btn-primary" disabled={busy}>{busy ? t('Đang gửi…') : t('Gửi liên kết đặt lại')}</button>
            </form>
            <Link to="/login" className="se-back se-reset-back"><Icon name="arrowLeft" size={16} /> {t('Quay lại đăng nhập')}</Link>
        </>
    );
}

function SentStep({ email }) {
    const t = useT();
    return (
        <>
            <span className="se-step-pill blue">{t('Bước 2 · Kiểm tra email')}</span>
            <span className="se-reset-icon blue"><Icon name="mail" size={22} /></span>
            <h1>{t('Kiểm tra email của bạn')}</h1>
            <p className="se-auth-lead">{t('Nếu {email} có tài khoản, chúng tôi đã gửi liên kết đặt lại mật khẩu tới đó. Liên kết hết hạn sau 30 phút và chỉ dùng được một lần.', { email: maskEmail(email) })}</p>
            <div className="se-auth-note">{t('Vài phút chưa thấy email? Hãy xem trong thư mục Spam.')}</div>
        </>
    );
}

function NewPasswordStep({ token }) {
    const t = useT();
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const rules = [
        // The backend's rule: at least 8 characters with a letter and a digit.
        ['Ít nhất 8 ký tự', password.length >= 8],
        ['Có ít nhất một chữ cái', /[A-Za-z]/.test(password)],
        ['Có ít nhất một chữ số', /\d/.test(password)],
    ];

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (rules.some(([, ok]) => !ok)) return setError(t('Mật khẩu mới chưa đáp ứng đủ các yêu cầu bên dưới.'));
        if (password !== confirm) return setError(t('Mật khẩu nhập lại không khớp.'));
        try {
            await saveNewPassword(token, password);
            setDone(true);
        } catch (err) {
            setError(errorMessage(err));
        }
    };

    if (done) return (
        <>
            <h1>{t('Đã đổi mật khẩu')}</h1>
            <p className="se-auth-lead">{t('Bạn có thể đăng nhập bằng mật khẩu mới.')}</p>
            <Link to="/login" className="se-btn se-btn-primary se-btn-block">{t('Đến trang đăng nhập')}</Link>
        </>
    );

    return (
        <>
            <span className="se-step-pill green">{t('Bước 3 · Mật khẩu mới')}</span>
            <span className="se-reset-icon green"><Icon name="key" size={22} /></span>
            <h1>{t('Đặt mật khẩu mới')}</h1>
            <form className="se-form" onSubmit={submit}>
                <label><span>{t('Mật khẩu mới')}</span>
                    <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </label>
                <label><span>{t('Nhập lại mật khẩu mới')}</span>
                    <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={confirm && confirm !== password} autoComplete="new-password" />
                </label>
                <ul className="se-rules">
                    {rules.map(([label, ok]) => <li key={label} className={ok ? 'ok' : ''}><Icon name="check" size={14} />{t(label)}</li>)}
                </ul>
                {error && <div className="se-alert" role="alert">{error}</div>}
                <button type="submit" className="se-btn se-btn-primary">{t('Lưu mật khẩu mới')}</button>
            </form>
            <p className="se-hint se-reset-foot">{t('Bạn sẽ bị đăng xuất trên mọi thiết bị khác.')}</p>
        </>
    );
}

export default function ForgotPasswordPage() {
    const [params] = useSearchParams();
    const token = params.get('token');
    const [sentTo, setSentTo] = useState('');

    return (
        <div className="se-auth-bg">
            <div className="se-reset-card">
                {token ? <NewPasswordStep token={token} />
                    : sentTo ? <SentStep email={sentTo} />
                        : <RequestStep onSent={setSentTo} />}
            </div>
        </div>
    );
}
