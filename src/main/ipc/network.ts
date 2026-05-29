import { ipcMain } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { Buffer } from 'buffer'
import https from 'https'
import { URL } from 'url'

const execAsync = promisify(exec)

// Pomocnicza funkcja do testowania pobierania (Download Speed)
function runDownloadTest(
  event: any,
  downloadUrl: string,
  _totalBytesToDownload: number
): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(downloadUrl)
    const startTime = Date.now()
    let downloadedBytes = 0
    let lastTime = startTime
    let isDone = false

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + parsedUrl.search,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://speed.cloudflare.com',
        Referer: 'https://speed.cloudflare.com/'
      }
    }

    const req = https.get(options, (res) => {
      if (res.statusCode !== 200) {
        reject(new Error(`Błąd pobierania danych testowych: ${res.statusCode}`))
        return
      }

      res.on('data', (chunk) => {
        if (isDone) return
        downloadedBytes += chunk.length
        const now = Date.now()

        // Raportuj postęp co 150ms do renderera
        if (now - lastTime > 150) {
          const durationSec = (now - startTime) / 1000
          const currentSpeedMbps = (downloadedBytes * 8) / (1024 * 1024) / durationSec
          const percent = Math.min(Math.round((durationSec / 6.0) * 100), 100)

          event.sender.send('speedtest-progress', {
            type: 'download',
            speed: Math.round(currentSpeedMbps * 10) / 10,
            percent
          })
          lastTime = now
        }

        // Limit do 6 sekund
        if (now - startTime >= 6000) {
          isDone = true
          req.destroy()
          const totalDurationSec = (now - startTime) / 1000
          const finalSpeedMbps = (downloadedBytes * 8) / (1024 * 1024) / totalDurationSec
          resolve(Math.round(finalSpeedMbps * 10) / 10)
        }
      })

      res.on('end', () => {
        if (isDone) return
        isDone = true
        const totalDurationSec = (Date.now() - startTime) / 1000
        const finalSpeedMbps = (downloadedBytes * 8) / (1024 * 1024) / totalDurationSec
        resolve(Math.round(finalSpeedMbps * 10) / 10)
      })
    })

    req.on('error', (err) => {
      if (isDone) return
      reject(err)
    })
    req.end()
  })
}

// Pomocnicza funkcja do testowania wysyłania (Upload Speed)
function runUploadTest(event: any, uploadUrl: string, totalBytesToUpload: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(uploadUrl)
    const startTime = Date.now()
    let uploadedBytes = 0
    let lastTime = startTime
    let isDone = false

    const chunkSize = 256 * 1024
    const buffer = Buffer.alloc(chunkSize, 'x')

    const options = {
      hostname: parsedUrl.hostname,
      path: parsedUrl.pathname + (parsedUrl.search || ''),
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': totalBytesToUpload.toString(),
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        Origin: 'https://speed.cloudflare.com',
        Referer: 'https://speed.cloudflare.com/'
      }
    }

    const req = https.request(options, (res) => {
      res.on('data', () => {})
      res.on('end', () => {
        if (isDone) return
        isDone = true
        const totalDurationSec = (Date.now() - startTime) / 1000
        const finalSpeedMbps = (uploadedBytes * 8) / (1024 * 1024) / totalDurationSec
        resolve(Math.round(finalSpeedMbps * 10) / 10)
      })
    })

    req.on('error', (err) => {
      if (isDone) return
      reject(err)
    })

    const sendChunk = () => {
      if (isDone) return

      if (uploadedBytes >= totalBytesToUpload) {
        isDone = true
        req.end()
        return
      }

      const now = Date.now()
      if (now - startTime >= 6000) {
        isDone = true
        req.destroy()
        const totalDurationSec = (now - startTime) / 1000
        const finalSpeedMbps = (uploadedBytes * 8) / (1024 * 1024) / totalDurationSec
        resolve(Math.round(finalSpeedMbps * 10) / 10)
        return
      }

      const remaining = totalBytesToUpload - uploadedBytes
      const currentChunkSize = Math.min(chunkSize, remaining)
      const dataToSend =
        currentChunkSize === chunkSize ? buffer : Buffer.alloc(currentChunkSize, 'x')

      req.write(dataToSend, () => {
        uploadedBytes += currentChunkSize
        const writeNow = Date.now()

        if (writeNow - lastTime > 150) {
          const durationSec = (writeNow - startTime) / 1000
          const currentSpeedMbps = (uploadedBytes * 8) / (1024 * 1024) / durationSec
          const percent = Math.min(Math.round((durationSec / 6.0) * 100), 100)

          event.sender.send('speedtest-progress', {
            type: 'upload',
            speed: Math.round(currentSpeedMbps * 10) / 10,
            percent
          })
          lastTime = writeNow
        }

        process.nextTick(sendChunk)
      })
    }

    sendChunk()
  })
}

