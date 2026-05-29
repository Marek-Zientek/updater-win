import { ipcMain, net } from 'electron'

/**
 * Pobiera szczegóły aplikacji z Microsoft Store API.
 * Używane dla pakietów ze źródła 'msstore' — zwraca screenshoty i ikonę HD.
 * Działa w main process (Node.js) — bez ograniczeń CSP.
 */
export function setupStoreIPC(): void {
  ipcMain.handle('get-store-details', async (_, productId: string) => {
    if (!productId) return { success: false, error: 'Brak productId' }

    try {
      // Microsoft Store Catalog API
      const url = `https://storeedgefd.dsx.mp.microsoft.com/v9.0/products/${productId}?market=PL&locale=pl-PL&deviceFamily=Windows.Desktop`
      const response = await net.fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        }
      })

      if (!response.ok) {
        return { success: false, error: `Store API: ${response.status}` }
      }

      const json = (await response.json()) as any
      const payload = json?.Payload

      if (!payload) return { success: false, error: 'Brak danych w odpowiedzi Store API' }

      // Wyciągnij screenshoty (Images z typem Screenshot lub DesktopScreenshot)
      const images: any[] = payload.Images || []
      const screenshots = images
        .filter(
          (img: any) =>
            img.ImagePurpose === 'Screenshot' || img.ImagePurpose === 'DesktopScreenshot'
        )
        .sort((a: any, b: any) => (b.Width || 0) - (a.Width || 0)) // Najpierw największe
        .slice(0, 6)
        .map((img: any) => (img.Url?.startsWith('//') ? `https:${img.Url}` : img.Url))
        .filter(Boolean)

      // Ikona HD z Store
      const storeIcon =
        images
          .filter((img: any) => img.ImagePurpose === 'Tile' || img.ImagePurpose === 'Logo')
          .sort((a: any, b: any) => (b.Width || 0) - (a.Width || 0))
          .map((img: any) => (img.Url?.startsWith('//') ? `https:${img.Url}` : img.Url))
          .filter(Boolean)[0] || null

      return {
        success: true,
        data: {
          screenshots,
          storeIcon,
          shortDescription: payload.ShortDescription || null,
          developerName: payload.DeveloperName || null
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
