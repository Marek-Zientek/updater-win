import http from 'http'
import { exec } from 'child_process'
import { networkInterfaces, hostname } from 'os'
import si from 'systeminformation'
import { toggleGameBoosterInternal, runCleanupInternal, isGameBoosterActive } from './ipc/optimizer'

let serverInstance: http.Server | null = null
let activePin = ''
let serverPort = 9090
let isServerRunning = false

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
      max-width: 550px;
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
    }

    /* LIVE TEMPS */
    .temps-panel {
      background: rgba(0, 0, 0, 0.15);
      border: 1px solid var(--color-border);
      border-radius: 16px;
      padding: 16px;
      display: flex;
      justify-content: space-around;
      margin-bottom: 24px;
    }

    .temp-item {
      text-align: center;
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

    /* ACTIONS PANEL */
    .actions-title {
      font-size: 13px;
      font-weight: 800;
      color: var(--color-muted);
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
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
        <span>Połączono lokalnie</span>
      </div>
      <button class="btn-logout" onclick="logout()">Wyloguj</button>
    </div>

    <!-- METRYKI CPU / RAM / DYSK -->
    <div class="metrics-grid">
      <!-- CPU -->
      <div class="metric-card">
        <span class="metric-title">Procesor (CPU)</span>
        <div class="circle-container">
          <svg>
            <circle class="circle-bg"></circle>
            <circle class="circle-val cpu" id="cpu-bar" stroke-dasharray="238" stroke-dashoffset="238"></circle>
          </svg>
          <span class="value-text" id="cpu-val">0%</span>
        </div>
        <span class="value-subtext" id="cpu-sub">Obciążenie</span>
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
        <span class="value-subtext" id="ram-sub">Użycie RAM</span>
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
        <span class="value-subtext" id="disk-sub">Zajęte</span>
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

    // Inicjalizacja: jeśli PIN jest w pamięci, spróbuj pobrać dane
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
          
          // Uruchomienie odświeżania na żywo
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

        // CPU
        const cpuPercent = Math.round(data.cpuLoad);
        document.getElementById('cpu-val').innerText = cpuPercent + '%';
        setCirclePercentage('cpu-bar', cpuPercent);

        // RAM
        const ramPercent = Math.round((data.memUsed / data.memTotal) * 100);
        document.getElementById('ram-val').innerText = ramPercent + '%';
        setCirclePercentage('ram-bar', ramPercent);

        // DYSK (główny dysk systemowy, pierwszy w tablicy)
        if (data.disks && data.disks.length > 0) {
          const sysDisk = data.disks[0];
          const diskPercent = Math.round((sysDisk.used / sysDisk.size) * 100);
          document.getElementById('disk-val').innerText = diskPercent + '%';
          setCirclePercentage('disk-bar', diskPercent);
          
          const freeGb = Math.round((sysDisk.size - sysDisk.used) / (1024 * 1024 * 1024));
          document.getElementById('disk-sub').innerText = 'Wolne: ' + freeGb + ' GB';
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
        console.error('Błąd pobierania telemetry:', err);
      });
    }

    function triggerAction(actionName) {
      if (!storedPin) return;

      const payload = { action: actionName };
      
      // Specjalna obsługa wskaźnika ładowania booster/cleanup
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
        // Czasowa ochrona CORS i nagłówki odpowiedzi
        res.setHeader('Access-Control-Allow-Origin', '*')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Remote-Pin')

        if (req.method === 'OPTIONS') {
          res.writeHead(200)
          res.end()
          return
        }

        // Endpoint główny serwujący Dashboard HTML
        if (req.url === '/' && req.method === 'GET') {
          res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
          res.end(getDashboardHtml(hostname()))
          return
        }

        // Weryfikacja PIN-u dostępu
        const requestPin = req.headers['x-remote-pin'] as string
        if (requestPin !== activePin) {
          res.writeHead(401, { 'Content-Type': 'application/json' })
          res.end(JSON.stringify({ success: false, error: 'Błędny kod autoryzacji PIN' }))
          return
        }

        // Endpoint GET /api/status - Zwracanie parametrów diagnostycznych
        if (req.url === '/api/status' && req.method === 'GET') {
          try {
            const [mem, load, cpuTemp, graphics, disks] = await Promise.all([
              si.mem(),
              si.currentLoad(),
              si.cpuTemperature(),
              si.graphics(),
              si.fsSize()
            ])

            const boosterActive = await isGameBoosterActive()

            const statusData = {
              cpuLoad: load.currentLoad,
              cpuTemp: cpuTemp.main || cpuTemp.max || 0,
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
              isGameBoosterActive: boosterActive
            }

            res.writeHead(200, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify(statusData))
          } catch (err: any) {
            res.writeHead(500, { 'Content-Type': 'application/json' })
            res.end(JSON.stringify({ success: false, error: err.message }))
          }
          return
        }

        // Endpoint POST /api/action - zdalne sterowanie
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
                // Uruchomienie wyłączenia z opóźnieniem 5 sekund
                exec('shutdown /s /t 5 /c "Zdalne zamkniecie systemu przez Web Dashboard"')
              } else if (action === 'reboot') {
                res.writeHead(200, { 'Content-Type': 'application/json' })
                res.end(JSON.stringify({ success: true, message: 'Restartowanie komputera...' }))
                // Uruchomienie restartu z opóźnieniem 5 sekund
                exec('shutdown /r /t 5 /c "Zdalny restart systemu przez Web Dashboard"')
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

        // Obsługa 404 dla pozostałych url
        res.writeHead(404, { 'Content-Type': 'application/json' })
        res.end(JSON.stringify({ success: false, error: 'Nie znaleziono żądanego endpointu' }))
      })

      serverInstance.listen(serverPort, () => {
        isServerRunning = true
        onStart(activePin)
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
