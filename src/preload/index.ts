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
  getDriverUpdates: () => ipcRenderer.invoke('get-driver-updates'),
  upgradeDriver: (wingetId: string) => ipcRenderer.invoke('upgrade-driver', wingetId),
  getCleanupStats: () => ipcRenderer.invoke('get-cleanup-stats'),
  runCleanup: () => ipcRenderer.invoke('run-cleanup'),
  getStartupApps: () => ipcRenderer.invoke('get-startup-apps'),
  toggleStartupApp: (name: string, enabled: boolean) =>
    ipcRenderer.invoke('toggle-startup-app', name, enabled),
  getSystemServices: () => ipcRenderer.invoke('get-system-services'),
  toggleSystemService: (serviceName: string, action: 'start' | 'stop' | 'automatic' | 'manual' | 'disabled') =>
    ipcRenderer.invoke('toggle-system-service', serviceName, action),
  scanDiskSpace: () => ipcRenderer.invoke('scan-disk-space'),
  deleteFileDiagnostics: (filePath: string) => ipcRenderer.invoke('delete-file-diagnostics', filePath),
  checkDriverAssistants: () => ipcRenderer.invoke('check-driver-assistants'),
  launchDriverAssistant: (wingetId: string) =>
    ipcRenderer.invoke('launch-driver-assistant', wingetId),
  getRestorePoints: () => ipcRenderer.invoke('get-restore-points'),
  createRestorePoint: () => ipcRenderer.invoke('create-restore-point'),
  restoreSystemPoint: () => ipcRenderer.invoke('restore-system-point'),
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
  getDnsDohStatus: () => ipcRenderer.invoke('get-dns-doh-status'),
  toggleDnsDoh: (interfaceGuid: string, dnsIps: string[], enable: boolean) =>
    ipcRenderer.invoke('toggle-dns-doh', interfaceGuid, dnsIps, enable),
  getNetworkHardening: () => ipcRenderer.invoke('get-network-hardening'),
  toggleNetworkHardening: (key: 'llmnrDisabled' | 'netbiosDisabled', enabled: boolean) =>
    ipcRenderer.invoke('toggle-network-hardening', key, enabled),
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
  getHardeningSettings: () => ipcRenderer.invoke('get-hardening-settings'),
  toggleHardeningSetting: (key: string, enabled: boolean) =>
    ipcRenderer.invoke('toggle-hardening-setting', key, enabled),
  getGameBoosterStatus: () => ipcRenderer.invoke('get-game-booster-status'),
  toggleGameBooster: (enable: boolean) => ipcRenderer.invoke('toggle-game-booster', enable),
  getMonitoredGames: () => ipcRenderer.invoke('get-monitored-games'),
  addCustomGame: (game: { name: string; exe: string }) => ipcRenderer.invoke('add-custom-game', game),
  deleteCustomGame: (exe: string) => ipcRenderer.invoke('delete-custom-game', exe),
  runHardwareBenchmark: () => ipcRenderer.invoke('run-hardware-benchmark'),
  getGlobalBenchmarkRankings: (cpuModel: string, userScore: number) =>
    ipcRenderer.invoke('get-global-benchmark-rankings', cpuModel, userScore),
  uninstallApp: (wingetId: string) =>
    ipcRenderer.invoke('uninstall-app', wingetId),
  runElevatedUninstall: (wingetId: string) =>
    ipcRenderer.invoke('run-elevated-uninstall', wingetId),
  scanWin32Leftovers: (appName: string, publisher: string) =>
    ipcRenderer.invoke('scan-win32-leftovers', appName, publisher),
  cleanWin32Leftovers: (files: string[], registry: string[]) =>
    ipcRenderer.invoke('clean-win32-leftovers', files, registry),
  auth: {
    register: (data: any) => ipcRenderer.invoke('auth-register', data),
    login: (data: any) => ipcRenderer.invoke('auth-login', data),
    logout: (token: string) => ipcRenderer.invoke('auth-logout', token),
    verifySession: (token: string) => ipcRenderer.invoke('auth-verify-session', token),
    exportUserProfile: (userId?: string) => ipcRenderer.invoke('export-user-profile', userId),
    importUserProfile: (profileJson: string) => ipcRenderer.invoke('import-user-profile', profileJson),
    syncProfileToCloud: (token: string) => ipcRenderer.invoke('sync-profile-to-cloud', token),
    syncProfileFromCloud: (token: string) => ipcRenderer.invoke('sync-profile-from-cloud', token),
    submitSystemTelemetry: (token: string, data: any) => ipcRenderer.invoke('submit-system-telemetry', token, data)
  },
  getHardwareInfo: () => ipcRenderer.invoke('get-static-hardware'),
  getHardwareSpecsheet: (type: 'cpu' | 'gpu' | 'ram' | 'network', modelName: string) =>
    ipcRenderer.invoke('get-hardware-specsheet', type, modelName),
  getRemoteServerConfig: () => ipcRenderer.invoke('get-remote-server-config'),
  toggleRemoteServer: (enable: boolean, port: number) =>
    ipcRenderer.invoke('toggle-remote-server', enable, port),
  diagnostics: {
    startScan: (type: 'sfc' | 'dism' | 'audit') => ipcRenderer.invoke('start-diagnostics-scan', type),
    getProgress: () => ipcRenderer.invoke('get-diagnostics-progress'),
    cancelScan: () => ipcRenderer.invoke('cancel-diagnostics-scan'),
    getBsodLogs: () => ipcRenderer.invoke('get-bsod-logs')
  }
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
