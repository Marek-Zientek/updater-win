import { useState } from 'react'
import { DownloadCloud, CheckCircle, AlertTriangle, PlayCircle, Play } from 'lucide-react'

interface InstallableApp {
  id: string
  name: string
  wingetId: string
  category: 'Przeglądarki' | 'Narzędzia' | 'Rozrywka' | 'Programowanie'
  description: string
}

const APPS_CATALOG: InstallableApp[] = [
  {
    id: 'chrome',
    name: 'Google Chrome',
    wingetId: 'Google.Chrome',
    category: 'Przeglądarki',
    description: 'Najpopularniejsza na świecie szybka i bezpieczna przeglądarka internetowa.'
  },
  {
    id: 'firefox',
    name: 'Mozilla Firefox',
    wingetId: 'Mozilla.Firefox',
    category: 'Przeglądarki',
    description: 'Niezależna przeglądarka dbająca o Twoją prywatność i otwarty internet.'
  },
  {
    id: 'brave',
    name: 'Brave Browser',
    wingetId: 'Brave.Brave',
    category: 'Przeglądarki',
    description: 'Przeglądarka automatycznie blokująca reklamy i skrypty śledzące.'
  },
  {
    id: 'opera',
    name: 'Opera',
    wingetId: 'Opera.Opera',
    category: 'Przeglądarki',
    description: 'Klasyczna przeglądarka z wbudowanym darmowym VPN i komunikatorem.'
  },
  {
    id: '7zip',
    name: '7-Zip',
    wingetId: '7zip.7zip',
    category: 'Narzędzia',
    description: 'Darmowy i niezwykle wydajny archiwizator plików o dużym stopniu kompresji.'
  },
  {
    id: 'winrar',
    name: 'WinRAR',
    wingetId: 'RARLab.WinRAR',
    category: 'Narzędzia',
    description: 'Popularny program do kompresji i dekompresji archiwów RAR oraz ZIP.'
  },
  {
    id: 'notepadpp',
    name: 'Notepad++',
    wingetId: 'Notepad++.Notepad++',
    category: 'Narzędzia',
    description: 'Lekki i potężny edytor kodu źródłowego oraz tekstu z kolorowaniem składni.'
  },
  {
    id: 'rufus',
    name: 'Rufus',
    wingetId: 'Rufus.Rufus',
    category: 'Narzędzia',
    description:
      'Małe narzędzie do łatwego tworzenia startowych dysków USB (np. z systemem Windows).'
  },
  {
    id: 'spotify',
    name: 'Spotify',
    wingetId: 'Spotify.Spotify',
    category: 'Rozrywka',
    description: 'Popularna aplikacja do legalnego strumieniowania muzyki i podcastów.'
  },
  {
    id: 'discord',
    name: 'Discord',
    wingetId: 'Discord.Discord',
    category: 'Rozrywka',
    description: 'Darmowy komunikator głosowy i tekstowy stworzony dla graczy i społeczności.'
  },
  {
    id: 'vlc',
    name: 'VLC Media Player',
    wingetId: 'VideoLAN.VLC',
    category: 'Rozrywka',
    description: 'Uniwersalny odtwarzacz multimediów obsługujący niemal każdy format wideo.'
  },
  {
    id: 'steam',
    name: 'Valve Steam',
    wingetId: 'Valve.Steam',
    category: 'Rozrywka',
    description: 'Największa na świecie platforma cyfrowej dystrybucji gier i społeczność graczy.'
  },
  {
    id: 'vscode',
    name: 'Visual Studio Code',
    wingetId: 'Microsoft.VisualStudioCode',
    category: 'Programowanie',
    description: 'Zaawansowany i rozszerzalny edytor kodu od firmy Microsoft.'
  },
  {
    id: 'git',
    name: 'Git',
    wingetId: 'Git.Git',
    category: 'Programowanie',
    description: 'Rozproszony system kontroli wersji ułatwiający pracę nad projektami.'
  },
  {
    id: 'nodejs',
    name: 'Node.js LTS',
    wingetId: 'OpenJS.NodeJS.LTS',
    category: 'Programowanie',
    description: 'Środowisko uruchomieniowe JavaScript do budowania szybkich aplikacji sieciowych.'
  },
  {
    id: 'python',
    name: 'Python 3.12',
    wingetId: 'Python.Python.3.12',
    category: 'Programowanie',
    description: 'Interpretowany język programowania wysokiego poziomu, idealny do skryptów i AI.'
  }
]

