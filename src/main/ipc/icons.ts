import { ipcMain, net } from 'electron'

/**
 * Pobiera ikonę aplikacji w głównym procesie (Node.js) — bez ograniczeń CSP renderera.
 * Próbuje Clearbit, potem Google Favicon. Zwraca base64 data URL lub null.
 */
export function setupIconsIPC(): void {
  ipcMain.handle('fetch-app-icon', async (_, domain: string) => {
    if (!domain || typeof domain !== 'string') return null

    // Próba 1: Clearbit Logo API
    try {
      const response = await net.fetch(`https://logo.clearbit.com/${domain}`, {
        method: 'GET',
        headers: { 'User-Agent': 'Mozilla/5.0' }
      })
      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/png'
        // Clearbit zwraca placeholder PNG dla nieznanych domen — filtrujemy po rozmiarze
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length > 500) {
          // Prawdziwe logo > 500 bytes; placeholder ~200 bytes
          return `data:${contentType};base64,${buffer.toString('base64')}`
        }
      }
    } catch {
      // Clearbit niedostępny — próbuj fallback
    }

    // Próba 2: Google S2 Favicon
    try {
      const response = await net.fetch(
        `https://www.google.com/s2/favicons?domain=${domain}&sz=128`,
        { method: 'GET' }
      )
      if (response.ok) {
        const contentType = response.headers.get('content-type') || 'image/png'
        const buffer = Buffer.from(await response.arrayBuffer())
        if (buffer.length > 100) {
          return `data:${contentType};base64,${buffer.toString('base64')}`
        }
      }
    } catch {
      // Google też niedostępny
    }

    return null // Renderer użyje letter avatar
  })
}
