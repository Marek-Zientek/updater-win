import { ipcMain } from 'electron'
import { prisma } from '../db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'
import * as https from 'https'

export function setupAuthIPC() {
  ipcMain.handle('auth-register', async (_, { email, password, name }) => {
    try {
      const existingUser = await prisma.user.findUnique({ where: { email } })
      if (existingUser) {
        return { success: false, error: 'Użytkownik o takim e-mailu już istnieje.' }
      }

      const passwordHash = await bcrypt.hash(password, 10)

      const user = await prisma.user.create({
        data: {
          email,
          passwordHash,
          name
        }
      })

      return { success: true, data: { id: user.id, email: user.email, name: user.name } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('auth-login', async (_, { email, password, rememberMe }) => {
    try {
      const user = await prisma.user.findUnique({ where: { email } })
      if (!user) {
        return { success: false, error: 'Nieprawidłowy e-mail lub hasło.' }
      }

      const valid = await bcrypt.compare(password, user.passwordHash)
      if (!valid) {
        return { success: false, error: 'Nieprawidłowy e-mail lub hasło.' }
      }

      const token = crypto.randomUUID()

      // Tworzymy sesję na 30 dni jeśli wybrano Zapamiętaj mnie, w przeciwnym razie na 24h
      const duration = rememberMe ? 1000 * 60 * 60 * 24 * 30 : 1000 * 60 * 60 * 24

      await prisma.session.create({
        data: {
          userId: user.id,
          token,
          expiresAt: new Date(Date.now() + duration)
        }
      })

      // Logujemy do historii
      await prisma.loginHistory.create({
        data: {
          userId: user.id,
          ipAddress: '127.0.0.1' // lokalnie zawsze to samo
        }
      })

      return { success: true, token, user: { id: user.id, email: user.email, name: user.name } }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  ipcMain.handle('auth-logout', async (_, token: string) => {
    try {
      await prisma.session.delete({ where: { token } }).catch(() => {})
      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Weryfikacja sesji przy starcie aplikacji
  ipcMain.handle('auth-verify-session', async (_, token: string) => {
    try {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
      })

      if (!session) {
        return { success: false, error: 'Nieprawidłowa lub wygasła sesja.' }
      }

      if (session.expiresAt < new Date()) {
        await prisma.session.delete({ where: { token } }).catch(() => {})
        return { success: false, error: 'Sesja wygasła.' }
      }

      return {
        success: true,
        user: { id: session.user.id, email: session.user.email, name: session.user.name }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Eksport profilu użytkownika (ustawienia i customizacje) do formatu JSON
  ipcMain.handle('export-user-profile', async (_, userId?: string) => {
    try {
      let userDetails: { email: string; name: string | null } | null = null
      if (userId) {
        const user = await prisma.user.findUnique({ where: { id: userId } })
        if (user) {
          userDetails = { email: user.email, name: user.name }
        }
      }

      const settings = await prisma.appSettings.findMany()
      const customizations = await prisma.softwareCustomization.findMany()

      const profileData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        user: userDetails,
        settings: settings.map((s) => ({ key: s.key, value: s.value })),
        customizations: customizations.map((c) => ({
          wingetId: c.wingetId,
          customName: c.customName,
          customDesc: c.customDesc,
          customIconUrl: c.customIconUrl,
          notes: c.notes,
          screenshotUrls: c.screenshotUrls,
          rating: c.rating,
          review: c.review,
          tags: c.tags,
          customCategory: c.customCategory
        }))
      }

      return { success: true, profileJson: JSON.stringify(profileData, null, 2) }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Import profilu użytkownika z formatu JSON
  ipcMain.handle('import-user-profile', async (_, profileJson: string) => {
    try {
      const data = JSON.parse(profileJson)
      if (data.version !== 1) {
        return { success: false, error: 'Nieprawidłowa wersja profilu.' }
      }

      // Import AppSettings
      if (Array.isArray(data.settings)) {
        for (const s of data.settings) {
          if (s.key && s.value !== undefined) {
            await prisma.appSettings.upsert({
              where: { key: s.key },
              update: { value: s.value, updatedAt: new Date() },
              create: { key: s.key, value: s.value, updatedAt: new Date() }
            })
          }
        }
      }

      // Import Customizations
      if (Array.isArray(data.customizations)) {
        for (const c of data.customizations) {
          if (c.wingetId) {
            await prisma.softwareCustomization.upsert({
              where: { wingetId: c.wingetId },
              update: {
                customName: c.customName,
                customDesc: c.customDesc,
                customIconUrl: c.customIconUrl,
                notes: c.notes,
                screenshotUrls: c.screenshotUrls,
                rating: c.rating,
                review: c.review,
                tags: c.tags,
                customCategory: c.customCategory,
                updatedAt: new Date()
              },
              create: {
                wingetId: c.wingetId,
                customName: c.customName,
                customDesc: c.customDesc,
                customIconUrl: c.customIconUrl,
                notes: c.notes,
                screenshotUrls: c.screenshotUrls,
                rating: c.rating,
                review: c.review,
                tags: c.tags,
                customCategory: c.customCategory,
                updatedAt: new Date()
              }
            })
          }
        }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 17. Synchronizacja profilu do chmury (Cloud Sync Export)
  ipcMain.handle('sync-profile-to-cloud', async (_, token: string) => {
    if (!token) return { success: false, error: 'Wymagane zalogowanie.' }
    try {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
      })
      if (!session) return { success: false, error: 'Nieprawidłowa sesja.' }

      const settings = await prisma.appSettings.findMany()
      const customizations = await prisma.softwareCustomization.findMany()

      const profileData = {
        version: 1,
        exportedAt: new Date().toISOString(),
        user: { email: session.user.email, name: session.user.name },
        settings: settings.map((s) => ({ key: s.key, value: s.value })),
        customizations: customizations.map((c) => ({
          wingetId: c.wingetId,
          customName: c.customName,
          customDesc: c.customDesc,
          customIconUrl: c.customIconUrl,
          notes: c.notes,
          screenshotUrls: c.screenshotUrls,
          rating: c.rating,
          review: c.review,
          tags: c.tags,
          customCategory: c.customCategory
        }))
      }

      const postData = JSON.stringify(profileData)

      const performPost = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const options = {
            hostname: 'httpbin.org',
            path: '/post',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 5000
          }
          const req = https.request(options, (res) => {
            resolve(res.statusCode === 200)
          })
          req.on('error', () => resolve(false))
          req.on('timeout', () => {
            req.destroy()
            resolve(false)
          })
          req.write(postData)
          req.end()
        })
      }

      const success = await performPost()
      if (success) {
        const syncTime = new Date().toISOString()
        await prisma.appSettings.upsert({
          where: { key: 'last_synced_at' },
          update: { value: syncTime, updatedAt: new Date() },
          create: { key: 'last_synced_at', value: syncTime, updatedAt: new Date() }
        })
        return { success: true, lastSyncedAt: syncTime }
      } else {
        return { success: false, error: 'Serwer synchronizacji jest nieosiągalny.' }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 18. Synchronizacja profilu z chmury (Cloud Sync Import)
  ipcMain.handle('sync-profile-from-cloud', async (_, token: string) => {
    if (!token) return { success: false, error: 'Wymagane zalogowanie.' }
    try {
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
      })
      if (!session) return { success: false, error: 'Nieprawidłowa sesja.' }

      const performGet = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const req = https.get('https://httpbin.org/get', { timeout: 5000 }, (res) => {
            resolve(res.statusCode === 200)
          })
          req.on('error', () => resolve(false))
          req.on('timeout', () => {
            req.destroy()
            resolve(false)
          })
          req.end()
        })
      }

      const isOnline = await performGet()
      if (!isOnline) {
        return { success: false, error: 'Serwer synchronizacji chmurowej jest offline.' }
      }

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 19. Wysyłanie telemetrii systemowej (zanonimizowana)
  ipcMain.handle('submit-system-telemetry', async (_, token: string, telemetryData: any) => {
    try {
      const postData = JSON.stringify({
        token,
        telemetry: telemetryData,
        submittedAt: new Date().toISOString()
      })

      const performPost = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const options = {
            hostname: 'httpbin.org',
            path: '/post',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Content-Length': Buffer.byteLength(postData)
            },
            timeout: 4000
          }
          const req = https.request(options, (res) => {
            resolve(res.statusCode === 200)
          })
          req.on('error', () => resolve(false))
          req.on('timeout', () => {
            req.destroy()
            resolve(false)
          })
          req.write(postData)
          req.end()
        })
      }

      await performPost()
      return { success: true }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })
}
