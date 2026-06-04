import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  Notification,
  globalShortcut,
  screen
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

import { setupHardwareIPC, recordResourceMetrics } from './ipc/hardware'
import { setupWingetIPC, checkForUpdatesInternal, runAutoUpdateScheduledTask } from './ipc/winget'
import { setupAuthIPC } from './ipc/auth'
import { setupIconsIPC } from './ipc/icons'
import { setupCustomizationsIPC } from './ipc/customizations'
import { setupStoreIPC } from './ipc/store'
import { setupSettingsIPC, getSettingInternal, saveSettingInternal } from './ipc/settings'
import { setupDriversIPC } from './ipc/drivers'
import { setupOptimizerIPC, runCleanupInternal } from './ipc/optimizer'
import { setupBackupIPC } from './ipc/backup'
import { setupBloatwareIPC } from './ipc/bloatware'
import { setupNetworkIPC } from './ipc/network'
import { setupPeripheralsIPC } from './ipc/peripherals'
import { setupDiagnosticsIPC } from './ipc/diagnostics'
import { setupRamCleanerIPC } from './ipc/ramCleaner'
import { setupWindowsUpdateIPC } from './ipc/windowsUpdate'
import { initializeDatabase } from './db'
import { startRemoteServer, stopRemoteServer, getRemoteServerStatus } from './remoteServer'

let mainWindow: BrowserWindow | null = null
let overlayWindow: BrowserWindow | null = null
let tray: Tray | null = null
let isQuitting = false

