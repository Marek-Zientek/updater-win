import React, { useState, useEffect, useRef } from 'react'
import {
  Zap,
  Activity,
  Layers,
  RefreshCw,
  Info,
  CheckCircle,
  AlertTriangle,
  Play
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip } from 'recharts'

interface RamStats {
  total: number
  free: number
  standby: number
  used: number
}

interface HardwareModule {
  size: number
  bank: string
  type: string
  clockSpeed: number
  manufacturer: string
  partNum: string
}

export default function RamCleaner(): React.ReactElement {
  const [stats, setStats] = useState<RamStats>({ total: 16 * 1024 * 1024 * 1024, free: 8 * 1024 * 1024 * 1024, standby: 2 * 1024 * 1024 * 1024, used: 6 * 1024 * 1024 * 1024 })
  const [loading, setLoading] = useState(true)
  const [cleaning, setCleaning] = useState(false)
  const [cleanResult, setCleanResult] = useState<{ success: boolean; message?: string } | null>(null)
  const [history, setHistory] = useState<any[]>([])
  const [staticHardware, setStaticHardware] = useState<any>(null)
  const [cleanType, setCleanType] = useState<'standby' | 'workingsets' | 'both'>('both')

  const intervalRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    fetchHardwareInfo()
    fetchStats()
    
    intervalRef.current = setInterval(fetchStats, 2000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  const fetchHardwareInfo = async () => {
    try {
      const res = await window.api.getStaticHardware()
      if (res.success && res.data) {
        setStaticHardware(res.data.memory)
      }
    } catch (e) {
      console.error('Failed to load static hardware info:', e)
    }
  }

  const fetchStats = async () => {
    try {
      const data = await window.api.ram.getRamStats()
      setStats(data)
      setLoading(false)

      const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
      setHistory((prev) => [
        ...prev.slice(-29),
        {
          time: timestamp,
          Używana: parseFloat((data.used / (1024 * 1024 * 1024)).toFixed(2)),
          Oczekująca: parseFloat((data.standby / (1024 * 1024 * 1024)).toFixed(2)),
          Wolna: parseFloat((data.free / (1024 * 1024 * 1024)).toFixed(2))
        }
      ])
    } catch (e) {
      console.error('Failed to fetch RAM stats:', e)
    }
  }

  const handleClean = async () => {
    if (cleaning) return
    setCleaning(true)
    setCleanResult(null)

    try {
      const res = await window.api.ram.cleanRam(cleanType)
      if (res.success) {
        setCleanResult({ success: true, message: 'Pamięć została pomyślnie zoptymalizowana!' })
        // Natychmiastowe odświeżenie statystyk
        await fetchStats()
      } else {
        setCleanResult({ success: false, message: res.error || 'Nie udało się zwolnić pamięci.' })
      }
    } catch (e: any) {
      setCleanResult({ success: false, message: e.message || 'Wystąpił błąd krytyczny komunikacji.' })
    } finally {
      setCleaning(false)
      // Schowaj komunikat o wyniku po 5 sekundach
      setTimeout(() => {
        setCleanResult(null)
      }, 5000)
    }
  }

  const toGB = (bytes: number) => (bytes / (1024 * 1024 * 1024)).toFixed(2)

  const usedPct = ((stats.used / stats.total) * 100).toFixed(0)
  const standbyPct = ((stats.standby / stats.total) * 100).toFixed(0)
  const freePct = ((stats.free / stats.total) * 100).toFixed(0)

  return (
    <div className="page-container" style={{ padding: '24px', height: '100%', overflowY: 'auto' }}>
      {/* NAGŁÓWEK */}
      <div style={{ marginBottom: '24px' }}>
        <h1 className="text-gradient" style={{ fontSize: '26px', fontWeight: 800, margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Layers size={28} color="var(--color-primary)" />
          Optymalizacja Pamięci RAM
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '13px', margin: 0 }}>
          Oczyszczaj listę oczekującą (Standby Memory Cache) oraz obszary robocze procesów, aby zapobiec mikroprzycięciom w grach i aplikacjach.
        </p>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '300px', color: 'var(--color-text-muted)', fontSize: '13px' }}>
          <RefreshCw size={20} className="animate-spin" style={{ marginRight: '8px' }} />
          Pobieranie alokacji pamięci RAM...
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '20px' }}>
          {/* LEWA KOLUMNA: PODZIAŁ I WYKRES */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* PANEL DANYCH REALTIME */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'white', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--color-primary)" />
                Bieżący podział pamięci RAM ({toGB(stats.total)} GB ogółem)
              </h3>

              {/* PASKI PROCENTOWE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* UŻYWANA */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'white', fontWeight: 500 }}>Aktywna (Używana)</span>
                    <span style={{ color: 'var(--color-primary)' }}>{toGB(stats.used)} GB ({usedPct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${usedPct}%`, background: 'var(--color-primary)', boxShadow: '0 0 8px var(--color-primary-glow)', borderRadius: '4px' }} />
                  </div>
                </div>

                {/* CACHE / STANDBY */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'white', fontWeight: 500 }}>Lista oczekująca (Standby Cache)</span>
                    <span style={{ color: 'var(--color-secondary)' }}>{toGB(stats.standby)} GB ({standbyPct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${standbyPct}%`, background: 'var(--color-secondary)', boxShadow: '0 0 8px var(--color-secondary-glow)', borderRadius: '4px' }} />
                  </div>
                </div>

                {/* WOLNA */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '6px' }}>
                    <span style={{ color: 'white', fontWeight: 500 }}>Całkowicie wolna (Free)</span>
                    <span style={{ color: '#10b981' }}>{toGB(stats.free)} GB ({freePct}%)</span>
                  </div>
                  <div style={{ height: '8px', background: 'rgba(255,255,255,0.02)', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${freePct}%`, background: '#10b981', boxShadow: '0 0 8px rgba(16,185,129,0.2)', borderRadius: '4px' }} />
                  </div>
                </div>
              </div>
            </div>

            {/* WYKRES ALOKACJI W CZASIE */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Activity size={18} color="var(--color-primary)" />
                Monitor alokacji w czasie rzeczywistym (GB)
              </h3>
              <div style={{ height: '220px', width: '100%' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={history} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                    <XAxis dataKey="time" tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }} />
                    <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 9 }} />
                    <Tooltip contentStyle={{ background: 'rgba(20,20,25,0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px', fontSize: '11px', color: 'white' }} />
                    <Area type="monotone" dataKey="Używana" stroke="var(--color-primary)" fill="url(#primaryGlow)" strokeWidth={2} stackId="1" />
                    <Area type="monotone" dataKey="Oczekująca" stroke="var(--color-secondary)" fill="url(#secondaryGlow)" strokeWidth={2} stackId="2" />
                    <defs>
                      <linearGradient id="primaryGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="secondaryGlow" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-secondary)" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="var(--color-secondary)" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* PRAWA KOLUMNA: AKCJE I STATYSTYKI SPRZĘTOWE */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {/* AKCJE OPTYMALIZACJI */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Zap size={18} color="var(--color-primary)" />
                Zwolnij Pamięć RAM
              </h3>
              
              <p style={{ fontSize: '12px', color: 'var(--color-text-muted)', lineHeight: '1.5', margin: 0 }}>
                Wybierz typ optymalizacji, a następnie kliknij przycisk poniżej. System wymusi monit UAC (uprawnienia administratora), aby wywołać natywne API jądra Windows.
              </p>

              {/* WYBÓR TYPU */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '12px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'white', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <input
                    type="radio"
                    name="cleanType"
                    checked={cleanType === 'standby'}
                    onChange={() => setCleanType('standby')}
                  />
                  <div>
                    <strong style={{ display: 'block' }}>Zwolnij Listę Oczekującą (Standby Cache)</strong>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Bezpieczne oczyszczenie buforów i cache systemowego.</span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'white', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <input
                    type="radio"
                    name="cleanType"
                    checked={cleanType === 'workingsets'}
                    onChange={() => setCleanType('workingsets')}
                  />
                  <div>
                    <strong style={{ display: 'block' }}>Wyczyść Zestawy Robocze (Working Sets)</strong>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Wymusza na procesach tła zrzucenie nieużywanych danych do pliku stronicowania.</span>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', color: 'white', background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <input
                    type="radio"
                    name="cleanType"
                    checked={cleanType === 'both'}
                    onChange={() => setCleanType('both')}
                  />
                  <div>
                    <strong style={{ display: 'block' }}>Pełna Optymalizacja (Zalecane)</strong>
                    <span style={{ fontSize: '10px', color: 'var(--color-text-muted)' }}>Wykonywane są obie powyższe procedury naraz w celu maksymalnego odzyskania RAM.</span>
                  </div>
                </label>
              </div>

              {cleanResult && (
                <div style={{
                  padding: '10px 14px',
                  borderRadius: '10px',
                  fontSize: '12px',
                  background: cleanResult.success ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)',
                  border: `1px solid ${cleanResult.success ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  color: cleanResult.success ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px'
                }}>
                  {cleanResult.success ? <CheckCircle size={16} /> : <AlertTriangle size={16} />}
                  {cleanResult.message}
                </div>
              )}

              <button
                disabled={cleaning}
                onClick={handleClean}
                style={{
                  width: '100%',
                  background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))',
                  border: 'none',
                  color: 'white',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 700,
                  fontSize: '13px',
                  cursor: cleaning ? 'not-allowed' : 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  boxShadow: '0 4px 15px var(--color-primary-glow)',
                  transition: 'all 0.2s'
                }}
              >
                {cleaning ? (
                  <>
                    <RefreshCw size={16} className="animate-spin" />
                    Optymalizowanie...
                  </>
                ) : (
                  <>
                    <Play size={15} fill="white" />
                    Wykonaj Optymalizację RAM
                  </>
                )}
              </button>
            </div>

            {/* DETALE SPRZĘTOWE KOŚCI RAM */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <h3 style={{ fontSize: '15px', fontWeight: 600, color: 'white', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Info size={18} color="var(--color-secondary)" />
                Specyfikacja Fizyczna RAM
              </h3>

              {staticHardware && Array.isArray(staticHardware.layout) && staticHardware.layout.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {staticHardware.layout.map((module: HardwareModule, idx: number) => (
                    <div key={idx} style={{ background: 'rgba(255,255,255,0.01)', border: '1px solid rgba(255,255,255,0.03)', borderRadius: '10px', padding: '12px', fontSize: '11px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 16px' }}>
                      <div style={{ gridColumn: 'span 2', fontWeight: 700, color: 'white', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '4px', marginBottom: '2px' }}>
                        Moduł #{idx + 1} ({module.bank || `Slot ${idx}`})
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Rozmiar:</span>
                        <strong style={{ color: 'white' }}>{(module.size / (1024 * 1024 * 1024)).toFixed(0)} GB</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Typ:</span>
                        <strong style={{ color: 'white' }}>{module.type || 'DDR4'}</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Taktowanie:</span>
                        <strong style={{ color: 'white' }}>{module.clockSpeed || 'Nieznane'} MHz</strong>
                      </div>
                      <div>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Producent:</span>
                        <strong style={{ color: 'white' }}>{module.manufacturer || 'Nieznany'}</strong>
                      </div>
                      <div style={{ gridColumn: 'span 2' }}>
                        <span style={{ color: 'var(--color-text-muted)', display: 'block' }}>Kod fabryczny:</span>
                        <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>{module.partNum || 'Brak danych'}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', textAlign: 'center', padding: '20px' }}>
                  Brak fizycznych informacji o układach pamięci w bazie offline.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
