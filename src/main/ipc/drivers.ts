import { ipcMain, dialog, BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import * as http from 'http'
import * as https from 'https'
import { URL } from 'url'
import { knownAssistants } from '../data/knownDrivers'
import { checkForUpdatesInternal, runWinget } from './winget'

const execAsync = promisify(exec)

const OFFLINE_PACK_URL = 'https://github.com/Marek-Zientek/updater-win/releases/download/v1.0.0/offline_network_drivers.zip'

function downloadFile(
  fileUrl: string,
  destPath: string,
  onProgress: (loaded: number, total: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    try {
      const urlParsed = new URL(fileUrl)
      const protocol = urlParsed.protocol === 'https:' ? https : http

      const request = protocol.get(fileUrl, (response) => {
        // Obsługa przekierowań
        if (
          response.statusCode &&
          response.statusCode >= 300 &&
          response.statusCode < 400 &&
          response.headers.location
        ) {
          downloadFile(response.headers.location, destPath, onProgress)
            .then(resolve)
            .catch(reject)
          return
        }

        if (response.statusCode !== 200) {
          reject(new Error(`Nieudane pobieranie. Kod statusu: ${response.statusCode}`))
          return
        }

        const totalBytes = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedBytes = 0

        const fileStream = fs.createWriteStream(destPath)
        response.pipe(fileStream)

        response.on('data', (chunk) => {
          downloadedBytes += chunk.length
          onProgress(downloadedBytes, totalBytes)
        })

        fileStream.on('finish', () => {
          fileStream.close()
          resolve()
        })

        fileStream.on('error', (err) => {
          fileStream.close()
          fs.unlink(destPath, () => {})
          reject(err)
        })
      })

      request.on('error', (err) => {
        fs.unlink(destPath, () => {})
        reject(err)
      })
    } catch (e) {
      reject(e)
    }
  })
}

