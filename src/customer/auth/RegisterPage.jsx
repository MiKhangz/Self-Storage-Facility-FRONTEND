import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { authApi } from '../../api/generated';
import { errorMessage } from '../../api/axiosClient';
import Icon from '../components/Icon.jsx';
import AuthShell, { PasswordInput } from './AuthShell.jsx';

const BENEFITS = [
    { icon: 'grid', title: 'Reserve any unit online', text: 'See real-time availability at all 8 facilities.' },
    { icon: 'file', title: 'Digital rental contract', text: 'Sign, view and download your contract anytime.' },
    { icon: 'building', title: 'Manage multiple units', text: 'Rent and track several units under one account.' },
];

const EMPTY = { fullName: '', phoneNumber: '', email: '', password: '', confirm: '', agreed: false };

/** Field errors shown under each input; empty object means the form can be sent. */
export function validateRegister(f) {
    const errors = {};
    if (!f.fullName.trim()) errors.fullName = 'Enter your full name';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) errors.email = 'Enter a valid email address';
    if (!/^0\d{9}$/.test(f.phoneNumber.replace(/\s/g, ''))) errors.phoneNumber = 'Enter a 10-digit phone number starting with 0';
    if (f.password.length < 8 || !/\d/.test(f.password)) errors.password = 'At least 8 characters, 1 number';
    if (f.confirm !== f.password) errors.confirm = 'Passwords do not match';
    if (!f.agreed) errors.agreed = 'Please accept the terms to continue';
    return errors;
}

export default function RegisterPage() {
    const [form, setForm] = useState(EMPTY);
    const [touched, setTouched] = useState(false);
    const register = useMutation({
        mutationFn: () => authApi.register({ fullName: form.fullName.trim(), email: form.email.trim(), phoneNumber: form.phoneNumber.replace(/\s/g, ''), password: form.password }),
    });
    const set = (key) => (e) => setForm({ ...form, [key]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
    const errors = validateRegister(form);
    const show = (key) => touched && errors[key];

    const submit = (e) => {
        e.preventDefault();
        setTouched(true);
        if (Object.keys(errors).length) return;
        register.mutate();
    };

    return (
        <AuthShell wide title="Create your account in 1 minute." benefits={BENEFITS}>
            <Link to="/login" className="se-back"><Icon name="arrowLeft" size={16} /> Back to login</Link>
            <h1>Create an account</h1>
            <p className="se-auth-lead">Register as a Storage Customer to reserve and manage units.</p>
            <form className="se-form" onSubmit={submit} noValidate>
                <div className="se-form-row">
                    <label><span>Full name *</span>
                        <div className={`se-input${show('fullName') ? ' invalid' : ''}`}><input value={form.fullName} onChange={set('fullName')} autoComplete="name" required /></div>
                        {show('fullName') && <p className="se-hint error">{errors.fullName}</p>}
                    </label>
                    <label><span>Phone number *</span>
                        <div className={`se-input${show('phoneNumber') ? ' invalid' : ''}`}><input type="tel" value={form.phoneNumber} onChange={set('phoneNumber')} placeholder="0901 234 567" autoComplete="tel" required /></div>
                        {show('phoneNumber') && <p className="se-hint error">{errors.phoneNumber}</p>}
                    </label>
                </div>
                <label><span>Email *</span>
                    <div className={`se-input${show('email') ? ' invalid' : ''}`}><Icon name="mail" size={16} /><input type="email" value={form.email} onChange={set('email')} autoComplete="email" required /></div>
                    {show('email') && <p className="se-hint error">{errors.email}</p>}
                </label>
                <div className="se-form-row">
                    <label><span>Password *</span>
                        <PasswordInput value={form.password} onChange={set('password')} invalid={show('password')} autoComplete="new-password" />
                        <p className={`se-hint${show('password') ? ' error' : ''}`}>At least 8 characters, 1 number</p>
                    </label>
                    <label><span>Confirm password *</span>
                        <PasswordInput value={form.confirm} onChange={set('confirm')} invalid={(touched || form.confirm) && errors.confirm} autoComplete="new-password" />
                        {(touched || form.confirm) && errors.confirm && <p className="se-hint error">{errors.confirm}</p>}
                    </label>
                </div>
                <label className="se-check">
                    <input type="checkbox" checked={form.agreed} onChange={set('agreed')} />
                    <span>I agree to the <Link to="/terms">Terms of Rental</Link> and <Link to="/prohibited-items">Prohibited Items policy</Link></span>
                </label>
                {show('agreed') && <p className="se-hint error">{errors.agreed}</p>}
                {register.isError && <div className="se-alert" role="alert">{errorMessage(register.error)}</div>}
                {register.isSuccess && (
                    <div className="se-alert info" role="status">
                        {register.data.status === 'Active'
                            ? <>Account created. <Link to="/login">Log in now</Link>.</>
                            : <>Account created. Open the link we emailed to {register.data.email} to activate it, then log in.</>}
                    </div>
                )}
                <button type="submit" className="se-btn se-btn-primary" disabled={register.isPending || register.isSuccess}>
                    {register.isPending ? 'Creating account…' : 'Create account'}
                </button>
            </form>
            <p className="se-auth-switch">Already have an account?<Link to="/login">Log in</Link></p>
        </AuthShell>
    );
}
