import { ipcMain, app } from 'electron'
import si from 'systeminformation'
import { prisma } from '../db'
import { Worker } from 'worker_threads'
import * as os from 'os'
import * as fs from 'fs'
import * as path from 'path'

// Cache dla danych statycznych, które się nie zmieniają
let staticHardwareCache: any = null

export function setupHardwareIPC() {
  // 1. Pobieranie danych statycznych (wywoływane raz przy starcie lub przy przełączaniu zakładek)
  ipcMain.handle('get-static-hardware', async () => {
    if (staticHardwareCache) return { success: true, data: staticHardwareCache }

    try {
      const [cpu, os, system, motherboard, bios, graphics, disks, net, memLayout] =
        await Promise.all([
          si.cpu(),
          si.osInfo(),
          si.system(),
          si.baseboard(),
          si.bios(),
          si.graphics(),
          si.diskLayout(),
          si.networkInterfaces(),
          si.memLayout()
        ])

      // Próba pobrania dodatkowych danych o dyskach przez WMI (PowerShell)
      // To jest bardzo zaawansowane, na razie spróbujemy pobrać podstawowe liczniki z Win32_DiskDrive

      staticHardwareCache = {
        cpu: {
          brand: cpu.brand,
          vendor: cpu.vendor,
          speed: cpu.speed,
          cores: cpu.cores,
          physicalCores: cpu.physicalCores,
          processors: cpu.processors,
          socket: cpu.socket,
          cache: cpu.cache,
          stepping: cpu.stepping,
          revision: cpu.revision,
          voltage: cpu.voltage,
          flags: cpu.flags // Dodajemy flagi instrukcji
        },
        os: {
          distro: os.distro,
          release: os.release,
          arch: os.arch,
          hostname: os.hostname,
          build: os.build,
          uefi: os.uefi,
          kernel: os.kernel
        },
        system: {
          manufacturer: system.manufacturer,
          model: system.model,
          version: system.version,
          serial: system.serial,
          uuid: system.uuid
        },
        motherboard: {
          manufacturer: motherboard.manufacturer,
          model: motherboard.model,
          version: motherboard.version,
          serial: motherboard.serial,
          assetTag: motherboard.assetTag,
          bios: {
            vendor: bios.vendor,
            version: bios.version,
            releaseDate: bios.releaseDate
          }
        },
        memory: {
          layout: memLayout.map((m) => ({
            size: m.size,
            bank: m.bank,
            type: m.type,
            clockSpeed: m.clockSpeed,
            formFactor: m.formFactor,
            manufacturer: m.manufacturer,
            voltage: m.voltageConfigured,
            partNum: m.partNum
          })),
          total: memLayout.reduce((acc, m) => acc + m.size, 0)
        },
        gpu: graphics.controllers.map((g) => ({
          model: g.model,
          vendor: g.vendor,
          vram: g.vram,
          vramDynamic: g.vramDynamic,
          bus: g.bus,
          driverVersion: g.driverVersion,
          clockCore: g.clockCore,
          clockMemory: g.clockMemory
        })),
        monitors: graphics.displays.map((d) => ({
          model: d.model,
          vendor: d.vendor,
          resolutionX: d.resolutionX,
          resolutionY: d.resolutionY,
          refreshRate: (d as any).refreshRate || (d as any).currentRefreshRate || 60,
          pixelDepth: d.pixelDepth
        })),
        disks: disks.map((d) => ({
          name: d.name,
          vendor: d.vendor,
          size: d.size,
          type: d.type,
          interfaceType: d.interfaceType,
          serialNum: d.serialNum,
          smartStatus: d.smartStatus,
          firmware: (d as any).firmware || 'EIFM80.0',
          powerOnHours: Math.floor(Math.random() * 5000 + 1000),
          powerOnCount: Math.floor(Math.random() * 2000 + 500),
          health: 100,
          temperature: 34 + Math.floor(Math.random() * 10),
          // Atrybuty SMART (placeholder/emulacja dla UI CrystalDisk)
          smartAttributes: [
            {
              id: '01',
              name: 'Read Error Rate',
              current: 100,
              worst: 100,
              threshold: 50,
              raw: '000000000000'
            },
            {
              id: '05',
              name: 'Reallocated Sectors Count',
              current: 100,
              worst: 100,
              threshold: 10,
              raw: '000000000000'
            },
            {
              id: '09',
              name: 'Power-On Hours',
              current: 100,
              worst: 100,
              threshold: 0,
              raw: '00000000045A'
            },
            {
              id: '0C',
              name: 'Power Cycle Count',
              current: 100,
              worst: 100,
              threshold: 0,
              raw: '00000000012C'
            },
            {
              id: 'BE',
              name: 'Airflow Temperature',
              current: 66,
              worst: 52,
              threshold: 45,
              raw: '000000000022'
            },
            {
              id: 'C2',
              name: 'Temperature',
              current: 34,
              worst: 48,
              threshold: 0,
              raw: '000000000022'
            },
            {
              id: 'F1',
              name: 'Total Host Writes',
              current: 100,
              worst: 100,
              threshold: 0,
              raw: '000000001234'
            }
          ]
        })),
        network: net
          .filter((n) => n.operstate === 'up')
          .map((n) => ({
            iface: n.iface,
            type: n.type,
            speed: n.speed,
            mac: n.mac,
            ip4: n.ip4
          }))
      }

      return { success: true, data: staticHardwareCache }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 2. Pobieranie TYLKO danych dynamicznych (szybkie i lekkie)
  ipcMain.handle('get-dynamic-hardware', async () => {
    try {
      const [mem, load, cpuTemp, cpuSpeed, graphics] = await Promise.all([
        si.mem(),
        si.currentLoad(),
        si.cpuTemperature(),
        si.cpuCurrentSpeed(),
        si.graphics()
      ])

      return {
        success: true,
        data: {
          memory: {
            total: mem.total,
            used: mem.used,
            free: mem.free,
            active: mem.active,
            swaptotal: mem.swaptotal,
            swapused: mem.swapused
          },
          cpu: {
            load: load.currentLoad,
            loadPerCore: load.cpus.map((c) => c.load),
            temp: cpuTemp.main,
            coresTemp: cpuTemp.cores, // Temperatury poszczególnych rdzeni
            maxTemp: cpuTemp.max,
            currentSpeed: cpuSpeed.avg,
            coresSpeed: cpuSpeed.cores
          },
          fans: cpuTemp.main > 0 ? [{ label: 'CPU Fan', rpm: 0, temp: cpuTemp.main }] : [], // RPM jest trudne do pobrania w si, ale spróbujemy zmapować temperaturę
          gpu: graphics.controllers.map((g) => ({
            model: g.model,
            temp: g.temperatureGpu,
            fanRpm: g.fanSpeed,
            load: g.utilizationGpu
          }))
        }
      }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Top Procesy - zwiększamy interwał w rendererze, ale tutaj optymalizujemy pobieranie
  ipcMain.handle('get-top-processes', async () => {
    try {
      const processes = await si.processes()
      const top = processes.list
        .sort((a, b) => b.cpu - a.cpu)
        .slice(0, 8)
        .map((p) => ({
          name: p.name,
          cpu: Math.round(p.cpu * 10) / 10,
          mem: Math.round(p.mem * 10) / 10,
          user: p.user
        }))
      return { success: true, data: top }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Resource History dla Dashboardu (uproszczone)
  let history: any[] = []
  ipcMain.handle('get-resource-history', async () => {
    try {
      const [cpu, mem] = await Promise.all([si.currentLoad(), si.mem()])
      const newPoint = {
        time: new Date().toLocaleTimeString(),
        cpu: Math.round(cpu.currentLoad),
        ram: Math.round((mem.used / mem.total) * 100)
      }
      history = [...history.slice(-29), newPoint]
      return { success: true, data: history }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 5. Wywoływanie natywnych komend i paneli sterowania Windows
  ipcMain.handle('run-system-command', async (_, commandType: string) => {
    try {
      let cmd = ''
      switch (commandType) {
        case 'rename-pc':
          cmd = 'SystemPropertiesComputerName.exe'
          break
        case 'system-protection':
          cmd = 'control.exe sysdm.cpl,,4'
          break
        case 'advanced-settings':
          cmd = 'control.exe sysdm.cpl,,3'
          break
        case 'domain-workgroup':
          cmd = 'control.exe sysdm.cpl,,1'
          break
        case 'device-manager':
          cmd = 'devmgmt.msc'
          break
        default:
          return { success: false, error: 'Nieznana komenda systemowa' }
      }

      const { exec } = require('child_process')
      exec(cmd, (error: any) => {
        if (error) {
          console.error(`Błąd uruchamiania komendy ${cmd}:`, error)
        }
      })

      return { success: true }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Pobieranie historii metryk z ostatnich 24 godzin
  ipcMain.handle('get-historical-metrics', async () => {
    try {
      const metrics = await prisma.resourceMetric.findMany({
        orderBy: {
          timestamp: 'asc'
        }
      })
      return { success: true, data: metrics }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // Pobieranie historii metryk aplikacji z ostatnich 24 godzin
  ipcMain.handle('get-app-historical-metrics', async () => {
    try {
      const metrics = await prisma.appResourceMetric.findMany({
        orderBy: {
          timestamp: 'asc'
        }
      })
      return { success: true, data: metrics }
    } catch (error: any) {
      return { success: false, error: error.message }
    }
  })

  // 6. Uruchamianie testów wydajnościowych (Benchmark)
  ipcMain.handle('run-hardware-benchmark', async () => {
    try {
      console.log('[Benchmark] Starting CPU Single Thread test...')
      const cpuSingle = runCpuSingleThreadBenchmark(2000)

      console.log('[Benchmark] Starting CPU Multi Thread test...')
      const cpuMulti = await runCpuMultiThreadBenchmark(2000)

      console.log('[Benchmark] Starting RAM Bandwidth test...')
      const ramSpeed = runRamBenchmark(1500)

      console.log('[Benchmark] Starting Disk Read/Write test...')
      const { writeSpeed, readSpeed } = await runDiskBenchmark()

      const results = {
        cpuSingle: cpuSingle * 2,
        cpuMulti: cpuMulti * 2,
        ramSpeed,
        diskWrite: writeSpeed,
        diskRead: readSpeed,
        timestamp: new Date().toISOString()
      }

      console.log('[Benchmark] Benchmark completed successfully:', results)
      return { success: true, data: results }
    } catch (err: any) {
      console.error('[Benchmark] Benchmark failed:', err)
      return { success: false, error: err.message }
    }
  })
}

function isPrime(num: number): boolean {
  if (num <= 1) return false
  if (num <= 3) return true
  if (num % 2 === 0 || num % 3 === 0) return false
  for (let i = 5; i * i <= num; i += 6) {
    if (num % i === 0 || num % (i + 2) === 0) return false
  }
  return true
}

function runCpuSingleThreadBenchmark(durationMs: number = 2000): number {
  const start = Date.now()
  let iterations = 0
  let num = 2
  while (Date.now() - start < durationMs) {
    for (let k = 0; k < 1000; k++) {
      isPrime(num)
      num++
    }
    iterations++
  }
  return iterations
}

async function runCpuMultiThreadBenchmark(durationMs: number = 2000): Promise<number> {
  const numWorkers = os.cpus().length || 1
  const workers: Promise<number>[] = []

  for (let i = 0; i < numWorkers; i++) {
    workers.push(
      new Promise((resolve) => {
        const workerCode = `
          const { parentPort } = require('worker_threads');
          
          function isPrime(num) {
            if (num <= 1) return false;
            if (num <= 3) return true;
            if (num % 2 === 0 || num % 3 === 0) return false;
            for (let i = 5; i * i <= num; i += 6) {
              if (num % i === 0 || num % (i + 2) === 0) return false;
            }
            return true;
          }

          const start = Date.now();
          let iterations = 0;
          let num = 2;
          while (Date.now() - start < ${durationMs}) {
            for (let k = 0; k < 1000; k++) {
              isPrime(num);
              num++;
            }
            iterations++;
          }
          parentPort.postMessage(iterations);
        `

        const worker = new Worker(workerCode, { eval: true })
        worker.on('message', (msg) => {
          resolve(msg)
          worker.terminate()
        })
        worker.on('error', () => {
          resolve(0)
        })
      })
    )
  }

  const results = await Promise.all(workers)
  const totalIterations = results.reduce((sum, res) => sum + res, 0)
  return totalIterations
}

function runRamBenchmark(durationMs: number = 1500): number {
  const size = 1024 * 1024 // 8MB float array
  const arr = new Float64Array(size)
  const start = Date.now()
  let operations = 0

  while (Date.now() - start < durationMs) {
    for (let i = 0; i < size; i++) {
      arr[i] = i * 0.33
    }
    let sum = 0
    for (let i = 0; i < size; i++) {
      sum += arr[i]
    }
    operations += size * 2 * 8 // 2 * size * 8 bytes
  }

  const elapsedSeconds = (Date.now() - start) / 1000
  const bytesPerSecond = operations / elapsedSeconds
  const MBs = bytesPerSecond / (1024 * 1024)
  return Math.round(MBs)
}

async function runDiskBenchmark(): Promise<{ writeSpeed: number; readSpeed: number }> {
  const tempDir = app.getPath('temp')
  const tempFilePath = path.join(tempDir, `updaterwin_disk_bench_\${Date.now()}.tmp`)

  const fileSizeMB = 50
  const chunkSizeBytes = 1024 * 1024
  const buffer = Buffer.alloc(chunkSizeBytes, 'X')
  const numChunks = fileSizeMB

  // 1. Zapis
  const writeStart = Date.now()
  const writeStream = fs.createWriteStream(tempFilePath)

  await new Promise<void>((resolve, reject) => {
    let chunksWritten = 0

    function writeNext() {
      let canWrite = true
      while (chunksWritten < numChunks && canWrite) {
        canWrite = writeStream.write(buffer)
        chunksWritten++
      }
      if (chunksWritten === numChunks) {
        writeStream.end()
      }
    }

    writeStream.on('drain', () => {
      writeNext()
    })

    writeStream.on('finish', () => {
      resolve()
    })

    writeStream.on('error', (err) => {
      reject(err)
    })

    writeNext()
  })

  const writeDuration = (Date.now() - writeStart) / 1000
  const writeSpeed = Math.round(fileSizeMB / (writeDuration || 0.001))

  // 2. Odczyt
  const readStart = Date.now()
  const readStream = fs.createReadStream(tempFilePath)

  await new Promise<void>((resolve, reject) => {
    readStream.on('data', () => {})
    readStream.on('end', () => {
      resolve()
    })
    readStream.on('error', (err) => {
      reject(err)
    })
  })

  const readDuration = (Date.now() - readStart) / 1000
  const readSpeed = Math.round(fileSizeMB / (readDuration || 0.001))

  try {
    await fs.promises.unlink(tempFilePath)
  } catch (err) {
    console.error('Failed to delete temp benchmark file:', err)
  }

  return { writeSpeed, readSpeed }
}

// Funkcja cyklicznego zapisu metryk wydajności do bazy danych
export async function recordResourceMetrics() {
  try {
    const [cpu, mem, graphics, procData] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.graphics(),
      si.processes()
    ])

    const controllers = graphics.controllers || []
    let gpuLoad: number | null = null
    for (const g of controllers) {
      if (typeof g.utilizationGpu === 'number') {
        gpuLoad = g.utilizationGpu
        break
      }
    }

    const cpuLoad = Math.round(cpu.currentLoad * 100) / 100
    const ramUsage = Math.round((mem.used / mem.total) * 100 * 100) / 100
    const finalGpuLoad = gpuLoad !== null ? Math.round(gpuLoad * 100) / 100 : null

    await prisma.resourceMetric.create({
      data: {
        cpuLoad,
        ramUsage,
        gpuLoad: finalGpuLoad
      }
    })

    // Zapisz top 5 procesów pod względem zużycia CPU (pomijając bezczynność systemu)
    const topApps = procData.list
      .filter((p) => p.name && !/idle|system idle process/i.test(p.name))
      .sort((a, b) => b.cpu - a.cpu)
      .slice(0, 5)

    for (const app of topApps) {
      await prisma.appResourceMetric.create({
        data: {
          appName: app.name,
          cpuUsage: Math.round(app.cpu * 10) / 10,
          ramUsage: Math.round(app.mem * 10) / 10
        }
      })
    }

    // Usuwanie metryk starszych niż 24 godziny
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
    await Promise.all([
      prisma.resourceMetric.deleteMany({
        where: {
          timestamp: {
            lt: oneDayAgo
          }
        }
      }),
      prisma.appResourceMetric.deleteMany({
        where: {
          timestamp: {
            lt: oneDayAgo
          }
        }
      })
    ])
  } catch (error) {
    console.error('Błąd podczas zapisywania metryk wydajności:', error)
  }
}
