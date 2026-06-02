import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import * as fs from 'fs'
import * as path from 'path'

const execAsync = promisify(exec)

interface BloatwareDefinition {
  displayName: string
  packageNamePattern: string // Wzorzec dla Get-AppxPackage np. 'Microsoft.XboxApp'
  category: 'Gry' | 'Komunikacja' | 'Rozrywka' | 'Narzędzia' | 'Systemowe'
  description: string
  severity: 'low' | 'medium' | 'high' // Wpływ na zasoby/prywatność (high = zalecane usunięcie)
}

const BLOATWARE_LIST: BloatwareDefinition[] = [
  {
    displayName: 'Microsoft Solitaire Collection',
    packageNamePattern: 'Microsoft.MicrosoftSolitaireCollection',
    category: 'Gry',
    description: 'Klasyczny pasjans systemowy z wbudowanymi mikropłatnościami i reklamami.',
    severity: 'low'
  },
  {
    displayName: 'Aplikacje i Nakładka Xbox',
    packageNamePattern: 'Microsoft.Xbox*',
    category: 'Gry',
    description:
      'Pakiet nakładek Xbox Live, nagrywania gier w tle i funkcji społecznościowych dla graczy.',
    severity: 'medium'
  },
  {
    displayName: 'Łącze z telefonem (Your Phone)',
    packageNamePattern: 'Microsoft.YourPhone',
    category: 'Komunikacja',
    description: 'Aplikacja do synchronizacji telefonu z systemem Windows, działająca stale w tle.',
    severity: 'medium'
  },
  {
    displayName: 'Wiadomości Bing (Bing News)',
    packageNamePattern: 'Microsoft.BingNews',
    category: 'Rozrywka',
    description: 'Preinstalowany czytnik wiadomości Microsoftu generujący zbędne powiadomienia.',
    severity: 'low'
  },
  {
    displayName: 'Pogoda Bing (Bing Weather)',
    packageNamePattern: 'Microsoft.BingWeather',
    category: 'Rozrywka',
    description: 'Domyślna aplikacja pogodowa, której widgety obciążają powłokę systemową.',
    severity: 'low'
  },
  {
    displayName: 'Groove Music (ZuneMusic)',
    packageNamePattern: 'Microsoft.ZuneMusic',
    category: 'Rozrywka',
    description:
      'Stary odtwarzacz muzyczny Microsoft, zastąpiony w nowszych wersjach przez Odtwarzacz multimedialny.',
    severity: 'low'
  },
  {
    displayName: 'Filmy i TV (ZuneVideo)',
    packageNamePattern: 'Microsoft.ZuneVideo',
    category: 'Rozrywka',
    description:
      'Domyślny odtwarzacz wideo, często zastępowany przez użytkowników darmowymi programami typu VLC.',
    severity: 'low'
  },
  {
    displayName: 'Centrum opinii (Feedback Hub)',
    packageNamePattern: 'Microsoft.WindowsFeedbackHub',
    category: 'Systemowe',
    description:
      'Narzędzie wysyłające opinie użytkownika oraz rozbudowane raporty telemetryczne do Microsoftu.',
    severity: 'medium'
  },
  {
    displayName: 'Asystent Cortana',
    packageNamePattern: 'Microsoft.549981C3F5F10',
    category: 'Systemowe',
    description:
      'Wycofany i nieaktywny wirtualny asystent głosowy Microsoft, który wciąż zajmuje zasoby.',
    severity: 'high'
  },
  {
    displayName: 'Mixed Reality Portal',
    packageNamePattern: 'Microsoft.MixedReality.Portal',
    category: 'Systemowe',
    description:
      'Środowisko rzeczywistości wirtualnej i rozszerzonej (VR/AR), zbędne bez dedykowanych gogli.',
    severity: 'medium'
  },
  {
    displayName: 'Mapy Windows',
    packageNamePattern: 'Microsoft.WindowsMaps',
    category: 'Narzędzia',
    description: 'Domyślna aplikacja z mapami, rzadko używana na komputerach stacjonarnych.',
    severity: 'low'
  },
  {
    displayName: 'Porady Windows (Get Started)',
    packageNamePattern: 'Microsoft.Getstarted',
    category: 'Narzędzia',
    description:
      'Fabryczny samouczek systemu Windows, wyświetlający niechciane wskazówki po aktualizacjach.',
    severity: 'low'
  },
  {
    displayName: 'Kontakty (Microsoft People)',
    packageNamePattern: 'Microsoft.People',
    category: 'Komunikacja',
    description:
      'Książka adresowa Microsoft, zintegrowana z paskiem zadań i generująca procesy tła.',
    severity: 'low'
  }
]

