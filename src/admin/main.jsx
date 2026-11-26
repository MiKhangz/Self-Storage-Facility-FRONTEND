import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import LoginAdmin from './loginPage/adminPage/LoginAdmin.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LoginAdmin />
  </StrictMode>,
)
