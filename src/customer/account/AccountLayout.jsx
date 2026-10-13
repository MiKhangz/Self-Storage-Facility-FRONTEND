import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import Icon from '../components/Icon.jsx';
import { initials } from '../layout/CustomerLayout.jsx';
import './AccountLayout.css';

const LINKS = [
    { to: '/my-storage', icon: 'grid', label: 'My units' },
    { to: '/payments', icon: 'card', label: 'Payments & invoices' },
    { to: '/support/requests', icon: 'chat', label: 'Support requests' },
    { to: '/move-out', icon: 'arrowLeft', label: 'Move-out' },
    { to: '/profile', icon: 'key', label: 'Profile & settings' },
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
                        <div><strong>{session?.fullName}</strong><small>Storage customer</small></div>
                    </div>
                    <nav>
                        {LINKS.map((l) => (
                            <NavLink key={l.to} to={l.to}><Icon name={l.icon} size={17} />{l.label}</NavLink>
                        ))}
                        <button type="button" onClick={() => { logout(); navigate('/', { replace: true }); }}>
                            <Icon name="arrowLeft" size={17} />Log out
                        </button>
                    </nav>
                </aside>
                <div className="se-account-main"><Outlet /></div>
            </div>
        </div>
    );
}
