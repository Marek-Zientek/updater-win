import http from 'http'
import { exec } from 'child_process'
import { networkInterfaces, hostname, uptime } from 'os'
import si from 'systeminformation'
import { toggleGameBoosterInternal, runCleanupInternal, isGameBoosterActive } from './ipc/optimizer'
import { getCpuTemperatureWithFallback } from './utils/tempHelper'

let serverInstance: http.Server | null = null
let activePin = ''
let serverPort = 9090
let isServerRunning = false

// Statyczne informacje o systemie i interfejsach sieciowych do wstrzyknięcia do panelu
const staticSystemInfo = {
  cpuModel: 'Ładowanie...',
  gpuModel: 'Ładowanie...',
  osInfo: 'Ładowanie...'
}

const networkIfaceNames: Record<string, string> = {}

// Generowanie losowego PIN-u dostępu
export function generatePin(): string {
  return Math.floor(1000 + Math.random() * 9000).toString()
}

// Pobieranie lokalnych adresów IP w sieci LAN
export function getLocalIPs(): string[] {
  const ips: string[] = []
  const nets = networkInterfaces()
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family === 'IPv4' && !net.internal) {
        ips.push(net.address)
      }
    }
  }
  return ips
}

// Formatowanie uptime systemowego (np. 1d 4h 12m)
function formatUptime(): string {
  const seconds = uptime()
  const d = Math.floor(seconds / (3600 * 24))
  const h = Math.floor((seconds % (3600 * 24)) / 3600)
  const m = Math.floor((seconds % 3600) / 60)

  const dDisplay = d > 0 ? `${d}d ` : ''
  const hDisplay = h > 0 ? `${h}h ` : ''
  const mDisplay = m > 0 ? `${m}m` : '0m'
  return dDisplay + hDisplay + mDisplay
}

