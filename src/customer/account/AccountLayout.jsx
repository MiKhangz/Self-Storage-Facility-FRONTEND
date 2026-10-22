import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import { initials } from '../layout/CustomerLayout.jsx';
import './AccountLayout.css';

const LINKS = [
    { to: '/my-storage', icon: 'grid', label: 'Kho của tôi' },
    { to: '/payments', icon: 'card', label: 'Thanh toán và hóa đơn' },
    { to: '/support/requests', icon: 'chat', label: 'Yêu cầu hỗ trợ' },
    { to: '/return', icon: 'arrowLeft', label: 'Trả kho' },
    { to: '/profile', icon: 'key', label: 'Hồ sơ và cài đặt' },
];

/** Left sidebar shared by the signed-in customer pages (U09, U13–U16). */
export default function AccountLayout() {
    const { session, logout } = useAuth();
    const navigate = useNavigate();

    return (
        <div className="se-account-page">
            <div className="se-container se-account-grid">
                <aside className="se-account-side">
                    <div className="se-account-who">
                        <span className="se-avatar lg">{initials(session?.fullName)}</span>
                        <div><strong>{session?.fullName}</strong><small>Khách thuê kho</small></div>
                    </div>
                    <nav aria-label="Tài khoản">
                        {LINKS.map((l) => (
                            <NavLink key={l.to} to={l.to}><Icon name={l.icon} size={17} />{l.label}</NavLink>
                        ))}
                        <button type="button" onClick={() => { logout(); navigate('/', { replace: true }); }}>
                            <Icon name="arrowLeft" size={17} />Đăng xuất
                        </button>
                    </nav>
                </aside>
                <div className="se-account-main"><Outlet /></div>
            </div>
        </div>
    );
}
