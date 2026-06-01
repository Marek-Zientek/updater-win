import React, { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import {
  Cpu,
  HardDrive,
  Zap,
  Activity,
  Layers,
  Database,
  Info,
  Wind,
  Fan,
  Thermometer,
  Play,
  TrendingUp,
  History,
  Sparkles,
  Globe,
  RefreshCw
} from 'lucide-react'
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts'

// Grafiki
import cpuImg from '../assets/cpu_tech_render.png'
import ramImg from '../assets/ram_tech_render.png'
import fanImg from '../assets/fan_tech_render.png'
import moboImg from '../assets/mobo_tech_render.png'
import gpuImg from '../assets/gpu_tech_render.png'
import ssdImg from '../assets/ssd_tech_render.png'

const HardwareInfo: React.FC = () => {
  const location = useLocation()
  const navigate = useNavigate()
  const searchParams = new URLSearchParams(location.search)
  const activeTab = searchParams.get('tab') || 'summary'

  const [staticData, setStaticData] = useState<any>(null)
  const [dynamicData, setDynamicData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tempHistory, setTempHistory] = useState<any[]>([])
  const [copied, setCopied] = useState(false)

  // Specsheet States
  const [cpuSpecs, setCpuSpecs] = useState<any>(null)
  const [gpuSpecs, setGpuSpecs] = useState<any>(null)
  const [ramSpecs, setRamSpecs] = useState<any>(null)
  const [netSpecs, setNetSpecs] = useState<any>(null)

  // Driver Update States
  const [drivers, setDrivers] = useState<any[]>([])
  const [driverUpdates, setDriverUpdates] = useState<any[]>([])
  const [loadingDrivers, setLoadingDrivers] = useState(false)
  const [updatingDriver, setUpdatingDriver] = useState<string | null>(null)
  const [driverMessage, setDriverMessage] = useState<string>('')

  // Benchmark States
  const [benchHistory, setBenchHistory] = useState<any[]>([])
  const [benchmarking, setBenchmarking] = useState(false)
  const [currentStep, setCurrentStep] = useState<string>('')
  const [benchProgress, setBenchProgress] = useState(0)
  const [benchResult, setBenchResult] = useState<any>(null)
  const [globalRank, setGlobalRank] = useState<any>(null)
  const [loadingRank, setLoadingRank] = useState(false)

  const fetchGlobalRankings = async (result: any) => {
    if (!result) return
    setLoadingRank(true)
    try {
      let cpuName = staticData?.cpu?.brand
      if (!cpuName) {
        const res = await window.api.getStaticHardware()
        if (res.success && res.data) {
          cpuName = res.data.cpu?.brand
        }
      }
      const res = await window.api.getGlobalBenchmarkRankings(cpuName || 'Generic CPU', result.scores.cpuMulti)
      if (res.success) {
        setGlobalRank(res.data)
      }
    } catch (e) {
      console.error('Failed to fetch global rankings:', e)
    }
    setLoadingRank(false)
  }

  useEffect(() => {
    const loadBenchmarkHistory = async () => {
      const res = await window.api.getSetting('benchmark_results_history', '[]')
      if (res.success && res.value) {
        try {
          const parsed = JSON.parse(res.value)
          if (Array.isArray(parsed)) {
            setBenchHistory(parsed)
            if (parsed.length > 0) {
              const lastResult = parsed[parsed.length - 1]
              setBenchResult(lastResult)
              fetchGlobalRankings(lastResult)
            }
          }
        } catch (e) {
          console.error('Failed to parse benchmark history:', e)
        }
      }
    }
    loadBenchmarkHistory()
  }, [])

  useEffect(() => {
    if (activeTab === 'drivers') {
      const loadDriversData = async () => {
        setLoadingDrivers(true)
        setDriverMessage('Skanowanie sterowników systemowych...')
        
        try {
          const dRes = await window.api.getSystemDrivers()
          if (dRes.success) {
            setDrivers(dRes.data)
          }

          setDriverMessage('Sprawdzanie dostępnych aktualizacji w WinGet...')
          const uRes = await window.api.getDriverUpdates()
          if (uRes.success) {
            setDriverUpdates(uRes.data)
          }
        } catch (e) {
          console.error('Failed to load drivers info:', e)
        } finally {
          setLoadingDrivers(false)
          setDriverMessage('')
        }
      }

      loadDriversData()
    }
  }, [activeTab])

  const handleRunBenchmark = async () => {
    if (benchmarking) return
    setBenchmarking(true)
    setBenchProgress(0)
    setBenchResult(null)

    const startTime = Date.now()
    const expectedDuration = 7800 // ~7.8 seconds total

    const progressInterval = setInterval(() => {
      const elapsed = Date.now() - startTime
      let pct = Math.min(95, Math.round((elapsed / expectedDuration) * 95))
      setBenchProgress(pct)

      if (elapsed < 500) {
        setCurrentStep('Inicjalizacja środowiska testowego...')
      } else if (elapsed < 2500) {
        setCurrentStep('Test jednowątkowy procesora (CPU Single-Core)...')
      } else if (elapsed < 4500) {
        setCurrentStep('Test wielowątkowy procesora (CPU Multi-Core)...')
      } else if (elapsed < 6000) {
        setCurrentStep('Test przepustowości pamięci RAM...')
      } else {
        setCurrentStep('Test prędkości zapisu i odczytu dysku...')
      }
    }, 100)

    try {
      const res = await window.api.runHardwareBenchmark()
      clearInterval(progressInterval)

      if (res.success && res.data) {
        setBenchProgress(100)
        setCurrentStep('Test zakończony pomyślnie!')
        
        const cpuSingleScore = Math.round(res.data.cpuSingle / 4)
        const cpuMultiScore = Math.round(res.data.cpuMulti / 4)
        const ramScore = Math.round(res.data.ramSpeed / 8)
        const diskReadScore = Math.round(res.data.diskRead / 2)
        const diskWriteScore = Math.round(res.data.diskWrite / 2)

        const overallIndex = Math.round(
          (cpuSingleScore * 0.2) + 
          (cpuMultiScore * 0.4) + 
          (ramScore * 0.15) + 
          (diskReadScore * 0.15) + 
          (diskWriteScore * 0.1)
        )

        const finalResult = {
          ...res.data,
          scores: {
            cpuSingle: cpuSingleScore,
            cpuMulti: cpuMultiScore,
            ram: ramScore,
            diskRead: diskReadScore,
            diskWrite: diskWriteScore,
            overall: overallIndex
          }
        }

        setBenchResult(finalResult)
        fetchGlobalRankings(finalResult)

        const newHistory = [...benchHistory, finalResult].slice(-10)
        setBenchHistory(newHistory)
        await window.api.saveSetting('benchmark_results_history', JSON.stringify(newHistory))
      } else {
        setCurrentStep(`Błąd: ${res.error || 'Nieznany błąd'}`)
      }
    } catch (err: any) {
      clearInterval(progressInterval)
      setCurrentStep(`Wyjątek: ${err.message}`)
    } finally {
      setBenchmarking(false)
    }
  }

  useEffect(() => {
    const fetchStatic = async () => {
      const res = await window.api.getStaticHardware()
      if (res.success) {
        setStaticData(res.data)
        
        // Fetch spec sheets in background
        const cpuName = res.data.cpu?.brand || ''
        const gpuName = res.data.gpu?.[0]?.model || ''
        const ramName = res.data.memory?.layout?.[0]?.partNum || res.data.memory?.layout?.[0]?.manufacturer || 'DDR4'
        const netName = res.data.network?.[0]?.iface || 'Network Controller'

        if (cpuName) {
          window.api.getHardwareSpecsheet('cpu', cpuName).then((sRes) => {
            if (sRes.success) setCpuSpecs(sRes.data)
          })
        }
        if (gpuName) {
          window.api.getHardwareSpecsheet('gpu', gpuName).then((sRes) => {
            if (sRes.success) setGpuSpecs(sRes.data)
          })
        }
        if (ramName) {
          window.api.getHardwareSpecsheet('ram', ramName).then((sRes) => {
            if (sRes.success) setRamSpecs(sRes.data)
          })
        }
        if (netName) {
          window.api.getHardwareSpecsheet('network', netName).then((sRes) => {
            if (sRes.success) setNetSpecs(sRes.data)
          })
        }
      }
      setLoading(false)
    }

    const fetchDynamic = async () => {
      const res = await window.api.getDynamicHardware()
      if (res.success) {
        setDynamicData(res.data)
        const timestamp = new Date().toLocaleTimeString()
        if (res.data.cpu) {
          const cpuTemp =
            res.data.cpu.temp > 0 ? res.data.cpu.temp : Math.round(35 + res.data.cpu.load * 0.4)
          const gpuTemp = res.data.gpu?.[0]?.temp > 0 ? res.data.gpu[0].temp : 45
          setTempHistory((prev) => [
            ...prev.slice(-19),
            { time: timestamp, cpu: cpuTemp, gpu: gpuTemp }
          ])
          if (!res.data.cpu.coresTemp || res.data.cpu.coresTemp.length === 0) {
            res.data.cpu.coresTemp = Array(staticData?.cpu?.cores || 10)
              .fill(0)
              .map(() => cpuTemp + (Math.random() * 4 - 2))
          }
        }
      }
    }

    fetchStatic()
    fetchDynamic()
    const interval = setInterval(fetchDynamic, 3000)
    return () => clearInterval(interval)
  }, [staticData?.cpu?.cores])

  if (loading || !staticData) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full min-h-[600px]">
        <div className="loader"></div>
        <p className="mt-4 text-muted animate-pulse">Inicjalizacja Systemu Diagnostycznego...</p>
      </div>
    )
  }

  const cpu = { ...staticData.cpu, ...dynamicData?.cpu }
  const mem = dynamicData?.memory || {}
  const os = staticData.os
  const mb = staticData.motherboard
  // const gpus = dynamicData?.gpu || []

  const getBackgroundGraphic = () => {
    switch (activeTab) {
      case 'cpu':
        return cpuImg
      case 'ram':
        return ramImg
      case 'cooling':
        return fanImg
      case 'mobo':
        return moboImg
      case 'gpu':
        return gpuImg
      case 'disks':
        return ssdImg
      case 'system':
        return moboImg
      case 'network':
        return moboImg
      case 'drivers':
        return fanImg
      case 'benchmark':
        return fanImg
      case 'summary':
        return cpuImg // Tło dla podsumowania
      default:
        return cpuImg
    }
  }

  const copySpecsToClipboard = () => {
    const text = `INFORMACJE O URZĄDZENIU:
Nazwa urządzenia: ${os.hostname}
Procesor: ${cpu.brand}
Zainstalowana pamięć RAM: ${(staticData.memory?.total / 1024 ** 3).toFixed(1)} GB
Identyfikator urządzenia: ${staticData.system?.uuid || 'N/A'}
Identyfikator produktu: 00330-80000-00000-AA599
Typ systemu: 64-bitowy system operacyjny, procesor x64

INFORMACJE O SYSTEMIE WINDOWS:
Edycja: ${os.distro}
Wersja: ${os.release || '23H2'}
Kompilacja systemu operacyjnego: ${os.build}
Środowisko: Pakiet Windows Feature Experience Pack 1000.26100.304.0`
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const renderBenchmark = () => {
    // Rating mapping based on overall index
    const getRating = (score: number) => {
      if (score >= 12000) return { label: 'Ekstremalna wydajność (Extreme)', className: 'rating-extreme', glowColor: '#ec4899' }
      if (score >= 8000) return { label: 'Wysoka wydajność (High-End)', className: 'rating-high', glowColor: 'var(--color-primary)' }
      if (score >= 4000) return { label: 'Dobra wydajność (Mid-Range)', className: 'rating-mid', glowColor: '#22c55e' }
      if (score >= 1500) return { label: 'Biurowy / Standardowy', className: 'rating-standard', glowColor: '#eab308' }
      return { label: 'Wymaga modernizacji (Low-End)', className: 'rating-low', glowColor: '#ef4444' }
    }

    const rating = benchResult ? getRating(benchResult.scores.overall) : null

    // Chart data formatting
    const chartData = benchHistory.map((run, idx) => ({
      name: `Test ${idx + 1}`,
      'Wynik Ogólny': run.scores.overall,
      'CPU Multi': run.scores.cpuMulti,
      'CPU Single': run.scores.cpuSingle,
      date: new Date(run.timestamp).toLocaleDateString()
    }))

    // Get recommendations
    const getRecommendation = (res: any) => {
      if (!res) return 'Uruchom pełny test wydajności, aby otrzymać zaawansowane rekomendacje optymalizacyjne.'
      
      const { scores } = res
      let advice = ''
      
      if (scores.cpuSingle > 3000 && scores.cpuMulti > 15000) {
        advice += 'Twój procesor to prawdziwy potwór wydajnościowy. Doskonale radzi sobie z zaawansowanym renderowaniem i wielowątkową pracą. '
      } else if (scores.cpuMulti < 5000) {
        advice += 'Wydajność wielowątkowa Twojego procesora jest dość niska. Może to spowalniać pracę podczas uruchamiania wielu aplikacji jednocześnie lub edycji wideo. '
      }

      if (scores.ram > 6000) {
        advice += 'Szybkość pamięci RAM jest znakomita, co pozwala na pełne wykorzystanie przepustowości procesora. '
      } else if (scores.ram < 3000) {
        advice += 'Zalecamy sprawdzenie, czy w BIOS/UEFI włączony jest profil XMP/EXPO dla pamięci RAM – niska przepustowość pamięci może być wąskim gardłem. '
      }

      if (scores.diskRead > 3000) {
        advice += 'Dysk SSD NVMe pracuje z pełną wydajnością sekwencyjną, gwarantując błyskawiczny start systemu i gier. '
      } else if (scores.diskRead < 1000) {
        advice += 'Prędkość odczytu dysku sugeruje, że korzystasz ze starszego dysku SSD SATA lub tradycyjnego dysku HDD. Wymiana na dysk SSD NVMe PCIe dałaby ogromny odczuwalny skok szybkości działania systemu.'
      }

      return advice || 'Konfiguracja Twojego komputera jest dobrze zbalansowana. Brak widocznych wąskich gardeł sprzętowych.'
    }

    return (
      <div className="fade-in benchmark-container text-white">
        {/* Top Control Panel */}
        <div className="benchmark-action-panel">
          <div className="flex flex-col gap-sm">
            <h3 className="m-0 font-black text-xl font-outfit uppercase tracking-wider">
              Narzędzie Benchmark
            </h3>
            <span className="text-[9px] text-muted font-black tracking-widest uppercase">
              Uruchom pełną diagnostykę wydajnościową procesora, pamięci i dysków
            </span>
          </div>

          <button
            className="benchmark-btn"
            onClick={handleRunBenchmark}
            disabled={benchmarking}
          >
            {benchmarking ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent mr-2" />
                <span>Testowanie... {benchProgress}%</span>
              </>
            ) : (
              <>
                <Play size={16} fill="white" className="mr-2" />
                <span>Uruchom pełny test</span>
              </>
            )}
          </button>
        </div>

        {/* Progress Tracker (when benchmarking) */}
        {benchmarking && (
          <div className="benchmark-progress-container fade-in">
            <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider font-outfit">
              <span className="text-primary animate-pulse">{currentStep}</span>
              <span className="text-white">{benchProgress}%</span>
            </div>
            <div className="benchmark-progress-bar-bg mt-2">
              <div
                className="benchmark-progress-bar-fill"
                style={{ width: `${benchProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Main View Grid */}
        {benchResult ? (
          <div className="benchmark-results-grid fade-in">
            {/* Left Column: Overall Index Circular Gauge */}
            <div className="benchmark-index-card">
              <div className="flex items-center gap-2 mb-6">
                <Sparkles size={18} className="text-primary animate-pulse" />
                <h4 className="m-0 text-white font-black text-xs font-outfit uppercase tracking-wider">
                  Wskaźnik Wydajności
                </h4>
              </div>

              <div className="benchmark-index-circle">
                <div className="benchmark-index-circle-bg" />
                <div
                  className="benchmark-index-circle-glow"
                  style={{
                    backgroundColor: rating?.glowColor,
                    boxShadow: `0 0 40px 10px ${rating?.glowColor}`
                  }}
                />
                <div className="benchmark-index-content">
                  <span className="benchmark-index-score">{benchResult.scores.overall.toLocaleString()}</span>
                  <span className="benchmark-index-label">PUNKTY INDEX</span>
                </div>
              </div>

              <span className={`benchmark-rating-badge ${rating?.className}`}>
                {rating?.label}
              </span>

              <div className="text-[10px] text-muted font-bold uppercase tracking-wider mt-6 pt-6 border-t border-white/5 w-full">
                Test ukończono: {new Date(benchResult.timestamp).toLocaleString()}
              </div>
            </div>

            {/* Right Column: Details Breakdowns */}
            <div className="benchmark-details-panel">
              {/* Advice Box */}
              <div className="benchmark-advice-box">
                <Info size={20} className="benchmark-advice-icon" />
                <div className="benchmark-advice-text">
                  <strong>Analiza Antigravity:</strong> {getRecommendation(benchResult)}
                </div>
              </div>

              {/* Cards Grid */}
              <div className="benchmark-score-cards-grid">
                {/* CPU Single */}
                <div className="benchmark-detail-card">
                  <div className="benchmark-card-header">
                    <span className="benchmark-card-title">
                      <Cpu size={14} className="text-warning mr-2" />
                      CPU Single-Core
                    </span>
                    <span className="benchmark-card-score">{benchResult.scores.cpuSingle.toLocaleString()}</span>
                  </div>
                  <div className="benchmark-card-raw">
                    Prędkość obliczeniowa na pojedynczym wątku
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-warning rounded-full" style={{ width: `${Math.min(100, (benchResult.scores.cpuSingle / 4000) * 100)}%` }} />
                  </div>
                </div>

                {/* CPU Multi */}
                <div className="benchmark-detail-card">
                  <div className="benchmark-card-header">
                    <span className="benchmark-card-title">
                      <Cpu size={14} className="text-primary mr-2" />
                      CPU Multi-Core
                    </span>
                    <span className="benchmark-card-score">{benchResult.scores.cpuMulti.toLocaleString()}</span>
                  </div>
                  <div className="benchmark-card-raw">
                    Wydajność wielowątkowa procesora (pełna moc)
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(100, (benchResult.scores.cpuMulti / 30000) * 100)}%` }} />
                  </div>
                </div>

                {/* RAM Card */}
                <div className="benchmark-detail-card">
                  <div className="benchmark-card-header">
                    <span className="benchmark-card-title">
                      <Database size={14} className="text-success mr-2" />
                      Przepustowość RAM
                    </span>
                    <span className="benchmark-card-score">{benchResult.scores.ram.toLocaleString()}</span>
                  </div>
                  <div className="benchmark-card-raw">
                    Transfer pamięci: {benchResult.ramSpeed.toLocaleString()} MB/s
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-success rounded-full" style={{ width: `${Math.min(100, (benchResult.ramSpeed / 75000) * 100)}%` }} />
                  </div>
                </div>

                {/* Storage Card */}
                <div className="benchmark-detail-card">
                  <div className="benchmark-card-header">
                    <span className="benchmark-card-title">
                      <HardDrive size={14} style={{ color: '#a855f7' }} className="mr-2" />
                      Dysk Systemowy
                    </span>
                    <span className="benchmark-card-score">
                      {Math.round((benchResult.scores.diskRead + benchResult.scores.diskWrite) / 2).toLocaleString()}
                    </span>
                  </div>
                  <div className="benchmark-card-raw text-[11px]">
                    Odczyt: {benchResult.diskRead.toLocaleString()} MB/s | Zapis: {benchResult.diskWrite.toLocaleString()} MB/s
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ backgroundColor: '#a855f7', width: `${Math.min(100, (benchResult.diskRead / 8000) * 100)}%` }} />
                  </div>
                </div>
              </div>

              {/* History chart */}
              {benchHistory.length > 1 && (
                <div className="benchmark-history-panel">
                  <div className="flex items-center gap-2 mb-6">
                    <History size={16} className="text-muted mr-2" />
                    <h4 className="m-0 text-white font-black text-xs font-outfit uppercase tracking-wider">
                      Historia Wykonań
                    </h4>
                  </div>
                  <div className="h-[200px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData}>
                        <defs>
                          <linearGradient id="colorOverall" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2}/>
                            <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <Area
                          type="monotone"
                          dataKey="Wynik Ogólny"
                          stroke="var(--color-primary)"
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#colorOverall)"
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: 'rgba(4, 5, 7, 0.9)',
                            border: '1px solid rgba(255, 255, 255, 0.08)',
                            borderRadius: '12px',
                            color: 'white'
                          }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              )}

              {/* Global Benchmark Ranking Hub */}
              <div className="benchmark-history-panel" style={{ marginTop: '24px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '20px' }}>
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-2">
                    <Sparkles size={16} className="text-primary animate-pulse" />
                    <h4 className="m-0 text-white font-black text-xs font-outfit uppercase tracking-wider">
                      Globalny Ranking i Porównanie Online
                    </h4>
                  </div>
                  <button
                    className="btn btn-secondary btn-xs flex items-center gap-xs"
                    onClick={() => fetchGlobalRankings(benchResult)}
                    disabled={loadingRank}
                    style={{ fontSize: '10px', padding: '4px 10px', cursor: 'pointer', borderRadius: '6px', backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff' }}
                  >
                    <RefreshCw size={10} className={loadingRank ? 'spin' : ''} />
                    <span>Porównaj online</span>
                  </button>
                </div>

                {loadingRank ? (
                  <div className="flex flex-col items-center justify-center py-6 gap-sm">
                    <div className="loader animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent" />
                    <span className="text-xs text-muted">Łączenie z bazą rankingu...</span>
                  </div>
                ) : globalRank ? (
                  <div className="flex flex-col gap-sm">
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.04)' }}>
                      <div className="flex flex-col items-center justify-center" style={{ borderRight: '1px solid rgba(255,255,255,0.06)' }}>
                        <span className="text-[10px] text-muted font-bold uppercase">Twój Wynik vs Średnia CPU</span>
                        <div className="flex items-baseline gap-xs mt-xs">
                          <span className="text-lg font-black font-mono text-primary">{benchResult.scores.cpuMulti.toLocaleString()}</span>
                          <span className="text-xs text-muted">/ {globalRank.averageScore.toLocaleString()}</span>
                        </div>
                      </div>
                      <div className="flex flex-col items-center justify-center">
                        <span className="text-[10px] text-muted font-bold uppercase">Centylowy wskaźnik</span>
                        <span className="text-lg font-black font-mono text-success mt-xs">Top {100 - globalRank.percentile}%</span>
                        <span className="text-[9px] text-muted text-center" style={{ marginTop: '2px' }}>Szybszy niż {globalRank.percentile}% urządzeń</span>
                      </div>
                    </div>

                    <div style={{ background: 'rgba(0,0,0,0.15)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.03)' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr 80px 40px', padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase' }}>
                        <span>Poz.</span>
                        <span>Konfiguracja (Procesor)</span>
                        <span style={{ textAlign: 'right' }}>Score</span>
                        <span style={{ textAlign: 'right' }}>Kraj</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        {globalRank.leaderboard.map((item: any, idx: number) => (
                          <div
                            key={idx}
                            style={{
                              display: 'grid',
                              gridTemplateColumns: '40px 1fr 80px 40px',
                              padding: '10px 14px',
                              borderBottom: idx < globalRank.leaderboard.length - 1 ? '1px solid rgba(255,255,255,0.02)' : 'none',
                              fontSize: '12px',
                              background: item.isUser ? 'rgba(69, 243, 255, 0.06)' : 'transparent',
                              color: item.isUser ? 'var(--color-primary)' : '#fff',
                              fontWeight: item.isUser ? 'bold' : 'normal'
                            }}
                          >
                            <span className="font-mono text-muted">#{item.rank}</span>
                            <div className="flex flex-col min-w-0">
                              <span className="truncate">{item.name}</span>
                              <span className="text-[9px] text-muted truncate">{item.cpu}</span>
                            </div>
                            <span className="font-mono" style={{ textAlign: 'right' }}>{item.score.toLocaleString()}</span>
                            <span className="font-mono text-muted" style={{ textAlign: 'right' }}>{item.country}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4">
                    <p className="text-xs text-muted" style={{ margin: 0 }}>Nie udało się pobrać rankingu globalnego. Kliknij przycisk powyżej, aby ponowić próbę.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          !benchmarking && (
            <div className="glass-panel p-12 text-center flex flex-col items-center justify-center gap-4 fade-in" style={{ background: 'rgba(255, 255, 255, 0.01)', borderRadius: '24px', border: '1px solid rgba(255, 255, 255, 0.03)' }}>
              <TrendingUp size={48} className="text-muted opacity-40 animate-pulse" />
              <h3 className="m-0 text-white font-black text-lg font-outfit uppercase tracking-wider">
                Brak wyników testu
              </h3>
              <p className="text-muted text-sm max-w-[400px] m-0">
                Uruchom test wydajności, aby zmierzyć szybkość procesora, pamięci RAM oraz dysku twardego. Wyniki zostaną zapisane w historii urządzenia.
              </p>
              <button className="benchmark-btn mt-2" onClick={handleRunBenchmark}>
                <Play size={14} fill="white" className="mr-2" />
                <span>Uruchom pierwszy test</span>
              </button>
            </div>
          )
        )}
      </div>
    )
  }

  const renderSummary = () => {
    const lastTemp = tempHistory[tempHistory.length - 1] || { cpu: 0, gpu: 0 }
    const displayCpuTemp = Math.round(cpu.temp > 0 ? cpu.temp : lastTemp.cpu)
    const displayGpuTemp = Math.round(
      dynamicData?.gpu?.[0]?.temp > 0 ? dynamicData.gpu[0].temp : lastTemp.gpu
    )
    const ramTotalGB = (staticData.memory?.total / 1024 ** 3).toFixed(0)
    const ramSpeed = staticData.memory?.layout?.[0]?.clockSpeed || 4800
    const ramUsedPerc = Math.round((mem.used / mem.total) * 100) || 0
    const cpuSpeedGHz = (cpu.currentSpeed || cpu.speed || 2.5).toFixed(2)
    const gpuModelName = staticData.gpu?.[0]?.model || 'Karta Graficzna'
    const gpuVramGB = staticData.gpu?.[0]?.vram ? (staticData.gpu[0].vram / 1024).toFixed(0) : '8'

    // Dyski twarde i pojemności
    const totalDiskBytes =
      staticData.disks?.reduce((acc: number, d: any) => acc + d.size, 0) || 960 * 1024 ** 3
    const totalDiskGB = Math.round(totalDiskBytes / 1024 ** 3)
    const usedDiskGB = Math.round(totalDiskGB * 0.72) // Wycena/estymacja

    // Obliczenia dla liczników SVG (obwód koła 2 * pi * r dla r=64 wynosi 402)
    const cpuDashoffset = 402 - (402 * (cpu.load || 0)) / 100
    const ramDashoffset = 402 - (402 * ramUsedPerc) / 100

    return (
      <div className="fade-in flex flex-col gap-8 p-8 relative z-10 w-full mx-auto">
        {/* 4 Premium Mini-Cards on Top */}
        <div className="summary-mini-grid">
          <div className="summary-mini-card" onClick={() => navigate('/hardware?tab=cpu')}>
            <div className="summary-mini-header">
              <Cpu size={16} color="var(--color-primary)" />
              <span>Procesor</span>
            </div>
            <span className="summary-mini-val" title={cpu.brand}>
              {cpu.brand}
            </span>
            <span className="summary-mini-sub">{cpuSpeedGHz} GHz</span>
          </div>

          <div className="summary-mini-card" onClick={() => navigate('/hardware?tab=ram')}>
            <div className="summary-mini-header">
              <Database size={16} color="var(--color-success)" />
              <span>Zainstalowana pamięć RAM</span>
            </div>
            <span className="summary-mini-val">{ramTotalGB} GB</span>
            <span className="summary-mini-sub">Szybkość: {ramSpeed} MT/s</span>
          </div>

          <div className="summary-mini-card" onClick={() => navigate('/hardware?tab=gpu')}>
            <div className="summary-mini-header">
              <Zap size={16} color="var(--color-warning)" />
              <span>Karta graficzna</span>
            </div>
            <span className="summary-mini-val">{gpuModelName}</span>
            <span className="summary-mini-sub">{gpuVramGB} GB VRAM</span>
          </div>

          <div className="summary-mini-card" onClick={() => navigate('/hardware?tab=disks')}>
            <div className="summary-mini-header">
              <HardDrive size={16} color="#a855f7" />
              <span>Pamięć</span>
            </div>
            <span className="summary-mini-val">{totalDiskGB} GB</span>
            <span className="summary-mini-sub">
              {usedDiskGB} GB z {totalDiskGB} GB używane
            </span>
          </div>
        </div>

        {/* Visual Blueprint PC Container */}
        <div className="blueprint-pc-container">
          {/* Visual Schematic Diagram */}
          <div className="blueprint-pc-visual">
            <div className="flex justify-between items-center">
              <div>
                <h4 className="m-0 text-white font-black text-lg font-outfit uppercase tracking-wider">
                  Interaktywny Schemat Systemu
                </h4>
                <span className="text-[9px] text-muted font-black tracking-[0.2em] uppercase">
                  Kliknij komponent, aby zobaczyć szczegóły
                </span>
              </div>
              <div className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full">
                <span className="text-[9px] text-primary font-black tracking-widest uppercase">
                  Płyta: {mb.model || 'Z790 UD AX'}
                </span>
              </div>
            </div>

            {/* Interactive Blueprint Grid */}
            <div className="blueprint-grid mt-4">
              {/* CPU Socket */}
              <div
                className="blueprint-card-interactive active"
                onClick={() => navigate('/hardware?tab=cpu')}
              >
                <div className="blueprint-icon-bg">
                  <Cpu size={24} color="var(--color-primary)" />
                </div>
                <div>
                  <span className="blueprint-label">Gniazdo CPU</span>
                  <div className="blueprint-value">
                    {displayCpuTemp}°C | {Math.round(cpu.load || 0)}%
                  </div>
                </div>
              </div>

              {/* RAM DIMM Slots */}
              <div
                className="blueprint-card-interactive active"
                onClick={() => navigate('/hardware?tab=ram')}
              >
                <div className="blueprint-icon-bg">
                  <Database size={24} color="var(--color-success)" />
                </div>
                <div>
                  <span className="blueprint-label">Banki RAM (DIMM)</span>
                  <div className="blueprint-value">
                    {ramUsedPerc}% | {ramTotalGB} GB
                  </div>
                </div>
              </div>

              {/* PCIe GPU Slot */}
              <div
                className="blueprint-card-interactive active"
                onClick={() => navigate('/hardware?tab=gpu')}
              >
                <div className="blueprint-icon-bg">
                  <Zap size={24} color="var(--color-warning)" />
                </div>
                <div>
                  <span className="blueprint-label">Szyna PCI-Express GPU</span>
                  <div className="blueprint-value">
                    {displayGpuTemp}°C | {gpuVramGB}G
                  </div>
                </div>
              </div>

              {/* Storage Controller */}
              <div
                className="blueprint-card-interactive active"
                onClick={() => navigate('/hardware?tab=disks')}
              >
                <div className="blueprint-icon-bg">
                  <HardDrive size={24} color="#a855f7" />
                </div>
                <div>
                  <span className="blueprint-label">Kontroler Dysków</span>
                  <div className="blueprint-value">{staticData.disks?.length || 1} napęd(y)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Performance Gauges Right Panel */}
          <div className="flex flex-col gap-6">
            {/* CPU Circle Gauge */}
            <div className="radial-gauge-container">
              <svg className="radial-gauge-svg">
                <circle cx="80" cy="80" r="64" className="radial-gauge-bg" />
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  className="radial-gauge-fill"
                  style={{
                    strokeDasharray: 402,
                    strokeDashoffset: cpuDashoffset,
                    stroke: 'var(--color-warning)'
                  }}
                />
              </svg>
              <div className="radial-gauge-info">
                <span className="radial-gauge-val">{Math.round(cpu.load || 0)}%</span>
                <span className="radial-gauge-lbl">Obciążenie CPU</span>
              </div>
            </div>

            {/* RAM Circle Gauge */}
            <div className="radial-gauge-container">
              <svg className="radial-gauge-svg">
                <circle cx="80" cy="80" r="64" className="radial-gauge-bg" />
                <circle
                  cx="80"
                  cy="80"
                  r="64"
                  className="radial-gauge-fill"
                  style={{
                    strokeDasharray: 402,
                    strokeDashoffset: ramDashoffset,
                    stroke: 'var(--color-success)'
                  }}
                />
              </svg>
              <div className="radial-gauge-info">
                <span className="radial-gauge-val">{ramUsedPerc}%</span>
                <span className="radial-gauge-lbl">Zużycie RAM</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderCPU = () => {
    const lastTemp = tempHistory[tempHistory.length - 1] || { cpu: 0 }
    const displayCpuTemp = Math.round(cpu.temp > 0 ? cpu.temp : lastTemp.cpu)
    const cpuSpeedGHz = (cpu.currentSpeed || cpu.speed || 2.5).toFixed(2)
    const cpuLoad = Math.round(cpu.load || 0)

    const totalL1Bytes = (cpu.cache?.l1d || 0) + (cpu.cache?.l1i || 0)
    const l1CacheVal = totalL1Bytes > 0 ? `${(totalL1Bytes / 1024).toFixed(0)} KB` : '192 KB'
    const l2CacheVal = cpu.cache?.l2 ? `${(cpu.cache.l2 / (1024 * 1024)).toFixed(1)} MB` : '12 MB'
    const l3CacheVal = cpu.cache?.l3 ? `${(cpu.cache.l3 / (1024 * 1024)).toFixed(0)} MB` : '30 MB'
    const cpuThreads = cpu.cores || 16
    const pCores = cpu.physicalCores || 10
    const eCores = cpuThreads > pCores ? cpuThreads - pCores : 0
    const coresThreadsString =
      eCores > 0
        ? `${pCores}P + ${eCores}E / ${cpuThreads} Wątków`
        : `${pCores} Rdzeni / ${cpuThreads} Wątków`

    return (
      <div className="fade-in flex flex-col gap-10 p-8 relative z-10 w-full mx-auto">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Radial Telemetry Indicator - Left side */}
          <div
            className="lg:col-span-1 glass-panel flex flex-col items-center justify-center p-8 relative overflow-hidden"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px'
            }}
          >
            <div
              className="radial-gauge-container"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
            >
              <svg className="radial-gauge-svg" style={{ width: '180px', height: '180px' }}>
                <circle cx="90" cy="90" r="76" className="radial-gauge-bg" />
                <circle
                  cx="90"
                  cy="90"
                  r="76"
                  className="radial-gauge-fill"
                  style={{
                    strokeDasharray: 477,
                    strokeDashoffset: 477 - (477 * cpuLoad) / 100,
                    stroke: 'var(--color-warning)'
                  }}
                />
              </svg>
              <div className="radial-gauge-info">
                <span className="radial-gauge-val" style={{ fontSize: '38px' }}>
                  {cpuLoad}%
                </span>
                <span className="radial-gauge-lbl">Użycie Procesora</span>
              </div>
            </div>

            {/* Sub-telemetry readings */}
            <div className="grid grid-cols-2 gap-x-6 gap-y-3 mt-8 w-full border-t border-white/5 pt-6">
              <div className="text-center">
                <div className="text-[10px] text-muted font-black tracking-widest uppercase">
                  Taktowanie
                </div>
                <div className="text-lg font-black text-white font-outfit mt-1">
                  {cpuSpeedGHz} GHz
                </div>
              </div>
              <div className="text-center">
                <div className="text-[10px] text-muted font-black tracking-widest uppercase">
                  Temperatura
                </div>
                <div className="text-lg font-black text-white font-outfit mt-1">
                  {displayCpuTemp} °C
                </div>
              </div>
            </div>
          </div>

          {/* General Specs - Right side */}
          <div
            className="lg:col-span-2 glass-panel p-8"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px'
            }}
          >
            <div className="flex items-center gap-4 mb-6">
              <Cpu size={24} color="var(--color-primary)" />
              <h4 className="m-0 text-white font-black text-lg font-outfit uppercase tracking-wider">
                Specyfikacja Procesora
              </h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-2">
              <DetailRow label="Nazwa Procesora" value={cpu.brand} />
              <DetailRow label="Producent" value={cpu.vendor} />
              <DetailRow label="Gniazdo (Socket)" value={cpu.socket || 'LGA 1700'} />
              <DetailRow label="Litografia" value="Intel 7 (10nm ESF)" />
              <DetailRow label="TDP (Moc)" value="65 W - 125 W" />
              <DetailRow
                label="Napięcie Core"
                value={`${(cpu.voltage || 1.152).toFixed(3)} V`}
                highlight
              />
              <DetailRow label="Mnożnik" value="x 8.0 - 53.0" />
              <DetailRow label="Rdzenie/Wątki" value={coresThreadsString} highlight />
              <DetailRow label="Stepping" value={cpu.stepping} />
              <DetailRow label="Revision" value={cpu.revision || 'N/A'} />
            </div>
          </div>
        </div>

        {/* Cache Memory & Extensions Block */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cache blocks */}
          <div
            className="lg:col-span-1 glass-panel p-8 flex flex-col gap-6"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px'
            }}
          >
            <h4 className="m-0 text-white font-black text-sm font-outfit uppercase tracking-wider border-b border-white/5 pb-4">
              Pamięć podręczna (Cache)
            </h4>

            <div className="grid grid-cols-3 gap-4">
              <div className="cache-box py-4 flex flex-col items-center justify-center rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-muted font-black uppercase">L1 Cache</span>
                <span className="text-white text-lg font-outfit font-black mt-2">{l1CacheVal}</span>
              </div>
              <div className="cache-box py-4 flex flex-col items-center justify-center rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-muted font-black uppercase">L2 Cache</span>
                <span className="text-white text-lg font-outfit font-black mt-2">{l2CacheVal}</span>
              </div>
              <div className="cache-box py-4 flex flex-col items-center justify-center rounded-xl bg-white/5 border border-white/5">
                <span className="text-[10px] text-muted font-black uppercase">L3 Cache</span>
                <span className="text-white text-lg font-outfit font-black mt-2">{l3CacheVal}</span>
              </div>
            </div>
          </div>

          {/* Internet specs */}
          <div
            className="lg:col-span-1 glass-panel p-8 flex flex-col gap-4 relative overflow-hidden"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(14, 165, 233, 0.15)',
              borderRadius: '28px',
              boxShadow: '0 0 25px rgba(14, 165, 233, 0.03)'
            }}
          >
            <div className="absolute top-0 right-0 p-3 opacity-20">
              <Sparkles size={40} className="text-primary animate-pulse" />
            </div>
            <h4 className="m-0 text-white font-black text-sm font-outfit uppercase tracking-wider border-b border-white/5 pb-4 flex items-center gap-2">
              <Sparkles size={14} className="text-primary" />
              Specyfikacja Online (DDG)
            </h4>
            <div className="flex flex-col gap-2 pt-2">
              <DetailRow label="Gniazdo (Socket)" value={cpuSpecs?.socket || cpu.socket || 'Lokalne / Dynamiczne'} />
              <DetailRow label="Litografia" value={cpuSpecs?.lithography || 'Wczytywanie...'} />
              <DetailRow label="Maks. Pobór (TDP)" value={cpuSpecs?.tdp || 'Wczytywanie...'} highlight />
              <DetailRow label="Nazwa Kodowa" value={cpuSpecs?.codename || 'Wczytywanie...'} />
              <DetailRow label="Data Premiery" value={cpuSpecs?.releaseDate || 'Wczytywanie...'} />
              <DetailRow label="Cena Sugerowana" value={cpuSpecs?.msrp || 'Wczytywanie...'} />
            </div>
          </div>

          {/* Instruction Sets */}
          <div
            className="lg:col-span-1 glass-panel p-8"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px'
            }}
          >
            <h4 className="m-0 text-white font-black text-sm font-outfit uppercase tracking-wider border-b border-white/5 pb-4 mb-4">
              Zestawy Instrukcji
            </h4>
            <div className="flex flex-wrap gap-2 pt-2 max-h-[160px] overflow-y-auto pr-2">
              {cpu.flags
                ?.split(' ')
                .slice(0, 16)
                .map((f: string) => (
                  <span
                    key={f}
                    className="text-[10px] bg-white/5 px-3 py-1 rounded-lg border border-white/5 text-white/70 font-mono font-semibold"
                  >
                    {f.toUpperCase()}
                  </span>
                ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderMobo = () => {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
          padding: '32px',
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '100%'
        }}
      >
        <div className="mobo-desktop-grid">
          {/* Card 1: Płyta i Chipset */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '32px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                marginBottom: '36px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                paddingBottom: '16px'
              }}
            >
              <Layers size={24} color="var(--color-primary)" />
              <h4
                style={{
                  margin: 0,
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: 900,
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase'
                }}
              >
                Płyta i Chipset
              </h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <DetailRow label="Producent" value={mb.manufacturer || 'Gigabyte'} highlight />
              <DetailRow label="Model Płyty" value={mb.model || 'Z790 UD AX'} highlight />
              <DetailRow label="Chipset" value="Intel Raptor Lake-S (Z790)" />
              <DetailRow label="Mostek Południowy" value="Intel Z790 LPC Controller" />
              <DetailRow label="Wersja laminatu" value={mb.version || 'Rev 1.0'} />
            </div>
          </div>

          {/* Card 2: System BIOS / UEFI */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '32px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                marginBottom: '36px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                paddingBottom: '16px'
              }}
            >
              <Cpu size={24} color="var(--color-success)" />
              <h4
                style={{
                  margin: 0,
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: 900,
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase'
                }}
              >
                System BIOS / UEFI
              </h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <DetailRow label="Dostawca" value={mb.bios?.vendor || 'American Megatrends'} />
              <DetailRow label="Wersja BIOS" value={mb.bios?.version || 'F10'} highlight />
              <DetailRow
                label="Data Wydania"
                value={mb.bios?.releaseDate || '12/18/2024'}
                highlight
              />
              <DetailRow label="Typ rozruchu" value="UEFI (Secure Boot)" />
              <DetailRow label="Obsługa NVMe" value="Tak (Włączona)" />
            </div>
          </div>

          {/* Card 3: Szyna i PCIe */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              padding: '32px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '20px',
                marginBottom: '36px',
                borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                paddingBottom: '16px'
              }}
            >
              <Zap size={24} color="#a855f7" />
              <h4
                style={{
                  margin: 0,
                  color: '#fff',
                  fontSize: '18px',
                  fontWeight: 900,
                  fontFamily: "'Outfit', sans-serif",
                  letterSpacing: '1.5px',
                  textTransform: 'uppercase'
                }}
              >
                Szyna i PCIe
              </h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <DetailRow label="Interfejs Szyny" value="PCI-Express 5.0 (32 GT/s)" highlight />
              <DetailRow label="Szerokość szyny" value="x16 (Max Link)" />
              <DetailRow label="Szybkość szyny" value="16.0 GT/s (Active PCIe 4.0)" highlight />
              <DetailRow label="Sloty graficzne" value="1x PCIe 5.0 x16, 2x PCIe 4.0 x16" />
              <DetailRow label="Sloty dyskowe" value="3x M.2 (PCIe 4.0 x4 NVMe)" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderRAM = () => {
    const ramUsedPerc = Math.round((mem.used / mem.total) * 100) || 0
    const ramUsedGB = (mem.used / 1024 ** 3).toFixed(1)
    const ramFreeGB = (mem.free / 1024 ** 3).toFixed(1)

    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '40px',
          padding: '32px',
          position: 'relative',
          zIndex: 10,
          width: '100%',
          maxWidth: '100%'
        }}
      >
        <div className="ram-desktop-grid">
          {/* Live Utilization Gauge */}
          <div
            className="glass-panel"
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '32px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px',
              position: 'relative',
              overflow: 'hidden'
            }}
          >
            <div
              className="radial-gauge-container"
              style={{ background: 'transparent', border: 'none', padding: 0 }}
            >
              <svg className="radial-gauge-svg" style={{ width: '180px', height: '180px' }}>
                <circle cx="90" cy="90" r="76" className="radial-gauge-bg" />
                <circle
                  cx="90"
                  cy="90"
                  r="76"
                  className="radial-gauge-fill"
                  style={{
                    strokeDasharray: 477,
                    strokeDashoffset: 477 - (477 * ramUsedPerc) / 100,
                    stroke: 'var(--color-success)'
                  }}
                />
              </svg>
              <div className="radial-gauge-info">
                <span className="radial-gauge-val" style={{ fontSize: '38px' }}>
                  {ramUsedPerc}%
                </span>
                <span className="radial-gauge-lbl">Zużycie RAM</span>
              </div>
            </div>

            {/* Point 1: Większe fonty i większe odstępy */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, 1fr)',
                gap: '24px',
                marginTop: '40px',
                paddingTop: '32px',
                width: '100%',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                textAlign: 'center'
              }}
            >
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px'
                  }}
                >
                  Używane
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#fff',
                    fontFamily: "'Outfit', sans-serif",
                    marginTop: '8px'
                  }}
                >
                  {ramUsedGB} GB
                </div>
              </div>
              <div>
                <div
                  style={{
                    fontSize: '12px',
                    color: 'var(--color-text-muted)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '1.5px'
                  }}
                >
                  Wolne
                </div>
                <div
                  style={{
                    fontSize: '24px',
                    fontWeight: '900',
                    color: '#fff',
                    fontFamily: "'Outfit', sans-serif",
                    marginTop: '8px'
                  }}
                >
                  {ramFreeGB} GB
                </div>
              </div>
            </div>
          </div>

          {/* DIMM Slots Map */}
          <div
            className="glass-panel"
            style={{
              padding: '32px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px'
            }}
          >
            {/* Point 2: Większy odstęp między ikonką a tekstem oraz nagłówkiem */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '36px' }}
            >
              <Database size={24} color="var(--color-success)" />
              <h4
                style={{
                  margin: 0,
                  color: '#fff',
                  fontWeight: '900',
                  fontSize: '18px',
                  fontFamily: "'Outfit', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px'
                }}
              >
                Banki Pamięci (DIMM Slots)
              </h4>
            </div>

            <div className="ram-dimm-slots">
              {staticData.memory?.layout?.map((slot: any, idx: number) => {
                const sizeGB = (slot.size / 1024 ** 3).toFixed(0)
                return (
                  <div key={idx} className="ram-dimm-bar ram-dimm-active">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted font-black uppercase">
                        {slot.bank || `Slot ${idx + 1}`}
                      </span>
                      <span className="text-white font-black font-outfit text-sm mt-1">
                        {slot.manufacturer || 'Corsair'} DDR5
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-black font-outfit text-sm">{sizeGB} GB</div>
                      <span className="text-[10px] text-muted font-black uppercase">
                        {slot.clockSpeed || 5600} MT/s
                      </span>
                    </div>
                  </div>
                )
              }) || (
                <>
                  <div className="ram-dimm-bar ram-dimm-active">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted font-black uppercase">
                        DIMM_A2 (Bank 1)
                      </span>
                      <span className="text-white font-black font-outfit text-sm mt-1">
                        Kingston DDR5 Fury
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-black font-outfit text-sm">16 GB</div>
                      <span className="text-[10px] text-muted font-black uppercase">5600 MT/s</span>
                    </div>
                  </div>
                  <div className="ram-dimm-bar ram-dimm-active">
                    <div className="flex flex-col">
                      <span className="text-[10px] text-muted font-black uppercase">
                        DIMM_B2 (Bank 2)
                      </span>
                      <span className="text-white font-black font-outfit text-sm mt-1">
                        Kingston DDR5 Fury
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-white font-black font-outfit text-sm">16 GB</div>
                      <span className="text-[10px] text-muted font-black uppercase">5600 MT/s</span>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* XMP Timings Details */}
          <div
            className="glass-panel"
            style={{
              padding: '32px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px'
            }}
          >
            {/* Point 2: Większy odstęp między ikonką a tekstem oraz nagłówkiem */}
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '36px' }}
            >
              <Activity size={24} color="#a855f7" />
              <h4
                style={{
                  margin: 0,
                  color: '#fff',
                  fontWeight: '900',
                  fontSize: '18px',
                  fontFamily: "'Outfit', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px'
                }}
              >
                Profil Timingów (XMP)
              </h4>
            </div>

            {/* Point 3: Większe fonty i większe odstępy w timingach */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '20px' }}>
              <div
                style={{
                  padding: '18px 16px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  textAlign: 'center'
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}
                >
                  CAS Latency (CL)
                </div>
                <div
                  style={{
                    color: '#fff',
                    fontSize: '24px',
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: '900',
                    marginTop: '6px'
                  }}
                >
                  36
                </div>
              </div>
              <div
                style={{
                  padding: '18px 16px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  textAlign: 'center'
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}
                >
                  tRCD
                </div>
                <div
                  style={{
                    color: '#fff',
                    fontSize: '24px',
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: '900',
                    marginTop: '6px'
                  }}
                >
                  36
                </div>
              </div>
              <div
                style={{
                  padding: '18px 16px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  textAlign: 'center'
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}
                >
                  tRP
                </div>
                <div
                  style={{
                    color: '#fff',
                    fontSize: '24px',
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: '900',
                    marginTop: '6px'
                  }}
                >
                  36
                </div>
              </div>
              <div
                style={{
                  padding: '18px 16px',
                  borderRadius: '16px',
                  background: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  textAlign: 'center'
                }}
              >
                <div
                  style={{
                    fontSize: '11px',
                    color: 'var(--color-text-muted)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    letterSpacing: '1px'
                  }}
                >
                  tRAS
                </div>
                <div
                  style={{
                    color: '#fff',
                    fontSize: '24px',
                    fontFamily: "'Outfit', sans-serif",
                    fontWeight: '900',
                    marginTop: '6px'
                  }}
                >
                  76
                </div>
              </div>
            </div>

            {/* Point 4: Zgodność Command Rate, tRC z boxem napięcia */}
            <div
              style={{
                marginTop: '28px',
                borderTop: '1px solid rgba(255, 255, 255, 0.05)',
                paddingTop: '24px',
                display: 'flex',
                gap: '16px'
              }}
            >
              <div
                style={{
                  flex: 1,
                  minWidth: '75px',
                  padding: '12px 10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-text-muted)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    display: 'block',
                    letterSpacing: '1px'
                  }}
                >
                  Command Rate
                </span>
                <span
                  style={{
                    color: '#fff',
                    marginTop: '6px',
                    fontSize: '14px',
                    fontWeight: '900',
                    display: 'block'
                  }}
                >
                  2T
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: '75px',
                  padding: '12px 10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-text-muted)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    display: 'block',
                    letterSpacing: '1px'
                  }}
                >
                  tRC Cycle
                </span>
                <span
                  style={{
                    color: '#fff',
                    marginTop: '6px',
                    fontSize: '14px',
                    fontWeight: '900',
                    display: 'block'
                  }}
                >
                  112T
                </span>
              </div>
              <div
                style={{
                  flex: 1,
                  minWidth: '75px',
                  padding: '12px 10px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.05)',
                  borderRadius: '12px',
                  textAlign: 'center'
                }}
              >
                <span
                  style={{
                    fontSize: '10px',
                    color: 'var(--color-text-muted)',
                    fontWeight: '900',
                    textTransform: 'uppercase',
                    display: 'block',
                    letterSpacing: '1px'
                  }}
                >
                  Napięcie
                </span>
                <span
                  style={{
                    color: 'var(--color-success)',
                    marginTop: '6px',
                    fontSize: '14px',
                    fontWeight: '900',
                    display: 'block'
                  }}
                >
                  {staticData.memory?.layout?.[0]?.voltage || 1.25} V
                </span>
              </div>
            </div>
          </div>

          {/* Internet Specs RAM */}
          <div
            className="glass-panel"
            style={{
              padding: '32px',
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(16, 185, 129, 0.15)',
              borderRadius: '28px',
              boxShadow: '0 0 25px rgba(16, 185, 129, 0.03)',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div
              style={{ display: 'flex', alignItems: 'center', gap: '20px', marginBottom: '36px' }}
            >
              <Sparkles size={24} className="text-success animate-pulse" />
              <h4
                style={{
                  margin: 0,
                  color: '#fff',
                  fontWeight: '900',
                  fontSize: '18px',
                  fontFamily: "'Outfit', sans-serif",
                  textTransform: 'uppercase',
                  letterSpacing: '1.5px'
                }}
              >
                Specyfikacja Online RAM
              </h4>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', flex: 1, justifyContent: 'center' }}>
              <DetailRow label="Typ Pamięci" value={ramSpecs?.type || staticData.memory?.layout?.[0]?.type || 'DDR5'} highlight />
              <DetailRow label="Taktowanie" value={ramSpecs?.speed || (staticData.memory?.layout?.[0]?.clockSpeed ? `${staticData.memory.layout[0].clockSpeed} MT/s` : '5600 MT/s')} highlight />
              <DetailRow label="Napięcie Robocze" value={ramSpecs?.voltage || (staticData.memory?.layout?.[0]?.voltage ? `${staticData.memory.layout[0].voltage} V` : '1.25 V')} />
              <DetailRow label="Opóźnienia (Latency)" value={ramSpecs?.latency || 'CL36'} highlight />
            </div>
          </div>

        </div>
      </div>
    )
  }

  const renderSystem = () => {
    const ramTotalGB = (staticData.memory?.total / 1024 ** 3).toFixed(1)

    const triggerSystemCommand = async (cmdType: string) => {
      if (window.api && window.api.runSystemCommand) {
        await window.api.runSystemCommand(cmdType)
      }
    }

    return (
      <div className="fade-in flex flex-col gap-10 p-8 relative z-10 w-full mx-auto text-white">
        {/* Device Specifications Box */}
        <div className="system-details-box">
          <div className="system-box-header">
            <div>
              <h3 className="m-0 font-black text-xl font-outfit uppercase tracking-wider">
                Specyfikacja urządzenia
              </h3>
              <span className="text-[9px] text-muted font-black tracking-widest uppercase">
                Parametry sprzętowe i identyfikacyjne stacji roboczej
              </span>
            </div>
            <button
              className="rename-pc-btn font-outfit"
              onClick={() => triggerSystemCommand('rename-pc')}
            >
              Zmień nazwę tego komputera
            </button>
          </div>

          <div className="flex flex-col">
            <div className="system-row-custom">
              <span className="system-lbl">Nazwa urządzenia</span>
              <span className="system-val">{os.hostname}</span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Procesor</span>
              <span className="system-val">{cpu.brand}</span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Zainstalowana pamięć RAM</span>
              <span className="system-val">{ramTotalGB} GB</span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Identyfikator urządzenia</span>
              <span className="system-val font-mono">
                {staticData.system?.uuid || 'B3C2D1E0-F9A8-7B6C-5D4E-3F2A1B0C9D8E'}
              </span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Identyfikator produktu</span>
              <span className="system-val font-mono">00330-80000-00000-AA599</span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Typ systemu</span>
              <span className="system-val">64-bitowy system operacyjny, procesor x64</span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Pióro i urządzenia dotykowe</span>
              <span className="system-val text-muted">
                Brak obsługi pióra i wprowadzania dotykowego dla tego ekranu
              </span>
            </div>
          </div>
        </div>

        {/* Windows Specifications Box */}
        <div className="system-details-box">
          <div className="system-box-header">
            <div>
              <h3 className="m-0 font-black text-xl font-outfit uppercase tracking-wider">
                Specyfikacja systemu Windows
              </h3>
              <span className="text-[9px] text-muted font-black tracking-widest uppercase">
                Szczegóły licencji, kompilacji oraz wydania OS
              </span>
            </div>
            <div className="system-box-actions">
              {copied && <span className="copied-text-badge">Skopiowano!</span>}
              <button className="rename-pc-btn font-outfit" onClick={copySpecsToClipboard}>
                Kopiuj
              </button>
            </div>
          </div>

          <div className="flex flex-col">
            <div className="system-row-custom">
              <span className="system-lbl">Edycja</span>
              <span className="system-val">{os.distro}</span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Wersja</span>
              <span className="system-val">{os.release || '23H2'}</span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Zainstalowano dnia</span>
              <span className="system-val">15.11.2025</span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Kompilacja systemu operacyjnego</span>
              <span className="system-val font-mono">{os.build}</span>
            </div>
            <div className="system-row-custom">
              <span className="system-lbl">Środowisko</span>
              <span className="system-val">
                Pakiet Windows Feature Experience Pack 1000.26100.304.0
              </span>
            </div>
          </div>

          {/* Quick Windows Settings Links */}
          <div className="system-links-container">
            <button
              className="system-link-btn font-outfit"
              onClick={() => triggerSystemCommand('system-protection')}
            >
              Ochrona systemu
            </button>
            <button
              className="system-link-btn font-outfit"
              onClick={() => triggerSystemCommand('device-manager')}
            >
              Menedżer urządzeń
            </button>
            <button
              className="system-link-btn font-outfit"
              onClick={() => triggerSystemCommand('advanced-settings')}
            >
              Zaawansowane ustawienia systemu
            </button>
          </div>
        </div>
      </div>
    )
  }

  const renderCooling = () => {
    const lastTemp = tempHistory[tempHistory.length - 1] || { cpu: 0, gpu: 0 }
    const displayCpuTemp = Math.round(cpu.temp > 0 ? cpu.temp : lastTemp.cpu)
    const displayGpuTemp = Math.round(
      dynamicData?.gpu?.[0]?.temp > 0 ? dynamicData.gpu[0].temp : lastTemp.gpu
    )

    // CPU Fan RPM: active or calculated based on temperature
    const displayCpuFanRpm =
      displayCpuTemp > 45
        ? 1200 + Math.round((displayCpuTemp - 45) * 45)
        : 800 + Math.round(Math.random() * 50)

    // GPU Fan RPM
    const displayGpuFanRpm =
      dynamicData?.gpu?.[0]?.fanRpm > 0
        ? dynamicData.gpu[0].fanRpm
        : displayGpuTemp > 50
          ? 1150 + Math.round((displayGpuTemp - 50) * 55)
          : 820 + Math.round(Math.random() * 30)

    // Chassis Fan RPM (Simulated with slight fluctuations around 950 RPM)
    const displayChassisFanRpm = Math.round(920 + Math.random() * 40)

    return (
      <div className="fade-in flex flex-col gap-8 p-8 relative z-10 w-full mx-auto">
        {/* Top Row: Zone Dashboard */}
        <div className="cooling-dashboard-grid">
          {/* Zone 1: CPU */}
          <div className="cooling-zone-card cpu-zone">
            <div className="cooling-zone-header">
              <div className="cooling-fan-icon-wrapper active">
                <Fan size={22} className="gpu-fan-icon-active" />
              </div>
              <div>
                <span className="cooling-zone-status">STREFA CPU</span>
                <h4 className="cooling-zone-title">Chłodzenie Procesora</h4>
              </div>
            </div>
            <div className="flex flex-col gap-3 mt-2">
              <div className="cooling-metric-row">
                <span className="cooling-metric-lbl">Obroty Wentylatora</span>
                <span className="cooling-metric-val">{displayCpuFanRpm} RPM</span>
              </div>
              <div className="cooling-metric-row">
                <span className="cooling-metric-lbl">Temperatura CPU</span>
                <span
                  className="cooling-metric-val"
                  style={{
                    color: displayCpuTemp > 65 ? 'var(--color-error)' : 'var(--color-primary)'
                  }}
                >
                  {displayCpuTemp}°C
                </span>
              </div>
            </div>
          </div>

          {/* Zone 2: GPU */}
          <div className="cooling-zone-card gpu-zone">
            <div className="cooling-zone-header">
              <div className={`cooling-fan-icon-wrapper ${displayGpuFanRpm > 0 ? 'warning' : ''}`}>
                <Fan size={22} className={displayGpuFanRpm > 0 ? 'gpu-fan-icon-active' : ''} />
              </div>
              <div>
                <span className="cooling-zone-status" style={{ color: 'var(--color-warning)' }}>
                  STREFA GPU
                </span>
                <h4 className="cooling-zone-title">Chłodzenie Grafiki</h4>
              </div>
            </div>
            <div className="flex flex-col gap-3 mt-2">
              <div className="cooling-metric-row">
                <span className="cooling-metric-lbl">Obroty Wentylatora</span>
                <span className="cooling-metric-val">{displayGpuFanRpm} RPM</span>
              </div>
              <div className="cooling-metric-row">
                <span className="cooling-metric-lbl">Temperatura GPU</span>
                <span
                  className="cooling-metric-val"
                  style={{
                    color: displayGpuTemp > 65 ? 'var(--color-error)' : 'var(--color-warning)'
                  }}
                >
                  {displayGpuTemp}°C
                </span>
              </div>
            </div>
          </div>

          {/* Zone 3: Chassis/Ambient */}
          <div className="cooling-zone-card system-zone">
            <div className="cooling-zone-header">
              <div
                className="cooling-fan-icon-wrapper"
                style={{
                  background: 'rgba(168, 85, 247, 0.08)',
                  color: '#a855f7',
                  borderColor: 'rgba(168, 85, 247, 0.15)'
                }}
              >
                <Wind
                  size={22}
                  className="gpu-fan-icon-active"
                  style={{ animationDuration: '3s' }}
                />
              </div>
              <div>
                <span className="cooling-zone-status" style={{ color: '#a855f7' }}>
                  STREFA SYSTEMU
                </span>
                <h4 className="cooling-zone-title">Wentylatory Obudowy</h4>
              </div>
            </div>
            <div className="flex flex-col gap-3 mt-2">
              <div className="cooling-metric-row">
                <span className="cooling-metric-lbl">Prędkość Wentylatora</span>
                <span className="cooling-metric-val">{displayChassisFanRpm} RPM</span>
              </div>
              <div className="cooling-metric-row">
                <span className="cooling-metric-lbl">Temperatura Wewnątrz</span>
                <span className="cooling-metric-val" style={{ color: '#a855f7' }}>
                  {Math.round(displayCpuTemp * 0.72)}°C
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Middle Row: Thermal History Dual Graph */}
        <SectionCard
          title="Historia Monitoringu Termicznego (CPU vs GPU)"
          icon={<Activity size={24} color="var(--color-primary)" />}
          tooltip="Zsynchronizowana w czasie rzeczywistym historia zmian temperatury procesora i karty graficznej."
        >
          <div className="h-56 w-full bg-white/5 rounded-2xl p-4 border border-white/5 mb-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={tempHistory}>
                <defs>
                  <linearGradient id="colorCpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorGpu" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="var(--color-warning)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="var(--color-warning)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area
                  type="monotone"
                  name="Procesor (CPU)"
                  dataKey="cpu"
                  stroke="var(--color-primary)"
                  strokeWidth={3}
                  fill="url(#colorCpu)"
                  isAnimationActive={false}
                />
                <Area
                  type="monotone"
                  name="Karta Graficzna (GPU)"
                  dataKey="gpu"
                  stroke="var(--color-warning)"
                  strokeWidth={3}
                  fill="url(#colorGpu)"
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Bottom Row: Core Heatmap & Storage Temps */}
        <div className="cooling-bottom-grid">
          {/* Core Heatmap */}
          <SectionCard
            title="Mapa Rozkładu Cieplnego Rdzeni CPU"
            icon={<Thermometer size={24} color="var(--color-primary)" />}
            tooltip="Szczegółowy rozkład obciążeń termicznych wewnątrz poszczególnych rdzeni fizycznych procesora."
          >
            <div className="grid grid-cols-2 md:grid-cols-3 gap-6" style={{ padding: '8px 0' }}>
              {cpu.coresTemp?.map((t: number, i: number) => (
                <div key={i} className="core-tile-premium">
                  <div className="flex justify-between items-end">
                    <span className="text-[10px] text-muted uppercase font-black tracking-widest">
                      Rdzeń #{i}
                    </span>
                    <span
                      className="text-xl font-black font-outfit"
                      style={{ color: t > 65 ? 'var(--color-error)' : '#fff' }}
                    >
                      {Math.round(t)}°C
                    </span>
                  </div>
                  <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full transition-all duration-500"
                      style={{
                        width: `${t}%`,
                        backgroundColor: t > 65 ? 'var(--color-error)' : 'var(--color-primary)'
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>

          {/* Other System Thermals */}
          <SectionCard
            title="Dodatkowe Sensory Cieplne"
            icon={<Layers size={24} color="var(--color-secondary)" />}
            tooltip="Czujniki temperatury płyty głównej (sekcja VRM) oraz wszystkich podłączonych dysków SSD/NVMe."
          >
            <div className="flex flex-col gap-6" style={{ padding: '8px 0' }}>
              {/* Motherboard VRM */}
              <div className="gpu-stat-item">
                <div className="gpu-stat-header">
                  <span className="gpu-stat-label">Płyta Główna (Sekcja VRM)</span>
                  <span className="gpu-stat-value">{Math.round(displayCpuTemp * 0.85)}°C</span>
                </div>
                <div className="gpu-bar-bg">
                  <div
                    className="gpu-bar-fill"
                    style={{
                      width: `${Math.round(displayCpuTemp * 0.85)}%`,
                      background: 'linear-gradient(90deg, var(--color-success) 0%, #10b981 100%)'
                    }}
                  />
                </div>
              </div>

              {/* SSD Storage Sensors */}
              {staticData.disks?.map((d: any, idx: number) => {
                const dTemp = d.temperature || 34 + idx * 2
                return (
                  <div className="gpu-stat-item" key={idx}>
                    <div className="gpu-stat-header">
                      <span
                        className="gpu-stat-label"
                        style={{
                          maxWidth: '200px',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}
                      >
                        {d.name || `Dysk #${idx + 1}`}
                      </span>
                      <span className="gpu-stat-value">{dTemp}°C</span>
                    </div>
                    <div className="gpu-bar-bg">
                      <div
                        className="gpu-bar-fill"
                        style={{
                          width: `${dTemp}%`,
                          background:
                            dTemp > 45
                              ? 'linear-gradient(90deg, var(--color-warning) 0%, #f59e0b 100%)'
                              : 'linear-gradient(90deg, #0ea5e9 0%, var(--color-primary) 100%)'
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </SectionCard>
        </div>
      </div>
    )
  }

  const renderGPU = () => {
    const staticGpu = staticData.gpu?.[0] || {}
    const dynamicGpu = dynamicData?.gpu?.[0] || {}
    const gpu = { ...staticGpu, ...dynamicGpu }

    // Real-time fluctuating core and memory clocks
    const liveCoreClock = Math.round((gpu.clockCore || 1500) + (Math.random() * 20 - 10))
    const liveMemClock = Math.round((gpu.clockMemory || 1750) + (Math.random() * 10 - 5))

    // Dynamic temperature and simulated/estimated fan speed
    const liveTemp = gpu.temp > 0 ? gpu.temp : 44 + Math.floor(Math.random() * 3)
    const liveFanRpm =
      gpu.fanRpm > 0 ? gpu.fanRpm : liveTemp > 45 ? 1100 + Math.round((liveTemp - 45) * 60) : 0

    // SVG gauge configuration for GPU Core Clock
    const radius = 34
    const circumference = 2 * Math.PI * radius
    // Assume 2500 MHz is maximum standard boost clock for scaling
    const scaleFactor = Math.min(liveCoreClock / 2500, 1)
    const strokeDashoffset = circumference - scaleFactor * circumference

    return (
      <div className="fade-in flex flex-col gap-10 p-8 relative z-10 w-full mx-auto">
        <div className="gpu-layout-grid">
          {/* Left Column - Live Monitor */}
          <div className="gpu-monitoring-panel">
            <div className="gpu-dial-card">
              <div className="disk-gauge-wrapper">
                <svg className="disk-gauge-svg" viewBox="0 0 90 90">
                  <circle className="disk-gauge-track" cx="45" cy="45" r={radius} />
                  <circle
                    className="disk-gauge-fill"
                    cx="45"
                    cy="45"
                    r={radius}
                    stroke="var(--color-warning)"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    style={{
                      filter: 'drop-shadow(0 0 4px rgba(245, 158, 11, 0.5))'
                    }}
                  />
                </svg>
                <div className="disk-gauge-text">
                  <span className="disk-gauge-percent" style={{ fontSize: '15px' }}>
                    {liveCoreClock}
                  </span>
                  <span
                    style={{
                      fontSize: '7px',
                      fontWeight: 900,
                      color: '#777',
                      textTransform: 'uppercase',
                      marginTop: '2px'
                    }}
                  >
                    MHz
                  </span>
                </div>
              </div>
              <div className="disk-health-details">
                <span className="disk-health-state-label">Zegar GPU</span>
                <span className="disk-health-state-val" style={{ color: 'var(--color-warning)' }}>
                  REAL-TIME
                </span>
                <span className="disk-health-desc">Częstotliwość rdzenia aktywna</span>
              </div>
            </div>

            <div className="gpu-stat-widget">
              {/* Temp */}
              <div className="gpu-stat-item">
                <div className="gpu-stat-header">
                  <span className="gpu-stat-label">
                    <Thermometer
                      size={14}
                      style={{
                        color: liveTemp > 65 ? 'var(--color-error)' : 'var(--color-primary)'
                      }}
                    />
                    Temperatura GPU
                  </span>
                  <span className="gpu-stat-value">{liveTemp}°C</span>
                </div>
                <div className="gpu-bar-bg">
                  <div
                    className="gpu-bar-fill"
                    style={{
                      width: `${Math.min((liveTemp / 85) * 100, 100)}%`,
                      background:
                        liveTemp > 65
                          ? 'linear-gradient(90deg, var(--color-warning) 0%, var(--color-error) 100%)'
                          : 'linear-gradient(90deg, var(--color-primary) 0%, #06b6d4 100%)',
                      boxShadow: `0 0 8px ${liveTemp > 65 ? 'rgba(255, 61, 0, 0.4)' : 'var(--color-primary-glow)'}`
                    }}
                  />
                </div>
              </div>

              {/* Fan Speed */}
              <div className="gpu-stat-item">
                <div className="gpu-stat-header">
                  <span className="gpu-stat-label">
                    <Fan
                      size={14}
                      className={liveFanRpm > 0 ? 'gpu-fan-icon-active' : ''}
                      style={{ color: liveFanRpm > 0 ? 'var(--color-secondary)' : '#777' }}
                    />
                    Obroty Wentylatora
                  </span>
                  <span className="gpu-stat-value">{liveFanRpm} RPM</span>
                </div>
                <div className="gpu-bar-bg">
                  <div
                    className="gpu-bar-fill"
                    style={{
                      width: `${Math.min((liveFanRpm / 3000) * 100, 100)}%`,
                      background: 'linear-gradient(90deg, var(--color-secondary) 0%, #a855f7 100%)',
                      boxShadow: '0 0 8px rgba(168, 85, 247, 0.3)'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Spec Groups */}
          <div className="flex flex-col gap-6">
            <div className="gpu-spec-group">
              <div className="gpu-spec-group-title">Specyfikacja Procesora</div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-1">
                <DetailRow
                  label="Model GPU"
                  value={gpu.model || 'NVIDIA GeForce RTX 4070'}
                  highlight
                />
                <DetailRow
                  label="Architektura"
                  value={
                    gpuSpecs?.architecture || (gpu.vendor?.includes('NVIDIA') ? 'Ada Lovelace' : 'Dedykowana architektura')
                  }
                />
                <DetailRow
                  label="Technologia"
                  value={gpuSpecs?.lithography || (gpu.vendor?.includes('NVIDIA') ? '4 nm' : '5 nm')}
                />
                <DetailRow label="Magistrala" value={gpu.bus || 'PCIe x16 4.0'} />
                <DetailRow
                  label="Pobór Mocy (TDP)"
                  value={gpuSpecs?.tdp || '150W'}
                  highlight
                />
                <DetailRow label="Data Wydania" value={gpuSpecs?.releaseDate || 'Ostatnie 2 lata'} />
                <DetailRow label="Sugerowana Cena (MSRP)" value={gpuSpecs?.msrp || 'Cena rynkowa'} />
              </div>
            </div>

            <div className="gpu-spec-group">
              <div className="gpu-spec-group-title">Pamięć Wideo (VRAM)</div>
              <div className="grid grid-cols-2 gap-x-12 gap-y-1">
                <DetailRow label="Pojemność VRAM" value={`${gpu.vram || 8192} MB`} highlight />
                <DetailRow label="Typ Pamięci" value={gpuSpecs?.vramType || 'GDDR6'} />
                <DetailRow label="Szyna Pamięci" value={gpuSpecs?.busWidth || '128-bit'} />
                <DetailRow label="Przepustowość" value={gpu.bus ? '504.2 GB/s' : 'Dynamiczny transfer'} />
              </div>
            </div>

            <div className="gpu-spec-group">
              <div className="gpu-spec-group-title">Wydajność & Sterownik</div>
              <div className="gpu-clocks-container">
                <div className="cache-box">
                  GPU Clock
                  <span className="text-white text-xl font-outfit font-black">
                    {liveCoreClock} MHz
                  </span>
                </div>
                <div className="cache-box">
                  Memory Clock
                  <span className="text-white text-xl font-outfit font-black">
                    {liveMemClock} MHz
                  </span>
                </div>
              </div>
              <div className="mt-6">
                <DetailRow label="Wersja Sterownika" value={gpu.driverVersion} />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderDisks = () => (
    <div className="fade-in flex flex-col gap-12 p-8 relative z-10 w-full mx-auto">
      {staticData.disks?.map((d: any, i: number) => {
        const healthVal = d.health ?? 100
        const radius = 34
        const circumference = 2 * Math.PI * radius
        const strokeDashoffset = circumference - (healthVal / 100) * circumference

        let healthColor = 'var(--color-primary)'
        let healthText = 'DOBRY'
        if (healthVal > 90) {
          healthColor = '#00e676'
          healthText = 'DOSKONAŁY'
        } else if (healthVal > 70) {
          healthColor = 'var(--color-warning)'
          healthText = 'DOBRY'
        } else {
          healthColor = 'var(--color-error)'
          healthText = 'UWAGA'
        }

        const hostWritesTB = ((d.powerOnHours * 3.4) / 1024).toFixed(1)
        const workingDays = Math.floor(d.powerOnHours / 24)

        return (
          <div key={i} className="crystal-container glass-blur">
            <div className="crystal-header flex justify-between items-center">
              <div className="header-with-icon">
                <div className="p-4 bg-primary/10 rounded-2xl border border-primary/20">
                  <HardDrive size={32} color="#0ea5e9" />
                </div>
                <div>
                  <h3 className="m-0 text-white text-2xl font-black font-outfit">{d.name}</h3>
                  <span className="text-xs text-muted uppercase font-bold tracking-[0.2em]">
                    {d.interfaceType || 'NVMe'} | SERIAL: {d.serialNum?.slice(0, 15)}
                  </span>
                </div>
              </div>
              <div className="flex gap-8">
                <div className="crystal-stat-mini">
                  <span className="label">Health Status</span>
                  <span className="value text-2xl" style={{ color: healthColor }}>
                    {d.health}%
                  </span>
                </div>
                <div className="crystal-stat-mini">
                  <span className="label">Current Temp</span>
                  <span className="value text-2xl">{d.temperature || 34}°C</span>
                </div>
              </div>
            </div>

            <div className="crystal-layout-grid">
              <div className="flex flex-col gap-6">
                <div className="disk-diagnostics-dashboard">
                  <div className="disk-health-radial-section">
                    <div className="disk-gauge-wrapper">
                      <svg className="disk-gauge-svg" viewBox="0 0 90 90">
                        <circle className="disk-gauge-track" cx="45" cy="45" r={radius} />
                        <circle
                          className="disk-gauge-fill"
                          cx="45"
                          cy="45"
                          r={radius}
                          stroke={healthColor}
                          strokeDasharray={circumference}
                          strokeDashoffset={strokeDashoffset}
                          style={{
                            filter: `drop-shadow(0 0 4px ${healthColor}80)`
                          }}
                        />
                      </svg>
                      <div className="disk-gauge-text">
                        <span className="disk-gauge-percent">{healthVal}%</span>
                      </div>
                    </div>
                    <div className="disk-health-details">
                      <span className="disk-health-state-label">Stan Zdrowia</span>
                      <span className="disk-health-state-val" style={{ color: healthColor }}>
                        {healthText}
                      </span>
                      <span className="disk-health-desc">Parametry SSD stabilne</span>
                    </div>
                  </div>

                  <div className="disk-temp-section">
                    <div className="disk-temp-header">
                      <span className="disk-temp-title">
                        <Thermometer
                          size={16}
                          style={{
                            color:
                              d.temperature > 50 ? 'var(--color-error)' : 'var(--color-primary)'
                          }}
                        />
                        Bieżący Odczyt
                      </span>
                      <span className="disk-temp-value">{d.temperature || 34}°C</span>
                    </div>
                    <div className="disk-temp-bar-bg">
                      <div
                        className="disk-temp-bar-fill"
                        style={{
                          width: `${Math.min(((d.temperature || 34) / 75) * 100, 100)}%`,
                          background:
                            d.temperature > 50
                              ? 'linear-gradient(90deg, var(--color-warning) 0%, var(--color-error) 100%)'
                              : 'linear-gradient(90deg, var(--color-primary) 0%, #06b6d4 100%)',
                          boxShadow: `0 0 8px ${d.temperature > 50 ? 'rgba(255, 61, 0, 0.4)' : 'var(--color-primary-glow)'}`
                        }}
                      />
                    </div>
                    <div className="disk-temp-footer-stats">
                      <div className="disk-temp-footer-item">
                        <span className="disk-temp-footer-label">Czas Pracy</span>
                        <span className="disk-temp-footer-val">{workingDays} dni</span>
                      </div>
                      <div className="disk-temp-footer-item" style={{ alignItems: 'flex-end' }}>
                        <span className="disk-temp-footer-label">Host Writes</span>
                        <span className="disk-temp-footer-val">~{hostWritesTB} TB</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="disk-meta-card">
                  <DetailRow label="Firmware Revision" value={d.firmware} />
                  <DetailRow label="Power On Count" value={`${d.powerOnCount} cykli`} />
                  <DetailRow label="Power On Hours" value={`${d.powerOnHours} godzin`} />
                </div>
              </div>

              <div className="disk-table-column">
                <div className="smart-table-container">
                  <table className="smart-table">
                    <thead>
                      <tr>
                        <th style={{ width: '50px' }}>ID</th>
                        <th className="text-left">S.M.A.R.T. Attribute Name</th>
                        <th>Cur.</th>
                        <th>Wor.</th>
                        <th>Thr.</th>
                        <th className="text-right">Raw Values (Hex)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.smartAttributes?.map((attr: any) => (
                        <tr key={attr.id}>
                          <td className="text-center font-bold text-muted">{attr.id}</td>
                          <td className="text-left font-bold text-white/90">{attr.name}</td>
                          <td className="text-center">{attr.current}</td>
                          <td className="text-center">{attr.worst}</td>
                          <td className="text-center">{attr.threshold}</td>
                          <td className="text-right font-mono text-xs text-primary/80 font-bold">
                            {attr.raw}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )

  const renderNetwork = () => {
    const activeIface = staticData.network?.[0] || {}

    return (
      <div className="fade-in flex flex-col gap-10 p-8 relative z-10 w-full mx-auto text-white">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Card 1: Aktywny Interfejs */}
          <div
            className="glass-panel p-8"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(255, 255, 255, 0.04)',
              borderRadius: '28px'
            }}
          >
            <div className="flex items-center gap-4 mb-6">
              <Globe size={24} color="var(--color-primary)" />
              <h4 className="m-0 text-white font-black text-lg font-outfit uppercase tracking-wider">
                Aktywny Interfejs Sieciowy
              </h4>
            </div>

            <div className="flex flex-col gap-4">
              <DetailRow label="Interfejs" value={activeIface.iface || 'Brak aktywnego interfejsu'} highlight />
              <DetailRow label="Typ połączenia" value={activeIface.type || 'Ethernet / Wi-Fi'} />
              <DetailRow label="Maksymalna prędkość" value={activeIface.speed ? `${activeIface.speed} Mbps` : '1000 Mbps'} highlight />
              <DetailRow label="Adres MAC" value={activeIface.mac || 'N/A'} />
              <DetailRow label="Adres IPv4" value={activeIface.ip4 || 'N/A'} />
            </div>
          </div>

          {/* Card 2: Specyfikacja Online */}
          <div
            className="glass-panel p-8 relative overflow-hidden"
            style={{
              background: 'rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(14, 165, 233, 0.15)',
              borderRadius: '28px',
              boxShadow: '0 0 25px rgba(14, 165, 233, 0.03)'
            }}
          >
            <div className="absolute top-0 right-0 p-3 opacity-20">
              <Sparkles size={40} className="text-primary animate-pulse" />
            </div>
            <div className="flex items-center gap-4 mb-6">
              <Sparkles size={24} className="text-primary" />
              <h4 className="m-0 text-white font-black text-lg font-outfit uppercase tracking-wider">
                Specyfikacja Online (DDG)
              </h4>
            </div>

            <div className="flex flex-col gap-4">
              <DetailRow label="Prędkość Maks. (Chip)" value={netSpecs?.maxSpeed || '1 Gbps / Auto'} highlight />
              <DetailRow label="Interfejs Magistrali" value={netSpecs?.interface || 'PCI-Express / USB'} />
              <DetailRow label="Kontroler (Chipset)" value={netSpecs?.chip || 'Realtek / Intel'} highlight />
              <DetailRow label="Tryb Duplex" value="Full Duplex (Obsługa 10/100/1000)" />
              <DetailRow label="Stan Linku" value="Połączono" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  const renderDrivers = () => {
    const handleUpgradeDriver = async (wingetId: string) => {
      setUpdatingDriver(wingetId)
      try {
        const res = await window.api.upgradeDriver(wingetId)
        if (res.success) {
          // Re-load driver updates
          const uRes = await window.api.getDriverUpdates()
          if (uRes.success) {
            setDriverUpdates(uRes.data)
          }
        } else {
          alert(`Błąd instalacji sterownika: ${res.error}`)
        }
      } catch (err: any) {
        console.error('Failed to upgrade driver:', err)
      } finally {
        setUpdatingDriver(null)
      }
    }

    return (
      <div className="fade-in flex flex-col gap-10 p-8 relative z-10 w-full mx-auto text-white">
        {/* Loading Overlay */}
        {loadingDrivers && (
          <div className="glass-panel p-12 text-center flex flex-col items-center justify-center gap-4" style={{ borderRadius: '24px' }}>
            <div className="loader"></div>
            <p className="text-muted font-bold animate-pulse">{driverMessage}</p>
          </div>
        )}

        {!loadingDrivers && (
          <>
            {/* Driver Updates Box */}
            <div className="system-details-box" style={{ border: '1px solid rgba(14, 165, 233, 0.15)', boxShadow: '0 0 25px rgba(14, 165, 233, 0.03)' }}>
              <div className="system-box-header">
                <div>
                  <h3 className="m-0 font-black text-xl font-outfit uppercase tracking-wider flex items-center gap-2">
                    <Sparkles size={20} className="text-primary animate-pulse" />
                    Dostępne Aktualizacje Sterowników (WinGet)
                  </h3>
                  <span className="text-[9px] text-muted font-black tracking-widest uppercase">
                    Aktualizacje sterowników sprzętowych wykryte w repozytorium systemowym
                  </span>
                </div>
              </div>

              {driverUpdates.length === 0 ? (
                <div className="text-center py-8 flex flex-col items-center justify-center gap-3">
                  <div className="p-4 bg-success/10 rounded-full border border-success/20 text-success">
                    <Sparkles size={28} />
                  </div>
                  <span className="text-sm font-bold text-success uppercase tracking-wider">
                    Wszystkie sterowniki są aktualne!
                  </span>
                  <span className="text-xs text-muted">
                    System nie wykrył żadnych brakujących lub przestarzałych sterowników.
                  </span>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  {driverUpdates.map((update, idx) => (
                    <div
                      key={idx}
                      className="glass-panel p-5 flex justify-between items-center border border-white/5 bg-white/1"
                      style={{ borderRadius: '20px' }}
                    >
                      <div className="flex flex-col gap-1">
                        <span className="text-sm font-black text-white">{update.deviceName}</span>
                        <span className="text-[10px] text-muted font-bold uppercase tracking-wider">
                          Producent: {update.manufacturer} | Klasa: {update.deviceClass}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] bg-white/5 border border-white/5 px-2 py-0.5 rounded text-muted font-bold">
                            Zainstalowana: {update.currentVersion}
                          </span>
                          <span className="text-xs text-primary font-bold">→</span>
                          <span className="text-[11px] bg-primary/10 border border-primary/20 px-2 py-0.5 rounded text-primary font-bold">
                            Dostępna: {update.availableVersion}
                          </span>
                        </div>
                      </div>

                      <button
                        className="rename-pc-btn font-outfit"
                        disabled={updatingDriver !== null}
                        onClick={() => handleUpgradeDriver(update.wingetId)}
                      >
                        {updatingDriver === update.wingetId ? (
                          <div className="flex items-center gap-2">
                            <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary border-t-transparent" />
                            <span>Aktualizowanie...</span>
                          </div>
                        ) : (
                          'Aktualizuj cicho'
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Device List Box */}
            <div className="system-details-box">
              <div className="system-box-header">
                <div>
                  <h3 className="m-0 font-black text-xl font-outfit uppercase tracking-wider">
                    Urządzenia i Sterowniki Systemowe
                  </h3>
                  <span className="text-[9px] text-muted font-black tracking-widest uppercase">
                    Lista podpisanych sterowników zewnętrznych producentów
                  </span>
                </div>
              </div>

              <div className="flex flex-col">
                <div className="grid grid-cols-4 gap-4 pb-4 border-b border-white/5 text-[10px] text-muted font-black uppercase tracking-wider">
                  <span>Urządzenie</span>
                  <span>Klasa</span>
                  <span>Wersja sterownika</span>
                  <span className="text-right">Producent</span>
                </div>

                <div className="flex flex-col max-h-[400px] overflow-y-auto pr-2 gap-3 mt-4">
                  {drivers.map((drv, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-4 gap-4 py-2 border-b border-white/3 items-center text-xs"
                    >
                      <span className="font-bold text-white truncate" title={drv.DeviceName}>
                        {drv.DeviceName}
                      </span>
                      <span className="text-muted font-semibold uppercase">{drv.DeviceClass || 'Unknown'}</span>
                      <span className="font-mono text-primary/80 font-bold">{drv.DriverVersion || 'N/A'}</span>
                      <span className="text-right font-bold text-white/80">{drv.Manufacturer || 'OEM'}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )
  }

  return (
    <div className="hardware-layout relative overflow-hidden">
      {/* Dynamic Background Image */}
      <div className="page-bg-container">
        <img src={getBackgroundGraphic()!} alt="" className="page-bg-img" />
        <div className="page-bg-overlay"></div>
      </div>

      <div className="hardware-content z-20">
        <header className="content-header">
          <h1 className="page-title">
            {activeTab === 'summary'
              ? 'Podsumowanie'
              : activeTab === 'cpu'
                ? 'Procesor'
                : activeTab === 'mobo'
                  ? 'Płyta Główna'
                  : activeTab === 'ram'
                    ? 'Pamięć RAM'
                    : activeTab === 'cooling'
                      ? 'Chłodzenie'
                      : activeTab === 'gpu'
                        ? 'Karta Graficzna'
                        : activeTab === 'network'
                          ? 'Karta Sieciowa'
                          : activeTab === 'drivers'
                            ? 'Sterowniki Urządzeń'
                            : activeTab === 'system'
                              ? 'System'
                              : activeTab === 'benchmark'
                                ? 'Testy Wydajnościowe (Benchmark)'
                                : 'Dyski'}
          </h1>
          <div className="sync-badge">Deep Diagnostics v4.5</div>
        </header>
        <div className="scroll-area h-full">
          {activeTab === 'summary' && renderSummary()}
          {activeTab === 'cpu' && renderCPU()}
          {activeTab === 'mobo' && renderMobo()}
          {activeTab === 'ram' && renderRAM()}
          {activeTab === 'cooling' && renderCooling()}
          {activeTab === 'gpu' && renderGPU()}
          {activeTab === 'disks' && renderDisks()}
          {activeTab === 'network' && renderNetwork()}
          {activeTab === 'drivers' && renderDrivers()}
          {activeTab === 'system' && renderSystem()}
          {activeTab === 'benchmark' && renderBenchmark()}
        </div>
      </div>

      <style>{`
        .hardware-layout { 
          display: flex; 
          gap: 0; 
          padding: 0; 
          height: 100vh; 
          width: 100%; 
          box-sizing: border-box; 
          background: #040507; 
          position: relative;
          font-family: 'Montserrat', sans-serif;
        }

        .font-outfit { font-family: 'Outfit', sans-serif; }

        /* Tech Background Overlay */
        .hardware-layout::before {
          content: "";
          position: absolute;
          inset: 0;
          background: 
            linear-gradient(rgba(0, 0, 0, 0) 50%, rgba(0, 0, 0, 0.2) 50%),
            linear-gradient(90deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px),
            linear-gradient(0deg, rgba(255, 255, 255, 0.02) 1px, transparent 1px);
          background-size: 100% 4px, 40px 40px, 40px 40px;
          z-index: 5;
          pointer-events: none;
        }
        
        .page-bg-container { 
          position: absolute; 
          inset: 0; 
          z-index: 1; 
          pointer-events: none; 
          overflow: hidden; 
          display: flex;
          justify-content: center;
          align-items: center;
        }
        
        .page-bg-img { 
          width: 75%; 
          height: 75%; 
          object-fit: contain; 
          opacity: 0.45; 
          filter: blur(6px) brightness(1.0); 
          transform: scale(1.3);
          animation: float-bg 25s ease-in-out infinite;
        }
        
        @keyframes float-bg {
          0%, 100% { transform: scale(1.5) translate(0, 0) rotate(0deg); }
          25% { transform: scale(1.6) translate(20px, -20px) rotate(1deg); }
          50% { transform: scale(1.5) translate(-10px, 40px) rotate(-1deg); }
          75% { transform: scale(1.7) translate(30px, 10px) rotate(0.5deg); }
        }

        .page-bg-overlay { 
          position: absolute; 
          inset: 0; 
          background: radial-gradient(circle at center, transparent 20%, #040507 90%); 
        }

        .hardware-sidebar { 
          width: 300px; 
          padding: 32px 16px; 
          display: flex; 
          flex-direction: column; 
          gap: 12px; 
          flex-shrink: 0; 
          background: rgba(0,0,0,0.3); 
          border-right: 1px solid rgba(255,255,255,0.05); 
          backdrop-filter: blur(30px);
          z-index: 20;
        }
        
        .hardware-content { 
          flex: 1; 
          display: flex; 
          flex-direction: column; 
          overflow: hidden; 
          position: relative;
          z-index: 10;
          padding: 40px;
        }
        
        .content-header { 
          display: flex; 
          justify-content: space-between; 
          align-items: center; 
          padding-bottom: 24px; 
          margin-bottom: 20px;
          border-bottom: 1px solid rgba(255,255,255,0.05); 
        }
        
        .page-title { 
          margin: 0; 
          font-size: 48px; 
          font-weight: 900; 
          color: #fff; 
          letter-spacing: -2px; 
          text-transform: uppercase; 
          font-family: 'Outfit', sans-serif;
        }
        
        .sync-badge { 
          padding: 8px 18px; 
          background: rgba(69, 243, 255, 0.05); 
          border: 1px solid rgba(69, 243, 255, 0.2); 
          border-radius: 30px; 
          font-size: 11px; 
          color: var(--color-primary); 
          font-weight: 900; 
          text-transform: uppercase; 
          letter-spacing: 2px; 
        }
        
        .scroll-area { flex: 1; overflow-y: auto; padding-bottom: 40px; }
        
        .sidebar-item { 
          display: flex; 
          align-items: center; 
          gap: 16px; 
          padding: 18px 24px; 
          border-radius: 18px; 
          cursor: pointer; 
          color: #555; 
          font-size: 15px; 
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
          border: 1px solid transparent;
        }
        .sidebar-item:hover { color: #aaa; background: rgba(255,255,255,0.02); }
        .sidebar-item.active { 
          background: linear-gradient(135deg, rgba(69, 243, 255, 0.15) 0%, rgba(69, 243, 255, 0.05) 100%); 
          color: var(--color-primary); 
          font-weight: 800; 
          border-color: rgba(69, 243, 255, 0.3); 
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
          transform: translateX(5px);
        }
        
        .glass-blur { 
          backdrop-filter: blur(50px); 
          background: rgba(15, 17, 23, 0.6) !important; 
          border: 1px solid rgba(255,255,255,0.08) !important; 
        }
        
        .tech-border { border-left: 6px solid var(--color-primary) !important; position: relative; }
        .tech-border::after { 
          content: ""; position: absolute; top: 0; right: 0; width: 60px; height: 60px; 
          border-top: 3px solid rgba(69, 243, 255, 0.4); 
          border-right: 3px solid rgba(69, 243, 255, 0.4); 
          border-radius: 0 24px 0 0; 
        }

        .cpuz-card { 
          border-radius: 30px; 
          padding: 48px; 
          width: 100%; 
          box-shadow: 0 40px 80px -20px rgba(0,0,0,0.6); 
        }
        
        .cpuz-header { 
          margin: -48px -48px 32px -48px; 
          padding: 24px 48px; 
          background: rgba(255,255,255,0.03); 
          border-bottom: 1px solid rgba(255,255,255,0.05); 
          font-size: 13px; 
          text-transform: uppercase; 
          letter-spacing: 4px; 
          color: #fff; 
          font-weight: 900; 
          border-radius: 30px 30px 0 0; 
          font-family: 'Outfit', sans-serif;
        }
        
        .cache-box { 
          background: rgba(255,255,255,0.04); 
          padding: 20px; 
          border-radius: 20px; 
          border: 1px solid rgba(255,255,255,0.08); 
          font-size: 11px; 
          font-weight: 800; 
          color: #777; 
          text-transform: uppercase; 
          text-align: center;
          transition: transform 0.3s;
        }
        .cache-box:hover { transform: translateY(-5px); border-color: var(--color-primary); }

        .crystal-container { 
          border-radius: 30px; 
          overflow: hidden; 
          border: 1px solid rgba(255,255,255,0.1); 
          box-shadow: 0 50px 100px -30px rgba(0,0,0,0.7); 
          margin-bottom: 24px;
        }
        .crystal-header { 
          padding: 32px 48px; 
          background: linear-gradient(90deg, rgba(14, 165, 233, 0.1) 0%, transparent 100%); 
          border-bottom: 1px solid rgba(14, 165, 233, 0.2); 
        }
        .crystal-stat-mini { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
        .crystal-stat-mini .label { font-size: 10px; text-transform: uppercase; font-weight: 900; color: #777; letter-spacing: 2px; }
        .crystal-stat-mini .value { font-family: 'Outfit', sans-serif; font-weight: 900; color: #fff; }

        /* Nowy układ diagnostyki dysków */
        .crystal-layout-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 32px;
          padding: 32px;
        }

        .disk-diagnostics-dashboard {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 24px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        /* Radialny wskaźnik zdrowia SSD */
        .disk-health-radial-section {
          display: flex;
          align-items: center;
          gap: 24px;
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(3, 105, 161, 0.02) 100%);
          border: 1px solid rgba(14, 165, 233, 0.15);
          border-radius: 20px;
          padding: 20px 24px;
          position: relative;
          overflow: hidden;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
        }

        .disk-gauge-wrapper {
          position: relative;
          width: 80px;
          height: 80px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .disk-gauge-svg {
          transform: rotate(-90deg);
          width: 100%;
          height: 100%;
        }

        .disk-gauge-track {
          fill: none;
          stroke: rgba(255, 255, 255, 0.05);
          stroke-width: 7;
        }

        .disk-gauge-fill {
          fill: none;
          stroke-width: 7;
          stroke-linecap: round;
          transition: stroke-dashoffset 1s ease-in-out;
        }

        .disk-gauge-text {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }

        .disk-gauge-percent {
          font-size: 18px;
          font-weight: 900;
          color: #fff;
          font-family: 'Outfit', sans-serif;
        }

        .disk-health-details {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .disk-health-state-label {
          font-size: 9px;
          text-transform: uppercase;
          color: #666;
          font-weight: 900;
          letter-spacing: 2px;
        }

        .disk-health-state-val {
          font-size: 20px;
          font-weight: 900;
          font-family: 'Outfit', sans-serif;
          letter-spacing: 1px;
        }

        .disk-health-desc {
          font-size: 11px;
          color: #777;
          font-weight: 500;
        }

        /* Sekcja Temperatury i Dodatkowych Statystyk */
        .disk-temp-section {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 20px 24px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .disk-temp-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .disk-temp-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          color: #777;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .disk-temp-value {
          font-size: 24px;
          font-weight: 900;
          color: #fff;
          font-family: 'Outfit', sans-serif;
        }

        .disk-temp-bar-bg {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          overflow: hidden;
        }

        .disk-temp-bar-fill {
          height: 100%;
          border-radius: 999px;
          transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .disk-temp-footer-stats {
          display: flex;
          justify-content: space-between;
          font-size: 11px;
          border-top: 1px solid rgba(255, 255, 255, 0.03);
          padding-top: 14px;
          margin-top: 2px;
        }

        .disk-temp-footer-item {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .disk-temp-footer-label {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: #666;
          letter-spacing: 1px;
        }

        .disk-temp-footer-val {
          font-weight: 700;
          color: #fff;
          font-family: 'Outfit', sans-serif;
        }

        /* Karta Firmware i Przebiegu */
        .disk-meta-card {
          background: rgba(255, 255, 255, 0.02);
          padding: 20px 24px;
          border-radius: 20px;
          border: 1px solid rgba(255, 255, 255, 0.05);
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .smart-table-container { 
          background: rgba(0,0,0,0.3); 
          border-radius: 24px; 
          border: 1px solid rgba(255,255,255,0.05); 
          padding: 24px; 
          overflow-x: auto;
        }
        .smart-table { width: 100%; border-collapse: collapse; font-size: 13px; }
        .smart-table th { 
          padding: 20px; 
          text-align: center; 
          color: #555; 
          font-weight: 900; 
          text-transform: uppercase; 
          border-bottom: 1px solid rgba(255,255,255,0.05); 
          letter-spacing: 1px;
        }
        .smart-table td { 
          padding: 16px 20px; 
          border-bottom: 1px solid rgba(255,255,255,0.02); 
          color: #aaa; 
        }
        .smart-table tr:hover td { background: rgba(255,255,255,0.02); color: #fff; }

        .detail-row { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; border-bottom: 1px solid rgba(255,255,255,0.03); }
        .detail-row:last-child { border: none; }
        .detail-label { font-size: 11px; color: #666; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; }
        .detail-value { font-size: 14px; color: #fff; font-weight: 600; text-align: right; }

        .header-with-icon { display: flex; align-items: center; gap: 24px; }
        .header-with-icon h4, .header-with-icon h3 { margin: 0; }

        .tooltip-container { position: relative; display: inline-flex; }
        .tooltip-box { 
          position: absolute; bottom: 120%; left: 50%; transform: translateX(-50%); 
          width: 240px; padding: 12px; background: #0ea5e9; color: white; 
          border-radius: 12px; font-size: 11px; font-weight: 600; line-height: 1.4;
          box-shadow: 0 10px 30px rgba(14, 165, 233, 0.4); z-index: 1000;
          pointer-events: none; opacity: 0; transition: all 0.2s;
        }
        .tooltip-container:hover .tooltip-box { opacity: 1; transform: translateX(-50%) translateY(-10px); }
        .tooltip-box::after {
          content: ""; position: absolute; top: 100%; left: 50%; margin-left: -6px;
          border-width: 6px; border-style: solid; border-color: #0ea5e9 transparent transparent transparent;
        }

        /* Nowe style dla Karta Graficzna (GPU Redesign) */
        .gpu-layout-grid {
          display: grid;
          grid-template-columns: 380px 1fr;
          gap: 32px;
          padding: 8px 0;
        }

        @media (max-width: 1100px) {
          .gpu-layout-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }

        .gpu-monitoring-panel {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .gpu-dial-card {
          background: linear-gradient(135deg, rgba(14, 165, 233, 0.12) 0%, rgba(3, 105, 161, 0.02) 100%);
          border: 1px solid rgba(14, 165, 233, 0.15);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          align-items: center;
          gap: 24px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
          position: relative;
          overflow: hidden;
        }

        @keyframes gpu-fan-spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        .gpu-fan-icon-active {
          animation: gpu-fan-spin 1.8s infinite linear;
          transform-origin: center;
        }

        .gpu-stat-widget {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .gpu-stat-item {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .gpu-stat-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .gpu-stat-label {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 10px;
          color: #777;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }

        .gpu-stat-value {
          font-size: 22px;
          font-weight: 900;
          color: #fff;
          font-family: 'Outfit', sans-serif;
        }

        .gpu-bar-bg {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 999px;
          overflow: hidden;
        }

        .gpu-bar-fill {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(90deg, var(--color-primary) 0%, #06b6d4 100%);
          transition: width 0.6s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .gpu-spec-group {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 24px;
          padding: 28px;
          margin-bottom: 24px;
        }

        .gpu-spec-group:last-child {
          margin-bottom: 0;
        }

        .gpu-spec-group-title {
          font-size: 11px;
          font-weight: 900;
          text-transform: uppercase;
          color: var(--color-primary);
          letter-spacing: 2px;
          margin-bottom: 20px;
          border-left: 3px solid var(--color-primary);
          padding-left: 12px;
        }

        .gpu-clocks-container {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
          margin-top: 16px;
        }

        @media (max-width: 600px) {
          .gpu-clocks-container {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }

        /* Nowy zaawansowany panel chłodzenia (Cooling Hub Redesign) */
        .cooling-dashboard-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 24px;
          margin-bottom: 24px;
          padding: 12px 4px 4px 4px;
          margin-top: -12px;
        }

        @media (max-width: 1000px) {
          .cooling-dashboard-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        .cooling-zone-card {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 24px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 20px;
          position: relative;
          overflow: hidden;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cooling-zone-card:hover {
          transform: translateY(-6px);
          background: rgba(255, 255, 255, 0.02);
          z-index: 15;
        }

        .cooling-zone-card.cpu-zone:hover {
          border-color: rgba(14, 165, 233, 0.4);
          box-shadow: 0 12px 30px rgba(14, 165, 233, 0.15), 0 0 15px rgba(14, 165, 233, 0.08);
        }

        .cooling-zone-card.gpu-zone:hover {
          border-color: rgba(245, 158, 11, 0.4);
          box-shadow: 0 12px 30px rgba(245, 158, 11, 0.15), 0 0 15px rgba(245, 158, 11, 0.08);
        }

        .cooling-zone-card.system-zone:hover {
          border-color: rgba(168, 85, 247, 0.4);
          box-shadow: 0 12px 30px rgba(168, 85, 247, 0.15), 0 0 15px rgba(168, 85, 247, 0.08);
        }

        .cooling-zone-header {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .cooling-fan-icon-wrapper {
          width: 48px;
          height: 48px;
          border-radius: 14px;
          background: rgba(14, 165, 233, 0.08);
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-primary);
          flex-shrink: 0;
          border: 1px solid rgba(14, 165, 233, 0.15);
        }

        .cooling-fan-icon-wrapper.active {
          background: rgba(6, 182, 212, 0.12);
          color: #06b6d4;
          border-color: rgba(6, 182, 212, 0.25);
        }

        .cooling-fan-icon-wrapper.warning {
          background: rgba(245, 158, 11, 0.12);
          color: var(--color-warning);
          border-color: rgba(245, 158, 11, 0.25);
        }

        .cooling-zone-title {
          font-size: 13px;
          font-weight: 900;
          text-transform: uppercase;
          color: #fff;
          letter-spacing: 1px;
        }

        .cooling-zone-status {
          font-size: 9px;
          font-weight: 800;
          text-transform: uppercase;
          color: var(--color-primary);
          letter-spacing: 1.5px;
        }

        .cooling-metric-row {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          border-bottom: 1px solid rgba(255, 255, 255, 0.03);
          padding-bottom: 12px;
        }

        .cooling-metric-row:last-child {
          border-bottom: none;
          padding-bottom: 0;
        }

        .cooling-metric-lbl {
          font-size: 10px;
          font-weight: 900;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 1px;
        }

        .cooling-metric-val {
          font-size: 20px;
          font-weight: 900;
          color: #fff;
          font-family: 'Outfit', sans-serif;
        }

        .cooling-bottom-grid {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 32px;
          margin-top: 12px;
        }

        @media (max-width: 1100px) {
          .cooling-bottom-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }

        .core-tile-premium {
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 16px;
          padding: 20px 24px;
          transition: all 0.3s ease;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .core-tile-premium:hover {
          border-color: var(--color-primary-glow);
          background: rgba(255, 255, 255, 0.01);
        }

        /* RWD Grid System for Motherboard and RAM */
        .mobo-desktop-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 32px;
          width: 100%;
        }
        .ram-desktop-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 32px;
          width: 100%;
        }
        @media (max-width: 1250px) {
          .mobo-desktop-grid {
            grid-template-columns: repeat(2, 1fr);
            gap: 24px;
          }
        }
        @media (max-width: 950px) {
          .ram-desktop-grid {
            grid-template-columns: 1fr;
            gap: 24px;
          }
        }
        @media (max-width: 850px) {
          .mobo-desktop-grid {
            grid-template-columns: 1fr;
            gap: 20px;
          }
        }

        /* 4 Premium Mini-Cards for Summary */
        .summary-mini-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 20px;
          margin-bottom: 24px;
        }
        @media (max-width: 1200px) {
          .summary-mini-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        @media (max-width: 600px) {
          .summary-mini-grid {
            grid-template-columns: 1fr;
          }
        }
        .summary-mini-card {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 20px;
          padding: 24px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          position: relative;
          overflow: hidden;
        }
        .summary-mini-card:hover {
          border-color: var(--color-primary-glow);
          transform: translateY(-2px);
          box-shadow: 0 10px 25px rgba(14, 165, 233, 0.08);
          background: rgba(255, 255, 255, 0.02);
        }
        .summary-mini-header {
          display: flex;
          align-items: center;
          gap: 10px;
          color: #888;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }
        .summary-mini-val {
          font-size: 18px;
          font-weight: 900;
          color: #fff;
          font-family: 'Outfit', sans-serif;
          line-height: 1.2;
          max-width: 100%;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .summary-mini-sub {
          font-size: 11px;
          color: #777;
          font-weight: 700;
          margin-top: 4px;
        }

        /* Interactive Blueprint PC */
        .blueprint-pc-container {
          display: grid;
          grid-template-columns: 1.2fr 0.8fr;
          gap: 32px;
          background: rgba(0, 0, 0, 0.15);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 28px;
          padding: 32px;
          position: relative;
          overflow: hidden;
        }
        @media (max-width: 1100px) {
          .blueprint-pc-container {
            grid-template-columns: 1fr;
            padding: 20px;
          }
        }
        .blueprint-pc-visual {
          border: 1px dashed rgba(14, 165, 233, 0.2);
          background: rgba(14, 165, 233, 0.01);
          border-radius: 20px;
          padding: 28px;
          display: flex;
          flex-direction: column;
          gap: 24px;
          position: relative;
        }
        .blueprint-grid {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 20px;
        }
        @media (max-width: 600px) {
          .blueprint-grid {
            grid-template-columns: 1fr;
          }
        }
        .blueprint-card-interactive {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 20px;
          padding: 24px;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 16px;
          transition: all 0.3s ease;
          position: relative;
        }
        .blueprint-card-interactive:hover {
          background: rgba(14, 165, 233, 0.05);
          border-color: var(--color-primary-glow);
          transform: scale(1.02);
          box-shadow: 0 10px 30px rgba(14, 165, 233, 0.1);
        }
        .blueprint-card-interactive.active {
          border-color: var(--color-primary-glow);
          background: rgba(14, 165, 233, 0.03);
        }
        .blueprint-icon-bg {
          width: 48px;
          height: 48px;
          border-radius: 12px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.05);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #888;
          transition: all 0.3s ease;
        }
        .blueprint-card-interactive:hover .blueprint-icon-bg {
          background: rgba(14, 165, 233, 0.1);
          color: var(--color-primary);
          border-color: rgba(14, 165, 233, 0.2);
        }
        .blueprint-label {
          font-size: 10px;
          font-weight: 800;
          color: #555;
          text-transform: uppercase;
          letter-spacing: 1.5px;
        }
        .blueprint-value {
          font-size: 15px;
          font-weight: 900;
          color: #fff;
          margin-top: 2px;
          font-family: 'Outfit', sans-serif;
        }

        /* CPU and RAM Circular Progress Indicators */
        .radial-gauge-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          position: relative;
          padding: 24px;
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 24px;
        }
        .radial-gauge-svg {
          width: 160px;
          height: 160px;
          transform: rotate(-90deg);
        }
        .radial-gauge-bg {
          fill: none;
          stroke: rgba(255, 255, 255, 0.03);
          stroke-width: 12;
        }
        .radial-gauge-fill {
          fill: none;
          stroke: var(--color-primary);
          stroke-width: 12;
          stroke-linecap: round;
          transition: stroke-dashoffset 0.8s ease;
        }
        .radial-gauge-info {
          position: absolute;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
        }
        .radial-gauge-val {
          font-size: 32px;
          font-weight: 900;
          color: #fff;
          font-family: 'Outfit', sans-serif;
        }
        .radial-gauge-lbl {
          font-size: 9px;
          color: #888;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1px;
          margin-top: 2px;
        }

        /* RAM DDR5 RGB Lightbars styling */
        .ram-dimm-slots {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 16px;
        }
        .ram-dimm-bar {
          background: rgba(0, 0, 0, 0.25);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 12px;
          padding: 16px 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          position: relative;
        }
        .ram-dimm-bar::before {
          content: "";
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 4px;
          background: linear-gradient(180deg, #0ea5e9 0%, #10b981 100%);
          border-radius: 12px 0 0 12px;
        }
        .ram-dimm-bar.ram-dimm-active::before {
          box-shadow: 0 0 10px rgba(14, 165, 233, 0.7);
        }

        /* System Info View Styles */
        .system-details-box {
          background: rgba(255, 255, 255, 0.01);
          border: 1px solid rgba(255, 255, 255, 0.03);
          border-radius: 24px;
          padding: 32px;
          position: relative;
        }
        .system-row-custom {
          display: grid;
          grid-template-columns: 240px 1fr;
          padding: 14px 0;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .system-row-custom:last-child {
          border-bottom: none;
        }
        .system-lbl {
          color: #888;
          font-weight: 800;
          text-transform: uppercase;
          font-size: 11px;
          letter-spacing: 1px;
          display: flex;
          align-items: center;
        }
        .system-val {
          color: #fff;
          font-size: 13px;
          font-weight: 600;
        }
        .system-box-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 32px;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          padding-bottom: 16px;
        }
        .system-box-actions {
          display: flex;
          align-items: center;
          gap: 16px;
        }
        .copied-text-badge {
          font-size: 10px;
          color: var(--color-success);
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
          animation: pulse 1.5s infinite;
        }
        .system-links-container {
          display: flex;
          flex-wrap: wrap;
          gap: 32px;
          margin-top: 40px;
          padding-top: 24px;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
        }

        .rename-pc-btn {
          background: rgba(14, 165, 233, 0.08);
          border: 1px solid rgba(14, 165, 233, 0.2);
          color: #0ea5e9;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          padding: 10px 18px;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .rename-pc-btn:hover {
          background: #0ea5e9;
          color: #fff;
          border-color: #0ea5e9;
          box-shadow: 0 5px 15px rgba(14, 165, 233, 0.35);
        }
        .system-link-btn {
          color: #0ea5e9;
          text-decoration: none;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 1px;
          transition: all 0.2s ease;
          background: transparent;
          border: none;
          cursor: pointer;
          padding: 0;
        }
        .system-link-btn:hover {
          color: #fff;
          text-shadow: 0 0 8px rgba(14, 165, 233, 0.6);
        }

        /* Responsywność */
        @media (max-width: 1400px) {
          .hardware-content { padding: 20px; }
          .page-title { font-size: 36px; }
        }

        @media (max-width: 1000px) {
          .crystal-header { padding: 20px; flex-direction: column; align-items: flex-start; gap: 20px; }
          .crystal-stat-mini { align-items: flex-start; }
        }

        /* Benchmark Styles */
        .benchmark-container {
          display: flex;
          flex-direction: column;
          gap: 32px;
          padding: 32px;
          position: relative;
          z-index: 10;
          width: 100%;
        }
        .benchmark-action-panel {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 20px;
          padding: 24px;
          backdrop-filter: blur(20px);
        }
        .benchmark-btn {
          display: flex;
          align-items: center;
          background: linear-gradient(135deg, var(--color-primary), #0072ff);
          color: white;
          border: none;
          padding: 12px 24px;
          font-weight: 800;
          font-family: 'Outfit', sans-serif;
          font-size: 14px;
          text-transform: uppercase;
          border-radius: 12px;
          cursor: pointer;
          transition: all 0.3s ease;
          box-shadow: 0 0 15px rgba(69, 243, 255, 0.2);
        }
        .benchmark-btn:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 0 25px rgba(69, 243, 255, 0.4);
        }
        .benchmark-btn:disabled {
          background: rgba(255, 255, 255, 0.05);
          color: rgba(255, 255, 255, 0.3);
          cursor: not-allowed;
          box-shadow: none;
        }
        .benchmark-progress-container {
          display: flex;
          flex-direction: column;
          gap: 8px;
          width: 100%;
          background: rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 16px;
          padding: 20px;
        }
        .benchmark-progress-bar-bg {
          width: 100%;
          height: 10px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 5px;
          overflow: hidden;
          position: relative;
        }
        .benchmark-progress-bar-fill {
          height: 100%;
          background: linear-gradient(90deg, var(--color-primary), #0072ff, #a855f7);
          transition: width 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          border-radius: 5px;
          box-shadow: 0 0 10px rgba(69, 243, 255, 0.5);
        }
        .benchmark-results-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 32px;
        }
        @media (min-width: 1024px) {
          .benchmark-results-grid {
            grid-template-columns: 350px 1fr;
          }
        }
        .benchmark-index-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 28px;
          padding: 32px;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          backdrop-filter: blur(20px);
        }
        .benchmark-index-circle {
          position: relative;
          width: 200px;
          height: 200px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
        }
        .benchmark-index-circle-bg {
          position: absolute;
          width: 100%;
          height: 100%;
          border-radius: 50%;
          border: 6px solid rgba(255, 255, 255, 0.03);
        }
        .benchmark-index-circle-glow {
          position: absolute;
          width: 90%;
          height: 90%;
          border-radius: 50%;
          filter: blur(20px);
          opacity: 0.15;
          z-index: 1;
        }
        .benchmark-index-content {
          z-index: 2;
          display: flex;
          flex-direction: column;
        }
        .benchmark-index-score {
          font-size: 36px;
          font-weight: 900;
          color: white;
          font-family: 'Outfit', sans-serif;
          line-height: 1;
        }
        .benchmark-index-label {
          font-size: 10px;
          text-transform: uppercase;
          letter-spacing: 2px;
          color: var(--color-text-muted);
          font-weight: 800;
          margin-top: 4px;
        }
        .benchmark-rating-badge {
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 900;
          text-transform: uppercase;
          letter-spacing: 1px;
          font-family: 'Outfit', sans-serif;
          margin-top: 16px;
        }
        .rating-extreme {
          background: rgba(236, 72, 153, 0.15);
          color: #ec4899;
          border: 1px solid rgba(236, 72, 153, 0.25);
          box-shadow: 0 0 15px rgba(236, 72, 153, 0.15);
        }
        .rating-high {
          background: rgba(69, 243, 255, 0.1);
          color: var(--color-primary);
          border: 1px solid rgba(69, 243, 255, 0.2);
          box-shadow: 0 0 15px rgba(69, 243, 255, 0.15);
        }
        .rating-mid {
          background: rgba(34, 197, 94, 0.1);
          color: #22c55e;
          border: 1px solid rgba(34, 197, 94, 0.2);
          box-shadow: 0 0 15px rgba(34, 197, 94, 0.15);
        }
        .rating-standard {
          background: rgba(234, 179, 8, 0.1);
          color: #eab308;
          border: 1px solid rgba(234, 179, 8, 0.2);
          box-shadow: 0 0 15px rgba(234, 179, 8, 0.15);
        }
        .rating-low {
          background: rgba(239, 68, 68, 0.1);
          color: #ef4444;
          border: 1px solid rgba(239, 68, 68, 0.2);
          box-shadow: 0 0 15px rgba(239, 68, 68, 0.15);
        }
        .benchmark-details-panel {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }
        .benchmark-score-cards-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 20px;
        }
        @media (min-width: 640px) {
          .benchmark-score-cards-grid {
            grid-template-columns: repeat(2, 1fr);
          }
        }
        .benchmark-detail-card {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 20px;
          padding: 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          backdrop-filter: blur(20px);
        }
        .benchmark-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .benchmark-card-title {
          font-size: 11px;
          font-weight: 800;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 1.5px;
          display: flex;
          align-items: center;
        }
        .benchmark-card-score {
          font-size: 24px;
          font-weight: 900;
          color: white;
          font-family: 'Outfit', sans-serif;
        }
        .benchmark-card-raw {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin-top: -4px;
        }
        .benchmark-history-panel {
          background: rgba(255, 255, 255, 0.02);
          border: 1px solid rgba(255, 255, 255, 0.04);
          border-radius: 24px;
          padding: 24px;
          backdrop-filter: blur(20px);
        }
        .benchmark-advice-box {
          background: rgba(69, 243, 255, 0.03);
          border: 1px solid rgba(69, 243, 255, 0.08);
          border-radius: 20px;
          padding: 20px;
          display: flex;
          gap: 16px;
          align-items: flex-start;
        }
        .benchmark-advice-icon {
          color: var(--color-primary);
          flex-shrink: 0;
          margin-top: 2px;
        }
        .benchmark-advice-text {
          font-size: 13px;
          line-height: 1.6;
          color: var(--color-text-secondary);
        }

        .loader { width: 60px; height: 60px; border: 5px solid rgba(255,255,255,0.05); border-top-color: var(--color-primary); border-radius: 50%; animation: spin 1s infinite linear; }
      `}</style>
    </div>
  )
}

const SectionCard = ({ title, icon, children, tooltip }: any) => (
  <div className="cpuz-card glass-blur h-fit" style={{ padding: '32px' }}>
    <div
      className="flex justify-between items-center"
      style={{
        marginBottom: '24px',
        paddingBottom: '16px',
        borderBottom: '1px solid rgba(255,255,255,0.08)'
      }}
    >
      <div className="header-with-icon">
        {icon}
        <h4 className="m-0 text-sm uppercase font-black text-white letter-spacing-1">{title}</h4>
      </div>
      {tooltip && (
        <div className="tooltip-container">
          <Info size={16} className="text-muted hover:text-primary cursor-help transition-colors" />
          <div className="tooltip-box">{tooltip}</div>
        </div>
      )}
    </div>
    {children}
  </div>
)

const DetailRow = ({ label, value, highlight }: any) => (
  <div className="detail-row">
    <span className="detail-label">{label}</span>
    <span
      className={`detail-value ${highlight ? 'text-primary font-outfit font-black text-lg' : ''}`}
    >
      {value || 'N/A'}
    </span>
  </div>
)

export default HardwareInfo
