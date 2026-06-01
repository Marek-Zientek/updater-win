import { ipcMain } from 'electron'
import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

let activeScanType: 'sfc' | 'dism' | 'audit' | null = null
let isScanRunning = false
let currentProgress = 0
let scanLogs = ''
let updateInterval: NodeJS.Timeout | null = null

// Path do pliku tymczasowego na logi diagnostyczne
const getLogPath = () => path.join(os.tmpdir(), 'diagnostics_scan.log')

function getBsodLogsFromEventLog(): Promise<any[]> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve([])
      return
    }

    // PowerShell skrypt odpytujący Event ID 1001 i filtrujący BugCheck
    const psScript = 
      `$events = Get-WinEvent -FilterHashtable @{LogName='System'; Id=1001} -ErrorAction SilentlyContinue | ` +
      `Where-Object { $_.Message -like '*BugCheck*' -or $_.Message -like '*WER-SystemErrorReporting*' } | ` +
      `Select-Object -First 10; ` +
      `if ($events) { ` +
      `  $output = @(); ` +
      `  foreach ($e in $events) { ` +
      `    $msg = $e.Message; ` +
      `    $code = ''; ` +
      `    $params = ''; ` +
      `    $driver = ''; ` +
      `    if ($msg -match 'Nast\\u0105pi\\u0142 ponowny rozruch komputera po operacji wykrywania b\\u0142\\u0119d\\u00f3w\\\\.\\\\s+Kod tej operacji to:\\\\s+([0-9a-fA-FxX]+)') { ` +
      `      $code = $Matches[1]; ` +
      `    } elseif ($msg -match 'The bugcheck was:\\\\s+([0-9a-fA-FxX]+)') { ` +
      `      $code = $Matches[1]; ` +
      `    } ` +
      `    if ($msg -match 'Parametry:\\\\s+([0-9a-fA-FxX\\\\s,\\\\(\\\\)]+)') { ` +
      `      $params = $Matches[1].Trim(); ` +
      `    } elseif ($msg -match 'Parameters:\\\\s+\\\\(([^\\\\)]+)\\\\)') { ` +
      `      $params = $Matches[1].Trim(); ` +
      `    } ` +
      `    if ($msg -match '([a-zA-Z0-9_\\\\-]+\\\\.sys)') { ` +
      `      $driver = $Matches[1]; ` +
      `    } ` +
      `    $output += [PSCustomObject]@{ ` +
      `      code = $code; ` +
      `      message = $msg; ` +
      `      time = $e.TimeCreated.ToString('yyyy-MM-dd HH:mm:ss'); ` +
      `      parameters = $params; ` +
      `      driver = $driver ` +
      `    }; ` +
      `  }; ` +
      `  $output | ConvertTo-Json -Compress; ` +
      `} else { ` +
      `  '[]'; ` +
      `}`

    exec(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, (err, stdout) => {
      if (err || !stdout.trim()) {
        resolve([])
        return
      }
      try {
        const parsed = JSON.parse(stdout.trim())
        resolve(Array.isArray(parsed) ? parsed : [parsed])
      } catch {
        resolve([])
      }
    })
  })
}

// Uruchamia konkretną komendę diagnostyczną i zapisuje wyjście do pliku tymczasowego
function runDiagnosticCommand(command: 'sfc' | 'dism'): Promise<boolean> {
  return new Promise((resolve) => {
    const tempLogPath = getLogPath()
    
    // Usunięcie starego pliku logu przed startem
    if (fs.existsSync(tempLogPath)) {
      try {
        fs.unlinkSync(tempLogPath)
      } catch (e) {
        console.error('Błąd usuwania logu:', e)
      }
    }

    fs.writeFileSync(tempLogPath, `[System] Rozpoczynanie skanowania ${command.toUpperCase()}...\n`, 'utf8')

    const winCommand = command === 'sfc' 
      ? 'sfc /scannow' 
      : 'dism /online /cleanup-image /restorehealth'

    // Uruchomienie z uprawnieniami administratora i wymuszeniem kodowania UTF-8 (chcp 65001)
    const elevatedCmd = `Start-Process cmd.exe -ArgumentList '/c chcp 65001 && ${winCommand} > "${tempLogPath}" 2>&1' -Verb RunAs -WindowStyle Hidden -Wait`

    exec(`powershell -NoProfile -Command "${elevatedCmd.replace(/"/g, '\\"')}"`, (err) => {
      if (err) {
        console.error(`Błąd podczas wykonywania ${command}:`, err)
        resolve(false)
      } else {
        resolve(true)
      }
    })
  })
}

