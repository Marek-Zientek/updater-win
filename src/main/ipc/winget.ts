import { ipcMain, Notification } from 'electron'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'
import { prisma } from '../db'
import { knownApps } from '../data/knownApps'
import { preflightDownloadCheck } from './download-guard'
import { getSettingInternal, saveSettingInternal } from './settings'

const execAsync = promisify(exec)

let cachedWingetPath: string | null = null

/**
 * Buduje środowisko z PATH zawierającym katalog WindowsApps.
 * Electron child_process.exec nie dziedziczy pełnego PATH Windows,
 * przez co 'winget' może być niedostępny nawet jeśli jest zainstalowany.
 */
function buildWingetEnv(): NodeJS.ProcessEnv {
  const localAppData = process.env.LOCALAPPDATA || ''
  const windowsAppsPath = `${localAppData}\\Microsoft\\WindowsApps`
  return {
    ...process.env,
    PATH: `${windowsAppsPath};${process.env.PATH || ''}`
  }
}

export async function runWinget(args: string) {
  const localAppData = process.env.LOCALAPPDATA || ''
  const env = buildWingetEnv()
  const execOptions = { maxBuffer: 1024 * 1024 * 4, env }

  if (cachedWingetPath) {
    const baseCommand =
      cachedWingetPath === 'winget' ? `winget ${args}` : `"${cachedWingetPath}" ${args}`
    const command = `chcp 65001 > nul && ${baseCommand}`
    try {
      return await execAsync(command, execOptions)
    } catch (cacheErr: any) {
      const errMsg = (cacheErr?.message || '').toLowerCase()
      // Reset cache TYLKO gdy błąd to "nie znaleziono pliku" (stary lub zły path)
      // Jeśli winget działał ale zwrócił błąd runtime (UAC, sieć, etc.) — path jest poprawny, rzucamy od razu
      const isPathNotFound =
        errMsg.includes('not recognized') ||
        errMsg.includes('not found') ||
        errMsg.includes('enoent') ||
        errMsg.includes('cannot find the path') ||
        errMsg.includes('is not recognized')
      if (isPathNotFound) {
        console.warn('[Winget] Cached path invalid (not found), resetting cache...')
        cachedWingetPath = null
      } else {
        // Path działał — błąd pochodzi z samego winget (UAC, pobieranie, etc.)
        // Rzucamy natychmiast bez zbędnych retry
        throw cacheErr
      }
    }
  }

  // LOCALAPPDATA i USERPROFILE\AppData\Local wskazują na ten sam katalog na Windows — tylko jedna ścieżka
  const paths = [`${localAppData}\\Microsoft\\WindowsApps\\winget.exe`, 'winget']

  let lastError: any = null

  for (const wingetPath of paths) {
    if (!wingetPath) continue
    try {
      const baseCommand = wingetPath === 'winget' ? `winget ${args}` : `"${wingetPath}" ${args}`
      const command = `chcp 65001 > nul && ${baseCommand}`
      const result = await execAsync(command, execOptions)
      cachedWingetPath = wingetPath
      console.log(`[Winget] Found at: ${wingetPath}`)
      return result
    } catch (err: any) {
      console.warn(`[Winget] Path failed: ${wingetPath} — ${err.message?.substring(0, 80)}`)
      lastError = err
    }
  }

  throw lastError || new Error('Nie odnaleziono narzędzia winget w systemie.')
}

/**
 * Weryfikuje czy ciąg znaków wygląda jak prawidłowy winget Package ID.
 * Winget ID ma zawsze format: Publisher.PackageName (np. Mozilla.Firefox, Microsoft.VSCode)
 * Odrzuca: czyste liczby (np. 11.56), same cyfry z kropką, etc.
 */
function isValidWingetId(id: string): boolean {
  if (!id || id.length < 3) return false
  // Nie może być URL
  if (id.startsWith('http')) return false
  // Odrzucamy czyste numery wersji (np. 11.56, 1.2.3.4, v1.0.0)
  const isVersion = /^[vV]?\d+(?:\.\d+)+[a-zA-Z]?$/.test(id) || /^\d+$/.test(id)
  if (isVersion) return false
  return true
}

const resolvedIdCache = new Map<string, string | null>()

