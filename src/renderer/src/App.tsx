import { HashRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'

import { Layout } from './layouts/Layout'
import { Login } from './pages/Login'
import { Register } from './pages/Register'
import { Dashboard } from './pages/Dashboard'
import { SoftwareList } from './pages/SoftwareList'
import HardwareInfo from './pages/HardwareInfo'
import { AppDetails } from './pages/AppDetails'
import { Settings } from './pages/Settings'
import { Performance } from './pages/Performance'
import { Optimizer } from './pages/Optimizer'
import { Backup } from './pages/Backup'
import { Bloatware } from './pages/Bloatware'
import { Network } from './pages/Network'
import { Peripherals } from './pages/Peripherals'
import { PerformanceHUD } from './pages/PerformanceHUD'
import { MultiInstaller } from './pages/MultiInstaller'

export default function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [user, setUser] = useState<{ id: number; email: string; name: string | null } | null>(null)
  const [loading, setLoading] = useState(true)

  // Odtwarzanie sesji
  useEffect(() => {
    const token = localStorage.getItem('auth_token')
    if (token) {
      window.api.auth
        .verifySession(token)
        .then((res: any) => {
          if (res.success && res.user) {
            setUser(res.user)
            setIsAuthenticated(true)
          } else {
            localStorage.removeItem('auth_token')
            setIsAuthenticated(false)
            setUser(null)
          }
        })
        .catch(() => {
          localStorage.removeItem('auth_token')
          setIsAuthenticated(false)
          setUser(null)
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setLoading(false)
    }
  }, [])

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-[#0d0f14] text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent"></div>
          <p className="text-sm font-medium text-gray-400">Weryfikowanie sesji...</p>
        </div>
      </div>
    )
  }

  return (
    <HashRouter>
      <Routes>
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              <Navigate to="/" />
            ) : (
              <Login
                onLogin={(userData) => {
                  setUser(userData)
                  setIsAuthenticated(true)
                }}
              />
            )
          }
        />
        <Route path="/register" element={isAuthenticated ? <Navigate to="/" /> : <Register />} />
        <Route path="/overlay" element={<PerformanceHUD />} />

        {/* Protected routes */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              <Layout
                user={user}
                onLogout={() => {
                  const token = localStorage.getItem('auth_token')
                  if (token) {
                    window.api.auth.logout(token).catch(console.error)
                  }
                  localStorage.removeItem('auth_token')
                  setIsAuthenticated(false)
                  setUser(null)
                }}
              />
            ) : (
              <Navigate to="/login" />
            )
          }
        >
          <Route index element={<Dashboard />} />
          <Route path="software" element={<SoftwareList />} />
          <Route path="software/:id" element={<AppDetails />} />
          <Route path="hardware" element={<HardwareInfo />} />
          <Route path="performance" element={<Performance />} />
          <Route path="optimizer" element={<Optimizer />} />
          <Route path="bloatware" element={<Bloatware />} />
          <Route path="network" element={<Network />} />
          <Route path="peripherals" element={<Peripherals />} />
          <Route path="backup" element={<Backup />} />
          <Route path="settings" element={<Settings />} />
          <Route path="multi-installer" element={<MultiInstaller />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}
