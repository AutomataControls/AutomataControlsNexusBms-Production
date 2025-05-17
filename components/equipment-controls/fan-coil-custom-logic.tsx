"use client"

import type React from "react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { useRef } from "react"
import dynamic from "next/dynamic"
import type { EditorProps } from "@monaco-editor/react"
import type { LogicEvaluation } from "./types"

// Dynamically import the Editor component
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-[400px] border rounded-md flex items-center justify-center">Loading editor...</div>,
}) as React.ComponentType<EditorProps>

interface FanCoilCustomLogicProps {
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

export function FanCoilCustomLogic({
  customLogic,
  customLogicEnabled,
  autoSyncEnabled,
  setAutoSyncEnabled,
  onCustomLogicChange,
  onCustomLogicEnabledChange,
  runLogicNow,
  logicEvaluation,
  sandbox,
}: FanCoilCustomLogicProps) {
  const { toast } = useToast()
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Logic</CardTitle>
        <CardDescription>
          Write custom JavaScript logic to control the fan coil unit. The function must return an object
          with these control values: fanEnabled, unitEnable, fanSpeed, heatingValvePosition,
          coolingValvePosition, outdoorDamperPosition, and temperatureSetpoint. Logic runs every 15 seconds.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="customLogicEnabled"
                checked={customLogicEnabled}
                onChange={(e) => {
                  onCustomLogicEnabledChange(e.target.checked)
                }}
                className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <label htmlFor="customLogicEnabled" className="text-sm font-medium text-gray-700">
                Enable Custom Logic
              </label>
            </div>
            <div className="flex items-center space-x-2">
              <label htmlFor="autoSync" className="text-sm font-medium text-gray-700">
                Auto-Sync
              </label>
              <Switch id="autoSync" checked={autoSyncEnabled} onCheckedChange={setAutoSyncEnabled} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Available Metrics</h4>
              <div className="bg-gray-50 p-3 rounded-md text-xs font-mono h-40 overflow-auto">
                <pre>{JSON.stringify(sandbox.metrics, null, 2)}</pre>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="text-sm font-medium">Active Control Settings</h4>
              <div className="bg-gray-50 p-3 rounded-md text-xs font-mono h-40 overflow-auto">
                <pre>{JSON.stringify(sandbox.settings, null, 2)}</pre>
              </div>
            </div>
          </div>

          <Editor
            height="400px"
            language="javascript"
            value={customLogic}
            onChange={(value) => {
              // Use debounce to avoid too many saves
              if (autoSyncEnabled) {
                // If auto-sync is enabled, save after a short delay
                if (debounceTimeoutRef.current) {
                  clearTimeout(debounceTimeoutRef.current)
                }
                debounceTimeoutRef.current = setTimeout(() => {
                  onCustomLogicChange(value || "")
                }, 1000) // 1 second debounce
              }
            }}
            options={{
              minimap: { enabled: false },
              fontSize: 14,
              scrollBeyondLastLine: false,
              automaticLayout: true,
              tabSize: 2,
            }}
          />

          <div className="flex justify-between">
            <Button
              onClick={() => {
                // Reset to default template logic that includes all required values
                const defaultLogic = `// Fan Coil Control Logic
function fanCoilControl(metrics, settings) {
  // Get current temperatures with proper fallbacks - expanded to include more naming variations
  const currentTemp = metrics.Supply || metrics.supply || metrics.SupplyTemp || metrics.supplyTemp ||
    metrics.supplyTemperature || metrics.SupplyTemperature || metrics.discharge || metrics.Discharge ||
    metrics.dischargeTemp || metrics.DischargeTemp || metrics.dischargeTemperature ||
    metrics.DischargeTemperature || metrics.SAT || metrics.sat || metrics.SupplyAirTemp ||
    metrics.supplyAirTemp || metrics.roomTemp || metrics.RoomTemp || metrics.roomTemperature ||
    metrics.RoomTemperature || metrics.coveTemp || metrics.chapelTemp || metrics.kitchenTemp || metrics.mailRoomTemp ||
    metrics.spaceTemp || metrics.SpaceTemp || metrics.zoneTemp || metrics.ZoneTemp ||
    metrics.ZoneTemperature || metrics.zone_temperature || metrics.room_temperature || 72;
  const setpoint = settings.temperatureSetpoint || 72; // Use existing setpoint or default to 72
  const deadband = 1; // Deadband of 1°F for responsive control

  console.log("Current temp:", currentTemp, "Setpoint:", setpoint);

  // Determine if we need heating or cooling based on the temperature difference
  let operationMode = settings.operationMode;

  // If in auto mode, determine whether to heat or cool
  if (operationMode === "auto") {
    if (currentTemp < setpoint - deadband) {
      operationMode = "heating";
      console.log("Auto mode selected heating");
    } else if (currentTemp > setpoint + deadband) {
      operationMode = "cooling";
      console.log("Auto mode selected cooling");
    } else {
      console.log("Auto mode - within deadband, maintaining current state");
    }
  }

  console.log("Operating in mode:", operationMode);

  // Get outdoor temperature with fallbacks
  const outdoorTemp = metrics.outdoorTemperature || metrics.outdoorTemp || metrics.Outdoor ||
    metrics.outdoor || metrics.OutdoorTemp || metrics.OutdoorAir || metrics.outdoorAir ||
    metrics.outdoorAirTemp || metrics.OutdoorAirTemp || metrics.OutdoorAirTemperature ||
    metrics.outdoorAirTemperature || metrics.outdoor_temperature || metrics.outdoor_temp ||
    metrics.outdoor_air_temp || metrics.outdoor_air_temperature || metrics.OAT ||
    metrics.oat || metrics.OutsideAirTemp || metrics.outsideAirTemp ||
    metrics.OutsideTemp || metrics.outsideTemp || 85;

  // Set outdoor damper position
  let outdoorDamperPosition = 0;

  // Determine outdoor damper position based on temperature
  if (outdoorTemp > 40 && outdoorTemp < 80) {
    outdoorDamperPosition = 20; // 20% open when temp is moderate
  }

  // Define our own local PID controller function
  function pidController(input, setpoint, kp, ki, kd, dt, outputMin, outputMax, controllerType) {
    // Get state for this controller
    const state = {
      integral: 0,
      previousError: 0,
      lastOutput: 0
    };
    
    // Calculate error - special handling for cooling
    let error;
    if (controllerType === 'cooling') {
      // For cooling, higher temp means positive error (need more cooling)
      error = input - setpoint;
    } else {
      // For heating and other controls, lower temp means positive error
      error = setpoint - input;
    }
    
    // Calculate integral
    let integral = state.integral + (error * dt);
    
    // Anti-windup - limit integral
    const maxIntegral = (outputMax - outputMin) / (ki || 0.1);
    integral = Math.max(Math.min(integral, maxIntegral), -maxIntegral);
    
    // Calculate derivative
    const derivative = (error - state.previousError) / dt;
    
    // Calculate output
    let output = kp * error + ki * integral + kd * derivative;
    
    // Clamp output
    output = Math.max(outputMin, Math.min(outputMax, output));
    
    // Return the result
    return {
      output,
      newState: {
        integral,
        previousError: error,
        lastOutput: output
      }
    };
  }

  // Use PID controller for cooling valve
  if (operationMode === "cooling") {
    const coolingPID = pidController(
      currentTemp,
      setpoint,
      0.5, 0.1, 0.05,
      5, 0, 100,
      'cooling'
    );

    return {
      coolingValvePosition: coolingPID.output,
      heatingValvePosition: 0,
      fanEnabled: true,
      fanSpeed: "medium",
      outdoorDamperPosition: outdoorDamperPosition,
      temperatureSetpoint: setpoint,
      unitEnable: true
    };
  } else if (operationMode === "heating") {
    // Use proportional control for heating
    const heatingOutput = Math.max(0, Math.min(100, (setpoint - currentTemp) * 10));

    return {
      coolingValvePosition: 0,
      heatingValvePosition: heatingOutput,
      fanEnabled: true,
      fanSpeed: "medium",
      outdoorDamperPosition: outdoorDamperPosition,
      temperatureSetpoint: setpoint,
      unitEnable: true
    };
  }

  // Default return for within deadband
  return {
    coolingValvePosition: 0,
    heatingValvePosition: 0,
    fanEnabled: true,
    fanSpeed: "low",
    outdoorDamperPosition: outdoorDamperPosition,
    temperatureSetpoint: setpoint,
    unitEnable: true
  };
}`;
                onCustomLogicChange(defaultLogic);

                toast({
                  title: "Logic Reset",
                  description: "Custom logic has been reset to the default template",
                  className: "bg-blue-50 border-blue-200",
                })
              }}
              variant="outline"
              className="border-gray-300 text-gray-700"
            >
              Reset to Default
            </Button>
            <Button
              onClick={runLogicNow}
              disabled={!customLogicEnabled}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              Run Logic Now
            </Button>
          </div>

          {logicEvaluation?.error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
              <p className="font-medium">Error in custom logic:</p>
              <pre className="mt-2 text-sm overflow-auto">{logicEvaluation.error}</pre>
            </div>
          )}

          {logicEvaluation?.result && (
            <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-md">
              <p className="font-medium">Logic evaluation result:</p>
              <pre className="mt-2 text-sm overflow-auto">{JSON.stringify(logicEvaluation.result, null, 2)}</pre>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
