import { useEffect, useState } from 'react'
import {
  Globe,
  Activity,
  Zap,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Wifi,
  WifiOff,
  Terminal,
  ArrowDown,
  ArrowUp,
  Monitor
} from 'lucide-react'
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts'

interface DnsProfile {
  name: string
  primary: string
  secondary: string
  ping: number // w milisekundach
}

interface NetworkInterface {
  interfaceIndex: number
  interfaceAlias: string
  addresses: string[]
}

export function Network() {
  // Układ zakładek
  const [activeTab, setActiveTab] = useState<'dns' | 'speedtest'>('dns')

  // Stany DNS
  const [interfaces, setInterfaces] = useState<NetworkInterface[]>([])
  const [selectedInterfaceIndex, setSelectedInterfaceIndex] = useState<number | ''>('')
  const [dnsProfiles, setDnsProfiles] = useState<DnsProfile[]>([
    { name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1', ping: 0 },
    { name: 'Google', primary: '8.8.8.8', secondary: '8.8.4.4', ping: 0 },
    {
      name: 'AdGuard (Blokada reklam)',
      primary: '94.140.14.14',
      secondary: '94.140.15.15',
      ping: 0
    }
  ])

  // Szczegóły techniczne karty sieciowej
  const [details, setDetails] = useState<any>(null)

  // Wi-Fi Details
  const [wifiDetails, setWifiDetails] = useState<any>(null)

  // Stany testu prędkości
  const [testState, setTestState] = useState<
    'idle' | 'ping' | 'download' | 'upload' | 'done' | 'error'
  >('idle')
  const [speedMetrics, setSpeedMetrics] = useState<{
    ping: number
    jitter: number
    download: number
    upload: number
  }>({ ping: 0, jitter: 0, download: 0, upload: 0 })

  // Bieżące pomiary w czasie rzeczywistym
  const [currentSpeed, setCurrentSpeed] = useState<number>(0)
  const [currentPercent, setCurrentPercent] = useState<number>(0)
  const [chartData, setChartData] = useState<{ time: number; speed: number }[]>([])

  // Stany wczytywania
  const [loadingConfig, setLoadingConfig] = useState(false)
  const [pinging, setPinging] = useState(false)
  const [savingDns, setSavingDns] = useState(false)
  const [repairing, setRepairing] = useState(false)

  // Stany dla DoH i Hardening
  const [dohStatus, setDohStatus] = useState<any[]>([])
  const [hardening, setHardening] = useState<{ llmnrDisabled: boolean; netbiosDisabled: boolean }>({
    llmnrDisabled: false,
    netbiosDisabled: false
  })
  const [loadingHardening, setLoadingHardening] = useState(false)
  const [togglingDoh, setTogglingDoh] = useState(false)

  const loadHardeningAndDoh = async () => {
    try {
      const hardRes = await window.api.getNetworkHardening()
      if (hardRes.success && hardRes.data) {
        setHardening(hardRes.data)
      }
      const dohRes = await window.api.getDnsDohStatus()
      if (dohRes.success && dohRes.data) {
        setDohStatus(dohRes.data)
      }
    } catch (err) {
      console.error('Error loading security details:', err)
    }
  }

  const handleToggleHardening = async (key: 'llmnrDisabled' | 'netbiosDisabled', enabled: boolean) => {
    setLoadingHardening(true)
    appendLog(`Zmienianie ustawienia hardeningu sieci: ${key} na ${enabled}...`)
    const res = await window.api.toggleNetworkHardening(key, enabled)
    if (res.success) {
      showToast('Zmieniono ustawienia zabezpieczeń sieci!', 'success')
      appendLog(`Pomyślnie zmieniono ${key} na ${enabled}`)
      setHardening(prev => ({ ...prev, [key]: enabled }))
    } else {
      showToast(res.error || 'Błąd modyfikacji zabezpieczeń.', 'error')
      appendLog(`Błąd zmiany ${key}: ` + res.error)
    }
    setLoadingHardening(false)
  }

  const handleToggleDoh = async (interfaceGuid: string, dnsIps: string[], enable: boolean) => {
    setTogglingDoh(true)
    appendLog(`Zmienianie statusu DNS-over-HTTPS (DoH) na ${enable} dla adaptera ${interfaceGuid}...`)
    const res = await window.api.toggleDnsDoh(interfaceGuid, dnsIps, enable)
    if (res.success) {
      showToast(`Pomyślnie ${enable ? 'włączono' : 'wyłączono'} szyfrowanie DoH!`, 'success')
      appendLog(`Szyfrowanie DoH dla ${dnsIps.join(', ')} ustawiono na ${enable}`)
      const dohRes = await window.api.getDnsDohStatus()
      if (dohRes.success && dohRes.data) {
        setDohStatus(dohRes.data)
      }
    } else {
      showToast(res.error || 'Błąd konfiguracji DoH.', 'error')
      appendLog('Błąd konfiguracji DoH: ' + res.error)
    }
    setTogglingDoh(false)
  }

  const loadInterfaceDetails = async (index: number) => {
    const res = await window.api.getNetworkDetails(index)
    if (res.success && res.data) {
      setDetails(res.data)
    } else {
      setDetails(null)
    }
  }

  const loadWifiDetails = async () => {
    const res = await window.api.getWifiDetails()
    if (res.success && res.data) {
      setWifiDetails(res.data)
    } else {
      setWifiDetails(null)
    }
  }

  const runSpeedTest = async () => {
    setTestState('ping')
    setSpeedMetrics({ ping: 0, jitter: 0, download: 0, upload: 0 })
    setCurrentSpeed(0)
    setCurrentPercent(0)
    setChartData([])
    appendLog('Rozpoczęto pełny Speed Test...')

    let chartPoints: { time: number; speed: number }[] = []
    let tickCount = 0

    const cleanup = window.api.onSpeedTestProgress((progress: any) => {
      if (progress.type === 'download') {
        setTestState('download')
        setCurrentSpeed(progress.speed)
        setCurrentPercent(progress.percent)

        tickCount++
        if (tickCount % 2 === 0) {
          chartPoints = [...chartPoints, { time: chartPoints.length, speed: progress.speed }]
          setChartData(chartPoints)
        }
      } else if (progress.type === 'upload') {
        setTestState('upload')
        setCurrentSpeed(progress.speed)
        setCurrentPercent(progress.percent)

        tickCount++
        if (tickCount % 2 === 0) {
          chartPoints = [...chartPoints, { time: chartPoints.length, speed: progress.speed }]
          setChartData(chartPoints)
        }
      } else if (progress.type === 'ping-done') {
        appendLog(
          `Test opóźnienia ukończony: Ping = ${progress.ping} ms, Jitter = ${progress.jitter} ms`
        )
        setSpeedMetrics((prev) => ({ ...prev, ping: progress.ping, jitter: progress.jitter }))
      } else if (progress.type === 'download-done') {
        appendLog(`Test pobierania ukończony: Download = ${progress.speed} Mbps`)
        setSpeedMetrics((prev) => ({ ...prev, download: progress.speed }))
        setCurrentSpeed(0)
        setCurrentPercent(0)
      } else if (progress.type === 'upload-done') {
        appendLog(`Test wysyłania ukończony: Upload = ${progress.speed} Mbps`)
        setSpeedMetrics((prev) => ({ ...prev, upload: progress.speed }))
        setCurrentSpeed(0)
        setCurrentPercent(0)
      }
    })

    const res = await window.api.startSpeedTest()
    cleanup()

    if (res.success && res.data) {
      setSpeedMetrics(res.data)
      setTestState('done')
      appendLog(
        `Zakończono Speed Test. Wyniki: Pobieranie: ${res.data.download} Mbps, Wysyłanie: ${res.data.upload} Mbps, Ping: ${res.data.ping} ms`
      )
    } else {
      setTestState('error')
      appendLog('Błąd podczas wykonywania Speed Test: ' + (res.error || 'nieznany błąd'))
      showToast(res.error || 'Błąd Speed Testu', 'error')
    }
  }

  const isProfileActive = (profile: DnsProfile) => {
    if (!details || !details.dns || details.dns.length === 0) {
      if (!selectedDetails || !selectedDetails.addresses || selectedDetails.addresses.length === 0)
        return false
      return selectedDetails.addresses.includes(profile.primary)
    }
    return details.dns.includes(profile.primary)
  }

  // Konsola logów
  const [logs, setLogs] = useState<string[]>([
    'Inicjalizacja Konsoli Optymalizacji Sieciowej...',
    'Gotowy do wykonania testów ping oraz naprawy sieci.'
  ])

  // Toast powiadomień
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' } | null>(null)

  const showToast = (text: string, type: 'success' | 'error') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 5000)
  }

  const appendLog = (text: string) => {
    const time = new Date().toLocaleTimeString('pl-PL')
    setLogs((prev) => [...prev, `[${time}] ${text}`])
  }

  // Wczytywanie interfejsów sieciowych i konfiguracji DNS
  const loadNetworkConfig = async () => {
    setLoadingConfig(true)
    const res = await window.api.getDnsConfig()
    if (res.success && res.data) {
      setInterfaces(res.data)
      if (res.data.length > 0) {
        // Ustaw domyślnie pierwszy aktywny interfejs
        const firstIdx = res.data[0].interfaceIndex
        setSelectedInterfaceIndex(firstIdx)
        loadInterfaceDetails(firstIdx)
      }
      appendLog('Zaimportowano aktywną konfigurację kart sieciowych.')
    } else {
      appendLog('Błąd pobierania kart sieciowych: ' + (res.error || 'nieznany błąd'))
    }
    setLoadingConfig(false)
  }

  // Mierzenie pingu do serwerów DNS
  const runPingTest = async () => {
    setPinging(true)
    appendLog('Rozpoczęto pomiar opóźnień do serwerów DNS...')
    const res = await window.api.pingDnsServers()
    if (res.success && res.data) {
      setDnsProfiles(res.data)
      appendLog('Zakończono pomiar ping. Zaktualizowano wyniki w tabeli.')

      // Rekomendacja najszybszego DNS
      const sorted = [...res.data].sort((a, b) => a.ping - b.ping)
      if (sorted[0] && sorted[0].ping < 999) {
        appendLog(
          `Rekomendacja: Najszybszy serwer to ${sorted[0].name} (opóźnienie: ${sorted[0].ping} ms).`
        )
      }
    } else {
      appendLog('Błąd podczas pingowania: ' + (res.error || 'nieznany błąd'))
    }
    setPinging(false)
  }

  // Aktywacja wybranego profilu DNS
  const handleActivateDns = async (profile: DnsProfile) => {
    if (selectedInterfaceIndex === '') {
      showToast('Wybierz kartę sieciową.', 'error')
      return
    }
    setSavingDns(true)
    appendLog(
      `Wysyłanie żądania zmiany DNS dla interfejsu index ${selectedInterfaceIndex} na ${profile.name}...`
    )

    const res = await window.api.setDnsServers(
      Number(selectedInterfaceIndex),
      profile.primary,
      profile.secondary
    )

    if (res.success) {
      showToast(`Pomyślnie ustawiono serwery DNS na profil: ${profile.name}!`, 'success')
      appendLog(
        `Zastosowano profil DNS: ${profile.name} (${profile.primary}, ${profile.secondary})`
      )
      // Przeładuj konfigurację i szczegóły
      await loadNetworkConfig()
      await loadInterfaceDetails(Number(selectedInterfaceIndex))
    } else {
      showToast(res.error || 'Błąd zmiany DNS.', 'error')
      appendLog('Błąd zmiany DNS: ' + (res.error || 'anulowano przez użytkownika'))
    }
    setSavingDns(false)
  }

  // Przywracanie DNS do DHCP
  const handleResetDns = async () => {
    if (selectedInterfaceIndex === '') {
      showToast('Wybierz kartę sieciową.', 'error')
      return
    }
    setSavingDns(true)
    appendLog(
      `Wysyłanie żądania przywrócenia automatycznego DNS (DHCP) dla interfejsu index ${selectedInterfaceIndex}...`
    )

    const res = await window.api.resetDnsServers(Number(selectedInterfaceIndex))

    if (res.success) {
      showToast('Przywrócono automatyczne pobieranie adresów DNS (DHCP)!', 'success')
      appendLog('Przywrócono automatyczny serwer DNS (DHCP).')
      await loadNetworkConfig()
      await loadInterfaceDetails(Number(selectedInterfaceIndex))
    } else {
      showToast(res.error || 'Błąd przywracania DHCP.', 'error')
      appendLog('Błąd przywracania DHCP: ' + (res.error || 'anulowano przez użytkownika'))
    }
    setSavingDns(false)
  }

  // Wykonywanie naprawy sieci
  const handleNetworkRepair = async (type: 'flush' | 'winsock') => {
    setRepairing(true)
    if (type === 'flush') {
      appendLog('Czyszczenie pamięci podręcznej systemu DNS (ipconfig /flushdns)...')
      const res = await window.api.runNetworkRepair('flush')
      if (res.success) {
        showToast('Pomyślnie wyczyszczono pamięć DNS!', 'success')
        appendLog(`Wynik Flush DNS:\n${res.output}`)
      } else {
        showToast(res.error || 'Błąd czyszczenia pamięci DNS.', 'error')
        appendLog('Błąd Flush DNS: ' + res.error)
      }
    } else if (type === 'winsock') {
      appendLog('Resetowanie katalogu gniazd sieciowych Winsock (netsh winsock reset)...')
      const res = await window.api.runNetworkRepair('winsock')
      if (res.success) {
        showToast('Reset Winsock wykonany! Zrestartuj komputer.', 'success')
        appendLog(`Wynik Winsock reset:\n${res.output}`)
      } else {
        showToast(res.error || 'Błąd resetowania Winsock.', 'error')
        appendLog('Błąd Winsock reset: ' + res.error)
      }
    }
    setRepairing(false)
  }

  useEffect(() => {
    loadNetworkConfig()
    runPingTest()
    loadWifiDetails()
    loadHardeningAndDoh()
  }, [])

  const getPingBadgeClass = (ping: number): string => {
    if (ping === 0) return 'ping-checking'
    if (ping < 35) return 'ping-fast'
    if (ping < 80) return 'ping-medium'
    return 'ping-slow'
  }

  const getPingLabel = (ping: number): string => {
    if (ping === 0) return 'Mierzenie...'
    if (ping === 999) return 'Brak odp.'
    return `${ping} ms`
  }

  const getSelectedInterfaceDetails = () => {
    return interfaces.find((i) => i.interfaceIndex === Number(selectedInterfaceIndex))
  }

  const selectedDetails = getSelectedInterfaceDetails()

  return (
    <div className="network-container fade-in">
      {/* Header */}
      <header>
        <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}>
          Optymalizator Sieciowy i DNS Booster
        </h1>
        <p className="text-muted" style={{ margin: '4px 0 0 0', fontSize: '14px' }}>
          Zmniejszaj opóźnienia sieciowe oraz błyskawicznie rozwiązuj problemy z łączem internetowym
        </p>
      </header>

      {/* Tabs */}
      <div className="tabs-container mb-lg">
        <button
          className={`tab-btn ${activeTab === 'dns' ? 'active' : ''}`}
          onClick={() => setActiveTab('dns')}
        >
          <Globe size={16} />
          <span>Optymalizacja DNS i Naprawa</span>
        </button>
        <button
          className={`tab-btn ${activeTab === 'speedtest' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('speedtest')
            loadWifiDetails()
          }}
        >
          <Activity size={16} />
          <span>Test Prędkości (Speed Test)</span>
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div className={`status-toast animate-slide-up ${toast.type}`}>
          {toast.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
          <span>{toast.text}</span>
        </div>
      )}

      {activeTab === 'dns' ? (
        <div className="grid-panels">
          {/* Panel A: DNS Booster */}
          <div className="glass-panel main-panel">
            <h2 className="flex items-center gap-sm mb-lg" style={{ fontSize: '18px', margin: 0 }}>
              <Zap size={20} style={{ color: 'var(--color-primary)' }} />
              DNS Booster — Optymalizacja opóźnień
            </h2>

            {/* Karta sieciowa selector */}
            <div className="glass-panel selector-card network-selector-card mb-lg">
              <div className="flex-1">
                <label className="text-xs text-muted font-bold block mb-xs uppercase">
                  Aktywna karta sieciowa
                </label>
                <select
                  className="select-interface"
                  value={selectedInterfaceIndex}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : ''
                    setSelectedInterfaceIndex(val)
                    if (val !== '') {
                      loadInterfaceDetails(val)
                    } else {
                      setDetails(null)
                    }
                  }}
                  disabled={loadingConfig}
                >
                  {interfaces.length === 0 ? (
                    <option value="">Wyszukiwanie kart...</option>
                  ) : (
                    interfaces.map((i) => (
                      <option key={i.interfaceIndex} value={i.interfaceIndex}>
                        {i.interfaceAlias} (ID: {i.interfaceIndex})
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div className="text-right min-w-[180px]">
                <span className="text-xs text-muted block font-bold uppercase mb-xs">
                  Aktualny DNS w systemie
                </span>
                <span className="text-sm font-mono font-bold" style={{ color: '#fff' }}>
                  {selectedDetails && selectedDetails.addresses.length > 0
                    ? selectedDetails.addresses.join(', ')
                    : 'Automatyczny (DHCP)'}
                </span>
              </div>
            </div>

            {/* Lista profili DNS */}
            <div className="dns-list flex flex-col gap-sm">
              <div className="flex justify-between items-center mb-xs">
                <span className="text-xs text-muted font-bold uppercase">Profile serwerów DNS</span>
                <button
                  className="btn btn-secondary btn-xs flex items-center gap-xs"
                  onClick={runPingTest}
                  disabled={pinging}
                >
                  <RefreshCw size={12} className={pinging ? 'spin' : ''} />
                  <span>Testuj pingi</span>
                </button>
              </div>

              {dnsProfiles.map((profile, i) => (
                <div
                  key={i}
                  className="dns-profile-card glass-panel flex items-center justify-between"
                >
                  <div className="flex items-center gap-lg">
                    <div className="icon-wrapper">
                      <Globe size={18} />
                    </div>
                    <div>
                      <h4 style={{ margin: '0 0 2px 0', fontSize: '15px', fontWeight: 700 }}>
                        {profile.name}
                      </h4>
                      <p className="font-mono text-muted text-xs" style={{ margin: 0 }}>
                        {profile.primary} | {profile.secondary}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-lg">
                    <span className={`ping-badge ${getPingBadgeClass(profile.ping)}`}>
                      <Activity size={12} />
                      <span>{getPingLabel(profile.ping)}</span>
                    </span>
                    {isProfileActive(profile) ? (
                      <span
                        className="btn btn-success btn-sm flex items-center gap-xs cursor-default"
                        style={{
                          background: 'rgba(52, 211, 153, 0.1)',
                          color: '#34d399',
                          border: '1px solid rgba(52, 211, 153, 0.2)',
                          padding: '6px 14px',
                          borderRadius: '30px',
                          fontSize: '12px',
                          fontWeight: 'bold'
                        }}
                      >
                        <CheckCircle size={12} />
                        Aktywny
                      </span>
                    ) : (
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleActivateDns(profile)}
                        disabled={savingDns || pinging || selectedInterfaceIndex === ''}
                      >
                        Aktywuj
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {/* Szczegóły techniczne karty */}
              {details && (
                <div className="network-details-card glass-panel mt-md">
                  <h3
                    className="text-xs text-muted font-bold uppercase mb-md"
                    style={{ margin: '0 0 12px 0' }}
                  >
                    Parametry techniczne połączenia
                  </h3>
                  <div className="details-grid">
                    <div className="detail-item">
                      <span className="detail-label">Model karty:</span>
                      <span className="detail-value text-white">
                        {details.description || 'Nieznany'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Prędkość łącza:</span>
                      <span className="detail-value text-primary font-bold">
                        {details.speed || 'Brak danych'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Status:</span>
                      <span
                        className={`detail-value font-bold ${details.status === 'Up' ? 'text-success' : 'text-danger'}`}
                      >
                        {details.status === 'Up' ? 'Połączono (Up)' : 'Rozłączono (Down)'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Adres IPv4:</span>
                      <span className="detail-value font-mono text-white">
                        {details.ip ? `${details.ip}/${details.prefixLength || 24}` : 'Brak IP'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Tryb DHCP:</span>
                      <span className="detail-value text-white">
                        {details.dhcp === 1 ? 'Włączony' : 'Wyłączony (Statyczny)'}
                      </span>
                    </div>
                    <div className="detail-item">
                      <span className="detail-label">Adres MAC:</span>
                      <span
                        className="detail-value font-mono text-muted"
                        style={{ fontSize: '11px' }}
                      >
                        {details.mac || 'Nieznany'}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* DNS-over-HTTPS (DoH) panel */}
              {(() => {
                const currentAdapterDoh = dohStatus.find(i => i.interfaceIndex === Number(selectedInterfaceIndex))
                return (
                  <div className="glass-panel mt-md" style={{ padding: '16px', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '12px', background: 'rgba(255,255,255,0.01)' }}>
                    <div className="flex justify-between items-center mb-sm">
                      <h3 className="flex items-center gap-xs text-xs font-bold uppercase text-white animate-fade-in" style={{ margin: 0 }}>
                        <Globe size={14} className="text-primary" />
                        Szyfrowanie DNS-over-HTTPS (DoH)
                      </h3>
                    </div>
                    
                    {!selectedInterfaceIndex ? (
                      <p className="text-xs text-muted" style={{ margin: 0 }}>Wybierz kartę sieciową, aby skonfigurować szyfrowanie DNS.</p>
                    ) : details && details.dhcp === 1 ? (
                      <div style={{ background: 'rgba(251, 146, 60, 0.05)', border: '1px solid rgba(251, 146, 60, 0.15)', borderRadius: '10px', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <span className="text-[10px] font-bold text-warning uppercase">Wymagany Statyczny DNS</span>
                        <p className="text-[11px] text-muted" style={{ margin: 0, lineHeight: 1.4 }}>
                          Karta sieciowa pobiera DNS automatycznie (DHCP). Włącz jeden z gotowych profili DNS (np. Cloudflare lub Google) powyżej, aby móc aktywować szyfrowane połączenie DoH.
                        </p>
                      </div>
                    ) : currentAdapterDoh && currentAdapterDoh.dns && currentAdapterDoh.dns.length > 0 ? (
                      <div className="flex flex-col gap-sm">
                        <p className="text-[11px] text-muted" style={{ margin: 0, lineHeight: 1.4 }}>
                          Szyfruj zapytania DNS, aby uniemożliwić szpiegowanie odwiedzanych domen (DNS Spoofing) na poziomie sieci lokalnej i ISP.
                        </p>
                        
                        <div className="flex flex-col gap-xs mt-xs">
                          {currentAdapterDoh.dns.map((dnsItem: any, idx: number) => (
                            <div key={idx} className="flex justify-between items-center" style={{ background: 'rgba(255,255,255,0.02)', padding: '8px 12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.03)' }}>
                              <div className="flex flex-col">
                                <span className="text-xs font-bold font-mono text-white">{dnsItem.ip}</span>
                                <span className="text-[10px] text-muted">
                                  {dnsItem.dohActive ? 'Szyfrowanie DoH (HTTPS) Aktywne 🔒' : 'Transmisja Odkryta (UDP/TCP) 🔓'}
                                </span>
                              </div>
                              
                              <button
                                className={`btn btn-xs ${dnsItem.dohActive ? 'btn-danger' : 'btn-primary'}`}
                                onClick={() => handleToggleDoh(currentAdapterDoh.interfaceGuid, currentAdapterDoh.dns.map(d => d.ip), !dnsItem.dohActive)}
                                disabled={togglingDoh}
                                style={{
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontSize: '10px',
                                  fontWeight: 'bold',
                                  cursor: 'pointer'
                                }}
                              >
                                {togglingDoh ? 'Zmienianie...' : dnsItem.dohActive ? 'Wyłącz DoH' : 'Włącz DoH (UAC)'}
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted" style={{ margin: 0 }}>Brak skonfigurowanych serwerów DNS na tym interfejsie.</p>
                    )}
                  </div>
                )
              })()}

              <div className="flex justify-end mt-sm">
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetDns}
                  disabled={savingDns || selectedInterfaceIndex === ''}
                >
                  Przywróć domyślny (DHCP)
                </button>
              </div>
            </div>
          </div>

          {/* Panel B: Naprawa i Konsola */}
          <div className="glass-panel sidebar-panel flex flex-col gap-lg">
            <div>
              <h2
                className="flex items-center gap-sm mb-lg"
                style={{ fontSize: '18px', margin: 0 }}
              >
                <Wifi size={20} style={{ color: 'var(--color-secondary)' }} />
                Narzędzia naprawcze sieci
              </h2>

              <div className="flex flex-col gap-sm">
                <button
                  className="btn btn-secondary flex items-center justify-center gap-xs py-md font-bold"
                  onClick={() => handleNetworkRepair('flush')}
                  disabled={repairing}
                >
                  <span>Wyczyść pamięć podręczną DNS (Flush)</span>
                </button>
                <button
                  className="btn btn-primary flex items-center justify-center gap-xs py-md font-bold"
                  onClick={() => handleNetworkRepair('winsock')}
                  disabled={repairing}
                >
                  <span>Resetuj katalog Winsock (UAC)</span>
                </button>
              </div>
            </div>

            {/* Hardening Sieciowy */}
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px' }}>
              <h2 className="flex items-center gap-sm mb-md" style={{ fontSize: '15px', margin: '0 0 12px 0', color: '#fff', fontWeight: 'bold' }}>
                <Globe size={16} style={{ color: 'var(--color-primary)' }} />
                Zabezpieczenia sieci (Hardening)
              </h2>
              <p className="text-xs text-muted mb-md" style={{ lineHeight: 1.5 }}>
                Wyłącz podatności lokalne i przestarzałe protokoły sieciowe w systemie Windows.
              </p>
              
              <div className="flex flex-col gap-sm">
                {/* LLMNR Toggle */}
                <div className="flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <div className="flex items-center gap-xs">
                      <span className="text-xs font-bold text-white">Blokada LLMNR</span>
                      <span className="dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: hardening.llmnrDisabled ? '#34d399' : '#fb923c' }} />
                    </div>
                    <p className="text-[10px] text-muted" style={{ margin: '2px 0 0 0', lineHeight: 1.4 }}>
                      Blokuje rozgłaszanie nazw lokalnych (Link-Local Multicast Name Resolution) w sieci.
                    </p>
                  </div>
                  <button
                    className={`btn btn-xs ${hardening.llmnrDisabled ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => handleToggleHardening('llmnrDisabled', !hardening.llmnrDisabled)}
                    disabled={loadingHardening}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      minWidth: '85px'
                    }}
                  >
                    {loadingHardening ? '...' : hardening.llmnrDisabled ? 'Wyłącz' : 'Włącz (UAC)'}
                  </button>
                </div>

                {/* NetBIOS Toggle */}
                <div className="flex items-center justify-between" style={{ background: 'rgba(255,255,255,0.02)', padding: '10px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.03)' }}>
                  <div style={{ flex: 1, paddingRight: '8px' }}>
                    <div className="flex items-center gap-xs">
                      <span className="text-xs font-bold text-white">Blokada NetBIOS</span>
                      <span className="dot" style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', backgroundColor: hardening.netbiosDisabled ? '#34d399' : '#fb923c' }} />
                    </div>
                    <p className="text-[10px] text-muted" style={{ margin: '2px 0 0 0', lineHeight: 1.4 }}>
                      Wyłącza NetBIOS over TCP/IP dla kart sieciowych. Zapobiega wyciekom skrótów NTLM.
                    </p>
                  </div>
                  <button
                    className={`btn btn-xs ${hardening.netbiosDisabled ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => handleToggleHardening('netbiosDisabled', !hardening.netbiosDisabled)}
                    disabled={loadingHardening}
                    style={{
                      padding: '4px 10px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      minWidth: '85px'
                    }}
                  >
                    {loadingHardening ? '...' : hardening.netbiosDisabled ? 'Wyłącz' : 'Włącz (UAC)'}
                  </button>
                </div>
              </div>
            </div>

            {/* Konsola Logów */}
            <div className="flex-1 flex flex-col gap-xs min-h-[260px]">
              <span className="text-xs text-muted font-bold uppercase flex items-center gap-xs">
                <Terminal size={14} />
                Konsola logowania
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
      ) : (
        <>
          {/* Zakładka Speed Test: Karta Wi-Fi */}
          {wifiDetails ? (
            <div className="glass-panel wifi-details-card mb-lg flex items-center justify-between">
              <div className="flex items-center gap-lg">
                <div
                  className="wifi-signal-gauge"
                  style={{
                    color:
                      wifiDetails.signal > 75
                        ? '#34d399'
                        : wifiDetails.signal > 40
                          ? '#fbbf24'
                          : '#ef4444'
                  }}
                >
                  <Wifi size={24} />
                  <span className="signal-percent">{wifiDetails.signal}%</span>
                </div>
                <div>
                  <h3 style={{ margin: '0 0 4px 0', fontSize: '16px', fontWeight: 700 }}>
                    Wi-Fi: <span className="text-primary">{wifiDetails.ssid}</span>
                  </h3>
                  <p className="text-xs text-muted" style={{ margin: 0 }}>
                    Standard: {wifiDetails.radio} | Uwierzytelnianie: {wifiDetails.auth}
                  </p>
                </div>
              </div>

              <div className="flex gap-lg">
                <div className="wifi-stat">
                  <span className="text-xs text-muted block uppercase">Pasmo</span>
                  <span className="text-sm font-bold text-white">{wifiDetails.band}</span>
                </div>
                <div className="wifi-stat">
                  <span className="text-xs text-muted block uppercase">Kanał</span>
                  <span className="text-sm font-bold text-white">{wifiDetails.channel}</span>
                </div>
                <div className="wifi-stat">
                  <span className="text-xs text-muted block uppercase">Prędkość Linku</span>
                  <span className="text-sm font-bold text-white">
                    {wifiDetails.txRate} / {wifiDetails.rxRate} Mbps
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div
              className="glass-panel wifi-details-card mb-lg flex items-center gap-md"
              style={{ color: 'var(--color-text-muted)', padding: '16px 20px' }}
            >
              <WifiOff size={20} />
              <span className="text-sm">
                Połączenie przewodowe (Ethernet) lub brak aktywnego Wi-Fi.
              </span>
            </div>
          )}

          {/* Test prędkości sekcja */}
          <div className="grid-panels">
            {/* Prędkościomierz i wykres */}
            <div
              className="glass-panel main-panel flex flex-col items-center justify-between"
              style={{ padding: '30px 24px', gap: '20px' }}
            >
              <h2
                className="flex items-center gap-sm"
                style={{ fontSize: '18px', margin: '0 0 10px 0', width: '100%' }}
              >
                <Activity size={20} style={{ color: 'var(--color-primary)' }} />
                Test prędkości łącza internetowego
              </h2>

              <div className="speedometer-container">
                <svg className="speedometer-svg" viewBox="0 0 200 200">
                  <path className="speedometer-track" d="M 40,160 A 75,75 0 1,1 160,160" />
                  <path
                    className="speedometer-fill"
                    d="M 40,160 A 75,75 0 1,1 160,160"
                    style={{
                      strokeDasharray: '353',
                      strokeDashoffset: `${353 - 353 * (testState === 'download' || testState === 'upload' ? Math.min(currentSpeed, 1000) / 1000 : 0)}`,
                      stroke:
                        testState === 'upload' ? 'var(--color-success)' : 'var(--color-primary)'
                    }}
                  />
                </svg>
                <div className="speedometer-text-overlay">
                  <span className="speedometer-label">
                    {testState === 'ping' && 'Badanie Ping...'}
                    {testState === 'download' && 'Pobieranie'}
                    {testState === 'upload' && 'Wysyłanie'}
                    {testState === 'idle' && 'Gotowy'}
                    {testState === 'done' && 'Ukończono'}
                    {testState === 'error' && 'Błąd'}
                  </span>
                  <span className="speedometer-value">
                    {testState === 'download' || testState === 'upload'
                      ? currentSpeed
                      : testState === 'done'
                        ? speedMetrics.download
                        : '0.0'}
                  </span>
                  <span className="speedometer-unit">Mb/s</span>
                </div>
              </div>

              <div className="speedtest-controls">
                <button
                  className={`btn btn-primary btn-lg speedtest-btn ${testState !== 'idle' && testState !== 'done' && testState !== 'error' ? 'disabled' : ''}`}
                  onClick={runSpeedTest}
                  disabled={testState !== 'idle' && testState !== 'done' && testState !== 'error'}
                >
                  {testState !== 'idle' && testState !== 'done' && testState !== 'error' ? (
                    <div className="flex items-center gap-sm justify-center">
                      <RefreshCw className="spin" size={16} />
                      <span>Mierzenie...</span>
                    </div>
                  ) : (
                    'Rozpocznij Test Prędkości'
                  )}
                </button>
                {testState !== 'idle' && testState !== 'done' && testState !== 'error' && (
                  <div className="progress-bar-container">
                    <div
                      className="progress-bar-fill"
                      style={{
                        width: `${currentPercent}%`,
                        background:
                          testState === 'upload' ? 'var(--color-success)' : 'var(--color-primary)'
                      }}
                    ></div>
                  </div>
                )}
              </div>

              {/* Wykres w czasie rzeczywistym */}
              <div
                className="chart-panel"
                style={{ width: '100%', height: '140px', marginTop: '20px' }}
              >
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="speedGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop
                          offset="5%"
                          stopColor={
                            testState === 'upload' ? 'var(--color-success)' : 'var(--color-primary)'
                          }
                          stopOpacity={0.3}
                        />
                        <stop
                          offset="95%"
                          stopColor={
                            testState === 'upload' ? 'var(--color-success)' : 'var(--color-primary)'
                          }
                          stopOpacity={0}
                        />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" hide />
                    <YAxis hide domain={[0, 'auto']} />
                    <Tooltip
                      contentStyle={{
                        background: '#12141A',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px'
                      }}
                      labelStyle={{ color: '#888' }}
                    />
                    <Area
                      type="monotone"
                      dataKey="speed"
                      stroke={
                        testState === 'upload' ? 'var(--color-success)' : 'var(--color-primary)'
                      }
                      strokeWidth={2}
                      fillOpacity={1}
                      fill="url(#speedGrad)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Wyniki i logi */}
            <div
              className="glass-panel sidebar-panel flex flex-col gap-lg"
              style={{ padding: '24px' }}
            >
              <h2
                className="flex items-center gap-sm mb-lg"
                style={{ fontSize: '18px', margin: 0 }}
              >
                <Monitor size={20} style={{ color: 'var(--color-secondary)' }} />
                Wyniki pomiarów
              </h2>

              <div className="results-list flex flex-col gap-md">
                {/* Ping */}
                <div className="result-metric-card glass-panel flex items-center justify-between">
                  <div className="flex items-center gap-md">
                    <div
                      className="metric-icon-box"
                      style={{ background: 'rgba(52, 211, 153, 0.1)', color: '#34d399' }}
                    >
                      <Activity size={18} />
                    </div>
                    <div>
                      <span className="text-xs text-muted block font-bold uppercase">
                        Ping / Jitter
                      </span>
                      <span className="text-base font-bold text-white">
                        {speedMetrics.ping > 0 ? `${speedMetrics.ping} ms` : '-- ms'}
                        {speedMetrics.jitter > 0 && (
                          <span className="text-xs text-muted font-normal ml-xs">
                            {' '}
                            (Jitter: {speedMetrics.jitter} ms)
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Download */}
                <div className="result-metric-card glass-panel flex items-center justify-between">
                  <div className="flex items-center gap-md">
                    <div
                      className="metric-icon-box"
                      style={{
                        background: 'rgba(69, 243, 255, 0.1)',
                        color: 'var(--color-primary)'
                      }}
                    >
                      <ArrowDown size={18} />
                    </div>
                    <div>
                      <span className="text-xs text-muted block font-bold uppercase">
                        Pobieranie (Download)
                      </span>
                      <span className="text-lg font-bold text-white">
                        {speedMetrics.download > 0 ? `${speedMetrics.download} Mb/s` : '-- Mb/s'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Upload */}
                <div className="result-metric-card glass-panel flex items-center justify-between">
                  <div className="flex items-center gap-md">
                    <div
                      className="metric-icon-box"
                      style={{
                        background: 'rgba(107, 78, 230, 0.1)',
                        color: 'var(--color-secondary)'
                      }}
                    >
                      <ArrowUp size={18} />
                    </div>
                    <div>
                      <span className="text-xs text-muted block font-bold uppercase">
                        Wysyłanie (Upload)
                      </span>
                      <span className="text-lg font-bold text-white">
                        {speedMetrics.upload > 0 ? `${speedMetrics.upload} Mb/s` : '-- Mb/s'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Status testu w konsoli */}
              <div className="flex-1 flex flex-col gap-xs min-h-[180px] mt-lg">
                <span className="text-xs text-muted font-bold uppercase flex items-center gap-xs">
                  <Terminal size={14} />
                  Status testu
                </span>
                <div className="console-wrapper flex-1">
                  <div className="console-inner">
                    {logs.slice(-5).map((log, idx) => (
                      <div key={idx} className="console-line">
                        {log}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      <style>{`
        .network-container {
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

        .tabs-container {
          display: flex;
          gap: 12px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 12px;
        }

        .tab-btn {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 8px 16px;
          background: transparent;
          border: 1px solid transparent;
          color: var(--color-text-muted);
          font-weight: 600;
          font-size: 14px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .tab-btn:hover {
          color: #fff;
          background: rgba(255, 255, 255, 0.02);
        }

        .tab-btn.active {
          color: var(--color-primary);
          background: rgba(69, 243, 255, 0.05);
          border-color: rgba(69, 243, 255, 0.15);
        }

        .grid-panels {
          display: grid;
          grid-template-columns: 1.45fr 1fr;
          gap: 24px;
          align-items: stretch;
        }

        @media (max-width: 950px) {
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

        /* Selektory interfejsów */
        .select-interface {
          width: 100%;
          padding: 8px 12px;
          background: rgba(11, 12, 16, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.08);
          color: #fff;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          outline: none;
          cursor: pointer;
        }

        .select-interface:focus {
          border-color: var(--color-primary);
        }

        /* Profile DNS */
        .dns-profile-card {
          padding: 16px 20px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          transition: all 0.2s ease;
        }

        .dns-profile-card:hover {
          background: rgba(255, 255, 255, 0.03);
          border-color: rgba(255, 255, 255, 0.08);
        }

        .icon-wrapper {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          background: rgba(255, 255, 255, 0.03);
          color: var(--color-text-muted);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        /* Wskaźniki pingu */
        .ping-badge {
          font-size: 11px;
          font-weight: 700;
          padding: 3px 10px;
          border-radius: 20px;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ping-checking {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-muted);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .ping-fast {
          background: rgba(16, 185, 129, 0.1);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.2);
        }

        .ping-medium {
          background: rgba(245, 158, 11, 0.1);
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.2);
        }

        .ping-slow {
          background: rgba(239, 68, 68, 0.1);
          color: #fca5a5;
          border: 1px solid rgba(239, 68, 68, 0.2);
        }

        /* Konsola Logów */
        .console-wrapper {
          background: rgba(0, 0, 0, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 16px;
          overflow-y: auto;
          font-family: 'Courier New', Courier, monospace;
          color: #34d399;
          max-height: 300px;
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

        /* Toasty i Loadery */
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

        /* Techniczne szczegóły połączenia */
        .network-details-card {
          padding: 16px 20px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 16px;
        }

        .details-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px 24px;
        }

        @media (max-width: 600px) {
          .details-grid {
            grid-template-columns: 1fr;
          }
        }

        .detail-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 13px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.02);
          padding-bottom: 6px;
          gap: 12px;
        }

        .detail-label {
          color: var(--color-text-muted);
          font-weight: 500;
        }

        .detail-value {
          text-align: right;
          font-weight: 600;
          word-break: break-all;
        }

        .text-danger {
          color: #ef4444;
        }

        /* Karta Wi-Fi i Speed Test */
        .wifi-details-card {
          padding: 16px 20px;
          border-radius: 18px;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
        }

        .wifi-signal-gauge {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          min-width: 48px;
        }

        .signal-percent {
          font-size: 10px;
          font-weight: 800;
        }

        .wifi-stat {
          display: flex;
          flex-direction: column;
          gap: 4px;
          text-align: right;
        }

        .speedometer-container {
          position: relative;
          width: 100%;
          max-width: 240px;
          aspect-ratio: 1;
          margin: 0 auto;
        }

        /* Responsive network customizations */
        .network-selector-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          gap: 20px;
        }

        @media (max-width: 768px) {
          .network-selector-card {
            flex-direction: column;
            align-items: stretch;
            gap: 16px;
          }
          .network-selector-card .text-right {
            text-align: left !important;
          }
          .wifi-details-card {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .wifi-details-card > .flex:last-child {
            width: 100%;
            justify-content: space-between;
            border-top: 1px solid rgba(255, 255, 255, 0.05);
            padding-top: 12px;
            flex-wrap: wrap;
            gap: 12px;
          }
        }

        @media (max-width: 600px) {
          .dns-profile-card {
            flex-direction: column;
            align-items: stretch;
            gap: 12px;
          }
          .dns-profile-card .flex {
            width: 100%;
            justify-content: space-between;
          }
        }

        .speedometer-svg {
          width: 100%;
          height: 100%;
        }

        .speedometer-track {
          fill: none;
          stroke: rgba(255, 255, 255, 0.04);
          stroke-width: 12;
          stroke-linecap: round;
        }

        .speedometer-fill {
          fill: none;
          stroke-width: 12;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.15s ease-out, stroke 0.3s ease;
        }

        .speedometer-text-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding-top: 15px;
        }

        .speedometer-label {
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: var(--color-text-muted);
          font-weight: 700;
        }

        .speedometer-value {
          font-size: 32px;
          font-weight: 900;
          color: #fff;
          line-height: 1;
          margin: 4px 0;
          font-family: 'Montserrat', sans-serif;
          text-shadow: 0 0 10px rgba(255,255,255,0.1);
        }

        .speedometer-unit {
          font-size: 11px;
          font-weight: 800;
          color: var(--color-primary);
        }

        .speedtest-controls {
          width: 100%;
          max-width: 320px;
          margin: 20px auto 0;
        }

        .speedtest-btn {
          width: 100%;
          padding: 12px 24px;
        }

        .speedtest-btn.disabled {
          background: rgba(255, 255, 255, 0.05);
          color: var(--color-text-muted);
          cursor: not-allowed;
          box-shadow: none;
        }

        .progress-bar-container {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
          overflow: hidden;
          margin-top: 12px;
        }

        .progress-bar-fill {
          height: 100%;
          border-radius: 3px;
          transition: width 0.15s ease-out;
        }

        .result-metric-card {
          padding: 12px 16px;
          border-radius: 16px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
        }

        .metric-icon-box {
          width: 38px;
          height: 38px;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .ml-xs {
          margin-left: 4px;
        }

        .cursor-default {
          cursor: default;
        }
      `}</style>
    </div>
  )
}
