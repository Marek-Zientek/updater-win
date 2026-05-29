import { useState, useEffect } from 'react'
import {
  Settings as SettingsIcon,
  Monitor,
  Clock,
  ShieldAlert,
  Trash2,
  CheckCircle
} from 'lucide-react'

export function Settings() {
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true)
  const [checkIntervalHours, setCheckIntervalHours] = useState('6')
  const [minimizeToTray, setMinimizeToTray] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [autoRestorePoint, setAutoRestorePoint] = useState(true)
  const [, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [iconCacheCleared, setIconCacheCleared] = useState(false)

  const [autoUpdateEnabled, setAutoUpdateEnabled] = useState(false)
  const [autoUpdateTime, setAutoUpdateTime] = useState('02:00')
  const [autoUpdateInterval, setAutoUpdateInterval] = useState('daily')
  const [autoUpdateWeekday, setAutoUpdateWeekday] = useState('1')
  const [autoUpdateScope, setAutoUpdateScope] = useState('all')
  const [installedApps, setInstalledApps] = useState<any[]>([])
  const [whitelist, setWhitelist] = useState<string[]>([])

  // Załaduj ustawienia przy starcie
  useEffect(() => {
    const loadSettings = async () => {
      try {
        const autoCheckRes = await window.api.getSetting('auto_check_enabled', 'true')
        setAutoCheckEnabled(autoCheckRes.value === 'true')

        const intervalRes = await window.api.getSetting('check_interval_hours', '6')
        setCheckIntervalHours(intervalRes.value || '6')

        const minToTrayRes = await window.api.getSetting('minimize_to_tray', 'true')
        setMinimizeToTray(minToTrayRes.value === 'true')

        const notifyRes = await window.api.getSetting('notifications_enabled', 'true')
        setNotificationsEnabled(notifyRes.value === 'true')

        const autoRestoreRes = await window.api.getSetting('auto_restore_point', 'true')
        setAutoRestorePoint(autoRestoreRes.value === 'true')

        const autoUpRes = await window.api.getSetting('auto_update_enabled', 'false')
        setAutoUpdateEnabled(autoUpRes.value === 'true')

        const upTimeRes = await window.api.getSetting('auto_update_time', '02:00')
        setAutoUpdateTime(upTimeRes.value || '02:00')

        const upIntervalRes = await window.api.getSetting('auto_update_interval', 'daily')
        setAutoUpdateInterval(upIntervalRes.value || 'daily')

        const upWeekdayRes = await window.api.getSetting('auto_update_weekday', '1')
        setAutoUpdateWeekday(upWeekdayRes.value || '1')

        const upScopeRes = await window.api.getSetting('auto_update_scope', 'all')
        setAutoUpdateScope(upScopeRes.value || 'all')

        const upWhitelistRes = await window.api.getSetting('auto_update_whitelist', '')
        setWhitelist(upWhitelistRes.value ? upWhitelistRes.value.split(',') : [])

        const installedRes = await window.api.getInstalledApps()
        if (installedRes.success) {
          setInstalledApps(installedRes.data || [])
        }
      } catch (err) {
        console.error('Failed to load settings:', err)
      }
    }
    loadSettings()
  }, [])

  const handleSave = async (
    key: string,
    value: string,
    setLocalState: (val: any) => void,
    localVal: any
  ) => {
    setSaving(true)
    setLocalState(localVal)
    try {
      await window.api.saveSetting(key, value)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    } catch (err) {
      console.error(`Failed to save setting ${key}:`, err)
    } finally {
      setSaving(false)
    }
  }

  const handleClearIconCache = () => {
    let count = 0
    const keysToRemove: string[] = []

    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('appicon_v1:')) {
        keysToRemove.push(key)
      }
    }

    keysToRemove.forEach((k) => {
      localStorage.removeItem(k)
      count++
    })

    console.log(`Cleared ${count} cached icons.`)
    setIconCacheCleared(true)
    setTimeout(() => setIconCacheCleared(false), 3000)
  }

  const handleToggleWhitelist = async (wingetId: string, checked: boolean) => {
    let newWhitelist = [...whitelist]
    if (checked) {
      if (!newWhitelist.includes(wingetId)) newWhitelist.push(wingetId)
    } else {
      newWhitelist = newWhitelist.filter((id) => id !== wingetId)
    }
    setWhitelist(newWhitelist)
    await window.api.saveSetting('auto_update_whitelist', newWhitelist.join(','))
    setSaveSuccess(true)
    setTimeout(() => setSaveSuccess(false), 2000)
  }

  return (
    <div className="settings-container fade-in">
      <header className="flex items-center justify-between mb-lg">
        <div>
          <h1
            className="flex items-center gap-sm"
            style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}
          >
            <SettingsIcon size={28} color="var(--color-primary)" />
            Ustawienia Aplikacji
          </h1>
          <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
            Dostosuj zachowanie i automatyzację UpdaterWindows
          </p>
        </div>
        {saveSuccess && (
          <div className="status-toast success">
            <CheckCircle size={16} />
            <span>Zapisano zmiany</span>
          </div>
        )}
      </header>

      <div className="settings-grid">
        {/* Sekcja 1: Aktualizacje w tle */}
        <section className="settings-section glass-panel">
          <h3 className="section-title">
            <Clock size={18} color="var(--color-primary)" />
            Automatyzacja & Aktualizacje
          </h3>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Automatyczne sprawdzanie</span>
              <span className="setting-desc">
                Sprawdza czy są dostępne aktualizacje w tle bez udziału użytkownika
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoCheckEnabled}
                onChange={(e) =>
                  handleSave(
                    'auto_check_enabled',
                    e.target.checked.toString(),
                    setAutoCheckEnabled,
                    e.target.checked
                  )
                }
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className={`setting-row ${!autoCheckEnabled ? 'disabled' : ''}`}>
            <div className="setting-info">
              <span className="setting-label">Interwał sprawdzania</span>
              <span className="setting-desc">
                Jak często aplikacja sprawdza dostępność aktualizacji w tle
              </span>
            </div>
            <select
              value={checkIntervalHours}
              disabled={!autoCheckEnabled}
              onChange={(e) =>
                handleSave(
                  'check_interval_hours',
                  e.target.value,
                  setCheckIntervalHours,
                  e.target.value
                )
              }
              className="select-custom"
            >
              <option value="1">Co 1 godzinę</option>
              <option value="3">Co 3 godziny</option>
              <option value="6">Co 6 godzin (Zalecane)</option>
              <option value="12">Co 12 godzin</option>
              <option value="24">Co 24 godziny</option>
            </select>
          </div>
        </section>

        {/* Sekcja: Automatyczne Aktualizacje (Faza 7) */}
        <section className="settings-section glass-panel">
          <h3 className="section-title">
            <Clock size={18} color="var(--color-primary)" />
            Automatyczne Aktualizacje w Tle
          </h3>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Automatyczne instalowanie</span>
              <span className="setting-desc">
                Pobiera i instaluje aktualizacje w tle bez konieczności ręcznego zatwierdzania
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoUpdateEnabled}
                onChange={(e) =>
                  handleSave(
                    'auto_update_enabled',
                    e.target.checked.toString(),
                    setAutoUpdateEnabled,
                    e.target.checked
                  )
                }
              />
              <span className="slider"></span>
            </label>
          </div>

          {autoUpdateEnabled && (
            <>
              <div className="setting-row">
                <div className="setting-info">
                  <span className="setting-label">Godzina aktualizacji</span>
                  <span className="setting-desc">
                    O której godzinie ma nastąpić automatyczna aktualizacja w tle
                  </span>
                </div>
                <input
                  type="time"
                  value={autoUpdateTime}
                  onChange={(e) =>
                    handleSave(
                      'auto_update_time',
                      e.target.value,
                      setAutoUpdateTime,
                      e.target.value
                    )
                  }
                  className="select-custom"
                  style={{ width: '120px', textAlign: 'center' }}
                />
              </div>

              <div className="setting-row">
                <div className="setting-info">
                  <span className="setting-label">Częstotliwość wykonania</span>
                  <span className="setting-desc">
                    Określa jak często ma się wykonywać pętla automatycznych aktualizacji
                  </span>
                </div>
                <select
                  value={autoUpdateInterval}
                  onChange={(e) =>
                    handleSave(
                      'auto_update_interval',
                      e.target.value,
                      setAutoUpdateInterval,
                      e.target.value
                    )
                  }
                  className="select-custom"
                >
                  <option value="daily">Codziennie</option>
                  <option value="weekly">Co tydzień</option>
                  <option value="monthly">Co miesiąc</option>
                </select>
              </div>

              {autoUpdateInterval === 'weekly' && (
                <div className="setting-row">
                  <div className="setting-info">
                    <span className="setting-label">Dzień tygodnia</span>
                    <span className="setting-desc">
                      Wybierz dzień tygodnia do przeprowadzenia aktualizacji
                    </span>
                  </div>
                  <select
                    value={autoUpdateWeekday}
                    onChange={(e) =>
                      handleSave(
                        'auto_update_weekday',
                        e.target.value,
                        setAutoUpdateWeekday,
                        e.target.value
                      )
                    }
                    className="select-custom"
                  >
                    <option value="1">Poniedziałek</option>
                    <option value="2">Wtorek</option>
                    <option value="3">Środa</option>
                    <option value="4">Czwartek</option>
                    <option value="5">Piątek</option>
                    <option value="6">Sobota</option>
                    <option value="7">Niedziela</option>
                  </select>
                </div>
              )}

              <div className="setting-row">
                <div className="setting-info">
                  <span className="setting-label">Zakres aktualizacji</span>
                  <span className="setting-desc">
                    Aktualizuj wszystkie programy lub tylko wybrane z listy
                  </span>
                </div>
                <select
                  value={autoUpdateScope}
                  onChange={(e) =>
                    handleSave(
                      'auto_update_scope',
                      e.target.value,
                      setAutoUpdateScope,
                      e.target.value
                    )
                  }
                  className="select-custom"
                >
                  <option value="all">Wszystkie aplikacje</option>
                  <option value="whitelist">Tylko wybrane aplikacje</option>
                </select>
              </div>

              {autoUpdateScope === 'whitelist' && (
                <div
                  className="setting-row flex-col"
                  style={{ alignItems: 'stretch', padding: '12px 0' }}
                >
                  <div className="setting-info mb-sm">
                    <span className="setting-label" style={{ marginBottom: '4px' }}>
                      Wybierz aplikacje do aktualizacji automatycznej
                    </span>
                    <span className="setting-desc">
                      Zaznaczone aplikacje będą aktualizowane w tle. Niezaznaczone będą wymagały
                      ręcznej aktualizacji.
                    </span>
                  </div>
                  <div
                    className="whitelist-box"
                    style={{
                      maxHeight: '220px',
                      overflowY: 'auto',
                      background: 'rgba(0, 0, 0, 0.2)',
                      borderRadius: '12px',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                      padding: '8px 16px',
                      marginTop: '8px'
                    }}
                  >
                    {installedApps.length === 0 ? (
                      <p className="text-muted text-center py-md text-xs">
                        Brak zainstalowanych aplikacji
                      </p>
                    ) : (
                      installedApps.map((app, i) => (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '8px 0',
                            borderBottom:
                              i < installedApps.length - 1
                                ? '1px solid rgba(255, 255, 255, 0.02)'
                                : 'none'
                          }}
                        >
                          <div
                            style={{
                              display: 'flex',
                              flexDirection: 'column',
                              gap: '2px',
                              maxWidth: '80%'
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                              {app.name}
                            </span>
                            <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>
                              ID: {app.id}
                            </span>
                          </div>
                          <label className="switch">
                            <input
                              type="checkbox"
                              checked={whitelist.includes(app.id)}
                              onChange={(e) => handleToggleWhitelist(app.id, e.target.checked)}
                            />
                            <span className="slider"></span>
                          </label>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </section>

        {/* Sekcja 2: Wygląd i zachowanie */}
        <section className="settings-section glass-panel">
          <h3 className="section-title">
            <Monitor size={18} color="var(--color-secondary)" />
            Zachowanie Aplikacji
          </h3>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Automatyczne punkty przywracania</span>
              <span className="setting-desc">
                Tworzy punkt przywracania systemu Windows przed deinstalacją bloatware lub modyfikacją telemetrii
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoRestorePoint}
                onChange={(e) =>
                  handleSave(
                    'auto_restore_point',
                    e.target.checked.toString(),
                    setAutoRestorePoint,
                    e.target.checked
                  )
                }
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Minimalizuj do zasobnika</span>
              <span className="setting-desc">
                Zamknięcie okna ukrywa aplikację w trayu zamiast ją zamykać
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={minimizeToTray}
                onChange={(e) =>
                  handleSave(
                    'minimize_to_tray',
                    e.target.checked.toString(),
                    setMinimizeToTray,
                    e.target.checked
                  )
                }
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Powiadomienia systemowe</span>
              <span className="setting-desc">
                Wyświetla powiadomienia Toast w systemie Windows o nowych aktualizacjach
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={notificationsEnabled}
                onChange={(e) =>
                  handleSave(
                    'notifications_enabled',
                    e.target.checked.toString(),
                    setNotificationsEnabled,
                    e.target.checked
                  )
                }
              />
              <span className="slider"></span>
            </label>
          </div>
        </section>

        {/* Sekcja 3: Konserwacja */}
        <section className="settings-section glass-panel">
          <h3 className="section-title">
            <ShieldAlert size={18} color="var(--color-warning)" />
            Konserwacja i Dane
          </h3>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Wyczyść pamięć podręczną ikon</span>
              <span className="setting-desc">
                Usuwa wszystkie pobrane i zapisane lokalnie ikony programów (zmusi do ponownego
                pobrania)
              </span>
            </div>
            <button
              className="btn btn-warning flex items-center gap-xs"
              onClick={handleClearIconCache}
            >
              <Trash2 size={16} />
              {iconCacheCleared ? 'Wyczyszczono!' : 'Wyczyść cache'}
            </button>
          </div>
        </section>
      </div>

      <style>{`
        .settings-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 24px;
          height: calc(100vh - 48px);
          width: 100%;
          box-sizing: border-box;
          overflow-y: auto;
        }

        .settings-grid {
          display: flex;
          flex-direction: column;
          gap: 24px;
          max-width: 800px;
          width: 100%;
        }

        .settings-section {
          padding: 24px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .section-title {
          margin: 0 0 8px 0;
          font-size: 16px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
          color: #fff;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 12px;
        }

        .setting-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 0;
          gap: 32px;
          transition: opacity 0.2s;
        }

        .setting-row.disabled {
          opacity: 0.4;
          pointer-events: none;
        }

        .setting-info {
          display: flex;
          flex-direction: column;
          gap: 4px;
          flex: 1;
        }

        .setting-label {
          font-size: 14px;
          font-weight: 600;
          color: #fff;
        }

        .setting-desc {
          font-size: 12px;
          color: var(--color-text-muted, #888);
          line-height: 1.4;
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

        input:focus + .slider {
          box-shadow: 0 0 8px rgba(69, 243, 255, 0.3);
        }

        input:checked + .slider:before {
          transform: translateX(24px);
        }

        /* Custom Select */
        .select-custom {
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          padding: 8px 16px;
          border-radius: 12px;
          font-family: inherit;
          font-size: 13px;
          cursor: pointer;
          outline: none;
          transition: all 0.2s;
        }

        .select-custom:hover:not(:disabled) {
          border-color: var(--color-primary);
          background: rgba(0, 0, 0, 0.4);
        }

        .select-custom:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 2px rgba(69, 243, 255, 0.2);
        }

        .select-custom option {
          background: #111;
          color: #fff;
        }

        /* Buttons */
        .btn-warning {
          background: rgba(234, 179, 8, 0.1);
          border: 1px solid rgba(234, 179, 8, 0.2);
          color: #facc15;
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 13px;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 600;
        }

        .btn-warning:hover {
          background: rgba(234, 179, 8, 0.2);
          border-color: #facc15;
        }

        /* Toast notifications */
        .status-toast {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          border-radius: 30px;
          font-size: 13px;
          font-weight: 600;
          animation: slideInRight 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .status-toast.success {
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          color: #34d399;
        }

        @keyframes slideInRight {
          from { transform: translateX(20px); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
      `}</style>
    </div>
  )
}
