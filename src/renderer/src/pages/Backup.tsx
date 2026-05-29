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
  Info
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

  const showToast = (text: string, type: 'success' | 'error') => {
    setStatusMessage({ text, type })
    setTimeout(() => setStatusMessage(null), 5000)
  }

  useEffect(() => {
    loadRestorePoints()
  }, [])

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
      {/* Header */}
      <header className="mb-lg">
        <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}>
          Kopia Zapasowa i Przywracanie
        </h1>
        <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          Zabezpieczaj ustawienia systemu operacyjnego oraz konfigurację swoich aplikacji
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

      <div className="grid-panels">
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
                  przystąpieniem do modyfikacji systemu.
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

      <style>{`
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
      `}</style>
    </div>
  )
}
