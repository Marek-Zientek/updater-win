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

export async function initializeDatabase(): Promise<void> {
  try {
    const checkUserTable: any = await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='User';`
    )
    if (Array.isArray(checkUserTable) && checkUserTable.length === 0) {
      console.log('[Database] Database tables not found. Initializing schema...')
      const ddl = `
        CREATE TABLE "User" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "email" TEXT NOT NULL,
            "passwordHash" TEXT NOT NULL,
            "name" TEXT,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE "Session" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "token" TEXT NOT NULL,
            "expiresAt" DATETIME NOT NULL,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE TABLE "LoginHistory" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "userId" TEXT NOT NULL,
            "ipAddress" TEXT,
            "loginAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE TABLE "Software" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "wingetId" TEXT,
            "name" TEXT NOT NULL,
            "description" TEXT,
            "category" TEXT,
            "screenshotUrl" TEXT,
            "currentVersion" TEXT,
            "isDriver" BOOLEAN NOT NULL DEFAULT false,
            "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" DATETIME NOT NULL
        );
        CREATE TABLE "UpdateHistory" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "softwareId" TEXT NOT NULL,
            "previousVersion" TEXT,
            "newVersion" TEXT NOT NULL,
            "status" TEXT NOT NULL DEFAULT 'SUCCESS',
            "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
            CONSTRAINT "UpdateHistory_softwareId_fkey" FOREIGN KEY ("softwareId") REFERENCES "Software" ("id") ON DELETE CASCADE ON UPDATE CASCADE
        );
        CREATE TABLE "SoftwareCustomization" (
            "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
            "wingetId" TEXT NOT NULL,
            "customName" TEXT,
            "customDesc" TEXT,
            "customIconUrl" TEXT,
            "notes" TEXT,
            "screenshotUrls" TEXT,
            "rating" INTEGER,
            "review" TEXT,
            "tags" TEXT,
            "customCategory" TEXT,
            "updatedAt" DATETIME NOT NULL
        );
        CREATE TABLE "AppSettings" (
            "key" TEXT NOT NULL PRIMARY KEY,
            "value" TEXT NOT NULL,
            "updatedAt" DATETIME NOT NULL
        );
        CREATE TABLE "ResourceMetric" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "cpuLoad" REAL NOT NULL,
            "ramUsage" REAL NOT NULL,
            "gpuLoad" REAL,
            "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE TABLE "AppResourceMetric" (
            "id" TEXT NOT NULL PRIMARY KEY,
            "appName" TEXT NOT NULL,
            "cpuUsage" REAL NOT NULL,
            "ramUsage" REAL NOT NULL,
            "timestamp" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
        CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
        CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
        CREATE UNIQUE INDEX "Software_wingetId_key" ON "Software"("wingetId");
        CREATE UNIQUE INDEX "SoftwareCustomization_wingetId_key" ON "SoftwareCustomization"("wingetId");
      `

      const statements = ddl
        .split(';')
        .map((s) => s.trim())
        .filter((s) => s.length > 0)

      for (const statement of statements) {
        await prisma.$executeRawUnsafe(statement)
      }
      console.log('[Database] Schema initialization complete.')
    } else {
      console.log('[Database] Database tables verified.')
    }
  } catch (error) {
    console.error('[Database] Failed to initialize database:', error)
  }
}
