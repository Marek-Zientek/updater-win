import { useEffect, useState } from 'react'
import {
  Shield,
  Plus,
  Download,
  Upload,
  Database,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Clock,
  Info,
  Globe
} from 'lucide-react'

interface RestorePoint {
  sequenceNumber: number
  description: string
  creationTime: string
  type: string
}

export function Backup() {
  // Stany dla punktów przywracania
  const [restorePoints, setRestorePoints] = useState<RestorePoint[]>([])
  const [loadingPoints, setLoadingPoints] = useState(false)
  const [creatingPoint, setCreatingPoint] = useState(false)
  const [pointsError, setPointsError] = useState<string | null>(null)

  // Stany dla eksportu/importu JSON
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [statusMessage, setStatusMessage] = useState<{
    text: string
    type: 'success' | 'error'
  } | null>(null)
  const [restoringPoint, setRestoringPoint] = useState(false)
  const [confirmRestorePoint, setConfirmRestorePoint] = useState<RestorePoint | null>(null)

  // Zakładki
  const [activeTab, setActiveTab] = useState<'system' | 'drivers'>('system')

  // Stany dla sterowników
  const [exportingDrivers, setExportingDrivers] = useState(false)
  const [restoringDrivers, setRestoringDrivers] = useState(false)
  const [winOldInfo, setWinOldInfo] = useState<{ exists: boolean; path?: string }>({ exists: false })
  const [restoringWinOld, setRestoringWinOld] = useState(false)
  const [packInfo, setPackInfo] = useState<{ exists: boolean; path?: string; fileName?: string }>({ exists: false })
  const [downloadingPack, setDownloadingPack] = useState(false)
  const [downloadProgress, setDownloadProgress] = useState<{ percent: number; loaded: number; total: number } | null>(null)
  const [installingPack, setInstallingPack] = useState(false)
  const [customPackPath, setCustomPackPath] = useState<string | null>(null)

  // Ładowanie punktów przywracania
  const loadRestorePoints = async () => {
    setLoadingPoints(true)
    setPointsError(null)
    const res = await window.api.getRestorePoints()
    if (res.success && res.data) {
      // Sortowanie od najnowszych (najwyższy sequenceNumber)
      const sorted = [...res.data].sort((a, b) => b.sequenceNumber - a.sequenceNumber)
      setRestorePoints(sorted)
    } else if (res.error) {
      setPointsError(res.error)
    }
    setLoadingPoints(false)
  }

  // Sprawdzanie statusu sterowników offline i Windows.old
  const checkDriversStatus = async () => {
    const woRes = await window.api.checkWindowsOldDrivers()
    if (woRes.success) {
      setWinOldInfo({ exists: woRes.exists, path: woRes.path })
    }

    const pRes = await window.api.checkOfflinePack()
    if (pRes.success) {
      setPackInfo({ exists: pRes.exists, path: pRes.path, fileName: pRes.fileName })
    }
  }

  // Rejestracja progressu pobierania i ładowanie początkowe
  useEffect(() => {
    loadRestorePoints()
    checkDriversStatus()

    const unsub = window.api.onOfflinePackDownloadProgress((data) => {
      setDownloadProgress(data)
    })
    return () => unsub()
  }, [])

  // Tworzenie punktu przywracania
  const handleCreateRestorePoint = async () => {
    setCreatingPoint(true)
    setStatusMessage(null)
    const res = await window.api.createRestorePoint()
    if (res.success) {
      showToast('Pomyślnie utworzono punkt przywracania systemu Windows!', 'success')
      loadRestorePoints()
    } else {
      showToast(res.error || 'Nie udało się utworzyć punktu przywracania.', 'error')
    }
    setCreatingPoint(false)
  }

  const handleConfirmRestore = (point: RestorePoint) => {
    setConfirmRestorePoint(point)
  }

  const handleRestorePoint = async () => {
    if (!confirmRestorePoint) return
    setRestoringPoint(true)
    const res = await window.api.restoreSystemPoint()
    if (res.success) {
      showToast('Kreator przywracania systemu Windows został pomyślnie uruchomiony.', 'success')
      setConfirmRestorePoint(null)
    } else {
      showToast(res.error || 'Nie udało się uruchomić przywracania systemu.', 'error')
    }
    setRestoringPoint(false)
  }

  // Eksport profilu
  const handleExportBackup = async () => {
    setExporting(true)
    setStatusMessage(null)
    const res = await window.api.exportBackup()
    if (res.success) {
      if (!res.canceled) {
        showToast('Kopia zapasowa profilu została zapisana pomyślnie!', 'success')
      }
    } else {
      showToast(res.error || 'Wystąpił błąd podczas zapisu kopii.', 'error')
    }
    setExporting(false)
  }

  // Import profilu
  const handleImportBackup = async () => {
    setImporting(true)
    setStatusMessage(null)
    const res = await window.api.importBackup()
    if (res.success) {
      if (!res.canceled) {
        showToast(
          'Pomyślnie zaimportowano konfigurację profilu! Zmiany zostały zastosowane.',
          'success'
        )
      }
    } else {
      showToast(res.error || 'Wystąpił błąd podczas importowania konfiguracji.', 'error')
    }
    setImporting(false)
  }

  // Handlery dla Sterowników Offline
  const handleExportDrivers = async () => {
    setExportingDrivers(true)
    setStatusMessage(null)
    try {
      const res = await window.api.exportDrivers()
      if (res.success) {
        if (!res.canceled) {
          showToast('Kopia zapasowa sterowników została zapisana pomyślnie!', 'success')
        }
      } else {
        showToast(res.error || 'Wystąpił błąd podczas eksportu sterowników.', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Błąd krytyczny eksportu.', 'error')
    } finally {
      setExportingDrivers(false)
    }
  }

  const handleRestoreDrivers = async () => {
    setRestoringDrivers(true)
    setStatusMessage(null)
    try {
      const res = await window.api.restoreDrivers()
      if (res.success) {
        if (!res.canceled) {
          showToast('Instalacja sterowników z folderu została zakończona!', 'success')
        }
      } else {
        showToast(res.error || 'Wystąpił błąd podczas instalacji sterowników.', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Błąd krytyczny instalacji.', 'error')
    } finally {
      setRestoringDrivers(false)
    }
  }

  const handleRestoreWinOld = async () => {
    setRestoringWinOld(true)
    setStatusMessage(null)
    try {
      const res = await window.api.restoreWindowsOldDrivers()
      if (res.success) {
        showToast('Pomyślnie zainstalowano sterowniki z katalogu Windows.old!', 'success')
      } else {
        showToast(res.error || 'Nie udało się przywrócić sterowników z Windows.old.', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Błąd krytyczny odzyskiwania.', 'error')
    } finally {
      setRestoringWinOld(false)
    }
  }

  const handleDownloadPack = async () => {
    setDownloadingPack(true)
    setDownloadProgress(null)
    setStatusMessage(null)
    try {
      const res = await window.api.downloadOfflinePack()
      if (res.success) {
        showToast('Paczka sterowników offline została pobrana pomyślnie!', 'success')
        checkDriversStatus()
      } else {
        showToast(res.error || 'Nie udało się pobrać paczki offline.', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Błąd pobierania.', 'error')
    } finally {
      setDownloadingPack(false)
      setDownloadProgress(null)
    }
  }

  const handlePickCustomZip = async () => {
    setStatusMessage(null)
    try {
      const res = await window.api.pickOfflinePackZip()
      if (res.success) {
        if (!res.canceled && res.filePath) {
          setCustomPackPath(res.filePath)
          showToast(`Wybrano plik ZIP: ${res.filePath.split('\\').pop()}`, 'success')
        }
      } else {
        showToast(res.error || 'Błąd podczas wyboru pliku.', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Błąd wyboru pliku.', 'error')
    }
  }

  const handleInstallOfflinePack = async () => {
    setInstallingPack(true)
    setStatusMessage(null)
    try {
      const res = await window.api.installOfflinePack(customPackPath || undefined)
      if (res.success) {
        showToast('Pomyślnie zainstalowano sterowniki sieciowe offline!', 'success')
      } else {
        showToast(res.error || 'Instalacja sterowników sieciowych nie powiodła się.', 'error')
      }
    } catch (err: any) {
      showToast(err.message || 'Błąd instalacji paczki.', 'error')
    } finally {
      setInstallingPack(false)
    }
  }

  const showToast = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type })
    setTimeout(() => setStatusMessage(null), 5000)
  }

  // Formatowanie daty Windows (często zwracane jako string w formacie WMI np. 20260527120000.000000-000 lub standardowy string daty)
  const formatDate = (dateStr: string): string => {
    try {
      // Sprawdź czy to format WMI (np. 20260527120000.000000-000)
      if (dateStr.length >= 14 && /^\d+/.test(dateStr)) {
        const year = dateStr.substring(0, 4)
        const month = dateStr.substring(4, 6)
        const day = dateStr.substring(6, 8)
        const hour = dateStr.substring(8, 10)
        const minute = dateStr.substring(10, 12)
        const second = dateStr.substring(12, 14)
        return `${day}.${month}.${year} ${hour}:${minute}:${second}`
      }
      // W innym wypadku standardowa data
      const date = new Date(dateStr)
      if (isNaN(date.getTime())) return dateStr
      return date.toLocaleString('pl-PL')
    } catch {
      return dateStr
    }
  }

  return (
    <div className="backup-container fade-in">
      {confirmRestorePoint && (
        <div className="restore-point-overlay">
          <div
            className="restore-point-card glass-panel flex flex-col items-center justify-center text-center p-xl"
            style={{ padding: '32px' }}
          >
            <AlertTriangle size={48} color="var(--color-warning)" className="mb-md" />
            <h3
              style={{ margin: '16px 0 8px 0', fontSize: '18px', color: '#fff', fontWeight: 700 }}
            >
              Przywracanie systemu
            </h3>
            <p
              className="text-muted text-sm max-w-[360px]"
              style={{ margin: '0 0 20px 0', lineHeight: 1.5 }}
            >
              Czy na pewno chcesz przywrócić stan systemu do punktu{' '}
              <strong>"{confirmRestorePoint.description}"</strong> z dnia{' '}
              {formatDate(confirmRestorePoint.creationTime)}?
              <br />
              <br />
              <strong style={{ color: 'var(--color-warning)' }}>Uwaga:</strong> Zapisz całą swoją
              pracę przed zatwierdzeniem. Komputer uruchomi systemowe narzędzie przywracania, co
              może wymagać ponownego uruchomienia komputera.
            </p>
            <div className="flex gap-sm justify-center">
              <button
                className="btn btn-secondary btn-sm"
                onClick={() => setConfirmRestorePoint(null)}
                disabled={restoringPoint}
              >
                Anuluj
              </button>
              <button
                className="btn btn-primary btn-sm flex items-center gap-xs"
                onClick={handleRestorePoint}
                disabled={restoringPoint}
                style={{
                  background: 'var(--color-warning)',
                  borderColor: 'var(--color-warning)',
                  color: '#000',
                  fontWeight: 'bold'
                }}
              >
                {restoringPoint ? (
                  <>
                    <div className="loader-btn-spin" style={{ borderTopColor: '#000' }}></div>
                    <span>Uruchamianie...</span>
                  </>
                ) : (
                  <span>Potwierdź i Uruchom</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Header */}
      <header className="mb-lg">
        <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}>
          Kopia Zapasowa i Przywracanie
        </h1>
        <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          Zabezpieczaj ustawienia systemu operacyjnego oraz sterowniki offline
        </p>
      </header>

      {/* Powiadomienie statusu */}
      {statusMessage && (
        <div className={`status-toast animate-slide-up ${statusMessage.type}`}>
          {statusMessage.type === 'success' ? (
            <CheckCircle size={20} />
          ) : (
            <AlertTriangle size={20} />
          )}
          <span>{statusMessage.text}</span>
        </div>
      )}

      {/* Tab Switcher */}
      <div className="tab-switcher glass-panel mb-lg">
        <button
          className={`tab-btn ${activeTab === 'system' ? 'active' : ''}`}
          onClick={() => setActiveTab('system')}
        >
          Kopia Systemu i Aplikacji
        </button>
        <button
          className={`tab-btn ${activeTab === 'drivers' ? 'active' : ''}`}
          onClick={() => setActiveTab('drivers')}
        >
          Kopia i Sterowniki Offline
        </button>
      </div>

      {activeTab === 'system' ? (
        <div className="grid-panels fade-in">
          {/* Panel Lewy: Punkty przywracania systemu */}
          <div className="glass-panel main-panel">
            <div className="panel-header flex items-center justify-between mb-md">
              <h2 className="flex items-center gap-sm" style={{ fontSize: '18px', margin: 0 }}>
                <Shield size={20} style={{ color: 'var(--color-primary)' }} />
                Punkty przywracania systemu Windows
              </h2>
              <div className="flex gap-xs">
                <button
                  className="btn-icon"
                  onClick={loadRestorePoints}
                  disabled={loadingPoints || creatingPoint}
                  title="Odśwież listę"
                >
                  <RefreshCw size={14} className={loadingPoints ? 'spin' : ''} />
                </button>
                <button
                  className="btn btn-primary btn-sm flex items-center gap-xs"
                  onClick={handleCreateRestorePoint}
                  disabled={creatingPoint || loadingPoints}
                >
                  <Plus size={14} />
                  <span>Utwórz nowy</span>
                </button>
              </div>
            </div>

            <p className="panel-desc text-muted mb-lg">
              Punkt przywracania pozwala przywrócić stan plików systemowych Windows i rejestru do
              wcześniejszego momentu w czasie. Narzędzie wymaga akceptacji monitu administratora
              (UAC).
            </p>

            {creatingPoint && (
              <div
                className="flex flex-col items-center justify-center py-lg glass-panel mb-lg"
                style={{ gap: '12px', background: 'rgba(69, 243, 255, 0.03)' }}
              >
                <div className="loader-spin"></div>
                <span className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>
                  Tworzenie punktu przywracania systemu...
                </span>
                <span className="text-xs text-muted">
                  Zaakceptuj monit administratora na ekranie, jeśli się pojawił.
                </span>
              </div>
            )}

            {pointsError ? (
              <div className="alert-card flex items-start gap-md mb-lg">
                <AlertTriangle size={20} className="alert-icon" />
                <div>
                  <h4 className="alert-title">Funkcja ograniczona</h4>
                  <p className="alert-desc text-xs text-muted">{pointsError}</p>
                  <p className="alert-desc text-xs text-muted" style={{ marginTop: '6px' }}>
                    Aby włączyć Ochronę Systemu w Windows: otwórz menu Start, wpisz{' '}
                    <strong>"Utwórz punkt przywracania"</strong>, zaznacz swój dysk systemowy (C:) i
                    kliknij <strong>"Konfiguruj..."</strong>, a następnie wybierz{' '}
                    <strong>"Włącz ochronę systemu"</strong>.
                  </p>
                </div>
              </div>
            ) : null}

            <div className="table-wrapper">
              {loadingPoints && restorePoints.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-xl"
                  style={{ gap: '16px' }}
                >
                  <div className="loader-spin"></div>
                  <span className="text-muted text-sm">Wyszukiwanie punktów przywracania...</span>
                </div>
              ) : restorePoints.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-xl text-center"
                  style={{ gap: '12px', color: 'var(--color-text-muted)' }}
                >
                  <Clock size={40} className="text-muted mb-xs" />
                  <p className="font-semibold" style={{ margin: 0 }}>
                    Brak punktów przywracania
                  </p>
                  <p className="text-xs max-w-[340px]" style={{ margin: 0 }}>
                    Nie znaleziono żadnych punktów przywracania systemu. Utwórz nowy punkt przed
                    przystąpieniem to modyfikacji systemu.
                  </p>
                </div>
              ) : (
                <table className="restore-table">
                  <thead>
                    <tr>
                      <th>Lp. (ID)</th>
                      <th>Nazwa / Opis</th>
                      <th>Data utworzenia</th>
                      <th>Typ</th>
                      <th style={{ textAlign: 'right' }}>Akcje</th>
                    </tr>
                  </thead>
                  <tbody>
                    {restorePoints.map((point) => (
                      <tr key={point.sequenceNumber}>
                        <td className="font-mono text-xs">{point.sequenceNumber}</td>
                        <td className="font-medium">{point.description}</td>
                        <td className="text-muted text-xs">{formatDate(point.creationTime)}</td>
                        <td>
                          <span className="type-badge">{point.type || 'Modyfikacja'}</span>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{
                              padding: '4px 10px',
                              fontSize: '11px',
                              borderRadius: '8px',
                              borderColor: 'rgba(239, 68, 68, 0.3)',
                              color: '#fca5a5',
                              background: 'rgba(239, 68, 68, 0.05)'
                            }}
                            onClick={() => handleConfirmRestore(point)}
                            disabled={restoringPoint || creatingPoint || loadingPoints}
                          >
                            Przywróć
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Panel Prawy: Kopia profilu aplikacji */}
          <div className="glass-panel sidebar-panel flex flex-col justify-between">
            <div>
              <h2 className="flex items-center gap-sm mb-md" style={{ fontSize: '18px', margin: 0 }}>
                <Database size={20} style={{ color: 'var(--color-secondary)' }} />
                Kopia profilu UpdaterWindows
              </h2>
              <p className="panel-desc text-muted mb-lg">
                Eksportuj swoje oceny oprogramowania, recenzje, własne tagi, kategorie oraz
                konfigurację harmonogramu aktualizacji w tle do pojedynczego pliku JSON.
              </p>

              <div className="flex flex-col gap-md">
                {/* Sekcja Eksportu */}
                <div className="glass-panel action-card flex items-center justify-between">
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }}>
                      Eksportuj do JSON
                    </h4>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>
                      Zapisz stan aplikacji w bezpiecznym pliku kopii
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary btn-sm flex items-center gap-xs"
                    onClick={handleExportBackup}
                    disabled={exporting || importing}
                  >
                    <Download size={14} />
                    <span>{exporting ? 'Zapisywanie...' : 'Zapisz'}</span>
                  </button>
                </div>

                {/* Sekcja Importu */}
                <div className="glass-panel action-card flex items-center justify-between">
                  <div>
                    <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }}>
                      Importuj z JSON
                    </h4>
                    <p className="text-xs text-muted" style={{ margin: 0 }}>
                      Przywróć stan aplikacji z pliku kopii
                    </p>
                  </div>
                  <button
                    className="btn btn-primary btn-sm flex items-center gap-xs"
                    onClick={handleImportBackup}
                    disabled={exporting || importing}
                  >
                    <Upload size={14} />
                    <span>{importing ? 'Wczytywanie...' : 'Wczytaj'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Przewodnik/Wskazówka */}
            <div className="info-card flex items-start gap-sm mt-xl">
              <Info size={16} className="info-icon" />
              <p className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                Kopia profilu JSON nie zawiera samych plików instalacyjnych aplikacji. Zapisuje
                jedynie spersonalizowane opisy, notatki, oceny, tagi oraz konfigurację auto-update z
                bazy SQLite.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="grid-panels fade-in">
          {/* Kolumna 1: Eksport / Przywracanie lokalne */}
          <div className="glass-panel main-panel flex flex-col gap-lg" style={{ gap: '20px' }}>
            <div>
              <h2 className="flex items-center gap-sm mb-md" style={{ fontSize: '18px', margin: 0 }}>
                <Shield size={20} style={{ color: 'var(--color-primary)' }} />
                Lokalna Kopia i Przywracanie Sterowników
              </h2>
              <p className="panel-desc text-muted mb-lg">
                Wykonaj kopię zapasową wszystkich sterowników firm trzecich przed ponowną instalacją systemu Windows. 
                Pozwoli Ci to zainstalować je z powrotem w trybie offline w nowym systemie. Wymaga administratora (monitu UAC).
              </p>
            </div>

            <div className="flex flex-col gap-md">
              {/* Eksport */}
              <div className="glass-panel action-card flex items-center justify-between p-lg">
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }} className="flex items-center gap-xs">
                    <Download size={16} style={{ color: 'var(--color-primary)' }} />
                    Kopia zapasowa sterowników (Eksport)
                  </h4>
                  <p className="text-xs text-muted" style={{ margin: 0 }}>
                    Zapisuje zainstalowane w systemie sterowniki (karty sieciowej, GPU, dźwięku) do folderu na USB.
                  </p>
                </div>
                <button
                  className="btn btn-secondary btn-sm flex items-center gap-xs"
                  onClick={handleExportDrivers}
                  disabled={exportingDrivers || restoringDrivers}
                  style={{ minWidth: '120px', justifyContent: 'center' }}
                >
                  {exportingDrivers ? (
                    <>
                      <div className="loader-btn-spin"></div>
                      <span>Eksport...</span>
                    </>
                  ) : (
                    <>
                      <Download size={14} />
                      <span>Eksportuj</span>
                    </>
                  )}
                </button>
              </div>

              {/* Przywracanie */}
              <div className="glass-panel action-card flex items-center justify-between p-lg">
                <div>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '14px', fontWeight: 700 }} className="flex items-center gap-xs">
                    <Upload size={16} style={{ color: 'var(--color-secondary)' }} />
                    Wgraj sterowniki z folderu (Przywróć)
                  </h4>
                  <p className="text-xs text-muted" style={{ margin: 0 }}>
                    Instaluje sterowniki z wcześniej przygotowanego folderu kopii zapasowej.
                  </p>
                </div>
                <button
                  className="btn btn-primary btn-sm flex items-center gap-xs"
                  onClick={handleRestoreDrivers}
                  disabled={exportingDrivers || restoringDrivers}
                  style={{ minWidth: '120px', justifyContent: 'center' }}
                >
                  {restoringDrivers ? (
                    <>
                      <div className="loader-btn-spin"></div>
                      <span>Instalacja...</span>
                    </>
                  ) : (
                    <>
                      <Upload size={14} />
                      <span>Wgraj</span>
                    </>
                  )}
                </button>
              </div>

              {/* Odzyskiwanie z Windows.old */}
              {winOldInfo.exists && (
                <div className="alert-card flex flex-col gap-md mt-md" style={{ background: 'rgba(168, 85, 247, 0.04)', borderColor: 'rgba(168, 85, 247, 0.15)' }}>
                  <div className="flex items-start gap-md">
                    <AlertTriangle size={20} style={{ color: '#c084fc' }} className="flex-shrink-0" />
                    <div>
                      <h4 className="alert-title" style={{ color: '#c084fc' }}>Wykryto folder Windows.old</h4>
                      <p className="alert-desc text-xs text-muted">
                        System odnalazł pozostałości poprzedniego systemu pod ścieżką: <code>{winOldInfo.path}</code>. 
                        Możesz spróbować automatycznie odzyskać i wgrać sterowniki bezpośrednio z poprzedniej instalacji.
                      </p>
                    </div>
                  </div>
                  <button
                    className="btn btn-primary btn-sm flex items-center gap-xs self-end"
                    onClick={handleRestoreWinOld}
                    disabled={restoringWinOld}
                    style={{ background: '#a855f7', borderColor: '#a855f7', color: '#fff', fontSize: '11px', padding: '6px 14px' }}
                  >
                    {restoringWinOld ? (
                      <>
                        <div className="loader-btn-spin"></div>
                        <span>Przywracanie...</span>
                      </>
                    ) : (
                      <>
                        <RefreshCw size={12} />
                        <span>Odzyskaj sterowniki</span>
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Kolumna 2: Uniwersalna Paczka Sieciowa */}
          <div className="glass-panel sidebar-panel flex flex-col justify-between" style={{ gap: '20px' }}>
            <div className="flex flex-col gap-md">
              <h2 className="flex items-center gap-sm mb-md" style={{ fontSize: '18px', margin: 0 }}>
                <Globe size={20} style={{ color: 'var(--color-secondary)' }} />
                Offline Paczka Sterowników Sieciowych
              </h2>
              <p className="panel-desc text-muted mb-lg">
                Zintegrowana, uniwersalna paczka najpopularniejszych sterowników sieciowych (Intel, Realtek, MediaTek). 
                Umożliwia uruchomienie internetu na świeżym systemie Windows.
              </p>

              {/* Status paczki */}
              <div className="glass-panel p-md flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '12px' }}>
                <span className="text-xs text-muted">Zintegrowany pakiet ZIP:</span>
                {packInfo.exists ? (
                  <span className="text-xs font-bold text-success flex items-center gap-xs">
                    <CheckCircle size={14} /> Wykryto lokalnie
                  </span>
                ) : customPackPath ? (
                  <span className="text-xs font-bold text-success flex items-center gap-xs">
                    <CheckCircle size={14} /> Wczytano ręcznie
                  </span>
                ) : (
                  <span className="text-xs font-bold text-warning flex items-center gap-xs">
                    <AlertTriangle size={14} /> Brak pliku ZIP
                  </span>
                )}
              </div>

              {/* Pobieranie lub Instalacja */}
              {!packInfo.exists && !customPackPath ? (
                <div className="flex flex-col gap-sm">
                  <button
                    className="btn btn-primary btn-sm flex items-center justify-center gap-xs w-full"
                    onClick={handleDownloadPack}
                    disabled={downloadingPack || installingPack}
                  >
                    {downloadingPack ? (
                      <>
                        <div className="loader-btn-spin"></div>
                        <span>Pobieranie paczki...</span>
                      </>
                    ) : (
                      <>
                        <Download size={14} />
                        <span>Pobierz Paczkę Sieciową (~60MB)</span>
                      </>
                    )}
                  </button>

                  {downloadingPack && downloadProgress && (
                    <div className="flex flex-col gap-xs mt-xs">
                      <div className="flex justify-between text-[10px] text-muted">
                        <span>Trwa pobieranie...</span>
                        <span>{downloadProgress.percent}% ({Math.round(downloadProgress.loaded / 1024 / 1024)} MB)</span>
                      </div>
                      <div className="progress-bar-container" style={{ height: '4px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div 
                          className="progress-bar-fill" 
                          style={{ 
                            height: '100%', 
                            width: `${downloadProgress.percent}%`, 
                            background: 'var(--color-primary)', 
                            boxShadow: '0 0 10px var(--color-primary-glow)',
                            transition: 'width 0.2s ease-out' 
                          }}
                        ></div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="btn btn-primary btn-sm flex items-center justify-center gap-xs w-full"
                  onClick={handleInstallOfflinePack}
                  disabled={downloadingPack || installingPack}
                  style={{ background: 'var(--color-success)', borderColor: 'var(--color-success)', color: '#000', fontWeight: 'bold' }}
                >
                  {installingPack ? (
                    <>
                      <div className="loader-btn-spin" style={{ borderTopColor: '#000' }}></div>
                      <span>Wdrażanie sterowników sieciowych...</span>
                    </>
                  ) : (
                    <>
                      <CheckCircle size={14} />
                      <span>Instaluj Sterowniki Sieciowe</span>
                    </>
                  )}
                </button>
              )}

              {/* Ręczny plik ZIP */}
              <button
                className="btn btn-secondary btn-sm flex items-center justify-center gap-xs w-full mt-xs"
                onClick={handlePickCustomZip}
                disabled={downloadingPack || installingPack}
                style={{ fontSize: '11px', padding: '6px 12px' }}
              >
                <Upload size={12} />
                <span>Wskaż pobrany plik ZIP ręcznie</span>
              </button>

              {customPackPath && (
                <div className="text-[10px] text-muted text-center break-all">
                  Wybrana ścieżka: <code>{customPackPath}</code>
                </div>
              )}
            </div>

            <div className="info-card flex items-start gap-sm mt-md">
              <Info size={16} className="info-icon" style={{ marginTop: '2px' }} />
              <div className="text-xs text-muted" style={{ margin: 0, lineHeight: 1.5 }}>
                {!packInfo.exists && !customPackPath ? (
                  <span>
                    Brak internetu na nowym PC? Pobierz plik ZIP <code>offline_network_drivers.zip</code> na innym komputerze, 
                    skopiuj go na pendrive do folderu z tą aplikacją lub wskaż ręcznie.
                  </span>
                ) : (
                  <span>
                    Plik ZIP ze sterownikami sieciowymi jest gotowy. Kliknięcie "Instaluj" rozpakuje je do katalogu tymczasowego 
                    i zintegruje z systemem Windows (proces potrwa do 1-2 minut).
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

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

        .loader-btn-spin {
          width: 14px;
          height: 14px;
          border: 2px solid rgba(255, 255, 255, 0.2);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }

        .backup-container {
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

        .grid-panels {
          display: grid;
          grid-template-columns: 1.6fr 1fr;
          gap: 24px;
          align-items: start;
        }

        @media (max-width: 900px) {
          .grid-panels {
            grid-template-columns: 1fr;
          }
        }

        .main-panel, .sidebar-panel {
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .panel-desc {
          font-size: 13px;
          line-height: 1.5;
        }

        /* Przycisk ikonowy */
        .btn-icon {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: var(--color-text-secondary);
          width: 32px;
          height: 32px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-icon:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.15);
        }

        /* Karty Akcji */
        .action-card {
          padding: 16px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: all 0.3s;
        }

        .action-card:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);
        }

        /* Tabela punktów przywracania */
        .table-wrapper {
          overflow-x: auto;
          background: rgba(0, 0, 0, 0.2);
          border-radius: 16px;
          border: 1px solid rgba(255, 255, 255, 0.03);
        }

        .restore-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
        }

        .restore-table th {
          padding: 12px 16px;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--color-text-muted);
          background: rgba(255, 255, 255, 0.02);
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          font-weight: 700;
        }

        .restore-table td {
          padding: 14px 16px;
          font-size: 13px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
        }

        .restore-table tr:hover td {
          background: rgba(255, 255, 255, 0.01);
        }

        .type-badge {
          font-size: 10px;
          font-weight: 700;
          color: #b39ddb;
          background: rgba(107, 78, 230, 0.1);
          border: 1px solid rgba(107, 78, 230, 0.2);
          padding: 2px 8px;
          border-radius: 20px;
          display: inline-block;
          text-transform: uppercase;
        }

        /* Karta ostrzeżenia */
        .alert-card {
          padding: 16px;
          border-radius: 16px;
          background: rgba(239, 68, 68, 0.05);
          border: 1px solid rgba(239, 68, 68, 0.15);
        }

        .alert-icon {
          color: #ef4444;
          flex-shrink: 0;
        }

        .alert-title {
          margin: 0 0 4px 0;
          font-size: 14px;
          font-weight: 700;
          color: #fca5a5;
        }

        .alert-desc {
          margin: 0;
          line-height: 1.5;
        }

        /* Karta informacyjna */
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

        /* Animacje i Loader */
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

        /* Tab Switcher */
        .tab-switcher {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          display: flex;
          gap: 4px;
          padding: 4px;
          border-radius: 12px;
          max-width: 360px;
        }
        .tab-btn {
          flex: 1;
          background: transparent;
          border: none;
          color: var(--color-text-muted);
          padding: 8px 16px;
          border-radius: 8px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease-in-out;
        }
        .tab-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.03);
        }
        .tab-btn.active {
          color: var(--color-primary);
          background: rgba(69, 243, 255, 0.08);
          border: 1px solid rgba(69, 243, 255, 0.15);
        }
      `}</style>
    </div>
  )
}
