import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import DashboardLayout from './dashboard/DashboardLayout.jsx'
import { clearSession, restoreSession } from './auth.js'

export default function AdminPortal() {
  const navigate = useNavigate()
  const [session, setSession] = useState(null)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    let active = true
    restoreSession()
      .then(user => {
        if (!active) return
        if (user) setSession(user)
        else navigate('/admin/login', { replace: true })
      })
      .catch(() => { if (active) navigate('/admin/login', { replace: true }) })
      .finally(() => { if (active) setChecking(false) })
    return () => { active = false }
  }, [navigate])

  useEffect(() => {
    if (!session?.token) return
    try {
      const payload = JSON.parse(atob(session.token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
      const timer = setTimeout(() => {
        clearSession()
        setSession(null)
        navigate('/admin/login', { replace: true })
      }, Math.max(0, payload.exp * 1000 - Date.now()))
      return () => clearTimeout(timer)
    } catch {
      clearSession()
      setSession(null)
      navigate('/admin/login', { replace: true })
    }
  }, [navigate, session])

  if (checking || !session) return <p role="status">Checking your staff session…</p>
  return <DashboardLayout onLogOut={() => { clearSession(); setSession(null); navigate('/admin/login', { replace: true }) }} user={session} />
}
