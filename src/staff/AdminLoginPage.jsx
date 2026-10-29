import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../features/auth/AuthContext';
import { ADMIN_PORTAL_ROLES } from '../features/auth/roles';
import { errorMessage } from '../api/axiosClient';
import Icon from '../customer/components/Icon.jsx';
import { PasswordInput } from '../customer/auth/AuthShell.jsx';
import '../customer/layout/CustomerLayout.css';
import './Admin.css';
import './AdminLogin.css';
import { useT } from '../i18n/I18n.jsx';

const ROLES = [
    { icon: 'shield', title: 'System Administrator', text: 'Accounts, roles, permissions, activity logs' },
    { icon: 'grid', title: 'Business Operations Manager', text: 'Facilities, pricing policies, system-wide reports' },
    { icon: 'building', title: 'Facility Manager', text: 'Units, contracts, staff assignment at one facility' },
    { icon: 'key', title: 'Facility Staff', text: 'Handover, check-ins, returns, on-site support' },
];

/** A01: staff and admin sign-in. Customers are turned away to the customer site. */
export default function AdminLoginPage() {
    const tr = useT();
    const { login, logout } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        setBusy(true);
        try {
            const session = await login(email, password);
            if (!ADMIN_PORTAL_ROLES.includes(session.role)) {
                logout();
                setError(tr('This portal is for staff accounts. Customers sign in on the customer site.'));
                return;
            }
            navigate(location.state?.from ?? '/admin', { replace: true });
        } catch (err) {
            setError(errorMessage(err));
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="se-page sa-login">
            <aside className="sa-login-side">
                <div className="sa-brand">
                    <span className="se-brand-mark"><Icon name="box" size={18} /></span>
                    <div><span className="se-brand-name">Stor<span>Ease</span></span><small>{tr('ADMIN PORTAL')}</small></div>
                </div>
                <div>
                    <h1>{tr('Operate every facility from one place.')}</h1>
                    <p>{tr('Manage units, reservations, returns, contracts and revenue across all StorEase locations.')}</p>
                    <ul>
                        {ROLES.map((r) => (
                            <li key={r.title}><Icon name={r.icon} size={16} /><div><strong>{tr(r.title)}</strong><small>{tr(r.text)}</small></div></li>
                        ))}
                    </ul>
                </div>
                <small>{tr('Access is restricted by role and assigned facility. SWP391 student project — not a real service.')}</small>
            </aside>
            <main className="sa-login-main">
                <form className="se-form sa-login-form" onSubmit={submit}>
                    <span className="se-pill">Staff &amp; Admin Portal</span>
                    <h2>{tr('Sign in to your workspace')}</h2>
                    <p className="sa-muted">{tr('Use the work account created by your System Administrator.')}</p>
                    <label><span className="se-label">{tr('Work email')}</span>
                        <div className="se-input"><Icon name="mail" size={16} /><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username" required /></div>
                    </label>
                    <label><span className="se-label">{tr('Password')}</span>
                        <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                    </label>
                    {error && <div className="se-alert" role="alert">{error}</div>}
                    <button type="submit" className="se-btn se-btn-primary se-btn-block se-btn-lg" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
                    <div className="se-auth-note"><Icon name="shield" size={15} /><span>{tr('All sign-ins are recorded. Forgot your password? Ask your System Administrator.')}</span></div>
                    <Link to="/" className="se-back"><Icon name="arrowLeft" size={16} /> {tr('Renting storage? Go to the customer site')}</Link>
                </form>
            </main>
        </div>
    );
}
