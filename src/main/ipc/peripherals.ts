import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export function setupPeripheralsIPC(): void {
  // 1. Pobieranie listy urządzeń peryferyjnych
  ipcMain.handle('get-peripherals', async () => {
    const psCommand = `
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8;
      Get-PnpDevice -PresentOnly |
      Where-Object { $_.Class -match 'Mouse|Keyboard|USB|Image|Camera|Printer|Audio|Bluetooth|MEDIA' } |
      Select-Object FriendlyName, InstanceId, Status, Class |
      ConvertTo-Json
    `
    try {
      const { stdout } = await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
      )

      if (!stdout || stdout.trim() === '') {
        return { success: true, data: [] }
      }

      const parsed = JSON.parse(stdout)
      const list = Array.isArray(parsed) ? parsed : [parsed]

      // Filtrowanie i czyszczenie danych
      const cleanedList = list.map((device) => ({
        friendlyName: device.FriendlyName || 'Nieznane urządzenie',
        instanceId: device.InstanceId,
        status: device.Status || 'Unknown',
        class: device.Class || 'Unknown'
      }))

      return { success: true, data: cleanedList }
    } catch (error: any) {
      console.error('[Peripherals IPC] get-peripherals error:', error)
      return { success: false, error: error.message, data: [] }
    }
  })

  // 2. Włączanie/wyłączanie urządzenia PnP (Wymaga UAC - RunAs)
  ipcMain.handle('toggle-device', async (_, instanceId: string, enable: boolean) => {
    if (!instanceId) return { success: false, error: 'Brak identyfikatora InstanceId urządzenia.' }

    const verb = enable ? 'Enable' : 'Disable'
    // Start-Process z -Verb RunAs do podniesienia uprawnień UAC
    const psCommand = `
      Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -Command ${verb}-PnpDevice -InstanceId \\"${instanceId}\\" -Confirm:$false' -Verb RunAs -Wait
    `

    try {
      console.log(`[Peripherals IPC] Running ${verb}-PnpDevice for ${instanceId}...`)
      await execAsync(
        `powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "${psCommand.replace(/\n/g, ' ')}"`
      )
      return { success: true }
    } catch (error: any) {
      console.error(`[Peripherals IPC] toggle-device (${verb}) error:`, error)
      return {
        success: false,
        error: `Nie udało się zmienić stanu urządzenia. Upewnij się, że zaakceptowałeś monit administratora (UAC).`
      }
    }
  })

  // 3. Uruchamianie systemowego Menedżera Urządzeń
  ipcMain.handle('launch-device-manager', async () => {
    try {
      exec('devmgmt.msc')
      return { success: true }
    } catch (error: any) {
      console.error('[Peripherals IPC] devmgmt.msc launch error:', error)
      return { success: false, error: error.message }
    }
  })
}