function getOfflinePackPath(customFileName?: string): { dir: string; fullPath: string; fileName: string } {
  const fileName = customFileName || 'offline_network_drivers.zip'
  const exeDir = path.dirname(process.execPath)
  const cwdDir = process.cwd()
  
  let fullPath = path.join(exeDir, fileName)
  if (fs.existsSync(fullPath)) {
    return { dir: exeDir, fullPath, fileName }
  }
  
  fullPath = path.join(cwdDir, fileName)
  if (fs.existsSync(fullPath)) {
    return { dir: cwdDir, fullPath, fileName }
  }

  return { dir: cwdDir, fullPath: path.join(cwdDir, fileName), fileName }
}


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

  // 6. Eksport sterowników (Kopia zapasowa)
  ipcMain.handle('export-drivers', async () => {
    try {
      const focusWindow = BrowserWindow.getFocusedWindow()
      if (!focusWindow) return { success: false, error: 'Brak aktywnego okna aplikacji.' }

      const { canceled, filePaths } = await dialog.showOpenDialog(focusWindow, {
        title: 'Wybierz folder docelowy dla kopii sterowników',
        properties: ['openDirectory', 'createDirectory']
      })

      if (canceled || filePaths.length === 0) {
        return { success: true, canceled: true }
      }

      const targetDir = filePaths[0]
      console.log(`[Drivers IPC] Exporting drivers to: ${targetDir}`)

      const targetPathEscaped = targetDir.replace(/"/g, '\\"')
      const psCommand = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \\"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; pnputil /export-driver * \\'\\"${targetPathEscaped}\\'\\"\\"' -Verb RunAs -Wait`
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`
      
      await execAsync(command)
      return { success: true, canceled: false }
    } catch (err: any) {
      console.error('[Drivers IPC] Failed to export drivers:', err)
      return { success: false, error: err.message }
    }
  })

  // 7. Przywracanie sterowników z folderu/USB
  ipcMain.handle('restore-drivers', async () => {
    try {
      const focusWindow = BrowserWindow.getFocusedWindow()
      if (!focusWindow) return { success: false, error: 'Brak aktywnego okna aplikacji.' }

      const { canceled, filePaths } = await dialog.showOpenDialog(focusWindow, {
        title: 'Wybierz folder zawierający kopię sterowników (.inf)',
        properties: ['openDirectory']
      })

      if (canceled || filePaths.length === 0) {
        return { success: true, canceled: true }
      }

      const sourceDir = filePaths[0]
      console.log(`[Drivers IPC] Restoring drivers from: ${sourceDir}`)

      const sourcePathEscaped = sourceDir.replace(/"/g, '\\"')
      const psCommand = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \\"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; pnputil /add-driver \\'\\"${sourcePathEscaped}\\*.inf\\'\\" /subdirs /install\\"' -Verb RunAs -Wait`
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`

      await execAsync(command)
      return { success: true, canceled: false }
    } catch (err: any) {
      console.error('[Drivers IPC] Failed to restore drivers:', err)
      return { success: false, error: err.message }
    }
  })

  // 8. Wykrywanie folderu Windows.old
  ipcMain.handle('check-windows-old-drivers', async () => {
    try {
      const winOldPath = 'C:\\Windows.old\\Windows\\System32\\DriverStore\\FileRepository'
      const exists = fs.existsSync(winOldPath)
      return { success: true, exists, path: winOldPath }
    } catch (err: any) {
      return { success: false, error: err.message, exists: false }
    }
  })

  // 9. Przywracanie sterowników z Windows.old
  ipcMain.handle('restore-windows-old-drivers', async () => {
    try {
      const winOldPath = 'C:\\Windows.old\\Windows\\System32\\DriverStore\\FileRepository'
      if (!fs.existsSync(winOldPath)) {
        return { success: false, error: 'Folder Windows.old nie został odnaleziony.' }
      }

      console.log(`[Drivers IPC] Restoring drivers from Windows.old: ${winOldPath}`)
      const psCommand = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \\"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; pnputil /add-driver \\'\\"${winOldPath}\\*.inf\\'\\" /subdirs /install\\"' -Verb RunAs -Wait`
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`

      await execAsync(command)
      return { success: true }
    } catch (err: any) {
      console.error('[Drivers IPC] Failed to restore drivers from Windows.old:', err)
      return { success: false, error: err.message }
    }
  })

  // 10. Wyszukiwanie paczki ZIP sieciowej
  ipcMain.handle('check-offline-pack', async () => {
    try {
      const info = getOfflinePackPath()
      const exists = fs.existsSync(info.fullPath)
      return { success: true, exists, path: info.fullPath, fileName: info.fileName }
    } catch (err: any) {
      return { success: false, error: err.message, exists: false }
    }
  })

  // 11. Pobieranie paczki ZIP sieciowej
  let activeDownloadRequest: any = null
  ipcMain.handle('download-offline-pack', async (event) => {
    if (activeDownloadRequest) {
      return { success: false, error: 'Pobieranie jest już w toku.' }
    }

    const info = getOfflinePackPath()
    const dir = path.dirname(info.fullPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }

    const tempDest = info.fullPath + '.tmp'
    console.log(`[Drivers IPC] Starting offline pack download: ${OFFLINE_PACK_URL} -> ${tempDest}`)
    
    activeDownloadRequest = true

    try {
      await downloadFile(OFFLINE_PACK_URL, tempDest, (loaded, total) => {
        const percent = total > 0 ? Math.round((loaded / total) * 100) : 0
        event.sender.send('offline-pack-download-progress', {
          percent,
          loaded,
          total
        })
      })

      if (fs.existsSync(info.fullPath)) {
        fs.unlinkSync(info.fullPath)
      }
      fs.renameSync(tempDest, info.fullPath)
      activeDownloadRequest = null
      return { success: true, path: info.fullPath }
    } catch (err: any) {
      console.error('[Drivers IPC] Failed to download offline pack:', err)
      if (fs.existsSync(tempDest)) {
        fs.unlinkSync(tempDest)
      }
      activeDownloadRequest = null
      return { success: false, error: err.message }
    }
  })

  // 12. Wybór pliku ZIP ręcznie
  ipcMain.handle('pick-offline-pack-zip', async () => {
    try {
      const focusWindow = BrowserWindow.getFocusedWindow()
      if (!focusWindow) return { success: false, error: 'Brak aktywnego okna aplikacji.' }

      const { canceled, filePaths } = await dialog.showOpenDialog(focusWindow, {
        title: 'Wybierz pobrany plik ZIP ze sterownikami sieciowymi',
        filters: [{ name: 'Archiwum ZIP', extensions: ['zip'] }],
        properties: ['openFile']
      })

      if (canceled || filePaths.length === 0) {
        return { success: true, canceled: true }
      }

      return { success: true, canceled: false, filePath: filePaths[0] }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 13. Instalacja paczki ZIP sieciowej
  ipcMain.handle('install-offline-pack', async (_, customPath?: string) => {
    try {
      let zipPath = ''
      if (customPath) {
        zipPath = customPath
      } else {
        const info = getOfflinePackPath()
        zipPath = info.fullPath
      }

      if (!fs.existsSync(zipPath)) {
        return { success: false, error: `Nie odnaleziono pliku ZIP sterowników w ścieżce: ${zipPath}` }
      }

      console.log(`[Drivers IPC] Installing offline drivers from ZIP: ${zipPath}`)
      const tempExtractDir = path.join(process.env.TEMP || 'C:\\Windows\\Temp', 'updaterwin_network_drivers')
      
      const tempExtractDirEscaped = tempExtractDir.replace(/"/g, '\\"')
      const zipPathEscaped = zipPath.replace(/"/g, '\\"')

      const psScript = 
        `New-Item -ItemType Directory -Force -Path \\'\\"${tempExtractDirEscaped}\\'\\"; ` +
        `Expand-Archive -Path \\'\\"${zipPathEscaped}\\'\\" -DestinationPath \\'\\"${tempExtractDirEscaped}\\'\\" -Force; ` +
        `pnputil /add-driver \\'\\"${tempExtractDirEscaped}\\*.inf\\'\\" /subdirs /install; ` +
        `Remove-Item -Path \\'\\"${tempExtractDirEscaped}\\'\\" -Recurse -Force`

      const psCommand = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command \\"[Console]::OutputEncoding = [System.Text.Encoding]::UTF8; ${psScript}\\"' -Verb RunAs -Wait`
      const command = `powershell -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`

      await execAsync(command)
      return { success: true }
    } catch (err: any) {
      console.error('[Drivers IPC] Failed to install offline pack:', err)
      return { success: false, error: err.message }
    }
  })
}
