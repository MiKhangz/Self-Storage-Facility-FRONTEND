import { useEffect, useState } from 'react'
import './LoginAdmin.css'
import DashboardLayout from '../../dashboard/DashboardLayout.jsx'
import { login, restoreSession, clearSession } from '../../auth.js'
import Logo from '../../assets/logo.svg'
import PeopleLogo from '../../assets/people.svg'
import Business from '../../assets/business.svg'
import Building from '../../assets/building.svg'
import Key from '../../assets/key.svg'

function LoginAdmin() {

    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [keepSignedIn, setKeepSignedIn] = useState(false)

    const [session, setSession] = useState(null)
    const [loading, setLoading] = useState(false)
    const [checking, setChecking] = useState(true)
    const [errorMessage, setErrorMessage] = useState('')

    useEffect(() => {
        let active = true
        restoreSession()
            .then(value => { if (active) setSession(value) })
            .catch(error => { if (active) setErrorMessage(error.message) })
            .finally(() => { if (active) setChecking(false) })
        return () => { active = false }
    }, [])

    const handleSubmit = async (e) => {
        e.preventDefault()
        setErrorMessage('')
        setLoading(true)
        try {
            setSession(await login(email, password, keepSignedIn))
            setPassword('')
        } catch (error) {
            setErrorMessage(error.message)
        } finally {
            setLoading(false)
        }
    }

    const handleLogout = () => {
        clearSession()
        setSession(null)
        setPassword('')
        setErrorMessage('')
    }

    useEffect(() => {
        if (!session) return
        try {
            const payload = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
            const remaining = payload.exp * 1000 - Date.now()
            const timer = setTimeout(() => {
                clearSession()
                setSession(null)
                setErrorMessage('Your session expired. Please sign in again.')
            }, Math.max(0, remaining))
            return () => clearTimeout(timer)
        } catch {
            clearSession()
            setSession(null)
        }
    }, [session])

    if (checking) return <p role="status">Checking your session...</p>
    if (session) return <DashboardLayout onLogOut={handleLogout} user={session} />
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


