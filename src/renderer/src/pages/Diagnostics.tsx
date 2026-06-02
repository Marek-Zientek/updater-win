import React, { useState, useEffect, useRef } from 'react'
import {
  Wrench,
  Shield,
  Activity,
  Terminal,
  BookOpen,
  RefreshCw,
  Play,
  XCircle,
  CheckCircle,
  AlertTriangle
} from 'lucide-react'

interface BsodLog {
  code: string
  message: string
  time: string
  parameters: string
  driver: string
}

export default function Diagnostics(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<'scan' | 'bsod'>('scan')

  // Stany skanowania SFC/DISM
  const [isScanning, setIsScanning] = useState(false)
  const [scanType, setScanType] = useState<'sfc' | 'dism' | 'audit' | null>(null)
  const [progress, setProgress] = useState(0)
  const [logs, setLogs] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  // Stany analizatora BSOD
  const [bsodLogs, setBsodLogs] = useState<BsodLog[]>([])
  const [loadingBsod, setLoadingBsod] = useState(false)
  const [selectedBsod, setSelectedBsod] = useState<BsodLog | null>(null)
  const [activeKnowledgeId, setActiveKnowledgeId] = useState<number | null>(null)

  const consoleEndRef = useRef<HTMLDivElement>(null)
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null)

  // Baza wiedzy o najpopularniejszych błędach BSOD
  const bsodKnowledge = [
    {
      id: 1,
      code: 'IRQL_NOT_LESS_OR_EQUAL (0x0000000A)',
      description:
        'Występuje, gdy proces jądra systemu próbuje uzyskać dostęp do pamięci stronicowalnej przy zbyt wysokim poziomie IRQL. Oznacza to konflikt dostępu do pamięci.',
      causes:
        'Wadliwe lub niekompatybilne sterowniki sprzętowe (szczególnie graficzne, sieciowe), uszkodzona pamięć RAM, błędy oprogramowania antywirusowego.',
      fixes: [
        'Zaktualizuj sterowniki GPU i karty sieciowej.',
        'Wykonaj test pamięci RAM (np. Windows Memory Diagnostic lub MemTest86).',
        'Odinstaluj ostatnio dodane oprogramowanie lub sterowniki.'
      ]
    },
    {
      id: 2,
      code: 'PAGE_FAULT_IN_NONPAGED_AREA (0x00000050)',
      description:
        'System zażądał danych z adresu pamięci, który nie istnieje lub jest nieprawidłowy. Dotyczy pamięci fizycznej (RAM), L2 cache procesora lub pamięci wideo.',
      causes:
        'Uszkodzona pamięć RAM, błędy sterowników systemowych, uszkodzenie systemu plików na dysku, awaria sprzętowa płyty głównej.',
      fixes: [
        'Uruchom narzędzie sprawdzania dysków: chkdsk C: /f /r.',
        'Sprawdź moduły RAM (wyjmij i przeczyść styki, przetestuj pojedyncze kości).',
        'Wyłącz pamięć podręczną L2/L3 w BIOS (tylko diagnostycznie).'
      ]
    },
    {
      id: 3,
      code: 'SYSTEM_SERVICE_EXCEPTION (0x0000003B)',
      description:
        'Wskazuje, że proces wykonywany w trybie jądra zgłosił wyjątek, którego system nie mógł obsłużyć. Zazwyczaj wiąże się to bezpośrednio ze sterownikami graficznymi.',
      causes:
        'Błędy w sterowniku karty graficznej (np. nvlddmkm.sys, amdkmdap.sys), uszkodzenie plików systemowych Windows, niekompatybilne oprogramowanie overclockingu.',
      fixes: [
        'Zainstaluj stabilną (często starszą/WHQL) wersję sterownika GPU (użyj DDU do czyszczenia).',
        'Uruchom pełną diagnostykę DISM oraz SFC dostępną w zakładce obok.',
        'Cofnij wszelkie profile podkręcania procesora lub pamięci RAM (XMP/EXPO).'
      ]
    },
    {
      id: 4,
      code: 'DPC_WATCHDOG_VIOLATION (0x00000133)',
      description:
        'Oznacza, że mechanizm nadzorujący (Watchdog) wykrył zbyt długie wykonywanie procedury Deferred Procedure Call (DPC), co zawiesiło system.',
      causes:
        'Niekompatybilny lub uszkodzony sterownik dysku SSD (szczególnie kontrolera SATA/NVMe), nieaktualny firmware dysku SSD, konflikty kart Wi-Fi.',
      fixes: [
        'Zaktualizuj sterownik kontrolera pamięci masowej w Menedżerze Urządzeń.',
        'Zaktualizuj oprogramowanie układowe (firmware) swojego dysku SSD za pomocą programu producenta.',
        'Zaktualizuj BIOS/UEFI płyty głównej.'
      ]
    },
    {
      id: 5,
      code: 'CRITICAL_PROCESS_DIED (0x000000EF)',
      description:
        'Krytyczny proces systemowy (np. csrss.exe, wininit.exe lub services.exe) nieoczekiwanie zakończył działanie, zmuszając system do restartu.',
      causes:
        'Głębokie uszkodzenie plików systemowych Windows, złośliwe oprogramowanie modyfikujące pliki jądra, uszkodzenie sektorów dysku twardego.',
      fixes: [
        'Wykonaj skanowanie systemu narzędziem SFC (`sfc /scannow`).',
        'Przeskanuj system programem antywirusowym w poszukiwaniu rootkitów.',
        'Sprawdź stan zdrowia dysku (S.M.A.R.T.) np. w zakładce Sprzęt.'
      ]
    }
  ]

  // Automatyczne sprawdzanie stanu skanowania przy załadowaniu (w razie powrotu do zakładki)
  useEffect(() => {
    checkScanStatus()
    loadBsodLogs()

    return () => {
      stopPolling()
    }
  }, [])

  // Automatyczne przewijanie konsoli w dół po dodaniu logów
  useEffect(() => {
    if (consoleEndRef.current) {
      consoleEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [logs])

  const checkScanStatus = async () => {
    try {
      const status = await window.api.diagnostics.getProgress()
      setIsScanning(status.active)
      setScanType(status.type)
      setProgress(status.progress)
      setLogs(status.logs)

      if (status.active) {
        startPolling()
      }
    } catch (e) {
      console.error('Błąd pobierania stanu diagnostyki:', e)
    }
  }

  const startPolling = () => {
    stopPolling()
    pollingIntervalRef.current = setInterval(async () => {
      try {
        const status = await window.api.diagnostics.getProgress()
        setProgress(status.progress)
        setLogs(status.logs)

        if (!status.active) {
          setIsScanning(false)
          setScanType(null)
          stopPolling()
        }
      } catch (e) {
        console.error('Błąd odpytywania stanu:', e)
      }
    }, 1000)
  }

  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current)
      pollingIntervalRef.current = null
    }
  }

  const startScan = async (type: 'sfc' | 'dism' | 'audit') => {
    setErrorMsg('')
    try {
      const res = await window.api.diagnostics.startScan(type)
      if (res.success) {
        setIsScanning(true)
        setScanType(type)
        setProgress(0)
        setLogs('[System] Rozpoczynanie operacji diagnostycznej...\n')
        startPolling()
      } else {
        setErrorMsg(res.error || 'Nie udało się uruchomić skanowania.')
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Błąd krytyczny komunikacji.')
    }
  }

  const cancelScan = async () => {
    try {
      await window.api.diagnostics.cancelScan()
      setIsScanning(false)
      setScanType(null)
      stopPolling()
      checkScanStatus()
    } catch (e: any) {
      setErrorMsg('Błąd zatrzymywania procesu: ' + e.message)
    }
  }

  const loadBsodLogs = async () => {
    setLoadingBsod(true)
    try {
      const res = await window.api.diagnostics.getBsodLogs()
      if (res.success && Array.isArray(res.data)) {
        setBsodLogs(res.data)
      }
    } catch (e) {
      console.error('Błąd pobierania logów BSOD:', e)
    } finally {
      setLoadingBsod(false)
    }
  }

  return (
    <div className="page-container" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* NAGŁÓWEK */}
      <div style={{ marginBottom: '24px' }}>
        <h1
          className="text-gradient"
          style={{
            fontSize: '26px',
            fontWeight: 800,
            margin: '0 0 4px 0',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <Activity size={28} color="var(--color-primary)" />
          Diagnostyka & Analizator BSOD
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
          Skanuj i naprawiaj pliki jądra Windows oraz analizuj ostatnie niebieskie ekrany śmierci
          (BSOD) na podstawie logów systemowych.
        </p>
      </div>

      {/* ZAKŁADKI (TABS) */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '20px',
          borderBottom: '1px solid rgba(255,255,255,0.05)',
          paddingBottom: '8px'
        }}
      >
        <button
          onClick={() => setActiveTab('scan')}
          className={`tab-btn ${activeTab === 'scan' ? 'active' : ''}`}
          style={{
            background: activeTab === 'scan' ? 'rgba(69, 243, 255, 0.1)' : 'transparent',
            border: 'none',
            color: activeTab === 'scan' ? 'var(--color-primary)' : 'var(--color-text-muted)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <Wrench size={16} />
          Spójność Systemu (SFC/DISM)
        </button>
        <button
          onClick={() => setActiveTab('bsod')}
          className={`tab-btn ${activeTab === 'bsod' ? 'active' : ''}`}
          style={{
            background: activeTab === 'bsod' ? 'rgba(168, 85, 247, 0.1)' : 'transparent',
            border: 'none',
            color: activeTab === 'bsod' ? 'var(--color-secondary)' : 'var(--color-text-muted)',
            padding: '8px 16px',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            transition: 'all 0.2s'
          }}
        >
          <Shield size={16} />
          Analizator Awarii (BSOD)
        </button>
      </div>

      {errorMsg && (
        <div
          className="glass-panel"
          style={{
            padding: '12px 16px',
            borderColor: 'rgba(239,68,68,0.2)',
            background: 'rgba(239,68,68,0.05)',
            color: '#ef4444',
            borderRadius: '12px',
            marginBottom: '20px',
            fontSize: '13px',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}
        >
          <AlertTriangle size={18} />
          {errorMsg}
        </div>
      )}

      {/* --- ZAKŁADKA 1: SPÓJNOŚĆ SYSTEMU --- */}
      {activeTab === 'scan' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '20px' }}>
          {/* LEWA KOLUMNA: OPIS I KONTROLKI */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'white',
                  marginBottom: '12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}
              >
                <Shield size={18} color="var(--color-primary)" />
                Narzędzia Naprawcze Windows
              </h3>
              <p
                style={{
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  lineHeight: '1.5',
                  marginBottom: '16px'
                }}
              >
                System plików Windows może ulec uszkodzeniu przez nagłe braki prądu, awarie dysków
                lub błędy oprogramowania. UpdaterWin udostępnia proste wywołanie natywnych silników
                weryfikacyjnych Microsoftu:
              </p>

              <div
                style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '12px' }}
              >
                <div
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.03)'
                  }}
                >
                  <strong style={{ color: 'white', display: 'block', marginBottom: '4px' }}>
                    SFC (System File Checker)
                  </strong>
                  Skanuje wszystkie chronione pliki systemowe i zastępuje uszkodzone wersje
                  prawidłowymi kopiami z magazynu Windows.
                </div>
                <div
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    padding: '12px',
                    borderRadius: '10px',
                    border: '1px solid rgba(255,255,255,0.03)'
                  }}
                >
                  <strong style={{ color: 'white', display: 'block', marginBottom: '4px' }}>
                    DISM (Deployment Image Servicing)
                  </strong>
                  Weryfikuje i naprawia sam obraz systemu oraz magazyn komponentów (Component Store)
                  przy użyciu usługi Windows Update.
                </div>
              </div>
            </div>

            <div
              className="glass-panel"
              style={{
                padding: '20px',
                borderRadius: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px'
              }}
            >
              <h3
                style={{ fontSize: '15px', fontWeight: 600, color: 'white', marginBottom: '4px' }}
              >
                Wybierz Działanie
              </h3>

              <button
                disabled={isScanning}
                onClick={() => startScan('sfc')}
                className="action-btn"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '10px',
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <Play size={15} color="var(--color-primary)" />
                Skanuj pliki (SFC)
              </button>

              <button
                disabled={isScanning}
                onClick={() => startScan('dism')}
                className="action-btn"
                style={{
                  width: '100%',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.05)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '10px',
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  fontWeight: 600,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s'
                }}
              >
                <Play size={15} color="var(--color-primary)" />
                Napraw obraz (DISM)
              </button>

              <button
                disabled={isScanning}
                onClick={() => startScan('audit')}
                className="action-btn"
                style={{
                  width: '100%',
                  background:
                    'linear-gradient(135deg, rgba(69, 243, 255, 0.15), rgba(168, 85, 247, 0.15))',
                  border: '1px solid rgba(69, 243, 255, 0.25)',
                  color: 'white',
                  padding: '12px',
                  borderRadius: '10px',
                  cursor: isScanning ? 'not-allowed' : 'pointer',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  transition: 'all 0.2s',
                  boxShadow: '0 4px 15px rgba(69, 243, 255, 0.05)'
                }}
              >
                <Wrench size={15} color="var(--color-primary)" />
                Uruchom Pełny Audyt (SFC + DISM)
              </button>

              {isScanning && (
                <button
                  onClick={cancelScan}
                  style={{
                    width: '100%',
                    background: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.25)',
                    color: '#ef4444',
                    padding: '10px',
                    borderRadius: '10px',
                    cursor: 'pointer',
                    fontWeight: 600,
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px',
                    marginTop: '8px'
                  }}
                >
                  <XCircle size={14} />
                  Przerwij operację
                </button>
              )}
            </div>
          </div>

          {/* PRAWA KOLUMNA: WIZUALIZACJA I KONSOLA */}
          <div
            className="glass-panel"
            style={{
              padding: '20px',
              borderRadius: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px'
            }}
          >
            <h3
              style={{
                fontSize: '16px',
                fontWeight: 600,
                color: 'white',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                margin: 0
              }}
            >
              <Terminal size={18} color="var(--color-primary)" />
              Konsola Diagnostyczna
            </h3>

            {/* Pasek postępu */}
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '12px',
                  color: 'var(--color-text-muted)',
                  marginBottom: '6px'
                }}
              >
                <span>
                  Status:{' '}
                  {isScanning
                    ? `Wykonywanie ${scanType?.toUpperCase()}... ⏳`
                    : 'Oczekiwanie na start 🟢'}
                </span>
                <span style={{ fontWeight: 'bold', color: 'white' }}>{Math.round(progress)}%</span>
              </div>
              <div
                style={{
                  height: '8px',
                  background: 'rgba(255,255,255,0.02)',
                  borderRadius: '4px',
                  overflow: 'hidden',
                  border: '1px solid rgba(255,255,255,0.04)'
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${progress}%`,
                    background:
                      'linear-gradient(90deg, var(--color-primary), var(--color-secondary))',
                    borderRadius: '4px',
                    transition: 'width 0.4s ease-out',
                    boxShadow: '0 0 8px var(--color-primary-glow)'
                  }}
                />
              </div>
            </div>

            {/* Terminal tekstowy */}
            <div
              style={{
                flex: 1,
                background: 'rgba(0, 0, 0, 0.45)',
                border: '1px solid rgba(255, 255, 255, 0.05)',
                borderRadius: '12px',
                padding: '16px',
                minHeight: '280px',
                maxHeight: '340px',
                overflowY: 'auto',
                fontFamily: 'Consolas, Courier New, monospace',
                fontSize: '11px',
                color: '#10b981',
                lineHeight: '1.6',
                whiteSpace: 'pre-wrap'
              }}
            >
              {logs
                ? logs
                : '[System] Brak aktywnych logów diagnostycznych. Uruchom skanowanie sfc/dism, aby rozpocząć rejestrację.'}
              <div ref={consoleEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* --- ZAKŁADKA 2: ANALIZATOR BSOD --- */}
      {activeTab === 'bsod' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          {/* LEWA KOLUMNA: LISTA WYKRYTYCH AWARII */}
          <div
            className="glass-panel"
            style={{ padding: '20px', borderRadius: '16px', minHeight: '400px' }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px'
              }}
            >
              <h3
                style={{
                  fontSize: '16px',
                  fontWeight: 600,
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  margin: 0
                }}
              >
                <Shield size={18} color="var(--color-secondary)" />
                Historia Awarii Systemowych (Event ID 1001)
              </h3>
              <button
                disabled={loadingBsod}
                onClick={loadBsodLogs}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: 'var(--color-primary)',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontSize: '12px'
                }}
              >
                <RefreshCw size={12} className={loadingBsod ? 'animate-spin' : ''} />
                Odśwież
              </button>
            </div>

            {loadingBsod ? (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '200px',
                  fontSize: '13px',
                  color: 'var(--color-text-muted)'
                }}
              >
                Skanowanie dziennika zdarzeń...
              </div>
            ) : bsodLogs.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {bsodLogs.map((log, index) => (
                  <div
                    key={index}
                    onClick={() => setSelectedBsod(log)}
                    style={{
                      background:
                        selectedBsod === log
                          ? 'rgba(168, 85, 247, 0.08)'
                          : 'rgba(255,255,255,0.02)',
                      border: `1px solid ${selectedBsod === log ? 'rgba(168, 85, 247, 0.3)' : 'rgba(255,255,255,0.04)'}`,
                      borderRadius: '12px',
                      padding: '14px',
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ fontWeight: 'bold', color: 'white', fontSize: '13px' }}>
                        {log.code || 'Błąd krytyczny'}
                      </span>
                      <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>
                        {log.time}
                      </span>
                    </div>
                    {log.driver && (
                      <div style={{ fontSize: '11px', color: 'var(--color-primary)' }}>
                        Wadliwy moduł: <strong>{log.driver}</strong>
                      </div>
                    )}
                    <p
                      style={{
                        fontSize: '11px',
                        color: 'var(--color-text-muted)',
                        margin: 0,
                        textOverflow: 'ellipsis',
                        overflow: 'hidden',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {log.message}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px 20px' }}>
                <CheckCircle size={48} color="#10b981" style={{ marginBottom: '12px' }} />
                <h4 style={{ color: 'white', margin: '0 0 6px 0', fontSize: '15px' }}>
                  Brak zdarzeń BSOD 🟢
                </h4>
                <p
                  style={{
                    color: 'var(--color-text-muted)',
                    fontSize: '12px',
                    margin: '0 auto',
                    maxWidth: '300px',
                    lineHeight: '1.5'
                  }}
                >
                  W dzienniku zdarzeń systemu Windows nie znaleziono ostatnich zrzutów pamięci ani
                  raportów o błędach BugCheck. Twój system działa stabilnie!
                </p>
              </div>
            )}
          </div>

          {/* PRAWA KOLUMNA: SZCZEGÓŁY WYBRANEJ AWARII LUB BAZA WIEDZY */}
          <div>
            {selectedBsod ? (
              <div
                className="glass-panel"
                style={{
                  padding: '20px',
                  borderRadius: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                <div
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                >
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'white', margin: 0 }}>
                    Szczegóły Awarii
                  </h3>
                  <button
                    onClick={() => setSelectedBsod(null)}
                    style={{
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--color-text-muted)',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    Zamknij
                  </button>
                </div>

                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px',
                    fontSize: '12px'
                  }}
                >
                  <div>
                    <span
                      style={{
                        color: 'var(--color-text-muted)',
                        display: 'block',
                        marginBottom: '2px'
                      }}
                    >
                      Kod BugCheck:
                    </span>
                    <strong style={{ color: '#ef4444', fontSize: '14px' }}>
                      {selectedBsod.code}
                    </strong>
                  </div>

                  <div>
                    <span
                      style={{
                        color: 'var(--color-text-muted)',
                        display: 'block',
                        marginBottom: '2px'
                      }}
                    >
                      Czas zdarzenia:
                    </span>
                    <span style={{ color: 'white' }}>{selectedBsod.time}</span>
                  </div>

                  {selectedBsod.driver && (
                    <div>
                      <span
                        style={{
                          color: 'var(--color-text-muted)',
                          display: 'block',
                          marginBottom: '2px'
                        }}
                      >
                        Prawdopodobny sterownik sprawczy:
                      </span>
                      <strong style={{ color: 'var(--color-primary)' }}>
                        {selectedBsod.driver}
                      </strong>
                    </div>
                  )}

                  {selectedBsod.parameters && (
                    <div>
                      <span
                        style={{
                          color: 'var(--color-text-muted)',
                          display: 'block',
                          marginBottom: '2px'
                        }}
                      >
                        Parametry BugCheck:
                      </span>
                      <span style={{ fontFamily: 'monospace', color: 'white' }}>
                        ({selectedBsod.parameters})
                      </span>
                    </div>
                  )}

                  <div>
                    <span
                      style={{
                        color: 'var(--color-text-muted)',
                        display: 'block',
                        marginBottom: '4px'
                      }}
                    >
                      Pełny raport WER:
                    </span>
                    <div
                      style={{
                        background: 'rgba(0,0,0,0.3)',
                        padding: '10px',
                        borderRadius: '8px',
                        maxHeight: '120px',
                        overflowY: 'auto',
                        fontSize: '10px',
                        fontFamily: 'monospace',
                        color: 'var(--color-text-muted)',
                        whiteSpace: 'pre-wrap',
                        lineHeight: '1.4'
                      }}
                    >
                      {selectedBsod.message}
                    </div>
                  </div>
                </div>

                {/* ZALECENIA NAPRAWCZE */}
                <div style={{ borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '16px' }}>
                  <h4
                    style={{
                      color: 'white',
                      fontSize: '13px',
                      margin: '0 0 10px 0',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <Wrench size={14} color="var(--color-secondary)" />
                    Sugerowane kroki naprawcze:
                  </h4>
                  <ul
                    style={{
                      margin: 0,
                      paddingLeft: '16px',
                      fontSize: '11px',
                      color: 'var(--color-text-muted)',
                      lineHeight: '1.6',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '6px'
                    }}
                  >
                    <li>
                      Zweryfikuj poprawność instalacji sterownika{' '}
                      <strong style={{ color: 'white' }}>
                        {selectedBsod.driver || 'systemowego'}
                      </strong>
                      . Spróbuj go przeinstalować w Menedżerze Urządzeń lub pobierz najnowszą wersję
                      od producenta.
                    </li>
                    <li>
                      Uruchom Skanowanie plików systemowych (SFC) w zakładce obok, aby sprawdzić czy
                      system plików nie uległ uszkodzeniu.
                    </li>
                    <li>
                      W przypadku powtarzających się awarii przetestuj stabilność pamięci RAM za
                      pomocą wbudowanego testu Windows Memory Diagnostic.
                    </li>
                  </ul>
                </div>
              </div>
            ) : (
              // BAZA WIEDZY (FALLBACK/EDUCATION)
              <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
                <h3
                  style={{
                    fontSize: '15px',
                    fontWeight: 600,
                    color: 'white',
                    marginBottom: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <BookOpen size={16} color="var(--color-secondary)" />
                  Baza Wiedzy o BSOD
                </h3>
                <p
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    lineHeight: '1.5',
                    marginBottom: '16px'
                  }}
                >
                  Niebieski ekran (BSOD) to ekran błędu jądra systemu operacyjnego. Poniżej
                  zebraliśmy najpopularniejsze kody zatrzymania (Stop Codes) z instrukcjami ich
                  eliminacji:
                </p>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {bsodKnowledge.map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: 'rgba(255,255,255,0.02)',
                        border: '1px solid rgba(255,255,255,0.03)',
                        borderRadius: '10px',
                        overflow: 'hidden'
                      }}
                    >
                      <button
                        onClick={() =>
                          setActiveKnowledgeId(activeKnowledgeId === item.id ? null : item.id)
                        }
                        style={{
                          width: '100%',
                          background: 'transparent',
                          border: 'none',
                          color: activeKnowledgeId === item.id ? 'var(--color-secondary)' : 'white',
                          padding: '12px',
                          textAlign: 'left',
                          fontSize: '12px',
                          fontWeight: 600,
                          cursor: 'pointer',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center'
                        }}
                      >
                        <span>{item.code}</span>
                        <span>{activeKnowledgeId === item.id ? '▲' : '▼'}</span>
                      </button>

                      {activeKnowledgeId === item.id && (
                        <div
                          style={{
                            padding: '0 12px 12px 12px',
                            fontSize: '11px',
                            color: 'var(--color-text-muted)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '8px',
                            borderTop: '1px solid rgba(255,255,255,0.02)',
                            paddingTop: '8px'
                          }}
                        >
                          <p style={{ margin: 0, lineHeight: '1.4' }}>{item.description}</p>
                          <div>
                            <strong
                              style={{ color: 'white', display: 'block', marginBottom: '2px' }}
                            >
                              Główne przyczyny:
                            </strong>
                            {item.causes}
                          </div>
                          <div>
                            <strong
                              style={{ color: 'white', display: 'block', marginBottom: '4px' }}
                            >
                              Rozwiązanie:
                            </strong>
                            <ul
                              style={{
                                margin: 0,
                                paddingLeft: '14px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '3px'
                              }}
                            >
                              {item.fixes.map((fix, idx) => (
                                <li key={idx}>{fix}</li>
                              ))}
                            </ul>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
