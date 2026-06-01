import { useState, useEffect } from 'react'
import { Activity, HardDrive, Cpu, Package, Thermometer } from 'lucide-react'
import { useNavigate, useOutletContext } from 'react-router-dom'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, Legend } from 'recharts'

const appColors = [
  'var(--color-primary)',
  'var(--color-secondary)',
  'var(--color-warning)',
  '#10b981',
  '#ec4899'
]

export function Dashboard() {
  const navigate = useNavigate()
  const { user } = useOutletContext<{ user: any }>()
  const welcomeName = user && user.name ? `, ${user.name}` : ''
  const [upgradable, setUpgradable] = useState<any[]>([])
  const [history, setHistory] = useState<any[]>([])
  const [resourceHistory, setResourceHistory] = useState<any[]>([])
  const [processes, setProcesses] = useState<any[]>([])
  const [appHistory, setAppHistory] = useState<any[]>([])
  const [uniqueApps, setUniqueApps] = useState<string[]>([])
  const [thermalMonitorEnabled, setThermalMonitorEnabled] = useState(true)
  const [thermalThresholdTemp, setThermalThresholdTemp] = useState('85')
  const [dynamicInfo, setDynamicInfo] = useState<any>(null)

  useEffect(() => {
    // 1. Dane statyczne - RAZ
    window.api.getStaticHardware()

    // Pobierz ustawienia ochrony termicznej
    window.api.getSetting('thermal_monitor_enabled', 'true').then((res) => {
      setThermalMonitorEnabled(res.value === 'true')
    })
    window.api.getSetting('thermal_threshold_temp', '85').then((res) => {
      setThermalThresholdTemp(res.value || '85')
    })

    // 2. Aplikacje i Historia - co 30 sekund (bardzo rzadko)
    const fetchSoftware = () => {
      window.api.getUpgradableApps().then((res) => {
        if (res.success) setUpgradable(res.data)
      })
      window.api.getUpdateHistory().then((res) => {
        if (res.success) setHistory(res.data)
      })
      window.api.getAppHistoricalMetrics().then((res) => {
        if (res.success && res.data) {
          // Wyciągamy top 4 aplikacje według łącznego zużycia CPU
          const appTotals: { [key: string]: number } = {}
          res.data.forEach((m: any) => {
            appTotals[m.appName] = (appTotals[m.appName] || 0) + m.cpuUsage
          })
          const top4 = Object.entries(appTotals)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 4)
            .map((entry) => entry[0])
          setUniqueApps(top4)

          // Grupujemy dane według czasu
          const groups: { [key: string]: any } = {}
          res.data.forEach((m: any) => {
            const date = new Date(m.timestamp)
            const timeStr = date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })
            if (!groups[timeStr]) {
              groups[timeStr] = { time: timeStr }
            }
            groups[timeStr][m.appName] = m.cpuUsage
          })

          setAppHistory(Object.values(groups))
        }
      })
    }
    fetchSoftware()
    const softInterval = setInterval(fetchSoftware, 30000)

    // 3. Dane dynamiczne (wykresy) - co 3 sekundy
    const fetchDynamic = () => {
      window.api.getDynamicHardware().then((res) => {
        if (res.success && res.data) {
          setDynamicInfo(res.data)
        }
      })
      window.api.getResourceHistory().then((res) => {
        if (res.success) setResourceHistory(res.data)
      })
    }
    fetchDynamic()
    const dynamicInterval = setInterval(fetchDynamic, 3000)

    // 4. Procesy - co 5 sekund
    const fetchProcs = () => {
      window.api.getTopProcesses().then((res) => {
        if (res.success) setProcesses(res.data)
      })
    }
    fetchProcs()
    const procInterval = setInterval(fetchProcs, 5000)

    return () => {
      clearInterval(softInterval)
      clearInterval(dynamicInterval)
      clearInterval(procInterval)
    }
  }, [])

  const currentRam =
    resourceHistory.length > 0 ? resourceHistory[resourceHistory.length - 1].ram : '--'
  const currentCpu =
    resourceHistory.length > 0 ? resourceHistory[resourceHistory.length - 1].cpu : '--'

  const currentTemp = (() => {
    if (!dynamicInfo) return '--'
    const cpuTemp = dynamicInfo.cpu?.temp || dynamicInfo.cpu?.maxTemp || 0
    let maxGpuTemp = 0
    if (dynamicInfo.gpu && Array.isArray(dynamicInfo.gpu)) {
      dynamicInfo.gpu.forEach((g: any) => {
        if (typeof g.temp === 'number' && g.temp > maxGpuTemp) {
          maxGpuTemp = g.temp
        }
      })
    }
    const highest = Math.max(cpuTemp, maxGpuTemp)
    return highest > 0 ? highest : '--'
  })()

  const handleToggleThermalMonitor = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const checked = e.target.checked
    setThermalMonitorEnabled(checked)
    await window.api.saveSetting('thermal_monitor_enabled', checked.toString())
  }

  return (
    <div className="dashboard-container">
      <header className="flex items-center justify-between">
        <div>
          <h1 style={{ fontSize: '28px', margin: 0, fontWeight: 800 }}>Witaj z powrotem{welcomeName}!</h1>
          <p className="text-muted" style={{ margin: 0, fontSize: '14px' }}>
            Wszystkie systemy działają prawidłowo
          </p>
        </div>
        <div className="sync-badge">
          <Activity size={16} />
          <span>Zoptymalizowano</span>
        </div>
      </header>

      <div className="dashboard-grid">
        {/* Updates */}
        <div
          className="dashboard-card clickable"
          onClick={() => navigate('/software', { state: { tab: 'upgradable' } })}
        >
          <div className="flex justify-between mb-sm">
            <h3 className="card-title">Aktualizacje</h3>
            <Package size={20} color="var(--color-primary)" />
          </div>
          <p className="stat-value">{upgradable.length}</p>
          <p className="text-muted text-xs">Oczekiwanie na akcję</p>
        </div>

        {/* RAM */}
        <div className="dashboard-card clickable" onClick={() => navigate('/hardware')}>
          <div className="flex justify-between mb-sm">
            <h3 className="card-title">Pamięć RAM</h3>
            <HardDrive size={20} color="var(--color-secondary)" />
          </div>
          <div className="flex items-end justify-between">
            <p className="stat-value">{currentRam}%</p>
            <div style={{ width: '120px', height: '40px' }}>
              <ResponsiveContainer>
                <AreaChart data={resourceHistory}>
                  <Area
                    type="monotone"
                    dataKey="ram"
                    stroke="var(--color-secondary)"
                    fill="transparent"
                    isAnimationActive={false}
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* CPU */}
        <div className="dashboard-card clickable" onClick={() => navigate('/hardware')}>
          <div className="flex justify-between mb-sm">
            <h3 className="card-title">Procesor CPU</h3>
            <Cpu size={20} color="var(--color-warning)" />
          </div>
          <div className="flex items-end justify-between">
            <p className="stat-value">{currentCpu}%</p>
            <div style={{ width: '120px', height: '40px' }}>
              <ResponsiveContainer>
                <AreaChart data={resourceHistory}>
                  <Area
                    type="monotone"
                    dataKey="cpu"
                    stroke="var(--color-warning)"
                    fill="transparent"
                    isAnimationActive={false}
                    strokeWidth={3}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Temperatura i Ochrona */}
        <div className="dashboard-card clickable" onClick={() => navigate('/hardware')}>
          <div className="flex justify-between mb-sm">
            <h3 className="card-title">Temperatura & Ochrona</h3>
            <Thermometer size={20} color={typeof currentTemp === 'number' && currentTemp > 80 ? 'var(--color-error)' : 'var(--color-warning)'} />
          </div>
          <div className="flex items-center justify-between">
            <div>
              <p className="stat-value">{currentTemp !== '--' ? `${currentTemp}°C` : '--'}</p>
              <p className="text-muted text-xs">
                Ochrona: {thermalMonitorEnabled ? `Aktywna (${thermalThresholdTemp}°C)` : 'Nieaktywna'}
              </p>
            </div>
            <div className="flex flex-col items-end gap-xs" onClick={(e) => e.stopPropagation()}>
              <label className="switch">
                <input
                  type="checkbox"
                  checked={thermalMonitorEnabled}
                  onChange={handleToggleThermalMonitor}
                />
                <span className="slider"></span>
              </label>
              <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', fontWeight: 600 }}>
                Zabezpieczenie
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="dashboard-bottom-row">
        {/* History */}
        <div className="bottom-panel">
          <h4 className="flex items-center gap-sm mb-lg text-sm text-uppercase tracking-wider font-bold">
            <Activity size={18} color="var(--color-primary)" /> Ostatnie Aktualizacje
          </h4>
          <div className="flex flex-col gap-sm">
            {history.slice(0, 5).map((item, i) => (
              <div key={i} className="list-item">
                <span className="dot success" />
                <span className="flex-1 text-sm font-bold">{item.software.name}</span>
                <span className="text-xs text-muted">{item.newVersion}</span>
              </div>
            ))}
            {history.length === 0 && <p className="text-muted text-center py-xl">Brak danych</p>}
          </div>
        </div>

        {/* Top Processes */}
        <div className="bottom-panel">
          <h4 className="flex items-center gap-sm mb-lg text-sm text-uppercase tracking-wider font-bold">
            <Cpu size={18} color="var(--color-warning)" /> Najbardziej obciążające procesy
          </h4>
          <div className="flex flex-col gap-sm">
            {processes.map((proc, i) => (
              <div key={i} className="list-item">
                <span className="flex-1 text-sm font-bold truncate" title={proc.name}>
                  {proc.name}
                </span>
                <span
                  className="text-sm font-extrabold"
                  style={{ color: proc.cpu > 50 ? 'var(--color-error)' : 'var(--color-warning)' }}
                >
                  {proc.cpu}%
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* App Resource Usage Chart */}
      <div className="bottom-panel full-width-panel" style={{ marginTop: '8px' }}>
        <h4 className="flex items-center gap-sm mb-lg text-sm text-uppercase tracking-wider font-bold">
          <Activity size={18} color="var(--color-primary)" /> Obciążenie CPU przez procesy
          (Skumulowane - Ostatnie 24h)
        </h4>
        <div className="dashboard-chart-container">
          {appHistory.length === 0 ? (
            <p className="text-muted text-center py-xl">
              Zbieranie danych historycznych o procesach (zapis co 5 min)...
            </p>
          ) : (
            <ResponsiveContainer>
              <AreaChart data={appHistory} margin={{ left: -20, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  {uniqueApps.map((app, idx) => (
                    <linearGradient key={app} id={`colorApp${idx}`} x1="0" y1="0" x2="0" y2="1">
                      <stop
                        offset="5%"
                        stopColor={appColors[idx % appColors.length]}
                        stopOpacity={0.4}
                      />
                      <stop
                        offset="95%"
                        stopColor={appColors[idx % appColors.length]}
                        stopOpacity={0}
                      />
                    </linearGradient>
                  ))}
                </defs>
                <XAxis dataKey="time" stroke="#888" fontSize={11} tickLine={false} />
                <YAxis
                  stroke="#888"
                  fontSize={11}
                  tickFormatter={(v) => `${v}%`}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: 'rgba(20,22,28,0.95)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '12px',
                    color: '#fff'
                  }}
                  labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '10px', fontSize: '12px' }} />
                {uniqueApps.map((app, idx) => (
                  <Area
                    key={app}
                    type="monotone"
                    dataKey={app}
                    stroke={appColors[idx % appColors.length]}
                    fillOpacity={1}
                    fill={`url(#colorApp${idx})`}
                    strokeWidth={2.5}
                    stackId="1"
                  />
                ))}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <style>{`
        .full-width-panel {
          width: 100%;
          flex: none !important;
          box-sizing: border-box;
        }
        .dashboard-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
          padding: 24px;
          height: calc(100vh - 48px);
          width: 100%;
          box-sizing: border-box;
          overflow-y: auto;
          scrollbar-width: thin;
        }
        .dashboard-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 24px;
          width: 100%;
        }
        .dashboard-card { 
          padding: 24px; 
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); 
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px;
        }
        .dashboard-card:hover { transform: translateY(-4px); border-color: rgba(69, 243, 255, 0.2); background: rgba(255,255,255,0.05); }
        .card-title { margin: 0; font-size: 12px; text-transform: uppercase; color: #888; letter-spacing: 1.5px; font-weight: 700; }
        .stat-value { font-size: 36px; font-weight: 800; margin: 8px 0; color: #fff; }
        
        .dashboard-bottom-row {
          display: flex;
          gap: 24px;
          flex-wrap: wrap;
          width: 100%;
        }
        .bottom-panel {
          flex: 1;
          min-width: 350px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          border-radius: 24px;
          padding: 24px;
        }
        
        .list-item { 
          display: flex; 
          align-items: center; 
          gap: 16px; 
          padding: 14px; 
          background: rgba(0,0,0,0.2); 
          border-radius: 16px; 
          border: 1px solid rgba(255,255,255,0.03);
          margin-bottom: 8px;
        }
        .dot { width: 8px; height: 8px; border-radius: 50%; }
        .dot.success { background: #10b981; box-shadow: 0 0 10px rgba(16, 185, 129, 0.5); }
        .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .dashboard-chart-container {
          width: 100%;
          height: 300px;
        }

        @media (max-width: 768px) {
          .dashboard-container {
            padding: 16px;
            gap: 16px;
          }
          .dashboard-grid {
            grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
            gap: 16px;
          }
          .dashboard-card {
            padding: 16px;
            border-radius: 16px;
          }
          .stat-value {
            font-size: 28px;
          }
          .dashboard-bottom-row {
            gap: 16px;
          }
          .bottom-panel {
            padding: 16px;
            border-radius: 16px;
            min-width: 100%;
          }
          .dashboard-chart-container {
            height: 200px;
          }
        }
      `}</style>
    </div>
  )
}