export function setupDiagnosticsIPC() {
  // Rozpoczęcie diagnostyki
  ipcMain.handle('start-diagnostics-scan', async (_, type: 'sfc' | 'dism' | 'audit') => {
    if (isScanRunning) {
      return { success: false, error: 'Skanowanie jest już w toku.' }
    }

    activeScanType = type
    isScanRunning = true
    currentProgress = 0
    scanLogs = '[System] Uruchamianie procedury diagnostycznej...\nProszę potwierdzić monit UAC jeśli się pojawi.\n'

    const tempLogPath = getLogPath()

    // Interval do odczytywania logów z pliku w tle
    updateInterval = setInterval(() => {
      if (fs.existsSync(tempLogPath)) {
        try {
          const rawLogs = fs.readFileSync(tempLogPath, 'utf8')
          scanLogs = rawLogs

          // Wyciąganie procentów z logów za pomocą Regex
          const matches = rawLogs.match(/(\d+(?:\.\d+)?)%/g)
          if (matches && matches.length > 0) {
            const lastMatch = matches[matches.length - 1]
            const percent = parseFloat(lastMatch.replace('%', ''))
            if (!isNaN(percent)) {
              currentProgress = percent
            }
          }
        } catch (e) {
          // Błąd odczytu pliku (np. zablokowany przez system) - ignorujemy i spróbujemy za 500ms
        }
      }
    }, 500)

    // Odpalenie w tle
    setTimeout(async () => {
      try {
        if (type === 'sfc') {
          const success = await runDiagnosticCommand('sfc')
          if (success) {
            currentProgress = 100
            scanLogs += '\n[System] Skanowanie SFC zakończone pomyślnie.\n'
          } else {
            scanLogs += '\n[Błąd] Skanowanie SFC zostało przerwane lub anulowane.\n'
          }
        } else if (type === 'dism') {
          const success = await runDiagnosticCommand('dism')
          if (success) {
            currentProgress = 100
            scanLogs += '\n[System] Naprawa DISM zakończona pomyślnie.\n'
          } else {
            scanLogs += '\n[Błąd] Naprawa DISM została przerwana lub anulowana.\n'
          }
        } else if (type === 'audit') {
          // Pełny audyt: najpierw SFC, potem DISM
          scanLogs += '\n--- KROK 1 z 2: Skanowanie plików SFC ---\n'
          const sfcSuccess = await runDiagnosticCommand('sfc')
          if (sfcSuccess) {
            scanLogs += '\n[System] Krok 1 zakończony. Rozpoczynanie kroku 2 (DISM)...\n'
            scanLogs += '\n--- KROK 2 z 2: Naprawa obrazu DISM ---\n'
            currentProgress = 50
            const dismSuccess = await runDiagnosticCommand('dism')
            if (dismSuccess) {
              currentProgress = 100
              scanLogs += '\n[System] Pełny audyt zakończony sukcesem.\n'
            } else {
              scanLogs += '\n[Błąd] Krok 2 (DISM) nie powiódł się lub został anulowany.\n'
            }
          } else {
            scanLogs += '\n[Błąd] Krok 1 (SFC) nie powiódł się. Pełny audyt przerwany.\n'
          }
        }
      } catch (err: any) {
        scanLogs += `\n[Błąd] Wyjątek krytyczny: ${err.message}\n`
      } finally {
        if (updateInterval) {
          clearInterval(updateInterval)
          updateInterval = null
        }
        isScanRunning = false
        activeScanType = null
      }
    }, 100)

    return { success: true }
  })

  // Pobranie aktualnego stanu
  ipcMain.handle('get-diagnostics-progress', async () => {
    return {
      active: isScanRunning,
      type: activeScanType,
      progress: currentProgress,
      logs: scanLogs
    }
  })

  // Anulowanie skanowania
  ipcMain.handle('cancel-diagnostics-scan', async () => {
    if (isScanRunning) {
      exec('taskkill /f /im sfc.exe')
      exec('taskkill /f /im dism.exe')
      if (updateInterval) {
        clearInterval(updateInterval)
        updateInterval = null
      }
      isScanRunning = false
      activeScanType = null
      scanLogs += '\n[System] Skanowanie anulowane przez użytkownika.\n'
      return { success: true }
    }
    return { success: false, error: 'Skanowanie nie jest uruchomione.' }
  })

  // Pobranie logów awarii BSOD
  ipcMain.handle('get-bsod-logs', async () => {
    try {
      const logs = await getBsodLogsFromEventLog()
      return { success: true, data: logs }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
