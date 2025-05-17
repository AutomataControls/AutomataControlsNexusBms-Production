"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { RefreshCw } from "lucide-react"
import dynamic from "next/dynamic"
import type { EditorProps } from "@monaco-editor/react"

// Add Monaco Editor import
const Editor = dynamic(() => import("@monaco-editor/react"), {
  ssr: false,
  loading: () => <div className="h-[400px] border rounded-md flex items-center justify-center">Loading editor...</div>,
}) as React.ComponentType<EditorProps>

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import { useSocket } from "@/lib/socket-context"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/auth-context" // Import the auth context
import { collection, getDocs, query as firestoreQuery, where } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface ChillerControlsProps {
  equipment: any
}

// Update the default logic to use the actual metric names
const defaultLogic = `// Chiller Control Logic
function chillerControl(metrics, settings) {
  // Get current temperatures with proper fallbacks using all possible naming conventions
  const chilledWaterTemp = metrics["H2O Supply Temperature"] || metrics.chilledWaterTemp || metrics.ChilledWater || 45;
  const condenserWaterTemp = metrics.condenserWaterTemp || metrics.CondenserWater || 85;
  const returnWaterTemp = metrics["H2O Return Temperature"] || metrics.returnWaterTemp || metrics.ReturnWater || 55;
  const outdoorTemp = metrics["Outdoor Air Temperature"] || metrics.outdoorTemp || 72;
  
  // Get pump and chiller statuses
  const cwPump1Status = metrics["CW Pump 1 Status"] || "Off";
  const cwPump2Status = metrics["CW Pump 2 Status"] || "Off";
  const chillerEnabled = metrics["Chiller 2 Enable"] === "On";
  
  // Use chilledWaterSetpoint as our primary setpoint
  const chilledWaterSetpoint = settings.chilledWaterSetpoint || 44;
  const deadband = 1; // 1°F deadband for more responsive control

  console.log("Current chilled water temp:", chilledWaterTemp, "Setpoint:", chilledWaterSetpoint);
  console.log("Outdoor temp:", outdoorTemp, "Return water temp:", returnWaterTemp);
  console.log("CW Pump 1 Status:", cwPump1Status, "CW Pump 2 Status:", cwPump2Status);

  // High and Low Limit Protection
  const HIGH_LIMIT = 65; // High limit protection temperature
  const LOW_LIMIT = 36;  // Low limit protection temperature
  
  // Initialize result object with commands array
  const result = {
    commands: []
  };
  
  // Safety checks
  if (chilledWaterTemp > HIGH_LIMIT) {
    console.log("HIGH LIMIT PROTECTION ACTIVATED");
    // Emergency shutdown
    result.commands.push({ type: "update_compressorEnable", value: false });
    return result;
  }
  
  if (chilledWaterTemp < LOW_LIMIT) {
    console.log("LOW LIMIT PROTECTION ACTIVATED");
    // Emergency shutdown to prevent freezing
    result.commands.push({ type: "update_compressorEnable", value: false });
    return result;
  }
  
  // Normal operation based on mode
  switch (settings.operationMode) {
    case "cooling":
      // Cooling mode logic
      if (chilledWaterTemp > chilledWaterSetpoint + deadband) {
        // Need more cooling
        result.commands.push({ type: "update_compressorEnable", value: true });
        
        // Calculate compressor load based on temperature difference
        const tempDiff = chilledWaterTemp - chilledWaterSetpoint;
        const compressorLoad = Math.min(100, Math.max(20, tempDiff * 10)); // 10% per degree difference, min 20%
        result.commands.push({ type: "update_compressorLoadLimit", value: compressorLoad });
        console.log("Setting compressor load to", compressorLoad, "% based on temp difference of", tempDiff);
      } else if (chilledWaterTemp < chilledWaterSetpoint - deadband) {
        // Water is too cold, reduce cooling
        const compressorLoad = Math.max(20, settings.compressorLoadLimit - 10);
        result.commands.push({ type: "update_compressorLoadLimit", value: compressorLoad });
        console.log("Reducing compressor load to", compressorLoad, "%");
      } else {
        // Within deadband, maintain current state
        console.log("Temperature within deadband, maintaining state");
      }
      break;
      
    case "ice-making":
      // Ice making mode - run at maximum capacity with lower setpoint
      result.commands.push({ type: "update_compressorEnable", value: true });
      result.commands.push({ type: "update_compressorLoadLimit", value: 100 });
      console.log("Ice making mode active, running at maximum capacity");
      break;
      
    case "standby":
      // Standby mode - keep compressor off
      result.commands.push({ type: "update_compressorEnable", value: false });
      console.log("Standby mode active, compressor disabled");
      break;
      
    case "auto":
    default:
      // Auto mode - determine if cooling is needed based on return water temp
      if (returnWaterTemp > chilledWaterSetpoint + 2) {
        // Return water is warm, need cooling
        result.commands.push({ type: "update_compressorEnable", value: true });
        
        // Calculate load based on temperature difference
        const tempDiff = returnWaterTemp - chilledWaterSetpoint;
        const compressorLoad = Math.min(100, Math.max(20, tempDiff * 8)); // 8% per degree difference
        result.commands.push({ type: "update_compressorLoadLimit", value: compressorLoad });
        console.log("Auto mode: Cooling needed. Compressor load:", compressorLoad);
      } else if (returnWaterTemp < chilledWaterSetpoint) {
        // Return water is at or below setpoint, reduce cooling
        if (settings.compressorEnable) {
          const compressorLoad = Math.max(20, settings.compressorLoadLimit - 10);
          result.commands.push({ type: "update_compressorLoadLimit", value: compressorLoad });
          console.log("Auto mode: Reducing cooling. Compressor load:", compressorLoad);
        }
      }
      break;
  }
  
  // Condenser fan control based on outdoor temperature
  if (settings.condenserFanEnable) {
    if (outdoorTemp > 85) {
      // Hot outside, increase fan speed
      const fanSpeed = Math.min(100, settings.condenserFanSpeed + 10);
      result.commands.push({ type: "update_condenserFanSpeed", value: fanSpeed });
      console.log("Increasing condenser fan speed to", fanSpeed, "%");
    } else if (outdoorTemp < 65) {
      // Cool outside, decrease fan speed
      const fanSpeed = Math.max(20, settings.condenserFanSpeed - 10);
      result.commands.push({ type: "update_condenserFanSpeed", value: fanSpeed });
      console.log("Decreasing condenser fan speed to", fanSpeed, "%");
    }
  }
  
  return result;
}`

