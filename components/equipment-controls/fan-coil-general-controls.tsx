"use client"
import { useState } from "react"
import type { ControlValues } from "./types"

interface FanCoilGeneralControlsProps {
  controlValues: ControlValues
  onControlValueChange: (key: string, value: any) => void
  onTemperatureSetpointChange: (value: number) => Promise<void>
  onValveChange: (valveType: "heating" | "cooling", value: number) => Promise<void>
  onValveModeChange: (valveType: "heating" | "cooling", value: string) => void
  onFanChange: (value: string) => void
  onFanModeChange: (value: string) => void
  onFanToggle: (enabled: boolean) => Promise<void>
  onUnitEnable: (enabled: boolean) => void
  metrics?: { [key: string]: any }
  sandbox?: {
    metrics: any
    settings: any
  }
  autoSyncEnabled?: boolean
  onApplyChanges?: () => Promise<void>
  isSubmitting?: boolean
  showSaveButton?: boolean
}

export function FanCoilGeneralControls({
  controlValues,
  onControlValueChange,
  onTemperatureSetpointChange,
  onValveChange,
  onValveModeChange,
  onFanChange,
  onFanModeChange,
  onFanToggle,
  onUnitEnable,
  metrics,
  sandbox,
  autoSyncEnabled = true,
  onApplyChanges,
  isSubmitting = false,
  showSaveButton = true, // Default to true for backward compatibility
}: FanCoilGeneralControlsProps) {
  const [temperatureSource, setTemperatureSource] = useState<string>("space")
  const [activeTab, setActiveTab] = useState<string>("general")
  const [applyingTemperature, setApplyingTemperature] = useState<boolean>(false)

  // Determine which temperature is being used for calculation
  const getActiveTemperature = () => {
    const spaceTemp =
      metrics?.roomTemperature ||
      metrics?.roomTemp ||
      metrics?.coveTemp ||
      metrics?.chapelTemp ||
      metrics?.kitchenTemp ||
      metrics?.mailRoomTemp ||
      metrics?.spaceTemp ||
      metrics?.SpaceTemp ||
      metrics?.zoneTemp ||
      metrics?.ZoneTemp ||
      72

    const supplyTemp =
      metrics?.supplyTemperature ||
      metrics?.supplyTemp ||
      metrics?.Supply ||
      metrics?.supply ||
      metrics?.SupplyTemp ||
      55

    return {
      space: spaceTemp,
      supply: supplyTemp,
      active: temperatureSource === "space" ? spaceTemp : supplyTemp,
    }
  }

  const temperatures = getActiveTemperature()

  // Handle temperature source change
  const handleTemperatureSourceChange = (value: string) => {
    setTemperatureSource(value)
    onControlValueChange("temperatureSource", value)
  }

  // Handle apply temperature setpoint
  const handleApplyTemperatureSetpoint = async () => {
    setApplyingTemperature(true)
    try {
      await onTemperatureSetpointChange(controlValues.temperatureSetpoint)
    } finally {
      setApplyingTemperature(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex border-b">
        <button
          className={`px-4 py-2 ${
            activeTab === "general" ? "border-b-2 border-orange-500 font-medium" : "text-gray-500"
          }`}
          onClick={() => setActiveTab("general")}
        >
          General
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === "valves" ? "border-b-2 border-orange-500 font-medium" : "text-gray-500"
          }`}
          onClick={() => setActiveTab("valves")}
        >
          Valves
        </button>
        <button
          className={`px-4 py-2 ${
            activeTab === "jslogic" ? "border-b-2 border-orange-500 font-medium" : "text-gray-500"
          }`}
          onClick={() => setActiveTab("jslogic")}
        >
          JS Logic
        </button>
      </div>

      {/* General Controls Tab */}
      {activeTab === "general" && (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-lg font-medium mb-2">General Controls</h3>
          <p className="text-sm text-gray-500 mb-4">Basic controls for the fan coil unit</p>

          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <span>Unit Enable</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={controlValues.unitEnable}
                  onChange={(e) => onUnitEnable(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d2f4ea]"></div>
              </label>
            </div>

            <div className="flex items-center justify-between">
              <span>Fan Enable</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={controlValues.fanEnabled}
                  onChange={(e) => onFanToggle(e.target.checked)}
                  disabled={!controlValues.unitEnable}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#d2f4ea]"></div>
              </label>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Temperature Source</span>
                <select
                  value={temperatureSource}
                  onChange={(e) => handleTemperatureSourceChange(e.target.value)}
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2.5"
                >
                  <option value="space">Space Temperature</option>
                  <option value="supply">Supply Temperature</option>
                </select>
              </div>
              <div className="text-sm text-gray-600">
                Active: {temperatureSource === "space" ? "Space" : "Supply"} Temperature ({temperatures.active}°F)
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Temperature Setpoint (°F)</span>
                <span className="font-medium">{controlValues.temperatureSetpoint}°F</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={60}
                  max={85}
                  step={0.5}
                  value={controlValues.temperatureSetpoint}
                  onChange={(e) => onControlValueChange("temperatureSetpoint", Number.parseFloat(e.target.value))}
                  disabled={!controlValues.unitEnable}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#d2f4ea]"
                />
                <div className="flex justify-between text-xs text-gray-500 px-1">
                  <span>60°F</span>
                  <span>85°F</span>
                </div>
              </div>
              <button
                onClick={handleApplyTemperatureSetpoint}
                disabled={!controlValues.unitEnable || applyingTemperature}
                className="mt-2 bg-[#d2f4ea] hover:bg-[#b5e9d8] text-gray-800 px-4 py-2 rounded flex items-center space-x-2 text-sm"
              >
                {applyingTemperature ? (
                  <>
                    <svg
                      className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-800"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    <span>Applying...</span>
                  </>
                ) : (
                  <span>Apply Temperature</span>
                )}
              </button>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Operation Mode</span>
                <select
                  value={controlValues.operationMode}
                  onChange={(e) => onControlValueChange("operationMode", e.target.value)}
                  disabled={!controlValues.unitEnable}
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2.5"
                >
                  <option value="auto">Auto</option>
                  <option value="cooling">Cooling</option>
                  <option value="heating">Heating</option>
                  <option value="off">Off</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Fan Speed</span>
                <select
                  value={controlValues.fanSpeed}
                  onChange={(e) => onFanChange(e.target.value)}
                  disabled={!controlValues.unitEnable || !controlValues.fanEnabled}
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2.5"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Fan Mode</span>
                <select
                  value={controlValues.fanMode}
                  onChange={(e) => onFanModeChange(e.target.value)}
                  disabled={!controlValues.unitEnable || !controlValues.fanEnabled}
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2.5"
                >
                  <option value="auto">Auto</option>
                  <option value="continuous">Continuous</option>
                </select>
              </div>
            </div>

            <button
              onClick={onApplyChanges}
              disabled={isSubmitting || !controlValues.unitEnable}
              className="w-full mt-4 bg-[#d2f4ea] hover:bg-[#b5e9d8] text-gray-800 px-4 py-2 rounded flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <svg
                    className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-800"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  <span>Applying...</span>
                </>
              ) : (
                <span>Apply Controls</span>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Valves Tab */}
      {activeTab === "valves" && (
        <div className="bg-white p-4 rounded-lg border shadow-sm">
          <h3 className="text-lg font-medium mb-2">Valve Controls</h3>
          <p className="text-sm text-gray-500 mb-4">Manual control of heating and cooling valves</p>

          <div className="space-y-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Heating Valve Position</span>
                <span className="font-medium">{controlValues.heatingValvePosition}%</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={controlValues.heatingValvePosition}
                  onChange={(e) => onValveChange("heating", Number.parseInt(e.target.value))}
                  disabled={!controlValues.unitEnable}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#d2f4ea]"
                />
                <div className="flex justify-between text-xs text-gray-500 px-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Cooling Valve Position</span>
                <span className="font-medium">{controlValues.coolingValvePosition}%</span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={controlValues.coolingValvePosition}
                  onChange={(e) => onValveChange("cooling", Number.parseInt(e.target.value))}
                  disabled={!controlValues.unitEnable}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#d2f4ea]"
                />
                <div className="flex justify-between text-xs text-gray-500 px-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Outdoor Damper Position</span>
                <span className="font-medium">
                  {controlValues.outdoorDamperPosition ? (controlValues.outdoorDamperPosition * 100).toFixed(0) : 0}%
                </span>
              </div>
              <div className="relative">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={1}
                  value={controlValues.outdoorDamperPosition ? controlValues.outdoorDamperPosition * 100 : 0}
                  onChange={(e) => onControlValueChange("outdoorDamperPosition", Number.parseInt(e.target.value) / 100)}
                  disabled={!controlValues.unitEnable}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-[#d2f4ea]"
                />
                <div className="flex justify-between text-xs text-gray-500 px-1">
                  <span>0%</span>
                  <span>100%</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Heating Valve Mode</span>
                <select
                  value={controlValues.heatingValveMode}
                  onChange={(e) => onValveModeChange("heating", e.target.value)}
                  disabled={!controlValues.unitEnable}
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2.5"
                >
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span>Cooling Valve Mode</span>
                <select
                  value={controlValues.coolingValveMode}
                  onChange={(e) => onValveModeChange("cooling", e.target.value)}
                  disabled={!controlValues.unitEnable}
                  className="bg-white border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block w-40 p-2.5"
                >
                  <option value="auto">Auto</option>
                  <option value="manual">Manual</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JS Logic Tab */}
      {activeTab === "jslogic" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <h3 className="text-lg font-medium mb-2">Live Metrics</h3>
              <div className="bg-gray-50 p-3 rounded-md text-xs font-mono h-60 overflow-auto">
                {sandbox?.metrics ? (
                  <pre>{JSON.stringify(sandbox.metrics, null, 2)}</pre>
                ) : (
                  <div className="text-gray-400">No metrics available</div>
                )}
              </div>
            </div>
            <div className="bg-white p-4 rounded-lg border shadow-sm">
              <h3 className="text-lg font-medium mb-2">Current Settings</h3>
              <div className="bg-gray-50 p-3 rounded-md text-xs font-mono h-60 overflow-auto">
                {sandbox?.settings ? (
                  <pre>{JSON.stringify(sandbox.settings, null, 2)}</pre>
                ) : (
                  <div className="text-gray-400">No settings available</div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-medium">Logic Evaluation</h3>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-500">Auto-Sync: {autoSyncEnabled ? "Enabled" : "Disabled"}</span>
                <button
                  className="bg-[#d2f4ea] hover:bg-[#b5e9d8] text-gray-800 px-4 py-2 rounded"
                  onClick={() => {
                    // This would trigger the runLogicNow function
                    console.log("Run Logic Now clicked")
                  }}
                >
                  Run Logic Now
                </button>
              </div>
            </div>
            <div className="bg-gray-900 text-gray-100 p-4 rounded-md">
              <p className="font-mono text-sm">No evaluation results yet</p>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border shadow-sm">
            <h3 className="text-lg font-medium mb-2">Debug Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium">Zone Temperature:</p>
                <p className="text-lg">{temperatures.space}°F</p>
              </div>
              <div>
                <p className="text-sm font-medium">Supply Temperature:</p>
                <p className="text-lg">{temperatures.supply}°F</p>
              </div>
              <div>
                <p className="text-sm font-medium">Setpoint:</p>
                <p className="text-lg">{controlValues.temperatureSetpoint}°F</p>
              </div>
              <div>
                <p className="text-sm font-medium">Operation Mode:</p>
                <p className="text-lg">{controlValues.operationMode}</p>
              </div>
              <div>
                <p className="text-sm font-medium">Heating Valve:</p>
                <p className="text-lg">
                  {controlValues.heatingValvePosition}% (
                  {controlValues.heatingValvePosition === 0 ? "inactive" : "active"})
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">Cooling Valve:</p>
                <p className="text-lg">
                  {controlValues.coolingValvePosition}% (
                  {controlValues.coolingValvePosition === 0 ? "inactive" : "active"})
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Save Controls Button */}
      {showSaveButton && (
        <div className="flex justify-end">
          <button
            onClick={onApplyChanges}
            disabled={isSubmitting}
            className="bg-[#d2f4ea] hover:bg-[#b5e9d8] text-gray-800 px-4 py-2 rounded flex items-center space-x-2"
          >
            {isSubmitting ? (
              <>
                <svg
                  className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-800"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
                <span>Saving...</span>
              </>
            ) : (
              <span>Save Controls</span>
            )}
          </button>
        </div>
      )}
    </div>
  )
}