function parseSearchOutput(stdout: string): { name: string; id: string }[] {
  const lines = stdout
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const headerIndex = lines.findIndex(
    (l) =>
      (l.toLowerCase().includes('name') || l.toLowerCase().includes('nazwa')) &&
      (l.toLowerCase().includes('id') || l.toLowerCase().includes('identy'))
  )
  if (headerIndex === -1) return []

  const separatorIndex = lines.findIndex((l, i) => i > headerIndex && l.startsWith('---'))
  const dataLines = lines.slice(separatorIndex !== -1 ? separatorIndex + 1 : headerIndex + 1)

  const headerLine = lines[headerIndex]
  let idPos = -1
  let versionPos = -1

  const cols = headerLine.split(/\s{2,}/).filter(Boolean)
  for (const col of cols) {
    const colLower = col.toLowerCase()
    const pos = headerLine.indexOf(col)
    if (colLower.includes('id') || colLower.includes('identy')) {
      idPos = pos
    } else if (colLower.includes('vers') || colLower.includes('wers')) {
      versionPos = pos
    }
  }

  if (idPos === -1) return []

  const results: { name: string; id: string }[] = []
  for (const line of dataLines) {
    try {
      const name = line.substring(0, idPos).trim()
      const id = line.substring(idPos, versionPos > 0 ? versionPos : line.length).trim()
      if (name && id && isValidWingetId(id)) {
        results.push({ name, id })
      }
    } catch (e) {}
  }
  return results
}

async function searchWingetIdByName(name: string): Promise<string | null> {
  const cleanName = name
    .replace(/\s+\d+(\.\d+)*(\s+|$)/g, ' ') // usuń wersje np. 25.08.27.01
    .replace(/\s*\(?(x64|x86|64-bit|32-bit)\)?/gi, '') // usuń architektury
    .trim()

  if (cleanName.length < 2) return null

  try {
    const { stdout } = await runWinget(`search --name "${cleanName}" --exact --source winget`)
    const searchApps = parseSearchOutput(stdout)
    if (searchApps.length === 1) {
      return searchApps[0].id
    }
  } catch (err) {
    // Jeżeli exact nie zadziałał lub rzucił błąd, możemy spróbować bez --exact
    try {
      const { stdout } = await runWinget(`search --name "${cleanName}" --source winget`)
      const searchApps = parseSearchOutput(stdout)
      if (searchApps.length === 1) {
        return searchApps[0].id
      } else if (searchApps.length > 1) {
        const exactMatch = searchApps.find((a) => a.name.toLowerCase() === cleanName.toLowerCase())
        if (exactMatch) return exactMatch.id
      }
    } catch (e) {
      // Ignorujemy błędy wyszukiwania
    }
  }
  return null
}

async function resolveAppIds(apps: any[]): Promise<any[]> {
  const resolvedApps: any[] = []
  for (const app of apps) {
    if (isValidWingetId(app.id)) {
      resolvedApps.push(app)
      continue
    }

    // Level 1: Static alias table lookup
    const normalized = app.name.toLowerCase().trim()
    let resolvedId = knownApps[normalized]

    if (!resolvedId) {
      // Try with cleaned name
      const cleanName = app.name
        .replace(
          /\s*(\d+\.\d+|\(x64\)|\(x86\)|\(64-bit\)|\(32-bit\)|client|launcher|community|professional|enterprise|free|portable).*/i,
          ''
        )
        .trim()
        .toLowerCase()
      resolvedId = knownApps[cleanName]
    }

    if (resolvedId) {
      console.log(`[Winget Resolver] Resolved '${app.name}' via Level 1 to '${resolvedId}'`)
      resolvedApps.push({
        ...app,
        id: resolvedId,
        source: app.source || 'winget'
      })
      continue
    }

    // Level 2: Dynamic search with cache
    if (resolvedIdCache.has(app.name)) {
      const cached = resolvedIdCache.get(app.name)
      if (cached) {
        console.log(`[Winget Resolver] Resolved '${app.name}' via Cache to '${cached}'`)
        resolvedApps.push({
          ...app,
          id: cached,
          source: app.source || 'winget'
        })
      }
      continue
    }

    console.log(`[Winget Resolver] Trying Level 2 search for '${app.name}'`)
    const searchId = await searchWingetIdByName(app.name)
    resolvedIdCache.set(app.name, searchId)

    if (searchId) {
      console.log(`[Winget Resolver] Resolved '${app.name}' via Level 2 search to '${searchId}'`)
      resolvedApps.push({
        ...app,
        id: searchId,
        source: app.source || 'winget'
      })
    } else {
      console.warn(
        `[Winget Resolver] Could not resolve ID for '${app.name}' (ID: '${app.id}') - skipping`
      )
    }
  }
  return resolvedApps
}

/**
 * Wykrywa błędy związane z UAC/uprawnieniami administratora.
 * 0x800704c7 = ERROR_CANCELLED (użytkownik anulował / brak UAC w tle)
 * 0x80070005 = ACCESS_DENIED
 * 0x8007142b = powiązany z brakiem uprawnień instalatora
 */
function isUACError(err: any): boolean {
  const text = [err?.stderr || '', err?.stdout || '', err?.message || ''].join(' ').toLowerCase()
  return (
    text.includes('0x800704c7') ||
    text.includes('0x80070005') ||
    text.includes('0x8007142b') ||
    text.includes('anulowana przez użytkownika') ||
    text.includes('cancelled by the user') ||
    text.includes('access is denied') ||
    text.includes('requires administrator') ||
    text.includes('operation was cancelled')
  )
}

