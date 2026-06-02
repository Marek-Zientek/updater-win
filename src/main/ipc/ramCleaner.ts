import { ipcMain } from 'electron'
import { exec } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export function setupRamCleanerIPC() {
  // Pobieranie statystyk RAM (używana, standby cache, wolna, całkowita)
  ipcMain.handle('get-ram-stats', async () => {
    return new Promise((resolve) => {
      const psScript = 
        `$mem = Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory; ` +
        `$total = $mem.TotalVisibleMemorySize * 1024; ` +
        `$free = $mem.FreePhysicalMemory * 1024; ` +
        `$standby = 0; ` +
        `try { ` +
        `  $counters = @( ` +
        `    "\\Memory\\Standby Cache Core Bytes", ` +
        `    "\\Memory\\Standby Cache Normal Priority Bytes", ` +
        `    "\\Memory\\Standby Cache Reserve Bytes", ` +
        `    "\\Memory\\Modified page list bytes" ` +
        `  ); ` +
        `  foreach ($c in $counters) { ` +
        `    $val = (Get-Counter -Counter $c -ErrorAction SilentlyContinue).CounterSamples.CookedValue; ` +
        `    if ($val) { $standby += $val } ` +
        `  } ` +
        `} catch {}; ` +
        `$used = $total - $free - $standby; ` +
        `if ($used -lt 0) { $used = 0 }; ` +
        `$res = @{ total = $total; free = $free; standby = $standby; used = $used }; ` +
        `$res | ConvertTo-Json -Compress`

      exec(`powershell -NoProfile -Command "${psScript.replace(/"/g, '\\"')}"`, (err, stdout) => {
        if (err || !stdout.trim()) {
          // Fallback na wypadek braku liczników
          exec(`powershell -NoProfile -Command "Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory | ConvertTo-Json -Compress"`, (err2, stdout2) => {
            if (err2 || !stdout2.trim()) {
              resolve({ total: 16 * 1024 * 1024 * 1024, free: 8 * 1024 * 1024 * 1024, standby: 0, used: 8 * 1024 * 1024 * 1024 })
              return
            }
            try {
              const parsed = JSON.parse(stdout2.trim())
              const total = parsed.TotalVisibleMemorySize * 1024
              const free = parsed.FreePhysicalMemory * 1024
              resolve({ total, free, standby: 0, used: total - free })
            } catch {
              resolve({ total: 16 * 1024 * 1024 * 1024, free: 8 * 1024 * 1024 * 1024, standby: 0, used: 8 * 1024 * 1024 * 1024 })
            }
          })
          return
        }

        try {
          const parsed = JSON.parse(stdout.trim())
          resolve(parsed)
        } catch {
          resolve({ total: 16 * 1024 * 1024 * 1024, free: 8 * 1024 * 1024 * 1024, standby: 0, used: 8 * 1024 * 1024 * 1024 })
        }
      })
    })
  })

  // Czyszczenie pamięci RAM
  ipcMain.handle('clean-ram', async (_, type: 'standby' | 'workingsets' | 'both') => {
    return new Promise((resolve) => {
      const tempScriptPath = path.join(os.tmpdir(), 'clean_ram.ps1')
      
      let cleanCommands = ''
      if (type === 'standby' || type === 'both') {
        cleanCommands += '[RAMCleaner]::PurgeStandbyList()\n'
      }
      if (type === 'workingsets' || type === 'both') {
        cleanCommands += '[RAMCleaner]::EmptyWorkingSets()\n'
      }

      const scriptContent = `
Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;
public class RAMCleaner {
    [DllImport("ntdll.dll")]
    public static extern int NtSetSystemInformation(int SystemInformationClass, IntPtr SystemInformation, int SystemInformationLength);
    public static void PurgeStandbyList() {
        int command = 4;
        IntPtr ptr = Marshal.AllocHGlobal(Marshal.SizeOf(command));
        Marshal.StructureToPtr(command, ptr, false);
        NtSetSystemInformation(0x50, ptr, Marshal.SizeOf(command));
        Marshal.FreeHGlobal(ptr);
    }
    public static void EmptyWorkingSets() {
        int command = 2;
        IntPtr ptr = Marshal.AllocHGlobal(Marshal.SizeOf(command));
        Marshal.StructureToPtr(command, ptr, false);
        NtSetSystemInformation(0x50, ptr, Marshal.SizeOf(command));
        Marshal.FreeHGlobal(ptr);
    }
}
"@
${cleanCommands}
`
      try {
        fs.writeFileSync(tempScriptPath, scriptContent, 'utf8')
      } catch (e: any) {
        resolve({ success: false, error: 'Nie udało się stworzyć pliku skryptu: ' + e.message })
        return
      }

      const elevatedCmd = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"' -Verb RunAs -WindowStyle Hidden -Wait`

      exec(`powershell -NoProfile -Command "${elevatedCmd.replace(/"/g, '\\"')}"`, (err) => {
        // Po wykonaniu usuwamy tymczasowy skrypt
        try {
          if (fs.existsSync(tempScriptPath)) {
            fs.unlinkSync(tempScriptPath)
          }
        } catch {}

        if (err) {
          resolve({ success: false, error: err.message })
        } else {
          resolve({ success: true })
        }
      })
    })
  })
}
