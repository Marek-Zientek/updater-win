import { ipcMain, dialog, BrowserWindow } from 'electron'
import { prisma } from '../db'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'

const execAsync = promisify(exec)

export function setupBackupIPC(): void {
  // 1. Pobieranie punktów przywracania systemu Windows
  ipcMain.handle('get-restore-points', async () => {
    const psCommand = `
      Get-ComputerRestorePoint | ForEach-Object {
        [PSCustomObject]@{
          sequenceNumber = $_.SequenceNumber
          description = $_.Description
          creationTime = $_.CreationTime
          type = $_.RestorePointType
        }
      } | ConvertTo-Json
    `
    try {
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
      )
      if (!stdout || stdout.trim() === '') {
        return { success: true, data: [] }
      }
      const data = JSON.parse(stdout)
      const list = Array.isArray(data) ? data : [data]
      return { success: true, data: list }
    } catch (error: any) {
      // Jeśli przywracanie systemu jest wyłączone w Windows lub wystąpił inny błąd
      return {
        success: false,
        error:
          'Ochrona systemu może być wyłączona lub funkcja nie jest obsługiwana w tej wersji systemu Windows.',
        data: []
      }
    }
  })

  // 2. Tworzenie punktu przywracania systemu Windows (wymaga administratora - wywoła monit UAC)
  ipcMain.handle('create-restore-point', async () => {
    // Checkpoint-Computer domyślnie ogranicza tworzenie do jednego na 24h, chyba że ustawimy SystemRestore w rejestrze.
    // Uruchamiamy PowerShell jako Administrator za pomocą Start-Process -Verb RunAs
    const psCommand = `
      Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command Checkpoint-Computer -Description \\"UpdaterWin Backup\\" -RestorePointType MODIFY_SETTINGS' -Verb RunAs -Wait
    `
    try {
      await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
      )
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error:
          'Nie udało się utworzyć punktu przywracania. Upewnij się, że zaakceptowałeś monit administratora (UAC) i ochrona systemu Windows jest włączona na dysku systemowym.'
      }
    }
  })

  // 3. Eksport konfiguracji aplikacji do pliku JSON
  ipcMain.handle('export-backup', async () => {
    try {
      const focusWindow = BrowserWindow.getFocusedWindow()
      if (!focusWindow) return { success: false, error: 'Brak aktywnego okna aplikacji.' }

      const { canceled, filePath } = await dialog.showSaveDialog(focusWindow, {
        title: 'Eksportuj kopię zapasową',
        defaultPath: 'updaterwin_backup.json',
        filters: [{ name: 'Pliki JSON', extensions: ['json'] }]
      })

      if (canceled || !filePath) {
        return { success: true, canceled: true }
      }

      // Pobierz dane z SQLite
      const customizations = await prisma.softwareCustomization.findMany()
      const settings = await prisma.appSettings.findMany()

      const backupData = {
        version: '1.0.0',
        exportedAt: new Date().toISOString(),
        customizations,
        settings
      }

      await fs.promises.writeFile(filePath, JSON.stringify(backupData, null, 2), 'utf-8')
      return { success: true, canceled: false }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 4. Import konfiguracji aplikacji z pliku JSON
  ipcMain.handle('import-backup', async () => {
    try {
      const focusWindow = BrowserWindow.getFocusedWindow()
      if (!focusWindow) return { success: false, error: 'Brak aktywnego okna aplikacji.' }

      const { canceled, filePaths } = await dialog.showOpenDialog(focusWindow, {
        title: 'Importuj kopię zapasową',
        filters: [{ name: 'Pliki JSON', extensions: ['json'] }],
        properties: ['openFile']
      })

      if (canceled || filePaths.length === 0) {
        return { success: true, canceled: true }
      }

      const content = await fs.promises.readFile(filePaths[0], 'utf-8')
      const backupData = JSON.parse(content)

      // Podstawowa walidacja
      if (!backupData || (!backupData.customizations && !backupData.settings)) {
        return { success: false, error: 'Nieprawidłowy plik kopii zapasowej.' }
      }

      // Zapisz ustawienia do bazy
      if (backupData.settings && Array.isArray(backupData.settings)) {
        for (const item of backupData.settings) {
          if (item.key && item.value !== undefined) {
            await prisma.appSettings.upsert({
              where: { key: item.key },
              update: { value: item.value },
              create: { key: item.key, value: item.value }
            })
          }
        }
      }

      // Zapisz personalizację aplikacji do bazy
      if (backupData.customizations && Array.isArray(backupData.customizations)) {
        for (const item of backupData.customizations) {
          if (item.wingetId) {
            await prisma.softwareCustomization.upsert({
              where: { wingetId: item.wingetId },
              update: {
                customName: item.customName,
                customDesc: item.customDesc,
                customIconUrl: item.customIconUrl,
                notes: item.notes,
                screenshotUrls: item.screenshotUrls,
                rating: item.rating,
                review: item.review,
                tags: item.tags,
                customCategory: item.customCategory
              },
              create: {
                wingetId: item.wingetId,
                customName: item.customName,
                customDesc: item.customDesc,
                customIconUrl: item.customIconUrl,
                notes: item.notes,
                screenshotUrls: item.screenshotUrls,
                rating: item.rating,
                review: item.review,
                tags: item.tags,
                customCategory: item.customCategory
              }
            })
          }
        }
      }

      return { success: true, canceled: false }
    } catch (error: any) {
      return { success: false, error: 'Błąd podczas importowania pliku: ' + error.message }
    }
  })
}
