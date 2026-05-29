import { useEffect, useState } from 'react'
import {
  Usb,
  Activity,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Play,
  Square,
  Laptop,
  Search,
  Gamepad,
  MousePointer,
  Volume2,
  Printer,
  Bluetooth,
  Terminal
} from 'lucide-react'

interface PeripheralDevice {
  friendlyName: string
  instanceId: string
  status: string
  class: string
}

export function Peripherals() {
  const [devices, setDevices] = useState<PeripheralDevice[]>([])
  const [loading, setLoading] = useState(false)
  const [actionDevice, setActionDevice] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<
    'all' | 'input' | 'audio' | 'bluetooth' | 'printer' | 'usb'
  >('all')
  const [logs, setLogs] = useState<string[]>([
    'Inicjalizacja Menedżera Urządzeń Peryferyjnych...',
    'Gotowy do skanowania sprzętu.'
  ])
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  // Bezpieczeństwo - potwierdzenie dla myszy/klawiatury
  const [safetyDialog, setSafetyDialog] = useState<{
    device: PeripheralDevice
    enable: boolean
  } | null>(null)

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 5000)
  }

  const appendLog = (text: string) => {
    const time = new Date().toLocaleTimeString('pl-PL')
    setLogs((prev) => [...prev, `[${time}] ${text}`])
  }

  // Wczytywanie urządzeń
  const fetchDevices = async () => {
    setLoading(true)
    appendLog('Skanowanie magistrali PnP w poszukiwaniu urządzeń peryferyjnych...')
    const res = await window.api.getPeripherals()
    if (res.success && res.data) {
      setDevices(res.data)
      appendLog(`Znaleziono ${res.data.length} aktywnych urządzeń peryferyjnych.`)
    } else {
      appendLog('Błąd skanowania urządzeń: ' + (res.error || 'nieznany błąd'))
      showToast('Nie udało się załadować listy urządzeń.', 'error')
    }
    setLoading(false)
  }

  // Otwieranie systemowego Menedżera Urządzeń
  const handleLaunchDeviceManager = async () => {
    appendLog('Uruchamianie systemowego Menedżera Urządzeń (devmgmt.msc)...')
    const res = await window.api.launchDeviceManager()
    if (res.success) {
      appendLog('Uruchomiono Menedżer Urządzeń.')
      showToast('Otwarto Menedżer Urządzeń systemu Windows.', 'success')
    } else {
      appendLog('Błąd uruchamiania Menedżera Urządzeń: ' + res.error)
      showToast('Nie udało się otworzyć Menedżera Urządzeń.', 'error')
    }
  }

  // Zmiana stanu urządzenia
  const handleToggleDevice = async (device: PeripheralDevice, enable: boolean) => {
    // Sprawdź czy to urządzenie wejściowe (mysz/klawiatura) przy próbie wyłączenia
    const isInput = ['mouse', 'keyboard'].includes(device.class.toLowerCase())
    if (!enable && isInput && !safetyDialog) {
      setSafetyDialog({ device, enable })
      return
    }

    setSafetyDialog(null)
    setActionDevice(device.instanceId)
    const verb = enable ? 'włączania' : 'wyłączania'
    appendLog(`Rozpoczęto proces ${verb} urządzenia: ${device.friendlyName}...`)

    const res = await window.api.toggleDevice(device.instanceId, enable)
    if (res.success) {
      showToast(`Pomyślnie ${enable ? 'włączono' : 'wyłączono'} urządzenie!`, 'success')
      appendLog(`Urządzenie ${device.friendlyName} zostało ${enable ? 'włączone' : 'wyłączone'}.`)
      fetchDevices() // odśwież stan
    } else {
      showToast(res.error || 'Błąd zmiany stanu urządzenia.', 'error')
      appendLog(`Błąd ${verb} urządzenia: ` + (res.error || 'brak uprawnień/anulowano'))
    }
    setActionDevice(null)
  }

  useEffect(() => {
    fetchDevices()
  }, [])

  // Filtrowanie urządzeń na podstawie wybranej zakładki
  const getFilteredDevices = () => {
    let list = devices

    // Zakładki
    if (activeTab === 'input') {
      list = list.filter((d) => ['mouse', 'keyboard'].includes(d.class.toLowerCase()))
    } else if (activeTab === 'audio') {
      list = list.filter((d) => ['audioendpoint', 'media'].includes(d.class.toLowerCase()))
    } else if (activeTab === 'bluetooth') {
      list = list.filter(
        (d) =>
          d.class.toLowerCase().includes('blue') ||
          d.friendlyName.toLowerCase().includes('bluetooth')
      )
    } else if (activeTab === 'printer') {
      list = list.filter((d) => d.class.toLowerCase().includes('print'))
    } else if (activeTab === 'usb') {
      list = list.filter((d) => d.class.toLowerCase().includes('usb'))
    }

    // Wyszukiwanie tekstowe
    if (searchQuery.trim() !== '') {
      const query = searchQuery.toLowerCase()
      list = list.filter(
        (d) =>
          d.friendlyName.toLowerCase().includes(query) ||
          d.class.toLowerCase().includes(query) ||
          d.instanceId.toLowerCase().includes(query)
      )
    }

    return list
  }

  // Ikona dla odpowiedniej klasy urządzenia
  const getDeviceIcon = (className: string) => {
    const name = className.toLowerCase()
    if (name.includes('mouse')) return <MousePointer size={18} />
    if (name.includes('keyboard')) return <Laptop size={18} />
    if (name.includes('audio') || name.includes('media')) return <Volume2 size={18} />
    if (name.includes('print')) return <Printer size={18} />
    if (name.includes('blue')) return <Bluetooth size={18} />
    if (name.includes('usb')) return <Usb size={18} />
    return <Gamepad size={18} />
  }

  const getStatusBadge = (status: string) => {
    const s = status.toUpperCase()
    if (s === 'OK') return <span className="status-tag tag-ok">Sprawne</span>
    if (s === 'ERROR' || s === 'DEGRADED') return <span className="status-tag tag-error">Błąd</span>
    return <span className="status-tag tag-unknown">{status}</span>
  }

  const filtered = getFilteredDevices()

  return (
    <div className="peripherals-container fade-in">
      {/* Header */}
      <header className="flex justify-between items-start mb-lg">
        <div>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}>
            Menedżer Urządzeń Peryferyjnych
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
            Monitoruj i kontroluj sprzęt zewnętrzny podłączony do Twojego komputera
          </p>
        </div>
        <div className="flex gap-sm">
          <button
            className="btn btn-secondary flex items-center gap-xs"
            onClick={fetchDevices}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
            <span>Odśwież</span>
          </button>
          <button
            className="btn btn-primary flex items-center gap-xs"
            onClick={handleLaunchDeviceManager}
          >
            <Laptop size={16} />
            <span>Menedżer Urządzeń Windows</span>
          </button>
        </div>
      </header>

      {/* Toast */}
      {toast && (
        <div className={`status-toast animate-slide-up ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span>{toast.text}</span>
        </div>
      )}

      {/* Safety Dialog Modal */}
      {safetyDialog && (
        <div className="safety-modal-overlay">
          <div className="safety-modal glass-panel">
            <div className="flex items-center gap-md mb-md" style={{ color: 'var(--color-error)' }}>
              <AlertTriangle size={32} />
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 800 }}>
                Ostrzeżenie bezpieczeństwa
              </h3>
            </div>
            <p className="text-sm" style={{ lineHeight: 1.6 }}>
              Próbujesz wyłączyć urządzenie wejściowe:{' '}
              <strong>{safetyDialog.device.friendlyName}</strong>. Wyłączenie myszy lub klawiatury
              może uniemożliwić dalsze kontrolowanie systemu operacyjnego!
            </p>
            <p className="text-xs text-muted">
              Czy na pewno chcesz kontynuować i wysłać żądanie wyłączenia do Windows?
            </p>
            <div className="flex justify-end gap-sm mt-lg">
              <button className="btn btn-secondary btn-sm" onClick={() => setSafetyDialog(null)}>
                Anuluj
              </button>
              <button
                className="btn btn-primary btn-sm"
                style={{ background: 'var(--color-error)' }}
                onClick={() => handleToggleDevice(safetyDialog.device, safetyDialog.enable)}
              >
                Wyłącz mimo to
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toolbar / Filtry */}
      <div className="glass-panel toolbar-panel mb-lg flex justify-between items-center flex-wrap gap-md">
        <div className="tabs-wrapper flex gap-xs">
          <button
            className={`tab-btn ${activeTab === 'all' ? 'active' : ''}`}
            onClick={() => setActiveTab('all')}
          >
            Wszystkie
          </button>
          <button
            className={`tab-btn ${activeTab === 'input' ? 'active' : ''}`}
            onClick={() => setActiveTab('input')}
          >
            Wejściowe
          </button>
          <button
            className={`tab-btn ${activeTab === 'audio' ? 'active' : ''}`}
            onClick={() => setActiveTab('audio')}
          >
            Audio
          </button>
          <button
            className={`tab-btn ${activeTab === 'bluetooth' ? 'active' : ''}`}
            onClick={() => setActiveTab('bluetooth')}
          >
            Bluetooth
          </button>
          <button
            className={`tab-btn ${activeTab === 'printer' ? 'active' : ''}`}
            onClick={() => setActiveTab('printer')}
          >
            Drukarki
          </button>
          <button
            className={`tab-btn ${activeTab === 'usb' ? 'active' : ''}`}
            onClick={() => setActiveTab('usb')}
          >
            USB
          </button>
        </div>

        <div className="search-wrapper">
          <Search size={16} className="search-icon" />
          <input
            type="text"
            placeholder="Szukaj urządzenia..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
      </div>

      <div className="grid-panels">
        {/* Panel Główny: Lista Urządzeń */}
        <div className="glass-panel devices-list-panel">
          {loading && filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-xl"
              style={{ gap: '16px' }}
            >
              <div className="loader-spin"></div>
              <span className="text-muted text-sm">Wyszukiwanie podłączonych urządzeń...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-xl text-center"
              style={{ gap: '12px', color: 'var(--color-text-muted)' }}
            >
              <Usb size={48} className="text-muted mb-xs" />
              <p className="font-semibold" style={{ margin: 0 }}>
                Nie znaleziono urządzeń
              </p>
              <p className="text-xs max-w-[340px]" style={{ margin: 0 }}>
                Brak urządzeń peryferyjnych spełniających kryteria wyszukiwania. Spróbuj zmienić
                zakładkę lub wpisać inną frazę.
              </p>
            </div>
          ) : (
            <div className="devices-grid">
              {filtered.map((device, idx) => (
                <div key={idx} className="device-card glass-panel">
                  <div className="device-card-content">
                    <div className="flex items-center justify-between mb-md">
                      <div className="device-icon-box">{getDeviceIcon(device.class)}</div>
                      {getStatusBadge(device.status)}
                    </div>

                    <h4 className="device-title" title={device.friendlyName}>
                      {device.friendlyName}
                    </h4>
                    <p className="device-class-label mb-xs">
                      Klasa: <strong>{device.class}</strong>
                    </p>
                    <p className="device-id-label truncate" title={device.instanceId}>
                      ID: {device.instanceId}
                    </p>
                  </div>

                  <div className="device-actions pt-md">
                    {device.status.toUpperCase() === 'OK' ? (
                      <button
                        className="btn btn-secondary btn-sm flex items-center justify-center gap-xs"
                        style={{
                          color: '#fca5a5',
                          borderColor: 'rgba(239, 68, 68, 0.2)',
                          width: '100%'
                        }}
                        onClick={() => handleToggleDevice(device, false)}
                        disabled={actionDevice !== null}
                      >
                        <Square size={14} fill="#fca5a5" />
                        <span>
                          {actionDevice === device.instanceId
                            ? 'Wyłączanie...'
                            : 'Wyłącz urządzenie'}
                        </span>
                      </button>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm flex items-center justify-center gap-xs"
                        style={{
                          color: '#34d399',
                          borderColor: 'rgba(52, 211, 153, 0.2)',
                          width: '100%'
                        }}
                        onClick={() => handleToggleDevice(device, true)}
                        disabled={actionDevice !== null}
                      >
                        <Play size={14} fill="#34d399" />
                        <span>
                          {actionDevice === device.instanceId ? 'Włączanie...' : 'Włącz urządzenie'}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Panel Boczny: Konsola logów i statystyki */}
        <div className="glass-panel sidebar-panel flex flex-col gap-lg">
          <div>
            <h3 className="flex items-center gap-sm mb-md" style={{ fontSize: '16px', margin: 0 }}>
              <Activity size={18} style={{ color: 'var(--color-primary)' }} />
              Podsumowanie sprzętu
            </h3>

            <div className="summary-stats-box flex flex-col gap-sm">
              <div className="stat-row">
                <span className="text-muted text-xs">Suma urządzeń:</span>
                <span className="font-bold">{devices.length}</span>
              </div>
              <div className="stat-row">
                <span className="text-muted text-xs">Sprawne (OK):</span>
                <span className="font-bold text-success" style={{ color: '#34d399' }}>
                  {devices.filter((d) => d.status.toUpperCase() === 'OK').length}
                </span>
              </div>
              <div className="stat-row">
                <span className="text-muted text-xs">Problemy/Błędy:</span>
                <span className="font-bold text-error" style={{ color: '#fca5a5' }}>
                  {devices.filter((d) => d.status.toUpperCase() !== 'OK').length}
                </span>
              </div>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-xs min-h-[220px]">
            <span className="text-xs text-muted font-bold uppercase flex items-center gap-xs">
              <Terminal size={14} />
              Konsola logów peryferyjnych
            </span>
            <div className="console-wrapper flex-1">
              <div className="console-inner">
                {logs.map((log, idx) => (
                  <div key={idx} className="console-line">
                    {log}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .peripherals-container {
          display: flex;
          flex-direction: column;
          gap: 20px;
          padding: 24px;
          height: calc(100vh - 32px);
          width: 100%;
          box-sizing: border-box;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        .toolbar-panel {
          padding: 12px 20px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .grid-panels {
          display: grid;
          grid-template-columns: 1.55fr 1fr;
          gap: 24px;
          align-items: stretch;
        }

        @media (max-width: 1024px) {
          .grid-panels {
            grid-template-columns: 1fr;
          }
        }

        .devices-list-panel, .sidebar-panel {
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Tabulacja */
        .tab-btn {
          background: transparent;
          border: 1px solid transparent;
          color: var(--color-text-secondary);
          padding: 6px 12px;
          font-size: 13px;
          font-weight: 600;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.2s;
        }

        .tab-btn:hover {
          background: rgba(255,255,255,0.03);
          color: #fff;
        }

        .tab-btn.active {
          background: rgba(69, 243, 255, 0.1);
          color: var(--color-primary);
          border-color: rgba(69, 243, 255, 0.15);
        }

        /* Wyszukiwarka */
        .search-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .search-icon {
          position: absolute;
          left: 12px;
          color: var(--color-text-muted);
        }

        .search-input {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 10px;
          padding: 8px 12px 8px 36px;
          color: #fff;
          font-size: 13px;
          outline: none;
          min-width: 220px;
          transition: all 0.2s;
        }

        .search-input:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 5px var(--color-primary-glow);
        }

        /* Siatka kart urządzeń */
        .devices-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          overflow-y: auto;
          scrollbar-width: thin;
        }

        .device-card {
          padding: 24px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
          display: flex;
          flex-direction: column;
          justify-content: space-between;
          min-height: 250px;
          box-sizing: border-box;
        }

        .device-card:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(69, 243, 255, 0.2);
          transform: translateY(-4px);
          box-shadow: 0 8px 30px rgba(0, 0, 0, 0.3);
        }

        .device-icon-box {
          width: 44px;
          height: 44px;
          border-radius: 12px;
          background: rgba(255, 255, 255, 0.04);
          color: var(--color-primary);
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
        }

        .device-title {
          margin: 16px 0 8px 0;
          font-size: 15px;
          font-weight: 700;
          color: #fff;
          line-height: 1.4;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          text-overflow: ellipsis;
          height: 42px; /* stała wysokość dla 2 linii */
        }

        .device-class-label {
          margin: 0 0 6px 0;
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .device-id-label {
          margin: 0;
          font-size: 11px;
          color: var(--color-text-muted);
          font-family: monospace;
          background: rgba(0, 0, 0, 0.2);
          padding: 4px 8px;
          border-radius: 6px;
          text-overflow: ellipsis;
          overflow: hidden;
          white-space: nowrap;
        }

        @media (max-width: 550px) {
          .peripherals-container {
            padding: 16px;
            gap: 16px;
          }
          .devices-list-panel, .sidebar-panel {
            padding: 16px;
            border-radius: 16px;
          }
          .toolbar-panel {
            padding: 12px;
            border-radius: 12px;
          }
          .search-input {
            min-width: 100%;
          }
          .search-wrapper {
            width: 100%;
          }
        }

        .device-actions {
          border-top: 1px solid rgba(255, 255, 255, 0.04);
          margin-top: 16px;
        }

        /* Status tagi */
        .status-tag {
          font-size: 10px;
          font-weight: 700;
          padding: 2px 8px;
          border-radius: 12px;
          text-transform: uppercase;
        }

        .tag-ok {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.15);
        }

        .tag-error {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.15);
        }

        .tag-unknown {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-secondary);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Podsumowanie */
        .summary-stats-box {
          background: rgba(0, 0, 0, 0.15);
          padding: 16px;
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.02);
        }

        .stat-row {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
        }

        /* Konsola Logów */
        .console-wrapper {
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 14px;
          overflow-y: auto;
          font-family: 'Courier New', Courier, monospace;
          color: #34d399;
          max-height: 250px;
          box-shadow: inset 0 2px 10px rgba(0, 0, 0, 0.8);
          scrollbar-width: thin;
        }

        .console-inner {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .console-line {
          font-size: 11px;
          white-space: pre-wrap;
          line-height: 1.4;
          word-break: break-all;
        }

        /* Toasty */
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
          z-index: 1001;
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

        /* Modal Bezpieczeństwa */
        .safety-modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0,0,0,0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
        }

        .safety-modal {
          background: rgba(20, 22, 28, 0.95);
          border: 1px solid rgba(239, 68, 68, 0.2);
          border-radius: 24px;
          padding: 32px;
          max-width: 440px;
          width: 90%;
          box-shadow: 0 15px 40px rgba(0,0,0,0.8);
        }

        /* Loader */
        .loader-spin {
          width: 32px;
          height: 32px;
          border: 3px solid rgba(69, 243, 255, 0.1);
          border-top-color: var(--color-primary);
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
