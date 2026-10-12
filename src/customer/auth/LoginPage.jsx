import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../features/auth/AuthContext';
import { Roles } from '../../features/auth/roles';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import AuthShell, { PasswordInput } from './AuthShell.jsx';

const BENEFITS = [
    { icon: 'key', title: 'Personal access code', text: 'Open your unit 24/7 with a code that only you know.' },
    { icon: 'card', title: 'Pay & renew in seconds', text: 'Card, e-wallet or bank transfer — with automatic reminders.' },
    { icon: 'chat', title: 'Fast support', text: 'Report lock, access or payment issues and track the response.' },
];

export default function LoginPage() {
    const { login, logout } = useAuth();
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
                setError('This is a staff account. Please sign in at the Admin Portal.');
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
        <AuthShell title="Your storage, managed online." benefits={BENEFITS}>
            <h1>Welcome back</h1>
            <p className="se-auth-lead">Log in to manage your storage units, payments and requests.</p>
            <form className="se-form" onSubmit={submit}>
                <label>
                    <span>Email</span>
                    <div className="se-input"><Icon name="mail" size={16} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                    </div>
                </label>
                <label>
                    <span>Password</span>
                    <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
                </label>
                <div className="se-form-split">
                    <span />
                    <Link to="/forgot-password">Forgot password?</Link>
                </div>
                {error && <div className="se-alert" role="alert">{error}</div>}
                <button type="submit" className="se-btn se-btn-primary" disabled={submitting}>{submitting ? 'Logging in…' : 'Log in'}</button>
            </form>
            <p className="se-auth-switch">Don&apos;t have an account?<Link to="/register">Register now</Link></p>
            <div className="se-auth-note"><Icon name="shield" size={15} /><span>Staff &amp; admin accounts sign in at the <Link to="/admin/login">Admin Portal</Link>.</span></div>
        </AuthShell>
    );
}
