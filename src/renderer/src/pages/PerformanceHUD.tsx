import { useEffect, useState } from 'react'
import { Cpu, HardDrive, Zap, Activity, Monitor } from 'lucide-react'

interface HUDMetrics {
  cpuLoad: number
  cpuTemp: number
  cpuSpeed: number
  ramUsage: number
  ramUsedGb: number
  ramTotalGb: number
  gpuLoad: number
  gpuTemp: number
  pingMs: number
}

export function PerformanceHUD() {
  const [metrics, setMetrics] = useState<HUDMetrics>({
    cpuLoad: 0,
    cpuTemp: 0,
    cpuSpeed: 0,
    ramUsage: 0,
    ramUsedGb: 0,
    ramTotalGb: 0,
    gpuLoad: 0,
    gpuTemp: 0,
    pingMs: 0
  })

  const [fps, setFps] = useState<number>(60)

  useEffect(() => {
    // Wymuszenie przezroczystości tła dla okna nakładki
    const originalBgColor = document.body.style.backgroundColor
    const originalBgImage = document.body.style.backgroundImage

    document.body.style.backgroundColor = 'transparent'
    document.body.style.backgroundImage = 'none'
    document.documentElement.style.backgroundColor = 'transparent'

    // Liczenie FPS renderowania nakładki
    let frameCount = 0
    let lastTime = performance.now()
    let animationFrameId: number

    const calculateFps = () => {
      frameCount++
      const now = performance.now()
      if (now >= lastTime + 1000) {
        setFps(Math.round((frameCount * 1000) / (now - lastTime)))
        frameCount = 0
        lastTime = now
      }
      animationFrameId = requestAnimationFrame(calculateFps)
    }

    animationFrameId = requestAnimationFrame(calculateFps)

    // 1. Cykliczne pobieranie obciążenia CPU/RAM/GPU - co 1.5 sekundy
    const fetchDynamicMetrics = () => {
      window.api.getDynamicHardware().then((res) => {
        if (res.success && res.data) {
          const d = res.data
          const cpu = d.cpu || {}
          const mem = d.memory || {}

          // Pobranie danych GPU (zazwyczaj pierwszy kontroler)
          const gpuObj = d.gpu && d.gpu[0] ? d.gpu[0] : {}

          // Obliczanie pamięci RAM w GB
          const totalGb = Math.round((mem.total / (1024 * 1024 * 1024)) * 10) / 10
          const usedGb = Math.round((mem.used / (1024 * 1024 * 1024)) * 10) / 10
          const usagePercent = mem.total > 0 ? Math.round((mem.used / mem.total) * 100) : 0

          setMetrics((prev) => ({
            ...prev,
            cpuLoad: Math.round(cpu.load || 0),
            cpuTemp: Math.round(cpu.temp || 0),
            cpuSpeed: Math.round((cpu.currentSpeed || 0) * 10) / 10,
            ramUsage: usagePercent,
            ramUsedGb: usedGb,
            ramTotalGb: totalGb,
            gpuLoad: Math.round(gpuObj.load || 0),
            gpuTemp: Math.round(gpuObj.temp || 0)
          }))
        }
      })
    }

    // 2. Cykliczne badanie opóźnień sieci (Ping) - co 6 sekund (rzadziej z uwagi na narzut CLI)
    const fetchNetworkPing = () => {
      window.api.pingDnsServers().then((res) => {
        if (res.success && res.data && res.data.length > 0) {
          // Znajdź Cloudflare lub Google
          const cloudflare = res.data.find((d: any) => d.name === 'Cloudflare')
          const google = res.data.find((d: any) => d.name === 'Google')
          const pingVal = cloudflare ? cloudflare.ping : google ? google.ping : res.data[0].ping

          setMetrics((prev) => ({
            ...prev,
            pingMs: pingVal < 999 ? pingVal : 0
          }))
        }
      })
    }

    fetchDynamicMetrics()
    fetchNetworkPing()

    const metricInterval = setInterval(fetchDynamicMetrics, 1500)
    const pingInterval = setInterval(fetchNetworkPing, 6000)

    return () => {
      clearInterval(metricInterval)
      clearInterval(pingInterval)
      cancelAnimationFrame(animationFrameId)
      document.body.style.backgroundColor = originalBgColor
      document.body.style.backgroundImage = originalBgImage
      document.documentElement.style.backgroundColor = ''
    }
  }, [])

  return (
    <div className="hud-overlay-container">
      <header className="hud-header">
        <Activity size={14} className="pulse-icon" />
        <span>UpdaterWin HUD</span>
      </header>

      <div className="hud-rows-list">
        {/* Wskaźnik CPU */}
        <div className="hud-metric-row">
          <div className="flex items-center gap-xs text-primary">
            <Cpu size={14} />
            <span className="metric-label">CPU:</span>
          </div>
          <div className="metric-value-box">
            <span className="font-extrabold text-white">{metrics.cpuLoad}%</span>
            <span className="metric-sub">{metrics.cpuSpeed} GHz</span>
            {metrics.cpuTemp > 0 && (
              <span className="temp-badge text-warning">{metrics.cpuTemp}°C</span>
            )}
          </div>
        </div>

        {/* Wskaźnik RAM */}
        <div className="hud-metric-row">
          <div className="flex items-center gap-xs text-secondary">
            <HardDrive size={14} />
            <span className="metric-label">RAM:</span>
          </div>
          <div className="metric-value-box">
            <span className="font-extrabold text-white">{metrics.ramUsage}%</span>
            <span className="metric-sub">
              {metrics.ramUsedGb}/{metrics.ramTotalGb} GB
            </span>
          </div>
        </div>

        {/* Wskaźnik GPU */}
        <div className="hud-metric-row">
          <div className="flex items-center gap-xs text-warning">
            <Zap size={14} />
            <span className="metric-label">GPU:</span>
          </div>
          <div className="metric-value-box">
            <span className="font-extrabold text-white">{metrics.gpuLoad}%</span>
            {metrics.gpuTemp > 0 && (
              <span className="temp-badge text-warning">{metrics.gpuTemp}°C</span>
            )}
          </div>
        </div>

        {/* Wskaźnik FPS */}
        <div className="hud-metric-row">
          <div className="flex items-center gap-xs text-info">
            <Monitor size={14} />
            <span className="metric-label">FPS:</span>
          </div>
          <div className="metric-value-box">
            <span className="font-extrabold text-white">{fps} FPS</span>
          </div>
        </div>

        {/* Wskaźnik PING */}
        <div className="hud-metric-row">
          <div className="flex items-center gap-xs text-success">
            <Activity size={14} />
            <span className="metric-label">PING:</span>
          </div>
          <div className="metric-value-box">
            <span
              className="font-extrabold text-white"
              style={{ color: metrics.pingMs > 0 ? '#34d399' : 'var(--color-text-muted)' }}
            >
              {metrics.pingMs > 0 ? `${metrics.pingMs} ms` : 'Mierzenie...'}
            </span>
          </div>
        </div>
      </div>

      <style>{`
        .hud-overlay-container {
          width: 250px;
          height: 200px;
          background: rgba(11, 12, 16, 0.72);
          backdrop-filter: blur(12px) saturate(180%);
          border: 1.5px solid rgba(255, 255, 255, 0.08);
          border-radius: 20px;
          padding: 14px 18px;
          box-sizing: border-box;
          font-family: system-ui, -apple-system, sans-serif;
          color: #fff;
          overflow: hidden;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
          user-select: none;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .hud-header {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #888;
          border-bottom: 1px solid rgba(255, 255, 255, 0.04);
          padding-bottom: 6px;
        }

        .pulse-icon {
          color: var(--color-primary);
          animation: pulse 2s infinite ease-in-out;
        }

        @keyframes pulse {
          0% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.1); }
          100% { opacity: 0.5; transform: scale(1); }
        }

        .hud-rows-list {
          display: flex;
          flex-direction: column;
          gap: 8px;
          flex: 1;
        }

        .hud-metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12px;
          height: 20px;
        }

        .flex {
          display: flex;
        }

        .items-center {
          align-items: center;
        }

        .gap-xs {
          gap: 4px;
        }

        .text-primary {
          color: var(--color-primary);
        }

        .text-secondary {
          color: var(--color-secondary);
        }

        .text-warning {
          color: var(--color-warning);
        }

        .text-info {
          color: #38bdf8;
        }

        .text-success {
          color: #34d399;
        }

        .metric-label {
          font-weight: 700;
          font-size: 11px;
        }

        .metric-value-box {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .font-extrabold {
          font-weight: 800;
        }

        .text-white {
          color: #fff;
        }

        .metric-sub {
          font-size: 10px;
          color: #888;
        }

        .temp-badge {
          font-size: 10px;
          font-weight: 700;
          padding: 1px 4px;
          border-radius: 4px;
          background: rgba(245, 158, 11, 0.1);
          border: 1px solid rgba(245, 158, 11, 0.15);
        }
      `}</style>
    </div>
  )
}
