import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import AuthShell, { PasswordInput } from './AuthShell.jsx';
import { useT } from '../../i18n/I18n.jsx';

const BENEFITS = [
    { icon: 'key', title: 'Mã ra vào cá nhân', text: 'Mở cổng và kho của bạn bằng mã chỉ riêng bạn biết.' },
    { icon: 'card', title: 'Thanh toán và gia hạn nhanh', text: 'Xem hóa đơn, thanh toán trực tuyến và gia hạn ngay trong tài khoản.' },
    { icon: 'chat', title: 'Hỗ trợ kịp thời', text: 'Báo sự cố về khóa, mã ra vào hay thanh toán và theo dõi phản hồi.' },
];

export default function LoginPage() {
    const { login, logout } = useAuth();
    const t = useT();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setSubmitting(true);
        try {
            const session = await login(email, password);
            if (session.role !== Roles.StorageCustomer) {
                logout();
                setError(t('Đây là tài khoản nhân viên. Vui lòng đăng nhập ở Cổng quản trị.'));
                return;
            }
            navigate(location.state?.from ?? '/my-storage', { replace: true });
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <AuthShell title="Quản lý kho của bạn trực tuyến." benefits={BENEFITS}>
            <h1>{t('Chào mừng bạn trở lại')}</h1>
            <p className="se-auth-lead">{t('Đăng nhập để quản lý kho, hóa đơn và yêu cầu hỗ trợ.')}</p>
            <form className="se-form" onSubmit={submit}>
                <label>
                    <span>Email</span>
                    <div className="se-input"><Icon name="mail" size={16} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                    </div>
                </label>
                <label>
                    <span>{t('Mật khẩu')}</span>
                    <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </label>
                <div className="se-form-split">
                    <span />
                    <Link to="/forgot-password">{t('Quên mật khẩu?')}</Link>
                </div>
                {error && <div className="se-alert" role="alert">{error}</div>}
                <button type="submit" className="se-btn se-btn-primary" disabled={submitting}>{submitting ? t('Đang đăng nhập…') : t('Đăng nhập')}</button>
            </form>
            <p className="se-auth-switch">{t('Chưa có tài khoản?')}<Link to="/register">{t('Đăng ký ngay')}</Link></p>
            <div className="se-auth-note"><Icon name="shield" size={15} /><span>{t('Tài khoản nhân viên và quản trị đăng nhập tại')} <Link to="/admin/login">{t('Cổng quản trị')}</Link>.</span></div>
        </AuthShell>
    );
}