export function setupBloatwareIPC(): void {
  // 1. Pobieranie listy zainstalowanych aplikacji bloatware
  ipcMain.handle('get-bloatware-apps', async () => {
    try {
      // Pobieramy wszystkie pakiety AppX zainstalowane u bieżącego użytkownika
      const psCommand = `
        Get-AppxPackage | Select-Object Name, PackageFullName | ConvertTo-Json
      `
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
      )

      if (!stdout || stdout.trim() === '') {
        return { success: true, data: [] }
      }

      const installedPackages = JSON.parse(stdout)
      const packagesList = Array.isArray(installedPackages)
        ? installedPackages
        : [installedPackages]

      // Mapujemy reguły bloatware i sprawdzamy, które są zainstalowane
      const detectedBloatware: any[] = []

      for (const def of BLOATWARE_LIST) {
        // Sprawdzamy czy wzorzec nazwy pasuje do zainstalowanych pakietów
        // Wzorzec może zawierać gwiazdkę (np. Microsoft.Xbox*)
        const patternRegex = new RegExp(
          '^' + def.packageNamePattern.replace(/\*/g, '.*') + '$',
          'i'
        )

        const matchedPackage = packagesList.find((p) => patternRegex.test(p.Name))
        if (matchedPackage) {
          detectedBloatware.push({
            name: def.displayName,
            packageName: matchedPackage.Name,
            packageFullName: matchedPackage.PackageFullName,
            category: def.category,
            description: def.description,
            severity: def.severity
          })
        }
      }

      return { success: true, data: detectedBloatware }
    } catch (error: any) {
      return {
        success: false,
        error: 'Nie udało się pobrać listy aplikacji: ' + error.message,
        data: []
      }
    }
  })

  // 2. Usuwanie aplikacji bloatware (odinstalowanie pakietu AppX)
  ipcMain.handle('remove-bloatware-app', async (_, packageFullName: string) => {
    if (!packageFullName) {
      return { success: false, error: 'Brak nazwy pakietu do usunięcia.' }
    }

    try {
      // Usuwanie pakietu za pomocą Remove-AppxPackage
      const psCommand = `Remove-AppxPackage -Package "${packageFullName}"`
      await execAsync(`powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand}"`)
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error: `Nie udało się odinstalować pakietu. Możliwe, że pakiet jest zablokowany przez system lub wymaga uprawnień administratora. Szczegóły: ${error.message}`
      }
    }
  })

  // 3. Skanowanie pozostałości po usuniętej aplikacji
  ipcMain.handle('scan-leftovers', async (_, packageName: string) => {
    if (!packageName) return { success: false, error: 'Brak nazwy pakietu.' }

    const localAppData = process.env.LOCALAPPDATA || ''
    const packagesDir = path.join(localAppData, 'Packages')
    const detectedFiles: string[] = []
    const detectedRegs: string[] = []

    try {
      if (fs.existsSync(packagesDir)) {
        const folders = await fs.promises.readdir(packagesDir)
        for (const folder of folders) {
          if (folder.toLowerCase().includes(packageName.toLowerCase())) {
            const folderPath = path.join(packagesDir, folder)
            detectedFiles.push(folderPath)
          }
        }
      }
    } catch (err) {
      console.error('[Leftovers] Error scanning folders:', err)
    }

    try {
      const psCommand = `
        $path = 'HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Packages'
        if (Test-Path $path) {
            Get-ChildItem -Path $path | Where-Object { $_.Name -like '*${packageName}*' } | ForEach-Object { $_.Name }
        }
      `
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
      )
      if (stdout && stdout.trim() !== '') {
        const keys = stdout.split(/\r?\n/).filter((k) => k.trim() !== '')
        keys.forEach((k) => {
          detectedRegs.push(k.replace('HKEY_CURRENT_USER', 'HKCU'))
        })
      }
    } catch (err) {
      // Ignoruj
    }

    return {
      success: true,
      files: detectedFiles,
      registry: detectedRegs
    }
  })

  // 4. Usuwanie pozostałości (pliki i wpisy w rejestrze)
  ipcMain.handle('clean-leftovers', async (_, files: string[], registry: string[]) => {
    let filesDeleted = 0
    let regsDeleted = 0
    const errors: string[] = []

    for (const filePath of files) {
      try {
        if (fs.existsSync(filePath)) {
          await execAsync(
            `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Path '${filePath}' -Recurse -Force"`
          )
          filesDeleted++
        }
      } catch (err: any) {
        errors.push(`Plik: ${filePath} - ${err.message}`)
      }
    }

    for (const regPath of registry) {
      try {
        const formattedPath = regPath.replace('HKEY_CURRENT_USER', 'HKCU:').replace('HKCU', 'HKCU:')
        await execAsync(
          `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Remove-Item -Path '${formattedPath}' -Recurse -Force"`
        )
        regsDeleted++
      } catch (err: any) {
        errors.push(`Rejestr: ${regPath} - ${err.message}`)
      }
    }

    return {
      success: errors.length === 0,
      filesDeleted,
      regsDeleted,
      errors
    }
  })
}
