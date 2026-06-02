import React, { useState, useEffect } from 'react'
import {
  Sliders,
  Play,
  StopCircle,
  RefreshCw,
  Search,
  CheckCircle,
  AlertTriangle,
  Info,
  Power,
  Shield,
  Activity,
  Gamepad,
  Lock
} from 'lucide-react'

interface StartupApp {
  rawName: string
  name: string
  command: string
  enabled: boolean
  location: string
}

interface SystemService {
  name: string
  displayName: string
  status: 'running' | 'stopped'
  startupType: 'automatic' | 'manual' | 'disabled'
  description: string
  category: 'telemetry' | 'performance' | 'gaming' | 'security' | 'other'
  safety: 'safe' | 'caution' | 'critical'
  recommended: 'disable' | 'manual' | 'enable'
  isCurated: boolean
}

export default function ServicesManager(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'startup' | 'services'>('startup')

  // Startup States
  const [startupApps, setStartupApps] = useState<StartupApp[]>([])
  const [loadingStartup, setLoadingStartup] = useState(false)
  const [searchStartup, setSearchStartup] = useState('')

  // Services States
  const [services, setServices] = useState<SystemService[]>([])
  const [loadingServices, setLoadingServices] = useState(false)
  const [searchService, setSearchService] = useState('')
  const [filterCategory, setFilterCategory] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [filterStartup, setFilterStartup] = useState<string>('all')

  // UI notifications
  const [message, setMessage] = useState<{
    text: string
    type: 'success' | 'error' | 'info'
  } | null>(null)
  const [actionInProgress, setActionInProgress] = useState<string | null>(null)

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success'): void => {
    setMessage({ text, type })
    setTimeout(() => {
      setMessage(null)
    }, 5000)
  }

  // --- STARTUP LOGIC ---
  const loadStartupApps = async (): Promise<void> => {
    setLoadingStartup(true)
    try {
      const res = await window.api.getStartupApps()
      if (res.success && Array.isArray(res.data)) {
        setStartupApps(res.data)
      } else {
        showToast('Nie udało się wczytać autostartu.', 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('Błąd pobierania danych autostartu.', 'error')
    } finally {
      setLoadingStartup(false)
    }
  }

  const handleToggleStartup = async (app: StartupApp): Promise<void> => {
    const nextState = !app.enabled
    setActionInProgress(app.rawName)
    try {
      const res = await window.api.toggleStartupApp(app.name, nextState)
      if (res.success) {
        showToast(`Zmieniono status autostartu dla "${app.name}".`)
        loadStartupApps()
      } else {
        showToast(res.error || 'Nie udało się zapisać zmiany w rejestrze.', 'error')
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      showToast(errMsg || 'Błąd zapisu w rejestrze.', 'error')
    } finally {
      setActionInProgress(null)
    }
  }

  // --- SERVICES LOGIC ---
  const loadServices = async (): Promise<void> => {
    setLoadingServices(true)
    try {
      const res = await window.api.getSystemServices()
      if (res.success && Array.isArray(res.data)) {
        setServices(res.data)
      } else {
        showToast('Nie udało się wczytać usług systemowych.', 'error')
      }
    } catch (e) {
      console.error(e)
      showToast('Błąd pobierania danych usług.', 'error')
    } finally {
      setLoadingServices(false)
    }
  }

  const handleServiceAction = async (
    service: SystemService,
    action: 'start' | 'stop' | 'automatic' | 'manual' | 'disabled'
  ): Promise<void> => {
    setActionInProgress(service.name + '-' + action)
    try {
      const res = await window.api.toggleSystemService(service.name, action)
      if (res.success) {
        showToast(
          res.elevated
            ? `Pomyślnie zoptymalizowano usługę "${service.displayName}" (wymagane były uprawnienia administratora UAC).`
            : `Pomyślnie zmieniono stan usługi "${service.displayName}".`
        )
        loadServices()
      } else {
        showToast(res.error || 'Operacja na usłudze nie powiodła się.', 'error')
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      showToast(errMsg || 'Błąd konfiguracji usługi.', 'error')
    } finally {
      setActionInProgress(null)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (activeTab === 'startup') {
      loadStartupApps()
    } else {
      loadServices()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab])
  /* eslint-enable react-hooks/set-state-in-effect */

  // Filters
  const filteredStartup = startupApps.filter(
    (app) =>
      app.name.toLowerCase().includes(searchStartup.toLowerCase()) ||
      app.command.toLowerCase().includes(searchStartup.toLowerCase())
  )

  const filteredServices = services.filter((s) => {
    const matchesSearch =
      s.displayName.toLowerCase().includes(searchService.toLowerCase()) ||
      s.name.toLowerCase().includes(searchService.toLowerCase())
    const matchesCategory =
      filterCategory === 'all' ||
      s.category === filterCategory ||
      (filterCategory === 'curated' && s.isCurated)
    const matchesStatus = filterStatus === 'all' || s.status === filterStatus
    const matchesStartup = filterStartup === 'all' || s.startupType === filterStartup

    return matchesSearch && matchesCategory && matchesStatus && matchesStartup
  })

  // Help categories styling helper
  const getCategoryIcon = (category: string): React.ReactNode => {
    switch (category) {
      case 'telemetry':
        return <Activity size={12} color="var(--color-primary)" />
      case 'performance':
        return <RefreshCw size={12} color="#10b981" />
      case 'gaming':
        return <Gamepad size={12} color="#a855f7" />
      case 'security':
        return <Lock size={12} color="#ef4444" />
      default:
        return <Info size={12} color="var(--color-text-muted)" />
    }
  }

  const getSafetyBadge = (safety: string): React.ReactNode => {
    switch (safety) {
      case 'safe':
        return (
          <span
            style={{
              color: '#10b981',
              background: 'rgba(16,185,129,0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '9px',
              fontWeight: 600
            }}
          >
            Bezpieczne
          </span>
        )
      case 'caution':
        return (
          <span
            style={{
              color: '#f59e0b',
              background: 'rgba(245,158,11,0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '9px',
              fontWeight: 600
            }}
          >
            Ostrożnie
          </span>
        )
      case 'critical':
        return (
          <span
            style={{
              color: '#ef4444',
              background: 'rgba(239,68,68,0.08)',
              padding: '2px 6px',
              borderRadius: '4px',
              fontSize: '9px',
              fontWeight: 600
            }}
          >
            Krytyczne
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="page-container" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* NAGŁÓWEK */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '24px'
        }}
      >
        <div>
          <h1
            className="text-gradient"
            style={{
              fontSize: '26px',
              fontWeight: 800,
              margin: '0 0 4px 0',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <Sliders size={28} color="var(--color-primary)" />
            Menedżer Usług & Autostartu
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
            Kontroluj programy uruchamiane przy starcie systemu oraz usługi Windows w tle, aby
            przyspieszyć bootowanie i zwiększyć bezpieczeństwo.
          </p>
        </div>
        <button
          onClick={activeTab === 'startup' ? loadStartupApps : loadServices}
          disabled={loadingStartup || loadingServices}
          className="btn btn-secondary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            fontSize: '12px'
          }}
        >
          <RefreshCw
            size={14}
            className={loadingStartup || loadingServices ? 'animate-spin' : ''}
          />
          Odśwież
        </button>
      </div>

      {/* POWIADOMIENIE TOAST */}
      {message && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'rgba(20, 20, 25, 0.95)',
            border: `1px solid ${message.type === 'success' ? 'rgba(16,185,129,0.3)' : message.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '12px',
            padding: '12px 20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            color:
              message.type === 'success'
                ? '#10b981'
                : message.type === 'error'
                  ? '#ef4444'
                  : 'white',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {message.type === 'success' ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
          <span>{message.text}</span>
        </div>
      )}

      {/* ZAKŁADKI (TABS) */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          paddingBottom: '8px'
        }}
      >
        <button
          onClick={() => setActiveTab('startup')}
          style={{
            background: activeTab === 'startup' ? 'rgba(69, 243, 255, 0.1)' : 'transparent',
            border: 'none',
            color: activeTab === 'startup' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <Power size={16} />
          Autostart (Startup Apps)
        </button>
        <button
          onClick={() => setActiveTab('services')}
          style={{
            background: activeTab === 'services' ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
            border: 'none',
            color: activeTab === 'services' ? 'var(--color-secondary)' : 'var(--color-text-muted)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <Shield size={16} />
          Usługi Windows (Services)
        </button>
      </div>

      {/* --- ZAKŁADKA 1: AUTOSTART --- */}
      {activeTab === 'startup' && (
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
          {/* SEARCH BAR */}
          <div style={{ display: 'flex', gap: '10px', marginBottom: '16px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--color-text-muted)'
                }}
              />
              <input
                type="text"
                placeholder="Wyszukaj program w autostarcie..."
                value={searchStartup}
                onChange={(e) => setSearchStartup(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  color: 'white',
                  borderRadius: '10px',
                  padding: '10px 16px 10px 38px',
                  fontSize: '12px',
                  outline: 'none'
                }}
              />
            </div>
          </div>

          {loadingStartup ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '200px',
                fontSize: '12px',
                color: 'var(--color-text-muted)'
              }}
            >
              Skanowanie rejestru autostartu...
            </div>
          ) : filteredStartup.length > 0 ? (
            <div style={{ overflowX: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                  textAlign: 'left'
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      color: 'white',
                      fontWeight: 600
                    }}
                  >
                    <th style={{ padding: '12px 8px' }}>Nazwa programu</th>
                    <th style={{ padding: '12px 8px' }}>Ścieżka / Komenda</th>
                    <th style={{ padding: '12px 8px' }}>Lokalizacja</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Stan</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredStartup.map((app, index) => (
                    <tr
                      key={index}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.02)',
                        color: 'var(--color-text-muted)'
                      }}
                    >
                      <td style={{ padding: '12px 8px', fontWeight: 600, color: 'white' }}>
                        {app.name}
                      </td>
                      <td
                        style={{
                          padding: '12px 8px',
                          fontFamily: 'monospace',
                          fontSize: '11px',
                          maxWidth: '300px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                        title={app.command}
                      >
                        {app.command}
                      </td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            background: 'rgba(255,255,255,0.05)',
                            padding: '2px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          Rejestr ({app.location})
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        <label className="switch" style={{ display: 'inline-block' }}>
                          <input
                            type="checkbox"
                            checked={app.enabled}
                            disabled={actionInProgress === app.rawName}
                            onChange={() => handleToggleStartup(app)}
                          />
                          <span className="slider"></span>
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
              Brak zdefiniowanych programów w autostarcie spełniających kryteria.
            </div>
          )}
        </div>
      )}

      {/* --- ZAKŁADKA 2: USŁUGI --- */}
      {activeTab === 'services' && (
        <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
          {/* SEARCH & FILTERS BAR */}
          <div
            style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: '20px' }}
          >
            <div style={{ display: 'flex', gap: '10px' }}>
              <div style={{ position: 'relative', flex: 1 }}>
                <Search
                  size={16}
                  style={{
                    position: 'absolute',
                    left: '12px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--color-text-muted)'
                  }}
                />
                <input
                  type="text"
                  placeholder="Wyszukaj usługę po nazwie..."
                  value={searchService}
                  onChange={(e) => setSearchService(e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.25)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: 'white',
                    borderRadius: '10px',
                    padding: '10px 16px 10px 38px',
                    fontSize: '12px',
                    outline: 'none'
                  }}
                />
              </div>
            </div>

            {/* FILTRY */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {/* Kategoria */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Kategoria:</span>
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="select-custom"
                  style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px' }}
                >
                  <option value="all">Wszystkie</option>
                  <option value="curated">Rekomendowane (Kluczowe)</option>
                  <option value="telemetry">Telemetria & Diagnostyka</option>
                  <option value="performance">Wydajność</option>
                  <option value="gaming">Optymalizacja Gier</option>
                  <option value="security">Bezpieczeństwo</option>
                  <option value="other">Pozostałe</option>
                </select>
              </div>

              {/* Status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Stan:</span>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="select-custom"
                  style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px' }}
                >
                  <option value="all">Wszystkie</option>
                  <option value="running">Uruchomione</option>
                  <option value="stopped">Zatrzymane</option>
                </select>
              </div>

              {/* Typ uruchomienia */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px' }}>
                <span style={{ color: 'var(--color-text-muted)' }}>Typ startu:</span>
                <select
                  value={filterStartup}
                  onChange={(e) => setFilterStartup(e.target.value)}
                  className="select-custom"
                  style={{ padding: '4px 8px', borderRadius: '6px', fontSize: '11px' }}
                >
                  <option value="all">Wszystkie</option>
                  <option value="automatic">Automatyczny</option>
                  <option value="manual">Ręczny</option>
                  <option value="disabled">Wyłączony</option>
                </select>
              </div>
            </div>
          </div>

          {loadingServices ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '300px',
                fontSize: '12px',
                color: 'var(--color-text-muted)'
              }}
            >
              Odczytywanie informacji o usługach systemowych...
            </div>
          ) : filteredServices.length > 0 ? (
            <div style={{ overflowX: 'auto', maxHeight: '480px', overflowY: 'auto' }}>
              <table
                style={{
                  width: '100%',
                  borderCollapse: 'collapse',
                  fontSize: '12px',
                  textAlign: 'left'
                }}
              >
                <thead>
                  <tr
                    style={{
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      color: 'white',
                      fontWeight: 600,
                      position: 'sticky',
                      top: 0,
                      background: '#111318',
                      zIndex: 1
                    }}
                  >
                    <th style={{ padding: '12px 8px' }}>Nazwa wyświetlana</th>
                    <th style={{ padding: '12px 8px' }}>Kategoria</th>
                    <th style={{ padding: '12px 8px' }}>Bezpieczeństwo</th>
                    <th style={{ padding: '12px 8px' }}>Stan</th>
                    <th style={{ padding: '12px 8px' }}>Typ startu</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right' }}>Działania</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredServices.map((s, index) => {
                    const isTelemetryAction = actionInProgress?.startsWith(s.name)
                    const isRunning = s.status === 'running'

                    return (
                      <tr
                        key={index}
                        style={{
                          borderBottom: '1px solid rgba(255,255,255,0.02)',
                          color: 'var(--color-text-muted)',
                          background: s.isCurated ? 'rgba(255,255,255,0.01)' : 'transparent'
                        }}
                      >
                        <td style={{ padding: '12px 8px', maxWidth: '220px' }}>
                          <div
                            style={{
                              fontWeight: 600,
                              color: s.isCurated ? 'var(--color-primary)' : 'white',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap'
                            }}
                            title={s.displayName}
                          >
                            {s.displayName}
                          </div>
                          <div
                            style={{
                              fontSize: '10px',
                              color: 'var(--color-text-muted)',
                              fontFamily: 'monospace'
                            }}
                          >
                            {s.name}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              textTransform: 'capitalize',
                              fontSize: '11px'
                            }}
                          >
                            {getCategoryIcon(s.category)}
                            {s.category}
                          </div>
                        </td>
                        <td style={{ padding: '12px 8px' }}>{getSafetyBadge(s.safety)}</td>
                        <td style={{ padding: '12px 8px' }}>
                          <span
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              color: isRunning ? '#10b981' : 'var(--color-text-muted)',
                              fontWeight: isRunning ? 600 : 'normal'
                            }}
                          >
                            <span
                              style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: isRunning ? '#10b981' : 'rgba(255,255,255,0.15)',
                                display: 'inline-block'
                              }}
                            ></span>
                            {isRunning ? 'Uruchomiona' : 'Zatrzymana'}
                          </span>
                        </td>
                        <td style={{ padding: '12px 8px' }}>
                          <select
                            value={s.startupType}
                            disabled={isTelemetryAction}
                            onChange={(e) =>
                              handleServiceAction(
                                s,
                                e.target.value as 'automatic' | 'manual' | 'disabled'
                              )
                            }
                            className="select-custom"
                            style={{
                              padding: '2px 6px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              background: 'rgba(0,0,0,0.15)'
                            }}
                          >
                            <option value="automatic">Automatyczny</option>
                            <option value="manual">Ręczny</option>
                            <option value="disabled">Wyłączony</option>
                          </select>
                          {s.isCurated && (
                            <div
                              style={{
                                fontSize: '9px',
                                color:
                                  s.recommended === 'disable'
                                    ? '#ef4444'
                                    : 'var(--color-secondary)',
                                marginTop: '2px',
                                fontWeight: 600
                              }}
                            >
                              Zalecane:{' '}
                              {s.recommended === 'disable'
                                ? 'Wyłącz'
                                : s.recommended === 'manual'
                                  ? 'Ręczny'
                                  : 'Włącz'}
                            </div>
                          )}
                        </td>
                        <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                          {isRunning ? (
                            <button
                              disabled={isTelemetryAction}
                              onClick={() => handleServiceAction(s, 'stop')}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#ef4444',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Zatrzymaj usługę"
                            >
                              <StopCircle size={16} />
                            </button>
                          ) : (
                            <button
                              disabled={isTelemetryAction}
                              onClick={() => handleServiceAction(s, 'start')}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#10b981',
                                cursor: 'pointer',
                                padding: '4px',
                                borderRadius: '4px',
                                display: 'inline-flex',
                                alignItems: 'center'
                              }}
                              title="Uruchom usługę"
                            >
                              <Play size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-muted)' }}>
              Nie znaleziono usług spełniających kryteria wyszukiwania.
            </div>
          )}
        </div>
      )}
    </div>
  )
}
