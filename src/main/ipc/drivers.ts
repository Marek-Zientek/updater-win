import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import { knownAssistants } from '../data/knownDrivers'
import { checkForUpdatesInternal, runWinget } from './winget'

const execAsync = promisify(exec)

// Map installed hardware to Winget Packages
function mapHardwareToWinget(driver: any): string | null {
  const name = (driver.DeviceName || '').toLowerCase()
  const mfr = (driver.Manufacturer || '').toLowerCase()
  const cls = (driver.DeviceClass || '').toLowerCase()

  if (mfr.includes('nvidia')) {
    if (cls === 'display') {
      return 'Nvidia.GeForceDriver.Desktop'
    }
  }
  if (mfr.includes('amd')) {
    if (cls === 'display') {
      return 'AMD.Adrenalin'
    }
  }
  if (mfr.includes('intel')) {
    if (cls === 'display') {
      return 'Intel.GraphicsDriver'
    }
    if (
      name.includes('wi-fi') ||
      name.includes('wireless') ||
      name.includes('dual band') ||
      name.includes('centrino') ||
      cls === 'net'
    ) {
      if (name.includes('bluetooth') || name.includes('bt')) {
        return 'Intel.Bluetooth'
      }
      return 'Intel.WiFi'
    }
  }
  if (mfr.includes('realtek')) {
    if (name.includes('ethernet') || name.includes('pcie gbe') || name.includes('lan')) {
      return 'Realtek.EthernetControllerDriver'
    }
    if (cls === 'media' || name.includes('audio') || name.includes('sound')) {
      return 'Realtek.HighDefinitionAudioDriver'
    }
  }
  return null
}

export function setupDriversIPC() {
  // 1. Wykrywanie sterowników systemowych przez PowerShell
  ipcMain.handle('get-system-drivers', async () => {
    try {
      const psCommand = `Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceClass -in @('Display', 'Net', 'MEDIA') -and $_.Manufacturer -ne 'Microsoft' } | Select-Object DeviceName, DriverVersion, Manufacturer, DeviceClass, DeviceID | ConvertTo-Json -Compress`
      const command = `chcp 65001 > nul && powershell -NoProfile -NonInteractive -Command "${psCommand.replace(/"/g, '\\"')}"`

      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 * 4 })

      if (!stdout || !stdout.trim()) {
        return { success: true, data: [] }
      }

      const parsed = JSON.parse(stdout.trim())
      const data = Array.isArray(parsed) ? parsed : [parsed]
      return { success: true, data }
    } catch (err: any) {
      console.error('[Drivers IPC] Failed to fetch system drivers:', err)
      return { success: false, error: err.message }
    }
  })

  // 2. Pobieranie listy dostępnych aktualizacji sterowników przez Winget
  ipcMain.handle('get-driver-updates', async () => {
    try {
      const psCommand = `Get-CimInstance Win32_PnPSignedDriver | Where-Object { $_.DeviceClass -in @('Display', 'Net', 'MEDIA') -and $_.Manufacturer -ne 'Microsoft' } | Select-Object DeviceName, DriverVersion, Manufacturer, DeviceClass, DeviceID | ConvertTo-Json -Compress`
      const command = `chcp 65001 > nul && powershell -NoProfile -NonInteractive -Command "${psCommand.replace(/"/g, '\\"')}"`

      const { stdout } = await execAsync(command, { maxBuffer: 1024 * 1024 * 4 })
      if (!stdout || !stdout.trim()) {
        return { success: true, data: [] }
      }

      const parsed = JSON.parse(stdout.trim())
      const installedDrivers = Array.isArray(parsed) ? parsed : [parsed]

      let wingetUpdates: any[] = []
      try {
        wingetUpdates = await checkForUpdatesInternal()
      } catch (err) {
        console.warn('[Drivers Updates] Failed to get updates from winget, using empty list:', err)
      }

      const updatesList: any[] = []

      for (const driver of installedDrivers) {
        const wingetId = mapHardwareToWinget(driver)
        if (!wingetId) continue

        const matchedUpgrade = wingetUpdates.find(
          (u) => u.id?.toLowerCase() === wingetId.toLowerCase()
        )
        if (matchedUpgrade) {
          updatesList.push({
            deviceName: driver.DeviceName,
            manufacturer: driver.Manufacturer,
            deviceClass: driver.DeviceClass,
            currentVersion: driver.DriverVersion || matchedUpgrade.version,
            availableVersion: matchedUpgrade.available,
            wingetId: wingetId,
            status: 'update_available'
          })
        }
      }

      return { success: true, data: updatesList }
    } catch (err: any) {
      console.error('[Drivers Updates IPC] Failed to fetch updates:', err)
      return { success: false, error: err.message }
    }
  })

  // 3. Wykonywanie cichej aktualizacji sterownika
  ipcMain.handle('upgrade-driver', async (_, wingetId: string) => {
    try {
      console.log(`[Driver Upgrade] Upgrading driver: ${wingetId}...`)
      const { stdout } = await runWinget(
        `upgrade --id ${wingetId} --silent --accept-package-agreements --accept-source-agreements`
      )
      return { success: true, data: stdout }
    } catch (err: any) {
      console.error(`[Driver Upgrade] Failed to upgrade driver ${wingetId}:`, err)
      return { success: false, error: err.message }
    }
  })

  // 4. Sprawdzanie obecności asystentów aktualizacji sterowników
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

  // 5. Uruchamianie asystenta aktualizacji sterowników
  ipcMain.handle('launch-driver-assistant', async (_, wingetId: string) => {
    const assistant = knownAssistants.find((a) => a.wingetId === wingetId)
    if (!assistant) {
      return { success: false, error: 'Nieznany asystent sterowników.' }
    }

    try {
      if (assistant.launchCmd) {
        exec(assistant.launchCmd)
        return { success: true }
      }

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