/**
 * Czyści raw output winget z artefaktów CLI:
 * - znaki spinnera (-, \, |, /)
 * - carriage returns
 * - wielokrotne puste linie
 * - zostawia tylko sensowny tekst błędu
 */
function cleanWingetOutput(raw: string): string {
  // Usuń prefix "Command failed: [polecenie]" który Node.js dodaje do error.message
  const withoutPrefix = raw.replace(/^Command failed:[^\n]*\n/m, '').replace(/\r/g, '')

  return withoutPrefix
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => {
      if (!l) return false
      // Usuń linie zawierające WYŁĄCZNIE znaki spinnera i białe znaki
      // Obsługuje zarówno "-\|/" jak i "    -    \    |    /    -" (z spacjami)
      if (/^[\s\-\\|/]+$/.test(l)) return false
      // Usuń linie z samymi kreskami (separatory)
      if (/^[-=]+$/.test(l)) return false
      return true
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function parseWingetOutput(stdout: string) {
  console.log(`[Winget] Raw output start: ${stdout.substring(0, 200).replace(/\n/g, ' ')}`)

  // Usunięcie carriage returns i podział na linie
  const lines = stdout
    .replace(/\r/g, '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !/^[-/\\|]$/.test(l)) // Usunięcie znaków spinnera

  // Znajdź indeks nagłówka - musi zawierać Name/Nazwa oraz Id
  const headerIndex = lines.findIndex(
    (l) =>
      (l.toLowerCase().includes('name') || l.toLowerCase().includes('nazwa')) &&
      (l.toLowerCase().includes('id') || l.toLowerCase().includes('identyfikator'))
  )

  if (headerIndex === -1) {
    console.log('[Winget] Could not find header line.')
    return []
  }

  const rawHeaderLine = lines[headerIndex]
  // Krytyczna poprawka dopasowania: Winget w strumieniu konsoli czasami dokleja na początku nagłówka
  // znaki i spacje od spinnera animacji wczytywania (np. "  - \        Name...").
  // Szukamy początku prawdziwego nagłówka ("Name" lub "Nazwa") i obcinamy wszystko co przed nim,
  // dzięki czemu indeksy kolumn są idealnie wyrównane z liniami danych!
  const headerLineIndex = rawHeaderLine.search(/\b(Name|Nazwa)\b/i)
  const headerLine =
    headerLineIndex !== -1 ? rawHeaderLine.substring(headerLineIndex) : rawHeaderLine.trim()

  // Zazwyczaj separator w postaci kresek --- występuje bezpośrednio pod nagłówkiem
  const separatorIndex = lines.findIndex((l, i) => i > headerIndex && l.startsWith('---'))
  const dataLines = lines.slice(separatorIndex !== -1 ? separatorIndex + 1 : headerIndex + 1)

  // Pobranie kolumn na podstawie podziału wielospacjami
  const cols = headerLine.split(/\s{2,}/).filter(Boolean)
  if (cols.length < 2) return []

  let idPos = -1
  let versionPos = -1
  let availablePos = -1
  let sourcePos = -1

  // Dynamiczne wykrywanie indeksów kolumn, całkowicie odporne na kodowanie znaków i język
  for (const col of cols) {
    const colLower = col.toLowerCase()
    const pos = headerLine.indexOf(col)

    if (colLower.includes('id') || colLower.includes('identy')) {
      idPos = pos
    } else if (colLower.includes('vers') || colLower.includes('wers')) {
      versionPos = pos
    } else if (
      colLower.includes('avail') ||
      colLower.includes('dostęp') ||
      colLower.includes('dostep')
    ) {
      availablePos = pos
    } else if (colLower.includes('sourc') || colLower.includes('ród') || colLower.includes('rod')) {
      sourcePos = pos
    }
  }

  // Bezpieczne wartości domyślne w razie nieodnalezienia nagłówków
  if (idPos === -1 && cols[1]) idPos = headerLine.indexOf(cols[1])
  if (versionPos === -1 && cols[2]) versionPos = headerLine.indexOf(cols[2])

  const apps: any[] = []

  for (const line of dataLines) {
    if (line.startsWith('-') || line.match(/^\d+ (upgrade|upgrades|aktualizacji)/i)) continue

    try {
      const name = line.substring(0, idPos > 0 ? idPos : 30).trim()

      let nextPos = versionPos > 0 ? versionPos : line.length
      const id = line.substring(idPos > 0 ? idPos : 30, nextPos).trim()

      let version = ''
      if (versionPos > 0) {
        let endVersionPos =
          availablePos > 0 ? availablePos : sourcePos > 0 ? sourcePos : line.length
        version = line.substring(versionPos, endVersionPos).trim()
      }

      let available = ''
      if (availablePos > 0) {
        let endAvailablePos = sourcePos > 0 ? sourcePos : line.length
        available = line.substring(availablePos, endAvailablePos).trim()
      }

      let source = ''
      if (sourcePos > 0) {
        source = line.substring(sourcePos).trim()
      }

      // Krytyczna weryfikacja i korekta przesunięcia kolumn:
      // Jeśli kolumna "Dostępna wersja" zawiera nazwę repozytorium ("winget", "msstore" itp.),
      // oznacza to, że aplikacja jest w rzeczywistości AKTUALNA (brak nowej wersji),
      // a parser błędnie zinterpretował kolumnę Źródło z powodu pustego pola wersji.
      if (
        available.toLowerCase() === 'winget' ||
        available.toLowerCase() === 'msstore' ||
        available.toLowerCase() === 'winget-source'
      ) {
        source = available
        available = ''
      }

      // Bug Fix #2: Odrzuć wpisy, gdzie 'id' wygląda jak numer wersji (np. 11.56)
      // To się zdarza gdy parser źle wyrówna kolumny dla niektórych wpisów winget
      if (id && isValidWingetId(id)) {
        apps.push({
          name: name || 'Nieznany',
          id,
          version,
          available,
          source
        })
      } else if (id) {
        console.warn(
          `[Winget Parser] Rejected invalid wingetId: '${id}' for app: '${name}' — looks like a version number or malformed ID`
        )
      }
    } catch (e) {}
  }

  // Druga linia obrony: tradycyjny parser oparty na podziale (gdyby pozycjonowanie zawiodło)
  if (apps.length === 0) {
    console.log('[Winget] Position-based parsing failed, trying split-based...')
    for (const line of dataLines) {
      const parts = line.split(/\s{2,}/) // Podział po co najmniej 2 spacjach
      if (parts.length >= 2) {
        const name = parts[0]
        const id = parts[1]
        let version = parts[2] || ''
        let available = parts[3] || ''
        let source = parts[4] || ''

        if (
          available.toLowerCase() === 'winget' ||
          available.toLowerCase() === 'msstore' ||
          available.toLowerCase() === 'winget-source'
        ) {
          source = available
          available = ''
        }

        // Bug Fix #2 (fallback parser): Również weryfikuj ID tutaj
        if (isValidWingetId(id)) {
          apps.push({
            name,
            id,
            version,
            available,
            source
          })
        } else {
          console.warn(`[Winget FallbackParser] Rejected invalid id: '${id}'`)
        }
      }
    }
  }

  console.log(`[Winget Parser] Final count: ${apps.length}`)
  return apps
}

export async function checkForUpdatesInternal(): Promise<any[]> {
  const { stdout } = await runWinget('upgrade --accept-source-agreements')
  if (
    stdout.includes('No installed package found matching input criteria.') ||
    stdout.includes('Nie znaleziono zainstalowanego pakietu') ||
    stdout.includes('Wszystkie zainstalowane pakiety są aktualne') ||
    stdout.includes('No upgrades available')
  ) {
    return []
  }
  const rawApps = parseWingetOutput(stdout)
  return await resolveAppIds(rawApps)
}

export function setupWingetIPC() {
  ipcMain.handle('preflight-download', async (_, wingetId: string) => {
    return await preflightDownloadCheck(wingetId)
  })

  ipcMain.handle('get-upgradable-apps', async () => {
    try {
      const resolvedApps = await checkForUpdatesInternal()
      return { success: true, data: resolvedApps }
    } catch (error: any) {
      if (
        error.stdout &&
        (error.stdout.includes('No installed package') ||
          error.stdout.includes('Nie znaleziono zainstalowanego pakietu'))
      ) {
        return { success: true, data: [] }
      }
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle(
    'upgrade-app',
    async (
      _,
      appData: { wingetId: string; name: string; previousVersion: string; newVersion: string }
    ) => {
      if (!appData || !appData.wingetId) {
        console.error('[Winget IPC] invalid appData passed to upgrade-app:', appData)
        return {
          success: false,
          error: 'Błąd: nieprawidłowe lub brakujące dane aplikacji (wingetId).'
        }
      }

      // Krok 1: Próba cichej instalacji (nie wymaga UAC dla większości pakietów)
      try {
        console.log(`[Winget Upgrade] Próba cichej aktualizacji dla ${appData.wingetId}...`)
        const { stdout } = await runWinget(
          `upgrade --id ${appData.wingetId} --silent --accept-source-agreements --accept-package-agreements`
        )

        // Sukces cichy — zapisz do DB i wróć
        await saveUpgradeSuccess(appData)
        new Notification({
          title: 'Aktualizacja zakończona',
          body: `Program ${appData.name} został pomyślnie zaktualizowany.`
        }).show()
        return { success: true, data: cleanWingetOutput(stdout) }
      } catch (silentError: any) {
        const cleaned = cleanWingetOutput(silentError?.stderr || silentError?.stdout || '')
        console.warn(
          `[Winget Upgrade] Cicha aktualizacja nie powiodła się dla ${appData.wingetId}:`,
          cleaned
        )

        // Krok 2: Wykryj błąd UAC — jeśli tak, NIE próbuj interactive (też zawiedzie w subprocess)
        // Zwróć specjalny flag do renderera — UI wyświetli dialog UAC z opcją run-elevated
        if (isUACError(silentError)) {
          console.warn(
            `[Winget Upgrade] UAC required for ${appData.wingetId} — returning requiresElevation flag`
          )
          await saveUpgradeFailed(appData)
          return {
            success: false,
            requiresElevation: true,
            error: 'Ta aplikacja wymaga uprawnień administratora (UAC) do instalacji.'
          }
        }

        // Krok 3: Błąd nie-UAC — zapisz i zwróć czysty komunikat
        await saveUpgradeFailed(appData)
        return {
          success: false,
          requiresElevation: false,
          error: cleaned || silentError?.message || 'Nieznany błąd aktualizacji.'
        }
      }
    }
  )

  /**
   * Uruchamia winget upgrade w podwyższonym oknie CMD (z prawidłowym UAC).
   * Electron nie może sam się podnieść — dlatego używamy PowerShell Start-Process -Verb RunAs,
   * które otwiera nowe okno CMD z uprawnieniami admina.
   * Użytkownik widzi prompt UAC, akceptę lub odrzuca. My nie blokujemy UI.
   */
  ipcMain.handle('run-elevated-upgrade', async (_, wingetId: string) => {
    if (!wingetId) return { success: false, error: 'Brak wingetId.' }

    const localAppData = process.env.LOCALAPPDATA || ''
    const wingetExe = `${localAppData}\\Microsoft\\WindowsApps\\winget.exe`
    const wingetArgs = `upgrade --id ${wingetId} --interactive --accept-source-agreements --accept-package-agreements`

    const psCommand = `Start-Process -FilePath cmd.exe -ArgumentList '/k "${wingetExe}" ${wingetArgs}' -Verb RunAs`

    try {
      // Uruchamiamy PowerShell ktory podniesie CMD z UAC - nie czekamy na wynik (fire and forget)
      const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
        env: buildWingetEnv()
      })
      ps.unref() // Nie blokuj Electrona

      console.log(`[Winget Elevated] Launched elevated upgrade for ${wingetId}`)
      return { success: true, message: 'Otwarto okno instalacji z uprawnieniami administratora.' }
    } catch (err: any) {
      console.error('[Winget Elevated] Failed to launch elevated upgrade:', err)
      return { success: false, error: err.message }
    }
  })

  ipcMain.handle('install-app', async (_, appData: { wingetId: string; name: string }) => {
    if (!appData || !appData.wingetId) {
      return {
        success: false,
        error: 'Błąd: nieprawidłowe lub brakujące dane aplikacji (wingetId).'
      }
    }
    try {
      console.log(`[Winget Install] Próba cichej instalacji dla ${appData.wingetId}...`)
      const { stdout } = await runWinget(
        `install --id ${appData.wingetId} --silent --accept-source-agreements --accept-package-agreements`
      )
      new Notification({
        title: 'Instalacja zakończona',
        body: `Program ${appData.name} został pomyślnie zainstalowany.`
      }).show()
      return { success: true, data: cleanWingetOutput(stdout) }
    } catch (installError: any) {
      const cleaned = cleanWingetOutput(installError?.stderr || installError?.stdout || '')
      console.warn(
        `[Winget Install] Cicha instalacja nie powiodła się dla ${appData.wingetId}:`,
        cleaned
      )

      if (isUACError(installError)) {
        return {
          success: false,
          requiresElevation: true,
          error: 'Ta aplikacja wymaga uprawnień administratora (UAC) do instalacji.'
        }
      }
      return {
        success: false,
        requiresElevation: false,
        error: cleaned || installError?.message || 'Nieznany błąd instalacji.'
      }
    }
  })

  ipcMain.handle('run-elevated-install', async (_, wingetId: string) => {
    if (!wingetId) return { success: false, error: 'Brak wingetId.' }

    const localAppData = process.env.LOCALAPPDATA || ''
    const wingetExe = `${localAppData}\\Microsoft\\WindowsApps\\winget.exe`
    const wingetArgs = `install --id ${wingetId} --interactive --accept-source-agreements --accept-package-agreements`
    const psCommand = `Start-Process -FilePath cmd.exe -ArgumentList '/k "${wingetExe}" ${wingetArgs}' -Verb RunAs`

    try {
      const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
        env: buildWingetEnv()
      })
      ps.unref()

      console.log(`[Winget Elevated Install] Launched elevated install for ${wingetId}`)
      return { success: true, message: 'Otwarto okno instalacji z uprawnieniami administratora.' }
    } catch (err: any) {
      console.error('[Winget Elevated Install] Failed to launch elevated install:', err)
      return { success: false, error: err.message }
    }
  })

  // (Helpery do zapisu historii przeniesione na poziom pliku poniżej)

  // Te handlery są częścią tej samej funkcji setupWingetIPC
  ipcMain.handle('get-installed-apps', async () => {
    try {
      const { stdout } = await runWinget('list --accept-source-agreements')
      const rawApps = parseWingetOutput(stdout)
      const resolvedApps = await resolveAppIds(rawApps)
      return { success: true, data: resolvedApps }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-update-history', async () => {
    try {
      const history = await prisma.updateHistory.findMany({
        take: 10,
        orderBy: { updatedAt: 'desc' },
        include: { software: true }
      })
      return { success: true, data: history }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('get-winget-run-details', async (_, wingetId: string) => {
    if (!wingetId) return { success: false, error: 'Brak identyfikatora wingetId.' }
    try {
      const parts = wingetId.split('.')
      const publisher = parts[0]
      const packageName = parts.slice(1).join('.')
      if (!publisher || !packageName) {
        return { success: false, error: 'Niepoprawny format identyfikatora wingetId.' }
      }

      const response = await fetch(`https://api.winget.run/v2/packages/${publisher}/${packageName}`)
      if (!response.ok) {
        return { success: false, error: `Błąd API: status ${response.status}` }
      }
      const data = await response.json()
      return { success: true, data: data.Package }
    } catch (error: any) {
      console.error('[Winget API Fetch Error]:', error)
      return { success: false, error: error.message }
    }
  })

  // 13. Odinstalowywanie aplikacji (Winget)
  ipcMain.handle('uninstall-app', async (_, wingetId: string) => {
    if (!wingetId) return { success: false, error: 'Brak wingetId.' }
    try {
      console.log(`[Winget Uninstall] Próba cichego odinstalowania dla ${wingetId}...`)
      const { stdout } = await runWinget(
        `uninstall --id ${wingetId} --silent --accept-source-agreements`
      )
      return { success: true, data: cleanWingetOutput(stdout) }
    } catch (uninstallError: any) {
      const cleaned = cleanWingetOutput(uninstallError?.stderr || uninstallError?.stdout || '')
      console.warn(
        `[Winget Uninstall] Ciche odinstalowanie nie powiodło się dla ${wingetId}:`,
        cleaned
      )

      if (isUACError(uninstallError)) {
        return {
          success: false,
          requiresElevation: true,
          error: 'Odinstalowanie tej aplikacji wymaga uprawnień administratora (UAC).'
        }
      }
      return {
        success: false,
        requiresElevation: false,
        error: cleaned || uninstallError?.message || 'Nieznany błąd podczas deinstalacji.'
      }
    }
  })

  // 14. Odinstalowywanie aplikacji z podniesionymi uprawnieniami (UAC)
  ipcMain.handle('run-elevated-uninstall', async (_, wingetId: string) => {
    if (!wingetId) return { success: false, error: 'Brak wingetId.' }

    const localAppData = process.env.LOCALAPPDATA || ''
    const wingetExe = `${localAppData}\\Microsoft\\WindowsApps\\winget.exe`
    const wingetArgs = `uninstall --id ${wingetId} --interactive --accept-source-agreements`
    const psCommand = `Start-Process -FilePath cmd.exe -ArgumentList '/k "${wingetExe}" ${wingetArgs}' -Verb RunAs`

    try {
      const ps = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', psCommand], {
        detached: true,
        stdio: 'ignore',
        env: buildWingetEnv()
      })
      ps.unref()

      console.log(`[Winget Elevated Uninstall] Launched elevated uninstall for ${wingetId}`)
      return { success: true, message: 'Otwarto okno deinstalacji z uprawnieniami administratora.' }
    } catch (err: any) {
      console.error('[Winget Elevated Uninstall] Failed to launch elevated uninstall:', err)
      return { success: false, error: err.message }
    }
  })

  // 15. Skanowanie pozostałości (pliki i rejestr Win32)
  ipcMain.handle('scan-win32-leftovers', async (_, appName: string, publisher: string) => {
    if (!appName) return { success: false, error: 'Brak nazwy aplikacji.' }

    const detectedFiles: string[] = []
    const detectedRegs: string[] = []

    const cleanName = appName.replace(/v?\d+\.\d+(\.\d+)*/g, '').trim()
    const terms = [cleanName]
    if (publisher && publisher !== cleanName) {
      terms.push(publisher)
    }

    const roots = [
      process.env.APPDATA || '',
      process.env.LOCALAPPDATA || '',
      'C:\\Program Files',
      'C:\\Program Files (x86)'
    ].filter(Boolean)

    for (const root of roots) {
      try {
        if (fs.existsSync(root)) {
          const filesInRoot = await fs.promises.readdir(root)
          for (const item of filesInRoot) {
            const itemPath = path.join(root, item)
            try {
              const stat = await fs.promises.stat(itemPath)
              if (stat.isDirectory()) {
                const lowerItem = item.toLowerCase()
                const matches = terms.some((t) => {
                  const cleanT = t.toLowerCase().trim()
                  return cleanT.length > 2 && lowerItem.includes(cleanT)
                })
                if (matches) {
                  detectedFiles.push(itemPath)
                }
              }
            } catch (statErr) {
              // Ignoruj zablokowane pliki
            }
          }
        }
      } catch (err) {
        console.error(`[Leftovers Disk Scanner] Error scanning root ${root}:`, err)
      }
    }

    const psScript = `
      $paths = @("HKCU:\\Software", "HKLM:\\Software")
      $results = @()
      foreach ($path in $paths) {
          if (Test-Path $path) {
              Get-ChildItem -Path $path -ErrorAction SilentlyContinue | Where-Object { 
                  $name = $_.PSChildName.toLowerCase()
                  ${terms.map((t) => `$name -like '*${t.toLowerCase().trim()}*'`).join(' -or ')}
              } | ForEach-Object { $_.Name }
          }
      }
      $results | ConvertTo-Json
    `
    try {
      const buffer = Buffer.from(psScript, 'utf16le')
      const base64 = buffer.toString('base64')
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64}`
      )
      if (stdout && stdout.trim() !== '') {
        const parsed = JSON.parse(stdout.trim())
        const keys = Array.isArray(parsed) ? parsed : [parsed]
        keys.forEach((k) => {
          if (typeof k === 'string') {
            detectedRegs.push(
              k.replace('HKEY_CURRENT_USER', 'HKCU').replace('HKEY_LOCAL_MACHINE', 'HKLM')
            )
          }
        })
      }
    } catch (err) {
      console.error('[Leftovers Registry Scanner] Error scanning registry:', err)
    }

    return {
      success: true,
      files: detectedFiles,
      registry: detectedRegs
    }
  })

  // 16. Usuwanie pozostałości Win32 (pliki i rejestr, wymaga UAC)
  ipcMain.handle('clean-win32-leftovers', async (_, files: string[], registry: string[]) => {
    let filesDeleted = 0
    let regsDeleted = 0
    const errors: string[] = []

    const deleteScriptParts: string[] = []
    for (const file of files) {
      deleteScriptParts.push(
        `if (Test-Path '${file}') { Remove-Item -Path '${file}' -Recurse -Force }`
      )
    }
    for (const reg of registry) {
      const formattedReg = reg
        .replace('HKEY_CURRENT_USER', 'HKCU:')
        .replace('HKEY_LOCAL_MACHINE', 'HKLM:')
        .replace('HKCU', 'HKCU:')
        .replace('HKLM', 'HKLM:')
      deleteScriptParts.push(
        `if (Test-Path '${formattedReg}') { Remove-Item -Path '${formattedReg}' -Recurse -Force }`
      )
    }

    if (deleteScriptParts.length === 0) {
      return { success: true, filesDeleted, regsDeleted, errors }
    }

    const fullScript = deleteScriptParts.join('\n')
    const innerBase64 = Buffer.from(fullScript, 'utf16le').toString('base64')
    const elevatedCmd = `Start-Process powershell.exe -ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand ${innerBase64}' -Verb RunAs -WindowStyle Hidden -Wait`

    try {
      await execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${elevatedCmd}"`)
      for (const file of files) {
        if (!fs.existsSync(file)) {
          filesDeleted++
        } else {
          errors.push(`Nie udało się usunąć folderu: ${file}`)
        }
      }
      regsDeleted = registry.length

      return {
        success: errors.length === 0,
        filesDeleted,
        regsDeleted,
        errors
      }
    } catch (err: any) {
      console.error('[Leftovers Cleaning Error]:', err)
      return {
        success: false,
        filesDeleted: 0,
        regsDeleted: 0,
        errors: [err.message]
      }
    }
  })
}

// --- Helpers do zapisu historii w DB (poziom pliku) ---

async function saveUpgradeSuccess(appData: {
  wingetId: string
  name: string
  previousVersion: string
  newVersion: string
}) {
  try {
    const software = await prisma.software.upsert({
      where: { wingetId: appData.wingetId },
      update: { currentVersion: appData.newVersion, name: appData.name },
      create: { wingetId: appData.wingetId, name: appData.name, currentVersion: appData.newVersion }
    })
    await prisma.updateHistory.create({
      data: {
        softwareId: software.id,
        previousVersion: appData.previousVersion,
        newVersion: appData.newVersion,
        status: 'SUCCESS'
      }
    })
  } catch (e) {
    console.error('[Winget DB] saveUpgradeSuccess error:', e)
  }
}

async function saveUpgradeFailed(appData: {
  wingetId: string
  name: string
  previousVersion: string
  newVersion: string
}) {
  try {
    const software = await prisma.software.upsert({
      where: { wingetId: appData.wingetId },
      update: {},
      create: {
        wingetId: appData.wingetId,
        name: appData.name,
        currentVersion: appData.previousVersion
      }
    })
    await prisma.updateHistory.create({
      data: {
        softwareId: software.id,
        previousVersion: appData.previousVersion,
        newVersion: appData.newVersion,
        status: 'FAILED'
      }
    })
  } catch (e) {
    console.error('[Winget DB] saveUpgradeFailed error:', e)
  }
}

// Funkcja cyklicznej automatycznej aktualizacji w tle
export async function runAutoUpdateScheduledTask(): Promise<void> {
  try {
    const autoUpdateEnabled = await getSettingInternal('auto_update_enabled', 'false')
    if (autoUpdateEnabled !== 'true') {
      return
    }

    const scheduledTimeStr = await getSettingInternal('auto_update_time', '02:00')
    const [schHour, schMin] = scheduledTimeStr.split(':').map(Number)

    const now = new Date()
    const currentHour = now.getHours()
    const currentMin = now.getMinutes()

    // Sprawdź czy nadeszła godzina aktualizacji
    const lastUpdatedStr = await getSettingInternal('last_updated_at', '0')
    const lastUpdated = parseInt(lastUpdatedStr, 10)
    const timeSinceLastUpdate = Date.now() - lastUpdated

    // Minimalny czas między uruchomieniami: 20 godzin, aby uniknąć wielokrotnego uruchomienia tego samego dnia
    if (timeSinceLastUpdate < 20 * 60 * 60 * 1000) {
      return
    }

    // Sprawdź częstotliwość (daily, weekly, monthly)
    const interval = await getSettingInternal('auto_update_interval', 'daily')
    if (interval === 'weekly') {
      const schWeekday = parseInt(await getSettingInternal('auto_update_weekday', '1'), 10)
      const currentWeekday = now.getDay() === 0 ? 7 : now.getDay() // Mapuj 0 (Sun) na 7
      if (currentWeekday !== schWeekday) {
        return
      }
    } else if (interval === 'monthly') {
      if (now.getDate() !== 1 && timeSinceLastUpdate < 27 * 24 * 60 * 60 * 1000) {
        return
      }
    }

    // Czy nadszedł czas (godzina i minuta)
    if (currentHour < schHour || (currentHour === schHour && currentMin < schMin)) {
      return
    }

    console.log('[AutoUpdate] Starting background automatic updates...')

    // Pobierz listę aplikacji z aktualizacjami
    const upgradable = await checkForUpdatesInternal()
    if (upgradable.length === 0) {
      console.log('[AutoUpdate] No updates available.')
      await saveSettingInternal('last_updated_at', Date.now().toString())
      return
    }

    // Filtruj na podstawie zakresu (scope)
    const scope = await getSettingInternal('auto_update_scope', 'all')
    let appsToUpdate = [...upgradable]

    if (scope === 'whitelist') {
      const whitelistStr = await getSettingInternal('auto_update_whitelist', '')
      const whitelist = whitelistStr ? whitelistStr.split(',') : []
      appsToUpdate = upgradable.filter((app) => whitelist.includes(app.id))
    }

    if (appsToUpdate.length === 0) {
      console.log('[AutoUpdate] No whitelisted updates to run.')
      await saveSettingInternal('last_updated_at', Date.now().toString())
      return
    }

    const notificationsEnabled = await getSettingInternal('notifications_enabled', 'true')

    // Aktualizuj każdą aplikację po kolei (w trybie cichym)
    for (const app of appsToUpdate) {
      try {
        console.log(`[AutoUpdate] Upgrading ${app.id} silently...`)
        const appData = {
          wingetId: app.id,
          name: app.name,
          previousVersion: app.version,
          newVersion: app.available
        }

        // Uruchamiamy cichą instalację
        await runWinget(
          `upgrade --id ${app.id} --silent --accept-source-agreements --accept-package-agreements`
        )

        await saveUpgradeSuccess(appData)
        console.log(`[AutoUpdate] Silently updated ${app.id} successfully.`)

        if (notificationsEnabled === 'true') {
          new Notification({
            title: 'Automatyczna aktualizacja',
            body: `Program ${app.name} został zaktualizowany do wersji ${app.available} w tle.`
          }).show()
        }
      } catch (err: any) {
        console.warn(`[AutoUpdate] Failed silent update for ${app.id}:`, err?.message || err)
        await saveUpgradeFailed({
          wingetId: app.id,
          name: app.name,
          previousVersion: app.version,
          newVersion: app.available
        })
      }
    }

    // Zapisz czas wykonania
    await saveSettingInternal('last_updated_at', Date.now().toString())
  } catch (error) {
    console.error('[AutoUpdate Error]:', error)
  }
}
