import type { DataSnapshot } from "firebase/database"
import type { JSX } from "react"

// PID controller interface
export interface PIDSettings {
  kp: number
  ki: number
  kd: number
  enabled: boolean
  outputMin: number
  outputMax: number
  sampleTime: number
  setpoint?: number
  reverseActing: boolean
}

// Outdoor Air Reset Settings interface
export interface OutdoorAirResetSettings {
  enabled: boolean
  outdoorTempLow: number
  outdoorTempHigh: number
  setpointLow: number
  setpointHigh: number
}

// Fan Coil Control Values interface
export interface ControlValues {
  fanSpeed: string
  fanMode: string
  fanEnabled: boolean
  heatingValvePosition: number
  coolingValvePosition: number
  heatingValveMode: string
  coolingValveMode: string
  temperatureSetpoint: number
  operationMode: string
  unitEnable: boolean
  customLogicEnabled?: boolean
  customLogic?: string
  outdoorDamperPosition?: number
  pidControllers?: {
    heating?: PIDSettings
    cooling?: PIDSettings
    outdoorDamper?: PIDSettings
  }
  outdoorAirReset?: OutdoorAirResetSettings
}

// Air Handler Control Values interface
export interface AirHandlerControls {
  unitEnable: boolean
  operationMode: string
  temperatureSetpoint: number
  humiditySetpoint?: number
  economizerEnable?: boolean
  supplyAirTempSetpoint?: number
  supplyFanSpeed?: number
  supplyFanEnabled?: boolean
  returnFanEnabled?: boolean
  returnFanSpeed?: number
  staticPressureSetpoint?: number
  returnAirDamper?: number
  customLogicEnabled?: boolean
  customLogic?: string
  heatingValveEnable?: boolean
  heatingValveMode?: string
  heatingValvePosition?: number
  coolingValveEnable?: boolean
  coolingValveMode?: string
  coolingValvePosition?: number
  outdoorDamperMode?: string
  outdoorDamperPosition?: number
  returnDamperPosition?: number
  exhaustDamperPosition?: number
  heatingStages?: number
  activeHeatingStages?: number
  coolingStages?: number
  activeCoolingStages?: number
  pidControllers?: {
    heating?: PIDSettings
    cooling?: PIDSettings
    outdoorDamper?: PIDSettings
    returnDamper?: PIDSettings
    exhaustDamper?: PIDSettings
    staticPressure?: PIDSettings
  }
  outdoorAirReset?: OutdoorAirResetSettings
}

export interface ControlHistoryEntry {
  id: string
  command: string
  source: string
  status: string
  timestamp: number
  formattedTimestamp?: string
  value: any
  previousValue?: any
  mode?: string
  userId: string
  userName: string
  details: string
  commandType?: string
  sequentialId?: string
}

export interface HistorySnapshot extends DataSnapshot {
  val(): { [key: string]: ControlHistoryEntry } | null
}

export interface LogicEvaluation {
  result: any
  error?: string
  timestamp: number
  hasChanges: boolean
}

export interface ChangeRecord {
  key: string
  newValue: any
  previousValue: any
}

export interface FanCoilControlsProps {
  equipment: {
    id: string
    locationId: string
    locationName: string
    controls: ControlValues
    status: string
    name: string
    type: string
  }
  metrics?: { [key: string]: any }
  values?: ControlValues
  onChange?: (values: ControlValues) => void
}

export interface AirHandlerControlsProps {
  equipment: {
    id: string
    locationId?: string
    locationName?: string
    controls: AirHandlerControls
    status?: string
    name?: string
    type?: string
    sensors?: {
      zoneTemp?: number
      supplyAirTemp?: number
      outdoorAirTemp?: number
      [key: string]: any
    }
  }
  metrics?: {
    [key: string]: any
  }
  showSaveButton?: boolean
}

// Props for Air Handler sub-components
export interface AirHandlerGeneralControlsProps {
  controls: AirHandlerControls
  onControlChange: (key: string, value: any) => void
}

export interface AirHandlerPIDSettingsProps {
  pidControllers?: {
    heating?: PIDSettings
    cooling?: PIDSettings
    outdoorDamper?: PIDSettings
    returnDamper?: PIDSettings
    exhaustDamper?: PIDSettings
    staticPressure?: PIDSettings
  }
  onPidChange: (
    controllerType: "heating" | "cooling" | "outdoorDamper" | "returnDamper" | "exhaustDamper" | "staticPressure",
    paramName: keyof PIDSettings,
    value: number | boolean,
  ) => Promise<void>
}

export interface AirHandlerOutdoorAirResetProps {
  outdoorAirReset?: OutdoorAirResetSettings
  onOutdoorAirResetChange: (key: string, value: any) => void
}

export interface AirHandlerCustomLogicProps {
  customLogic?: string
  customLogicEnabled?: boolean
  autoSyncEnabled: boolean
  setAutoSyncEnabled: (enabled: boolean) => void
  onCustomLogicChange: (value: string) => Promise<void>
  onCustomLogicEnabledChange: (enabled: boolean) => void
  runLogicNow: () => void
  logicEvaluation: LogicEvaluation | null
  sandbox: {
    metrics: any
    settings: any
  }
}

export interface AirHandlerCommandHistoryProps {
  controlHistory: ControlHistoryEntry[]
  onDeleteCommand: (id: string, commandType: string, sequentialId: string) => Promise<void>
  renderStatusIcon: (status: string) => JSX.Element
  getCommandDescription: (command: string) => string
}
