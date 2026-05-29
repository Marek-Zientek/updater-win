import { ipcMain, dialog, app } from 'electron'
import { prisma } from '../db'
import * as fs from 'fs'
import * as path from 'path'

/**
 * IPC handlers dla customizacji aplikacji (panel admina).
 * Przechowuje nadpisania nazwy, opisu, ikony i notatek w lokalnej bazie SQLite.
 */
export function setupCustomizationsIPC(): void {
  // Pobierz customizację dla danego wingetId
  ipcMain.handle('get-customization', async (_, wingetId: string) => {
    try {
      const record = await prisma.softwareCustomization.findUnique({
        where: { wingetId }
      })
      if (!record) return { success: true, data: null }
      return {
        success: true,
        data: {
          ...record,
          screenshotUrls: record.screenshotUrls ? JSON.parse(record.screenshotUrls) : [],
          tags: record.tags ? JSON.parse(record.tags) : []
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Zapisz (utwórz lub zaktualizuj) customizację
  ipcMain.handle(
    'save-customization',
    async (
      _,
      data: {
        wingetId: string
        customName?: string
        customDesc?: string
        customIconUrl?: string
        notes?: string
        screenshotUrls?: string[]
        rating?: number
        review?: string
        tags?: string[]
        customCategory?: string
      }
    ) => {
      try {
        const record = await prisma.softwareCustomization.upsert({
          where: { wingetId: data.wingetId },
          update: {
            customName: data.customName ?? null,
            customDesc: data.customDesc ?? null,
            customIconUrl: data.customIconUrl ?? null,
            notes: data.notes ?? null,
            screenshotUrls: data.screenshotUrls ? JSON.stringify(data.screenshotUrls) : null,
            rating: data.rating ?? null,
            review: data.review ?? null,
            tags: data.tags ? JSON.stringify(data.tags) : null,
            customCategory: data.customCategory ?? null
          },
          create: {
            wingetId: data.wingetId,
            customName: data.customName ?? null,
            customDesc: data.customDesc ?? null,
            customIconUrl: data.customIconUrl ?? null,
            notes: data.notes ?? null,
            screenshotUrls: data.screenshotUrls ? JSON.stringify(data.screenshotUrls) : null,
            rating: data.rating ?? null,
            review: data.review ?? null,
            tags: data.tags ? JSON.stringify(data.tags) : null,
            customCategory: data.customCategory ?? null
          }
        })
        return {
          success: true,
          data: {
            ...record,
            screenshotUrls: record.screenshotUrls ? JSON.parse(record.screenshotUrls) : [],
            tags: record.tags ? JSON.parse(record.tags) : []
          }
        }
      } catch (err: any) {
        return { success: false, error: err.message }
      }
    }
  )

  // Usuń customizację (reset do domyślnych danych)
  ipcMain.handle('delete-customization', async (_, wingetId: string) => {
    try {
      await prisma.softwareCustomization.deleteMany({ where: { wingetId } })
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Wybierz plik screenshotu przez systemowy dialog
  ipcMain.handle('pick-screenshot', async () => {
    try {
      const result = await dialog.showOpenDialog({
        title: 'Wybierz screenshot',
        filters: [{ name: 'Obrazy', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
        properties: ['openFile', 'multiSelections']
      })
      if (result.canceled || result.filePaths.length === 0) return { success: true, paths: [] }

      // Kopiuj pliki do userData/screenshots/
      const screenshotsDir = path.join(app.getPath('userData'), 'screenshots')
      if (!fs.existsSync(screenshotsDir)) fs.mkdirSync(screenshotsDir, { recursive: true })

      const copiedPaths: string[] = []
      for (const srcPath of result.filePaths) {
        const fileName = `${Date.now()}_${path.basename(srcPath)}`
        const destPath = path.join(screenshotsDir, fileName)
        fs.copyFileSync(srcPath, destPath)
        copiedPaths.push(destPath) // absolutna ścieżka do pliku
      }
      return { success: true, paths: copiedPaths }
    } catch (err: any) {
      return { success: false, error: err.message, paths: [] }
    }
  })

  // Usuń plik screenshotu z userData
  ipcMain.handle('delete-screenshot', async (_, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
