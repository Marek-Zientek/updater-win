import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

const domainsList = [
  'vortex-win.data.microsoft.com',
  'settings-win.data.microsoft.com',
  'telemetry.microsoft.com',
  'watson.telemetry.microsoft.com',
  'diagnostics.support.microsoft.com',
  'corp.sts.microsoft.com',
  'statsfe1.ws.microsoft.com',
  'statsfe2.ws.microsoft.com',
  'feedback.windows.com',
  'telemetry.urs.microsoft.com',
  'events.gfe.nvidia.com',
  'telemetry.nvidia.com',
  'gfe.nvidia.com',
  'adobeipm.adobe.com',
  'cc-api-data.adobe.com'
]

async function isHostsTelemetryBlocked(): Promise<boolean> {
  try {
    const hostsPath = 'C:\\Windows\\System32\\drivers\\etc\\hosts'
    if (!fs.existsSync(hostsPath)) return false
    const content = await fs.promises.readFile(hostsPath, 'utf8')
    return content.includes('vortex-win.data.microsoft.com')
  } catch (err) {
    return false
  }
}

async function toggleHostsTelemetry(enabled: boolean): Promise<boolean> {
  const domainsStr = domainsList.map(d => `'${d}'`).join(', ')
  
  let innerScript = ''
  if (enabled) {
    innerScript = `
      $path = 'C:\\Windows\\System32\\drivers\\etc\\hosts'
      $content = Get-Content -Path $path -ErrorAction SilentlyContinue
      if ($content) {
          $domains = @(${domainsStr})
          $newContent = $content | Where-Object {
              $line = $_
              $match = $false
              foreach ($d in $domains) {
                  if ($line -like "*$d*") { $match = $true; break }
              }
              -not $match
          }
          $newContent | Set-Content -Path $path -Force
      }
    `
  } else {
    innerScript = `
      $path = 'C:\\Windows\\System32\\drivers\\etc\\hosts'
      $content = Get-Content -Path $path -ErrorAction SilentlyContinue
      $domains = @(${domainsStr})
      $newContent = @()
      if ($content) {
          $newContent = $content | Where-Object {
              $line = $_
              $match = $false
              foreach ($d in $domains) {
                  if ($line -like "*$d*") { $match = $true; break }
              }
              -not $match
          }
      }
      $newContent | Set-Content -Path $path -Force
      foreach ($d in $domains) {
          Add-Content -Path $path -Value "127.0.0.1 $d" -Force
      }
    `
  }

  const psCommand = `Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command "${innerScript.replace(/\n/g, '; ').replace(/"/g, '\\"')}"' -Verb RunAs -WindowStyle Hidden -Wait`
  await execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`)
  return true
}

// Pomocnicze funkcje do obliczania i usuwania plików
async function getDirectorySize(dirPath: string): Promise<number> {
  let totalSize = 0
  try {
    const files = await fs.promises.readdir(dirPath, { withFileTypes: true })
    for (const file of files) {
      const filePath = path.join(dirPath, file.name)
      if (file.isDirectory()) {
        totalSize += await getDirectorySize(filePath)
      } else if (file.isFile()) {
        try {
          const stats = await fs.promises.stat(filePath)
          totalSize += stats.size
        } catch {
          // Plik może być zablokowany lub usunięty
        }
      }
    }
  } catch {
    // Brak uprawnień do katalogu lub folder nie istnieje
  }
  return totalSize
}

async function cleanDirectory(dirPath: string): Promise<number> {
  let cleanedBytes = 0
  try {
    const files = await fs.promises.readdir(dirPath, { withFileTypes: true })
    for (const file of files) {
      const filePath = path.join(dirPath, file.name)
      try {
        if (file.isDirectory()) {
          cleanedBytes += await cleanDirectory(filePath)
          try {
            await fs.promises.rmdir(filePath)
          } catch {
            // Folder może nie być pusty przez zablokowane pliki
          }
        } else if (file.isFile()) {
          const stats = await fs.promises.stat(filePath)
          await fs.promises.unlink(filePath)
          cleanedBytes += stats.size
        }
      } catch {
        // Plik zablokowany przez system lub otwartą aplikację — pomijamy
      }
    }
  } catch {
    // Folder nie istnieje lub brak uprawnień
  }
  return cleanedBytes
}

// Pobieranie ścieżek cache przeglądarek
function getBrowserCachePaths(): string[] {
  const paths: string[] = []
  const localAppData = process.env.LOCALAPPDATA || ''

  if (localAppData) {
    // Chrome Cache
    paths.push(path.join(localAppData, 'Google', 'Chrome', 'User Data', 'Default', 'Cache'))
    // Edge Cache
    paths.push(path.join(localAppData, 'Microsoft', 'Edge', 'User Data', 'Default', 'Cache'))

    // Firefox Cache (Profiles folder)
    const ffProfilesPath = path.join(localAppData, 'Mozilla', 'Firefox', 'Profiles')
    if (fs.existsSync(ffProfilesPath)) {
      try {
        const profiles = fs.readdirSync(ffProfilesPath)
        for (const p of profiles) {
          const cachePath = path.join(ffProfilesPath, p, 'cache2')
          if (fs.existsSync(cachePath)) {
            paths.push(cachePath)
          }
        }
      } catch {
        // Ignoruj
      }
    }
  }
  return paths
}

export function setupOptimizerIPC(): void {
  // 1. Pobieranie statystyk czyszczenia dysku
  ipcMain.handle('get-cleanup-stats', async () => {
    try {
      const userTemp = process.env.TEMP || ''
      const systemTemp = 'C:\\Windows\\Temp'
      const systemLogs = 'C:\\Windows\\Logs'
      const prefetch = 'C:\\Windows\\Prefetch'
      const updateCache = 'C:\\Windows\\SoftwareDistribution\\Download'

      const [tempSize, systemTempSize, systemLogSize, prefetchSize, updateCacheSize, browserCachePaths] = await Promise.all([
        userTemp ? getDirectorySize(userTemp) : Promise.resolve(0),
        getDirectorySize(systemTemp),
        getDirectorySize(systemLogs),
        getDirectorySize(prefetch),
        getDirectorySize(updateCache),
        Promise.resolve(getBrowserCachePaths())
      ])

      const logSize = systemTempSize + systemLogSize
      const finalTempSize = tempSize + updateCacheSize

      let cacheSize = 0
      for (const p of browserCachePaths) {
        cacheSize += await getDirectorySize(p)
      }
      cacheSize += prefetchSize

      return {
        success: true,
        data: {
          tempSize: finalTempSize,
          logSize,
          cacheSize
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 2. Wykonywanie czyszczenia dysku
  ipcMain.handle('run-cleanup', async () => {
    try {
      const userTemp = process.env.TEMP || ''
      const systemTemp = 'C:\\Windows\\Temp'
      const prefetch = 'C:\\Windows\\Prefetch'
      const updateCache = 'C:\\Windows\\SoftwareDistribution\\Download'
      const browserCachePaths = getBrowserCachePaths()

      let cleanedBytes = 0

      // Czyść po kolei i sumuj bajty
      if (userTemp) {
        cleanedBytes += await cleanDirectory(userTemp)
      }
      cleanedBytes += await cleanDirectory(systemTemp)

      for (const p of browserCachePaths) {
        cleanedBytes += await cleanDirectory(p)
      }

      // Czyść Windows Update Download Cache (bez UAC jeśli się uda)
      cleanedBytes += await cleanDirectory(updateCache)

      // Czyść Prefetch i głębokie pozostałości (wymaga UAC)
      try {
        const pSize = await getDirectorySize(prefetch)
        const uSize = await getDirectorySize(updateCache)

        const cleanCommand = `
          Remove-Item -Path '${prefetch}\\*' -Recurse -Force -ErrorAction SilentlyContinue
          Remove-Item -Path '${updateCache}\\*' -Recurse -Force -ErrorAction SilentlyContinue
        `
        const elevatedCommand = `Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command "${cleanCommand.replace(/\n/g, '; ')}"' -Verb RunAs -WindowStyle Hidden -Wait`
        
        await execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${elevatedCommand}"`)
        cleanedBytes += (pSize + uSize)
      } catch (err) {
        console.error('[Cleaner] Elevated clean failed or canceled:', err)
      }

      return { success: true, cleanedBytes }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 3. Pobieranie programów z autostartu (HKCU Run)
  ipcMain.handle('get-startup-apps', async () => {
    const psCommand = `
      $runKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
      $items = @()
      if (Test-Path $runKey) {
          $val = Get-Item -Path $runKey
          $val.GetValueNames() | ForEach-Object {
              $cmd = $val.GetValue($_)
              $isEnabled = -not $_.StartsWith('Disabled-')
              $cleanName = if ($isEnabled) { $_ } else { $_.Substring(9) }
              $items += [PSCustomObject]@{
                  rawName = $_
                  name = $cleanName
                  command = $cmd
                  enabled = $isEnabled
                  location = 'HKCU'
              }
          }
      }
      $items | ConvertTo-Json
    `
    try {
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
      )

      if (!stdout || stdout.trim() === '') {
        return { success: true, data: [] }
      }

      const data = JSON.parse(stdout)
      const apps = Array.isArray(data) ? data : [data]

      return { success: true, data: apps }
    } catch (error: any) {
      // Jeśli PowerShell nie zwrócił JSON (brak elementów lub błąd)
      return { success: true, data: [] }
    }
  })

  // 4. Włączanie/wyłączanie programów z autostartu
  ipcMain.handle('toggle-startup-app', async (_, name: string, enabled: boolean) => {
    if (!name) return { success: false, error: 'Brak nazwy aplikacji.' }

    const psCommand = `
      $runKey = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Run'
      $name = '${name}'
      $enabled = $${enabled ? 'true' : 'false'}

      if ($enabled) {
          $rawDisabled = 'Disabled-' + $name
          $cmd = (Get-ItemProperty -Path $runKey).$rawDisabled
          if ($cmd) {
              Remove-ItemProperty -Path $runKey -Name $rawDisabled
              Set-ItemProperty -Path $runKey -Name $name -Value $cmd
          }
      } else {
          $cmd = (Get-ItemProperty -Path $runKey).$name
          if ($cmd) {
              Remove-ItemProperty -Path $runKey -Name $name
              $rawDisabled = 'Disabled-' + $name
              Set-ItemProperty -Path $runKey -Name $rawDisabled -Value $cmd
          }
      }
    `

    try {
      await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
      )
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 5. Pobieranie ustawień prywatności i telemetrii
  ipcMain.handle('get-privacy-settings', async () => {
    const psCommand = `
      $diagTrack = Get-Service -Name DiagTrack -ErrorAction SilentlyContinue
      $telemetry = if ($diagTrack) { $diagTrack.StartType -ne 'Disabled' } else { $false }

      $werSvc = Get-Service -Name WerSvc -ErrorAction SilentlyContinue
      $errorReporting = if ($werSvc) { $werSvc.StartType -ne 'Disabled' } else { $false }

      $search = Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search' -ErrorAction SilentlyContinue
      $cortana = if ($search) {
          if ($search.CortanaConsent -eq 0 -or $search.BingSearchEnabled -eq 0) { $false } else { $true }
      } else { $true }

      $cdm = Get-ItemProperty -Path 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager' -ErrorAction SilentlyContinue
      $ads = if ($cdm) {
          if ($cdm.SilentInstalledAppsEnabled -eq 0 -and $cdm.SystemPaneSuggestionsEnabled -eq 0) { $false } else { $true }
      } else { $true }

      [PSCustomObject]@{
          telemetry = $telemetry
          errorReporting = $errorReporting
          cortana = $cortana
          ads = $ads
      } | ConvertTo-Json
    `
    try {
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
      )
      const data = JSON.parse(stdout.trim())
      
      const hostsBlocked = await isHostsTelemetryBlocked()
      data.hostsTelemetry = !hostsBlocked

      return { success: true, data }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 6. Przełączanie ustawień prywatności
  ipcMain.handle('toggle-privacy-setting', async (_, key: string, enabled: boolean) => {
    try {
      if (key === 'hostsTelemetry') {
        await toggleHostsTelemetry(enabled)
        return { success: true, elevated: true }
      }
      if (key === 'telemetry' || key === 'errorReporting') {
        const serviceName = key === 'telemetry' ? 'DiagTrack' : 'WerSvc'
        const startupType = enabled ? (key === 'telemetry' ? 'Automatic' : 'Manual') : 'Disabled'
        const statusCmd = enabled ? `Start-Service -Name ${serviceName}` : `Stop-Service -Name ${serviceName} -Force`

        const directCommand = `Set-Service -Name ${serviceName} -StartupType ${startupType}; ${statusCmd}`

        try {
          // Próba wykonania bezpośrednio (jeśli mamy uprawnienia)
          await execAsync(
            `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${directCommand}"`
          )
          return { success: true }
        } catch (execErr: any) {
          // Jeśli brak uprawnień administracyjnych (np. Access Denied), wywołujemy UAC prompt
          console.log(`[Optimizer] Direct toggling of service ${serviceName} failed. Requesting UAC elevation...`)
          
          const elevatedCommand = `Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command "Set-Service -Name ${serviceName} -StartupType ${startupType}; ${statusCmd}"' -Verb RunAs -WindowStyle Hidden`
          
          await execAsync(
            `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${elevatedCommand}"`
          )
          return { success: true, elevated: true }
        }
      } else if (key === 'cortana') {
        const val = enabled ? 1 : 0
        const psCommand = `
          $path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Search'
          if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
          Set-ItemProperty -Path $path -Name 'CortanaConsent' -Value ${val} -Type DWord -Force | Out-Null
          Set-ItemProperty -Path $path -Name 'BingSearchEnabled' -Value ${val} -Type DWord -Force | Out-Null
        `
        await execAsync(
          `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
        )
        return { success: true }
      } else if (key === 'ads') {
        const val = enabled ? 1 : 0
        const psCommand = `
          $path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\ContentDeliveryManager'
          if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
          Set-ItemProperty -Path $path -Name 'SilentInstalledAppsEnabled' -Value ${val} -Type DWord -Force | Out-Null
          Set-ItemProperty -Path $path -Name 'SystemPaneSuggestionsEnabled' -Value ${val} -Type DWord -Force | Out-Null
          Set-ItemProperty -Path $path -Name 'SubscribedContent-338388Enabled' -Value ${val} -Type DWord -Force | Out-Null
          Set-ItemProperty -Path $path -Name 'SubscribedContent-338389Enabled' -Value ${val} -Type DWord -Force | Out-Null
        `
        await execAsync(
          `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
        )
        return { success: true }
      } else {
        return { success: false, error: `Nieznany klucz ustawienia: ${key}` }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