export function ChillerControls({ equipment }: ChillerControlsProps) {
  const [controlValues, setControlValues] = useState<any>({
    ...equipment.controls,
  })
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false)
  const [username, setUsername] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false)
  const [pendingChange, setPendingChange] = useState<{ key: string; value: any } | null>(null)
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false)
  const [loginError, setLoginError] = useState<string>("")

  const { socket } = useSocket()
  const { toast } = useToast()
  const { user, loginWithUsername } = useAuth() // Use the auth context

  // Helper function to check if user has required role
  const hasRequiredRole = () => {
    if (!user || !user.roles) return false
    const allowedRoles = ["admin", "DevOps", "devops", "Facilities", "facilities"]
    return user.roles.some((role) => allowedRoles.includes(role.toLowerCase()))
  }

  const [customLogicEnabled, setCustomLogicEnabled] = useState<boolean>(false)
  const [customLogic, setCustomLogic] = useState<string>(defaultLogic)
  const [logicEvaluation, setLogicEvaluation] = useState<any>(null)
  const isEvaluatingLogicRef = useRef(false)

  // Check if user is already authenticated
  useEffect(() => {
    if (user) {
      setIsAuthenticated(true)
    }
  }, [user])

  // Update the sandbox metrics to include all the different naming conventions
  const sandbox = {
    metrics: {
      // Original metrics (keep for backward compatibility)
      chilledWaterTemp: equipment.metrics?.["H2O Supply Temperature"] || 45,
      condenserWaterTemp: 85,
      returnWaterTemp: equipment.metrics?.["H2O Return Temperature"] || 55,
      compressorLoad: 75,
      condenserPressure: 180,

      // Actual metrics from the system with their original names
      "CW Pump 1 Enable": equipment.metrics?.["CW Pump 1 Enable"] || "Off",
      "CW Pump 1 Status": equipment.metrics?.["CW Pump 1 Status"] || "Off",
      "CW Pump 2 Enable": equipment.metrics?.["CW Pump 2 Enable"] || "Off",
      "CW Pump 2 Status": equipment.metrics?.["CW Pump 2 Status"] || "On",
      "Chiller 2 Enable": equipment.metrics?.["Chiller 2 Enable"] || "On",
      "Equipment States Last Update": equipment.metrics?.["Equipment States Last Update"] || 2025.0,
      "H2O Return Temperature": equipment.metrics?.["H2O Return Temperature"] || 49.3,
      "H2O Supply Temperature": equipment.metrics?.["H2O Supply Temperature"] || 42.6,
      "Outdoor Air Temperature": equipment.metrics?.["Outdoor Air Temperature"] || 72.0,

      // Add any other metrics from your system
      ...equipment.metrics,
    },
    settings: {
      chilledWaterSetpoint: controlValues.chilledWaterSetpoint || 44,
      operationMode: controlValues.operationMode || "auto",
      compressorEnable: controlValues.compressorEnable !== undefined ? controlValues.compressorEnable : true,
      compressorLoadLimit: controlValues.compressorLoadLimit || 100,
      compressorMinRunTime: controlValues.compressorMinRunTime || 5,
      compressorMinOffTime: controlValues.compressorMinOffTime || 5,
      condenserFanEnable: controlValues.condenserFanEnable !== undefined ? controlValues.condenserFanEnable : true,
      condenserFanSpeed: controlValues.condenserFanSpeed || 100,
      condenserPressureSetpoint: controlValues.condenserPressureSetpoint || 180,
      demandLimit: controlValues.demandLimit || 100,
    },
  }

  // Logic evaluation handler
  const evaluateLogic = async () => {
    if (isEvaluatingLogicRef.current) return

    isEvaluatingLogicRef.current = true
    try {
      // Create a sandbox environment for the code to run in
      const sandboxProxy = new Proxy(sandbox, {
        get: (target, prop) => {
          if (typeof prop === "string" && prop in target) {
            return target[prop]
          }
          // Return a safe default value or handle the missing property
          console.warn(`Attempted to access missing property: ${String(prop)}`)
          return undefined
        },
      })

      // Wrap the code in a try-catch block to handle errors
      try {
        // Extract the chillerControl function from the custom logic
        const customLogicCode = customLogic || defaultLogic

        // Create a function wrapper that will safely execute the custom logic
        const functionWrapper = `
        try {
          ${customLogicCode}
          return typeof chillerControl === "function" ? chillerControl : function() { return {}; };
        } catch(e) {
          console.error("Error in custom logic:", e);
          return function() { return {}; };
        }
      `

        // Create a function that will execute the custom logic and return the chillerControl function
        const getChillerControlFn = new Function("return (function() { " + functionWrapper + " })();")

        // Get the chillerControl function
        const chillerControlFn = getChillerControlFn()

        // Add detailed debug logging
        console.log("Evaluating logic with:", {
          chilledWaterTemp: sandboxProxy.metrics.chilledWaterTemp,
          setpoint: sandboxProxy.settings.chilledWaterSetpoint,
          operationMode: sandboxProxy.settings.operationMode,
        })

        // Execute the chillerControl function with the sandbox data
        const result = chillerControlFn(sandboxProxy.metrics, sandboxProxy.settings)

        // Log the result
        console.log("Logic evaluation result:", result)

        // Check if the result is an object and contains a commands array
        if (result && typeof result === "object" && Array.isArray(result.commands)) {
          // Iterate through the commands array and execute each command
          for (const command of result.commands) {
            if (command && typeof command === "object" && command.type && command.value !== undefined) {
              // In a real implementation, you would execute the command
              console.log(`Would execute command: ${command.type} with value:`, command.value)

              // Update local state for immediate feedback
              const controlKey = command.type.replace(/^update_/, "")
              setControlValues((prev) => ({
                ...prev,
                [controlKey]: command.value,
              }))
            } else {
              console.warn("Invalid command format:", command)
            }
          }
        }

        // Update the logic evaluation state with the result
        setLogicEvaluation({
          result,
          timestamp: Date.now(),
          hasChanges: true,
        })
      } catch (error) {
        // Log the error
        console.error("Logic evaluation error:", error)

        // Update the logic evaluation state with the error
        setLogicEvaluation({
          result: null,
          error: error.message,
          timestamp: Date.now(),
          hasChanges: true,
        })
      }
    } finally {
      isEvaluatingLogicRef.current = false
    }
  }

  // Add auto-evaluation timer
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null

    // If custom logic is enabled, set up auto-evaluation
    if (customLogicEnabled) {
      // Initial evaluation
      evaluateLogic()

      // Set up timer for periodic evaluation (every 15 seconds)
      timer = setInterval(() => {
        evaluateLogic()
      }, 15000)
    }

    // Clean up timer on unmount or when customLogicEnabled changes
    return () => {
      if (timer) {
        clearInterval(timer)
      }
    }
  }, [customLogicEnabled])

  const handleSetpointChange = (key: string, value: any) => {
    // Setpoint changes don't require authentication
    if (key.toLowerCase().includes("setpoint")) {
      setControlValues({
        ...controlValues,
        [key]: value,
      })
    } else {
      // For other controls, require authentication
      setPendingChange({ key, value })
      setShowAuthDialog(true)
    }
  }

  // Replace the handleAuthenticate function with this implementation that checks against Firebase
  const handleAuthenticate = async () => {
    setIsSubmitting(true)
    setLoginError("") // Clear any previous errors

    try {
      // First check if current user has the base required role
      if (!user || !hasRequiredRole()) {
        throw new Error("You do not have permission to modify equipment controls")
      }

      // Try to find user by name first, then by username if not found
      let userDoc = null
      let nameQuery = await getDocs(firestoreQuery(collection(db, "users"), where("name", "==", username)))

      if (nameQuery.empty) {
        // If not found by name, try username
        nameQuery = await getDocs(firestoreQuery(collection(db, "users"), where("username", "==", username)))
      }

      if (nameQuery.empty) {
        throw new Error("Invalid credentials")
      }

      userDoc = nameQuery.docs[0]
      const userData = userDoc.data() as { password?: string; roles?: string[] }

      // Verify password
      if (!userData.password || userData.password !== password) {
        throw new Error("Invalid credentials")
      }

      // Check if the user has one of the required roles (admin, DevOps, or Facilities)
      const userRoles = userData.roles || []
      const allowedRoles = ["admin", "DevOps", "devops", "Facilities", "facilities"]
      const hasRole = userRoles.some((role: string) => allowedRoles.includes(role.toLowerCase()))

      if (!hasRole) {
        throw new Error("User does not have equipment control permissions")
      }

      // Authentication successful
      setIsAuthenticated(true)
      setShowAuthDialog(false)
      setUsername("")
      setPassword("")

      // Apply the pending change if there is one
      if (pendingChange) {
        setControlValues({
          ...controlValues,
          [pendingChange.key]: pendingChange.value,
        })
        setPendingChange(null)
      }

      toast({
        title: "Authentication Successful",
        description: "You can now modify equipment controls",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Authentication failed:", error)
      setLoginError(error instanceof Error ? error.message : "Authentication failed")

      toast({
        title: "Authentication Failed",
        description: error instanceof Error ? error.message : "Authentication failed",
        variant: "destructive",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleApply = () => {
    if (!isAuthenticated && Object.keys(controlValues).some((key) => !key.toLowerCase().includes("setpoint"))) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to apply changes to controls other than setpoints",
        variant: "destructive",
      })
      return
    }

    // Send control values to the equipment via socket.io
    if (socket) {
      socket.emit("control", {
        equipmentId: equipment.id,
        controls: controlValues,
      })

      toast({
        title: "Controls Applied",
        description: "Changes have been applied to the equipment",
        className: "bg-teal-50 border-teal-200",
      })
    } else {
      toast({
        title: "Connection Error",
        description: "Unable to connect to the control system",
        variant: "destructive",
      })
    }
  }

  const handleSave = async () => {
    if (!isAuthenticated && Object.keys(controlValues).some((key) => !key.toLowerCase().includes("setpoint"))) {
      toast({
        title: "Authentication Required",
        description: "Please authenticate to save changes to controls other than setpoints",
        variant: "destructive",
      })
      return
    }

    try {
      // In a real application, this would save to your database
      toast({
        title: "Controls Saved",
        description: "Changes have been saved and applied to the equipment",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error saving controls:", error)
      toast({
        title: "Save Error",
        description: "Failed to save control settings",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="general">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="compressor">Compressor</TabsTrigger>
          <TabsTrigger value="condenser">Condenser</TabsTrigger>
          <TabsTrigger value="js-logic">JS Logic</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>General Controls</CardTitle>
              <CardDescription>Basic operation controls for the chiller</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="unit-enable">Unit Enable</Label>
                <Switch
                  id="unit-enable"
                  checked={controlValues.unitEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("unitEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="mode">Operation Mode</Label>
                  <select
                    id="mode"
                    className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={controlValues.operationMode || "auto"}
                    onChange={(e) => handleSetpointChange("operationMode", e.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="cooling">Cooling</option>
                    <option value="ice-making">Ice Making</option>
                    <option value="standby">Standby</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="chilled-water-setpoint">Chilled Water Setpoint (°F)</Label>
                  <span className="text-sm">{controlValues.chilledWaterSetpoint || 44}°F</span>
                </div>
                <Slider
                  id="chilled-water-setpoint"
                  min={36}
                  max={55}
                  step={0.5}
                  value={[controlValues.chilledWaterSetpoint || 44]}
                  onValueChange={(value) => handleSetpointChange("chilledWaterSetpoint", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="demand-limit">Demand Limit (%)</Label>
                  <span className="text-sm">{controlValues.demandLimit || 100}%</span>
                </div>
                <Slider
                  id="demand-limit"
                  min={20}
                  max={100}
                  step={5}
                  value={[controlValues.demandLimit || 100]}
                  onValueChange={(value) => handleSetpointChange("demandLimit", value[0])}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="compressor" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Compressor Controls</CardTitle>
              <CardDescription>Control settings for compressor operation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="compressor-enable">Compressor Enable</Label>
                <Switch
                  id="compressor-enable"
                  checked={controlValues.compressorEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("compressorEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="compressor-min-run-time">Minimum Run Time (minutes)</Label>
                  <span className="text-sm">{controlValues.compressorMinRunTime || 5} min</span>
                </div>
                <Slider
                  id="compressor-min-run-time"
                  min={1}
                  max={30}
                  step={1}
                  value={[controlValues.compressorMinRunTime || 5]}
                  onValueChange={(value) => handleSetpointChange("compressorMinRunTime", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="compressor-min-off-time">Minimum Off Time (minutes)</Label>
                  <span className="text-sm">{controlValues.compressorMinOffTime || 5} min</span>
                </div>
                <Slider
                  id="compressor-min-off-time"
                  min={1}
                  max={30}
                  step={1}
                  value={[controlValues.compressorMinOffTime || 5]}
                  onValueChange={(value) => handleSetpointChange("compressorMinOffTime", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="compressor-load-limit">Compressor Load Limit (%)</Label>
                  <span className="text-sm">{controlValues.compressorLoadLimit || 100}%</span>
                </div>
                <Slider
                  id="compressor-load-limit"
                  min={20}
                  max={100}
                  step={5}
                  value={[controlValues.compressorLoadLimit || 100]}
                  onValueChange={(value) => handleSetpointChange("compressorLoadLimit", value[0])}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="condenser" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Condenser Controls</CardTitle>
              <CardDescription>Control settings for condenser operation</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="condenser-fan-enable">Condenser Fan Enable</Label>
                <Switch
                  id="condenser-fan-enable"
                  checked={controlValues.condenserFanEnable === true}
                  onCheckedChange={(checked) => handleSetpointChange("condenserFanEnable", checked)}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="condenser-fan-speed">Condenser Fan Speed (%)</Label>
                  <span className="text-sm">{controlValues.condenserFanSpeed || 100}%</span>
                </div>
                <Slider
                  id="condenser-fan-speed"
                  min={0}
                  max={100}
                  step={5}
                  value={[controlValues.condenserFanSpeed || 100]}
                  onValueChange={(value) => handleSetpointChange("condenserFanSpeed", value[0])}
                  disabled={!controlValues.condenserFanEnable}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="condenser-pressure-setpoint">Condenser Pressure Setpoint (PSI)</Label>
                  <span className="text-sm">{controlValues.condenserPressureSetpoint || 180} PSI</span>
                </div>
                <Slider
                  id="condenser-pressure-setpoint"
                  min={120}
                  max={250}
                  step={5}
                  value={[controlValues.condenserPressureSetpoint || 180]}
                  onValueChange={(value) => handleSetpointChange("condenserPressureSetpoint", value[0])}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="js-logic" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
            <div className="border rounded-md">
              <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                <h4 className="text-sm font-medium">Live Metrics</h4>
                <span className="text-xs text-green-600 flex items-center">
                  <span className="w-2 h-2 bg-green-500 rounded-full mr-1"></span> Live
                </span>
              </div>
              <div className="p-4 h-[300px] overflow-auto">
                <pre className="text-xs">{JSON.stringify(sandbox.metrics, null, 2)}</pre>
              </div>
            </div>

            <div className="border rounded-md">
              <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center">
                <h4 className="text-sm font-medium">Current Settings</h4>
                <span className="text-xs text-gray-500">Updated: {new Date().toLocaleTimeString()}</span>
              </div>
              <div className="p-4 h-[300px] overflow-auto">
                <pre className="text-xs">{JSON.stringify(sandbox.settings, null, 2)}</pre>
              </div>
            </div>
          </div>

          <div className="mb-4">
            <div className="bg-gray-50 px-4 py-2 border-b flex justify-between items-center border-t border-x rounded-t-md">
              <div className="flex items-center">
                <h4 className="text-sm font-medium">Logic Evaluation</h4>
                {customLogicEnabled ? (
                  <span className="ml-2 text-xs text-teal-600 flex items-center">
                    <span className="w-2 h-2 bg-teal-500 rounded-full mr-1"></span> Auto-Sync Enabled
                  </span>
                ) : (
                  <span className="ml-2 text-xs text-gray-500 flex items-center">
                    <span className="w-2 h-2 bg-gray-400 rounded-full mr-1"></span> Auto-Sync Disabled
                  </span>
                )}
              </div>
              <div className="flex items-center">
                <span className="text-xs text-gray-500 mr-2">
                  Last Run:{" "}
                  {logicEvaluation?.timestamp ? new Date(logicEvaluation.timestamp).toLocaleTimeString() : "Never"}
                </span>
                <Button size="sm" onClick={evaluateLogic}>
                  Run Logic Now
                </Button>
              </div>
            </div>

            <div className="border-x border-b rounded-b-md p-4">
              <h5 className="text-sm font-medium mb-2">Evaluation Result:</h5>
              {logicEvaluation?.error ? (
                <p className="text-red-500 text-sm">{logicEvaluation.error}</p>
              ) : (
                <pre className="text-xs overflow-auto max-h-[300px] p-4 bg-gray-900 text-gray-100 border rounded">
                  {logicEvaluation?.result
                    ? JSON.stringify(logicEvaluation.result, null, 2)
                    : "No evaluation results yet"}
                </pre>
              )}
            </div>
          </div>

          <div className="border rounded-md mb-6">
            <div className="bg-gray-50 px-4 py-2 border-b">
              <h4 className="text-sm font-medium">Debug Information</h4>
            </div>
            <div className="p-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm mb-1">H2O Supply Temperature:</p>
                  <p className="text-sm font-medium">{sandbox.metrics["H2O Supply Temperature"] || "N/A"}°F</p>
                </div>
                <div>
                  <p className="text-sm mb-1">H2O Return Temperature:</p>
                  <p className="text-sm font-medium">{sandbox.metrics["H2O Return Temperature"] || "N/A"}°F</p>
                </div>
                <div>
                  <p className="text-sm mb-1">Outdoor Air Temperature:</p>
                  <p className="text-sm font-medium">{sandbox.metrics["Outdoor Air Temperature"] || "N/A"}°F</p>
                </div>
                <div>
                  <p className="text-sm mb-1">CW Pump 1 Status:</p>
                  <p className="text-sm font-medium">{sandbox.metrics["CW Pump 1 Status"] || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm mb-1">CW Pump 2 Status:</p>
                  <p className="text-sm font-medium">{sandbox.metrics["CW Pump 2 Status"] || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm mb-1">Chiller Enable:</p>
                  <p className="text-sm font-medium">{sandbox.metrics["Chiller 2 Enable"] || "N/A"}</p>
                </div>
                <div>
                  <p className="text-sm mb-1">Setpoint:</p>
                  <p className="text-sm font-medium">{controlValues.chilledWaterSetpoint || "44"}°F</p>
                </div>
                <div>
                  <p className="text-sm mb-1">Operation Mode:</p>
                  <p className="text-sm font-medium">{controlValues.operationMode || "auto"}</p>
                </div>
                <div>
                  <p className="text-sm mb-1">Compressor Status:</p>
                  <p className="text-sm font-medium">{controlValues.compressorEnable ? "Enabled" : "Disabled"}</p>
                </div>
                <div>
                  <p className="text-sm mb-1">Condenser Fan:</p>
                  <p className="text-sm font-medium">
                    {controlValues.condenserFanSpeed || "0"}%{" "}
                    {controlValues.condenserFanEnable ? "(active)" : "(inactive)"}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Custom Logic</CardTitle>
              <CardDescription>Enable and edit custom control logic</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="custom-logic-enable">Custom Logic Enable</Label>
                <Switch
                  id="custom-logic-enable"
                  checked={customLogicEnabled}
                  onCheckedChange={(checked) => {
                    setCustomLogicEnabled(checked)
                  }}
                />
              </div>

              {customLogicEnabled && (
                <div className="space-y-2">
                  <Label htmlFor="custom-logic">Custom Logic Code</Label>
                  <Editor
                    height="400px"
                    defaultLanguage="javascript"
                    value={customLogic}
                    onChange={(value) => {
                      if (value) {
                        setCustomLogic(value)
                      }
                    }}
                  />
                  <div className="flex space-x-2">
                    <Button onClick={evaluateLogic} className="flex-1">
                      Evaluate Logic
                    </Button>
                    <Button
                      onClick={handleSave}
                      className="flex-1 bg-teal-600 hover:bg-teal-700"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <span className="flex items-center justify-center">
                          <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </span>
                      ) : (
                        "Save & Apply"
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end space-x-4">
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline">Apply Changes</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Apply Control Changes</AlertDialogTitle>
              <AlertDialogDescription>
                This will apply the current control settings to the equipment. The changes will not be saved
                permanently.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleApply}>Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button>Save & Apply</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Save Control Changes</AlertDialogTitle>
              <AlertDialogDescription>
                This will save the current control settings and apply them to the equipment. The changes will be
                permanent.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={handleSave}>Save & Apply</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      {/* Authentication Dialog */}
      <Dialog open={showAuthDialog} onOpenChange={setShowAuthDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Authentication Required</DialogTitle>
            <DialogDescription>Please authenticate to modify equipment controls other than setpoints</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="auth-username" className="text-right">
                Username
              </Label>
              <Input
                id="auth-username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="col-span-3"
              />
            </div>
            <div className="grid grid-cols-4 items-center gap-4">
              <Label htmlFor="auth-password" className="text-right">
                Password
              </Label>
              <Input
                id="auth-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="col-span-3"
              />
            </div>
            {loginError && (
              <div className="col-span-4 text-center">
                <p className="text-sm text-red-500">{loginError}</p>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAuthenticate} disabled={isSubmitting}>
              {isSubmitting ? (
                <span className="flex items-center">
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Authenticating...
                </span>
              ) : (
                "Authenticate"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
