import { PrismaClient } from '@prisma/client'

import { PrismaLibSql } from '@prisma/adapter-libsql'
import { join } from 'path'
import { app } from 'electron'
import { pathToFileURL } from 'url'

// W trybie deweloperskim używamy pliku w głównym katalogu, a w produkcji userData.
const dbPath = app.isPackaged
  ? join(app.getPath('userData'), 'database.db')
  : join(process.cwd(), 'dev.db')

// Używamy poprawnego konwertera do URL w środowisku Windows:
const fileUrl = pathToFileURL(dbPath).href

// Prisma 7 odczytuje konfigurację prisma.config.ts, co wymaga podania zmiennej środowiskowej
process.env.DATABASE_URL = fileUrl

const adapter = new PrismaLibSql({
  url: fileUrl
})

export const prisma = new PrismaClient({ adapter })
