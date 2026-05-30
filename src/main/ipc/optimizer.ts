import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { getSettingInternal, saveSettingInternal } from './settings'
import si from 'systeminformation'

const DEFAULT_GAMES = [
  { name: 'Cyberpunk 2077', exe: 'Cyberpunk2077.exe' },
  { name: 'Counter-Strike 2', exe: 'cs2.exe' },
  { name: 'Wiedźmin 3: Dziki Gon', exe: 'witcher3.exe' },
  { name: 'League of Legends', exe: 'League of Legends.exe' },
  { name: 'Valorant', exe: 'VALORANT-Win64-Shipping.exe' },
  { name: 'Fortnite', exe: 'FortniteClient-Win64-Shipping.exe' },
  { name: 'Apex Legends', exe: 'r5apex.exe' },
  { name: 'Grand Theft Auto V', exe: 'GTA5.exe' },
  { name: 'Minecraft', exe: 'javaw.exe' }
]

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

async function isGameBoosterActive(): Promise<boolean> {
  if (process.platform !== 'win32') return false
  try {
    const active = await getSettingInternal('game_booster_active', 'false')
    return active === 'true'
  } catch {
    return false
  }
}

// Wyszukiwanie zainstalowanych gier Steam
async function getSteamGames(): Promise<{ name: string; exe: string }[]> {
  const games: { name: string; exe: string }[] = []
  if (process.platform !== 'win32') return games

  try {
    let steamPath = 'C:\\Program Files (x86)\\Steam'
    try {
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "(Get-ItemProperty -Path 'HKCU:\\Software\\Valve\\Steam').SteamPath"`
      )
      const p = stdout.trim()
      if (p && fs.existsSync(p)) {
        steamPath = p
      }
    } catch (e) {
      // Ignoruj, użyjemy domyślnej ścieżki
    }

    const libraryFoldersPath = path.join(steamPath, 'steamapps', 'libraryfolders.vdf')
    if (!fs.existsSync(libraryFoldersPath)) {
      return games
    }

    const content = await fs.promises.readFile(libraryFoldersPath, 'utf8')
    const matches = content.match(/"path"\s+"([^"]+)"/g)
    const libraryPaths: string[] = [steamPath]
    if (matches) {
      for (const m of matches) {
        const cleanPath = m
          .replace(/"path"\s+"/, '')
          .replace(/"/, '')
          .replace(/\\\\/g, '\\')
        if (fs.existsSync(cleanPath)) {
          libraryPaths.push(cleanPath)
        }
      }
    }

    for (const libPath of libraryPaths) {
      const appsPath = path.join(libPath, 'steamapps')
      if (!fs.existsSync(appsPath)) continue

      const files = await fs.promises.readdir(appsPath)
      const manifests = files.filter((f) => f.startsWith('appmanifest_') && f.endsWith('.acf'))

      for (const manifest of manifests) {
        try {
          const manifestContent = await fs.promises.readFile(path.join(appsPath, manifest), 'utf8')
          const nameMatch = manifestContent.match(/"name"\s+"([^"]+)"/)
          const dirMatch = manifestContent.match(/"installdir"\s+"([^"]+)"/)

          if (nameMatch && dirMatch) {
            const name = nameMatch[1]
            const dirName = dirMatch[1]
            const gameDir = path.join(appsPath, 'common', dirName)

            if (fs.existsSync(gameDir)) {
              const gameFiles = await fs.promises.readdir(gameDir, { withFileTypes: true })
              const exes = gameFiles.filter(
                (f) => f.isFile() && f.name.toLowerCase().endsWith('.exe')
              )

              if (exes.length > 0) {
                const mainExes = exes.filter((f) => {
                  const n = f.name.toLowerCase()
                  return (
                    !n.includes('crash') &&
                    !n.includes('reporter') &&
                    !n.includes('setup') &&
                    !n.includes('install') &&
                    !n.includes('unity') &&
                    !n.includes('unins') &&
                    !n.includes('config')
                  )
                })

                const targetExe = mainExes.length > 0 ? mainExes[0].name : exes[0].name
                games.push({ name, exe: targetExe })
              }
            }
          }
        } catch (e) {
          // Ignoruj uszkodzone pliki manifestu
        }
      }
    }
  } catch (err) {
    console.error('[Steam Games Scanner] Error scanning:', err)
  }

  const uniqueGames = new Map<string, { name: string; exe: string }>()
  for (const g of games) {
    uniqueGames.set(g.exe.toLowerCase(), g)
  }
  return Array.from(uniqueGames.values())
}

// Logika włączania/wyłączania Trybu Gry
export async function toggleGameBoosterInternal(enable: boolean): Promise<{ success: boolean; active: boolean; error?: string }> {
  if (process.platform !== 'win32') {
    return { success: false, active: false, error: 'Ta funkcja jest dostępna tylko w systemie Windows.' }
  }

  try {
    if (enable) {
      const psGetPlan = `
        (Get-CimInstance -Namespace root\\cimv2\\power -ClassName Win32_PowerPlan | Where-Object { $_.IsActive }).ElementID
      `
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psGetPlan.trim()}"`
      )
      const currentPlan = stdout.trim()
      if (currentPlan && currentPlan !== 'e9a22b07-e21a-477b-8a17-8e654d93c6b2') {
        await saveSettingInternal('original_power_plan_guid', currentPlan)
      }

      const enableScript = `
        $ultimateGuid = 'e9a22b07-e21a-477b-8a17-8e654d93c6b2'
        $plan = Get-CimInstance -Namespace root\\cimv2\\power -ClassName Win32_PowerPlan | Where-Object { $_.ElementID -eq $ultimateGuid }
        if (-not $plan) {
            powercfg /duplicate-scheme $ultimateGuid | Out-Null
        }
        powercfg /setactive $ultimateGuid | Out-Null

        $interfaces = Get-ChildItem -Path "HKLM:\\System\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" -ErrorAction SilentlyContinue
        if ($interfaces) {
            foreach ($i in $interfaces) {
                Set-ItemProperty -Path $i.PSPath -Name "TcpAckFrequency" -Value 1 -Type DWord -ErrorAction SilentlyContinue | Out-Null
                Set-ItemProperty -Path $i.PSPath -Name "TCPNoDelay" -Value 1 -Type DWord -ErrorAction SilentlyContinue | Out-Null
            }
        }

        Stop-Service -Name SysMain -Force -ErrorAction SilentlyContinue | Out-Null
        Stop-Service -Name Spooler -Force -ErrorAction SilentlyContinue | Out-Null
      `

      const psCommand = `Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command "${enableScript.replace(/\n/g, '; ').replace(/"/g, '\\"')}"' -Verb RunAs -WindowStyle Hidden -Wait`
      await execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`)
      await saveSettingInternal('game_booster_active', 'true')
      return { success: true, active: true }
    } else {
      const originalPlan = await getSettingInternal('original_power_plan_guid', '381b4222-f694-41f0-9685-ff5bb260df2e')

      const disableScript = `
        powercfg /setactive ${originalPlan} | Out-Null

        $interfaces = Get-ChildItem -Path "HKLM:\\System\\CurrentControlSet\\Services\\Tcpip\\Parameters\\Interfaces" -ErrorAction SilentlyContinue
        if ($interfaces) {
            foreach ($i in $interfaces) {
                Remove-ItemProperty -Path $i.PSPath -Name "TcpAckFrequency" -ErrorAction SilentlyContinue | Out-Null
                Remove-ItemProperty -Path $i.PSPath -Name "TCPNoDelay" -ErrorAction SilentlyContinue | Out-Null
            }
        }

        Start-Service -Name SysMain -ErrorAction SilentlyContinue | Out-Null
        Start-Service -Name Spooler -ErrorAction SilentlyContinue | Out-Null
      `

      const psCommand = `Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command "${disableScript.replace(/\n/g, '; ').replace(/"/g, '\\"')}"' -Verb RunAs -WindowStyle Hidden -Wait`
      await execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`)
      await saveSettingInternal('game_booster_active', 'false')
      return { success: true, active: false }
    }
  } catch (error: any) {
    return { success: false, active: !enable, error: error.message }
  }
}

// Aplikowanie optymalizacji na procesie gry
async function applyProcessOptimizations(exe: string): Promise<void> {
  try {
    const processName = exe.endsWith('.exe') ? exe.slice(0, -4) : exe

    // 1. Priorytetyzacja CPU (High Priority)
    const highPriorityEnabled = await getSettingInternal('game_booster_high_priority', 'false')
    if (highPriorityEnabled === 'true') {
      console.log(`[Game Booster Optimizer] Setting priority of ${processName} to High...`)
      const psPriority = `Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | ForEach-Object { $_.PriorityClass = 'High' }`
      await execAsync(`powershell -NoProfile -NonInteractive -Command "${psPriority}"`)
    }

    // 2. Koligacja rdzeni CPU (P-Cores only)
    const optimizeCoresEnabled = await getSettingInternal('game_booster_optimize_cores', 'false')
    if (optimizeCoresEnabled === 'true') {
      const siCpu = await si.cpu()
      const logical = siCpu.processors || 1
      const physical = siCpu.physicalCores || 1

      // Wyliczanie rdzeni P dla procesorów hybrydowych Intel
      const pCoresCount = logical - physical

      if (pCoresCount > 0 && logical > physical) {
        const pCoreThreads = 2 * pCoresCount
        let affinityMask = 0
        for (let i = 0; i < pCoreThreads; i++) {
          affinityMask += Math.pow(2, i)
        }

        console.log(`[Game Booster Optimizer] CPU Hybrid detected: ${pCoresCount} P-Cores (${pCoreThreads} threads). Setting affinity mask of ${processName} to ${affinityMask}...`)
        const psAffinity = `Get-Process -Name "${processName}" -ErrorAction SilentlyContinue | ForEach-Object { $_.ProcessorAffinity = ${affinityMask} }`
        await execAsync(`powershell -NoProfile -NonInteractive -Command "${psAffinity}"`)
      }
    }
  } catch (err) {
    console.error(`[Game Booster Optimizer] Failed to apply process optimizations:`, err)
  }
}

let scannerInterval: NodeJS.Timeout | null = null
let isGameCurrentlyRunning = false
let activeRunningGameExe = ''

export function startGameScanner(): void {
  if (scannerInterval) return

  scannerInterval = setInterval(async () => {
    try {
      const autoActivate = await getSettingInternal('game_booster_auto_activate', 'false')
      if (autoActivate !== 'true') {
        if (isGameCurrentlyRunning) {
          isGameCurrentlyRunning = false
          activeRunningGameExe = ''
        }
        return
      }

      const customGamesStr = await getSettingInternal('game_booster_custom_games', '[]')
      const customGames: { name: string; exe: string }[] = JSON.parse(customGamesStr)
      const steamGames = await getSteamGames()

      const allMonitoredExes = new Set<string>()
      DEFAULT_GAMES.forEach((g) => allMonitoredExes.add(g.exe.toLowerCase()))
      customGames.forEach((g) => allMonitoredExes.add(g.exe.toLowerCase()))
      steamGames.forEach((g) => allMonitoredExes.add(g.exe.toLowerCase()))

      if (allMonitoredExes.size === 0) return

      const psCommand = `Get-Process | Select-Object -ExpandProperty ProcessName`
      const { stdout } = await execAsync(
        `powershell -NoProfile -NonInteractive -Command "${psCommand}"`
      )

      const runningProcesses = new Set(
        stdout
          .split('\n')
          .map((p) => p.trim().toLowerCase())
          .filter(Boolean)
      )

      let foundRunningGameExe = ''
      for (const exe of allMonitoredExes) {
        const nameWithoutExe = exe.endsWith('.exe') ? exe.slice(0, -4) : exe
        if (runningProcesses.has(nameWithoutExe.toLowerCase())) {
          foundRunningGameExe = exe
          break
        }
      }

      if (foundRunningGameExe) {
        if (!isGameCurrentlyRunning) {
          console.log(`[Game Booster Scanner] Detected running game: ${foundRunningGameExe}`)
          isGameCurrentlyRunning = true
          activeRunningGameExe = foundRunningGameExe

          const activeStatus = await isGameBoosterActive()
          if (!activeStatus) {
            console.log(`[Game Booster Scanner] Automatically activating Game Booster...`)
            await toggleGameBoosterInternal(true)
          }

          await applyProcessOptimizations(foundRunningGameExe)
        }
      } else {
        if (isGameCurrentlyRunning) {
          console.log(`[Game Booster Scanner] Game stopped running: ${activeRunningGameExe}`)
          isGameCurrentlyRunning = false
          activeRunningGameExe = ''

          const activeStatus = await isGameBoosterActive()
          if (activeStatus) {
            console.log(`[Game Booster Scanner] Automatically deactivating Game Booster...`)
            await toggleGameBoosterInternal(false)
          }
        }
      }
    } catch (err) {
      console.error('[Game Booster Scanner] Error in scan cycle:', err)
    }
  }, 5000)
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

  // 7. Status trybu gry (Game Booster)
  ipcMain.handle('get-game-booster-status', async () => {
    try {
      const active = await isGameBoosterActive()
      return { success: true, active }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 8. Przełączanie trybu gry (Game Booster)
  ipcMain.handle('toggle-game-booster', async (_, enable: boolean) => {
    return await toggleGameBoosterInternal(enable)
  })

  // 9. Pobieranie listy gier i ich statusu uruchomienia
  ipcMain.handle('get-monitored-games', async () => {
    try {
      const customGamesStr = await getSettingInternal('game_booster_custom_games', '[]')
      const customGames: { name: string; exe: string }[] = JSON.parse(customGamesStr)
      const steamGames = await getSteamGames()

      const gamesMap = new Map<
        string,
        { id: string; name: string; exe: string; source: string; running: boolean }
      >()

      DEFAULT_GAMES.forEach((g) => {
        gamesMap.set(g.exe.toLowerCase(), {
          id: 'default_' + g.exe,
          name: g.name,
          exe: g.exe,
          source: 'default',
          running: false
        })
      })

      steamGames.forEach((g) => {
        gamesMap.set(g.exe.toLowerCase(), {
          id: 'steam_' + g.exe,
          name: g.name,
          exe: g.exe,
          source: 'steam',
          running: false
        })
      })

      customGames.forEach((g) => {
        gamesMap.set(g.exe.toLowerCase(), {
          id: 'custom_' + g.exe,
          name: g.name,
          exe: g.exe,
          source: 'custom',
          running: false
        })
      })

      try {
        const psCommand = `Get-Process | Select-Object -ExpandProperty ProcessName`
        const { stdout } = await execAsync(
          `powershell -NoProfile -NonInteractive -Command "${psCommand}"`
        )
        const runningProcesses = new Set(
          stdout
            .split('\n')
            .map((p) => p.trim().toLowerCase())
            .filter(Boolean)
        )

        for (const game of gamesMap.values()) {
          const nameWithoutExe = game.exe.endsWith('.exe') ? game.exe.slice(0, -4) : game.exe
          if (runningProcesses.has(nameWithoutExe.toLowerCase())) {
            game.running = true
          }
        }
      } catch (err) {
        console.error('[Optimizer IPC] Failed to fetch running processes:', err)
      }

      return { success: true, data: Array.from(gamesMap.values()) }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 10. Dodawanie własnej gry
  ipcMain.handle('add-custom-game', async (_, game: { name: string; exe: string }) => {
    if (!game || !game.exe) return { success: false, error: 'Błędne dane aplikacji.' }
    try {
      const customGamesStr = await getSettingInternal('game_booster_custom_games', '[]')
      const customGames: { name: string; exe: string }[] = JSON.parse(customGamesStr)

      if (customGames.some((g) => g.exe.toLowerCase() === game.exe.toLowerCase())) {
        return { success: false, error: 'Ta gra jest już na liście.' }
      }

      customGames.push(game)
      await saveSettingInternal('game_booster_custom_games', JSON.stringify(customGames))
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 11. Usuwanie własnej gry
  ipcMain.handle('delete-custom-game', async (_, exe: string) => {
    if (!exe) return { success: false, error: 'Brak nazwy pliku wykonywalnego.' }
    try {
      const customGamesStr = await getSettingInternal('game_booster_custom_games', '[]')
      const customGames: { name: string; exe: string }[] = JSON.parse(customGamesStr)

      const filtered = customGames.filter((g) => g.exe.toLowerCase() !== exe.toLowerCase())
      await saveSettingInternal('game_booster_custom_games', JSON.stringify(filtered))
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Uruchomienie skanera procesów gier w tle
  startGameScanner()
}

