import React from 'react'
import { AlertTriangle, ExternalLink, X, RefreshCw } from 'lucide-react'

interface DownloadFailModalProps {
  isOpen: boolean
  onClose: () => void
  onTryAnyway: () => void
  appName: string
  wingetId: string
  reason?: 'no_installer_url' | 'network_error' | 'disk_write_error' | 'http_error' | null
  statusCode?: number
  installerUrl?: string
  homepageUrl?: string
}

export const DownloadFailModal: React.FC<DownloadFailModalProps> = ({
  isOpen,
  onClose,
  onTryAnyway,
  appName,
  wingetId,
  reason,
  statusCode,
  installerUrl,
  homepageUrl
}) => {
  if (!isOpen) return null

  const getReasonText = () => {
    switch (reason) {
      case 'no_installer_url':
        return 'Nie znaleziono bezpośredniego adresu URL instalatora w bazie Winget dla tej aplikacji.'
      case 'network_error':
        return 'Błąd sieci: Brak odpowiedzi od serwera pobierania. Sprawdź połączenie z internetem oraz czy serwer lub zapora sieciowa (firewall) nie blokuje pobierania.'
      case 'disk_write_error':
        return 'Błąd zapisu na dysku: System nie zezwolił na zapis w katalogu tymczasowym. Upewnij się, że masz wolne miejsce na dysku systemowym C:.'
      case 'http_error':
        return `Błąd HTTP ${statusCode || 'nieznany'}: Serwer pobierania odpowiedział błędem. Plik instalatora może być tymczasowo niedostępny lub przeniesiony.`
      default:
        return 'Wystąpił nieznany błąd podczas weryfikacji możliwości pobrania pliku instalatora.'
    }
  }

  const handleManualDownload = () => {
    // Pierwszy priorytet: bezpośredni instalator z winget. Drugi: strona domowa (homepage). Trzeci: wyszukiwarka winget.run
    const url =
      installerUrl || homepageUrl || `https://winget.run/pkg/${wingetId.replace('.', '/')}`
    window.open(url, '_blank')
  }

  return (
    <div className="modal-backdrop">
      <div className="modal-content glass-panel fade-in">
        <button className="close-btn" onClick={onClose}>
          <X size={18} />
        </button>

        <div className="modal-header">
          <div className="alert-icon-wrapper">
            <AlertTriangle size={24} color="#facc15" />
          </div>
          <div>
            <h3 className="modal-title">Problem z weryfikacją pobierania</h3>
            <p className="modal-subtitle">
              {appName} ({wingetId})
            </p>
          </div>
        </div>

        <div className="modal-body">
          <div className="reason-box">
            <p className="reason-title">Diagnoza błędu:</p>
            <p className="reason-text">{getReasonText()}</p>
          </div>

          <div className="info-bullets">
            <p className="bullet-title">Co możesz zrobić?</p>
            <ul>
              <li>
                Możesz spróbować <strong>Pobrać ręcznie</strong> instalator i zainstalować program
                samodzielnie.
              </li>
              <li>
                Możesz wybrać opcję <strong>Spróbuj mimo to</strong>, aby ominąć test i wymusić
                standardową aktualizację za pomocą Winget (może to jednak potrwać dłużej lub wymagać
                uprawnień).
              </li>
              <li>
                Sprawdź, czy nie masz włączonego oprogramowania antywirusowego lub VPN, które może
                blokować połączenia.
              </li>
            </ul>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn-modal btn-cancel" onClick={onClose}>
            Anuluj
          </button>

          <button className="btn-modal btn-manual" onClick={handleManualDownload}>
            <ExternalLink size={14} />
            <span>Pobierz ręcznie</span>
          </button>

          <button className="btn-modal btn-primary btn-retry" onClick={onTryAnyway}>
            <RefreshCw size={14} />
            <span>Spróbuj mimo to</span>
          </button>
        </div>
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(10px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
        }

        .modal-content {
          width: 100%;
          max-width: 580px;
          background: rgba(20, 20, 25, 0.85);
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 24px;
          padding: 28px;
          position: relative;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(250, 204, 21, 0.05);
        }

        .close-btn {
          position: absolute;
          top: 20px;
          right: 20px;
          background: transparent;
          border: none;
          color: #888;
          cursor: pointer;
          padding: 6px;
          border-radius: 50%;
          transition: all 0.2s;
        }

        .close-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.05);
        }

        .modal-header {
          display: flex;
          align-items: center;
          gap: 16px;
          margin-bottom: 24px;
        }

        .alert-icon-wrapper {
          width: 48px;
          height: 48px;
          background: rgba(250, 204, 21, 0.1);
          border: 1px solid rgba(250, 204, 21, 0.2);
          border-radius: 14px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .modal-title {
          margin: 0;
          font-size: 18px;
          font-weight: 800;
          color: #fff;
        }

        .modal-subtitle {
          margin: 4px 0 0 0;
          font-size: 13px;
          color: #888;
          font-weight: 500;
        }

        .modal-body {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .reason-box {
          background: rgba(250, 204, 21, 0.03);
          border: 1px solid rgba(250, 204, 21, 0.1);
          border-radius: 16px;
          padding: 16px;
        }

        .reason-title {
          margin: 0 0 6px 0;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #facc15;
          font-weight: 800;
        }

        .reason-text {
          margin: 0;
          font-size: 13px;
          color: #ddd;
          line-height: 1.5;
        }

        .info-bullets {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .bullet-title {
          margin: 0;
          font-size: 13px;
          color: #fff;
          font-weight: 700;
        }

        .info-bullets ul {
          margin: 0;
          padding-left: 20px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .info-bullets li {
          font-size: 12px;
          color: #aaa;
          line-height: 1.5;
        }

        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 28px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          padding-top: 20px;
        }

        .btn-modal {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 18px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          outline: none;
        }

        .btn-cancel {
          background: transparent;
          border: 1px solid rgba(255, 255, 255, 0.1);
          color: #ccc;
        }

        .btn-cancel:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
          border-color: rgba(255, 255, 255, 0.2);
        }

        .btn-manual {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
        }

        .btn-manual:hover {
          background: rgba(255, 255, 255, 0.1);
          border-color: rgba(69, 243, 255, 0.2);
        }

        .btn-retry {
          background: var(--color-primary);
          border: 1px solid var(--color-primary-glow, rgba(69, 243, 255, 0.2));
          color: var(--color-bg-main, #0b0b0f);
        }

        .btn-retry:hover {
          box-shadow: 0 0 15px var(--color-primary-glow, rgba(69, 243, 255, 0.4));
          background: #5ef5ff;
        }
      `}</style>
    </div>
  )
}