// Spakowany kod HTML + CSS + JS dla Zdalnego Dashboardu
const getDashboardHtml = (computerName: string) => `
<!DOCTYPE html>
<html lang="pl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Zdalny Monitoring - ${computerName}</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --color-bg: #0b0d13;
      --color-panel: rgba(18, 22, 33, 0.65);
      --color-border: rgba(255, 255, 255, 0.05);
      --color-primary: #45f3ff;
      --color-secondary: #a855f7;
      --color-warning: #f59e0b;
      --color-danger: #ef4444;
      --color-success: #10b981;
      --color-text: #f3f4f6;
      --color-muted: #9ca3af;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: 'Outfit', sans-serif;
      background-color: var(--color-bg);
      background-image: 
        radial-gradient(at 10% 20%, rgba(69, 243, 255, 0.07) 0px, transparent 50%),
        radial-gradient(at 90% 80%, rgba(168, 85, 247, 0.07) 0px, transparent 50%);
      color: var(--color-text);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .glass-panel {
      background: var(--color-panel);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--color-border);
      border-radius: 24px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.5);
      padding: 30px;
      width: 100%;
      max-width: 580px;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* AUTH PANEL */
    #auth-panel {
      text-align: center;
    }

    .logo-container {
      margin-bottom: 24px;
    }

    .logo-icon {
      font-size: 40px;
      color: var(--color-primary);
      text-shadow: 0 0 15px rgba(69, 243, 255, 0.5);
      margin-bottom: 8px;
    }

    h2 {
      font-weight: 800;
      font-size: 24px;
      margin-bottom: 8px;
      background: linear-gradient(135deg, #fff, var(--color-muted));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    p.sub-title {
      font-size: 13px;
      color: var(--color-muted);
      margin-bottom: 24px;
    }

    .pin-display {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      height: 60px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 12px;
      margin-bottom: 24px;
      font-size: 28px;
      letter-spacing: 4px;
    }

    .pin-dot {
      width: 12px;
      height: 12px;
      border-radius: 50%;
      background: rgba(255, 255, 255, 0.1);
      transition: background 0.15s ease;
    }

    .pin-dot.filled {
      background: var(--color-primary);
      box-shadow: 0 0 8px var(--color-primary);
    }

    .keypad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      max-width: 320px;
      margin: 0 auto;
    }

    .key-btn {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--color-border);
      color: white;
      border-radius: 16px;
      font-size: 20px;
      font-weight: 600;
      height: 56px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.15s ease;
      outline: none;
    }

    .key-btn:active, .key-btn:hover {
      background: rgba(255, 255, 255, 0.08);
      border-color: rgba(255, 255, 255, 0.15);
      transform: scale(0.97);
    }

    .key-btn.action {
      font-size: 14px;
      color: var(--color-muted);
    }

    /* DASHBOARD PANEL */
    #dashboard-panel {
      display: none;
      max-width: 650px;
    }

    .dash-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--color-border);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }

    .comp-info h3 {
      font-size: 18px;
      font-weight: 800;
      color: white;
    }

    .comp-info span {
      font-size: 12px;
      color: var(--color-muted);
    }

    .btn-logout {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-muted);
      padding: 6px 12px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      transition: all 0.2s ease;
    }

    .btn-logout:hover {
      color: white;
      background: rgba(255, 255, 255, 0.05);
    }

    /* GRID MONITOR */
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 24px;
    }

    .metric-card {
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 16px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      transition: transform 0.2s;
    }

    .metric-title {
      font-size: 11px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--color-muted);
      letter-spacing: 0.5px;
      margin-bottom: 12px;
    }

    /* CIRCLE PROGRESS */
    .circle-container {
      position: relative;
      width: 90px;
      height: 90px;
    }

    .circle-container svg {
      width: 90px;
      height: 90px;
      transform: rotate(-90deg);
    }

    .circle-container circle {
      cx: 45;
      cy: 45;
      r: 38;
      fill: none;
      stroke-width: 6;
    }

    .circle-bg {
      stroke: rgba(255, 255, 255, 0.03);
    }

    .circle-val {
      stroke: var(--color-primary);
      stroke-linecap: round;
      transition: stroke-dashoffset 0.6s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .circle-val.cpu { stroke: var(--color-primary); }
    .circle-val.ram { stroke: var(--color-secondary); }
    .circle-val.disk { stroke: var(--color-warning); }

    .value-text {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      font-size: 16px;
      font-weight: 800;
      color: white;
    }

    .value-subtext {
      font-size: 11px;
      color: var(--color-muted);
      margin-top: 8px;
      line-height: 1.3;
      white-space: nowrap;
    }

    /* LIVE TEMPS & INFO */
    .temps-panel {
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      justify-content: space-around;
      margin-bottom: 20px;
    }

    .temp-item {
      text-align: center;
      flex: 1;
    }

    .temp-label {
      font-size: 12px;
      color: var(--color-muted);
      margin-bottom: 4px;
    }

    .temp-val {
      font-size: 20px;
      font-weight: 800;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4px;
    }

    .temp-val.hot {
      color: var(--color-danger);
      text-shadow: 0 0 10px rgba(239, 68, 68, 0.3);
    }

    /* PROCESSES PANEL */
    .processes-panel {
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 24px;
    }

    .panel-heading {
      font-size: 12px;
      font-weight: 800;
      color: var(--color-muted);
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 12px;
      display: flex;
      justify-content: space-between;
    }

    .process-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0;
      border-bottom: 1px solid rgba(255, 255, 255, 0.02);
      font-size: 12px;
    }

    .process-row:last-child {
      border-bottom: none;
    }

    .process-name {
      font-weight: 600;
      color: white;
      text-overflow: ellipsis;
      overflow: hidden;
      white-space: nowrap;
      flex: 1;
      margin-right: 8px;
    }

    .process-stats {
      color: var(--color-muted);
      display: flex;
      gap: 12px;
      font-size: 11px;
      margin-right: 12px;
    }

    .process-cpu {
      color: var(--color-primary);
      font-weight: 600;
      width: 48px;
      text-align: right;
    }

    .process-mem {
      width: 48px;
      text-align: right;
    }

    .btn-kill {
      background: rgba(239, 68, 68, 0.15);
      border: 1px solid rgba(239, 68, 68, 0.2);
      color: var(--color-danger);
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 10px;
      font-weight: bold;
      cursor: pointer;
      transition: all 0.15s;
    }

    .btn-kill:hover {
      background: var(--color-danger);
      color: white;
    }

    /* ACTIONS PANEL */
    .actions-title {
      display: block;
      font-size: 13px;
      font-weight: 800;
      color: var(--color-muted);
      margin-top: 30px;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      border-top: 1px solid var(--color-border);
      padding-top: 24px;
    }

    /* SPECS & NETWORK PANEL */
    .system-specs {
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .spec-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px 0;
      font-size: 12px;
    }

    .spec-label {
      color: var(--color-muted);
      font-weight: 600;
    }

    .spec-val {
      color: white;
      text-align: right;
      font-weight: 400;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 65%;
    }

    .actions-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 16px;
    }

    .action-btn {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--color-border);
      border-radius: 12px;
      color: white;
      padding: 12px 16px;
      cursor: pointer;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      font-size: 13px;
      font-weight: 600;
    }

    .action-btn:hover:not(:disabled) {
      background: rgba(255, 255, 255, 0.05);
      border-color: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }

    .action-btn:active:not(:disabled) {
      transform: translateY(0);
    }

    .action-btn.active {
      background: rgba(69, 243, 255, 0.1);
      border-color: var(--color-primary);
      color: var(--color-primary);
      box-shadow: 0 0 10px rgba(69, 243, 255, 0.15);
    }

    .action-btn.danger {
      border-color: rgba(239, 68, 68, 0.2);
    }

    .action-btn.danger:hover:not(:disabled) {
      background: rgba(239, 68, 68, 0.1);
      border-color: var(--color-danger);
      color: var(--color-danger);
    }

    .action-btn:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .icon {
      font-size: 18px;
    }

    /* POPUP CONFIRM */
    .modal-overlay {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(5px);
      z-index: 100;
      align-items: center;
      justify-content: center;
      padding: 20px;
    }

    .modal-content {
      background: #11141c;
      border: 1px solid var(--color-danger);
      border-radius: 20px;
      padding: 24px;
      width: 100%;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 10px 25px rgba(0, 0, 0, 0.6);
    }

    .modal-title {
      font-size: 18px;
      font-weight: 800;
      color: var(--color-danger);
      margin-bottom: 8px;
    }

    .modal-desc {
      font-size: 13px;
      color: var(--color-muted);
      margin-bottom: 20px;
      line-height: 1.5;
    }

    .modal-actions {
      display: flex;
      gap: 12px;
    }

    .modal-btn {
      flex: 1;
      padding: 10px;
      border-radius: 10px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .modal-btn.cancel {
      background: transparent;
      border: 1px solid var(--color-border);
      color: var(--color-muted);
    }

    .modal-btn.cancel:hover {
      background: rgba(255, 255, 255, 0.05);
      color: white;
    }

    .modal-btn.confirm {
      background: var(--color-danger);
      border: none;
      color: white;
    }

    .modal-btn.confirm:hover {
      background: #dc2626;
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.4);
    }

    /* TOAST */
    .toast {
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%) translateY(100px);
      background: rgba(16, 185, 129, 0.9);
      border: 1px solid rgba(16, 185, 129, 0.2);
      backdrop-filter: blur(10px);
      padding: 10px 20px;
      border-radius: 12px;
      color: white;
      font-size: 13px;
      font-weight: 600;
      z-index: 1000;
      transition: transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      box-shadow: 0 5px 15px rgba(0, 0, 0, 0.3);
    }

    .toast.show {
      transform: translateX(-50%) translateY(0);
    }

    .toast.error {
      background: rgba(239, 68, 68, 0.9);
      border-color: rgba(239, 68, 68, 0.2);
    }

    @media (max-width: 480px) {
      .metrics-grid {
        grid-template-columns: 1fr;
      }
      .circle-container {
        width: 100px;
        height: 100px;
      }
      .circle-container svg {
        width: 100px;
        height: 100px;
      }
      .circle-container circle {
        cx: 50;
        cy: 50;
        r: 42;
      }
    }
  </style>
</head>
<body>

  <!-- PANEL LOGOWANIA -->
  <div id="auth-panel" class="glass-panel">
    <div class="logo-container">
      <div class="logo-icon">🔒</div>
      <h2>Autoryzacja Dostępu</h2>
      <p class="sub-title">Wpisz 4-cyfrowy kod PIN wyświetlony na ekranie komputera</p>
    </div>

    <div class="pin-display">
      <div class="pin-dot" id="dot-0"></div>
      <div class="pin-dot" id="dot-1"></div>
      <div class="pin-dot" id="dot-2"></div>
      <div class="pin-dot" id="dot-3"></div>
    </div>

    <div class="keypad">
      <button class="key-btn" onclick="pressNum('1')">1</button>
      <button class="key-btn" onclick="pressNum('2')">2</button>
      <button class="key-btn" onclick="pressNum('3')">3</button>
      <button class="key-btn" onclick="pressNum('4')">4</button>
      <button class="key-btn" onclick="pressNum('5')">5</button>
      <button class="key-btn" onclick="pressNum('6')">6</button>
      <button class="key-btn" onclick="pressNum('7')">7</button>
      <button class="key-btn" onclick="pressNum('8')">8</button>
      <button class="key-btn" onclick="pressNum('9')">9</button>
      <button class="key-btn action" onclick="clearPin()">C</button>
      <button class="key-btn" onclick="pressNum('0')">0</button>
      <button class="key-btn action" onclick="backspacePin()">⌫</button>
    </div>
  </div>

  <!-- PANEL MONITOROWANIA (DASHBOARD) -->
  <div id="dashboard-panel" class="glass-panel">
    <div class="dash-header">
      <div class="comp-info">
        <h3 id="comp-hostname">${computerName}</h3>
        <span id="comp-uptime">Uptime: --</span>
      </div>
      <button class="btn-logout" onclick="logout()">Wyloguj</button>
    </div>

    <!-- METRYKI CPU / RAM / DYSK -->
    <div class="metrics-grid">
      <!-- CPU -->
      <div class="metric-card">
        <span class="metric-title">Procesor</span>
        <div class="circle-container">
          <svg>
            <circle class="circle-bg"></circle>
            <circle class="circle-val cpu" id="cpu-bar" stroke-dasharray="238" stroke-dashoffset="238"></circle>
          </svg>
          <span class="value-text" id="cpu-val">0%</span>
        </div>
        <span class="value-subtext" id="cpu-sub">Taktowanie: --</span>
      </div>

      <!-- RAM -->
      <div class="metric-card">
        <span class="metric-title">Pamięć RAM</span>
        <div class="circle-container">
          <svg>
            <circle class="circle-bg"></circle>
            <circle class="circle-val ram" id="ram-bar" stroke-dasharray="238" stroke-dashoffset="238"></circle>
          </svg>
          <span class="value-text" id="ram-val">0%</span>
        </div>
        <span class="value-subtext" id="ram-sub">Użycie: -- / -- GB</span>
      </div>

      <!-- DYSK -->
      <div class="metric-card">
        <span class="metric-title">Wolny Dysk</span>
        <div class="circle-container">
          <svg>
            <circle class="circle-bg"></circle>
            <circle class="circle-val disk" id="disk-bar" stroke-dasharray="238" stroke-dashoffset="238"></circle>
          </svg>
          <span class="value-text" id="disk-val">0%</span>
        </div>
        <span class="value-subtext" id="disk-sub">Wolne: -- GB</span>
      </div>
    </div>

    <!-- TEMPERATURY -->
    <div class="temps-panel">
      <div class="temp-item">
        <div class="temp-label">Temp. CPU</div>
        <div class="temp-val" id="cpu-temp">--°C</div>
      </div>
      <div style="border-left: 1px solid var(--color-border);"></div>
      <div class="temp-item">
        <div class="temp-label">Temp. GPU</div>
        <div class="temp-val" id="gpu-temp">--°C</div>
      </div>
    </div>

    <!-- SPECYFIKACJA SYSTEMU & TELEMETRIA SIECI -->
    <div class="system-specs">
      <div class="panel-heading" style="margin-bottom: 8px;">
        <span>Specyfikacja & Sieć</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Procesor:</span>
        <span class="spec-val" id="spec-cpu">Ładowanie...</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Karta graficzna:</span>
        <span class="spec-val" id="spec-gpu">Ładowanie...</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">System operacyjny:</span>
        <span class="spec-val" id="spec-os">Ładowanie...</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Połączenie (IP):</span>
        <span class="spec-val" id="spec-ip">Ładowanie...</span>
      </div>
      <div style="border-top: 1px solid rgba(255, 255, 255, 0.03); margin: 8px 0;"></div>
      <div class="spec-row">
        <span class="spec-label">Karta sieciowa:</span>
        <span class="spec-val" id="net-iface">Ładowanie...</span>
      </div>
      <div class="spec-row">
        <span class="spec-label">Transfer:</span>
        <span class="spec-val" id="net-speeds" style="color: var(--color-primary); font-weight: bold;">↓ 0 KB/s | ↑ 0 KB/s</span>
      </div>
    </div>

    <!-- NAJBARDZIEJ OBCIĄŻAJĄCE PROCESY -->
    <div class="processes-panel">
      <div class="panel-heading">
        <span>Najbardziej obciążające procesy</span>
        <span>CPU / RAM</span>
      </div>
      <div id="process-list">
        <div class="text-center py-4 text-xs text-muted" style="text-align: center; padding: 12px 0;">Ładowanie procesów...</div>
      </div>
    </div>

    <!-- KAFELKI KONTROLNE -->
    <span class="actions-title">Panel Zdalnego Sterowania</span>
    <div class="actions-grid">
      <button class="action-btn" id="btn-booster" onclick="triggerAction('toggle_booster')">
        <span class="icon">🚀</span>
        <span>Game Booster</span>
      </button>
      <button class="action-btn" id="btn-cleanup" onclick="triggerAction('cleanup')">
        <span class="icon">🧹</span>
        <span>Oczyszczanie Dysku</span>
      </button>
      <button class="action-btn danger" onclick="confirmPower('shutdown')">
        <span class="icon">🔌</span>
        <span>Wyłącz PC</span>
      </button>
      <button class="action-btn danger" onclick="confirmPower('reboot')">
        <span class="icon">🔄</span>
        <span>Zrestartuj PC</span>
      </button>
    </div>
  </div>

  <!-- POPUP POTWIERDZENIA ZASILANIA -->
  <div class="modal-overlay" id="power-modal">
    <div class="modal-content">
      <div class="modal-title" id="power-modal-title">Wyłączenie Komputera</div>
      <div class="modal-desc" id="power-modal-desc">Czy na pewno chcesz zdalnie zamknąć system operacyjny? Wszystkie niezapisane dane zostaną utracone.</div>
      <div class="modal-actions">
        <button class="modal-btn cancel" onclick="closePowerModal()">Anuluj</button>
        <button class="modal-btn confirm" id="power-confirm-btn" onclick="executePowerAction()">Wykonaj</button>
      </div>
    </div>
  </div>

  <!-- TOAST POWIADOMIENIA -->
  <div class="toast" id="toast-message">Akcja wykonana pomyślnie</div>

  <script>
    let enteredPin = '';
    let storedPin = localStorage.getItem('remote_pin') || '';
    let refreshInterval = null;
    let pendingPowerAction = '';

    if (storedPin) {
      checkPinAndLoad(storedPin);
    }

    function updatePinDots() {
      for (let i = 0; i < 4; i++) {
        const dot = document.getElementById('dot-' + i);
        if (i < enteredPin.length) {
          dot.classList.add('filled');
        } else {
          dot.classList.remove('filled');
        }
      }
    }

    function pressNum(num) {
      if (enteredPin.length < 4) {
        enteredPin += num;
        updatePinDots();
        if (enteredPin.length === 4) {
          setTimeout(() => {
            checkPinAndLoad(enteredPin);
          }, 150);
        }
      }
    }

    function clearPin() {
      enteredPin = '';
      updatePinDots();
    }

    function backspacePin() {
      if (enteredPin.length > 0) {
        enteredPin = enteredPin.slice(0, -1);
        updatePinDots();
      }
    }

    function checkPinAndLoad(pin) {
      fetch('/api/status', {
        headers: { 'X-Remote-Pin': pin }
      })
      .then(res => {
        if (res.status === 200) {
          storedPin = pin;
          localStorage.setItem('remote_pin', pin);
          document.getElementById('auth-panel').style.display = 'none';
          document.getElementById('dashboard-panel').style.display = 'block';
          
          updateDashboard();
          refreshInterval = setInterval(updateDashboard, 2000);
        } else {
          showToast('Nieprawidłowy kod PIN', true);
          clearPin();
          localStorage.removeItem('remote_pin');
        }
      })
      .catch(err => {
        showToast('Błąd połączenia z serwerem PC', true);
        clearPin();
      });
    }

    function logout() {
      localStorage.removeItem('remote_pin');
      storedPin = '';
      if (refreshInterval) clearInterval(refreshInterval);
      document.getElementById('dashboard-panel').style.display = 'none';
      document.getElementById('auth-panel').style.display = 'block';
      clearPin();
    }

    function setCirclePercentage(barId, percent) {
      const circle = document.getElementById(barId);
      const radius = circle.r.baseVal.value;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (percent / 100) * circumference;
      circle.style.strokeDasharray = circumference;
      circle.style.strokeDashoffset = offset;
    }

    function killProcess(pid) {
      if (!storedPin) return;
      if (!confirm('Czy na pewno chcesz ubić ten proces?')) return;

      fetch('/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Remote-Pin': storedPin
        },
        body: JSON.stringify({ action: 'kill_process', pid: pid })
      })
      .then(res => res.json())
      .then(result => {
        if (result && result.success) {
          showToast('Proces został pomyślnie zamknięty!');
          updateDashboard();
        } else {
          showToast('Błąd zamykania procesu', true);
        }
      })
      .catch(() => showToast('Błąd sieci', true));
    }

    function updateDashboard() {
      if (!storedPin) return;
      fetch('/api/status', {
        headers: { 'X-Remote-Pin': storedPin }
      })
      .then(res => {
        if (res.status === 401) {
          logout();
          return;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;

        // Uptime
        document.getElementById('comp-uptime').innerText = 'Uptime: ' + data.uptime;

        // CPU
        const cpuPercent = Math.round(data.cpuLoad);
        document.getElementById('cpu-val').innerText = cpuPercent + '%';
        setCirclePercentage('cpu-bar', cpuPercent);
        document.getElementById('cpu-sub').innerText = 'Taktowanie: ' + data.cpuSpeed + ' GHz';

        // RAM
        const ramPercent = Math.round((data.memUsed / data.memTotal) * 100);
        document.getElementById('ram-val').innerText = ramPercent + '%';
        setCirclePercentage('ram-bar', ramPercent);
        const ramUsedGb = (data.memUsed / (1024 * 1024 * 1024)).toFixed(1);
        const ramTotalGb = (data.memTotal / (1024 * 1024 * 1024)).toFixed(1);
        document.getElementById('ram-sub').innerText = 'Użycie: ' + ramUsedGb + ' / ' + ramTotalGb + ' GB';

        // DYSK (Wolne miejsce)
        if (data.disks && data.disks.length > 0) {
          const sysDisk = data.disks[0];
          const freePercent = Math.round(((sysDisk.size - sysDisk.used) / sysDisk.size) * 100);
          document.getElementById('disk-val').innerText = freePercent + '%';
          setCirclePercentage('disk-bar', freePercent);
          const freeGb = Math.round((sysDisk.size - sysDisk.used) / (1024 * 1024 * 1024));
          const totalGb = Math.round(sysDisk.size / (1024 * 1024 * 1024));
          document.getElementById('disk-sub').innerText = 'Wolne: ' + freeGb + ' / ' + totalGb + ' GB';
        }

        // SPECYFIKACJA SYSTEMU & SIEĆ
        if (data.specs) {
          document.getElementById('spec-cpu').innerText = data.specs.cpuModel || '--';
          document.getElementById('spec-os').innerText = data.specs.osInfo || '--';
          
          if (data.gpu && data.gpu.length > 0) {
            const mainGpu = data.gpu[0];
            const gpuLoadStr = mainGpu.load !== undefined && mainGpu.load !== null ? ' (' + Math.round(mainGpu.load) + '%)' : '';
            document.getElementById('spec-gpu').innerText = (data.specs.gpuModel || '--') + gpuLoadStr;
          } else {
            document.getElementById('spec-gpu').innerText = data.specs.gpuModel || '--';
          }
        }
        document.getElementById('spec-ip').innerText = window.location.hostname;

        if (data.network) {
          document.getElementById('net-iface').innerText = data.network.iface || 'Brak';
          const formatSpeed = (bytesPerSec) => {
            if (bytesPerSec >= 1024 * 1024) {
              return (bytesPerSec / (1024 * 1024)).toFixed(1) + ' MB/s';
            }
            return (bytesPerSec / 1024).toFixed(0) + ' KB/s';
          };
          const down = formatSpeed(data.network.downloadSpeed);
          const up = formatSpeed(data.network.uploadSpeed);
          document.getElementById('net-speeds').innerText = '↓ ' + down + ' | ↑ ' + up;
        }

        // TEMPERATURY
        document.getElementById('cpu-temp').innerText = Math.round(data.cpuTemp) + '°C';
        if (data.cpuTemp >= 80) {
          document.getElementById('cpu-temp').classList.add('hot');
        } else {
          document.getElementById('cpu-temp').classList.remove('hot');
        }

        if (data.gpu && data.gpu.length > 0) {
          const mainGpu = data.gpu[0];
          document.getElementById('gpu-temp').innerText = (mainGpu.temp ? Math.round(mainGpu.temp) : '--') + '°C';
          if (mainGpu.temp >= 80) {
            document.getElementById('gpu-temp').classList.add('hot');
          } else {
            document.getElementById('gpu-temp').classList.remove('hot');
          }
        } else {
          document.getElementById('gpu-temp').innerText = 'Brak GPU';
        }

        // Top procesy
        const processList = document.getElementById('process-list');
        if (data.topProcesses && data.topProcesses.length > 0) {
          processList.innerHTML = data.topProcesses.map(p => \`
            <div class="process-row">
              <span class="process-name" title="\${p.name}">\${p.name}</span>
              <div class="process-stats">
                <span class="process-cpu">\${p.cpu}% CPU</span>
                <span class="process-mem">\${p.mem}% RAM</span>
              </div>
              <button class="btn-kill" onclick="killProcess(\${p.pid})">Zabij</button>
            </div>
          \`).join('');
        } else {
          processList.innerHTML = '<div class="text-center py-4 text-xs text-muted" style="text-align: center; padding: 12px 0;">Brak procesów</div>';
        }

        // Status Game Booster
        const btnBooster = document.getElementById('btn-booster');
        if (data.isGameBoosterActive) {
          btnBooster.classList.add('active');
          btnBooster.querySelector('span:last-child').innerText = 'Game Booster ON';
        } else {
          btnBooster.classList.remove('active');
          btnBooster.querySelector('span:last-child').innerText = 'Game Booster OFF';
        }
      })
      .catch(err => {
        console.error('Błąd pobierania telemetrii:', err);
      });
    }

    function triggerAction(actionName) {
      if (!storedPin) return;

      const payload = { action: actionName };
      
      let btn = null;
      let originalText = '';
      if (actionName === 'cleanup') {
        btn = document.getElementById('btn-cleanup');
        originalText = 'Oczyszczanie Dysku';
        btn.disabled = true;
        btn.querySelector('span:last-child').innerText = 'Czyszczenie...';
      }

      fetch('/api/action', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Remote-Pin': storedPin
        },
        body: JSON.stringify(payload)
      })
      .then(res => {
        if (res.status === 401) {
          logout();
          return;
        }
        return res.json();
      })
      .then(result => {
        if (result && result.success) {
          if (actionName === 'cleanup') {
            showToast('Pomyślnie oczyszczono dysk systemowy!');
          } else if (actionName === 'toggle_booster') {
            showToast(result.active ? 'Game Booster został aktywowany!' : 'Game Booster został wyłączony.');
          }
        } else {
          showToast(result ? result.error : 'Nieznany błąd podczas wykonywania akcji', true);
        }
      })
      .catch(err => {
        showToast('Błąd połączenia sieciowego', true);
      })
      .finally(() => {
        if (btn) {
          btn.disabled = false;
          btn.querySelector('span:last-child').innerText = originalText;
        }
        updateDashboard();
      });
    }

    function confirmPower(type) {
      pendingPowerAction = type;
      const modal = document.getElementById('power-modal');
      const title = document.getElementById('power-modal-title');
      const desc = document.getElementById('power-modal-desc');
      const confirmBtn = document.getElementById('power-confirm-btn');

      if (type === 'shutdown') {
        title.innerText = 'Wyłączenie Komputera';
        desc.innerText = 'Czy na pewno chcesz zdalnie wyłączyć system operacyjny komputera? Niezapisane dane mogą zostać utracone.';
        confirmBtn.innerText = 'Wyłącz PC';
      } else {
        title.innerText = 'Restart Komputera';
        desc.innerText = 'Czy na pewno chcesz zrestartować komputer? Wszystkie uruchomione aplikacje zostaną zamknięte.';
        confirmBtn.innerText = 'Zrestartuj PC';
      }

      modal.style.display = 'flex';
    }

    function closePowerModal() {
      document.getElementById('power-modal').style.display = 'none';
      pendingPowerAction = '';
    }

    function executePowerAction() {
      if (!pendingPowerAction) return;
      
      triggerAction(pendingPowerAction);
      closePowerModal();
      showToast('Polecenie zasilania zostało wysłane do systemu PC');
    }

    function showToast(message, isError = false) {
      const toast = document.getElementById('toast-message');
      toast.innerText = message;
      if (isError) {
        toast.classList.add('error');
      } else {
        toast.classList.remove('error');
      }
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  </script>
</body>
</html>
`

