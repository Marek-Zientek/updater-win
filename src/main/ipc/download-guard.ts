import { app } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { runWinget } from './winget'

export interface PreflightResult {
  canDownload: boolean
  installerUrl?: string
  errorReason?: 'no_installer_url' | 'network_error' | 'disk_write_error' | 'http_error' | null
  statusCode?: number
}

/**
 * Wyciąga adres URL instalatora ze szczegółów winget show.
 */
async function getInstallerUrlFromWinget(wingetId: string): Promise<string | null> {
  try {
    const { stdout } = await runWinget(`show --id ${wingetId}`)
    // Obsługa różnych języków (np. angielski "Installer Url", polski "Adres URL instalatora")
    const match = stdout.match(
      /(?:Installer\s+Url|Adres\s+URL\s+instalatora|URL\s+instalatora):\s*(\S+)/i
    )
    if (match && match[1]) {
      return match[1].trim()
    }
  } catch (err) {
    console.error(`[DownloadGuard] Failed to fetch winget details for ID ${wingetId}:`, err)
  }
  return null
}

/**
 * Wykonuje pre-flight check dla pobierania instalatora danej aplikacji.
 */
export async function preflightDownloadCheck(wingetId: string): Promise<PreflightResult> {
  console.log(`[DownloadGuard] Starting pre-flight check for ${wingetId}...`)

  // 1. Pobierz URL instalatora
  const installerUrl = await getInstallerUrlFromWinget(wingetId)
  if (!installerUrl) {
    console.warn(`[DownloadGuard] No installer URL found for ${wingetId}`)
    return { canDownload: false, errorReason: 'no_installer_url' }
  }

  // 2. Weryfikacja połączenia sieciowego i dostępności URL (HEAD z timeoutem i GET fallback)
  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 12000) // 12 sekund na odpowiedź

    // HEAD request
    let response: Response
    try {
      response = await fetch(installerUrl, {
        method: 'HEAD',
        signal: controller.signal,
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      })
    } catch {
      // Jeśli HEAD rzuci błąd (brak wsparcia, etc.), spróbuj cichego GET pobierającego tylko 1 bajt
      const getController = new AbortController()
      const getTimeoutId = setTimeout(() => getController.abort(), 12000)
      response = await fetch(installerUrl, {
        method: 'GET',
        signal: getController.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
          Range: 'bytes=0-0'
        }
      })
      clearTimeout(getTimeoutId)
    }

    clearTimeout(timeoutId)

    // Błędy HTTP (status >= 400), ignorujemy 416 (Range Not Satisfiable - serwer działa, ale nie wspiera Range)
    if (!response.ok && response.status !== 416) {
      console.warn(`[DownloadGuard] URL responded with error status: ${response.status}`)
      return {
        canDownload: false,
        errorReason: 'http_error',
        statusCode: response.status,
        installerUrl
      }
    }
  } catch (e: any) {
    console.error(`[DownloadGuard] Network check failed for URL: ${installerUrl}`, e)
    return { canDownload: false, errorReason: 'network_error', installerUrl }
  }

  // 3. Weryfikacja uprawnień do zapisu na dysku (katalog temp)
  try {
    const tempPath = path.join(app.getPath('temp'), 'updater-preflight')
    if (!fs.existsSync(tempPath)) {
      fs.mkdirSync(tempPath, { recursive: true })
    }
    const testFile = path.join(tempPath, `${Date.now()}_test.tmp`)
    fs.writeFileSync(testFile, 'ok')
    fs.unlinkSync(testFile)
  } catch (err: any) {
    console.error('[DownloadGuard] Disk write permission test failed:', err)
    return { canDownload: false, errorReason: 'disk_write_error', installerUrl }
  }

  console.log(`[DownloadGuard] Pre-flight check succeeded for ${wingetId}`)
  return { canDownload: true, installerUrl }
}