type AppStatus = 'idle' | 'pending' | 'installing' | 'success' | 'failed'

interface InstallationQueueItem {
  app: InstallableApp
  status: AppStatus
  error?: string
}

export function MultiInstaller() {
  const [selectedAppIds, setSelectedAppIds] = useState<string[]>([])
  const [activeFilter, setActiveFilter] = useState<string>('all')

  // Kolejka instalacji
  const [installQueue, setInstallQueue] = useState<InstallationQueueItem[]>([])
  const [installActive, setInstallActive] = useState(false)
  const [currentInstallingIndex, setCurrentInstallingIndex] = useState<number | null>(null)

  const [toastMessage, setToastMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)

  const showToast = (text: string, type: 'success' | 'error') => {
    setToastMessage({ text, type })
    setTimeout(() => setToastMessage(null), 5000)
  }

  const handleToggleSelect = (appId: string) => {
    if (installActive) return
    setSelectedAppIds((prev) =>
      prev.includes(appId) ? prev.filter((id) => id !== appId) : [...prev, appId]
    )
  }

  const handleSelectAll = () => {
    if (installActive) return
    const filteredCatalog = APPS_CATALOG.filter(
      (app) => activeFilter === 'all' || app.category === activeFilter
    )
    const allFilteredIds = filteredCatalog.map((app) => app.id)
    const isAllSelected = allFilteredIds.every((id) => selectedAppIds.includes(id))

    if (isAllSelected) {
      setSelectedAppIds((prev) => prev.filter((id) => !allFilteredIds.includes(id)))
    } else {
      setSelectedAppIds((prev) => Array.from(new Set([...prev, ...allFilteredIds])))
    }
  }

  const handleStartInstallation = async () => {
    if (selectedAppIds.length === 0 || installActive) return

    const selectedApps = APPS_CATALOG.filter((app) => selectedAppIds.includes(app.id))
    const queue = selectedApps.map((app) => ({
      app,
      status: 'pending' as AppStatus
    }))

    setInstallQueue(queue)
    setInstallActive(true)

    // Rozpocznij pętlę instalacyjną sekwencyjnie
    for (let i = 0; i < queue.length; i++) {
      setCurrentInstallingIndex(i)

      // Zmień status na installing
      setInstallQueue((prev) =>
        prev.map((item, idx) => (idx === i ? { ...item, status: 'installing' as AppStatus } : item))
      )

      const targetApp = queue[i].app
      console.log(`[MultiInstaller] Installing ${targetApp.name} (${targetApp.wingetId})...`)

      try {
        const res = await window.api.installApp({
          wingetId: targetApp.wingetId,
          name: targetApp.name
        })

        if (res.success) {
          setInstallQueue((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: 'success' as AppStatus } : item
            )
          )
        } else {
          // Błąd - np. wymaga UAC lub błąd sieci
          const errorMsg = res.requiresElevation
            ? 'Wymaga administratora. Uruchom aplikację jako administrator lub spróbuj zainstalować ręcznie.'
            : res.error || 'Błąd instalacji'

          setInstallQueue((prev) =>
            prev.map((item, idx) =>
              idx === i ? { ...item, status: 'failed' as AppStatus, error: errorMsg } : item
            )
          )
        }
      } catch (err: any) {
        setInstallQueue((prev) =>
          prev.map((item, idx) =>
            idx === i
              ? { ...item, status: 'failed' as AppStatus, error: err.message || 'Błąd krytyczny' }
              : item
          )
        )
      }
    }

    setInstallActive(false)
    setCurrentInstallingIndex(null)
    setSelectedAppIds([])
    showToast('Proces instalacji pakietowej został zakończony!', 'success')
  }

  // Filtrowanie katalogu
  const filteredApps = APPS_CATALOG.filter((app) => {
    if (activeFilter === 'all') return true
    return app.category === activeFilter
  })

  const getStatusBadge = (status: AppStatus) => {
    switch (status) {
      case 'pending':
        return <span className="status-badge disabled">Oczekuje</span>
      case 'installing':
        return (
          <span
            className="status-badge active flex items-center gap-xs"
            style={{
              background: 'rgba(69, 243, 255, 0.1)',
              color: 'var(--color-primary)',
              borderColor: 'rgba(69, 243, 255, 0.2)'
            }}
          >
            <div
              className="loader-btn-spin"
              style={{ width: '10px', height: '10px', borderTopColor: 'var(--color-primary)' }}
            ></div>
            Instalowanie...
          </span>
        )
      case 'success':
        return (
          <span
            className="status-badge active"
            style={{
              background: 'rgba(16, 185, 129, 0.1)',
              color: '#34d399',
              borderColor: 'rgba(16, 185, 129, 0.2)'
            }}
          >
            Zainstalowano
          </span>
        )
      case 'failed':
        return (
          <span
            className="status-badge"
            style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#fca5a5',
              borderColor: 'rgba(239, 68, 68, 0.2)'
            }}
          >
            Błąd
          </span>
        )
      default:
        return null
    }
  }

  return (
    <div className="multi-installer-container fade-in">
      {/* Header */}
      <header className="flex items-center justify-between mb-lg">
        <div>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}>
            Szybki Instalator Aplikacji
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
            Zaznacz potrzebne programy i zainstaluj je automatycznie, całkowicie cicho w tle za
            pomocą WinGet
          </p>
        </div>
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

      <div className="grid-layout">
        {/* Lewy Panel: Katalog aplikacji */}
        <div className="glass-panel main-panel">
          <div className="panel-toolbar flex items-center justify-between mb-lg flex-wrap gap-md">
            <div className="flex gap-xs flex-wrap">
              {['all', 'Przeglądarki', 'Narzędzia', 'Rozrywka', 'Programowanie'].map((filter) => (
                <button
                  key={filter}
                  className={`filter-btn ${activeFilter === filter ? 'active' : ''}`}
                  onClick={() => setActiveFilter(filter)}
                  disabled={installActive}
                >
                  {filter === 'all' ? 'Wszystkie' : filter}
                </button>
              ))}
            </div>

            <button
              className="btn btn-secondary btn-sm"
              onClick={handleSelectAll}
              disabled={installActive}
            >
              {filteredApps.every((a) => selectedAppIds.includes(a.id))
                ? 'Odznacz wszystkie'
                : 'Zaznacz wszystkie'}
            </button>
          </div>

          <div className="catalog-grid">
            {filteredApps.map((app) => {
              const isChecked = selectedAppIds.includes(app.id)
              return (
                <div
                  key={app.id}
                  className={`app-card glass-panel flex items-start gap-md ${isChecked ? 'selected' : ''} ${installActive ? 'disabled' : ''}`}
                  onClick={() => handleToggleSelect(app.id)}
                  style={{
                    padding: '16px',
                    borderRadius: '16px',
                    cursor: installActive ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s',
                    border: isChecked
                      ? '1px solid var(--color-primary)'
                      : '1px solid rgba(255,255,255,0.05)',
                    background: isChecked ? 'rgba(69, 243, 255, 0.02)' : 'rgba(255,255,255,0.01)'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    readOnly
                    disabled={installActive}
                    className="checkbox-custom"
                    style={{ marginTop: '3px' }}
                  />
                  <div className="flex-1">
                    <h4
                      style={{
                        margin: '0 0 4px 0',
                        fontSize: '14px',
                        fontWeight: 700,
                        color: '#fff'
                      }}
                    >
                      {app.name}
                    </h4>
                    <p
                      className="text-muted text-xs mb-xs"
                      style={{ margin: '4px 0', lineHeight: 1.4 }}
                    >
                      {app.description}
                    </p>
                    <span
                      className="text-muted font-mono"
                      style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)' }}
                    >
                      ID: {app.wingetId}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Prawy Panel: Stan instalacji */}
        <div className="glass-panel sidebar-panel flex flex-col justify-between">
          <div className="flex flex-col h-full justify-between">
            <div>
              <h3
                className="flex items-center gap-sm mb-md"
                style={{ fontSize: '16px', margin: 0, fontWeight: 700 }}
              >
                <DownloadCloud size={18} style={{ color: 'var(--color-primary)' }} />
                Kolejka instalacji
              </h3>

              {installQueue.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-xl text-center text-muted"
                  style={{ gap: '12px' }}
                >
                  <PlayCircle size={40} className="text-muted mb-xs" />
                  <p className="font-semibold text-sm" style={{ margin: 0 }}>
                    Kolejka jest pusta
                  </p>
                  <p className="text-xs max-w-[220px]" style={{ margin: 0 }}>
                    Zaznacz wybrane aplikacje z katalogu po lewej stronie, aby dodać je do kolejki.
                  </p>
                </div>
              ) : (
                <div
                  className="queue-list"
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    maxHeight: '360px',
                    overflowY: 'auto'
                  }}
                >
                  {installQueue.map((item, idx) => (
                    <div
                      key={item.app.id}
                      className="queue-item glass-panel"
                      style={{
                        padding: '12px',
                        borderRadius: '12px',
                        background:
                          currentInstallingIndex === idx
                            ? 'rgba(69, 243, 255, 0.03)'
                            : 'rgba(255,255,255,0.01)',
                        border:
                          currentInstallingIndex === idx
                            ? '1px solid var(--color-primary)'
                            : '1px solid rgba(255,255,255,0.04)'
                      }}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-xs text-white">{item.app.name}</span>
                        {getStatusBadge(item.status)}
                      </div>
                      {item.error && (
                        <p
                          className="text-red-300 text-[10px] mt-xs"
                          style={{ margin: '4px 0 0 0', color: '#ef4444', lineHeight: 1.3 }}
                        >
                          {item.error}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-lg">
              {selectedAppIds.length > 0 && !installActive && (
                <button
                  className="btn btn-primary w-full flex items-center justify-center gap-xs pulse-primary"
                  onClick={handleStartInstallation}
                  style={{ padding: '12px 0', borderRadius: '14px', fontWeight: 'bold' }}
                >
                  <Play size={14} fill="currentColor" />
                  <span>Zainstaluj wybrane ({selectedAppIds.length})</span>
                </button>
              )}

              {installActive && (
                <div
                  className="flex items-center justify-center gap-sm p-md glass-panel"
                  style={{
                    background: 'rgba(255,255,255,0.01)',
                    border: '1px solid rgba(255,255,255,0.03)',
                    borderRadius: '12px'
                  }}
                >
                  <div
                    className="loader-btn-spin"
                    style={{
                      width: '16px',
                      height: '16px',
                      borderTopColor: 'var(--color-primary)'
                    }}
                  ></div>
                  <span className="text-xs text-muted font-medium">
                    Instalowanie aplikacji... Proszę czekać.
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .multi-installer-container {
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

        .grid-layout {
          display: grid;
          grid-template-columns: 1.8fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 1024px) {
          .grid-layout {
            grid-template-columns: 1fr;
          }
        }

        .main-panel, .sidebar-panel {
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        /* Katalog */
        .catalog-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
          gap: 16px;
        }

        .app-card:hover:not(.disabled) {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.03) !important;
          border-color: rgba(255, 255, 255, 0.12) !important;
        }

        .app-card.disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        /* Checkbox */
        .checkbox-custom {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid rgba(255, 255, 255, 0.2);
          accent-color: var(--color-primary);
          cursor: pointer;
        }

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

        .filter-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.03);
          color: #fff;
        }

        .filter-btn.active {
          background: rgba(69, 243, 255, 0.1);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }

        .filter-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        /* Badges */
        .status-badge {
          font-size: 9px;
          font-weight: 700;
          padding: 2px 6px;
          border-radius: 20px;
          text-transform: uppercase;
          border: 1px solid transparent;
        }

        .status-badge.disabled {
          background: rgba(255, 255, 255, 0.03);
          color: var(--color-text-muted);
          border-color: rgba(255, 255, 255, 0.04);
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

        .pulse-primary {
          box-shadow: 0 0 15px var(--color-primary-glow);
          animation: pulseGlow 2s infinite alternate;
        }

        @keyframes pulseGlow {
          0% { box-shadow: 0 0 10px rgba(69, 243, 255, 0.2); }
          100% { box-shadow: 0 0 20px rgba(69, 243, 255, 0.5); }
        }

        .loader-btn-spin {
          width: 12px;
          height: 12px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
