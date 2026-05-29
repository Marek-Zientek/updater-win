import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

import { ipcRenderer } from 'electron'

// Custom APIs for renderer
const api = {
  // Nowe metody optymalizacyjne
  getStaticHardware: () => ipcRenderer.invoke('get-static-hardware'),
  getDynamicHardware: () => ipcRenderer.invoke('get-dynamic-hardware'),
  runSystemCommand: (commandType: string) => ipcRenderer.invoke('run-system-command', commandType),
  getHistoricalMetrics: () => ipcRenderer.invoke('get-historical-metrics'),

  // Kontrola okna
  resizeWindow: (width: number, height: number) => ipcRenderer.send('resize-window', width, height),

  // Pozostałe metody
  getUpgradableApps: () => ipcRenderer.invoke('get-upgradable-apps'),
  getInstalledApps: () => ipcRenderer.invoke('get-installed-apps'),
  upgradeApp: (appData: {
    wingetId: string
    name: string
    previousVersion: string
    newVersion: string
  }) => ipcRenderer.invoke('upgrade-app', appData),
  runElevatedUpgrade: (wingetId: string) => ipcRenderer.invoke('run-elevated-upgrade', wingetId),
  installApp: (appData: { wingetId: string; name: string }) =>
    ipcRenderer.invoke('install-app', appData),
  runElevatedInstall: (wingetId: string) => ipcRenderer.invoke('run-elevated-install', wingetId),
  preflightDownload: (wingetId: string) => ipcRenderer.invoke('preflight-download', wingetId),
  getUpdateHistory: () => ipcRenderer.invoke('get-update-history'),
  getWingetRunDetails: (wingetId: string) => ipcRenderer.invoke('get-winget-run-details', wingetId),
  fetchAppIcon: (domain: string) => ipcRenderer.invoke('fetch-app-icon', domain),
  getStoreDetails: (productId: string) => ipcRenderer.invoke('get-store-details', productId),
  getCustomization: (wingetId: string) => ipcRenderer.invoke('get-customization', wingetId),
  saveCustomization: (data: any) => ipcRenderer.invoke('save-customization', data),
  deleteCustomization: (wingetId: string) => ipcRenderer.invoke('delete-customization', wingetId),
  pickScreenshot: () => ipcRenderer.invoke('pick-screenshot'),
  deleteScreenshot: (filePath: string) => ipcRenderer.invoke('delete-screenshot', filePath),
  getResourceHistory: () => ipcRenderer.invoke('get-resource-history'),
  getTopProcesses: () => ipcRenderer.invoke('get-top-processes'),
  getSetting: (key: string, defaultValue?: string) =>
    ipcRenderer.invoke('get-setting', key, defaultValue),
  saveSetting: (key: string, value: string) => ipcRenderer.invoke('save-setting', key, value),
  getSystemDrivers: () => ipcRenderer.invoke('get-system-drivers'),
  getCleanupStats: () => ipcRenderer.invoke('get-cleanup-stats'),
  runCleanup: () => ipcRenderer.invoke('run-cleanup'),
  getStartupApps: () => ipcRenderer.invoke('get-startup-apps'),
  toggleStartupApp: (name: string, enabled: boolean) =>
    ipcRenderer.invoke('toggle-startup-app', name, enabled),
  checkDriverAssistants: () => ipcRenderer.invoke('check-driver-assistants'),
  launchDriverAssistant: (wingetId: string) =>
    ipcRenderer.invoke('launch-driver-assistant', wingetId),
  getRestorePoints: () => ipcRenderer.invoke('get-restore-points'),
  createRestorePoint: () => ipcRenderer.invoke('create-restore-point'),
  exportBackup: () => ipcRenderer.invoke('export-backup'),
  importBackup: () => ipcRenderer.invoke('import-backup'),
  getBloatwareApps: () => ipcRenderer.invoke('get-bloatware-apps'),
  removeBloatwareApp: (packageFullName: string) =>
    ipcRenderer.invoke('remove-bloatware-app', packageFullName),
  scanLeftovers: (packageName: string) =>
    ipcRenderer.invoke('scan-leftovers', packageName),
  cleanLeftovers: (files: string[], registry: string[]) =>
    ipcRenderer.invoke('clean-leftovers', files, registry),
  pingDnsServers: () => ipcRenderer.invoke('ping-dns-servers'),
  getDnsConfig: () => ipcRenderer.invoke('get-dns-config'),
  setDnsServers: (interfaceIndex: number, primary: string, secondary: string) =>
    ipcRenderer.invoke('set-dns-servers', interfaceIndex, primary, secondary),
  resetDnsServers: (interfaceIndex: number) =>
    ipcRenderer.invoke('reset-dns-servers', interfaceIndex),
  runNetworkRepair: (repairType: 'flush' | 'winsock') =>
    ipcRenderer.invoke('run-network-repair', repairType),
  getNetworkDetails: (interfaceIndex: number) =>
    ipcRenderer.invoke('get-network-details', interfaceIndex),
  getWifiDetails: () => ipcRenderer.invoke('get-wifi-details'),
  startSpeedTest: () => ipcRenderer.invoke('start-speed-test'),
  onSpeedTestProgress: (callback: (data: any) => void) => {
    const subscription = (_event: any, data: any) => callback(data)
    ipcRenderer.on('speedtest-progress', subscription)
    return () => {
      ipcRenderer.removeListener('speedtest-progress', subscription)
    }
  },
  getPeripherals: () => ipcRenderer.invoke('get-peripherals'),
  toggleDevice: (instanceId: string, enable: boolean) =>
    ipcRenderer.invoke('toggle-device', instanceId, enable),
  launchDeviceManager: () => ipcRenderer.invoke('launch-device-manager'),
  getAppHistoricalMetrics: () => ipcRenderer.invoke('get-app-historical-metrics'),
  getPrivacySettings: () => ipcRenderer.invoke('get-privacy-settings'),
  togglePrivacySetting: (key: string, enabled: boolean) =>
    ipcRenderer.invoke('toggle-privacy-setting', key, enabled),
  auth: {
    register: (data: any) => ipcRenderer.invoke('auth-register', data),
    login: (data: any) => ipcRenderer.invoke('auth-login', data),
    logout: (token: string) => ipcRenderer.invoke('auth-logout', token),
    verifySession: (token: string) => ipcRenderer.invoke('auth-verify-session', token)
  },
  getHardwareInfo: () => ipcRenderer.invoke('get-static-hardware')
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
