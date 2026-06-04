import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import appIcon from '../assets/icon.png'

export function Login({ onLogin }: { onLogin: (userData: any) => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()
  const successMessage = location.state?.successMessage

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const res = await window.api.auth.login({ email, password, rememberMe })

    if (res.success) {
      localStorage.setItem('auth_token', res.token)
      onLogin(res.user)
    } else {
      setError(res.error || 'Wystąpił błąd podczas logowania.')
    }
  }

  return (
    <div className="flex items-center justify-center" style={{ height: '100vh', width: '100vw' }}>
      <div className="glass-panel" style={{ padding: '48px', width: '100%', maxWidth: '420px' }}>
        <div className="flex flex-col items-center gap-md" style={{ marginBottom: '32px' }}>
          <img
            src={appIcon}
            alt="CorePulse Logo"
            style={{
              width: '64px',
              height: '64px',
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 12px var(--color-primary-glow))'
            }}
          />
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '32px' }}>
            CorePulse
          </h1>
          <p className="text-muted">Zaloguj się do swojego konta</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-md">
          {error && (
            <div
              style={{
                color: 'var(--color-error)',
                background: 'rgba(255,0,0,0.1)',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              {error}
            </div>
          )}
          {successMessage && (
            <div
              style={{
                color: '#10b981',
                background: 'rgba(16,185,129,0.1)',
                padding: '8px 12px',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            >
              {successMessage}
            </div>
          )}

          <div className="flex flex-col gap-sm">
            <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
              className="input-field"
              placeholder="admin@example.com"
            />
          </div>

          <div className="flex flex-col gap-sm" style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Hasło</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          <div
            className="flex items-center gap-sm"
            style={{ marginBottom: '20px', userSelect: 'none', cursor: 'pointer' }}
            onClick={() => setRememberMe(!rememberMe)}
          >
            <input
              type="checkbox"
              checked={rememberMe}
              onChange={() => {}} // click handles it
              style={{
                cursor: 'pointer',
                accentColor: 'var(--color-primary)',
                width: '16px',
                height: '16px'
              }}
            />
            <span style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              Zapamiętaj mnie na tym urządzeniu
            </span>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px', cursor: 'pointer' }}
          >
            Zaloguj się
          </button>

          <p
            className="text-muted"
            style={{ textAlign: 'center', fontSize: '14px', marginTop: '16px' }}
          >
            Nie masz jeszcze konta?{' '}
            <Link to="/register" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
              Zarejestruj się
            </Link>
          </p>
        </form>
      </div>

      <style>{`
        .input-field {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: var(--border-radius-sm);
          padding: 12px 16px;
          color: var(--color-text-primary);
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition: border-color var(--transition-fast);
        }
        .input-field:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 1px var(--color-primary);
        }
      `}</style>
    </div>
  )
}
