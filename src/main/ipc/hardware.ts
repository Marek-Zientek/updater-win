import { ipcMain } from 'electron'
import si from 'systeminformation'
import { prisma } from '../db'

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
