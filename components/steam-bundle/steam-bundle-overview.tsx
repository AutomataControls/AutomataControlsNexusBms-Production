"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import { useSocket } from "@/lib/socket-context"
import { Settings, ArrowLeft, Gauge, Thermometer, Droplets, Eye } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { SteamBundleControls } from "@/components/equipment-controls/steam-bundle-controls"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { SteamBundleVisualization } from "@/components/steam-bundle"

export function SteamBundleOverview({ id }: { id: string }) {
  const [steamBundle, setSteamBundle] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const [relatedEquipment, setRelatedEquipment] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { db } = useFirebase()
  const { socket } = useSocket()
  const router = useRouter()

  // Fetch steam bundle data
  useEffect(() => {
    const fetchData = async () => {
      if (!db || !id) return

      setLoading(true)

      try {
        const steamBundleDoc = await db.collection("equipment").doc(id).get()

        if (steamBundleDoc.exists) {
          const steamBundleData = { id: steamBundleDoc.id, ...steamBundleDoc.data() }
          setSteamBundle(steamBundleData)

          // Fetch location data
          if (steamBundleData.locationId) {
            const locationDoc = await db.collection("locations").doc(steamBundleData.locationId).get()
            if (locationDoc.exists) {
              setLocation({ id: locationDoc.id, ...locationDoc.data() })
            }
          }

          // Fetch all related equipment for this steam bundle (pumps, valves, sensors)
          const equipmentRef = db.collection("equipment").where("parentId", "==", id)
          const snapshot = await equipmentRef.get()

          const equipmentData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))

          setRelatedEquipment(equipmentData)
        }
      } catch (error) {
        console.error("Error fetching steam bundle data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [db, id])

  // Listen for MQTT messages via socket.io
  useEffect(() => {
    if (!socket || !steamBundle) return

    const handleMqttMessage = (message: any) => {
      if (message.equipmentId === steamBundle.id) {
        // Update steam bundle data with incoming data
        setSteamBundle((prev: any) => ({
          ...prev,
          ...message.data,
        }))
      } else if (relatedEquipment.some((eq) => eq.id === message.equipmentId)) {
        // Update related equipment data
        setRelatedEquipment((prev) =>
          prev.map((eq) => (eq.id === message.equipmentId ? { ...eq, ...message.data } : eq)),
        )
      }
    }

    socket.on("mqtt_message", handleMqttMessage)

    return () => {
      socket.off("mqtt_message", handleMqttMessage)
    }
  }, [socket, steamBundle, relatedEquipment])

  if (loading) {
    return <div>Loading steam bundle data...</div>
  }

  if (!steamBundle) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Steam Bundle Not Found</CardTitle>
          <CardDescription>The selected steam bundle could not be found. It may have been deleted.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  // Find pumps in related equipment
  const pumps = relatedEquipment.filter((eq) => eq.type === "pump")
  const pump1 = pumps.find((p) => p.name.includes("1") || p.name.toLowerCase().includes("one"))
  const pump2 = pumps.find((p) => p.name.includes("2") || p.name.toLowerCase().includes("two"))

  // Find valves in related equipment
  const valves = relatedEquipment.filter((eq) => eq.type === "valve" || eq.type === "actuator")
  const valve13 = valves.find((v) => v.name.includes("1/3"))
  const valve23 = valves.find((v) => v.name.includes("2/3"))
  const valve33 = valves.find((v) => v.name.includes("3/3"))
  const valve43 = valves.find((v) => v.name.includes("4/3"))

  // Find differential pressure sensor
  const diffPressureSensor = relatedEquipment.find(
    (eq) =>
      eq.type === "pressure sensor" &&
      (eq.name.toLowerCase().includes("diff") || eq.name.toLowerCase().includes("differential")),
  )

  const controls = steamBundle.controls || {}

  // Prepare visualization controls from the data
  const visualizationControls = {
    systemEnable: controls.systemEnable || false,
    operationMode: controls.operationMode || "auto",
    pressureSetpoint: controls.pressureSetpoint || 30,
    temperatureSetpoint: controls.temperatureSetpoint || 180,
    differentialPressureSetpoint: controls.differentialPressureSetpoint || 5,

    // Valves for HX-1
    valve13Enable: controls.valve13Enable || false,
    valve13Position: controls.valve13Position || 0,
    valve13Mode: controls.valve13Mode || "auto",
    valve23Enable: controls.valve23Enable || false,
    valve23Position: controls.valve23Position || 0,
    valve23Mode: controls.valve23Mode || "auto",

    // Valves for HX-2
    valve33Enable: controls.valve33Enable || false,
    valve33Position: controls.valve33Position || 0,
    valve33Mode: controls.valve33Mode || "auto",
    valve43Enable: controls.valve43Enable || false,
    valve43Position: controls.valve43Position || 0,
    valve43Mode: controls.valve43Mode || "auto",

    valveControlStrategy: controls.valveControlStrategy || "sequential",

    // Pumps
    pump1Enable: controls.pump1Enable || false,
    pump1Speed: controls.pump1Speed || 0,
    pump1Mode: controls.pump1Mode || "auto",
    pump1Status: controls.pump1Status || "stopped",
    pump1IsLead: controls.pump1IsLead || true,
    pump2Enable: controls.pump2Enable || false,
    pump2Speed: controls.pump2Speed || 0,
    pump2Mode: controls.pump2Mode || "auto",
    pump2Status: controls.pump2Status || "stopped",
    pumpControlMode: controls.pumpControlMode || "auto",
    leadLagAutoChangeover: controls.leadLagAutoChangeover || true,
  }

  // Prepare sensor data for visualization
  const visualizationSensorData = {
    temperature: controls.temperature || 70,
    pressure: controls.pressure || diffPressureSensor?.currentValue || 0,
    differentialPressure: controls.differentialPressure || 0,
    flow: controls.flow || 0,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">{steamBundle.name}</h1>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="visualization">
            <Eye className="mr-2 h-4 w-4" />
            Visualization
          </TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Gauge className="h-5 w-5 mr-2 text-blue-500" />
                  Pressure
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">
                  {diffPressureSensor?.currentValue || controls.differentialPressure || 0} PSI
                </div>
                <div className="mt-2">
                  <Progress
                    value={((diffPressureSensor?.currentValue || controls.differentialPressure || 0) / 20) * 100}
                    className="h-2"
                  />
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Setpoint: {controls.differentialPressureSetpoint || 5} PSI
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Thermometer className="h-5 w-5 mr-2 text-red-500" />
                  Temperature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{controls.temperature || 180}°F</div>
                <div className="mt-2">
                  <Progress value={((controls.temperature || 180) / 250) * 100} className="h-2" />
                </div>
                <div className="mt-2 text-sm text-muted-foreground">
                  Setpoint: {controls.temperatureSetpoint || 180}°F
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Droplets className="h-5 w-5 mr-2 text-blue-500" />
                  System Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center space-x-2">
                  <Badge
                    variant={controls.systemEnable ? "default" : "outline"}
                    className={controls.systemEnable ? "bg-green-500" : ""}
                  >
                    {controls.systemEnable ? "Running" : "Stopped"}
                  </Badge>
                  <span className="text-sm text-muted-foreground">Mode: {controls.operationMode || "Auto"}</span>
                </div>
                <div className="mt-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span>Valve 1/3:</span>
                    <span>{controls.valve13Position || valve13?.position || 0}%</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span>Valve 2/3:</span>
                    <span>{controls.valve23Position || valve23?.position || 0}%</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Pump Status</CardTitle>
                <CardDescription>Current status of circulation pumps</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span>Pump 1:</span>
                      <Badge
                        variant={controls.pump1Status === "running" ? "default" : "outline"}
                        className={
                          controls.pump1Status === "running"
                            ? "bg-green-500"
                            : controls.pump1Status === "fault"
                              ? "bg-red-500"
                              : ""
                        }
                      >
                        {controls.pump1Status === "running"
                          ? "Running"
                          : controls.pump1Status === "fault"
                            ? "Fault"
                            : "Stopped"}
                      </Badge>
                      {controls.pump1IsLead && (
                        <Badge variant="outline" className="ml-2">
                          Lead
                        </Badge>
                      )}
                    </div>
                    <span>{controls.pump1Speed || pump1?.speed || 0}%</span>
                  </div>

                  <Progress value={controls.pump1Speed || pump1?.speed || 0} className="h-2" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span>Pump 2:</span>
                      <Badge
                        variant={controls.pump2Status === "running" ? "default" : "outline"}
                        className={
                          controls.pump2Status === "running"
                            ? "bg-green-500"
                            : controls.pump2Status === "fault"
                              ? "bg-red-500"
                              : ""
                        }
                      >
                        {controls.pump2Status === "running"
                          ? "Running"
                          : controls.pump2Status === "fault"
                            ? "Fault"
                            : "Stopped"}
                      </Badge>
                      {!controls.pump1IsLead && (
                        <Badge variant="outline" className="ml-2">
                          Lead
                        </Badge>
                      )}
                    </div>
                    <span>{controls.pump2Speed || pump2?.speed || 0}%</span>
                  </div>

                  <Progress value={controls.pump2Speed || pump2?.speed || 0} className="h-2" />

                  <div className="pt-2 text-sm text-muted-foreground">
                    <div>Auto Changeover: {controls.leadLagAutoChangeover ? "Enabled" : "Disabled"}</div>
                    <div>Auto Failover: {controls.autoFailover ? "Enabled" : "Disabled"}</div>
                    {controls.leadLagAutoChangeover && (
                      <div>Changeover Time: {controls.changeoverTime || 24} hours</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Valve Status</CardTitle>
                <CardDescription>Current status of control valves</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span>1/3 Valve:</span>
                      <Badge
                        variant={controls.valve13Enable ? "default" : "outline"}
                        className={controls.valve13Enable ? "bg-green-500" : ""}
                      >
                        {controls.valve13Enable ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <span>{controls.valve13Position || valve13?.position || 0}%</span>
                  </div>

                  <Progress value={controls.valve13Position || valve13?.position || 0} className="h-2" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <span>2/3 Valve:</span>
                      <Badge
                        variant={controls.valve23Enable ? "default" : "outline"}
                        className={controls.valve23Enable ? "bg-green-500" : ""}
                      >
                        {controls.valve23Enable ? "Enabled" : "Disabled"}
                      </Badge>
                    </div>
                    <span>{controls.valve23Position || valve23?.position || 0}%</span>
                  </div>

                  <Progress value={controls.valve23Position || valve23?.position || 0} className="h-2" />

                  <div className="pt-2 text-sm text-muted-foreground">
                    <div>Valve Control Strategy: {controls.valveControlStrategy || "Sequential"}</div>
                    <div>Valve Response Time: {controls.valveResponseTime || 15} seconds</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Setpoints</CardTitle>
              <CardDescription>Current control setpoints for the steam bundle</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <span>Temperature Setpoint</span>
                  <span className="font-medium">{controls.temperatureSetpoint || 180}°F</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Pressure Setpoint</span>
                  <span className="font-medium">{controls.pressureSetpoint || 30} PSI</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Differential Pressure Setpoint</span>
                  <span className="font-medium">{controls.differentialPressureSetpoint || 5} PSI</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="visualization" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Steam Bundle Visualization</CardTitle>
              <CardDescription>Interactive 3D visualization of the steam bundle system</CardDescription>
            </CardHeader>
            <CardContent>
              <SteamBundleVisualization controls={visualizationControls} sensorData={visualizationSensorData} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="pt-4">
          <SteamBundleControls equipment={steamBundle} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

