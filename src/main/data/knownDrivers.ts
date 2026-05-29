export interface DriverAssistant {
  name: string
  wingetId: string
  manufacturer: 'NVIDIA' | 'Intel' | 'AMD' | 'Dell' | 'Lenovo' | 'HP' | 'Generic'
  execPaths: string[]
  launchCmd?: string
  description: string
}

export const knownAssistants: DriverAssistant[] = [
  {
    name: 'NVIDIA GeForce Experience / App',
    wingetId: 'Nvidia.GeForceExperience',
    manufacturer: 'NVIDIA',
    execPaths: [
      'C:\\Program Files\\NVIDIA Corporation\\NVIDIA App\\NVIDIA App.exe',
      'C:\\Program Files\\NVIDIA Corporation\\NVIDIA GeForce Experience\\NVIDIA GeForce Experience.exe'
    ],
    description:
      'Oficjalny asystent NVIDIA do automatycznej aktualizacji sterowników GeForce Game Ready i Studio.'
  },
  {
    name: 'Intel Driver & Support Assistant',
    wingetId: 'Intel.DriverAndSupportAssistant',
    manufacturer: 'Intel',
    execPaths: ['C:\\Program Files\\Intel\\Driver and Support Assistant\\DSATray.exe'],
    launchCmd:
      'start https://www.intel.com/content/www/us/en/support/intel-driver-support-assistant.html',
    description:
      'Narzędzie Intel skanujące system i aktualizujące sterowniki graficzne, Wi-Fi, Bluetooth i chipset.'
  },
  {
    name: 'AMD Software: Adrenalin Edition',
    wingetId: 'AMD.Adrenalin',
    manufacturer: 'AMD',
    execPaths: ['C:\\Program Files\\AMD\\CNext\\CNext\\RadeonSoftware.exe'],
    description: 'Oficjalne oprogramowanie AMD dla kart graficznych Radeon oraz procesorów Ryzen.'
  },
  {
    name: 'Dell Command | Update',
    wingetId: 'Dell.CommandUpdate.Universal',
    manufacturer: 'Dell',
    execPaths: [
      'C:\\Program Files\\Dell\\CommandUpdate\\dcu.exe',
      'C:\\Program Files\\Dell\\CommandUpdate\\dcu-cli.exe'
    ],
    description:
      'Dedykowane narzędzie Dell do aktualizacji sterowników, BIOSu oraz firmware na urządzeniach Latitude, OptiPlex i Precision.'
  },
  {
    name: 'Lenovo System Update',
    wingetId: 'Lenovo.SystemUpdate',
    manufacturer: 'Lenovo',
    execPaths: ['C:\\Program Files (x86)\\Lenovo\\System Update\\tvsu.exe'],
    description:
      'Narzędzie Lenovo pobierające najnowsze sterowniki i oprogramowanie układowe dla komputerów ThinkPad i ThinkCentre.'
  }
]
