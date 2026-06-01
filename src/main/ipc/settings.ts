import { ipcMain, app } from 'electron'
import { prisma } from '../db'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

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
 * Synchronizuje natywne zadanie harmonogramu Windows (Task Scheduler).
 */
async function syncTaskScheduler(): Promise<void> {
  if (process.platform !== 'win32') return

  try {
    const enabled = await getSettingInternal('auto_update_enabled', 'false')
    const taskName = 'UpdaterWindowsAutoUpdate'

    if (enabled !== 'true') {
      try {
        await execAsync(`schtasks /delete /tn "${taskName}" /f`)
      } catch (err) {
        // Ignoruj błąd jeśli zadanie nie istniało
      }
      return
    }

    const time = await getSettingInternal('auto_update_time', '02:00')
    const interval = await getSettingInternal('auto_update_interval', 'daily')
    const weekday = await getSettingInternal('auto_update_weekday', '1')

    let scheduleType = 'DAILY'
    let extraArgs = ''

    if (interval === 'weekly') {
      scheduleType = 'WEEKLY'
      const WEEKDAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN']
      const day = WEEKDAYS[parseInt(weekday) - 1] || 'MON'
      extraArgs = `/d ${day}`
    } else if (interval === 'monthly') {
      scheduleType = 'MONTHLY'
      extraArgs = '/d 1'
    }

    const execPath = process.execPath
    const command = `schtasks /create /tn "${taskName}" /tr "\\"${execPath}\\" --silent-update" /sc ${scheduleType} ${extraArgs} /st ${time} /f`

    await execAsync(command)
    console.log(`[Task Scheduler] Synced task: ${scheduleType} ${extraArgs} at ${time}`)
  } catch (err) {
    console.error('[Task Scheduler] Sync failed:', err)
  }
}

/**
 * IPC handlers dla ustawień aplikacji.
 */
export function setupSettingsIPC(): void {
  // Uruchom synchronizację na starcie
  syncTaskScheduler().catch(err => console.error('[Task Scheduler] Initial sync failed:', err))

  // Zsynchronizuj autostart przy uruchomieniu aplikacji
  getSettingInternal('open_at_login', 'false')
    .then((openAtLogin) => {
      app.setLoginItemSettings({
        openAtLogin: openAtLogin === 'true',
        path: process.execPath,
        args: ['--hidden']
      })
    })
    .catch((err) => console.error('[Autostart] Sync failed:', err))

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
      
      // Zsynchronizuj harmonogram jeśli zmieniono powiązane ustawienia
      const schedulerKeys = [
        'auto_update_enabled',
        'auto_update_time',
        'auto_update_interval',
        'auto_update_weekday'
      ]
      if (schedulerKeys.includes(key)) {
        await syncTaskScheduler()
      }

      if (key === 'open_at_login') {
        app.setLoginItemSettings({
          openAtLogin: value === 'true',
          path: process.execPath,
          args: ['--hidden']
        })
      }
      
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