// Funkcja pomocnicza do uruchamiania poleceń PowerShell za pomocą Base64 (EncodedCommand)
// Zapobiega to problemom z kodowaniem polskich znaków (diakrytyków) oraz parsowaniem cudzysłowów
async function runPowerShellScript(script: string): Promise<string> {
  const buffer = Buffer.from(script, 'utf16le')
  const base64 = buffer.toString('base64')
  const { stdout } = await execAsync(
    `powershell.exe -NoProfile -ExecutionPolicy Bypass -EncodedCommand ${base64}`
  )
  return stdout
}

// Funkcja pomocnicza do pingowania hosta
async function pingHost(ip: string): Promise<number> {
  try {
    const { stdout } = await execAsync(`ping -n 1 -w 1000 ${ip}`)
    // Obsługa systemów PL i EN
    const match = stdout.match(/(?:time|czas)[=<](\d+)ms/i)
    if (match && match[1]) {
      return parseInt(match[1], 10)
    }
    return 999 // Timeout / błąd
  } catch {
    return 999
  }
}

export function setupNetworkIPC(): void {
  // 1. Pingowanie profili DNS w czasie rzeczywistym
  ipcMain.handle('ping-dns-servers', async () => {
    const servers = [
      { name: 'Cloudflare', primary: '1.1.1.1', secondary: '1.0.0.1' },
      { name: 'Google', primary: '8.8.8.8', secondary: '8.8.4.4' },
      { name: 'AdGuard', primary: '94.140.14.14', secondary: '94.140.15.15' }
    ]

    try {
      const results = await Promise.all(
        servers.map(async (srv) => {
          const pingVal = await pingHost(srv.primary)
          return {
            name: srv.name,
            primary: srv.primary,
            secondary: srv.secondary,
            ping: pingVal
          }
        })
      )
      return { success: true, data: results }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 2. Pobieranie aktualnej konfiguracji DNS i kart sieciowych
  ipcMain.handle('get-dns-config', async () => {
    const script = `
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      Get-DnsClientServerAddress -AddressFamily IPv4 | Where-Object { $_.ServerAddresses.Count -gt 0 } | ForEach-Object {
        [PSCustomObject]@{
          interfaceIndex = $_.InterfaceIndex
          interfaceAlias = $_.InterfaceAlias
          addresses = $_.ServerAddresses
        }
      } | ConvertTo-Json
    `
    try {
      const stdout = await runPowerShellScript(script)
      if (!stdout || stdout.trim() === '') {
        return { success: true, data: [] }
      }

      const parsed = JSON.parse(stdout)
      const list = Array.isArray(parsed) ? parsed : [parsed]
      return { success: true, data: list }
    } catch (error: any) {
      return { success: false, error: error.message, data: [] }
    }
  })

  // 3. Ustawianie DNS dla konkretnego interfejsu (wymaga UAC)
  ipcMain.handle(
    'set-dns-servers',
    async (_, interfaceIndex: number, primary: string, secondary: string) => {
      if (!interfaceIndex) return { success: false, error: 'Nie wybrano karty sieciowej.' }

      const innerScript = `Set-DnsClientServerAddress -InterfaceIndex ${interfaceIndex} -ServerAddresses @('${primary}', '${secondary}')`
      const innerBase64 = Buffer.from(innerScript, 'utf16le').toString('base64')
      const script = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand ${innerBase64}' -Verb RunAs -Wait`

      try {
        await runPowerShellScript(script)
        return { success: true }
      } catch (error: any) {
        return {
          success: false,
          error:
            'Nie udało się zmienić serwerów DNS. Upewnij się, że zaakceptowałeś monit administratora (UAC).'
        }
      }
    }
  )

  // 4. Przywracanie DNS do DHCP dla konkretnego interfejsu (wymaga UAC)
  ipcMain.handle('reset-dns-servers', async (_, interfaceIndex: number) => {
    if (!interfaceIndex) return { success: false, error: 'Nie wybrano karty sieciowej.' }

    const innerScript = `Set-DnsClientServerAddress -InterfaceIndex ${interfaceIndex} -ResetServerAddresses`
    const innerBase64 = Buffer.from(innerScript, 'utf16le').toString('base64')
    const script = `Start-Process powershell -ArgumentList '-NoProfile -ExecutionPolicy Bypass -EncodedCommand ${innerBase64}' -Verb RunAs -Wait`

    try {
      await runPowerShellScript(script)
      return { success: true }
    } catch (error: any) {
      return {
        success: false,
        error:
          'Nie udało się zresetować serwerów DNS do DHCP. Upewnij się, że zaakceptowałeś monit administratora (UAC).'
      }
    }
  })

  // 5. Narzędzia naprawy sieci (Flush DNS, Winsock reset)
  ipcMain.handle('run-network-repair', async (_, repairType: 'flush' | 'winsock') => {
    try {
      if (repairType === 'flush') {
        const { stdout } = await execAsync('ipconfig /flushdns')
        return { success: true, output: stdout }
      } else if (repairType === 'winsock') {
        const script = `Start-Process cmd -ArgumentList '/c netsh winsock reset' -Verb RunAs -Wait`
        await runPowerShellScript(script)
        return {
          success: true,
          output:
            'Pomyślnie zresetowano katalog Winsock. Zaleca się ponowne uruchomienie komputera.'
        }
      }
      return { success: false, error: 'Nieznany typ naprawy.' }
    } catch (error: any) {
      return { success: false, error: 'Wystąpił błąd: ' + error.message }
    }
  })

  // 6. Pobieranie szczegółowych informacji o konkretnej karcie sieciowej
  ipcMain.handle('get-network-details', async (_, interfaceIndex: number) => {
    if (!interfaceIndex) return { success: false, error: 'Nie wybrano karty sieciowej.' }
    const script = `
      [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
      $idx = ${interfaceIndex}
      $adapter = Get-NetAdapter -InterfaceIndex $idx | Select-Object Name, InterfaceDescription, Status, LinkSpeed, MacAddress
      $ipInfo = Get-NetIPAddress -InterfaceIndex $idx -AddressFamily IPv4 | Select-Object IPAddress, PrefixLength
      $dnsInfo = Get-DnsClientServerAddress -InterfaceIndex $idx -AddressFamily IPv4 | Select-Object ServerAddresses
      $ipInterface = Get-NetIPInterface -InterfaceIndex $idx -AddressFamily IPv4 | Select-Object Dhcp
      
      [PSCustomObject]@{
        name = $adapter.Name
        description = $adapter.InterfaceDescription
        status = $adapter.Status
        speed = $adapter.LinkSpeed
        mac = $adapter.MacAddress
        ip = $ipInfo.IPAddress
        prefixLength = $ipInfo.PrefixLength
        dns = $dnsInfo.ServerAddresses
        dhcp = $ipInterface.Dhcp
      } | ConvertTo-Json
    `
    try {
      const stdout = await runPowerShellScript(script)
      if (!stdout || stdout.trim() === '') {
        return { success: false, error: 'Nie znaleziono szczegółów dla tej karty.' }
      }
      const parsed = JSON.parse(stdout)
      return { success: true, data: parsed }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 7. Pobieranie szczegółów Wi-Fi
  ipcMain.handle('get-wifi-details', async () => {
    try {
      const { stdout } = await execAsync('netsh wlan show interfaces')
      if (
        stdout.includes('There is no wireless interface') ||
        stdout.includes('Wireless AutoConfig Service') ||
        stdout.trim() === ''
      ) {
        return { success: true, data: null }
      }

      const ssidMatch = stdout.match(/SSID\s*:\s*(.*)/i)
      const signalMatch = stdout.match(/Signal\s*:\s*(\d+)%/i)
      const channelMatch = stdout.match(/Channel\s*:\s*(\d+)/i)
      const authMatch = stdout.match(/Authentication\s*:\s*(.*)/i)
      const bandMatch = stdout.match(/Band\s*:\s*(.*)/i)
      const radioMatch = stdout.match(/Radio type\s*:\s*(.*)/i)
      const rxRateMatch = stdout.match(/Receive rate \(Mbps\)\s*:\s*(\d+)/i)
      const txRateMatch = stdout.match(/Transmit rate \(Mbps\)\s*:\s*(\d+)/i)

      if (!ssidMatch) {
        return { success: true, data: null }
      }

      return {
        success: true,
        data: {
          ssid: ssidMatch[1].trim(),
          signal: signalMatch ? parseInt(signalMatch[1], 10) : 0,
          channel: channelMatch ? parseInt(channelMatch[1], 10) : 0,
          auth: authMatch ? authMatch[1].trim() : 'Nieznane',
          band: bandMatch ? bandMatch[1].trim() : '5 GHz',
          radio: radioMatch ? radioMatch[1].trim() : '802.11ax',
          rxRate: rxRateMatch ? parseInt(rxRateMatch[1], 10) : 0,
          txRate: txRateMatch ? parseInt(txRateMatch[1], 10) : 0
        }
      }
    } catch (err: any) {
      return { success: false, error: err.message }
    }
  })

  // 8. Start testu prędkości (Speed Test)
  ipcMain.handle('start-speed-test', async (event) => {
    try {
      // 1. Krok: Test opóźnienia i Jitter
      event.sender.send('speedtest-progress', { type: 'ping', speed: 0, percent: 0 })
      const pings: number[] = []
      for (let i = 0; i < 4; i++) {
        const p = await pingHost('1.1.1.1')
        if (p < 999) {
          pings.push(p)
        }
        await new Promise((r) => setTimeout(r, 100))
      }
      const avgPing =
        pings.length > 0 ? Math.round(pings.reduce((a, b) => a + b, 0) / pings.length) : 15
      let jitter = 1
      if (pings.length > 1) {
        let sumDiff = 0
        for (let i = 1; i < pings.length; i++) {
          sumDiff += Math.abs(pings[i] - pings[i - 1])
        }
        jitter = Math.round(sumDiff / (pings.length - 1))
      }

      event.sender.send('speedtest-progress', { type: 'ping-done', ping: avgPing, jitter })

      // 2. Krok: Test pobierania (Download) - 250 MB max / limit 6 sekund
      const downloadUrl = 'https://speed.cloudflare.com/__down?bytes=250000000'
      const finalDownloadSpeed = await runDownloadTest(event, downloadUrl, 250000000)

      event.sender.send('speedtest-progress', { type: 'download-done', speed: finalDownloadSpeed })

      // 3. Krok: Test wysyłania (Upload) - 150 MB max / limit 6 sekund
      const uploadUrl = 'https://speed.cloudflare.com/__up'
      const finalUploadSpeed = await runUploadTest(event, uploadUrl, 150000000)

      event.sender.send('speedtest-progress', { type: 'upload-done', speed: finalUploadSpeed })

      return {
        success: true,
        data: {
          ping: avgPing,
          jitter,
          download: finalDownloadSpeed,
          upload: finalUploadSpeed
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })
}