function createOverlayWindow(): void {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width: screenWidth } = primaryDisplay.workAreaSize

  overlayWindow = new BrowserWindow({
    width: 250,
    height: 200,
    x: screenWidth - 270,
    y: 40,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: false,
    skipTaskbar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  overlayWindow.setIgnoreMouseEvents(true)

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    overlayWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/overlay`)
  } else {
    overlayWindow.loadFile(join(__dirname, '../renderer/index.html'), { hash: 'overlay' })
  }

  overlayWindow.on('closed', () => {
    overlayWindow = null
  })
}

function toggleOverlayWindow(): void {
  if (!overlayWindow) {
    createOverlayWindow()
  }

  if (overlayWindow?.isVisible()) {
    overlayWindow.hide()
  } else {
    overlayWindow?.show()
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 750,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform !== 'darwin' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    const isHidden = process.argv.includes('--hidden') || process.argv.includes('--minimized')
    if (!isHidden) {
      mainWindow?.show()
    }
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  mainWindow.on('close', async (event) => {
    if (!isQuitting) {
      event.preventDefault()
      const minimizeToTray = await getSettingInternal('minimize_to_tray', 'true')
      if (minimizeToTray === 'true') {
        mainWindow?.hide()
      } else {
        isQuitting = true
        app.quit()
      }
    }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function createTray(): void {
  // Wczytanie ikony tray
  const trayIcon = nativeImage.createFromPath(icon)
  tray = new Tray(trayIcon)

  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Pokaż aplikację',
      click: (): void => {
        mainWindow?.show()
        mainWindow?.focus()
      }
    },
    {
      label: 'Sprawdź aktualizacje teraz',
      click: async (): Promise<void> => {
        new Notification({
          title: 'UpdaterWindows',
          body: 'Sprawdzanie aktualizacji w tle...',
          icon: icon
        }).show()

        try {
          const upgradable = await checkForUpdatesInternal()
          if (upgradable.length > 0) {
            new Notification({
              title: 'Dostępne aktualizacje',
              body: `Znaleziono ${upgradable.length} aplikacji do zaktualizowania.`,
              icon: icon
            }).show()
          } else {
            new Notification({
              title: 'Wszystko aktualne',
              body: 'Wszystkie zainstalowane aplikacje są aktualne.',
              icon: icon
            }).show()
          }
        } catch (err: any) {
          new Notification({
            title: 'Błąd sprawdzania',
            body: `Nie udało się sprawdzić aktualizacji: ${err.message}`,
            icon: icon
          }).show()
        }
      }
    },
    {
      label: 'Nakładka wydajnościowa (Ctrl+Shift+O)',
      click: (): void => {
        toggleOverlayWindow()
      }
    },
    { type: 'separator' },
    {
      label: 'Zamknij aplikację',
      click: (): void => {
        isQuitting = true
        app.quit()
      }
    }
  ])

  tray.setToolTip('UpdaterWindows')
  tray.setContextMenu(contextMenu)

  tray.on('click', () => {
    if (mainWindow?.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow?.show()
      mainWindow?.focus()
    }
  })
}

async function runAutoCheckScheduler(): Promise<void> {
  const autoCheckEnabled = await getSettingInternal('auto_check_enabled', 'true')
  if (autoCheckEnabled !== 'true') {
    console.log('[AutoCheck] Automated updates check is disabled.')
    return
  }

  const intervalHoursStr = await getSettingInternal('check_interval_hours', '6')
  const intervalMs = parseInt(intervalHoursStr, 10) * 60 * 60 * 1000

  const lastCheckedStr = await getSettingInternal('last_checked_at', '0')
  const lastChecked = parseInt(lastCheckedStr, 10)
  const now = Date.now()

  if (now - lastChecked >= intervalMs) {
    console.log('[AutoCheck] Running background updates check...')
    await saveSettingInternal('last_checked_at', now.toString())
    try {
      const upgradable = await checkForUpdatesInternal()
      const notificationsEnabled = await getSettingInternal('notifications_enabled', 'true')
      if (upgradable.length > 0 && notificationsEnabled === 'true') {
        new Notification({
          title: 'Dostępne aktualizacje',
          body: `Znaleziono ${upgradable.length} aktualizacji w tle.`,
          icon: icon
        }).show()
      }
    } catch (err) {
      console.error('[AutoCheck] Error during background check:', err)
    }
  } else {
    const timeRemainingMinutes = Math.round((intervalMs - (now - lastChecked)) / (60 * 1000))
    console.log(`[AutoCheck] Next check in ${timeRemainingMinutes} minutes.`)
  }
}

async function runBackgroundCleanerScheduler(): Promise<void> {
  const autoCleanEnabled = await getSettingInternal('auto_clean_enabled', 'false')
  if (autoCleanEnabled !== 'true') {
    console.log('[AutoClean] Background automated cleaner is disabled.')
    return
  }

  const interval = await getSettingInternal('auto_clean_interval', 'weekly')
  let intervalMs = 7 * 24 * 60 * 60 * 1000 // default weekly
  if (interval === 'daily') {
    intervalMs = 24 * 60 * 60 * 1000
  } else if (interval === 'monthly') {
    intervalMs = 30 * 24 * 60 * 60 * 1000
  }

  const lastCleanedStr = await getSettingInternal('last_cleaned_at', '0')
  const lastCleaned = parseInt(lastCleanedStr, 10)
  const now = Date.now()

  if (now - lastCleaned >= intervalMs) {
    console.log('[AutoClean] Running background cleanup...')
    await saveSettingInternal('last_cleaned_at', now.toString())
    try {
      const res = await runCleanupInternal()
      const notificationsEnabled = await getSettingInternal('notifications_enabled', 'true')
      if (res.success && notificationsEnabled === 'true') {
        const cleanedGb = (res.cleanedBytes / (1024 * 1024 * 1024)).toFixed(2)
        new Notification({
          title: 'Automatyczne czyszczenie',
          body: `Zakończono czyszczenie systemu w tle. Odzyskano ${cleanedGb} GB miejsca.`,
          icon: icon
        }).show()
      }
    } catch (err) {
      console.error('[AutoClean] Error during background cleaner:', err)
    }
  } else {
    const timeRemainingHours = Math.round((intervalMs - (now - lastCleaned)) / (60 * 60 * 1000))
    console.log(`[AutoClean] Next background cleanup in ${timeRemainingHours} hours.`)
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(async () => {
  // Inicjalizacja tabel bazy danych (SQLite / Prisma) w środowisku produkcyjnym
  await initializeDatabase()

  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))

  // Rejestracja IPC Handlers
  setupHardwareIPC()
  setupWingetIPC()
  setupAuthIPC()
  setupIconsIPC()
  setupCustomizationsIPC()
  setupStoreIPC()
  setupSettingsIPC()
  setupDriversIPC()
  setupOptimizerIPC()
  setupBackupIPC()
  setupBloatwareIPC()
  setupNetworkIPC()
  setupPeripheralsIPC()
  setupDiagnosticsIPC()
  setupRamCleanerIPC()
  setupWindowsUpdateIPC()

  // Zdalny Monitoring IPC
  ipcMain.handle('get-remote-server-config', async () => {
    return getRemoteServerStatus()
  })

  ipcMain.handle('toggle-remote-server', async (_, enable: boolean, port: number) => {
    if (enable) {
      const res = await startRemoteServer(port, (pin) => {
        console.log(`[RemoteServer] Uruchomiono serwer na porcie ${port}. Kod PIN: ${pin}`)
      })
      return res
    } else {
      stopRemoteServer()
      return { success: true }
    }
  })

  ipcMain.on('resize-window', (_, width, height) => {
    const win = BrowserWindow.getFocusedWindow()
    if (win) {
      win.setSize(width, height)
      win.center()
    }
  })

  // Autostart zdalnego serwera z bazy danych
  const remoteEnabled = await getSettingInternal('remote_server_enabled', 'false')
  if (remoteEnabled === 'true') {
    const remotePortStr = await getSettingInternal('remote_server_port', '9090')
    const remotePort = parseInt(remotePortStr, 10) || 9090
    startRemoteServer(remotePort, (pin) => {
      console.log(
        `[RemoteServer] Serwer uruchomiony automatycznie na porcie ${remotePort}. PIN: ${pin}`
      )
    }).catch(console.error)
  }

  createWindow()
  createTray()

  globalShortcut.register('CommandOrControl+Shift+O', () => {
    toggleOverlayWindow()
  })

  // Inicjalizacja harmonogramu auto-check
  setTimeout(runAutoCheckScheduler, 5000)
  // Sprawdzaj co 15 minut
  setInterval(runAutoCheckScheduler, 15 * 60 * 1000)

  // Inicjalizacja cyklicznego zapisu metryk wydajności (co 1 minutę)
  setTimeout(recordResourceMetrics, 5000)
  setInterval(recordResourceMetrics, 60 * 1000)

  // Inicjalizacja harmonogramu automatycznych aktualizacji (co 15 minut)
  setTimeout(runAutoUpdateScheduledTask, 10000)
  setInterval(runAutoUpdateScheduledTask, 15 * 60 * 1000)

  // Inicjalizacja harmonogramu czyszczenia w tle (co 15 minut)
  setTimeout(runBackgroundCleanerScheduler, 15000)
  setInterval(runBackgroundCleanerScheduler, 15 * 60 * 1000)

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
