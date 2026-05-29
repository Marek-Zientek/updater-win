import { useEffect, useState } from 'react'
import { Trash2, ShieldAlert, CheckCircle, RefreshCw, AlertTriangle, Info, Sparkles, Folder, Database } from 'lucide-react'

interface BloatwareApp {
  name: string
  packageName: string
  packageFullName: string
  category: 'Gry' | 'Komunikacja' | 'Rozrywka' | 'Narzędzia' | 'Systemowe'
  description: string
  severity: 'low' | 'medium' | 'high'
}

export function Bloatware() {
  const [apps, setApps] = useState<BloatwareApp[]>([])
  const [loading, setLoading] = useState(false)
  const [removingApp, setRemovingApp] = useState<string | null>(null)
  const [activeFilter, setActiveFilter] = useState<string>('all')
  const [toastMessage, setToastMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)
  const [creatingRestorePoint, setCreatingRestorePoint] = useState(false)
  const [restorePointStatus, setRestorePointStatus] = useState('')
  const [scanningLeftovers, setScanningLeftovers] = useState(false)
  const [leftovers, setLeftovers] = useState<{ files: string[]; registry: string[] } | null>(null)
  const [cleaningLeftovers, setCleaningLeftovers] = useState(false)
  const [lastRemovedAppName, setLastRemovedAppName] = useState<string | null>(null)

  const loadBloatwareApps = async () => {
    setLoading(true)
    const res = await window.api.getBloatwareApps()
    if (res.success && res.data) {
      setApps(res.data)
    }
    setLoading(false)
  }

  const handleRemoveApp = async (app: BloatwareApp) => {
    setRemovingApp(app.packageFullName)
    
    try {
      const autoRestoreRes = await window.api.getSetting('auto_restore_point', 'true')
      if (autoRestoreRes.value === 'true') {
        setCreatingRestorePoint(true)
        setRestorePointStatus('Inicjowanie punktu przywracania... Zaakceptuj monit administratora (UAC) na pasku zadań.')
        const rpRes = await window.api.createRestorePoint()
        if (!rpRes.success) {
          showToast(rpRes.error || 'Nie udało się utworzyć punktu przywracania systemu Windows.', 'error')
          setRemovingApp(null)
          setCreatingRestorePoint(false)
          return
        }
      }
    } catch (err) {
      console.error('Błąd punktu przywracania:', err)
    } finally {
      setCreatingRestorePoint(false)
    }

    const res = await window.api.removeBloatwareApp(app.packageFullName)
    if (res.success) {
      showToast(`Pomyślnie odinstalowano aplikację: ${app.name}`, 'success')
      setApps((prev) => prev.filter((item) => item.packageFullName !== app.packageFullName))
      
      setScanningLeftovers(true)
      setLastRemovedAppName(app.name)
      
      const scanRes = await window.api.scanLeftovers(app.packageName)
      if (scanRes.success) {
        if ((scanRes.files && scanRes.files.length > 0) || (scanRes.registry && scanRes.registry.length > 0)) {
          setLeftovers({
            files: scanRes.files || [],
            registry: scanRes.registry || []
          })
        } else {
          setLeftovers(null)
          showToast('Brak wykrytych pozostałości po aplikacji.', 'success')
        }
      } else {
        setLeftovers(null)
        showToast('Nie udało się zeskanować pozostałości po aplikacji.', 'error')
      }
      setScanningLeftovers(false)
    } else {
      showToast(res.error || `Nie udało się usunąć aplikacji: ${app.name}`, 'error')
    }
    setRemovingApp(null)
  }

  const handleCleanLeftovers = async () => {
    if (!leftovers) return
    setCleaningLeftovers(true)
    const cleanRes = await window.api.cleanLeftovers(leftovers.files, leftovers.registry)
    if (cleanRes.success) {
      showToast(
        `Wyczyszczono pozostałości! Usunięto foldery: ${cleanRes.filesDeleted}, klucze rejestru: ${cleanRes.regsDeleted}`,
        'success'
      )
    } else {
      showToast(
        `Czyszczenie ukończone częściowo. Usunięto foldery: ${cleanRes.filesDeleted}, klucze rejestru: ${cleanRes.regsDeleted}. Napotkano ${cleanRes.errors.length} błędów.`,
        'error'
      )
    }
    setLeftovers(null)
    setLastRemovedAppName(null)
    setCleaningLeftovers(false)
  }

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 5000)
  }

  useEffect(() => {
    loadBloatwareApps()
  }, [])

  // Filtrowanie aplikacji
  const filteredApps = apps.filter((app) => {
    if (activeFilter === 'all') return true
    return app.category.toLowerCase() === activeFilter.toLowerCase()
  })

  // Zliczanie statystyk
  const highSeverityCount = apps.filter((a) => a.severity === 'high').length
  const totalDetected = apps.length

  const getSeverityBadgeClass = (severity: 'low' | 'medium' | 'high'): string => {
    switch (severity) {
      case 'high':
        return 'severity-high'
      case 'medium':
        return 'severity-medium'
      case 'low':
        return 'severity-low'
    }
  }

  const getSeverityLabel = (severity: 'low' | 'medium' | 'high'): string => {
    switch (severity) {
      case 'high':
        return 'Wysoki wpływ (Zalecane usunięcie)'
      case 'medium':
        return 'Średni wpływ'
      case 'low':
        return 'Niski wpływ'
    }
  }

  return (
    <div className="bloatware-container fade-in">
      {creatingRestorePoint && (
        <div className="restore-point-overlay">
          <div className="restore-point-card glass-panel flex flex-col items-center justify-center text-center p-xl" style={{ padding: '32px' }}>
            <div className="loader-spin mb-md" style={{ width: '48px', height: '48px', borderTopColor: 'var(--color-primary)' }}></div>
            <h3 style={{ margin: '16px 0 8px 0', fontSize: '18px', color: '#fff', fontWeight: 700 }}>
              Kopia zapasowa systemu
            </h3>
            <p className="text-muted text-sm max-w-[360px]" style={{ margin: 0, lineHeight: 1.5 }}>
              {restorePointStatus}
            </p>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="flex items-center justify-between mb-lg">
        <div>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}>Menedżer Bloatware</h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
            Bezpieczne wykrywanie i odinstalowywanie fabrycznych aplikacji obciążających system
            operacyjny
          </p>
        </div>
        <button
          className="btn btn-secondary flex items-center gap-xs"
          onClick={loadBloatwareApps}
          disabled={loading || removingApp !== null}
        >
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          <span>Odśwież listę</span>
        </button>
      </header>

      {/* Toast powiadomień */}
      {toastMessage && (
        <div className={`status-toast animate-slide-up ${toastMessage.type}`}>
          {toastMessage.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Karty Statystyk */}
      {totalDetected > 0 && (
        <div className="stats-grid mb-lg">
          <div className="glass-panel stat-card flex items-center gap-lg">
            <div className="stat-icon-wrapper red">
              <ShieldAlert size={24} />
            </div>
            <div>
              <span className="stat-lbl text-muted text-xs block uppercase">
                Krytyczne aplikacje
              </span>
              <span className="stat-val text-xl font-bold">{highSeverityCount}</span>
            </div>
          </div>
          <div className="glass-panel stat-card flex items-center gap-lg">
            <div className="stat-icon-wrapper orange">
              <Trash2 size={24} />
            </div>
            <div>
              <span className="stat-lbl text-muted text-xs block uppercase">Wykryty bloatware</span>
              <span className="stat-val text-xl font-bold">{totalDetected}</span>
            </div>
          </div>
        </div>
      )}

      {/* Filtry i Menedżer */}
      <div className="glass-panel main-panel">
        <div className="panel-toolbar flex items-center justify-between mb-lg">
          <div className="flex gap-xs flex-wrap">
            {['all', 'Gry', 'Komunikacja', 'Rozrywka', 'Narzędzia', 'Systemowe'].map((filter) => (
              <button
                key={filter}
                className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
                onClick={() => setActiveFilter(filter)}
                disabled={loading}
              >
                {filter === 'all' ? 'Wszystkie' : filter}
              </button>
            ))}
          </div>
          <span className="text-muted text-xs font-semibold">
            Pokazywane: {filteredApps.length} z {totalDetected}
          </span>
        </div>

        {/* Panel pozostałości po deinstalacji */}
        {scanningLeftovers && (
          <div className="leftovers-scanning-card glass-panel flex items-center justify-center p-lg mb-lg" style={{ gap: '12px', background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '18px' }}>
            <div className="loader-btn-spin" style={{ width: '20px', height: '20px', borderTopColor: 'var(--color-primary)' }}></div>
            <span className="text-sm font-semibold text-muted">
              Skanowanie pozostałości (pliki, rejestr) dla {lastRemovedAppName}...
            </span>
          </div>
        )}

        {leftovers && (
          <div className="leftovers-panel glass-panel mb-lg fade-in" style={{ padding: '20px', borderRadius: '18px', border: '1px solid rgba(69, 243, 255, 0.2)', background: 'rgba(69, 243, 255, 0.02)' }}>
            <div className="flex items-center justify-between mb-md flex-wrap gap-md">
              <div className="flex items-center gap-sm">
                <Sparkles size={20} color="var(--color-primary)" className="pulse-slow" />
                <div>
                  <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#fff' }}>
                    Wykryto pozostałości po {lastRemovedAppName}
                  </h3>
                  <p className="text-muted text-xs" style={{ margin: '2px 0 0 0' }}>
                    System Windows pozostawił niepotrzebne klucze rejestru oraz foldery danych aplikacji.
                  </p>
                </div>
              </div>
              <div className="flex gap-sm">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setLeftovers(null)
                    setLastRemovedAppName(null)
                  }}
                  disabled={cleaningLeftovers}
                >
                  Pomiń
                </button>
                <button
                  className="btn btn-primary btn-sm flex items-center gap-xs pulse-primary"
                  onClick={handleCleanLeftovers}
                  disabled={cleaningLeftovers}
                >
                  {cleaningLeftovers ? (
                    <>
                      <div className="loader-btn-spin"></div>
                      <span>Czyszczenie...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Wyczyść pozostałości</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="leftovers-lists-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px', maxHeight: '200px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.03)' }}>
              <div>
                <h4 className="text-xs font-bold uppercase text-muted mb-xs flex items-center gap-xs" style={{ letterSpacing: '1px' }}>
                  <Folder size={12} color="var(--color-warning)" />
                  Katalogi ({leftovers.files.length})
                </h4>
                {leftovers.files.length === 0 ? (
                  <p className="text-xs text-muted" style={{ margin: '4px 0 0 0' }}>Brak wykrytych folderów</p>
                ) : (
                  leftovers.files.map((file, i) => (
                    <div key={i} className="leftover-item truncate text-xs font-mono" style={{ padding: '4px 0', color: 'rgba(255,255,255,0.6)' }} title={file}>
                      {file}
                    </div>
                  ))
                )}
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase text-muted mb-xs flex items-center gap-xs" style={{ letterSpacing: '1px' }}>
                  <Database size={12} color="var(--color-primary)" />
                  Rejestr Windows ({leftovers.registry.length})
                </h4>
                {leftovers.registry.length === 0 ? (
                  <p className="text-xs text-muted" style={{ margin: '4px 0 0 0' }}>Brak wykrytych wpisów</p>
                ) : (
                  leftovers.registry.map((reg, i) => (
                    <div key={i} className="leftover-item truncate text-xs font-mono" style={{ padding: '4px 0', color: 'rgba(255,255,255,0.6)' }} title={reg}>
                      {reg}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-xl" style={{ gap: '16px' }}>
            <div className="loader-spin"></div>
            <span className="text-muted text-sm">
              Skanowanie pakietów AppX w systemie Windows...
            </span>
          </div>
        ) : filteredApps.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center py-xl text-center"
            style={{ gap: '16px' }}
          >
            <CheckCircle
              size={56}
              style={{
                color: 'var(--color-success)',
                filter: 'drop-shadow(0 0 10px rgba(16,185,129,0.3))'
              }}
            />
            <div>
              <h3 className="font-bold text-lg" style={{ margin: 0 }}>
                System jest w pełni czysty!
              </h3>
              <p
                className="text-xs text-muted max-w-[400px]"
                style={{ margin: '6px 0 0 0', lineHeight: 1.5 }}
              >
                {activeFilter === 'all'
                  ? 'Nie wykryliśmy żadnych zbędnych aplikacji fabrycznych u tego użytkownika. Twój Windows jest zoptymalizowany pod tym kątem.'
                  : `Brak aplikacji bloatware w kategorii "${activeFilter}". Spróbuj wybrać inny filtr.`}
              </p>
            </div>
          </div>
        ) : (
          <div className="bloatware-list">
            {filteredApps.map((app, i) => (
              <div key={i} className="bloatware-card glass-panel flex items-start justify-between">
                <div className="flex-1 pr-lg">
                  <div className="flex items-center gap-md flex-wrap mb-xs">
                    <h3 className="app-name font-bold" style={{ fontSize: '16px', margin: 0 }}>
                      {app.name}
                    </h3>
                    <span className="category-tag text-xs font-semibold">{app.category}</span>
                    <span
                      className={`severity-badge text-xs font-semibold ${getSeverityBadgeClass(app.severity)}`}
                    >
                      {getSeverityLabel(app.severity)}
                    </span>
                  </div>
                  <p
                    className="app-desc text-muted text-xs mb-xs"
                    style={{ margin: '6px 0 4px 0', lineHeight: 1.5 }}
                  >
                    {app.description}
                  </p>
                  <span
                    className="package-name text-muted font-mono"
                    style={{ fontSize: '10px' }}
                    title={app.packageFullName}
                  >
                    ID pakietu: {app.packageName}
                  </span>
                </div>
                <button
                  className="btn btn-secondary btn-sm flex items-center gap-xs remove-btn"
                  onClick={() => handleRemoveApp(app)}
                  disabled={removingApp !== null}
                >
                  {removingApp === app.packageFullName ? (
                    <>
                      <div className="loader-btn-spin"></div>
                      <span>Usuwanie...</span>
                    </>
                  ) : (
                    <>
                      <Trash2 size={14} />
                      <span>Odinstaluj</span>
                    </>
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Ostrzeżenie informacyjne na dole */}
      <div className="info-card flex items-start gap-sm mt-lg">
        <Info size={16} className="info-icon" />
        <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
          <strong>Bezpieczeństwo przede wszystkim:</strong> Usuwanie bloatware w naszej aplikacji
          jest nieinwazyjne i dotyczy wyłącznie konta zalogowanego użytkownika systemu Windows. W
          razie potrzeby każdą z tych aplikacji można ponownie bezpłatnie zainstalować z Microsoft
          Store.
        </p>
      </div>

      <style>{`
        .restore-point-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.7);
          backdrop-filter: blur(10px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .restore-point-card {
          background: rgba(255, 255, 255, 0.03) !important;
          border: 1px solid rgba(255, 255, 255, 0.08) !important;
          border-radius: 24px;
          max-width: 420px;
          width: 100%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          animation: scaleUp 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }

        @keyframes scaleUp {
          from { transform: scale(0.9); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .pulse-primary {
          box-shadow: 0 0 15px var(--color-primary-glow);
          animation: pulseGlow 2s infinite alternate;
        }

        @keyframes pulseGlow {
          0% { box-shadow: 0 0 10px rgba(69, 243, 255, 0.3); }
          100% { box-shadow: 0 0 25px rgba(69, 243, 255, 0.6); }
        }

        .pulse-slow {
          animation: pulseSlow 3s infinite ease-in-out;
        }

        @keyframes pulseSlow {
          0%, 100% { opacity: 0.6; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
        }

        .leftover-item {
          transition: color 0.2s;
        }
        .leftover-item:hover {
          color: #fff !important;
        }

        .bloatware-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 24px;
          height: calc(100vh - 32px);
          width: 100%;
          box-sizing: border-box;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        .main-panel {
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Statystyki */
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 20px;
        }

        .stat-card {
          padding: 16px 20px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
        }

        .stat-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .stat-icon-wrapper.red { background: rgba(239, 68, 68, 0.1); color: #ef4444; }
        .stat-icon-wrapper.orange { background: rgba(249, 115, 22, 0.1); color: #f97316; }

        /* Filtry */
        .filter-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: var(--color-text-secondary);
          padding: 6px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .filter-btn:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #fff;
        }

        .filter-btn.active {
          background: rgba(69, 243, 255, 0.1);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        /* Lista Bloatware */
        .bloatware-list {
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .bloatware-card {
          padding: 20px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: all 0.3s;
        }

        .bloatware-card:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .remove-btn:hover {
          background: rgba(239, 68, 68, 0.15) !important;
          border-color: #ef4444 !important;
          color: #fca5a5 !important;
        }

        /* Tagi i Odznaki */
        .category-tag {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-muted);
          padding: 2px 8px;
          border-radius: 6px;
        }

        .severity-badge {
          padding: 2px 8px;
          border-radius: 6px;
        }

        .severity-low {
          background: rgba(59, 130, 246, 0.1);
          color: #60a5fa;
        }

        .severity-medium {
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
        }

        .severity-high {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
        }

        /* Karta Informacyjna */
        .info-card {
          padding: 14px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .info-icon {
          color: var(--color-text-muted);
          flex-shrink: 0;
          margin-top: 2px;
        }

        /* Toast */
        .status-toast {
          position: fixed;
          bottom: 24px;
          right: 24px;
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 14px 24px;
          border-radius: 30px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
          z-index: 1000;
          font-size: 14px;
          font-weight: 600;
        }

        .status-toast.success {
          background: rgba(16, 185, 129, 0.95);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #fff;
        }

        .status-toast.error {
          background: rgba(239, 68, 68, 0.95);
          border: 1px solid rgba(239, 68, 68, 0.2);
          color: #fff;
        }

        /* Loadery */
        .loader-spin {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(69, 243, 255, 0.1);
          border-top-color: var(--color-primary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .loader-btn-spin {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
