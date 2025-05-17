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

interface AirHandlerCustomLogicProps {
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

export function AirHandlerCustomLogic({
  customLogic,
  customLogicEnabled,
  autoSyncEnabled,
  setAutoSyncEnabled,
  onCustomLogicChange,
  onCustomLogicEnabledChange,
  runLogicNow,
  logicEvaluation,
  sandbox,
}: AirHandlerCustomLogicProps) {
  const { toast } = useToast()
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Custom Logic</CardTitle>
        <CardDescription>
          Write custom JavaScript logic to control the air handler unit. The function must return an object with these
          control values: supplyFanEnabled, returnFanEnabled, unitEnable, supplyFanSpeed, returnFanSpeed,
          heatingValvePosition, coolingValvePosition, outdoorDamperPosition, returnDamperPosition,
          exhaustDamperPosition, temperatureSetpoint, and staticPressureSetpoint. Logic runs every 15 seconds.
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
              <Switch
                id="autoSync"
                checked={autoSyncEnabled}
                onCheckedChange={setAutoSyncEnabled}
                className="data-[state=checked]:bg-[#d2f4ea]"
              />
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
                const defaultLogic = `// Air Handler Control Logic
function airHandlerControl(metrics, settings) {
  // Get current temperatures with proper fallbacks
  const supplyTemp = metrics.Supply || metrics.supply || metrics.SupplyTemp || metrics.supplyTemp ||
    metrics.supplyTemperature || metrics.SupplyTemperature || metrics.discharge || metrics.Discharge ||
    metrics.dischargeTemp || metrics.DischargeTemp || metrics.dischargeTemperature ||
    metrics.DischargeTemperature || metrics.SAT || metrics.sat || metrics.SupplyAirTemp ||
    metrics.supplyAirTemp || 72;
  
  const returnTemp = metrics.Return || metrics.return || metrics.ReturnTemp || metrics.returnTemp ||
    metrics.returnTemperature || metrics.ReturnTemperature || metrics.RAT || metrics.rat ||
    metrics.ReturnAirTemp || metrics.returnAirTemp || 75;
    
  const outdoorTemp = metrics.outdoorTemperature || metrics.outdoorTemp || metrics.Outdoor ||
    metrics.outdoor || metrics.OutdoorTemp || metrics.OutdoorAir || metrics.outdoorAir ||
    metrics.outdoorAirTemp || metrics.OutdoorAirTemp || metrics.OutdoorAirTemperature ||
    metrics.outdoorAirTemperature || metrics.outdoor_temperature || metrics.outdoor_temp ||
    metrics.outdoor_air_temp || metrics.outdoor_air_temperature || metrics.OAT ||
    metrics.oat || metrics.OutsideAirTemp || metrics.outsideAirTemp ||
    metrics.OutsideTemp || metrics.outsideTemp || 85;
    
  const mixedTemp = metrics.Mixed || metrics.mixed || metrics.MixedTemp || metrics.mixedTemp ||
    metrics.mixedTemperature || metrics.MixedTemperature || metrics.MAT || metrics.mat ||
    metrics.MixedAirTemp || metrics.mixedAirTemp || 75;
    
  const staticPressure = metrics.StaticPressure || metrics.staticPressure || metrics.static ||
    metrics.Static || metrics.ductPressure || metrics.DuctPressure || metrics.duct_pressure ||
    metrics.Duct_Pressure || 1.0;
  
  // Get setpoints from settings
  const tempSetpoint = settings.temperatureSetpoint || 72;
  const staticSetpoint = settings.staticPressureSetpoint || 1.0;
  const deadband = 1; // Deadband of 1°F for responsive control

  console.log("Supply temp:", supplyTemp, "Return temp:", returnTemp, "Outdoor temp:", outdoorTemp);
  console.log("Temperature setpoint:", tempSetpoint, "Static pressure:", staticPressure, "Static setpoint:", staticSetpoint);

  // Determine if we need heating or cooling based on the temperature difference
  let operationMode = settings.operationMode;

  // If in auto mode, determine whether to heat or cool
  if (operationMode === "auto") {
    if (supplyTemp < tempSetpoint - deadband) {
      operationMode = "heating";
      console.log("Auto mode selected heating");
    } else if (supplyTemp > tempSetpoint + deadband) {
      operationMode = "cooling";
      console.log("Auto mode selected cooling");
    } else {
      console.log("Auto mode - within deadband, maintaining current state");
    }
  }

  console.log("Operating in mode:", operationMode);

  // Economizer logic - use outdoor air when beneficial
  let outdoorDamperPosition = 10; // Minimum position for ventilation
  let returnDamperPosition = 90;
  let exhaustDamperPosition = 10;
  
  // If outdoor air is cooler than return air and we need cooling, use economizer
  const useEconomizer = operationMode === "cooling" && outdoorTemp < returnTemp && outdoorTemp > 45;
  
  if (useEconomizer) {
    console.log("Using economizer - outdoor air is beneficial for cooling");
    // Calculate optimal damper positions based on temperature differential
    const tempDiff = returnTemp - outdoorTemp;
    const maxDiff = 20; // Maximum expected temperature difference
    
    // Scale damper positions based on temperature difference (more difference = more outdoor air)
    const scaleFactor = Math.min(tempDiff / maxDiff, 1);
    outdoorDamperPosition = 10 + (scaleFactor * 90); // 10% to 100%
    returnDamperPosition = 90 - (scaleFactor * 80); // 90% to 10%
    exhaustDamperPosition = outdoorDamperPosition - 10; // Slightly less than outdoor damper
    
    // Ensure minimum positions
    outdoorDamperPosition = Math.max(10, outdoorDamperPosition);
    returnDamperPosition = Math.max(10, returnDamperPosition);
    exhaustDamperPosition = Math.max(5, exhaustDamperPosition);
    
    // Ensure maximum positions
    outdoorDamperPosition = Math.min(100, outdoorDamperPosition);
    returnDamperPosition = Math.min(100, returnDamperPosition);
    exhaustDamperPosition = Math.min(100, exhaustDamperPosition);
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

  // Static pressure control
  const staticPressureError = staticSetpoint - staticPressure;
  let supplyFanSpeed = settings.supplyFanSpeed || 50;
  
  // Simple proportional control for static pressure
  if (settings.unitEnable && settings.supplyFanEnable) {
    // Adjust fan speed based on static pressure error
    supplyFanSpeed = Math.max(20, Math.min(100, supplyFanSpeed + (staticPressureError * 10)));
  }
  
  // Return fan typically runs at a percentage of supply fan
  let returnFanSpeed = settings.returnFanEnable ? supplyFanSpeed * 0.9 : 0;

  // Use PID controller for cooling valve
  let coolingValvePosition = 0;
  let heatingValvePosition = 0;
  let coolingStage = 0;
  let heatingStage = 0;
  
  if (operationMode === "cooling") {
    // If we're using economizer, reduce mechanical cooling
    if (useEconomizer) {
      // Calculate remaining cooling needed after economizer
      const economizingEffect = (outdoorDamperPosition / 100) * 0.7; // 70% effectiveness at max
      const remainingCooling = Math.max(0, (supplyTemp - tempSetpoint) / 10);
      
      if (remainingCooling > 0.1) {
        // Still need some mechanical cooling
        const coolingPID = pidController(
          supplyTemp,
          tempSetpoint,
          0.5, 0.1, 0.05,
          5, 0, 100,
          'cooling'
        );
        
        coolingValvePosition = coolingPID.output * (1 - economizingEffect);
        // If using staged cooling instead of valve
        coolingStage = Math.min(3, Math.ceil(coolingValvePosition / 33));
      }
    } else {
      // No economizer, use full mechanical cooling
      const coolingPID = pidController(
        supplyTemp,
        tempSetpoint,
        0.5, 0.1, 0.05,
        5, 0, 100,
        'cooling'
      );
      
      coolingValvePosition = coolingPID.output;
      // If using staged cooling instead of valve
      coolingStage = Math.min(3, Math.ceil(coolingValvePosition / 33));
    }
  } else if (operationMode === "heating") {
    // Use proportional control for heating
    const heatingOutput = Math.max(0, Math.min(100, (tempSetpoint - supplyTemp) * 10));
    
    heatingValvePosition = heatingOutput;
    // If using staged heating instead of valve
    heatingStage = Math.min(2, Math.ceil(heatingValvePosition / 50));
  }

  // Return the control values
  return {
    supplyFanEnable: settings.supplyFanEnable,
    returnFanEnable: settings.returnFanEnable,
    supplyFanSpeed: supplyFanSpeed,
    returnFanSpeed: returnFanSpeed,
    heatingValvePosition: heatingValvePosition,
    coolingValvePosition: coolingValvePosition,
    heatingStage: heatingStage,
    coolingStage: coolingStage,
    outdoorDamperPosition: outdoorDamperPosition,
    returnDamperPosition: returnDamperPosition,
    exhaustDamperPosition: exhaustDamperPosition,
    temperatureSetpoint: tempSetpoint,
    staticPressureSetpoint: staticSetpoint,
    unitEnable: settings.unitEnable
  };
}`
                onCustomLogicChange(defaultLogic)

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
              className="bg-[#d2f4ea] hover:bg-[#b5e9d8] text-black"
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
