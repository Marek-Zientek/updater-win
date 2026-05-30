export interface IAuthAPI {
  register: (data: any) => Promise<any>
  login: (data: any) => Promise<any>
  logout: (token: string) => Promise<any>
  verifySession: (token: string) => Promise<any>
}

export interface IHardwareAPI {
  getStaticHardware: () => Promise<any>
  getDynamicHardware: () => Promise<any>
  runSystemCommand: (commandType: string) => Promise<any>
  getHistoricalMetrics: () => Promise<{ success: boolean; data: any[]; error?: string }>
  getHardwareInfo: () => Promise<any>
  getUpgradableApps: () => Promise<any>
  getInstalledApps: () => Promise<any>
  upgradeApp: (appData: {
    wingetId: string
    name: string
    previousVersion: string
    newVersion: string
  }) => Promise<any>
  runElevatedUpgrade: (wingetId: string) => Promise<any>
  installApp: (appData: {
    wingetId: string
    name: string
  }) => Promise<{ success: boolean; data?: string; requiresElevation?: boolean; error?: string }>
  runElevatedInstall: (
    wingetId: string
  ) => Promise<{ success: boolean; message?: string; error?: string }>
  preflightDownload: (
    wingetId: string
  ) => Promise<{
    canDownload: boolean
    installerUrl?: string
    errorReason?: 'no_installer_url' | 'network_error' | 'disk_write_error' | 'http_error' | null
    statusCode?: number
  }>
  getUpdateHistory: () => Promise<any>
  getWingetRunDetails: (wingetId: string) => Promise<any>
  fetchAppIcon: (domain: string) => Promise<string | null>
  resizeWindow: (width: number, height: number) => void
  getStoreDetails: (productId: string) => Promise<any>
  getCustomization: (wingetId: string) => Promise<any>
  saveCustomization: (data: any) => Promise<any>
  deleteCustomization: (wingetId: string) => Promise<any>
  pickScreenshot: () => Promise<{ success: boolean; paths: string[] }>
  deleteScreenshot: (filePath: string) => Promise<{ success: boolean }>
  getResourceHistory: () => Promise<any>
  getTopProcesses: () => Promise<any>
  getSetting: (
    key: string,
    defaultValue?: string
  ) => Promise<{ success: boolean; value?: string; error?: string }>
  saveSetting: (key: string, value: string) => Promise<{ success: boolean; error?: string }>
  getSystemDrivers: () => Promise<{ success: boolean; data: any[]; error?: string }>
  getCleanupStats: () => Promise<{
    success: boolean
    data: { tempSize: number; logSize: number; cacheSize: number }
    error?: string
  }>
  runCleanup: () => Promise<{ success: boolean; cleanedBytes: number; error?: string }>
  getStartupApps: () => Promise<{ success: boolean; data: any[]; error?: string }>
  toggleStartupApp: (
    name: string,
    enabled: boolean
  ) => Promise<{ success: boolean; error?: string }>
  checkDriverAssistants: () => Promise<{ success: boolean; data: any[]; error?: string }>
  launchDriverAssistant: (wingetId: string) => Promise<{ success: boolean; error?: string }>
  getRestorePoints: () => Promise<{ success: boolean; data: any[]; error?: string }>
  createRestorePoint: () => Promise<{ success: boolean; error?: string }>
  restoreSystemPoint: () => Promise<{ success: boolean; error?: string }>
  exportBackup: () => Promise<{ success: boolean; canceled: boolean; error?: string }>
  importBackup: () => Promise<{ success: boolean; canceled: boolean; error?: string }>
  getBloatwareApps: () => Promise<{ success: boolean; data: any[]; error?: string }>
  removeBloatwareApp: (packageFullName: string) => Promise<{ success: boolean; error?: string }>
  scanLeftovers: (packageName: string) => Promise<{ success: boolean; files: string[]; registry: string[]; error?: string }>
  cleanLeftovers: (files: string[], registry: string[]) => Promise<{ success: boolean; filesDeleted: number; regsDeleted: number; errors: string[] }>
  pingDnsServers: () => Promise<{ success: boolean; data: any[]; error?: string }>
  getDnsConfig: () => Promise<{ success: boolean; data: any[]; error?: string }>
  setDnsServers: (
    interfaceIndex: number,
    primary: string,
    secondary: string
  ) => Promise<{ success: boolean; error?: string }>
  resetDnsServers: (interfaceIndex: number) => Promise<{ success: boolean; error?: string }>
  runNetworkRepair: (
    repairType: 'flush' | 'winsock'
  ) => Promise<{ success: boolean; output?: string; error?: string }>
  getNetworkDetails: (
    interfaceIndex: number
  ) => Promise<{ success: boolean; data?: any; error?: string }>
  getWifiDetails: () => Promise<{ success: boolean; data?: any; error?: string }>
  startSpeedTest: () => Promise<{ success: boolean; data?: any; error?: string }>
  onSpeedTestProgress: (callback: (data: any) => void) => () => void
  getPeripherals: () => Promise<{ success: boolean; data: any[]; error?: string }>
  toggleDevice: (
    instanceId: string,
    enable: boolean
  ) => Promise<{ success: boolean; error?: string }>
  launchDeviceManager: () => Promise<{ success: boolean; error?: string }>
  getAppHistoricalMetrics: () => Promise<{ success: boolean; data: any[]; error?: string }>
  getPrivacySettings: () => Promise<{ success: boolean; data?: any; error?: string }>
  togglePrivacySetting: (
    key: string,
    enabled: boolean
  ) => Promise<{ success: boolean; elevated?: boolean; error?: string }>
  getGameBoosterStatus: () => Promise<{ success: boolean; active: boolean; error?: string }>
  toggleGameBooster: (enable: boolean) => Promise<{ success: boolean; active: boolean; error?: string }>
  getMonitoredGames: () => Promise<{ success: boolean; data: any[]; error?: string }>
  addCustomGame: (game: { name: string; exe: string }) => Promise<{ success: boolean; error?: string }>
  deleteCustomGame: (exe: string) => Promise<{ success: boolean; error?: string }>
  auth: IAuthAPI
}

declare global {
  interface Window {
    api: IHardwareAPI
    electron: any
  }
}
