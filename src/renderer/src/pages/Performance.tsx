import { useEffect, useState } from 'react'
import {
  Cpu,
  Database,
  Zap,
  RefreshCw,
  BarChart2,
  TrendingUp,
  TrendingDown,
  Clock,
  Activity
} from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts'

interface HistoricalMetric {
  id: string
  cpuLoad: number
  ramUsage: number
  gpuLoad: number | null
  timestamp: string | Date
}

interface DynamicData {
  memory?: {
    total: number
    used: number
    free: number
  }
  cpu?: {
    load: number
    temp: number
    currentSpeed: number
  }
  gpu?: Array<{
    model: string
    temp: number
    fanRpm: number
  }>
}

export function Performance() {
  const [activeTab, setActiveTab] = useState<'cpu' | 'ram' | 'gpu'>('cpu')
  const [historicalData, setHistoricalData] = useState<HistoricalMetric[]>([])
  const [dynamicData, setDynamicData] = useState<DynamicData | null>(null)
  const [staticData, setStaticData] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const fetchHistorical = async () => {
    setRefreshing(true)
    try {
      const res = await window.api.getHistoricalMetrics()
      if (res.success) {
        setHistoricalData(res.data)
      }
    } catch (err) {
      console.error('Błąd pobierania historii metryk:', err)
    } finally {
      setRefreshing(false)
    }
  }

  useEffect(() => {
    // Pobierz dane statyczne
    window.api.getStaticHardware().then((res) => {
      if (res.success) setStaticData(res.data)
    })

    // Pobierz dane historyczne
    fetchHistorical().then(() => setLoading(false))

    // Pobieraj dane dynamiczne co 3 sekundy
    const fetchDynamic = async () => {
      const res = await window.api.getDynamicHardware()
      if (res.success) {
        setDynamicData(res.data)
      }
    }
    fetchDynamic()
    const dynamicInterval = setInterval(fetchDynamic, 3000)

    // Odświeżaj dane historyczne co 60 sekund (nowy punkt w bazie)
    const historicalInterval = setInterval(fetchHistorical, 60000)

    return () => {
      clearInterval(dynamicInterval)
      clearInterval(historicalInterval)
    }
  }, [])

  // Kalkulacja statystyk historycznych (min, max, avg)
  const calculateStats = (key: 'cpuLoad' | 'ramUsage' | 'gpuLoad') => {
    if (historicalData.length === 0) return { min: 0, max: 0, avg: 0 }

    const values = historicalData
      .map((d) => d[key])
      .filter((v): v is number => v !== null && v !== undefined)

    if (values.length === 0) return { min: null, max: null, avg: null }

    const min = Math.min(...values)
    const max = Math.max(...values)
    const avg = values.reduce((sum, v) => sum + v, 0) / values.length

    return {
      min: Math.round(min * 10) / 10,
      max: Math.round(max * 10) / 10,
      avg: Math.round(avg * 10) / 10
    }
  }

  const cpuStats = calculateStats('cpuLoad')
  const ramStats = calculateStats('ramUsage')
  const gpuStats = calculateStats('gpuLoad')

  // Dynamiczne wartości bieżące
  const currentCpu =
    dynamicData?.cpu?.load !== undefined
      ? Math.round(dynamicData.cpu.load)
      : historicalData.length > 0
        ? Math.round(historicalData[historicalData.length - 1].cpuLoad)
        : 0

  const currentRam = dynamicData?.memory
    ? Math.round((dynamicData.memory.used / dynamicData.memory.total) * 100)
    : historicalData.length > 0
      ? Math.round(historicalData[historicalData.length - 1].ramUsage)
      : 0

  const hasGpuData = historicalData.some((d) => d.gpuLoad !== null)
  const currentGpu =
    hasGpuData &&
    historicalData.length > 0 &&
    historicalData[historicalData.length - 1].gpuLoad !== null
      ? Math.round(historicalData[historicalData.length - 1].gpuLoad as number)
      : 0

  // Formatowanie etykiety X (czasu)
  const formatTimeLabel = (timestampStr: string | Date) => {
    try {
      const date = new Date(timestampStr)
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    } catch {
      return ''
    }
  }

  // Konfiguracja wykresów
  const chartConfigs = {
    cpu: {
      key: 'cpuLoad',
      label: 'Obciążenie CPU (%)',
      strokeColor: 'var(--color-warning)',
      glowColor: 'rgba(255, 196, 0, 0.4)',
      gradientId: 'cpuGrad',
      stats: cpuStats
    },
    ram: {
      key: 'ramUsage',
      label: 'Zużycie RAM (%)',
      strokeColor: 'var(--color-secondary)',
      glowColor: 'rgba(107, 78, 230, 0.4)',
      gradientId: 'ramGrad',
      stats: ramStats
    },
    gpu: {
      key: 'gpuLoad',
      label: 'Obciążenie GPU (%)',
      strokeColor: 'var(--color-primary)',
      glowColor: 'rgba(69, 243, 255, 0.4)',
      gradientId: 'gpuGrad',
      stats: gpuStats
    }
  }

  const currentChartConfig = chartConfigs[activeTab]

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full w-full min-h-[600px]">
        <div className="loader"></div>
        <p className="mt-4 text-muted animate-pulse">Ładowanie danych wydajności...</p>
        <style>{`
          .loader {
            width: 48px;
            height: 48px;
            border: 5px solid rgba(69, 243, 255, 0.1);
            border-bottom-color: var(--color-primary);
            border-radius: 50%;
            display: inline-block;
            box-sizing: border-box;
            animation: rotation 1s linear infinite;
          }
          @keyframes rotation {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    )
  }

  const totalRamGB = staticData?.memory?.total
    ? (staticData.memory.total / 1024 ** 3).toFixed(1)
    : '16.0'

  const usedRamGB = dynamicData?.memory?.used
    ? (dynamicData.memory.used / 1024 ** 3).toFixed(1)
    : ((currentRam / 100) * parseFloat(totalRamGB)).toFixed(1)

  const firstDynamicGpu = dynamicData?.gpu?.[0]
  const gpuName = staticData?.gpu?.[0]?.model || 'Zintegrowana grafika'

  // Customowy Tooltip do Recharts
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload as HistoricalMetric
      const val = payload[0].value
      const dateStr = new Date(data.timestamp).toLocaleString([], {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      })

      return (
        <div className="custom-tooltip glass-panel">
          <p className="tooltip-time">{dateStr}</p>
          <p className="tooltip-value" style={{ color: currentChartConfig.strokeColor }}>
            {currentChartConfig.label.split(' ')[0]}: <span className="font-extrabold">{val}%</span>
          </p>
          <style>{`
            .custom-tooltip {
              padding: 12px 16px;
              background: rgba(20, 22, 28, 0.9) !important;
              border: 1px solid rgba(255, 255, 255, 0.1) !important;
              border-radius: 12px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.5);
            }
            .tooltip-time {
              font-size: 11px;
              color: var(--color-text-muted);
              margin: 0 0 4px 0;
            }
            .tooltip-value {
              font-size: 14px;
              margin: 0;
              font-weight: 600;
            }
          `}</style>
        </div>
      )
    }
    return null
  }

  return (
    <div className="performance-container">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}>Wydajność Systemu</h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '14px' }}>
            Historia zużycia procesora, pamięci i układu graficznego z ostatnich 24 godzin
          </p>
        </div>
        <button
          className={`btn btn-secondary flex items-center gap-sm ${refreshing ? 'refreshing' : ''}`}
          onClick={fetchHistorical}
          disabled={refreshing}
          style={{ padding: '8px 16px', borderRadius: '12px' }}
        >
          <RefreshCw size={16} className={refreshing ? 'spin' : ''} />
          <span>{refreshing ? 'Odświeżanie...' : 'Odśwież historię'}</span>
        </button>
      </header>

      {/* Row of Current Status Cards */}
      <div className="metrics-grid">
        {/* CPU Card */}
        <div
          className={`metric-card glass-panel ${activeTab === 'cpu' ? 'active-cpu' : ''}`}
          onClick={() => setActiveTab('cpu')}
        >
          <div className="card-header flex justify-between">
            <span className="card-lbl">PROCESOR (CPU)</span>
            <Cpu size={20} style={{ color: 'var(--color-warning)' }} />
          </div>
          <div className="card-body">
            <div className="flex items-baseline gap-xs">
              <span className="value-large">{currentCpu}%</span>
              <span className="value-unit">obciążenia</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar cpu-bar" style={{ width: `${currentCpu}%` }}></div>
            </div>
            <div className="card-details flex justify-between text-xs text-muted">
              <span>
                Taktowanie:{' '}
                {dynamicData?.cpu?.currentSpeed
                  ? `${dynamicData.cpu.currentSpeed.toFixed(2)} GHz`
                  : '-- GHz'}
              </span>
              <span>
                Temp:{' '}
                {dynamicData?.cpu?.temp && dynamicData.cpu.temp > 0
                  ? `${dynamicData.cpu.temp}°C`
                  : '--°C'}
              </span>
            </div>
          </div>
        </div>

        {/* RAM Card */}
        <div
          className={`metric-card glass-panel ${activeTab === 'ram' ? 'active-ram' : ''}`}
          onClick={() => setActiveTab('ram')}
        >
          <div className="card-header flex justify-between">
            <span className="card-lbl">PAMIĘĆ RAM</span>
            <Database size={20} style={{ color: 'var(--color-secondary)' }} />
          </div>
          <div className="card-body">
            <div className="flex items-baseline gap-xs">
              <span className="value-large">{currentRam}%</span>
              <span className="value-unit">użycia</span>
            </div>
            <div className="progress-bar-container">
              <div className="progress-bar ram-bar" style={{ width: `${currentRam}%` }}></div>
            </div>
            <div className="card-details flex justify-between text-xs text-muted">
              <span>Użyte: {usedRamGB} GB</span>
              <span>Łącznie: {totalRamGB} GB</span>
            </div>
          </div>
        </div>

        {/* GPU Card */}
        <div
          className={`metric-card glass-panel ${activeTab === 'gpu' ? 'active-gpu' : ''}`}
          onClick={() => setActiveTab('gpu')}
        >
          <div className="card-header flex justify-between">
            <span className="card-lbl">KARTA GRAFICZNA (GPU)</span>
            <Zap size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div className="card-body">
            <div className="flex items-baseline gap-xs">
              <span className="value-large">{hasGpuData ? `${currentGpu}%` : '--'}</span>
              <span className="value-unit">{hasGpuData ? 'obciążenia' : 'brak danych'}</span>
            </div>
            <div className="progress-bar-container">
              <div
                className="progress-bar gpu-bar"
                style={{ width: hasGpuData ? `${currentGpu}%` : '0%' }}
              ></div>
            </div>
            <div className="card-details flex justify-between text-xs text-muted">
              <span className="truncate max-w-[150px]" title={gpuName}>
                {gpuName}
              </span>
              <span>
                Temp:{' '}
                {firstDynamicGpu?.temp && firstDynamicGpu.temp > 0
                  ? `${firstDynamicGpu.temp}°C`
                  : '--°C'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Chart Card */}
      <div className="chart-panel glass-panel">
        <div className="chart-panel-header flex justify-between items-center mb-lg">
          <div className="flex items-center gap-md">
            <BarChart2 size={20} style={{ color: currentChartConfig.strokeColor }} />
            <h3 style={{ margin: 0, fontSize: '18px' }}>Wykres obciążenia historycznego</h3>
          </div>
          <div className="tab-buttons flex gap-sm">
            <button
              className={`tab-btn ${activeTab === 'cpu' ? 'active warning' : ''}`}
              onClick={() => setActiveTab('cpu')}
            >
              Procesor CPU
            </button>
            <button
              className={`tab-btn ${activeTab === 'ram' ? 'active secondary' : ''}`}
              onClick={() => setActiveTab('ram')}
            >
              Pamięć RAM
            </button>
            <button
              className={`tab-btn ${activeTab === 'gpu' ? 'active primary' : ''}`}
              onClick={() => setActiveTab('gpu')}
            >
              Grafika GPU
            </button>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="chart-wrapper">
          {activeTab === 'gpu' && !hasGpuData ? (
            <div className="flex flex-col items-center justify-center h-full w-full py-xl text-center">
              <Zap size={48} className="text-muted mb-sm" />
              <p className="text-muted font-medium">Brak danych historycznych dla GPU</p>
              <p className="text-xs text-muted max-w-[400px] mt-xs">
                To urządzenie nie zwraca parametrów obciążenia GPU, bądź baza danych nie zapisała
                jeszcze pomiarów. Zostanie zaktualizowana po wykryciu zmian.
              </p>
            </div>
          ) : historicalData.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full w-full py-xl text-center">
              <Activity size={48} className="text-muted mb-sm" />
              <p className="text-muted font-medium">Brak danych w bazie</p>
              <p className="text-xs text-muted max-w-[400px] mt-xs">
                Zbieranie danych rozpocznie się automatycznie. Upewnij się, że usługa działa w tle.
                Pierwszy pomiar zapisze się w ciągu minuty.
              </p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <AreaChart
                data={historicalData}
                margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
              >
                <defs>
                  <linearGradient id={currentChartConfig.gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop
                      offset="5%"
                      stopColor={currentChartConfig.strokeColor}
                      stopOpacity={0.4}
                    />
                    <stop offset="95%" stopColor={currentChartConfig.strokeColor} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="timestamp"
                  tickFormatter={formatTimeLabel}
                  stroke="rgba(255,255,255,0.3)"
                  style={{ fontSize: '11px' }}
                  dy={10}
                  tickLine={false}
                  interval={Math.max(1, Math.floor(historicalData.length / 10))}
                />
                <YAxis
                  domain={[0, 100]}
                  stroke="rgba(255,255,255,0.3)"
                  style={{ fontSize: '11px' }}
                  dx={-10}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Area
                  type="monotone"
                  dataKey={currentChartConfig.key}
                  stroke={currentChartConfig.strokeColor}
                  strokeWidth={2}
                  fillOpacity={1}
                  fill={`url(#${currentChartConfig.gradientId})`}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Summary Statistics Card */}
      <div className="stats-panel glass-panel">
        <h3
          className="flex items-center gap-sm mb-lg"
          style={{ fontSize: '18px', margin: '0 0 20px 0' }}
        >
          <Clock size={20} style={{ color: 'var(--color-primary)' }} />
          <span>Statystyki i Ekstremum z ostatnich 24h</span>
        </h3>
        <div className="stats-grid">
          {/* CPU Stats */}
          <div className="stat-row-card flex flex-col gap-sm">
            <div className="stat-title flex items-center gap-sm">
              <Cpu size={16} style={{ color: 'var(--color-warning)' }} />
              <span className="font-bold text-sm">Procesor CPU</span>
            </div>
            <div className="stat-values-row flex justify-between mt-sm">
              <div className="val-box">
                <span className="val-lbl flex items-center gap-xs">
                  <TrendingDown size={12} color="var(--color-success)" /> Minimum
                </span>
                <span className="val-num">{cpuStats.min !== null ? `${cpuStats.min}%` : '--'}</span>
              </div>
              <div className="val-box">
                <span className="val-lbl flex items-center gap-xs">
                  <Clock size={12} color="var(--color-primary)" /> Średnia
                </span>
                <span className="val-num">{cpuStats.avg !== null ? `${cpuStats.avg}%` : '--'}</span>
              </div>
              <div className="val-box">
                <span className="val-lbl flex items-center gap-xs">
                  <TrendingUp size={12} color="var(--color-error)" /> Maksimum
                </span>
                <span
                  className="val-num"
                  style={{
                    color: cpuStats.max && cpuStats.max > 85 ? 'var(--color-error)' : 'inherit'
                  }}
                >
                  {cpuStats.max !== null ? `${cpuStats.max}%` : '--'}
                </span>
              </div>
            </div>
          </div>

          {/* RAM Stats */}
          <div className="stat-row-card flex flex-col gap-sm">
            <div className="stat-title flex items-center gap-sm">
              <Database size={16} style={{ color: 'var(--color-secondary)' }} />
              <span className="font-bold text-sm">Pamięć RAM</span>
            </div>
            <div className="stat-values-row flex justify-between mt-sm">
              <div className="val-box">
                <span className="val-lbl flex items-center gap-xs">
                  <TrendingDown size={12} color="var(--color-success)" /> Minimum
                </span>
                <span className="val-num">{ramStats.min !== null ? `${ramStats.min}%` : '--'}</span>
              </div>
              <div className="val-box">
                <span className="val-lbl flex items-center gap-xs">
                  <Clock size={12} color="var(--color-primary)" /> Średnia
                </span>
                <span className="val-num">{ramStats.avg !== null ? `${ramStats.avg}%` : '--'}</span>
              </div>
              <div className="val-box">
                <span className="val-lbl flex items-center gap-xs">
                  <TrendingUp size={12} color="var(--color-error)" /> Maksimum
                </span>
                <span className="val-num">{ramStats.max !== null ? `${ramStats.max}%` : '--'}</span>
              </div>
            </div>
          </div>

          {/* GPU Stats */}
          <div className="stat-row-card flex flex-col gap-sm">
            <div className="stat-title flex items-center gap-sm">
              <Zap size={16} style={{ color: 'var(--color-primary)' }} />
              <span className="font-bold text-sm">Grafika GPU</span>
            </div>
            <div className="stat-values-row flex justify-between mt-sm">
              <div className="val-box">
                <span className="val-lbl flex items-center gap-xs">
                  <TrendingDown size={12} color="var(--color-success)" /> Minimum
                </span>
                <span className="val-num">{gpuStats.min !== null ? `${gpuStats.min}%` : '--'}</span>
              </div>
              <div className="val-box">
                <span className="val-lbl flex items-center gap-xs">
                  <Clock size={12} color="var(--color-primary)" /> Średnia
                </span>
                <span className="val-num">{gpuStats.avg !== null ? `${gpuStats.avg}%` : '--'}</span>
              </div>
              <div className="val-box">
                <span className="val-lbl flex items-center gap-xs">
                  <TrendingUp size={12} color="var(--color-error)" /> Maksimum
                </span>
                <span className="val-num">{gpuStats.max !== null ? `${gpuStats.max}%` : '--'}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Styled JSX */}
      <style>{`
        .performance-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 24px;
          min-height: calc(100vh - 32px);
          width: 100%;
          box-sizing: border-box;
          scrollbar-width: thin;
        }
        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 24px;
          width: 100%;
        }
        .metric-card {
          padding: 20px;
          border-radius: 20px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .metric-card:hover {
          transform: translateY(-4px);
          background: rgba(255, 255, 255, 0.05);
        }
        .active-cpu {
          border-color: rgba(255, 196, 0, 0.3);
          box-shadow: 0 0 15px rgba(255, 196, 0, 0.15);
        }
        .active-ram {
          border-color: rgba(107, 78, 230, 0.4);
          box-shadow: 0 0 15px rgba(107, 78, 230, 0.2);
        }
        .active-gpu {
          border-color: rgba(69, 243, 255, 0.3);
          box-shadow: 0 0 15px rgba(69, 243, 255, 0.15);
        }
        .card-lbl {
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-muted);
          letter-spacing: 1.5px;
        }
        .value-large {
          font-size: 32px;
          font-weight: 800;
          color: #fff;
        }
        .value-unit {
          font-size: 13px;
          color: var(--color-text-secondary);
          font-weight: 500;
        }
        .progress-bar-container {
          width: 100%;
          height: 6px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 3px;
          margin: 12px 0;
          overflow: hidden;
        }
        .progress-bar {
          height: 100%;
          border-radius: 3px;
          transition: width 0.5s ease-in-out;
        }
        .cpu-bar { background: var(--color-warning); }
        .ram-bar { background: var(--color-secondary); }
        .gpu-bar { background: var(--color-primary); }
        .chart-panel {
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .chart-wrapper {
          width: 100%;
          min-height: 320px;
          position: relative;
        }
        .tab-btn {
          background: transparent;
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--color-text-secondary);
          padding: 8px 16px;
          border-radius: 12px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          background: rgba(255, 255, 255, 0.05);
          color: #fff;
        }
        .tab-btn.active.warning {
          background: rgba(255, 196, 0, 0.15);
          border-color: var(--color-warning);
          color: var(--color-warning);
        }
        .tab-btn.active.secondary {
          background: rgba(107, 78, 230, 0.15);
          border-color: var(--color-secondary);
          color: #b39ddb;
        }
        .tab-btn.active.primary {
          background: rgba(69, 243, 255, 0.15);
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
        .stats-panel {
          padding: 24px;
          border-radius: 24px;
          background: rgba(255, 255, 255, 0.03);
          border: 1px solid rgba(255, 255, 255, 0.06);
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
        }
        .stat-row-card {
          padding: 20px;
          border-radius: 16px;
          background: rgba(0, 0, 0, 0.2);
          border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .val-box {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .val-lbl {
          font-size: 11px;
          color: var(--color-text-muted);
          font-weight: 600;
          text-transform: uppercase;
        }
        .val-num {
          font-size: 18px;
          font-weight: 800;
          color: #fff;
        }
        .spin {
          animation: spin-anim 1s linear infinite;
        }
        @keyframes spin-anim {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}
