import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './LoginAdmin.css'
import { login, restoreSession } from '../../auth.js'
import Logo from '../../assets/logo.svg'
import PeopleLogo from '../../assets/people.svg'
import Business from '../../assets/business.svg'
import Building from '../../assets/building.svg'
import Key from '../../assets/key.svg'

function LoginAdmin() {
    const navigate = useNavigate()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [keepSignedIn, setKeepSignedIn] = useState(false)

    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        let active = true
        restoreSession()
            .then(value => { if (active && value) navigate('/admin', { replace: true }) })
            .catch(error => { if (active) setErrorMessage(error.message) })
            .finally(() => { if (active) setChecking(false) })
        return () => { active = false }
    }, [navigate])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrorMessage('')
        setLoading(true)
        try {
            await login(email, password, keepSignedIn)
            setPassword('')
            navigate('/admin', { replace: true })
        } catch (error) {
            setErrorMessage(error.message)
        } finally {
            setLoading(false)
        }
    }

    if (checking) return <p role="status">Checking your session...</p>
    return (
        <div className="portal-container">
            {/* LEFT COLUMN: BRANDING & ROLE INFO */}
            <div className="left-panel">
                <div className="brand-header">
                    <img className="portal-logo" src={Logo} alt="StoreEase" />
                    <div>
                        <div className="brand-name">StorEase</div>
                        <div className="brand-subtitle">ADMIN PORTAL</div>
                    </div>
                </div>

                <div className="hero-section">
                    <h1 className="hero-title">Operate every facility from one place.</h1>
                    <p className="hero-desc">
                        Manage units, reservations, returns, contracts and revenue across all StoreEase locations.
                    </p>
                </div>

                {/* Role Information Cards */}
                <div className="role-cards-container">
                    <div className="role-card">
                        <div className="role-icon"><img className="portal-logo" src={PeopleLogo} alt="PeopleLogo" /></div>
                        <div className="role-details">
                            <h3>System Administrator</h3>
                            <p>Accounts, roles, permissions, activity logs</p>
                        </div>
                    </div>

                    <div className="role-card">
                        <div className="role-icon"><img className="portal-logo" src={Business} alt="BusinessLogo" /></div>
                        <div className="role-details">
                            <h3>Business Operations Manager</h3>
                            <p>Facilities, pricing policies, system-wide reports</p>
                        </div>
                    </div>

                    <div className="role-card">
                        <div className="role-icon"><img className="portal-logo" src={Building} alt="BuildingLogo" /></div>
                        <div className="role-details">
                            <h3>Facility Manager</h3>
                            <p>Units, contracts, staff assignment at one facility</p>
                        </div>
                    </div>

                    <div className="role-card">
                        <div className="role-icon"><img className="portal-logo" src={Key} alt="KeyLogo" /></div>
                        <div className="role-details">
                            <h3>Facility Staff</h3>
                            <p>Handover, check-ins, returns, on-site support</p>
                        </div>
                    </div>
                </div>

                <div className="footer-notice">
                    Access is restricted by role and assigned facility.
                </div>
            </div>

            {/* RIGHT COLUMN: SIGN IN FORM */}
            <div className="right-panel">
                <main className="form-wrapper">
                    <div className="badge">
                        <span className="dot"></span> Staff & Admin Portal
                    </div>

                    <h2 className="form-title">Sign in to your workspace</h2>
                    <p className="form-subtitle">Use the work account created by your System Administrator.</p>

                    <form onSubmit={handleSubmit} className="login-form">
                        {errorMessage && <p role="alert" style={{ color: '#b42318' }}>{errorMessage}</p>}
                        {/* Email Input Block */}
                        <div className="input-group">
                            <label htmlFor="email">Work email</label>
                            <div className="input-with-icon">
                                <input 
                                    type="email" 
                                    id="email" 
                                    placeholder="admin@storeease.vn"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required 
                                />
                            </div>
                        </div>

                        {/* Password Input Block */}
                        <div className="input-group">
                            <label htmlFor="password">Password</label>
                            <div className="input-with-icon">
                                <input 
                                    type={showPassword ? 'text' : 'password'} 
                                    id="password" 
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required 
                                />
                                <button type="button" className="password-toggle" aria-label={showPassword ? 'Hide password' : 'Show password'} aria-pressed={showPassword} onClick={() => setShowPassword(value => !value)}>
                                    <svg aria-hidden="true" viewBox="0 0 24 24"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>{showPassword&&<path d="m4 4 16 16"/>}</svg>
                                </button>
                            </div>
                        </div>

                        <div className="form-options">
                            <label className="checkbox-container">
                                <input 
                                    type="checkbox" 
                                    checked={keepSignedIn}
                                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                                />
                                <span className="checkmark"></span> Keep me signed in
                            </label>
                            <span className="forgot-link">Contact your administrator for password help.</span>
                        </div>

                        {/* Submit Action */}
                        <button type="submit" className="btn-signin" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</button>
                    </form>

                    {/* Warning/Security Banner */}
                    <div className="security-banner">
                        <span className="shield-icon">🛡️</span>
                        <p>Sign in with your active staff account. Your session expires automatically; log out when using a shared computer.</p>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default LoginAdmin


