import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import Icon from '../components/Icon.jsx';
import { PasswordInput } from './AuthShell.jsx';
import './ForgotPasswordPage.css';

// ponytail: the backend has no password-reset endpoints yet. Replace these two with authApi calls once
// POST /api/auth/forgot-password and POST /api/auth/reset-password exist; the screens already handle success.
const NOT_READY = 'Password reset is not available online yet. Please contact support at 028 7300 1234.';
const requestReset = async () => { throw new Error(NOT_READY); };
const saveNewPassword = async () => { throw new Error(NOT_READY); };

function maskEmail(email) {
    const [name, domain] = email.split('@');
    return domain ? `${name.slice(0, 2)}•••@${domain}` : email;
}

function RequestStep({ onSent }) {
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
            setError(err.message);
        } finally {
            setBusy(false);
        }
    };

    return (
        <>
            <span className="se-step-pill">Step 1 · Request link</span>
            <span className="se-reset-icon"><Icon name="lock" size={22} /></span>
            <h1>Forgot your password?</h1>
            <p className="se-auth-lead">Enter the email on your account. We will send a reset link valid for 30 minutes.</p>
            <form className="se-form" onSubmit={submit}>
                <label><span>Email</span>
                    <div className="se-input"><Icon name="mail" size={16} />
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                    </div>
                </label>
                {error && <div className="se-alert" role="alert">{error}</div>}
                <button type="submit" className="se-btn se-btn-primary" disabled={busy}>Send reset link</button>
            </form>
            <Link to="/login" className="se-back se-reset-back"><Icon name="arrowLeft" size={16} /> Back to login</Link>
        </>
    );
}

function SentStep({ email }) {
    return (
        <>
            <span className="se-step-pill blue">Step 2 · Check email</span>
            <span className="se-reset-icon blue"><Icon name="mail" size={22} /></span>
            <h1>Check your email</h1>
            <p className="se-auth-lead">We sent a reset link to {maskEmail(email)}. The link expires in 30 minutes and can be used once.</p>
            <div className="se-auth-note">No email after a few minutes? Check the spam folder.</div>
        </>
    );
}

function NewPasswordStep({ token }) {
    const [password, setPassword] = useState('');
    const [confirm, setConfirm] = useState('');
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);
    const rules = [
        ['At least 8 characters', password.length >= 8],
        ['Contains a number', /\d/.test(password)],
        ['Contains an upper-case letter', /[A-Z]/.test(password)],
    ];

    const submit = async (e) => {
        e.preventDefault();
        setError('');
        if (rules.some(([, ok]) => !ok)) return setError('The new password does not meet every rule below.');
        if (password !== confirm) return setError('Passwords do not match.');
        try {
            await saveNewPassword(token, password);
            setDone(true);
        } catch (err) {
            setError(err.message);
        }
    };

    if (done) return (
        <>
            <h1>Password updated</h1>
            <p className="se-auth-lead">You can now log in with your new password.</p>
            <Link to="/login" className="se-btn se-btn-primary se-btn-block">Go to login</Link>
        </>
    );

    return (
        <>
            <span className="se-step-pill green">Step 3 · New password</span>
            <span className="se-reset-icon green"><Icon name="key" size={22} /></span>
            <h1>Set a new password</h1>
            <form className="se-form" onSubmit={submit}>
                <label><span>New password</span>
                    <PasswordInput value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
                </label>
                <label><span>Confirm new password</span>
                    <PasswordInput value={confirm} onChange={(e) => setConfirm(e.target.value)} invalid={confirm && confirm !== password} autoComplete="new-password" />
                </label>
                <ul className="se-rules">
                    {rules.map(([label, ok]) => <li key={label} className={ok ? 'ok' : ''}><Icon name="check" size={14} />{label}</li>)}
                </ul>
                {error && <div className="se-alert" role="alert">{error}</div>}
                <button type="submit" className="se-btn se-btn-primary">Save new password</button>
            </form>
            <p className="se-hint se-reset-foot">You will be signed out on all other devices.</p>
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
