import { useEffect, useState } from 'react'
import {
  Trash2,
  CheckCircle,
  RefreshCw,
  Cpu,
  Zap,
  PlayCircle,
  FolderOpen,
  HardDrive,
  Info,
  Shield
} from 'lucide-react'

interface StartupApp {
  rawName: string
  name: string
  command: string
  enabled: boolean
  location: string
}

interface CleanupStats {
  tempSize: number
  logSize: number
  cacheSize: number
}

export function Optimizer() {
  const [activeTab, setActiveTab] = useState<'cleanup' | 'startup' | 'privacy'>('cleanup')

  // Stany dla Czyszczenia Dysku
  const [cleanupStats, setCleanupStats] = useState<CleanupStats>({
    tempSize: 0,
    logSize: 0,
    cacheSize: 0
  })
  const [scanning, setScanning] = useState(false)
  const [cleaning, setCleaning] = useState(false)
  const [cleanedBytes, setCleanedBytes] = useState<number | null>(null)

  // Stany dla Programów Startowych
  const [startupApps, setStartupApps] = useState<StartupApp[]>([])
  const [loadingStartup, setLoadingStartup] = useState(false)
  const [togglingApp, setTogglingApp] = useState<string | null>(null)

  // Stany dla Prywatności i Telemetrii
  const [privacySettings, setPrivacySettings] = useState({
    telemetry: true,
    errorReporting: true,
    cortana: true,
    ads: true
  })
  const [loadingPrivacy, setLoadingPrivacy] = useState(false)
  const [togglingPrivacyKey, setTogglingPrivacyKey] = useState<string | null>(null)
  const [creatingRestorePoint, setCreatingRestorePoint] = useState(false)
  const [restorePointStatus, setRestorePointStatus] = useState('')

  // Pobieranie danych
  const loadCleanupStats = async () => {
    setScanning(true)
    const res = await window.api.getCleanupStats()
    if (res.success && res.data) {
      setCleanupStats(res.data)
    }
    setScanning(false)
  }

  const handleClean = async () => {
    setCleaning(true)
    const res = await window.api.runCleanup()
    if (res.success) {
      setCleanedBytes(res.cleanedBytes)
      // Zresetuj statystyki po czyszczeniu
      setCleanupStats({ tempSize: 0, logSize: 0, cacheSize: 0 })
      setTimeout(() => setCleanedBytes(null), 4000)
    }
    setCleaning(false)
  }

  const loadStartupApps = async () => {
    setLoadingStartup(true)
    const res = await window.api.getStartupApps()
    if (res.success && res.data) {
      setStartupApps(res.data)
    }
    setLoadingStartup(false)
  }

  const handleToggleStartup = async (app: StartupApp) => {
    setTogglingApp(app.name)
    const nextState = !app.enabled
    const res = await window.api.toggleStartupApp(app.name, nextState)
    if (res.success) {
      // Zaktualizuj stan lokalny
      setStartupApps((prev) =>
        prev.map((item) => (item.name === app.name ? { ...item, enabled: nextState } : item))
      )
    }
    setTogglingApp(null)
  }

  const loadPrivacySettings = async () => {
    setLoadingPrivacy(true)
    const res = await window.api.getPrivacySettings()
    if (res.success && res.data) {
      setPrivacySettings(res.data)
    }
    setLoadingPrivacy(false)
  }

  const handleTogglePrivacy = async (key: string, currentValue: boolean) => {
    setTogglingPrivacyKey(key)
    const nextState = !currentValue

    try {
      const autoRestoreRes = await window.api.getSetting('auto_restore_point', 'true')
      if (autoRestoreRes.value === 'true') {
        setCreatingRestorePoint(true)
        setRestorePointStatus('Inicjowanie punktu przywracania... Zaakceptuj monit administratora (UAC) na pasku zadań.')
        const rpRes = await window.api.createRestorePoint()
        if (!rpRes.success) {
          alert(rpRes.error || 'Nie udało się utworzyć punktu przywracania systemu Windows.')
          setCreatingRestorePoint(false)
          setTogglingPrivacyKey(null)
          return
        }
      }
    } catch (err) {
      console.error('Błąd punktu przywracania:', err)
    } finally {
      setCreatingRestorePoint(false)
    }

    const res = await window.api.togglePrivacySetting(key, nextState)
    if (res.success) {
      setPrivacySettings((prev) => ({ ...prev, [key]: nextState }))
    }
    setTogglingPrivacyKey(null)
  }

  useEffect(() => {
    if (activeTab === 'cleanup') {
      loadCleanupStats()
    } else if (activeTab === 'startup') {
      loadStartupApps()
    } else if (activeTab === 'privacy') {
      loadPrivacySettings()
    }
  }, [activeTab])

  // Pomocnicze formatowanie rozmiarów
  const formatBytes = (bytes: number): string => {
    if (bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const totalJunkBytes = cleanupStats.tempSize + cleanupStats.logSize + cleanupStats.cacheSize
  const formattedTotal = formatBytes(totalJunkBytes)

  return (
    <div className="optimizer-container fade-in">
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
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}>Optymalizator Systemowy</h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
            Bezpieczne czyszczenie plików tymczasowych oraz przyspieszanie rozruchu Windows
          </p>
        </div>
        <div className="flex gap-sm">
          <button
            className={`tab-btn ${activeTab === 'cleanup' ? 'active-clean' : ''}`}
            onClick={() => setActiveTab('cleanup')}
          >
            Czyszczenie Dysku
          </button>
          <button
            className={`tab-btn ${activeTab === 'startup' ? 'active-startup' : ''}`}
            onClick={() => setActiveTab('startup')}
          >
            Programy Startowe
          </button>
          <button
            className={`tab-btn ${activeTab === 'privacy' ? 'active-privacy' : ''}`}
            onClick={() => setActiveTab('privacy')}
          >
            Prywatność
          </button>
        </div>
      </header>

      {/* Wybrany Panel */}
      {activeTab === 'cleanup' ? (
        <div className="flex flex-col gap-lg">
          {/* Panel Wskaźnika i Skanowania */}
          <div
            className="glass-panel cleanup-main flex flex-col items-center py-xl"
            style={{ gap: '24px', position: 'relative', overflow: 'hidden' }}
          >
            {/* Animowany radar w tle gdy skanuje */}
            {scanning && <div className="scanning-radar" />}

            <div className={`gauge-circle ${totalJunkBytes > 0 ? 'has-junk' : ''}`}>
              <div className="gauge-inner flex flex-col items-center justify-center">
                <HardDrive size={32} className="gauge-icon mb-xs" />
                <span className="gauge-value">{formattedTotal}</span>
                <span className="gauge-lbl">śmieci systemowych</span>
              </div>
            </div>

            <div className="flex gap-md z-index-1">
              <button
                className="btn btn-secondary flex items-center gap-xs"
                onClick={loadCleanupStats}
                disabled={scanning || cleaning}
              >
                <RefreshCw size={16} className={scanning ? 'spin' : ''} />
                <span>Skanuj ponownie</span>
              </button>
              {totalJunkBytes > 0 && (
                <button
                  className="btn btn-primary flex items-center gap-xs pulse-primary"
                  onClick={handleClean}
                  disabled={scanning || cleaning}
                >
                  <Trash2 size={16} />
                  <span>{cleaning ? 'Czyszczenie...' : 'Oczyść system'}</span>
                </button>
              )}
            </div>

            {cleanedBytes !== null && (
              <div className="clean-success flex items-center gap-sm glass-panel animate-slide-up">
                <CheckCircle size={20} color="var(--color-success)" />
                <span style={{ fontSize: '14px', fontWeight: 600 }}>
                  Pomyślnie oczyszczono:{' '}
                  <strong style={{ color: 'var(--color-success)' }}>
                    {formatBytes(cleanedBytes)}
                  </strong>
                  !
                </span>
              </div>
            )}
          </div>

          {/* Szczegóły Śmieci */}
          <div className="grid-details-cleanup">
            {/* Pliki Tymczasowe */}
            <div className="glass-panel detail-card flex items-center gap-lg">
              <div className="detail-icon-wrapper temp">
                <FolderOpen size={24} />
              </div>
              <div className="flex-1">
                <h4 className="detail-title">Pliki tymczasowe użytkownika</h4>
                <p className="text-muted text-xs">
                  Pozostałości po instalatorach, aplikacjach i plikach Temp
                </p>
              </div>
              <span className="detail-size">{formatBytes(cleanupStats.tempSize)}</span>
            </div>

            {/* Logi Systemowe */}
            <div className="glass-panel detail-card flex items-center gap-lg">
              <div className="detail-icon-wrapper logs">
                <Info size={24} />
              </div>
              <div className="flex-1">
                <h4 className="detail-title">Logi i raporty błędów</h4>
                <p className="text-muted text-xs">
                  Archiwalne pliki logowania Windows, zrzuty pamięci i raporty
                </p>
              </div>
              <span className="detail-size">{formatBytes(cleanupStats.logSize)}</span>
            </div>

            {/* Cache Przeglądarek */}
            <div className="glass-panel detail-card flex items-center gap-lg">
              <div className="detail-icon-wrapper cache">
                <Zap size={24} />
              </div>
              <div className="flex-1">
                <h4 className="detail-title">Pamięć podręczna przeglądarek</h4>
                <p className="text-muted text-xs">
                  Pliki cache Google Chrome, Microsoft Edge oraz Mozilla Firefox
                </p>
              </div>
              <span className="detail-size">{formatBytes(cleanupStats.cacheSize)}</span>
            </div>
          </div>
        </div>
      ) : activeTab === 'startup' ? (
        /* Panel Programów Startowych */
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px' }}>
          <h3
            className="flex items-center gap-sm mb-lg"
            style={{ fontSize: '18px', margin: '0 0 20px 0' }}
          >
            <Cpu size={20} style={{ color: 'var(--color-secondary)' }} />
            Menedżer autostartu rejestru (HKCU Run)
          </h3>

          {loadingStartup ? (
            <div
              className="flex flex-col items-center justify-center py-xl"
              style={{ gap: '16px' }}
            >
              <div className="loader-spin"></div>
              <span className="text-muted text-sm">Wyszukiwanie aplikacji startowych...</span>
            </div>
          ) : startupApps.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-xl text-center"
              style={{ gap: '12px' }}
            >
              <PlayCircle size={48} className="text-muted" />
              <p className="text-muted font-medium">Brak programów w autostarcie</p>
              <p className="text-xs text-muted max-w-[400px]">
                Nie znaleziono żadnych spersonalizowanych wpisów w kluczu rejestru autostartu
                użytkownika.
              </p>
            </div>
          ) : (
            <div className="startup-list">
              {startupApps.map((app, i) => (
                <div key={i} className="startup-card glass-panel flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-lg">
                    <div className="flex items-center gap-md mb-xs">
                      <h4 className="startup-name truncate" title={app.name}>
                        {app.name}
                      </h4>
                      <span className={`status-badge ${app.enabled ? 'active' : 'disabled'}`}>
                        {app.enabled ? 'Aktywne' : 'Wyłączone'}
                      </span>
                    </div>
                    <p className="startup-cmd truncate text-xs text-muted" title={app.command}>
                      {app.command}
                    </p>
                  </div>
                  <div className="flex items-center gap-md">
                    <span className="text-xs text-muted font-bold" style={{ letterSpacing: '1px' }}>
                      {app.location}
                    </span>
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={app.enabled}
                        disabled={togglingApp === app.name}
                        onChange={() => handleToggleStartup(app)}
                      />
                      <span className="slider"></span>
                    </label>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Panel Prywatności i Telemetrii */
        <div className="glass-panel" style={{ padding: '24px', borderRadius: '24px' }}>
          <div className="flex justify-between items-center mb-lg" style={{ marginBottom: '20px' }}>
            <h3 className="flex items-center gap-sm" style={{ fontSize: '18px', margin: 0 }}>
              <Shield size={20} style={{ color: 'var(--color-primary)' }} />
              Prywatność, Telemetria i Reklamy Windows
            </h3>
            <button
              className="btn btn-secondary flex items-center gap-xs"
              onClick={loadPrivacySettings}
              disabled={loadingPrivacy}
              style={{ padding: '8px 14px', borderRadius: '10px' }}
            >
              <RefreshCw size={14} className={loadingPrivacy ? 'spin' : ''} />
              <span>Odśwież stan</span>
            </button>
          </div>

          {loadingPrivacy ? (
            <div className="flex flex-col items-center justify-center py-xl" style={{ gap: '16px' }}>
              <div className="loader-spin"></div>
              <span className="text-muted text-sm">Sprawdzanie ustawień prywatności...</span>
            </div>
          ) : (
            <div className="startup-list">
              {/* Telemetria */}
              <div className="startup-card glass-panel flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-lg">
                  <div className="flex items-center gap-md mb-xs">
                    <h4 className="startup-name truncate">Telemetria systemowa (DiagTrack)</h4>
                    <span className={`status-badge ${privacySettings.telemetry ? 'disabled' : 'active'}`}>
                      {privacySettings.telemetry ? 'Aktywna (Brak optymalizacji)' : 'Zoptymalizowano (Wyłączona)'}
                    </span>
                  </div>
                  <p className="startup-cmd truncate text-xs text-muted" style={{ fontFamily: 'inherit', maxWidth: '100%' }}>
                    Wysyła dane diagnostyczne, informacje o użytkowaniu i telemetrię do firmy Microsoft.
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <span className="text-xs text-muted font-bold" style={{ color: privacySettings.telemetry ? 'var(--color-error)' : '#34d399' }}>
                    {privacySettings.telemetry ? 'Włączona' : 'Zablokowana'}
                  </span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={privacySettings.telemetry}
                      disabled={togglingPrivacyKey === 'telemetry'}
                      onChange={() => handleTogglePrivacy('telemetry', privacySettings.telemetry)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              {/* WerSvc */}
              <div className="startup-card glass-panel flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-lg">
                  <div className="flex items-center gap-md mb-xs">
                    <h4 className="startup-name truncate">Raportowanie Błędów (WerSvc)</h4>
                    <span className={`status-badge ${privacySettings.errorReporting ? 'disabled' : 'active'}`}>
                      {privacySettings.errorReporting ? 'Aktywne (Brak optymalizacji)' : 'Zoptymalizowano (Wyłączone)'}
                    </span>
                  </div>
                  <p className="startup-cmd truncate text-xs text-muted" style={{ fontFamily: 'inherit', maxWidth: '100%' }}>
                    Generuje i przesyła raporty o awariach oraz błędach aplikacji do Microsoft.
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <span className="text-xs text-muted font-bold" style={{ color: privacySettings.errorReporting ? 'var(--color-error)' : '#34d399' }}>
                    {privacySettings.errorReporting ? 'Włączone' : 'Zablokowane'}
                  </span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={privacySettings.errorReporting}
                      disabled={togglingPrivacyKey === 'errorReporting'}
                      onChange={() => handleTogglePrivacy('errorReporting', privacySettings.errorReporting)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              {/* Cortana */}
              <div className="startup-card glass-panel flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-lg">
                  <div className="flex items-center gap-md mb-xs">
                    <h4 className="startup-name truncate">Asystent Cortana & Bing Search</h4>
                    <span className={`status-badge ${privacySettings.cortana ? 'disabled' : 'active'}`}>
                      {privacySettings.cortana ? 'Aktywne (Brak optymalizacji)' : 'Zoptymalizowano (Wyłączone)'}
                    </span>
                  </div>
                  <p className="startup-cmd truncate text-xs text-muted" style={{ fontFamily: 'inherit', maxWidth: '100%' }}>
                    Integruje wyszukiwarkę Bing w menu Start oraz aktywuje zapytania asystenta głosowego Cortana.
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <span className="text-xs text-muted font-bold" style={{ color: privacySettings.cortana ? 'var(--color-error)' : '#34d399' }}>
                    {privacySettings.cortana ? 'Włączone' : 'Zablokowane'}
                  </span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={privacySettings.cortana}
                      disabled={togglingPrivacyKey === 'cortana'}
                      onChange={() => handleTogglePrivacy('cortana', privacySettings.cortana)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>

              {/* CDM Ads */}
              <div className="startup-card glass-panel flex items-center justify-between">
                <div className="flex-1 min-w-0 pr-lg">
                  <div className="flex items-center gap-md mb-xs">
                    <h4 className="startup-name truncate">Reklamy systemowe i aplikacje promowane</h4>
                    <span className={`status-badge ${privacySettings.ads ? 'disabled' : 'active'}`}>
                      {privacySettings.ads ? 'Aktywne (Brak optymalizacji)' : 'Zoptymalizowano (Wyłączone)'}
                    </span>
                  </div>
                  <p className="startup-cmd truncate text-xs text-muted" style={{ fontFamily: 'inherit', maxWidth: '100%' }}>
                    Blokuje automatyczną instalację zalecanych aplikacji (np. Candy Crush) oraz reklamy w menu Start.
                  </p>
                </div>
                <div className="flex items-center gap-md">
                  <span className="text-xs text-muted font-bold" style={{ color: privacySettings.ads ? 'var(--color-error)' : '#34d399' }}>
                    {privacySettings.ads ? 'Włączone' : 'Zablokowane'}
                  </span>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={privacySettings.ads}
                      disabled={togglingPrivacyKey === 'ads'}
                      onChange={() => handleTogglePrivacy('ads', privacySettings.ads)}
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Styled JSX */}
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

        .optimizer-container {
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

        .tab-btn {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.06);
          color: var(--color-text-secondary);
          padding: 10px 20px;
          border-radius: 14px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .tab-btn:hover {
          background: rgba(255, 255, 255, 0.03);
          color: #fff;
        }

        .tab-btn.active-clean {
          background: rgba(69, 243, 255, 0.1);
          border-color: var(--color-primary);
          color: var(--color-primary);
          box-shadow: 0 0 15px rgba(69, 243, 255, 0.15);
        }

        .tab-btn.active-startup {
          background: rgba(107, 78, 230, 0.1);
          border-color: var(--color-secondary);
          color: #b39ddb;
          box-shadow: 0 0 15px rgba(107, 78, 230, 0.15);
        }

        .tab-btn.active-privacy {
          background: rgba(16, 185, 129, 0.1);
          border-color: #10b981;
          color: #34d399;
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.15);
        }

        /* Cleanup Gauge */
        .cleanup-main {
          padding: 40px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .gauge-circle {
          width: 220px;
          height: 220px;
          border-radius: 50%;
          background: conic-gradient(rgba(255, 255, 255, 0.03) 0%, rgba(255, 255, 255, 0.03) 100%);
          border: 4px solid rgba(255, 255, 255, 0.04);
          padding: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.5s ease;
        }

        .gauge-circle.has-junk {
          border-color: rgba(69, 243, 255, 0.2);
          box-shadow: 0 0 30px rgba(69, 243, 255, 0.1);
        }

        .gauge-inner {
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background: rgba(11, 12, 16, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .gauge-icon {
          color: var(--color-text-muted);
        }

        .gauge-value {
          font-size: 32px;
          font-weight: 800;
          color: #fff;
        }

        .gauge-lbl {
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .pulse-primary {
          box-shadow: 0 0 15px var(--color-primary-glow);
          animation: pulseGlow 2s infinite alternate;
        }

        @keyframes pulseGlow {
          0% { box-shadow: 0 0 10px rgba(69, 243, 255, 0.3); }
          100% { box-shadow: 0 0 25px rgba(69, 243, 255, 0.6); }
        }

        .z-index-1 { z-index: 1; }

        /* Cleanup Cards */
        .grid-details-cleanup {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 20px;
          width: 100%;
        }

        .detail-card {
          padding: 20px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .detail-card:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.04);
          border-color: rgba(69, 243, 255, 0.15);
        }

        .detail-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .detail-icon-wrapper.temp { background: rgba(234, 179, 8, 0.1); color: var(--color-warning); }
        .detail-icon-wrapper.logs { background: rgba(107, 78, 230, 0.1); color: #b39ddb; }
        .detail-icon-wrapper.cache { background: rgba(69, 243, 255, 0.1); color: var(--color-primary); }

        .detail-title {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 700;
          color: #fff;
        }

        .detail-size {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
        }

        .clean-success {
          padding: 12px 24px;
          border-radius: 30px;
          background: rgba(16, 185, 129, 0.1) !important;
          border: 1px solid rgba(16, 185, 129, 0.2) !important;
          color: #34d399;
          animation: slideUp 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        @keyframes slideUp {
          from { transform: translateY(10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* Startup Apps List */
        .startup-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .startup-card {
          padding: 16px 20px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          transition: all 0.3s ease;
        }

        .startup-card:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.1);
        }

        .startup-name {
          margin: 0;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
        }

        .startup-cmd {
          margin: 0;
          color: var(--color-text-muted);
          font-family: 'Courier New', monospace;
          max-width: 500px;
        }

        .status-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 20px;
          text-transform: uppercase;
        }

        .status-badge.active {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .status-badge.disabled {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-muted);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Toggle switch */
        .switch {
          position: relative;
          display: inline-block;
          width: 50px;
          height: 26px;
          flex-shrink: 0;
        }

        .switch input {
          opacity: 0;
          width: 0;
          height: 0;
        }

        .slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(255, 255, 255, 0.1);
          transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 34px;
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .slider:before {
          position: absolute;
          content: "";
          height: 18px;
          width: 18px;
          left: 3px;
          bottom: 3px;
          background-color: #fff;
          transition: .3s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 50%;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        }

        input:checked + .slider {
          background-color: var(--color-primary);
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }

        /* Loader */
        .loader-spin {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(107, 78, 230, 0.1);
          border-top-color: var(--color-secondary);
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .spin {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .scanning-radar {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 400px;
          height: 400px;
          margin-top: -200px;
          margin-left: -200px;
          background: radial-gradient(circle, rgba(69, 243, 255, 0.05) 0%, transparent 70%);
          border-radius: 50%;
          animation: radarGlow 2s linear infinite;
          pointer-events: none;
        }

        @keyframes radarGlow {
          0% { transform: scale(0.5); opacity: 0; }
          50% { opacity: 0.5; }
          100% { transform: scale(1.5); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
