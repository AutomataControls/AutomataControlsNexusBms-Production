"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import { useSocket } from "@/lib/socket-context"
import { Settings, ArrowLeft, Thermometer, Droplets, Sun, Fan, Flame } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { GreenhouseControls } from "@/components/equipment-controls/greenhouse-controls"
import { GreenhouseAnalytics } from "@/components/greenhouse/greenhouse-analytics"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"

export function GreenhouseOverview({ id }: { id: string }) {
  const [greenhouse, setGreenhouse] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const [greenhouseEquipment, setGreenhouseEquipment] = useState<any[]>([])
  const [sensorData, setSensorData] = useState<any>({
    temperature: { avg: 0, values: [] },
    humidity: { avg: 0, values: [] },
    uvIndex: 0,
  })
  const [loading, setLoading] = useState(true)
  const { db } = useFirebase()
  const { socket } = useSocket()
  const router = useRouter()

  // Fetch greenhouse data
  useEffect(() => {
    const fetchData = async () => {
      if (!db || !id) return

      setLoading(true)

      try {
        const greenhouseDoc = await db.collection("equipment").doc(id).get()

        if (greenhouseDoc.exists) {
          const greenhouseData = { id: greenhouseDoc.id, ...greenhouseDoc.data() }
          setGreenhouse(greenhouseData)

          // Fetch location data
          if (greenhouseData.locationId) {
            const locationDoc = await db.collection("locations").doc(greenhouseData.locationId).get()
            if (locationDoc.exists) {
              setLocation({ id: locationDoc.id, ...locationDoc.data() })
            }
          }

          // Fetch all equipment for this greenhouse
          const equipmentRef = db.collection("equipment").where("locationId", "==", greenhouseData.locationId)
          const snapshot = await equipmentRef.get()

          const equipmentData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))

          setGreenhouseEquipment(equipmentData)

          // Initialize sensor data
          const tempSensors = equipmentData.filter((eq) => eq.type === "temperature sensor")
          const humiditySensors = equipmentData.filter((eq) => eq.type === "humidity sensor")
          const uvSensor = equipmentData.find((eq) => eq.type === "uv sensor")

          const tempValues = tempSensors.map((sensor) => sensor.currentValue || 0)
          const humidityValues = humiditySensors.map((sensor) => sensor.currentValue || 0)

          setSensorData({
            temperature: {
              avg: tempValues.length ? tempValues.reduce((a, b) => a + b, 0) / tempValues.length : 0,
              values: tempValues,
            },
            humidity: {
              avg: humidityValues.length ? humidityValues.reduce((a, b) => a + b, 0) / humidityValues.length : 0,
              values: humidityValues,
            },
            uvIndex: uvSensor?.currentValue || 0,
          })
        }
      } catch (error) {
        console.error("Error fetching greenhouse data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [db, id])

  // Listen for MQTT messages via socket.io
  useEffect(() => {
    if (!socket || !greenhouseEquipment.length) return

    const handleMqttMessage = (message: any) => {
      // Check if the message is for any of our equipment
      const equipment = greenhouseEquipment.find((eq) => eq.id === message.equipmentId)

      if (equipment) {
        // Update equipment data
        setGreenhouseEquipment((prev) =>
          prev.map((eq) => (eq.id === message.equipmentId ? { ...eq, ...message.data } : eq)),
        )

        // Update sensor data if needed
        if (equipment.type === "temperature sensor") {
          setSensorData((prev) => {
            const newValues = [...prev.temperature.values]
            const index = greenhouseEquipment.findIndex((eq) => eq.id === message.equipmentId)
            if (index >= 0 && index < newValues.length) {
              newValues[index] = message.data.currentValue || 0
            }
            const avg = newValues.reduce((a, b) => a + b, 0) / newValues.length
            return {
              ...prev,
              temperature: { avg, values: newValues },
            }
          })
        } else if (equipment.type === "humidity sensor") {
          setSensorData((prev) => {
            const newValues = [...prev.humidity.values]
            const index = greenhouseEquipment.findIndex((eq) => eq.id === message.equipmentId)
            if (index >= 0 && index < newValues.length) {
              newValues[index] = message.data.currentValue || 0
            }
            const avg = newValues.reduce((a, b) => a + b, 0) / newValues.length
            return {
              ...prev,
              humidity: { avg, values: newValues },
            }
          })
        } else if (equipment.type === "uv sensor") {
          setSensorData((prev) => ({
            ...prev,
            uvIndex: message.data.currentValue || 0,
          }))
        }
      }
    }

    socket.on("mqtt_message", handleMqttMessage)

    return () => {
      socket.off("mqtt_message", handleMqttMessage)
    }
  }, [socket, greenhouseEquipment])

  if (loading) {
    return <div>Loading greenhouse data...</div>
  }

  if (!greenhouse) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Greenhouse Not Found</CardTitle>
          <CardDescription>The selected greenhouse could not be found. It may have been deleted.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">{greenhouse.name}</h1>
        </div>
        <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4 pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Thermometer className="h-5 w-5 mr-2 text-orange-500" />
                  Temperature
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sensorData.temperature.avg.toFixed(1)}°F</div>
                <div className="mt-2 space-y-1">
                  {sensorData.temperature.values.map((value: number, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span>Sensor {index + 1}</span>
                      <span>{value.toFixed(1)}°F</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Droplets className="h-5 w-5 mr-2 text-blue-500" />
                  Humidity
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sensorData.humidity.avg.toFixed(1)}%</div>
                <div className="mt-2">
                  <Progress value={sensorData.humidity.avg} className="h-2" />
                </div>
                <div className="mt-2 space-y-1">
                  {sensorData.humidity.values.map((value: number, index: number) => (
                    <div key={index} className="flex items-center justify-between text-sm">
                      <span>Sensor {index + 1}</span>
                      <span>{value.toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center">
                  <Sun className="h-5 w-5 mr-2 text-yellow-500" />
                  UV Index
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{sensorData.uvIndex.toFixed(1)}</div>
                <div className="mt-2">
                  <Progress
                    value={(sensorData.uvIndex / 11) * 100}
                    className="h-2"
                    indicatorClassName={`${
                      sensorData.uvIndex < 3
                        ? "bg-green-500"
                        : sensorData.uvIndex < 6
                          ? "bg-yellow-500"
                          : sensorData.uvIndex < 8
                            ? "bg-orange-500"
                            : "bg-red-500"
                    }`}
                  />
                </div>
                <div className="mt-2">
                  <Badge
                    className={`${
                      sensorData.uvIndex < 3
                        ? "bg-green-500"
                        : sensorData.uvIndex < 6
                          ? "bg-yellow-500"
                          : sensorData.uvIndex < 8
                            ? "bg-orange-500"
                            : "bg-red-500"
                    }`}
                  >
                    {sensorData.uvIndex < 3
                      ? "Low"
                      : sensorData.uvIndex < 6
                        ? "Moderate"
                        : sensorData.uvIndex < 8
                          ? "High"
                          : "Very High"}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Fan className="h-5 w-5 mr-2 text-blue-500" />
                  Ventilation Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span>Exhaust Fan 1</span>
                      <Badge variant={greenhouse.controls?.exhaustFan1Enable ? "default" : "outline"}>
                        {greenhouse.controls?.exhaustFan1Enable ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Exhaust Fan 2</span>
                      <Badge variant={greenhouse.controls?.exhaustFan2Enable ? "default" : "outline"}>
                        {greenhouse.controls?.exhaustFan2Enable ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Supply Fan</span>
                      <Badge variant={greenhouse.controls?.supplyFanEnable ? "default" : "outline"}>
                        {greenhouse.controls?.supplyFanEnable ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Ridge Vent</span>
                      <Badge variant={greenhouse.controls?.ridgeVentEnable ? "default" : "outline"}>
                        {greenhouse.controls?.ridgeVentEnable
                          ? `${greenhouse.controls.ridgeVentPosition || 0}%`
                          : "Closed"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Side Panel Vent</span>
                      <Badge variant={greenhouse.controls?.sideVentEnable ? "default" : "outline"}>
                        {greenhouse.controls?.sideVentEnable
                          ? `${greenhouse.controls.sideVentPosition || 0}%`
                          : "Closed"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Flame className="h-5 w-5 mr-2 text-red-500" />
                  Heating Status
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center justify-between">
                      <span>Hanging Heater 1 (NE)</span>
                      <Badge variant={greenhouse.controls?.hangingHeater1Enable ? "default" : "outline"}>
                        {greenhouse.controls?.hangingHeater1Enable ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Hanging Heater 2 (NW)</span>
                      <Badge variant={greenhouse.controls?.hangingHeater2Enable ? "default" : "outline"}>
                        {greenhouse.controls?.hangingHeater2Enable ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Hanging Heater 3 (SE)</span>
                      <Badge variant={greenhouse.controls?.hangingHeater3Enable ? "default" : "outline"}>
                        {greenhouse.controls?.hangingHeater3Enable ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Hanging Heater 4 (SW)</span>
                      <Badge variant={greenhouse.controls?.hangingHeater4Enable ? "default" : "outline"}>
                        {greenhouse.controls?.hangingHeater4Enable ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Floor Heater 1</span>
                      <Badge variant={greenhouse.controls?.floorHeater1Enable ? "default" : "outline"}>
                        {greenhouse.controls?.floorHeater1Enable ? "On" : "Off"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span>Floor Heater 2</span>
                      <Badge variant={greenhouse.controls?.floorHeater2Enable ? "default" : "outline"}>
                        {greenhouse.controls?.floorHeater2Enable ? "On" : "Off"}
                      </Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Setpoints</CardTitle>
              <CardDescription>Current control setpoints for the greenhouse</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between">
                  <span>Temperature Setpoint</span>
                  <span className="font-medium">{greenhouse.controls?.temperatureSetpoint || 75}°F</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Humidity Setpoint</span>
                  <span className="font-medium">{greenhouse.controls?.humiditySetpoint || 60}%</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Climate Control Mode</span>
                  <Badge>{greenhouse.controls?.climateControlMode || "Auto"}</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="controls" className="pt-4">
          <GreenhouseControls equipment={greenhouse} />
        </TabsContent>

        <TabsContent value="analytics" className="pt-4">
          <GreenhouseAnalytics equipment={greenhouse} greenhouseEquipment={greenhouseEquipment} />
        </TabsContent>
      </Tabs>
    </div>
  )
}

