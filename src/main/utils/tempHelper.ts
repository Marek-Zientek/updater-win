import { exec } from 'child_process'

/**
 * Pobiera bezpieczną i realistyczną temperaturę CPU na Windows / macOS / Linux.
 * Na Windows odpytuje WMI/CIM w jednym zapytaniu PowerShell, filtrując martwe odczyty (<= 15°C i >= 115°C).
 * W przypadku braku odczytów sprzętowych stosuje estymacyjny fallback w oparciu o obciążenie CPU.
 */
export function getCpuTemperatureWithFallback(siTemp: number, cpuLoad?: number): Promise<number> {
  return new Promise((resolve) => {
    // Jeśli systeminformation odczytał poprawnie rzeczywistą temperaturę (> 15 i < 115), to jej używamy
    if (siTemp > 15 && siTemp < 115) {
      resolve(Math.round(siTemp))
      return
    }

    if (process.platform !== 'win32') {
      resolve(Math.round(siTemp > 0 ? siTemp : 35))
      return
    }

    // Zaawansowany skrypt PowerShell odpytujący root/wmi oraz root/cimv2 (bez uprawnień admina)
    const psCommand =
      `$temps = @(); ` +
      `try { $wmiTemps = Get-CimInstance -Namespace root/wmi -ClassName MSAcpi_ThermalZoneTemperature -ErrorAction SilentlyContinue; ` +
      `if ($wmiTemps) { foreach ($t in $wmiTemps) { if ($t.CurrentTemperature) { ` +
      `$c = [Math]::Round(($t.CurrentTemperature / 10) - 273.15); if ($c -gt 15 -and $c -lt 115) { $temps += $c } } } } } catch {}; ` +
      `try { $perfTemps = Get-CimInstance -Namespace root/cimv2 -ClassName Win32_PerfFormattedData_Counters_ThermalZoneInformation -ErrorAction SilentlyContinue; ` +
      `if ($perfTemps) { foreach ($t in $perfTemps) { if ($t.HighPrecisionTemperature) { ` +
      `$c = [Math]::Round(($t.HighPrecisionTemperature / 10) - 273.15); if ($c -gt 15 -and $c -lt 115) { $temps += $c } ` +
      `} elseif ($t.Temperature) { $c = [Math]::Round($t.Temperature - 273.15); if ($c -gt 15 -and $c -lt 115) { $temps += $c } } } } } catch {}; ` +
      `try { $sensorTemps = Get-WmiObject -Namespace root/cimv2 -Class Win32_TemperatureSensor -ErrorAction SilentlyContinue; ` +
      `if ($sensorTemps) { foreach ($t in $sensorTemps) { if ($t.CurrentReading) { ` +
      `$c = $t.CurrentReading; if ($c -gt 150) { $c = [Math]::Round($c - 273.15) }; if ($c -gt 15 -and $c -lt 115) { $temps += $c } } } } } catch {}; ` +
      `if ($temps.Count -gt 0) { $temps | Measure-Object -Maximum | Select-Object -ExpandProperty Maximum } else { 0 }`

    exec(`powershell -NoProfile -Command "${psCommand.replace(/"/g, '\\"')}"`, (err, stdout) => {
      if (!err && stdout.trim()) {
        const val = parseInt(stdout.trim(), 10)
        if (!isNaN(val) && val > 15 && val < 115) {
          resolve(val)
          return
        }
      }

      // Jeśli sprzęt nie udostępnia sensorów przez WMI/CIM, wyliczamy estymowaną temperaturę
      if (typeof cpuLoad === 'number') {
        // Estymacja: baza 35°C + 0.4°C na każdy procent obciążenia CPU (reaguje na obciążenie)
        const estimatedTemp = Math.round(35 + cpuLoad * 0.4)
        resolve(estimatedTemp)
      } else {
        // Ostateczny fallback na siTemp lub domyślne 38°C
        resolve(siTemp > 15 && siTemp < 115 ? Math.round(siTemp) : 38)
      }
    })
  })
}
