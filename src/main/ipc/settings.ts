import { ipcMain } from 'electron'
import { prisma } from '../db'

/**
 * Odczytuje ustawienie bezpośrednio z bazy danych w procesie głównym.
 */
export async function getSettingInternal(key: string, defaultValue: string = ''): Promise<string> {
  try {
    const record = await prisma.appSettings.findUnique({
      where: { key }
    })
    return record ? record.value : defaultValue
  } catch (err) {
    return defaultValue
  }
}

/**
 * Zapisuje ustawienie bezpośrednio w bazie danych w procesie głównym.
 */
export async function saveSettingInternal(key: string, value: string): Promise<void> {
  try {
    await prisma.appSettings.upsert({
      where: { key },
      update: { value },
      create: { key, value }
    })
  } catch (err) {
    console.error(`[Settings DB] Failed to save setting '${key}':`, err)
  }
}

/**
 * IPC handlers dla ustawień aplikacji.
 */
export function setupSettingsIPC(): void {
  // Pobierz ustawienie
  ipcMain.handle('get-setting', async (_, key: string, defaultValue?: string) => {
    try {
      const val = await getSettingInternal(key, defaultValue)
      return { success: true, value: val }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // Zapisz ustawienie
  ipcMain.handle('save-setting', async (_, key: string, value: string) => {
    try {
      await saveSettingInternal(key, value)
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
