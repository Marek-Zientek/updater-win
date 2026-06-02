import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'

export function Register() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Hasła nie są identyczne.')
      return
    }

    const res = await window.api.auth.register({ email, password, name })
    if (res.success) {
      navigate('/login', {
        state: { successMessage: 'Konto zostało utworzone pomyślnie. Możesz się teraz zalogować.' }
      })
    } else {
      setError(res.error || 'Wystąpił nieznany błąd podczas rejestracji.')
    }
  }

  return (
    <div className="flex items-center justify-center" style={{ height: '100vh', width: '100vw' }}>
      <div className="glass-panel" style={{ padding: '48px', width: '100%', maxWidth: '420px' }}>
        <div className="flex flex-col items-center gap-md" style={{ marginBottom: '32px' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              background: 'var(--color-primary)',
              borderRadius: '16px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px var(--color-primary-glow)'
            }}
          >
            <span style={{ color: 'var(--color-bg-main)', fontWeight: 'bold', fontSize: '32px' }}>
              U
            </span>
          </div>
          <h1 className="text-gradient" style={{ margin: 0, fontSize: '32px' }}>
            UpdaterWin
          </h1>
          <p className="text-muted">Utwórz konto administratora</p>
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

          <div className="flex flex-col gap-sm">
            <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Imię / Nazwa administratora
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="input-field"
              placeholder="Janusz"
            />
          </div>

          <div className="flex flex-col gap-sm">
            <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="input-field"
              placeholder="admin@example.com"
            />
          </div>

          <div className="flex flex-col gap-sm">
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

          <div className="flex flex-col gap-sm" style={{ marginBottom: '16px' }}>
            <label style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
              Potwierdź hasło
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="input-field"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', padding: '12px' }}
          >
            Zarejestruj się
          </button>

          <p
            className="text-muted"
            style={{ textAlign: 'center', fontSize: '14px', marginTop: '16px' }}
          >
            Masz już konto?{' '}
            <Link to="/login" style={{ color: 'var(--color-primary)', textDecoration: 'none' }}>
              Zaloguj się
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
