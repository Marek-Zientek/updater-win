import { useState, useEffect } from 'react'
import { useOutletContext } from 'react-router-dom'
import {
  Settings as SettingsIcon,
  Monitor,
  Clock,
  ShieldAlert,
  Trash2,
  CheckCircle,
  Activity,
  Sliders,
  User,
  UploadCloud,
  DownloadCloud,
  Cloud,
  RefreshCw
} from 'lucide-react'

export function Settings() {
  const { user } = useOutletContext<{ user: any }>() || {}
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true)
  const [checkIntervalHours, setCheckIntervalHours] = useState('6')
  const [minimizeToTray, setMinimizeToTray] = useState(true)
  const [notificationsEnabled, setNotificationsEnabled] = useState(true)
  const [autoRestorePoint, setAutoRestorePoint] = useState(true)
  const [openAtLogin, setOpenAtLogin] = useState(false)
  const [thermalMonitorEnabled, setThermalMonitorEnabled] = useState(true)
  const [thermalThresholdTemp, setThermalThresholdTemp] = useState('85')
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

  // Cloud Sync & Telemetry states
  const [autoSyncCloud, setAutoSyncCloud] = useState(false)
  const [telemetryEnabled, setTelemetryEnabled] = useState(true)
  const [lastSyncedAt, setLastSyncedAt] = useState('Nigdy')
  const [syncingToCloud, setSyncingToCloud] = useState(false)
  const [syncingFromCloud, setSyncingFromCloud] = useState(false)
  const [submittingTelemetry, setSubmittingTelemetry] = useState(false)
  const [cloudSyncError, setCloudSyncError] = useState('')
  const [telemetryError, setTelemetryError] = useState('')
  const [telemetrySuccess, setTelemetrySuccess] = useState(false)

  // HUD & Cleaner Settings
  const [autoCleanEnabled, setAutoCleanEnabled] = useState(false)
  const [autoCleanInterval, setAutoCleanInterval] = useState('weekly')
  const [hudOpacity, setHudOpacity] = useState('0.72')
  const [hudHuePrimary, setHudHuePrimary] = useState('180')
  const [hudHueSecondary, setHudHueSecondary] = useState('280')
  const [hudSensorCpu, setHudSensorCpu] = useState(true)
  const [hudSensorRam, setHudSensorRam] = useState(true)
  const [hudSensorGpu, setHudSensorGpu] = useState(true)
  const [hudSensorFps, setHudSensorFps] = useState(true)
  const [hudSensorPing, setHudSensorPing] = useState(true)

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

        const openAtLoginRes = await window.api.getSetting('open_at_login', 'false')
        setOpenAtLogin(openAtLoginRes.value === 'true')

        const thermalEnabledRes = await window.api.getSetting('thermal_monitor_enabled', 'true')
        setThermalMonitorEnabled(thermalEnabledRes.value === 'true')

        const thermalThresholdRes = await window.api.getSetting('thermal_threshold_temp', '85')
        setThermalThresholdTemp(thermalThresholdRes.value || '85')

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

        // Load HUD & Cleaner settings
        const autoCleanEnabledRes = await window.api.getSetting('auto_clean_enabled', 'false')
        setAutoCleanEnabled(autoCleanEnabledRes.value === 'true')

        const autoCleanIntervalRes = await window.api.getSetting('auto_clean_interval', 'weekly')
        setAutoCleanInterval(autoCleanIntervalRes.value || 'weekly')

        const hudOpacityRes = await window.api.getSetting('hud_opacity', '0.72')
        setHudOpacity(hudOpacityRes.value || '0.72')

        const hudHuePrimaryRes = await window.api.getSetting('hud_hue_primary', '180')
        setHudHuePrimary(hudHuePrimaryRes.value || '180')

        const hudHueSecondaryRes = await window.api.getSetting('hud_hue_secondary', '280')
        setHudHueSecondary(hudHueSecondaryRes.value || '280')

        const hudSensorCpuRes = await window.api.getSetting('hud_sensor_cpu', 'true')
        setHudSensorCpu(hudSensorCpuRes.value === 'true')

        const hudSensorRamRes = await window.api.getSetting('hud_sensor_ram', 'true')
        setHudSensorRam(hudSensorRamRes.value === 'true')

        const hudSensorGpuRes = await window.api.getSetting('hud_sensor_gpu', 'true')
        setHudSensorGpu(hudSensorGpuRes.value === 'true')

        const hudSensorFpsRes = await window.api.getSetting('hud_sensor_fps', 'true')
        setHudSensorFps(hudSensorFpsRes.value === 'true')

        const hudSensorPingRes = await window.api.getSetting('hud_sensor_ping', 'true')
        setHudSensorPing(hudSensorPingRes.value === 'true')

        // Load Cloud Sync & Telemetry Settings
        const autoSyncRes = await window.api.getSetting('auto_sync_cloud', 'false')
        setAutoSyncCloud(autoSyncRes.value === 'true')

        const telemetryRes = await window.api.getSetting('telemetry_enabled', 'true')
        setTelemetryEnabled(telemetryRes.value === 'true')

        const lastSyncedRes = await window.api.getSetting('last_synced_at', 'Nigdy')
        setLastSyncedAt(lastSyncedRes.value || 'Nigdy')

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

  const handleExportProfile = async () => {
    try {
      const res = await window.api.auth.exportUserProfile(user?.id)
      if (res.success && res.profileJson) {
        const blob = new Blob([res.profileJson], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `updater_win_profile_${user?.name || 'user'}.json`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        alert(res.error || 'Błąd podczas eksportowania profilu.')
      }
    } catch (err: any) {
      alert(`Błąd eksportu: ${err.message}`)
    }
  }

  const handleImportProfile = () => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json'
    input.onchange = async (e: any) => {
      const file = e.target.files[0]
      if (!file) return
      const reader = new FileReader()
      reader.onload = async (evt: any) => {
        try {
          const content = evt.target.result
          const res = await window.api.auth.importUserProfile(content)
          if (res.success) {
            alert('Profil i ustawienia zostały zaimportowane pomyślnie! Kliknij OK, aby odświeżyć aplikację.')
            window.location.reload()
          } else {
            alert(res.error || 'Nieprawidłowy plik profilu.')
          }
        } catch (err: any) {
          alert(`Błąd importu: ${err.message}`)
        }
      }
      reader.readAsText(file)
    }
    input.click()
  }

  const handleSyncToCloud = async () => {
    const token = localStorage.getItem('auth_token') || ''
    if (!token) {
      setCloudSyncError('Wymagane zalogowanie, aby korzystać z synchronizacji chmurowej.')
      return
    }
    setSyncingToCloud(true)
    setCloudSyncError('')
    try {
      const res = await window.api.auth.syncProfileToCloud(token)
      if (res.success) {
        const timeStr = res.lastSyncedAt ? new Date(res.lastSyncedAt).toLocaleString('pl-PL') : new Date().toLocaleString('pl-PL')
        setLastSyncedAt(timeStr)
        await window.api.saveSetting('last_synced_at', timeStr)
      } else {
        setCloudSyncError(res.error || 'Nieznany błąd synchronizacji.')
      }
    } catch (err: any) {
      setCloudSyncError(err.message || 'Wystąpił błąd podczas komunikacji z serwerem.')
    } finally {
      setSyncingToCloud(false)
    }
  }

  const handleSyncFromCloud = async () => {
    const token = localStorage.getItem('auth_token') || ''
    if (!token) {
      setCloudSyncError('Wymagane zalogowanie, aby korzystać z synchronizacji chmurowej.')
      return
    }
    setSyncingFromCloud(true)
    setCloudSyncError('')
    try {
      const res = await window.api.auth.syncProfileFromCloud(token)
      if (res.success) {
        alert('Ustawienia i spersonalizowane nazwy zostały pomyślnie zsynchronizowane z chmury!')
        window.location.reload()
      } else {
        setCloudSyncError(res.error || 'Nieznany błąd pobierania danych.')
      }
    } catch (err: any) {
      setCloudSyncError(err.message || 'Wystąpił błąd podczas komunikacji z serwerem.')
    } finally {
      setSyncingFromCloud(false)
    }
  }

  const handleSubmitTelemetry = async () => {
    const token = localStorage.getItem('auth_token') || ''
    setSubmittingTelemetry(true)
    setTelemetryError('')
    setTelemetrySuccess(false)
    try {
      let hardwareInfo: any = null
      try {
        const hw = await window.api.getHardwareInfo()
        if (hw.success) hardwareInfo = hw.data
      } catch (e) {
        // Fallback
      }

      const telemetryData = {
        os: 'Windows 10/11',
        appVersion: '1.4.0',
        timestamp: new Date().toISOString(),
        settings: {
          autoCheckEnabled,
          checkIntervalHours,
          autoUpdateEnabled,
          autoCleanEnabled,
          autoRestorePoint,
          telemetryEnabled,
          autoSyncCloud
        },
        hardware: hardwareInfo ? {
          cpu: hardwareInfo.cpu?.brand || hardwareInfo.cpu?.name,
          ram: hardwareInfo.ram?.total,
          gpu: hardwareInfo.gpu?.name || (hardwareInfo.gpu?.controllers && hardwareInfo.gpu.controllers[0]?.model)
        } : 'Brak danych sprzętowych'
      }

      const res = await window.api.auth.submitSystemTelemetry(token, telemetryData)
      if (res.success) {
        setTelemetrySuccess(true)
        setTimeout(() => setTelemetrySuccess(false), 3000)
      } else {
        setTelemetryError(res.error || 'Błąd wysyłania telemetrii.')
      }
    } catch (err: any) {
      setTelemetryError(err.message || 'Błąd komunikacji z serwerem telemetrii.')
    } finally {
      setSubmittingTelemetry(false)
    }
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

        {/* Sekcja: Konto & Synchronizacja Chmurowa */}
        <section className="settings-section glass-panel">
          <h3 className="section-title">
            <User size={18} color="var(--color-primary)" />
            Konto & Synchronizacja Chmurowa
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', padding: '8px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '16px', padding: '16px', flexWrap: 'wrap' }}>
              <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', color: 'white', fontSize: '20px', flexShrink: 0 }}>
                {user?.name ? user.name[0].toUpperCase() : 'A'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, color: '#fff', fontSize: '15px' }}>{user?.name || 'Zalogowany Administrator'}</div>
                <div style={{ fontSize: '12px', color: 'var(--color-text-muted)', marginTop: '2px' }}>{user?.email || 'Brak powiązanego adresu email'}</div>
              </div>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  className="btn btn-secondary flex items-center gap-xs"
                  onClick={handleExportProfile}
                  title="Eksportuj ustawienia do pliku JSON"
                  style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px', gap: '6px' }}
                >
                  <DownloadCloud size={14} />
                  <span>Kopia (Eksport)</span>
                </button>
                <button
                  className="btn btn-primary flex items-center gap-xs"
                  onClick={handleImportProfile}
                  title="Importuj profil z pliku JSON"
                  style={{ padding: '8px 12px', borderRadius: '10px', fontSize: '12px', gap: '6px', background: 'var(--color-primary)', color: '#000', fontWeight: '600' }}
                >
                  <UploadCloud size={14} />
                  <span>Przywróć (Import)</span>
                </button>
              </div>
            </div>

            {/* Cloud Synchronization Panel */}
            <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                <div>
                  <h4 style={{ margin: 0, fontSize: '14px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Cloud size={16} color="var(--color-primary)" />
                    Synchronizacja Chmurowa
                  </h4>
                  <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--color-text-muted)' }}>
                    Ostatnia synchronizacja: <strong style={{ color: 'var(--color-primary)' }}>{lastSyncedAt}</strong>
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    className="btn btn-secondary flex items-center gap-xs"
                    onClick={handleSyncFromCloud}
                    disabled={syncingFromCloud || syncingToCloud}
                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', gap: '6px' }}
                  >
                    {syncingFromCloud ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <DownloadCloud size={12} />
                    )}
                    <span>Pobierz</span>
                  </button>
                  <button
                    className="btn btn-primary flex items-center gap-xs"
                    onClick={handleSyncToCloud}
                    disabled={syncingFromCloud || syncingToCloud}
                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '12px', gap: '6px', background: 'var(--color-primary)', color: '#000', fontWeight: 600 }}
                  >
                    {syncingToCloud ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <UploadCloud size={12} />
                    )}
                    <span>Wyślij</span>
                  </button>
                </div>
              </div>

              {cloudSyncError && (
                <div style={{ fontSize: '11px', color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', marginBottom: '12px' }}>
                  {cloudSyncError}
                </div>
              )}

              {/* Toggles inside cloud panel */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '12px' }}>
                <div className="setting-row" style={{ padding: 0 }}>
                  <div className="setting-info">
                    <span className="setting-label" style={{ fontSize: '13px' }}>Automatyczna synchronizacja</span>
                    <span className="setting-desc" style={{ fontSize: '11px' }}>
                      Automatycznie synchronizuj profil z chmurą przy wprowadzaniu zmian
                    </span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={autoSyncCloud}
                      onChange={(e) =>
                        handleSave(
                          'auto_sync_cloud',
                          e.target.checked.toString(),
                          setAutoSyncCloud,
                          e.target.checked
                        )
                      }
                    />
                    <span className="slider"></span>
                  </label>
                </div>

                <div className="setting-row" style={{ padding: 0 }}>
                  <div className="setting-info">
                    <span className="setting-label" style={{ fontSize: '13px' }}>Telemetria & Raportowanie</span>
                    <span className="setting-desc" style={{ fontSize: '11px' }}>
                      Wspieraj rozwój aplikacji wysyłając zanonimizowane statystyki wydajności
                    </span>
                  </div>
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={telemetryEnabled}
                      onChange={(e) =>
                        handleSave(
                          'telemetry_enabled',
                          e.target.checked.toString(),
                          setTelemetryEnabled,
                          e.target.checked
                        )
                      }
                    />
                    <span className="slider"></span>
                  </label>
                </div>
              </div>
            </div>

            {/* Diagnostics and Manual Telemetry */}
            {telemetryEnabled && (
              <div style={{ background: 'rgba(255,255,255,0.01)', borderRadius: '12px', padding: '16px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#fff', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Activity size={15} color="var(--color-secondary)" />
                      Zanonimizowany Raport Diagnostyczny
                    </h4>
                    <p style={{ margin: '2px 0 0 0', fontSize: '11px', color: 'var(--color-text-muted)' }}>
                      Wysyła konfigurację sprzętową (CPU/RAM/GPU) oraz status optymalizacji.
                    </p>
                  </div>
                  <button
                    className="btn btn-secondary flex items-center gap-xs"
                    onClick={handleSubmitTelemetry}
                    disabled={submittingTelemetry}
                    style={{ padding: '6px 12px', borderRadius: '8px', fontSize: '11px', gap: '6px' }}
                  >
                    {submittingTelemetry ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <span>Wyślij telemetrię teraz</span>
                    )}
                  </button>
                </div>

                {telemetrySuccess && (
                  <div style={{ fontSize: '11px', color: 'var(--color-success)', background: 'rgba(34, 197, 94, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(34, 197, 94, 0.2)', marginTop: '10px' }}>
                    Telemetria została pomyślnie przesłana i zanonimizowana na serwerze!
                  </div>
                )}

                {telemetryError && (
                  <div style={{ fontSize: '11px', color: 'var(--color-danger)', background: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)', marginTop: '10px' }}>
                    {telemetryError}
                  </div>
                )}
              </div>
            )}
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
              <span className="setting-label">Uruchamiaj z systemem Windows</span>
              <span className="setting-desc">
                Automatycznie uruchamiaj aplikację przy starcie systemu operacyjnego
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={openAtLogin}
                onChange={(e) =>
                  handleSave(
                    'open_at_login',
                    e.target.checked.toString(),
                    setOpenAtLogin,
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

        {/* Sekcja: Monitorowanie & Ochrona Termiczna */}
        <section className="settings-section glass-panel">
          <h3 className="section-title">
            <ShieldAlert size={18} color="var(--color-warning)" />
            Monitorowanie & Ochrona Termiczna
          </h3>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Monitorowanie temperatury w tle</span>
              <span className="setting-desc">
                Cyklicznie bada temperaturę procesora (CPU) i karty graficznej (GPU) w celu wykrycia przegrzania
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={thermalMonitorEnabled}
                onChange={(e) =>
                  handleSave(
                    'thermal_monitor_enabled',
                    e.target.checked.toString(),
                    setThermalMonitorEnabled,
                    e.target.checked
                  )
                }
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className={`setting-row ${!thermalMonitorEnabled ? 'disabled' : ''}`}>
            <div className="setting-info">
              <span className="setting-label">Próg temperatury ostrzeżenia</span>
              <span className="setting-desc">
                Temperatura, po której przekroczeniu na dłużej niż 30 sekund otrzymasz powiadomienie systemowe
              </span>
            </div>
            <select
              value={thermalThresholdTemp}
              disabled={!thermalMonitorEnabled}
              onChange={(e) =>
                handleSave(
                  'thermal_threshold_temp',
                  e.target.value,
                  setThermalThresholdTemp,
                  e.target.value
                )
              }
              className="select-custom"
            >
              <option value="70">70°C (Niski próg)</option>
              <option value="75">75°C</option>
              <option value="80">80°C</option>
              <option value="85">85°C (Domyślny / Zalecane)</option>
              <option value="90">90°C (Wysoki próg)</option>
            </select>
          </div>
        </section>

        {/* Sekcja: Harmonogram Czyszczenia w Tle */}
        <section className="settings-section glass-panel">
          <h3 className="section-title">
            <Sliders size={18} color="var(--color-primary)" />
            Automatyczne Czyszczenie Dysku w Tle
          </h3>

          <div className="setting-row">
            <div className="setting-info">
              <span className="setting-label">Włącz automatyczne czyszczenie</span>
              <span className="setting-desc">
                Okresowo czyści pliki tymczasowe, logi i pamięć podręczną w tle
              </span>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={autoCleanEnabled}
                onChange={(e) =>
                  handleSave(
                    'auto_clean_enabled',
                    e.target.checked.toString(),
                    setAutoCleanEnabled,
                    e.target.checked
                  )
                }
              />
              <span className="slider"></span>
            </label>
          </div>

          <div className={`setting-row ${!autoCleanEnabled ? 'disabled' : ''}`}>
            <div className="setting-info">
              <span className="setting-label">Interwał czyszczenia</span>
              <span className="setting-desc">
                Określa, jak często ma być uruchamiane czyszczenie w tle
              </span>
            </div>
            <select
              value={autoCleanInterval}
              disabled={!autoCleanEnabled}
              onChange={(e) =>
                handleSave(
                  'auto_clean_interval',
                  e.target.value,
                  setAutoCleanInterval,
                  e.target.value
                )
              }
              className="select-custom"
            >
              <option value="daily">Codziennie</option>
              <option value="weekly">Co tydzień (Zalecane)</option>
              <option value="monthly">Co miesiąc</option>
            </select>
          </div>
        </section>

        {/* Sekcja: Konfiguracja nakładki HUD */}
        <section className="settings-section glass-panel">
          <h3 className="section-title">
            <Activity size={18} color="var(--color-secondary)" />
            Personalizacja Nakładki HUD
          </h3>

          <div className="setting-row flex-col" style={{ alignItems: 'stretch', gap: '16px' }}>
            <div className="setting-info">
              <span className="setting-label">Przezroczystość tła HUD</span>
              <span className="setting-desc">Dostosuj przezroczystość tła (aktualna: {Math.round(parseFloat(hudOpacity) * 100)}%)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.05"
                value={hudOpacity}
                onChange={(e) => {
                  setHudOpacity(e.target.value)
                }}
                onMouseUp={(e: any) =>
                  handleSave(
                    'hud_opacity',
                    e.target.value,
                    setHudOpacity,
                    e.target.value
                  )
                }
                style={{ flex: 1, accentColor: 'var(--color-primary)' }}
              />
              <span className="font-mono text-xs" style={{ width: '40px', textAlign: 'right' }}>{hudOpacity}</span>
            </div>
          </div>

          <div className="setting-row flex-col" style={{ alignItems: 'stretch', gap: '16px' }}>
            <div className="setting-info">
              <span className="setting-label">Kolor wiodący HUD (Barwa Hue)</span>
              <span className="setting-desc">Dostosuj podstawową barwę HSL (aktualna: {hudHuePrimary}°)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={hudHuePrimary}
                onChange={(e) => {
                  setHudHuePrimary(e.target.value)
                }}
                onMouseUp={(e: any) =>
                  handleSave(
                    'hud_hue_primary',
                    e.target.value,
                    setHudHuePrimary,
                    e.target.value
                  )
                }
                style={{ flex: 1, accentColor: `hsl(${hudHuePrimary}, 100%, 50%)` }}
              />
              <span className="font-mono text-xs" style={{ width: '40px', textAlign: 'right' }}>{hudHuePrimary}°</span>
            </div>
          </div>

          <div className="setting-row flex-col" style={{ alignItems: 'stretch', gap: '16px' }}>
            <div className="setting-info">
              <span className="setting-label">Kolor pomocniczy HUD (Barwa Hue)</span>
              <span className="setting-desc">Dostosuj wtórną barwę HSL (aktualna: {hudHueSecondary}°)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <input
                type="range"
                min="0"
                max="360"
                step="1"
                value={hudHueSecondary}
                onChange={(e) => {
                  setHudHueSecondary(e.target.value)
                }}
                onMouseUp={(e: any) =>
                  handleSave(
                    'hud_hue_secondary',
                    e.target.value,
                    setHudHueSecondary,
                    e.target.value
                  )
                }
                style={{ flex: 1, accentColor: `hsl(${hudHueSecondary}, 100%, 50%)` }}
              />
              <span className="font-mono text-xs" style={{ width: '40px', textAlign: 'right' }}>{hudHueSecondary}°</span>
            </div>
          </div>

          <div className="setting-row flex-col" style={{ alignItems: 'stretch', padding: '12px 0' }}>
            <div className="setting-info mb-sm">
              <span className="setting-label">Aktywne sensory w HUD</span>
              <span className="setting-desc">Wybierz metryki wyświetlane na nakładce HUD</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginTop: '12px' }}>
              {/* CPU Sensor */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-xs font-semibold text-white">Sensor CPU</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={hudSensorCpu}
                    onChange={(e) =>
                      handleSave(
                        'hud_sensor_cpu',
                        e.target.checked.toString(),
                        setHudSensorCpu,
                        e.target.checked
                      )
                    }
                  />
                  <span className="slider"></span>
                </label>
              </div>

              {/* RAM Sensor */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-xs font-semibold text-white">Sensor RAM</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={hudSensorRam}
                    onChange={(e) =>
                      handleSave(
                        'hud_sensor_ram',
                        e.target.checked.toString(),
                        setHudSensorRam,
                        e.target.checked
                      )
                    }
                  />
                  <span className="slider"></span>
                </label>
              </div>

              {/* GPU Sensor */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-xs font-semibold text-white">Sensor GPU</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={hudSensorGpu}
                    onChange={(e) =>
                      handleSave(
                        'hud_sensor_gpu',
                        e.target.checked.toString(),
                        setHudSensorGpu,
                        e.target.checked
                      )
                    }
                  />
                  <span className="slider"></span>
                </label>
              </div>

              {/* FPS Sensor */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-xs font-semibold text-white">Klatki (FPS)</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={hudSensorFps}
                    onChange={(e) =>
                      handleSave(
                        'hud_sensor_fps',
                        e.target.checked.toString(),
                        setHudSensorFps,
                        e.target.checked
                      )
                    }
                  />
                  <span className="slider"></span>
                </label>
              </div>

              {/* Ping Sensor */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'rgba(0,0,0,0.15)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                <span className="text-xs font-semibold text-white">Opóźnienie (Ping)</span>
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={hudSensorPing}
                    onChange={(e) =>
                      handleSave(
                        'hud_sensor_ping',
                        e.target.checked.toString(),
                        setHudSensorPing,
                        e.target.checked
                      )
                    }
                  />
                  <span className="slider"></span>
                </label>
              </div>
            </div>
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
