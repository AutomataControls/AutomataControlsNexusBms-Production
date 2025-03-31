"use client"

import { useState, useEffect } from "react"
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
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { Thermometer, Fan, Flame } from "lucide-react"
import { GreenhouseVisualization } from "@/components/greenhouse/greenhouse-visualization"
import { collection, query, where, getDocs } from "firebase/firestore"

interface GreenhouseControlsProps {
  equipment: any
}

export function GreenhouseControls({ equipment }: GreenhouseControlsProps) {
  const [controlValues, setControlValues] = useState<any>({
    ...equipment.controls,
  })
  const [greenhouseEquipment, setGreenhouseEquipment] = useState<any[]>([])
  const [username, setUsername] = useState<string>("")
  const [password, setPassword] = useState<string>("")
  const [showAuthDialog, setShowAuthDialog] = useState<boolean>(false)
  const [pendingChange, setPendingChange] = useState<{ key: string; value: any } | null>(null)
  const [loginError, setLoginError] = useState<string>("")
  
  const { socket } = useSocket()
  const { toast } = useToast()
  const { db } = useFirebase()
  const { user, loginWithUsername } = useAuth()

  // Check if user is authorized to modify controls
  const isAuthorized = () => {
    if (!user) return false;
    // Check if user has admin role or technician role
    return user.roles.some(role => ['admin', 'technician', 'engineer'].includes(role.toLowerCase()));
  }

  // Fetch all greenhouse equipment
  useEffect(() => {
    const fetchGreenhouseEquipment = async () => {
      if (!db || !equipment.locationId) return

      try {
        const equipmentCollection = collection(db, "equipment")
        const equipmentQuery = query(equipmentCollection, where("locationId", "==", equipment.locationId))
        const snapshot = await getDocs(equipmentQuery)

        const equipmentData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setGreenhouseEquipment(equipmentData)
      } catch (error) {
        console.error("Error fetching greenhouse equipment:", error)
      }
    }

    fetchGreenhouseEquipment()
  }, [db, equipment.locationId])

  // Listen for MQTT messages via socket.io
  useEffect(() => {
    if (!socket) return

    const handleMqttMessage = (message: any) => {
      if (message.equipmentId === equipment.id) {
        // Update control values with incoming data
        setControlValues((prevValues) => ({
          ...prevValues,
          ...message.data,
        }))
      }
    }

    socket.on("mqtt_message", handleMqttMessage)

    return () => {
      socket.off("mqtt_message", handleMqttMessage)
    }
  }, [socket, equipment.id])

  const handleSetpointChange = (key: string, value: any) => {
    // Setpoint changes don't require authentication
    if (key.toLowerCase().includes("setpoint")) {
      setControlValues({
        ...controlValues,
        [key]: value,
      })
    } else {
      // For other controls, require authentication
      if (isAuthorized()) {
        // User is already authenticated
        setControlValues({
          ...controlValues,
          [key]: value,
        })
      } else {
        // Need to authenticate
        setPendingChange({ key, value })
        setShowAuthDialog(true)
      }
    }
  }

  const handleAuthenticate = async () => {
    setLoginError("");
    
    try {
      await loginWithUsername(username, password);
      setShowAuthDialog(false);
      
      // Apply the pending change if there is one
      if (pendingChange) {
        setControlValues({
          ...controlValues,
          [pendingChange.key]: pendingChange.value,
        });
        setPendingChange(null);
      }
      
      toast({
        title: "Authentication Successful",
        description: "You can now modify equipment controls",
        className: "bg-teal-50 border-teal-200",
      });
    } catch (error) {
      console.error("Authentication error:", error);
      setLoginError("Invalid username or password");
      toast({
        title: "Authentication Failed",
        description: "Invalid username or password",
        variant: "destructive",
      });
    }
  }

  const handleApply = () => {
    if (!isAuthorized() && Object.keys(controlValues).some((key) => !key.toLowerCase().includes("setpoint"))) {
      toast({
        title: "Authentication Required",
        description: "Please login to apply changes to controls other than setpoints",
        variant: "destructive",
      })
      setShowAuthDialog(true);
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
    if (!isAuthorized() && Object.keys(controlValues).some((key) => !key.toLowerCase().includes("setpoint"))) {
      toast({
        title: "Authentication Required",
        description: "Please login to save changes to controls other than setpoints",
        variant: "destructive",
      })
      setShowAuthDialog(true);
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
      <Tabs defaultValue="visualization">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="visualization">Visualization</TabsTrigger>
          <TabsTrigger value="climate">Climate</TabsTrigger>
          <TabsTrigger value="ventilation">Ventilation</TabsTrigger>
          <TabsTrigger value="heating">Heating</TabsTrigger>
          <TabsTrigger value="sensors">Sensors</TabsTrigger>
        </TabsList>

        <TabsContent value="visualization" className="space-y-4 pt-4">
          <GreenhouseVisualization
            controls={controlValues}
            sensorData={{
              temperature: {
                avg:
                  greenhouseEquipment
                    .filter((eq) => eq.type === "temperature sensor")
                    .reduce((sum, sensor) => sum + (sensor.currentValue || 0), 0) /
                  Math.max(1, greenhouseEquipment.filter((eq) => eq.type === "temperature sensor").length),
                values: greenhouseEquipment
                  .filter((eq) => eq.type === "temperature sensor")
                  .map((sensor) => sensor.currentValue || 0),
              },
              humidity: {
                avg:
                  greenhouseEquipment
                    .filter((eq) => eq.type === "humidity sensor")
                    .reduce((sum, sensor) => sum + (sensor.currentValue || 0), 0) /
                  Math.max(1, greenhouseEquipment.filter((eq) => eq.type === "humidity sensor").length),
                values: greenhouseEquipment
                  .filter((eq) => eq.type === "humidity sensor")
                  .map((sensor) => sensor.currentValue || 0),
              },
              uvIndex: greenhouseEquipment.find((eq) => eq.type === "uv sensor")?.currentValue || 0,
            }}
          />
        </TabsContent>

        <TabsContent value="climate" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Thermometer className="mr-2 h-5 w-5 text-orange-500" />
                Climate Controls
              </CardTitle>
              <CardDescription>Temperature and humidity control settings</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="temp-setpoint">Temperature Setpoint (°F)</Label>
                  <span className="text-sm">{controlValues.temperatureSetpoint || 75}°F</span>
                </div>
                <Slider
                  id="temp-setpoint"
                  min={60}
                  max={90}
                  step={0.5}
                  value={[controlValues.temperatureSetpoint || 75]}
                  onValueChange={(value) => handleSetpointChange("temperatureSetpoint", value[0])}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="humidity-setpoint">Humidity Setpoint (%)</Label>
                  <span className="text-sm">{controlValues.humiditySetpoint || 60}%</span>
                </div>
                <Slider
                  id="humidity-setpoint"
                  min={40}
                  max={80}
                  step={1}
                  value={[controlValues.humiditySetpoint || 60]}
                  onValueChange={(value) => handleSetpointChange("humiditySetpoint", value[0])}
                />
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="climate-control-mode">Climate Control Mode</Label>
                <select
                  id="climate-control-mode"
                  className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={controlValues.climateControlMode || "auto"}
                  onChange={(e) => handleSetpointChange("climateControlMode", e.target.value)}
                >
                  <option value="auto">Auto</option>
                  <option value="day">Day Mode</option>
                  <option value="night">Night Mode</option>
                  <option value="manual">Manual</option>
                </select>
              </div>

              <div className="flex items-center justify-between">
                <Label htmlFor="dehumidification">Dehumidification</Label>
                <Switch
                  id="dehumidification"
                  checked={controlValues.dehumidification === true}
                  onCheckedChange={(checked) => handleSetpointChange("dehumidification", checked)}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="ventilation" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Fan className="mr-2 h-5 w-5 text-blue-500" />
                Ventilation Controls
              </CardTitle>
              <CardDescription>Control settings for fans and vents</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="exhaust-fan-1">Exhaust Fan 1</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="exhaust-fan-1"
                      checked={controlValues.exhaustFan1Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("exhaustFan1Enable", checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Speed (%)</span>
                      <span className="text-sm">{controlValues.exhaustFan1Speed || 0}%</span>
                    </div>
                    <Slider
                      id="exhaust-fan-1-speed"
                      min={0}
                      max={100}
                      step={5}
                      value={[controlValues.exhaustFan1Speed || 0]}
                      onValueChange={(value) => handleSetpointChange("exhaustFan1Speed", value[0])}
                      disabled={!controlValues.exhaustFan1Enable}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="exhaust-fan-2">Exhaust Fan 2</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="exhaust-fan-2"
                      checked={controlValues.exhaustFan2Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("exhaustFan2Enable", checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Speed (%)</span>
                      <span className="text-sm">{controlValues.exhaustFan2Speed || 0}%</span>
                    </div>
                    <Slider
                      id="exhaust-fan-2-speed"
                      min={0}
                      max={100}
                      step={5}
                      value={[controlValues.exhaustFan2Speed || 0]}
                      onValueChange={(value) => handleSetpointChange("exhaustFan2Speed", value[0])}
                      disabled={!controlValues.exhaustFan2Enable}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="supply-fan">Supply Fan</Label>
                <div className="flex items-center justify-between">
                  <span>Enable</span>
                  <Switch
                    id="supply-fan"
                    checked={controlValues.supplyFanEnable === true}
                    onCheckedChange={(checked) => handleSetpointChange("supplyFanEnable", checked)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Speed (%)</span>
                    <span className="text-sm">{controlValues.supplyFanSpeed || 0}%</span>
                  </div>
                  <Slider
                    id="supply-fan-speed"
                    min={0}
                    max={100}
                    step={5}
                    value={[controlValues.supplyFanSpeed || 0]}
                    onValueChange={(value) => handleSetpointChange("supplyFanSpeed", value[0])}
                    disabled={!controlValues.supplyFanEnable}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="ridge-vent">Ridge Vent</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="ridge-vent"
                      checked={controlValues.ridgeVentEnable === true}
                      onCheckedChange={(checked) => handleSetpointChange("ridgeVentEnable", checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Position (%)</span>
                      <span className="text-sm">{controlValues.ridgeVentPosition || 0}%</span>
                    </div>
                    <Slider
                      id="ridge-vent-position"
                      min={0}
                      max={100}
                      step={5}
                      value={[controlValues.ridgeVentPosition || 0]}
                      onValueChange={(value) => handleSetpointChange("ridgeVentPosition", value[0])}
                      disabled={!controlValues.ridgeVentEnable}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="side-vent">Side Panel Vent</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="side-vent"
                      checked={controlValues.sideVentEnable === true}
                      onCheckedChange={(checked) => handleSetpointChange("sideVentEnable", checked)}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span>Position (%)</span>
                      <span className="text-sm">{controlValues.sideVentPosition || 0}%</span>
                    </div>
                    <Slider
                      id="side-vent-position"
                      min={0}
                      max={100}
                      step={5}
                      value={[controlValues.sideVentPosition || 0]}
                      onValueChange={(value) => handleSetpointChange("sideVentPosition", value[0])}
                      disabled={!controlValues.sideVentEnable}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="heating" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Flame className="mr-2 h-5 w-5 text-red-500" />
                Heating Controls
              </CardTitle>
              <CardDescription>Control settings for heaters</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="hanging-heater-1">Hanging Heater 1 (NE Corner)</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="hanging-heater-1"
                      checked={controlValues.hangingHeater1Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("hangingHeater1Enable", checked)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hanging-heater-2">Hanging Heater 2 (NW Corner)</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="hanging-heater-2"
                      checked={controlValues.hangingHeater2Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("hangingHeater2Enable", checked)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hanging-heater-3">Hanging Heater 3 (SE Corner)</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="hanging-heater-3"
                      checked={controlValues.hangingHeater3Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("hangingHeater3Enable", checked)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="hanging-heater-4">Hanging Heater 4 (SW Corner)</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="hanging-heater-4"
                      checked={controlValues.hangingHeater4Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("hangingHeater4Enable", checked)}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="floor-heater-1">Floor Heater 1</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="floor-heater-1"
                      checked={controlValues.floorHeater1Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("floorHeater1Enable", checked)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="floor-heater-2">Floor Heater 2</Label>
                  <div className="flex items-center justify-between">
                    <span>Enable</span>
                    <Switch
                      id="floor-heater-2"
                      checked={controlValues.floorHeater2Enable === true}
                      onCheckedChange={(checked) => handleSetpointChange("floorHeater2Enable", checked)}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="heating-mode">Heating Mode</Label>
                  <select
                    id="heating-mode"
                    className="flex h-10 w-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    value={controlValues.heatingMode || "auto"}
                    onChange={(e) => handleSetpointChange("heatingMode", e.target.value)}
                  >
                    <option value="auto">Auto</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="manual">Manual</option>
                    <option value="off">Off</option>
                  </select>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sensors" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Sensor Configuration</CardTitle>
              <CardDescription>Configure sensor settings and calibration</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="temp-sensor-calibration">Temperature Sensor Calibration</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="temp-sensor-1" className="text-sm">
                        Sensor 1 Offset
                      </Label>
                      <Input
                        id="temp-sensor-1"
                        type="number"
                        step="0.1"
                        value={controlValues.tempSensor1Offset || 0}
                        onChange={(e) => handleSetpointChange("tempSensor1Offset", Number.parseFloat(e.target.value))}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="temp-sensor-2" className="text-sm">
                        Sensor 2 Offset
                      </Label>
                      <Input
                        id="temp-sensor-2"
                        type="number"
                        step="0.1"
                        value={controlValues.tempSensor2Offset || 0}
                        onChange={(e) => handleSetpointChange("tempSensor2Offset", Number.parseFloat(e.target.value))}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="temp-sensor-3" className="text-sm">
                        Sensor 3 Offset
                      </Label>
                      <Input
                        id="temp-sensor-3"
                        type="number"
                        step="0.1"
                        value={controlValues.tempSensor3Offset || 0}
                        onChange={(e) => handleSetpointChange("tempSensor3Offset", Number.parseFloat(e.target.value))}
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="temp-sensor-4" className="text-sm">
                        Sensor 4 Offset
                      </Label>
                      <Input
                        id="temp-sensor-4"
                        type="number"
                        step="0.1"
                        value={controlValues.tempSensor4Offset || 0}
                        onChange={(e) => handleSetpointChange("tempSensor4Offset", Number.parseFloat(e.target.value))}
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="humidity-sensor-calibration">Humidity Sensor Calibration</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="humidity-sensor-1" className="text-sm">
                        Sensor 1 Offset
                      </Label>
                      <Input
                        id="humidity-sensor-1"
                        type="number"
                        step="0.1"
                        value={controlValues.humiditySensor1Offset || 0}
                        onChange={(e) =>
                          handleSetpointChange("humiditySensor1Offset", Number.parseFloat(e.target.value))
                        }
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="humidity-sensor-2" className="text-sm">
                        Sensor 2 Offset
                      </Label>
                      <Input
                        id="humidity-sensor-2"
                        type="number"
                        step="0.1"
                        value={controlValues.humiditySensor2Offset || 0}
                        onChange={(e) =>
                          handleSetpointChange("humiditySensor2Offset", Number.parseFloat(e.target.value))
                        }
                        className="h-8"
                      />
                    </div>
                    <div>
                      <Label htmlFor="humidity-sensor-3" className="text-sm">
                        Sensor 3 Offset
                      </Label>
                      <Input
                        id="humidity-sensor-3"
                        type="number"
                        step="0.1"
                        value={controlValues.humiditySensor3Offset || 0}
                        onChange={(e) =>
                          handleSetpointChange("humiditySensor3Offset", Number.parseFloat(e.target.value))
                        }
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-4">
                <Label htmlFor="uv-sensor-calibration">UV Sensor Calibration</Label>
                <div className="flex items-center space-x-4">
                  <Label htmlFor="uv-sensor-offset" className="text-sm">
                    Offset
                  </Label>
                  <Input
                    id="uv-sensor-offset"
                    type="number"
                    step="0.01"
                    value={controlValues.uvSensorOffset || 0}
                    onChange={(e) => handleSetpointChange("uvSensorOffset", Number.parseFloat(e.target.value))}
                    className="h-8 w-24"
                  />

                  <Label htmlFor="uv-sensor-gain" className="text-sm">
                    Gain
                  </Label>
                  <Input
                    id="uv-sensor-gain"
                    type="number"
                    step="0.01"
                    value={controlValues.uvSensorGain || 1}
                    onChange={(e) => handleSetpointChange("uvSensorGain", Number.parseFloat(e.target.value))}
                    className="h-8 w-24"
                  />
                </div>
              </div>
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
            <DialogDescription>Please login to modify equipment controls other than setpoints</DialogDescription>
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
              <div className="col-span-4 text-center text-red-500 text-sm">
                {loginError}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAuthDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAuthenticate}>Login</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}