import { ipcMain } from 'electron'
import { prisma } from '../db'
import bcrypt from 'bcryptjs'
import crypto from 'crypto'

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
}
