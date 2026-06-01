import { useState, useEffect } from 'react'
import {
  Package,
  Search,
  AlertCircle,
  ExternalLink,
  X,
  ShieldAlert,
  RefreshCw,
  Cpu,
  Monitor,
  Volume2,
  Wifi
} from 'lucide-react'
import { useLocation } from 'react-router-dom'
import { AppIcon } from '../components/AppIcon'
import { DownloadFailModal } from '../components/DownloadFailModal'

interface UpgradeError {
  appName: string
  wingetId: string
  message: string
}

interface UacApp {
  appName: string
  wingetId: string
}

export function SoftwareList() {
  const location = useLocation()
  const [upgradable, setUpgradable] = useState<any[]>([])
  const [installed, setInstalled] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [upgradingId, setUpgradingId] = useState<string | null>(null)
  const [upgradeError, setUpgradeError] = useState<UpgradeError | null>(null)
  const [uacApp, setUacApp] = useState<UacApp | null>(null)
  const [elevating, setElevating] = useState(false)
  const [activeTab, setActiveTab] = useState<'upgradable' | 'installed' | 'drivers'>('upgradable')
  const [searchQuery, setSearchQuery] = useState('')
  const [upgradeStatus, setUpgradeStatus] = useState<'idle' | 'preflight' | 'downloading'>('idle')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [batchQueue, setBatchQueue] = useState<string[]>([])
  const [batchCurrentIndex, setBatchCurrentIndex] = useState<number>(-1)
  const [batchErrors, setBatchErrors] = useState<{ appName: string; error: string }[]>([])
  const [batchStatus, setBatchStatus] = useState<'idle' | 'running' | 'completed'>('idle')
  const [isFailModalOpen, setIsFailModalOpen] = useState(false)
  const [preflightResult, setPreflightResult] = useState<any>(null)
  const [failedApp, setFailedApp] = useState<any>(null)

  // Driver states
  const [drivers, setDrivers] = useState<any[]>([])
  const [assistants, setAssistants] = useState<any[]>([])
  const [installingId, setInstallingId] = useState<string | null>(null)
  const [uacInstallApp, setUacInstallApp] = useState<{ name: string; wingetId: string } | null>(
    null
  )

  // Uninstaller & Leftovers states
  const [uninstallingId, setUninstallingId] = useState<string | null>(null)
  const [showLeftoversModal, setShowLeftoversModal] = useState(false)
  const [leftoversAppName, setLeftoversAppName] = useState('')
  const [leftoversPublisher, setLeftoversPublisher] = useState('')
  const [leftoversFiles, setLeftoversFiles] = useState<string[]>([])
  const [leftoversRegs, setLeftoversRegs] = useState<string[]>([])
  const [scanningLeftovers, setScanningLeftovers] = useState(false)
  const [cleaningLeftovers, setCleaningLeftovers] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<string[]>([])
  const [selectedRegs, setSelectedRegs] = useState<string[]>([])
  const [uacUninstallApp, setUacUninstallApp] = useState<{ name: string; wingetId: string } | null>(null)

  useEffect(() => {
    if (location.state && (location.state as any).tab) {
      setActiveTab((location.state as any).tab)
    }
  }, [location.state])

  const fetchData = async () => {
    setSelectedIds([])
    setLoading(true)
    setError(null)

    try {
      if (activeTab === 'upgradable') {
        const upgRes = await window.api.getUpgradableApps()
        if (upgRes.success) {
          setUpgradable(upgRes.data)
        } else {
          setError(upgRes.error || 'Błąd podczas pobierania aktualizacji.')
        }
      } else if (activeTab === 'installed') {
        const instRes = await window.api.getInstalledApps()
        if (instRes.success) {
          setInstalled(instRes.data)
        } else {
          setError(instRes.error || 'Błąd podczas pobierania zainstalowanych aplikacji.')
        }
      } else if (activeTab === 'drivers') {
        const [driversRes, assistantsRes] = await Promise.all([
          window.api.getSystemDrivers(),
          window.api.checkDriverAssistants()
        ])
        if (driversRes.success) {
          setDrivers(driversRes.data)
        } else {
          setError(driversRes.error || 'Błąd podczas pobierania sterowników systemowych.')
        }
        if (assistantsRes.success) {
          setAssistants(assistantsRes.data)
        }
      }
    } catch (err: any) {
      setError(err.message || 'Wystąpił nieoczekiwany błąd.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [activeTab])

  const handleUpgrade = async (app: any, skipPreflight = false) => {
    setUpgradingId(app.id)
    setUpgradeError(null)
    setUacApp(null)

    if (!skipPreflight) {
      setUpgradeStatus('preflight')
      try {
        const pfRes = await window.api.preflightDownload(app.id)
        if (!pfRes.canDownload) {
          setPreflightResult(pfRes)
          setFailedApp(app)
          setIsFailModalOpen(true)
          setUpgradingId(null)
          setUpgradeStatus('idle')
          return
        }
      } catch (err: any) {
        console.error('Preflight check error:', err)
      }
    }

    setUpgradeStatus('downloading')
    const res = await window.api.upgradeApp({
      wingetId: app.id,
      name: app.name,
      previousVersion: app.version,
      newVersion: app.available
    })
    setUpgradingId(null)
    setUpgradeStatus('idle')
    if (res.success) {
      fetchData()
    } else if (res.requiresElevation) {
      // UAC wymagany — pokaż dedykowany modal (NIE generyczny error)
      setUacApp({ appName: app.name, wingetId: app.id })
    } else {
      setUpgradeError({
        appName: app.name,
        wingetId: app.id,
        message: res.error || 'Nieznany błąd podczas aktualizacji.'
      })
    }
  }

  const handleBatchUpgrade = async () => {
    const queue = [...selectedIds]
    setSelectedIds([])
    setBatchQueue(queue)
    setBatchStatus('running')
    setBatchErrors([])

    for (let i = 0; i < queue.length; i++) {
      const id = queue[i]
      setBatchCurrentIndex(i)
      setUpgradingId(id)

      const app = upgradable.find((a) => a.id === id)
      if (!app) continue

      setUpgradeStatus('preflight')
      try {
        // 1. Preflight check
        const pfRes = await window.api.preflightDownload(id)
        if (!pfRes.canDownload) {
          setBatchErrors((prev) => [
            ...prev,
            {
              appName: app.name,
              error: `Błąd preflight: ${pfRes.errorReason || 'Problem z siecią/plikiem'}`
            }
          ])
          continue
        }

        // 2. Run Upgrade
        setUpgradeStatus('downloading')
        const res = await window.api.upgradeApp({
          wingetId: app.id,
          name: app.name,
          previousVersion: app.version,
          newVersion: app.available
        })

        if (res.success) {
          // sukces
        } else if (res.requiresElevation) {
          await window.api.runElevatedUpgrade(app.id)
          setBatchErrors((prev) => [
            ...prev,
            { appName: app.name, error: 'Wymaga UAC — otwarto osobne okno instalacji.' }
          ])
        } else {
          setBatchErrors((prev) => [
            ...prev,
            { appName: app.name, error: res.error || 'Błąd instalatora.' }
          ])
        }
      } catch (err: any) {
        setBatchErrors((prev) => [
          ...prev,
          { appName: app.name, error: err.message || 'Nieoczekiwany błąd.' }
        ])
      }
    }

    setUpgradingId(null)
    setUpgradeStatus('idle')
    setBatchStatus('completed')
    setBatchCurrentIndex(-1)

    fetchData()
  }

  const handleTryAnyway = () => {
    setIsFailModalOpen(false)
    if (failedApp) {
      handleUpgrade(failedApp, true)
    }
  }

  const handleElevatedUpgrade = async () => {
    if (!uacApp) return
    setElevating(true)
    await window.api.runElevatedUpgrade(uacApp.wingetId)
    setElevating(false)
    setUacApp(null)
    // Informujemy użytkownika że powinien odświeżyć po zamknięciu okna CMD
  }

  const handleInstallAssistant = async (assistant: any) => {
    setInstallingId(assistant.wingetId)
    setUpgradeError(null)
    setUacInstallApp(null)

    const res = await window.api.installApp({
      wingetId: assistant.wingetId,
      name: assistant.name
    })

    setInstallingId(null)
    if (res.success) {
      fetchData()
    } else if (res.requiresElevation) {
      setUacInstallApp({ name: assistant.name, wingetId: assistant.wingetId })
    } else {
      setUpgradeError({
        appName: assistant.name,
        wingetId: assistant.wingetId,
        message: res.error || 'Nieznany błąd podczas instalacji.'
      })
    }
  }

  const handleElevatedInstall = async () => {
    if (!uacInstallApp) return
    setElevating(true)
    await window.api.runElevatedInstall(uacInstallApp.wingetId)
    setElevating(false)
    setUacInstallApp(null)
  }

  const handleLaunchAssistant = async (wingetId: string) => {
    const res = await window.api.launchDriverAssistant(wingetId)
    if (!res.success) {
      setUpgradeError({
        appName: 'Asystent Sterowników',
        wingetId: wingetId,
        message: res.error || 'Nie udało się uruchomić asystenta sterowników.'
      })
    }
  }

  const handleStartUninstall = async (app: any) => {
    setUninstallingId(app.id)
    setUacUninstallApp(null)
    setError(null)

    const res = await window.api.uninstallApp(app.id)
    setUninstallingId(null)

    if (res.success) {
      const publisher = app.id.split('.')[0] || ''
      setLeftoversAppName(app.name)
      setLeftoversPublisher(publisher)
      
      setShowLeftoversModal(true)
      setScanningLeftovers(true)
      setSelectedFiles([])
      setSelectedRegs([])
      setLeftoversFiles([])
      setLeftoversRegs([])

      try {
        const scanRes = await window.api.scanWin32Leftovers(app.name, publisher)
        if (scanRes.success) {
          setLeftoversFiles(scanRes.files)
          setLeftoversRegs(scanRes.registry)
          setSelectedFiles(scanRes.files)
          setSelectedRegs(scanRes.registry)
        }
      } catch (err) {
        console.error('Błąd skanowania pozostałości:', err)
      } finally {
        setScanningLeftovers(false)
      }
      
      fetchData()
    } else if (res.requiresElevation) {
      setUacUninstallApp({ name: app.name, wingetId: app.id })
    } else {
      setError(res.error || `Błąd deinstalacji aplikacji ${app.name}`)
    }
  }

  const handleElevatedUninstall = async () => {
    if (!uacUninstallApp) return
    setElevating(true)
    await window.api.runElevatedUninstall(uacUninstallApp.wingetId)
    setElevating(false)
    
    const appName = uacUninstallApp.name
    const wingetId = uacUninstallApp.wingetId
    setUacUninstallApp(null)
    
    const publisher = wingetId.split('.')[0] || ''
    setLeftoversAppName(appName)
    setLeftoversPublisher(publisher)
    setShowLeftoversModal(true)
    setScanningLeftovers(true)
    setSelectedFiles([])
    setSelectedRegs([])
    setLeftoversFiles([])
    setLeftoversRegs([])
    
    setTimeout(async () => {
      try {
        const scanRes = await window.api.scanWin32Leftovers(appName, publisher)
        if (scanRes.success) {
          setLeftoversFiles(scanRes.files)
          setLeftoversRegs(scanRes.registry)
          setSelectedFiles(scanRes.files)
          setSelectedRegs(scanRes.registry)
        }
      } catch (err) {
        console.error('Błąd skanowania pozostałości:', err)
      } finally {
        setScanningLeftovers(false)
      }
      fetchData()
    }, 6000)
  }

  const handleCleanLeftovers = async () => {
    setCleaningLeftovers(true)
    try {
      const cleanRes = await window.api.cleanWin32Leftovers(selectedFiles, selectedRegs)
      setError(`Pomyślnie wyczyszczono pozostałości! Usunięto foldery: ${cleanRes.filesDeleted}, klucze rejestru: ${cleanRes.regsDeleted}`)
      setShowLeftoversModal(false)
    } catch (err: any) {
      setError(err.message || 'Błąd czyszczenia pozostałości.')
    } finally {
      setCleaningLeftovers(false)
    }
  }

  const openManualDownload = (wingetId: string) => {
    const parts = wingetId.split('.')
    const publisher = parts[0]
    const pkg = parts.slice(1).join('.')
    const url = `https://winget.run/pkg/${publisher}/${pkg}`
    window.open(url, '_blank')
  }

  const filteredList = (activeTab === 'upgradable' ? upgradable : installed).filter(
    (app) =>
      app.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.id.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const displayedList = filteredList

  const renderDriversView = () => {
    return (
      <div className="flex flex-col gap-lg animate-fade-up" style={{ gap: '24px' }}>
        {/* Sekcja Asystentów */}
        <div className="glass-panel main-list-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#fff' }}>
            Asystenci Aktualizacji
          </h2>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
              gap: '16px'
            }}
          >
            {assistants.map((assistant, i) => {
              const hasHardware = drivers.some(
                (d) =>
                  d.Manufacturer.toLowerCase().includes(assistant.manufacturer.toLowerCase()) ||
                  d.DeviceName.toLowerCase().includes(assistant.manufacturer.toLowerCase())
              )

              if (
                !hasHardware &&
                assistant.manufacturer !== 'Intel' &&
                assistant.manufacturer !== 'Generic'
              ) {
                return null
              }

              const isInstalling = installingId === assistant.wingetId

              return (
                <div
                  key={i}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px solid rgba(255, 255, 255, 0.04)',
                    borderRadius: '16px',
                    padding: '18px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    gap: '12px'
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '8px'
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          background: 'rgba(69, 243, 255, 0.1)',
                          color: 'var(--color-primary)',
                          padding: '2px 8px',
                          borderRadius: '6px',
                          fontWeight: 700
                        }}
                      >
                        {assistant.manufacturer}
                      </span>
                      <span
                        style={{
                          fontSize: '11px',
                          color: assistant.installed ? '#34d399' : '#fbbf24',
                          fontWeight: 700
                        }}
                      >
                        {assistant.installed ? 'Zainstalowany ✓' : 'Brak w systemie'}
                      </span>
                    </div>
                    <h3
                      style={{
                        fontSize: '15px',
                        fontWeight: 700,
                        margin: '0 0 4px 0',
                        color: '#fff'
                      }}
                    >
                      {assistant.name}
                    </h3>
                    <p
                      style={{
                        fontSize: '12px',
                        color: 'rgba(255,255,255,0.4)',
                        margin: 0,
                        lineHeight: 1.5
                      }}
                    >
                      {assistant.description}
                    </p>
                  </div>

                  <div
                    style={{ display: 'flex', gap: '8px', marginTop: 'auto', paddingTop: '8px' }}
                  >
                    {assistant.installed ? (
                      <button
                        className="btn-action-primary"
                        style={{
                          width: '100%',
                          padding: '8px 0',
                          background: 'rgba(52, 211, 153, 0.15)',
                          border: '1px solid rgba(52, 211, 153, 0.4)',
                          color: '#34d399'
                        }}
                        onClick={() => handleLaunchAssistant(assistant.wingetId)}
                      >
                        Uruchom panel
                      </button>
                    ) : (
                      <button
                        className="btn-action-primary"
                        style={{ width: '100%', padding: '8px 0' }}
                        disabled={isInstalling}
                        onClick={() => handleInstallAssistant(assistant)}
                      >
                        {isInstalling ? 'Instalowanie...' : 'Zainstaluj automatycznie'}
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Sekcja Urządzeń */}
        <div className="glass-panel main-list-panel" style={{ padding: '24px' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 16px 0', color: '#fff' }}>
            Fizyczne Urządzenia w Systemie
          </h2>
          {drivers.length === 0 ? (
            <div className="empty-state" style={{ minHeight: '120px' }}>
              <Cpu size={32} />
              <p style={{ fontSize: '13px' }}>
                Nie wykryto urządzeń w kategoriach Display, Net, Audio.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {drivers.map((drv, idx) => {
                const getIcon = (cls: string) => {
                  switch (cls.toUpperCase()) {
                    case 'DISPLAY':
                      return <Monitor size={18} color="var(--color-primary)" />
                    case 'NET':
                      return <Wifi size={18} color="var(--color-secondary)" />
                    case 'MEDIA':
                      return <Volume2 size={18} color="#fb7185" />
                    default:
                      return <Cpu size={18} color="#818cf8" />
                  }
                }
                const getClassLabel = (cls: string) => {
                  switch (cls.toUpperCase()) {
                    case 'DISPLAY':
                      return 'Karta Graficzna'
                    case 'NET':
                      return 'Sieć / Wi-Fi'
                    case 'MEDIA':
                      return 'Kontroler Audio'
                    default:
                      return 'Urządzenie Systemowe'
                  }
                }
                return (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '12px 18px',
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.04)',
                      borderRadius: '12px'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                      <div
                        style={{
                          background: 'rgba(255,255,255,0.03)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderRadius: '10px',
                          padding: '8px',
                          display: 'flex'
                        }}
                      >
                        {getIcon(drv.DeviceClass)}
                      </div>
                      <div>
                        <h4 style={{ fontSize: '14px', fontWeight: 600, margin: 0, color: '#fff' }}>
                          {drv.DeviceName}
                        </h4>
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            fontSize: '11px',
                            color: 'rgba(255,255,255,0.4)',
                            marginTop: '2px'
                          }}
                        >
                          <span>{getClassLabel(drv.DeviceClass)}</span>
                          <span className="dot" />
                          <span>Producent: {drv.Manufacturer}</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontSize: '11px',
                          background: 'rgba(255,255,255,0.05)',
                          color: '#fff',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontWeight: 700,
                          fontFamily: 'monospace'
                        }}
                      >
                        v{drv.DriverVersion}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-lg h-100" style={{ paddingRight: '16px', overflowY: 'auto' }}>
      <header className="flex items-center justify-between animate-fade-in">
        <div>
          <div className="flex items-center gap-sm">
            <h1
              style={{
                fontSize: '28px',
                background: 'linear-gradient(90deg, #fff, #888)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                margin: 0
              }}
            >
              Oprogramowanie
            </h1>
            <span className="results-badge">
              {activeTab === 'drivers' ? drivers.length : filteredList.length}
            </span>
          </div>
          <p className="text-muted" style={{ marginTop: '4px' }}>
            {activeTab === 'drivers'
              ? 'Wykrywaj podzespoły sprzętowe i instaluj oficjalne sterowniki.'
              : 'Zarządzaj swoimi aplikacjami i aktualizacjami przez Winget.'}
          </p>
        </div>

        <div className="flex gap-sm items-center">
          <button className="btn-refresh" onClick={fetchData} disabled={loading}>
            Odśwież
          </button>
          <div className="tab-container">
            <button
              className={`tab-btn ${activeTab === 'upgradable' ? 'active' : ''}`}
              onClick={() => setActiveTab('upgradable')}
            >
              Aktualizacje
            </button>
            <button
              className={`tab-btn ${activeTab === 'installed' ? 'active' : ''}`}
              onClick={() => setActiveTab('installed')}
            >
              Zainstalowane
            </button>
            <button
              className={`tab-btn ${activeTab === 'drivers' ? 'active' : ''}`}
              onClick={() => setActiveTab('drivers')}
            >
              Sterowniki
            </button>
          </div>
        </div>
      </header>

      {error && (
        <div className="error-banner animate-fade-in">
          <AlertCircle size={18} />
          <p>{error}</p>
        </div>
      )}

      {upgradeError && (
        <div className="upgrade-error-panel animate-fade-in">
          <div className="upgrade-error-header">
            <div className="flex items-center gap-sm">
              <AlertCircle size={18} color="#f87171" />
              <strong>Aktualizacja nie powiodła się: {upgradeError.appName}</strong>
            </div>
            <button className="upgrade-error-close" onClick={() => setUpgradeError(null)}>
              <X size={16} />
            </button>
          </div>
          <p className="upgrade-error-msg">{upgradeError.message}</p>
          <div className="upgrade-error-footer">
            <span className="upgrade-error-hint">
              💡 Możesz pobrać aktualizację ręcznie ze strony producenta:
            </span>
            <button
              className="btn-manual-download"
              onClick={() => openManualDownload(upgradeError.wingetId)}
            >
              <ExternalLink size={14} />
              Pobierz ręcznie
            </button>
          </div>
        </div>
      )}

      {uacApp && (
        <div className="uac-modal animate-fade-in">
          <div className="uac-modal-header">
            <div className="flex items-center gap-sm">
              <ShieldAlert size={20} color="#fb923c" />
              <strong>Wymagane uprawnienia administratora</strong>
            </div>
            <button className="upgrade-error-close" onClick={() => setUacApp(null)}>
              <X size={16} />
            </button>
          </div>
          <p className="uac-modal-app">📦 {uacApp.appName}</p>
          <p className="uac-modal-desc">
            Instalator tej aplikacji wymaga uprawnień administratora Windows (UAC). Kliknij poniższy
            przycisk — system wyświetli <strong>jedno okno UAC</strong>, po jego zatwierdzeniu
            instalacja uruchomi się w osobnym oknie.
          </p>
          <div className="uac-modal-footer">
            <span className="upgrade-error-hint">
              <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Po zakończeniu instalacji odśwież listę w aplikacji.
            </span>
            <button
              className="btn-uac-elevate"
              disabled={elevating}
              onClick={handleElevatedUpgrade}
            >
              <ShieldAlert size={14} />
              {elevating ? 'Otwieranie...' : 'Otwórz okno instalacji (UAC)'}
            </button>
          </div>
        </div>
      )}

      {uacInstallApp && (
        <div
          className="uac-modal animate-fade-in"
          style={{
            borderColor: 'rgba(69, 243, 255, 0.25)',
            background: 'rgba(69, 243, 255, 0.04)'
          }}
        >
          <div className="uac-modal-header" style={{ color: 'var(--color-primary)' }}>
            <div className="flex items-center gap-sm">
              <ShieldAlert size={20} color="var(--color-primary)" />
              <strong>Wymagane uprawnienia administratora</strong>
            </div>
            <button className="upgrade-error-close" onClick={() => setUacInstallApp(null)}>
              <X size={16} />
            </button>
          </div>
          <p className="uac-modal-app">📦 {uacInstallApp.name}</p>
          <p className="uac-modal-desc">
            Instalator tego asystenta sterowników wymaga uprawnień administratora Windows (UAC).
            Kliknij poniższy przycisk — system wyświetli <strong>jedno okno UAC</strong>, po jego
            zatwierdzeniu instalacja asystenta uruchomi się w osobnym oknie.
          </p>
          <div className="uac-modal-footer" style={{ borderTopColor: 'rgba(69, 243, 255, 0.1)' }}>
            <span className="upgrade-error-hint">
              <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Po zakończeniu instalacji odśwież listę, aby zaktualizować status.
            </span>
            <button
              className="btn-uac-elevate"
              style={{
                color: '#000',
                background: 'var(--color-primary)',
                borderColor: 'var(--color-primary)'
              }}
              disabled={elevating}
              onClick={handleElevatedInstall}
            >
              <ShieldAlert size={14} />
              {elevating ? 'Otwieranie...' : 'Otwórz okno instalacji (UAC)'}
            </button>
          </div>
        </div>
      )}

      {uacUninstallApp && (
        <div className="uac-modal animate-fade-in" style={{ borderColor: 'rgba(239, 68, 68, 0.25)', background: 'rgba(239, 68, 68, 0.04)' }}>
          <div className="uac-modal-header" style={{ color: '#f87171' }}>
            <div className="flex items-center gap-sm">
              <ShieldAlert size={20} color="#f87171" />
              <strong>Wymagane uprawnienia administratora do deinstalacji</strong>
            </div>
            <button className="upgrade-error-close" onClick={() => setUacUninstallApp(null)}>
              <X size={16} />
            </button>
          </div>
          <p className="uac-modal-app">📦 {uacUninstallApp.name}</p>
          <p className="uac-modal-desc">
            Deinstalator tego programu wymaga uprawnień administratora Windows (UAC). Kliknij poniższy
            przycisk — system wyświetli <strong>jedno okno UAC</strong>, po jego zatwierdzeniu deinstalacja
            uruchomi się w osobnym oknie.
          </p>
          <div className="uac-modal-footer" style={{ borderTopColor: 'rgba(239, 68, 68, 0.1)' }}>
            <span className="upgrade-error-hint">
              <RefreshCw size={12} style={{ display: 'inline', marginRight: '4px' }} />
              Po zakończeniu deinstalacji nastąpi wyszukanie pozostałości.
            </span>
            <button
              className="btn-uac-elevate"
              style={{
                color: '#fff',
                background: 'rgba(239, 68, 68, 0.2)',
                borderColor: 'rgba(239, 68, 68, 0.5)'
              }}
              disabled={elevating}
              onClick={handleElevatedUninstall}
            >
              <ShieldAlert size={14} />
              {elevating ? 'Otwieranie...' : 'Odinstaluj z UAC'}
            </button>
          </div>
        </div>
      )}

      {showLeftoversModal && (
        <div className="uac-modal animate-fade-in" style={{ borderColor: 'rgba(69, 243, 255, 0.3)', background: 'rgba(4, 5, 7, 0.98)', position: 'fixed', top: '10%', left: '15%', right: '15%', zIndex: 1000, boxShadow: '0 20px 40px rgba(0,0,0,0.8)', maxHeight: '80%', overflowY: 'auto' }}>
          <div className="uac-modal-header" style={{ color: 'var(--color-primary)' }}>
            <div className="flex items-center gap-sm">
              <RefreshCw size={20} className={scanningLeftovers ? 'spin' : ''} color="var(--color-primary)" />
              <strong>Analizator Pozostałości (Leftovers Cleaner)</strong>
            </div>
            <button className="upgrade-error-close" onClick={() => setShowLeftoversModal(false)}>
              <X size={16} />
            </button>
          </div>
          
          <div className="flex flex-col gap-sm" style={{ padding: '8px 0' }}>
            <h3 style={{ fontSize: '15px', color: '#fff', margin: 0 }}>Pozostałości po programie: <strong className="text-primary">{leftoversAppName}</strong> {leftoversPublisher && <span className="text-xs text-muted">({leftoversPublisher})</span>}</h3>
            <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
              Wyszukaliśmy foldery na dysku oraz klucze rejestru Windows, które mogły pozostać po odinstalowaniu programu. Zaznacz elementy, które chcesz trwale usunąć.
            </p>
            
            {scanningLeftovers ? (
              <div className="flex flex-col items-center justify-center py-8 gap-sm">
                <div className="loader animate-spin rounded-full h-8 w-8 border-3 border-primary border-t-transparent" />
                <span className="text-xs text-muted animate-pulse">Skanowanie rejestru i dysków systemowych...</span>
              </div>
            ) : (leftoversFiles.length === 0 && leftoversRegs.length === 0) ? (
              <div className="text-center py-8">
                <span className="text-xs text-success font-bold">✓ Brak wykrytych pozostałości! System jest czysty.</span>
              </div>
            ) : (
              <div className="flex flex-col gap-md" style={{ maxHeight: '350px', overflowY: 'auto', paddingRight: '6px' }}>
                {/* Foldery */}
                {leftoversFiles.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Wykryte foldery ({leftoversFiles.length}):</h4>
                    <div className="flex flex-col gap-xs">
                      {leftoversFiles.map((file, idx) => (
                        <label key={idx} className="flex items-center gap-sm" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', cursor: 'pointer', fontSize: '11px' }}>
                          <input
                            type="checkbox"
                            checked={selectedFiles.includes(file)}
                            onChange={() => {
                              if (selectedFiles.includes(file)) {
                                setSelectedFiles(prev => prev.filter(f => f !== file))
                              } else {
                                setSelectedFiles(prev => [...prev, file])
                              }
                            }}
                          />
                          <span className="font-mono text-white break-all">{file}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Rejestr */}
                {leftoversRegs.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2">Klucze rejestru ({leftoversRegs.length}):</h4>
                    <div className="flex flex-col gap-xs">
                      {leftoversRegs.map((reg, idx) => (
                        <label key={idx} className="flex items-center gap-sm" style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', cursor: 'pointer', fontSize: '11px' }}>
                          <input
                            type="checkbox"
                            checked={selectedRegs.includes(reg)}
                            onChange={() => {
                              if (selectedRegs.includes(reg)) {
                                setSelectedRegs(prev => prev.filter(r => r !== reg))
                              } else {
                                setSelectedRegs(prev => [...prev, reg])
                              }
                            }}
                          />
                          <span className="font-mono text-white break-all">{reg}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div className="uac-modal-footer" style={{ borderTopColor: 'rgba(69, 243, 255, 0.1)', marginTop: '8px' }}>
            <span className="upgrade-error-hint">
              ⚠️ Usunięcie wymaga jednorazowych uprawnień administratora (UAC).
            </span>
            <div className="flex gap-sm">
              <button
                className="btn-uac-elevate"
                style={{ background: 'rgba(255,255,255,0.05)', color: '#fff', borderColor: 'rgba(255,255,255,0.1)' }}
                onClick={() => setShowLeftoversModal(false)}
              >
                Anuluj
              </button>
              <button
                className="btn-uac-elevate"
                style={{
                  color: '#000',
                  background: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)'
                }}
                disabled={cleaningLeftovers || scanningLeftovers || (selectedFiles.length === 0 && selectedRegs.length === 0)}
                onClick={handleCleanLeftovers}
              >
                {cleaningLeftovers ? 'Czyszczenie...' : `Usuń zaznaczone (${selectedFiles.length + selectedRegs.length})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col items-center justify-center h-100 gap-md">
          <div className="loader" />
          <p className="text-muted animate-pulse">
            {activeTab === 'drivers'
              ? 'Skanowanie sterowników w systemie...'
              : 'Przeszukiwanie repozytorium Winget...'}
          </p>
        </div>
      ) : activeTab === 'drivers' ? (
        renderDriversView()
      ) : (
        <div className="flex flex-col gap-sm animate-fade-up">
          {/* Batch Running Panel */}
          {batchStatus === 'running' && (
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: '18px',
                border: '1px solid rgba(69, 243, 255, 0.2)',
                background: 'rgba(69, 243, 255, 0.03)',
                marginBottom: '4px'
              }}
            >
              <div className="flex justify-between items-center mb-sm">
                <h3
                  style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: 'var(--color-primary)' }}
                >
                  Trwa masowa aktualizacja programów...
                </h3>
                <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>
                  Aplikacja {batchCurrentIndex + 1} z {batchQueue.length}
                </span>
              </div>

              <div
                style={{
                  width: '100%',
                  height: '8px',
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  marginBottom: '12px'
                }}
              >
                <div
                  style={{
                    width: `${((batchCurrentIndex + 1) / batchQueue.length) * 100}%`,
                    height: '100%',
                    background: 'var(--color-primary)',
                    boxShadow: '0 0 10px var(--color-primary-glow)',
                    transition: 'width 0.4s ease'
                  }}
                />
              </div>

              <div
                style={{
                  fontSize: '13px',
                  color: 'rgba(255,255,255,0.8)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <RefreshCw size={14} className="spin" style={{ color: 'var(--color-primary)' }} />
                <span>
                  Aktualizowanie:{' '}
                  <strong>
                    {upgradable.find((a) => a.id === batchQueue[batchCurrentIndex])?.name ||
                      batchQueue[batchCurrentIndex]}
                  </strong>
                </span>
              </div>

              {batchErrors.length > 0 && (
                <div
                  style={{
                    marginTop: '12px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: '10px'
                  }}
                >
                  <div
                    style={{ fontSize: '12px', fontWeight: 600, color: '#f87171', marginBottom: '6px' }}
                  >
                    Uwagi i błędy z tej sesji:
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      maxHeight: '100px',
                      overflowY: 'auto'
                    }}
                  >
                    {batchErrors.map((err, idx) => (
                      <div key={idx} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                        ⚠️ <strong>{err.appName}</strong>: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Batch Completed Panel */}
          {batchStatus === 'completed' && (
            <div
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: '18px',
                border: '1px solid rgba(52, 211, 153, 0.2)',
                background: 'rgba(52, 211, 153, 0.03)',
                marginBottom: '4px'
              }}
            >
              <div className="flex justify-between items-center mb-sm">
                <h3 style={{ fontSize: '15px', fontWeight: 700, margin: 0, color: '#34d399' }}>
                  Masowa aktualizacja zakończona!
                </h3>
                <button className="upgrade-error-close" onClick={() => setBatchStatus('idle')}>
                  <X size={16} />
                </button>
              </div>
              <p style={{ fontSize: '13px', color: 'rgba(255,255,255,0.7)', margin: 0 }}>
                Zakończono proces aktualizacji {batchQueue.length} programów.
              </p>

              {batchErrors.length > 0 ? (
                <div
                  style={{
                    marginTop: '12px',
                    borderTop: '1px solid rgba(255,255,255,0.06)',
                    paddingTop: '10px'
                  }}
                >
                  <div
                    style={{ fontSize: '12px', fontWeight: 600, color: '#f87171', marginBottom: '6px' }}
                  >
                    Podsumowanie problemów:
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '4px',
                      maxHeight: '100px',
                      overflowY: 'auto'
                    }}
                  >
                    {batchErrors.map((err, idx) => (
                      <div key={idx} style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>
                        ⚠️ <strong>{err.appName}</strong>: {err.error}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: '11px', color: '#34d399', marginTop: '6px', marginBottom: 0 }}>
                  ✓ Wszystkie wybrane aplikacje zaktualizowały się pomyślnie.
                </p>
              )}
            </div>
          )}

          {/* Bulk Action Header */}
          {activeTab === 'upgradable' && upgradable.length > 0 && batchStatus !== 'running' && (
            <div
              className="flex justify-between items-center glass-panel"
              style={{
                padding: '12px 20px',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                background: 'rgba(255, 255, 255, 0.01)',
                marginBottom: '4px'
              }}
            >
              <div
                className="flex items-center gap-md"
                style={{ userSelect: 'none', cursor: 'pointer' }}
                onClick={() => {
                  if (selectedIds.length === filteredList.length) {
                    setSelectedIds([])
                  } else {
                    setSelectedIds(filteredList.map((a) => a.id))
                  }
                }}
              >
                <input
                  type="checkbox"
                  checked={filteredList.length > 0 && selectedIds.length === filteredList.length}
                  onChange={() => {}} // handled by click container
                  style={{
                    cursor: 'pointer',
                    accentColor: 'var(--color-primary)',
                    width: '16px',
                    height: '16px'
                  }}
                />
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                  Zaznacz wszystkie ({selectedIds.length} z {filteredList.length})
                </span>
              </div>

              <button
                className="btn-action-primary"
                disabled={selectedIds.length === 0 || upgradingId !== null}
                onClick={handleBatchUpgrade}
                style={{
                  padding: '10px 20px',
                  borderRadius: '10px',
                  background: selectedIds.length > 0 ? 'var(--color-primary)' : 'rgba(255,255,255,0.05)',
                  color: selectedIds.length > 0 ? '#000' : 'rgba(255,255,255,0.3)',
                  border: selectedIds.length > 0 ? 'none' : '1px solid rgba(255,255,255,0.08)',
                  boxShadow: selectedIds.length > 0 ? '0 4px 15px rgba(69, 243, 255, 0.3)' : 'none',
                  cursor: selectedIds.length > 0 ? 'pointer' : 'not-allowed'
                }}
              >
                <span>Aktualizuj zaznaczone ({selectedIds.length})</span>
              </button>
            </div>
          )}

          <div className="glass-panel main-list-panel">
            <div className="search-box">
              <Search size={18} className="text-muted" />
              <input
                type="text"
                placeholder="Wyszukaj aplikację na liście..."
                className="search-input"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {displayedList.length === 0 ? (
              <div className="empty-state">
                <Package size={48} />
                <p>{error ? 'Błąd połączenia z Winget.' : 'Brak aplikacji do wyświetlenia.'}</p>
                {!error && activeTab === 'upgradable' && (
                  <p style={{ fontSize: '12px' }}>Twój system jest aktualny!</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {displayedList.map((app, i) => (
                  <div
                    key={i}
                    className="software-item animate-fade-up"
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <div className="flex items-center gap-md">
                      {activeTab === 'upgradable' && batchStatus !== 'running' && (
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(app.id)}
                          onChange={(e) => {
                            e.stopPropagation()
                            if (selectedIds.includes(app.id)) {
                              setSelectedIds((prev) => prev.filter((id) => id !== app.id))
                            } else {
                              setSelectedIds((prev) => [...prev, app.id])
                            }
                          }}
                          style={{
                            cursor: 'pointer',
                            accentColor: 'var(--color-primary)',
                            marginRight: '8px',
                            width: '16px',
                            height: '16px'
                          }}
                        />
                      )}
                      <AppIcon wingetId={app.id} name={app.name} homepage={app.homepage} size={36} />
                      <div>
                        <h3 className="app-name">{app.name}</h3>
                        <div className="app-meta">
                          <span>{app.id}</span>
                          <span className="dot" />
                          <span>v{app.version}</span>
                          {app.available && (
                            <>
                              <span className="dot" />
                              <span className="update-badge">Dostępna: {app.available}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-sm">
                      <button
                        className="btn-action-secondary"
                        onClick={() => (window.location.hash = `#/software/${app.id}`)}
                      >
                        Szczegóły
                      </button>
                      {activeTab === 'installed' && (
                        <button
                          className="btn-action-primary"
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            color: '#f87171',
                            border: '1px solid rgba(239, 68, 68, 0.35)',
                            boxShadow: 'none'
                          }}
                          disabled={uninstallingId === app.id}
                          onClick={() => handleStartUninstall(app)}
                        >
                          {uninstallingId === app.id ? 'Usuwanie...' : 'Odinstaluj'}
                        </button>
                      )}
                      {activeTab === 'upgradable' && (
                        <button
                          className="btn-action-primary"
                          disabled={upgradingId === app.id}
                          onClick={() => handleUpgrade(app)}
                        >
                          {upgradingId === app.id
                            ? upgradeStatus === 'preflight'
                              ? 'Weryfikowanie...'
                              : 'Pobieranie...'
                            : 'Aktualizuj'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        .results-badge {
          background: rgba(69, 243, 255, 0.1);
          color: var(--color-primary);
          padding: 2px 8px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 700;
          border: 1px solid rgba(69, 243, 255, 0.2);
        }
        .tab-container {
          background: rgba(0,0,0,0.3);
          padding: 4px;
          border-radius: 12px;
          display: flex;
          gap: 4px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .tab-btn {
          padding: 6px 16px;
          border-radius: 8px;
          border: none;
          background: transparent;
          color: rgba(255,255,255,0.5);
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }
        .tab-btn:hover { color: #fff; }
        .tab-btn.active {
          background: rgba(69, 243, 255, 0.1);
          color: var(--color-primary);
          box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        }

        .btn-refresh {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          padding: 8px 16px;
          border-radius: 10px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
        }
        .btn-refresh:hover { background: rgba(255,255,255,0.1); }
        .btn-refresh:disabled { opacity: 0.5; }

        .error-banner {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 20px;
          background: rgba(239, 68, 68, 0.1);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 12px;
          color: #ef4444;
          font-size: 14px;
        }
        .error-banner p { margin: 0; font-weight: 500; }

        .upgrade-error-panel {
          background: rgba(239, 68, 68, 0.06);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 14px;
          padding: 16px 20px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .upgrade-error-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #f87171;
          font-size: 14px;
        }
        .upgrade-error-msg {
          margin: 0;
          font-size: 12px;
          color: rgba(255,255,255,0.5);
          font-family: 'Courier New', monospace;
          background: rgba(0,0,0,0.25);
          padding: 8px 12px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.04);
          word-break: break-word;
          max-height: 80px;
          overflow-y: auto;
        }
        .upgrade-error-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
        }
        .upgrade-error-hint {
          font-size: 12px;
          color: rgba(255,255,255,0.45);
        }
        .upgrade-error-close {
          background: transparent;
          border: none;
          color: rgba(255,255,255,0.3);
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          transition: all 0.2s;
        }
        .upgrade-error-close:hover { color: #fff; background: rgba(255,255,255,0.05); }
        .btn-manual-download {
          display: flex;
          align-items: center;
          gap: 6px;
          background: rgba(251, 191, 36, 0.1);
          border: 1px solid rgba(251, 191, 36, 0.3);
          color: #fbbf24;
          padding: 7px 14px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-manual-download:hover {
          background: rgba(251, 191, 36, 0.18);
          border-color: rgba(251, 191, 36, 0.5);
          transform: translateY(-1px);
        }

        .main-list-panel {
          padding: 24px;
          flex: 1;
          display: flex;
          flex-direction: column;
          border: 1px solid rgba(255,255,255,0.03);
        }

        .search-box {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 10px 16px;
          background: rgba(0,0,0,0.2);
          border-radius: 12px;
          margin-bottom: 24px;
          border: 1px solid rgba(255,255,255,0.05);
        }
        .search-input {
          background: transparent;
          border: none;
          color: #fff;
          width: 100%;
          outline: none;
          font-size: 14px;
        }

        .empty-state {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          opacity: 0.3;
          gap: 12px;
        }

        .software-item {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 14px 18px;
          background: rgba(255, 255, 255, 0.02);
          border-radius: 14px;
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .software-item:hover {
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(69, 243, 255, 0.2);
          transform: translateX(6px);
        }

        .icon-wrapper {
          background: rgba(69, 243, 255, 0.08);
          padding: 10px;
          border-radius: 12px;
          display: flex;
        }

        .app-name { margin: 0; font-size: 15px; font-weight: 600; color: #fff; }
        .app-meta { display: flex; align-items: center; gap: 8px; font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 4px; }
        .dot { width: 3px; height: 3px; background: rgba(255,255,255,0.2); border-radius: 50%; }
        .update-badge { color: #fbbf24; font-weight: 600; }

        .btn-action-primary {
          background: var(--color-primary);
          color: #000;
          border: none;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          box-shadow: 0 4px 12px rgba(69, 243, 255, 0.2);
          transition: all 0.2s;
        }
        .btn-action-primary:hover { transform: scale(1.05); }
        .btn-action-primary:disabled { opacity: 0.5; transform: none; }

        .btn-action-secondary {
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-action-secondary:hover { background: rgba(255,255,255,0.1); }

        .loader {
          width: 44px;
          height: 44px;
          border: 3px solid rgba(69, 243, 255, 0.1);
          border-radius: 50%;
          border-top-color: var(--color-primary);
          animation: spin 1s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: .5; } }
        .animate-pulse { animation: pulse 2s infinite; }
        
        .animate-fade-in { animation: fadeIn 0.6s ease-out forwards; opacity: 0; }
        .animate-fade-up { animation: fadeUp 0.6s ease-out forwards; opacity: 0; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

        .uac-modal {
          background: rgba(251, 146, 60, 0.06);
          border: 1px solid rgba(251, 146, 60, 0.25);
          border-radius: 14px;
          padding: 18px 20px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .uac-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          color: #fb923c;
          font-size: 14px;
          font-weight: 700;
        }
        .uac-modal-app {
          margin: 0;
          font-size: 14px;
          font-weight: 600;
          color: rgba(255,255,255,0.85);
        }
        .uac-modal-desc {
          margin: 0;
          font-size: 13px;
          color: rgba(255,255,255,0.5);
          line-height: 1.6;
        }
        .uac-modal-desc strong { color: rgba(255,255,255,0.8); }
        .uac-modal-footer {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          flex-wrap: wrap;
          padding-top: 4px;
          border-top: 1px solid rgba(251, 146, 60, 0.1);
        }
        .btn-uac-elevate {
          display: flex;
          align-items: center;
          gap: 8px;
          background: rgba(251, 146, 60, 0.12);
          border: 1px solid rgba(251, 146, 60, 0.35);
          color: #fb923c;
          padding: 9px 18px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
          white-space: nowrap;
        }
        .btn-uac-elevate:hover:not(:disabled) {
          background: rgba(251, 146, 60, 0.2);
          border-color: rgba(251, 146, 60, 0.5);
          box-shadow: 0 0 12px rgba(251, 146, 60, 0.2);
          transform: translateY(-1px);
        }
        .btn-uac-elevate:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
      <DownloadFailModal
        isOpen={isFailModalOpen}
        onClose={() => setIsFailModalOpen(false)}
        onTryAnyway={handleTryAnyway}
        appName={failedApp?.name || ''}
        wingetId={failedApp?.id || ''}
        reason={preflightResult?.errorReason}
        statusCode={preflightResult?.statusCode}
        installerUrl={preflightResult?.installerUrl}
        homepageUrl={failedApp?.homepage}
      />
    </div>
  )
}
