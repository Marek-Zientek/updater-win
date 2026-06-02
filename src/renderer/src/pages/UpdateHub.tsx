import React, { useState, useEffect } from 'react'
import {
  Clock,
  Play,
  Pause,
  RefreshCw,
  Trash2,
  CheckCircle,
  AlertTriangle,
  History,
  Wrench,
  Terminal,
  Calendar
} from 'lucide-react'

interface UpdateHistoryItem {
  title: string
  date: string
  description: string
  kb: string
  result: number
}

interface UpdateStatus {
  paused: boolean
  expiryTime: string
  startTime: string
}

export default function UpdateHub(): React.ReactElement {
  const [status, setStatus] = useState<UpdateStatus>({
    paused: false,
    expiryTime: '',
    startTime: ''
  })
  const [history, setHistory] = useState<UpdateHistoryItem[]>([])
  const [loadingStatus, setLoadingStatus] = useState(true)
  const [loadingHistory, setLoadingHistory] = useState(true)

  // Cache Wiping states
  const [wiping, setWiping] = useState(false)
  const [wipeProgress, setWipeProgress] = useState<string[]>([])
  const [wipeResult, setWipeResult] = useState<{ success: boolean; message?: string } | null>(null)

  // Pause duration select
  const [pauseDays, setPauseDays] = useState<number>(7)
  const [pausing, setPausing] = useState(false)
  const [resuming, setResuming] = useState(false)

  // Uninstall states
  const [uninstallingKb, setUninstallingKb] = useState<string | null>(null)
  const [kbToUninstall, setKbToUninstall] = useState<UpdateHistoryItem | null>(null)

  // Notifications
  const [notification, setNotification] = useState<{
    text: string
    type: 'success' | 'error' | 'info'
  } | null>(null)

  const showNotification = (text: string, type: 'success' | 'error' | 'info' = 'success'): void => {
    setNotification({ text, type })
    setTimeout(() => {
      setNotification(null)
    }, 5000)
  }

  const loadStatus = async (): Promise<void> => {
    setLoadingStatus(true)
    try {
      const data = await window.api.winUpdate.getStatus()
      setStatus(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingStatus(false)
    }
  }

  const loadHistory = async (): Promise<void> => {
    setLoadingHistory(true)
    try {
      const res = await window.api.winUpdate.getHistory()
      if (res.success && Array.isArray(res.data)) {
        setHistory(res.data)
      }
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingHistory(false)
    }
  }

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    loadStatus()
    loadHistory()
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handlePause = async (): Promise<void> => {
    setPausing(true)
    try {
      const res = await window.api.winUpdate.pauseUpdates(pauseDays)
      if (res.success) {
        showNotification(`Wstrzymano aktualizacje Windows na ${pauseDays} dni (monit UAC).`)
        loadStatus()
      } else {
        showNotification(res.error || 'Nie udało się wstrzymać aktualizacji.', 'error')
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      showNotification(errMsg || 'Błąd wstrzymywania aktualizacji.', 'error')
    } finally {
      setPausing(false)
    }
  }

  const handleResume = async (): Promise<void> => {
    setResuming(true)
    try {
      const res = await window.api.winUpdate.resumeUpdates()
      if (res.success) {
        showNotification('Wznowiono automatyczne aktualizacje Windows (monit UAC).')
        loadStatus()
      } else {
        showNotification(res.error || 'Nie udało się wznowić aktualizacji.', 'error')
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      showNotification(errMsg || 'Błąd wznawiania aktualizacji.', 'error')
    } finally {
      setResuming(false)
    }
  }

  const handleWipeCache = async (): Promise<void> => {
    if (wiping) return
    setWiping(true)
    setWipeResult(null)
    setWipeProgress([])

    const addLog = (log: string): void => {
      setWipeProgress((prev) => [...prev, `[${new Date().toLocaleTimeString()}] ${log}`])
    }

    addLog('Rozpoczynanie procedury czyszczenia pamięci podręcznej Windows Update...')
    addLog('Wymagane zatwierdzenie monitu UAC w tle...')

    try {
      // Symulacja kroków w konsoli na podstawie asynchronicznego skryptu
      setTimeout(() => addLog('Zatrzymywanie usługi Windows Update (wuauserv)...'), 1000)
      setTimeout(
        () => addLog('Zatrzymywanie usługi Inteligentnego Transferu w Tle (bits)...'),
        2500
      )
      setTimeout(() => addLog('Zatrzymywanie usług kryptograficznych (cryptsvc)...'), 4000)
      setTimeout(() => addLog('Czyszczenie katalogu C:\\Windows\\SoftwareDistribution...'), 5500)
      setTimeout(() => addLog('Uruchamianie usług systemowych z powrotem...'), 7500)

      const res = await window.api.winUpdate.clearCache()

      if (res.success) {
        addLog('Wszystkie usługi zostały pomyślnie zrestartowane.')
        addLog('Pamięć podręczna została pomyślnie wyczyszczona!')
        setWipeResult({
          success: true,
          message: 'Naprawa ukończona sukcesem! Uszkodzone pliki pobierania zostały usunięte.'
        })
      } else {
        addLog(`[Błąd] Operacja nie powiodła się: ${res.error}`)
        setWipeResult({ success: false, message: res.error || 'Czyszczenie przerwane.' })
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      addLog(`[Wyjątek] Błąd krytyczny: ${errMsg}`)
      setWipeResult({ success: false, message: errMsg || 'Błąd komunikacji.' })
    } finally {
      setWiping(false)
    }
  }

  const handleUninstall = async (kb: string): Promise<void> => {
    setUninstallingKb(kb)
    setKbToUninstall(null)
    try {
      showNotification(`Uruchamianie deinstalacji ${kb} w tle. Zaakceptuj monit UAC.`)
      const res = await window.api.winUpdate.uninstallUpdate(kb)
      if (res.success) {
        showNotification(`Pomyślnie odinstalowano aktualizację ${kb}.`)
        loadHistory()
      } else {
        showNotification(
          res.error || `Deinstalacja ${kb} nie powiodła się lub została anulowana.`,
          'error'
        )
      }
    } catch (e: unknown) {
      const errMsg = e instanceof Error ? e.message : String(e)
      showNotification(errMsg || 'Błąd podczas odinstalowywania.', 'error')
    } finally {
      setUninstallingKb(null)
    }
  }

  const parseResultCode = (code: number): React.ReactNode => {
    switch (code) {
      case 2:
        return <span style={{ color: '#10b981', fontWeight: 600 }}>Sukces</span>
      case 4:
        return <span style={{ color: '#ef4444', fontWeight: 600 }}>Błąd</span>
      case 5:
        return <span style={{ color: '#f59e0b', fontWeight: 600 }}>Przerwano</span>
      default:
        return <span style={{ color: 'var(--color-text-muted)' }}>Nieznany ({code})</span>
    }
  }

  const formatDate = (isoStr: string): string => {
    try {
      const date = new Date(isoStr)
      return (
        date.toLocaleDateString() +
        ' ' +
        date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      )
    } catch {
      return isoStr
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
            <Clock size={28} color="var(--color-primary)" />
            Windows Update Control Hub
          </h1>
          <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
            Wstrzymuj niechciane aktualizacje, usuwaj problematyczne pakiety poprawek KB oraz
            naprawiaj błędy instalacji poprzez czyszczenie cache.
          </p>
        </div>
        <button
          onClick={() => {
            loadStatus()
            loadHistory()
          }}
          disabled={loadingStatus || loadingHistory}
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
          <RefreshCw size={14} className={loadingStatus || loadingHistory ? 'animate-spin' : ''} />
          Odśwież
        </button>
      </div>

      {/* POWIADOMIENIE TOAST */}
      {notification && (
        <div
          style={{
            position: 'fixed',
            bottom: '20px',
            right: '20px',
            zIndex: 9999,
            background: 'rgba(20, 20, 25, 0.95)',
            border: `1px solid ${notification.type === 'success' ? 'rgba(16,185,129,0.3)' : notification.type === 'error' ? 'rgba(239,68,68,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '12px',
            padding: '12px 20px',
            boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            color:
              notification.type === 'success'
                ? '#10b981'
                : notification.type === 'error'
                  ? '#ef4444'
                  : 'white',
            fontSize: '12px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            animation: 'slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
          }}
        >
          {notification.type === 'success' ? (
            <CheckCircle size={16} />
          ) : (
            <AlertTriangle size={16} />
          )}
          <span>{notification.text}</span>
        </div>
      )}

      {/* MODAL POTWIERDZENIA DEINSTALACJI */}
      {kbToUninstall && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            zIndex: 99999,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backdropFilter: 'blur(4px)'
          }}
        >
          <div
            className="glass-panel"
            style={{
              padding: '24px',
              borderRadius: '16px',
              maxWidth: '450px',
              width: '100%',
              border: '1px solid rgba(239,68,68,0.25)',
              boxShadow: '0 10px 40px rgba(0,0,0,0.5)'
            }}
          >
            <h3
              style={{
                margin: '0 0 12px 0',
                color: '#ef4444',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '16px'
              }}
            >
              <AlertTriangle size={20} />
              Potwierdź deinstalację poprawki
            </h3>
            <p
              style={{
                fontSize: '13px',
                color: 'var(--color-text-muted)',
                lineHeight: '1.5',
                margin: '0 0 20px 0'
              }}
            >
              Czy na pewno chcesz odinstalować aktualizację{' '}
              <strong style={{ color: 'white' }}>{kbToUninstall.kb}</strong>?<br />
              <span
                style={{
                  fontSize: '11px',
                  fontStyle: 'italic',
                  display: 'block',
                  marginTop: '6px'
                }}
              >
                &quot;{kbToUninstall.title}&quot;
              </span>
              <br />
              Proces ten wymaga potwierdzenia uprawnień administratora UAC i może potrwać kilka
              minut. System Windows może wymagać ponownego uruchomienia po zakończeniu.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setKbToUninstall(null)}
                style={{ padding: '8px 16px', borderRadius: '8px', fontSize: '12px' }}
              >
                Anuluj
              </button>
              <button
                onClick={() => handleUninstall(kbToUninstall.kb)}
                style={{
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#ef4444',
                  padding: '8px 16px',
                  borderRadius: '8px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Tak, odinstaluj
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SIATKA GŁÓWNA */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr', gap: '20px' }}>
        {/* LEWA KOLUMNA: STATUS, PAUZA, CZYSZCZENIE */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* KARTA STATUSU I KONTROLI PAUZY */}
          <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'white',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Calendar size={18} color="var(--color-primary)" />
              Stan Windows Update
            </h3>

            {loadingStatus ? (
              <div style={{ fontSize: '12px', color: 'var(--color-text-muted)' }}>
                Wczytywanie statusu...
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    background: status.paused
                      ? 'rgba(245, 158, 11, 0.05)'
                      : 'rgba(16, 185, 129, 0.05)',
                    border: `1px solid ${status.paused ? 'rgba(245, 158, 11, 0.15)' : 'rgba(16, 185, 129, 0.15)'}`,
                    borderRadius: '12px',
                    padding: '16px'
                  }}
                >
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '50%',
                      background: status.paused
                        ? 'rgba(245, 158, 11, 0.1)'
                        : 'rgba(16, 185, 129, 0.1)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    {status.paused ? (
                      <Pause size={18} color="#f59e0b" />
                    ) : (
                      <Play size={18} color="#10b981" />
                    )}
                  </div>
                  <div>
                    <h4 style={{ margin: 0, color: 'white', fontSize: '14px' }}>
                      Status: {status.paused ? 'Aktualizacje Wstrzymane' : 'Aktualizacje Aktywne'}
                    </h4>
                    {status.paused && (
                      <p
                        style={{
                          margin: '2px 0 0 0',
                          fontSize: '11px',
                          color: 'var(--color-text-muted)'
                        }}
                      >
                        Wznowienie nastąpi automatycznie:{' '}
                        <strong style={{ color: 'white' }}>{formatDate(status.expiryTime)}</strong>
                      </p>
                    )}
                  </div>
                </div>

                {/* OPCJE PAUZY */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 10px 0', fontSize: '13px', color: 'white' }}>
                    Zarządzaj wstrzymaniem
                  </h4>
                  {status.paused ? (
                    <button
                      disabled={resuming}
                      onClick={handleResume}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        border: 'none',
                        color: 'black',
                        fontWeight: 700,
                        padding: '12px',
                        borderRadius: '10px',
                        cursor: resuming ? 'not-allowed' : 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '12px'
                      }}
                    >
                      {resuming ? (
                        <RefreshCw size={14} className="animate-spin" />
                      ) : (
                        <Play size={14} fill="black" />
                      )}
                      Wznów aktualizacje Windows (Resuming)
                    </button>
                  ) : (
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <select
                        value={pauseDays}
                        onChange={(e) => setPauseDays(parseInt(e.target.value, 10))}
                        className="select-custom"
                        style={{ flex: 1, padding: '10px' }}
                      >
                        <option value="7">Wstrzymaj na 7 dni</option>
                        <option value="14">Wstrzymaj na 14 dni</option>
                        <option value="21">Wstrzymaj na 21 dni</option>
                        <option value="28">Wstrzymaj na 28 dni</option>
                      </select>
                      <button
                        disabled={pausing}
                        onClick={handlePause}
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.08)',
                          color: 'white',
                          padding: '10px 16px',
                          borderRadius: '10px',
                          cursor: pausing ? 'not-allowed' : 'pointer',
                          fontWeight: 600,
                          fontSize: '12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        {pausing ? (
                          <RefreshCw size={14} className="animate-spin" />
                        ) : (
                          <Pause size={14} />
                        )}
                        Wstrzymaj
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* KARTA NAPRAWY / CZYSZCZENIA CACHE */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}
          >
            <h3
              style={{
                fontSize: '15px',
                fontWeight: 600,
                color: 'white',
                margin: 0,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <Wrench size={18} color="var(--color-secondary)" />
              Naprawa Windows Update
            </h3>

            <p
              style={{
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                lineHeight: '1.5',
                margin: 0
              }}
            >
              Jeśli aktualizacje zawieszają się podczas pobierania lub wyrzucają błędy instalacji,
              kliknij przycisk poniżej, aby zatrzymać usługi jądra Windows Update, bezpiecznie
              wyczyścić pamięć podręczną SoftwareDistribution i uruchomić je ponownie.
            </p>

            {wipeResult && (
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  background: wipeResult.success
                    ? 'rgba(16, 185, 129, 0.08)'
                    : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${wipeResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  color: wipeResult.success ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                {wipeResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                {wipeResult.message}
              </div>
            )}

            <button
              disabled={wiping}
              onClick={handleWipeCache}
              style={{
                width: '100%',
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                color: 'white',
                padding: '12px',
                borderRadius: '10px',
                fontWeight: 600,
                fontSize: '12px',
                cursor: wiping ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '8px',
                transition: 'all 0.2s'
              }}
            >
              {wiping ? <RefreshCw size={14} className="animate-spin" /> : <Trash2 size={14} />}
              Wyczyść Cache & Napraw Aktualizacje (SoftwareDistribution)
            </button>

            {/* KONSOLA LOGÓW PROGRESU */}
            {(wiping || wipeProgress.length > 0) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4
                  style={{
                    margin: '6px 0 0 0',
                    fontSize: '11px',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Terminal size={14} />
                  Konsola naprawcza
                </h4>
                <div
                  style={{
                    background: 'rgba(0,0,0,0.45)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontFamily: 'Consolas, monospace',
                    fontSize: '10px',
                    color: '#10b981',
                    maxHeight: '120px',
                    overflowY: 'auto',
                    lineHeight: '1.5',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {wipeProgress.map((prog, idx) => (
                    <div key={idx}>{prog}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* PRAWA KOLUMNA: HISTORIA I ODINSTALOWYWANIE */}
        <div
          className="glass-panel"
          style={{
            padding: '20px',
            borderRadius: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          <h3
            style={{
              fontSize: '15px',
              fontWeight: 600,
              color: 'white',
              margin: 0,
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <History size={18} color="var(--color-secondary)" />
            Historia zainstalowanych aktualizacji poprawek
          </h3>

          {loadingHistory ? (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                height: '240px',
                fontSize: '12px',
                color: 'var(--color-text-muted)'
              }}
            >
              Odczytywanie historii aktualizacji...
            </div>
          ) : history.length > 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                maxHeight: '480px',
                overflowY: 'auto',
                paddingRight: '4px'
              }}
            >
              {history.map((item, idx) => (
                <div
                  key={idx}
                  style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '10px',
                    padding: '12px',
                    fontSize: '11px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: '10px'
                    }}
                  >
                    <strong
                      style={{
                        color: 'white',
                        fontSize: '12px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical'
                      }}
                    >
                      {item.title}
                    </strong>
                    {item.kb && (
                      <span
                        style={{
                          flexShrink: 0,
                          color: 'var(--color-primary)',
                          background: 'rgba(69,243,255,0.08)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontFamily: 'monospace',
                          fontWeight: 'bold'
                        }}
                      >
                        {item.kb}
                      </span>
                    )}
                  </div>

                  <p
                    style={{ margin: '4px 0', color: 'var(--color-text-muted)', fontSize: '10px' }}
                  >
                    {item.description || 'Brak dodatkowego opisu.'}
                  </p>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      borderTop: '1px solid rgba(255,255,255,0.02)',
                      paddingTop: '6px',
                      marginTop: '2px'
                    }}
                  >
                    <div>
                      <span style={{ color: 'var(--color-text-muted)' }}>Data: {item.date}</span>
                      <span style={{ marginLeft: '12px' }}>
                        Rezultat: {parseResultCode(item.result)}
                      </span>
                    </div>
                    {item.kb && (
                      <button
                        disabled={uninstallingKb === item.kb}
                        onClick={() => setKbToUninstall(item)}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#ef4444',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '11px',
                          fontWeight: 600
                        }}
                      >
                        {uninstallingKb === item.kb ? (
                          <RefreshCw size={12} className="animate-spin" />
                        ) : (
                          <Trash2 size={12} />
                        )}
                        Odinstaluj
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div
              style={{
                textAlign: 'center',
                padding: '40px',
                color: 'var(--color-text-muted)',
                fontSize: '12px'
              }}
            >
              Brak zarejestrowanej historii aktualizacji.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
