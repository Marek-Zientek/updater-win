import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import { knownAssistants } from '../data/knownDrivers'

const execAsync = promisify(exec)

export function setupDriversIPC() {
  // 1. Wykrywanie sterowników systemowych przez PowerShell
  ipcMain.handle('get-system-drivers', async () => {
    try {
      // Zapytanie PowerShell pobierające urządzenia klas: Display, Net, MEDIA i filtrujące Microsoft
      const psCommand = `Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceClass -in @('Display', 'Net', 'MEDIA') -and $_.Manufacturer -ne 'Microsoft' } | Select-Object DeviceName, DriverVersion, Manufacturer, DeviceClass, DeviceID | ConvertTo-Json -Compress`
      const command = `chcp 65001 > nul && powershell -NoProfile -NonInteractive -Command "${psCommand.replace(/"/g, '\\"')}"`

      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 * 4 })

      if (!stdout || !stdout.trim()) {
        return { success: true, data: [] }
      }

      const parsed = JSON.parse(stdout.trim())
      // Zabezpieczenie na wypadek zwrócenia pojedynczego obiektu zamiast tablicy
      const data = Array.isArray(parsed) ? parsed : [parsed]
      return { success: true, data }
    } catch (err: any) {
      console.error('[Drivers IPC] Failed to fetch system drivers:', err)
      return { success: false, error: err.message }
    }
  })

  // 2. Sprawdzanie obecności asystentów aktualizacji sterowników
  ipcMain.handle('check-driver-assistants', async () => {
    try {
      const data = knownAssistants.map((assistant) => {
        let isInstalled = false
        for (const p of assistant.execPaths) {
          if (fs.existsSync(p)) {
            isInstalled = true
            break
          }
        }
        return {
          ...assistant,
          installed: isInstalled
        }
      })
      return { success: true, data }
    } catch (err: any) {
      console.error('[Drivers IPC] Failed to check assistants:', err)
      return { success: false, error: err.message }
    }
  })

  // 3. Uruchamianie asystenta aktualizacji sterowników
  ipcMain.handle('launch-driver-assistant', async (_, wingetId: string) => {
    const assistant = knownAssistants.find((a) => a.wingetId === wingetId)
    if (!assistant) {
      return { success: false, error: 'Nieznany asystent sterowników.' }
    }

    try {
      // 1. Jeśli jest komenda startująca URL (np. dla Intela)
      if (assistant.launchCmd) {
        exec(assistant.launchCmd)
        return { success: true }
      }

      // 2. Jeśli jest plik wykonywalny na dysku, uruchom go
      let execPath = ''
      for (const p of assistant.execPaths) {
        if (fs.existsSync(p)) {
          execPath = p
          break
        }
      }

      if (!execPath) {
        return { success: false, error: 'Nie odnaleziono pliku wykonywalnego asystenta.' }
      }

      // Uruchamiamy w tle bez blokowania procesu głównego
      const { spawn } = require('child_process')
      const child = spawn(execPath, [], {
        detached: true,
        stdio: 'ignore'
      })
      child.unref()

      return { success: true }
    } catch (err: any) {
      console.error(`[Drivers IPC] Failed to launch assistant ${wingetId}:`, err)
      return { success: false, error: err.message }
    }
  })
}