// Inicjalizacja i uruchomienie serwera
export function startRemoteServer(port: number, onStart: (pin: string) => void): Promise<{ success: boolean; error?: string }> {
  return new Promise((resolve) => {
    try {
      if (isServerRunning) {
        stopRemoteServer()
      }

      serverPort = port
      activePin = generatePin()

      serverInstance = http.createServer(async (req, res) => {
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Remote-Pin')

        if (req.method === 'OPTIONS') {
          res.writeHead(200)
          res.end()
          return
        }

        if (req.url === '/' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(getDashboardHtml(hostname()))
          return
        }

        const requestPin = req.headers['x-remote-pin'] as string
        if (requestPin !== activePin) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Błędny kod autoryzacji PIN' }))
          return
        }

        if (req.url === '/api/status' && req.method === 'GET') {
          try {
            const [mem, load, rawCpuTemp, graphics, disks, cpuSpeed, processes, netStats] = await Promise.all([
              si.mem(),
              si.currentLoad(),
              si.cpuTemperature(),
              si.graphics(),
              si.fsSize(),
              si.cpuCurrentSpeed(),
              si.processes(),
              si.networkStats()
            ])

            // Wywołanie zaawansowanego odczytu temperatury z fallbackiem (przekazujemy obciążenie CPU do estymacji)
            const cpuTemp = await getCpuTemperatureWithFallback(
              rawCpuTemp.main || rawCpuTemp.max || 0,
              load.currentLoad
            )

            const boosterActive = await isGameBoosterActive()

            // Filtrowanie i sortowanie procesów
            const topProcesses = processes.list
              .sort((a, b) => b.cpu - a.cpu)
              .slice(0, 5)
              .map((p) => ({
                name: p.name,
                cpu: Math.round(p.cpu * 10) / 10,
                mem: Math.round(p.mem * 10) / 10,
                pid: p.pid
              }))

            // Pobranie statystyk aktywnego interfejsu sieciowego
            let netDownload = 0
            let netUpload = 0
            let activeIface = 'Brak połączenia'
            if (Array.isArray(netStats) && netStats.length > 0) {
              const active = netStats.find((n) => n.operstate === 'up') || netStats.find((n) => n.rx_sec > 0 || n.tx_sec > 0) || netStats[0]
              if (active) {
                activeIface = active.iface
                netDownload = active.rx_sec || 0
                netUpload = active.tx_sec || 0
              }
            }
            const friendlyIfaceName = networkIfaceNames[activeIface] || activeIface

            const statusData = {
              cpuLoad: load.currentLoad,
              cpuTemp: cpuTemp,
              cpuSpeed: cpuSpeed.avg || 0,
              memTotal: mem.total,
              memUsed: mem.used,
              disks: disks.map((d) => ({
                fs: d.fs,
                size: d.size,
                used: d.used,
                mount: d.mount
              })),
              gpu: graphics.controllers.map((g) => ({
                model: g.model,
                temp: g.temperatureGpu,
                load: g.utilizationGpu
              })),
              isGameBoosterActive: boosterActive,
              uptime: formatUptime(),
              topProcesses: topProcesses,
              network: {
                iface: friendlyIfaceName,
                downloadSpeed: netDownload,
                uploadSpeed: netUpload
              },
              specs: staticSystemInfo
            }

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(statusData))
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
          return
        }

        if (req.url === '/api/action' && req.method === 'POST') {
          let body = ''
          req.on('data', (chunk) => {
            body += chunk.toString()
          })

          req.on('end', async () => {
            try {
              const payload = JSON.parse(body)
              const action = payload.action

              if (action === 'cleanup') {
                const cleanupResult = await runCleanupInternal()
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, cleanedBytes: cleanupResult.cleanedBytes }))
              } else if (action === 'toggle_booster') {
                const boosterActive = await isGameBoosterActive()
                const toggleResult = await toggleGameBoosterInternal(!boosterActive)
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, active: toggleResult.active }))
              } else if (action === 'shutdown') {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, message: 'Wyłączanie komputera...' }))
                exec('shutdown /s /t 5 /c "Zdalne zamkniecie systemu przez Web Dashboard"')
              } else if (action === 'reboot') {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, message: 'Restartowanie komputera...' }))
                exec('shutdown /r /t 5 /c "Zdalny restart systemu przez Web Dashboard"')
              } else if (action === 'kill_process') {
                const pid = parseInt(payload.pid, 10)
                if (pid) {
                  try {
                    process.kill(pid)
                  } catch {
                    exec(`taskkill /f /pid ${pid}`)
                  }
                  res.writeHead(200, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ success: true, message: `Zakończono proces ${pid}` }))
                } else {
                  res.writeHead(400, { 'Content-Type': 'application/json' })
                  res.end(JSON.stringify({ success: false, error: 'Brak prawidlowego PID' }))
                }
              } else {
                res.writeHead(400, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: false, error: 'Nieznana akcja optymalizacyjna' }))
              }
            } catch (err: any) {
              res.writeHead(500, { 'Content-Type': 'application/json' })
              res.end(JSON.stringify({ success: false, error: err.message }))
            }
          })
          return
        }

        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Nie znaleziono żądanego endpointu' }))
      })

      serverInstance.listen(serverPort, () => {
        isServerRunning = true
        onStart(activePin)

        // Asynchroniczne pobranie stałych parametrów sprzętowych (raz po starcie serwera)
        Promise.all([
          si.cpu(),
          si.osInfo(),
          si.graphics(),
          si.networkInterfaces()
        ])
          .then(([cpu, osData, graphics, netIfaces]) => {
            staticSystemInfo.cpuModel = (cpu.manufacturer + ' ' + cpu.brand).trim() || 'Nieznany CPU'
            staticSystemInfo.osInfo = (osData.distro + ' ' + osData.release + ' (' + osData.arch + ')').trim() || 'Nieznany OS'
            staticSystemInfo.gpuModel = graphics.controllers.map((g) => g.model).filter(Boolean).join(', ') || 'Zintegrowana'
            
            if (Array.isArray(netIfaces)) {
              netIfaces.forEach((iface) => {
                if (iface.iface) {
                  networkIfaceNames[iface.iface] = iface.ifaceName || iface.iface
                }
              })
            }
          })
          .catch((err) => {
            console.error('Błąd pobierania specyfikacji sprzętowej:', err)
          })

        resolve({ success: true })
      })

      serverInstance.on('error', (err: any) => {
        resolve({ success: false, error: err.message })
      })
    } catch (e: any) {
      resolve({ success: false, error: e.message })
    }
  })
}

// Zatrzymanie serwera
export function stopRemoteServer(): void {
  if (serverInstance) {
    serverInstance.close()
    serverInstance = null
  }
  isServerRunning = false
  activePin = ''
}

// Sprawdzenie stanu serwera
export function getRemoteServerStatus(): { isRunning: boolean; port: number; pin: string; ips: string[] } {
  return {
    isRunning: isServerRunning,
    port: serverPort,
    pin: activePin,
    ips: getLocalIPs()
  }
}
