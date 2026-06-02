import { ipcMain } from 'electron'
import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export function setupWindowsUpdateIPC(): void {
  // Pobieranie statusu wstrzymania aktualizacji
  ipcMain.handle('get-windows-update-status', async () => {
    return new Promise((resolve) => {
      const psCommand =
        `$path = 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings'; ` +
        `$paused = $false; $expiry = ''; $start = ''; ` +
        `if (Test-Path $path) { ` +
        `  $val = Get-ItemProperty -Path $path; ` +
        `  if ($val.PauseUpdatesExpiryTime) { ` +
        `    $paused = $true; ` +
        `    $expiry = $val.PauseUpdatesExpiryTime; ` +
        `    $start = $val.PauseUpdatesStartTime; ` +
        `  } ` +
        `}; ` +
        `@{ paused = $paused; expiryTime = $expiry; startTime = $start } | ConvertTo-Json -Compress`

      exec(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve({ paused: false, expiryTime: '', startTime: '' })
          return
        }
        try {
          resolve(JSON.parse(stdout.trim()))
        } catch {
          resolve({ paused: false, expiryTime: '', startTime: '' })
        }
      })
    })
  })

  // Wstrzymywanie aktualizacji
  ipcMain.handle('pause-windows-updates', async (_, days: number) => {
    return new Promise((resolve) => {
      const tempScriptPath = path.join(os.tmpdir(), 'pause_updates.ps1')
      const start = new Date().toISOString()
      const expiry = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString()

      const scriptContent = `
$start = "${start}"
$expiry = "${expiry}"
$path = 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings'
if (-not (Test-Path $path)) { New-Item -Path $path -Force | Out-Null }
Set-ItemProperty -Path $path -Name PauseUpdatesStartTime -Value $start -Type String -Force | Out-Null
Set-ItemProperty -Path $path -Name PauseUpdatesExpiryTime -Value $expiry -Type String -Force | Out-Null
Set-ItemProperty -Path $path -Name PauseFeatureUpdatesStartTime -Value $start -Type String -Force | Out-Null
Set-ItemProperty -Path $path -Name PauseFeatureUpdatesExpiryTime -Value $expiry -Type String -Force | Out-Null
Set-ItemProperty -Path $path -Name PauseQualityUpdatesStartTime -Value $start -Type String -Force | Out-Null
Set-ItemProperty -Path $path -Name PauseQualityUpdatesExpiryTime -Value $expiry -Type String -Force | Out-Null
`
      try {
        fs.writeFileSync(tempScriptPath, scriptContent, 'utf8')
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        resolve({ success: false, error: 'Nie udało się stworzyć pliku skryptu: ' + errMsg })
        return
      }

      const elevatedCmd = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"' -Verb RunAs -WindowStyle Hidden -Wait`

      exec(`powershell -NoProfile -Command "${elevatedCmd.replace(/"/g, '\\"')}"`, (err) => {
        try {
          if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath)
        } catch {
          // ignore
        }

        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  })

  // Wznowienie aktualizacji
  ipcMain.handle('resume-windows-updates', async () => {
    return new Promise((resolve) => {
      const tempScriptPath = path.join(os.tmpdir(), 'resume_updates.ps1')

      const scriptContent = `
$path = 'HKLM:\\SOFTWARE\\Microsoft\\WindowsUpdate\\UX\\Settings'
if (Test-Path $path) {
  Remove-ItemProperty -Path $path -Name PauseUpdatesStartTime -ErrorAction SilentlyContinue | Out-Null
  Remove-ItemProperty -Path $path -Name PauseUpdatesExpiryTime -ErrorAction SilentlyContinue | Out-Null
  Remove-ItemProperty -Path $path -Name PauseFeatureUpdatesStartTime -ErrorAction SilentlyContinue | Out-Null
  Remove-ItemProperty -Path $path -Name PauseFeatureUpdatesExpiryTime -ErrorAction SilentlyContinue | Out-Null
  Remove-ItemProperty -Path $path -Name PauseQualityUpdatesStartTime -ErrorAction SilentlyContinue | Out-Null
  Remove-ItemProperty -Path $path -Name PauseQualityUpdatesExpiryTime -ErrorAction SilentlyContinue | Out-Null
}
`
      try {
        fs.writeFileSync(tempScriptPath, scriptContent, 'utf8')
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        resolve({ success: false, error: 'Nie udało się stworzyć pliku skryptu: ' + errMsg })
        return
      }

      const elevatedCmd = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"' -Verb RunAs -WindowStyle Hidden -Wait`

      exec(`powershell -NoProfile -Command "${elevatedCmd.replace(/"/g, '\\"')}"`, (err) => {
        try {
          if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath)
        } catch {
          // ignore
        }

        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  })

  // Pobieranie historii aktualizacji z COM API
  ipcMain.handle('get-windows-update-history', async () => {
    return new Promise((resolve) => {
      const psCommand =
        `$Session = New-Object -ComObject Microsoft.Update.Session; ` +
        `$Searcher = $Session.CreateUpdateSearcher(); ` +
        `$HistoryCount = $Searcher.GetTotalHistoryCount(); ` +
        `if ($HistoryCount -gt 0) { ` +
        `  $updates = $Searcher.QueryHistory(0, $HistoryCount) | Select-Object Title, Date, Description, ResultCode | Sort-Object Date -Descending | Select-Object -First 50; ` +
        `  $output = @(); ` +
        `  foreach ($u in $updates) { ` +
        `    $kb = ''; ` +
        `    if ($u.Title -match '(KB\\d+)') { $kb = $Matches[1] }; ` +
        `    $output += [PSCustomObject]@{ ` +
        `      title = $u.Title; ` +
        `      date = $u.Date.ToString('yyyy-MM-dd HH:mm:ss'); ` +
        `      description = $u.Description; ` +
        `      kb = $kb; ` +
        `      result = $u.ResultCode ` +
        `    } ` +
        `  }; ` +
        `  $output | ConvertTo-Json -Compress; ` +
        `} else { ` +
        `  '[]'; ` +
        `}`

      exec(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, (err, stdout) => {
        if (err || !stdout.trim()) {
          resolve({ success: true, data: [] })
          return
        }
        try {
          const parsed = JSON.parse(stdout.trim())
          resolve({ success: true, data: Array.isArray(parsed) ? parsed : [parsed] })
        } catch {
          resolve({ success: true, data: [] })
        }
      })
    })
  })

  // Odinstalowywanie aktualizacji KB
  ipcMain.handle('uninstall-windows-update', async (_, kbNumber: string) => {
    return new Promise((resolve) => {
      const cleanKb = kbNumber.toUpperCase().replace('KB', '')
      const elevatedCmd = `Start-Process wusa.exe -ArgumentList '/uninstall /kb:${cleanKb} /quiet /norestart' -Verb RunAs -Wait`

      exec(`powershell -NoProfile -Command "${elevatedCmd.replace(/"/g, '\\"')}"`, (err) => {
        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  })

  // Czyszczenie SoftwareDistribution cache
  ipcMain.handle('clear-windows-update-cache', async () => {
    return new Promise((resolve) => {
      const tempScriptPath = path.join(os.tmpdir(), 'clear_update_cache.ps1')

      const scriptContent = `
Stop-Service -Name wuauserv -Force -ErrorAction SilentlyContinue | Out-Null
Stop-Service -Name bits -Force -ErrorAction SilentlyContinue | Out-Null
Stop-Service -Name cryptsvc -Force -ErrorAction SilentlyContinue | Out-Null

$path = "C:\\Windows\\SoftwareDistribution"
if (Test-Path $path) {
  Remove-Item -Path "$path\\*" -Recurse -Force -ErrorAction SilentlyContinue | Out-Null
}

Start-Service -Name wuauserv -ErrorAction SilentlyContinue | Out-Null
Start-Service -Name bits -ErrorAction SilentlyContinue | Out-Null
Start-Service -Name cryptsvc -ErrorAction SilentlyContinue | Out-Null
`
      try {
        fs.writeFileSync(tempScriptPath, scriptContent, 'utf8')
      } catch (e: unknown) {
        const errMsg = e instanceof Error ? e.message : String(e)
        resolve({ success: false, error: 'Nie udało się stworzyć pliku skryptu: ' + errMsg })
        return
      }

      const elevatedCmd = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"' -Verb RunAs -WindowStyle Hidden -Wait`

      exec(`powershell -NoProfile -Command "${elevatedCmd.replace(/"/g, '\\"')}"`, (err) => {
        try {
          if (fs.existsSync(tempScriptPath)) fs.unlinkSync(tempScriptPath)
        } catch {
          // ignore
        }

        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  })
}
