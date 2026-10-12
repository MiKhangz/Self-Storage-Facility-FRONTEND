import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../../features/auth/AuthContext'
import { ADMIN_PORTAL_ROLES } from '../../../features/auth/roles'
import { errorMessage as apiErrorMessage } from '../../../api/axiosClient'
import './LoginAdmin.css'
import Logo from '../../assets/logo.svg'
import PeopleLogo from '../../assets/people.svg'
import Business from '../../assets/business.svg'
import Building from '../../assets/building.svg'
import Key from '../../assets/key.svg'

function LoginAdmin() {
    const { login, logout } = useAuth()
    const navigate = useNavigate()
    const location = useLocation()

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    // The token is held in memory only, so this checkbox cannot keep anyone signed in across a reload yet.
    const [keepSignedIn, setKeepSignedIn] = useState(false)

    const [submitting, setSubmitting] = useState(false)
    const [errorMessage, setErrorMessage] = useState('')

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrorMessage('')
        setSubmitting(true)
        try {
            const session = await login(email, password)
            if (!ADMIN_PORTAL_ROLES.includes(session.role)) {
                logout()
                setErrorMessage('This portal is for staff accounts. Customers sign in on the customer site.')
                return
            }
            navigate(location.state?.from ?? '/admin', { replace: true })
        } catch (error) {
            setErrorMessage(apiErrorMessage(error))
        } finally {
            setSubmitting(false)
        }
    }

    
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
                        Manage units, reservations, handovers, contracts and revenue across all StoreEase locations.
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
                            <p>Check-in, handover, returns, on-site support</p>
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
                        {/* Email Input Block */}
                        <div className="input-group">
                            <label htmlFor="email">Work email</label>
                            <div className="input-with-icon">
                                <input 
                                    type="email" 
                                    id="email" 
                                    placeholder="admin@storease.vn"
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
                                    type="password" 
                                    id="password" 
                                    placeholder="••••••••"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    required 
                                />
                            </div>
                        </div>

                        {/* Options: Remember Me & Forgot Password */}
                        <div className="form-options">
                            <label className="checkbox-container">
                                <input 
                                    type="checkbox" 
                                    checked={keepSignedIn}
                                    onChange={(e) => setKeepSignedIn(e.target.checked)}
                                />
                                <span className="checkmark"></span> Keep me signed in
                            </label>
                            <a href="#forgot" className="forgot-link">Forgot password?</a>
                        </div>

                        {/* Submit Action */}
                        {errorMessage && <p className="form-error" role="alert">{errorMessage}</p>}
                        <button type="submit" className="btn-signin" disabled={submitting}>
                            {submitting ? 'Signing in…' : 'Sign in'}
                        </button>
                    </form>

                    {/* Warning/Security Banner */}
                    <div className="security-banner">
                        <span className="shield-icon">🛡️</span>
                        <p>After 5 failed attempts the account is locked for 15 minutes. All sign-ins are recorded in the login history.</p>
                    </div>
                </main>
            </div>
        </div>
    )
}

export default LoginAdmin
