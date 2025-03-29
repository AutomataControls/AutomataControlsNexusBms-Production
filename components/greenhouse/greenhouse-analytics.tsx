"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useFirebase } from "@/lib/firebase-context"
import { Chart, ChartContainer, ChartTooltip, ChartLegend, ChartLegendItem } from "@/components/ui/chart"
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Line,
  LineChart,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

interface GreenhouseAnalyticsProps {
  equipment: any
  greenhouseEquipment?: any[]
}

export function GreenhouseAnalytics({ equipment, greenhouseEquipment = [] }: GreenhouseAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<string>("24h")
  const [dataType, setDataType] = useState<string>("temperature")
  const [analyticsData, setAnalyticsData] = useState<any[]>([])
  const { db } = useFirebase()

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      if (!db || !equipment.id) return

      try {
        // In a real application, you would fetch actual data from your database
        // For now, we'll generate some sample data
        const now = new Date()
        const data = []

        // Generate data points based on the selected time range
        let points = 24
        let interval = 60 * 60 * 1000 // 1 hour in milliseconds

        switch (timeRange) {
          case "24h":
            points = 24
            interval = 60 * 60 * 1000 // 1 hour
            break
          case "7d":
            points = 7 * 24
            interval = 60 * 60 * 1000 // 1 hour for 7 days
            break
          case "30d":
            points = 30
            interval = 24 * 60 * 60 * 1000 // 1 day
            break
          case "1y":
            points = 12
            interval = 30 * 24 * 60 * 60 * 1000 // 1 month
            break
        }

        // Generate sample data
        for (let i = points - 1; i >= 0; i--) {
          const time = new Date(now.getTime() - i * interval)
          const dataPoint: any = { time: time.toLocaleString() }

          // Generate different data based on the selected data type
          switch (dataType) {
            case "temperature":
              // Simulate day/night cycle for temperature
              const hour = time.getHours()
              const isDaytime = hour >= 6 && hour <= 18
              const baseTemp = isDaytime ? 75 : 68
              const tempVariation = isDaytime ? 5 : 3

              dataPoint.value = baseTemp + (Math.random() * tempVariation * 2 - tempVariation)

              // Add values for each sensor
              for (let j = 1; j <= 4; j++) {
                dataPoint[`sensor${j}`] = dataPoint.value + (Math.random() * 2 - 1)
              }
              break

            case "humidity":
              // Humidity tends to be inverse to temperature
              const baseHumidity = 60
              const humidityVariation = 15

              dataPoint.value = baseHumidity + (Math.random() * humidityVariation * 2 - humidityVariation)

              // Add values for each sensor
              for (let j = 1; j <= 3; j++) {
                dataPoint[`sensor${j}`] = dataPoint.value + (Math.random() * 5 - 2.5)
              }
              break

            case "uvIndex":
              // UV index follows day/night cycle
              const hourUV = time.getHours()
              const isDaytimeUV = hourUV >= 6 && hourUV <= 18

              if (isDaytimeUV) {
                // Peak at noon
                const noonDistance = Math.abs(12 - hourUV)
                const maxUV = 10
                dataPoint.value = maxUV * (1 - noonDistance / 6) * (0.8 + Math.random() * 0.4)
              } else {
                dataPoint.value = 0
              }
              break

            case "energy":
              // Energy usage correlates with heating/cooling needs
              const hourEnergy = time.getHours()
              const isDaytimeEnergy = hourEnergy >= 6 && hourEnergy <= 18
              const baseEnergy = isDaytimeEnergy ? 5 : 8 // More energy at night for heating

              dataPoint.value = baseEnergy + Math.random() * 3
              dataPoint.heating = isDaytimeEnergy ? dataPoint.value * 0.3 : dataPoint.value * 0.7
              dataPoint.ventilation = isDaytimeEnergy ? dataPoint.value * 0.7 : dataPoint.value * 0.3
              break
          }

          // Round values to 1 decimal place
          Object.keys(dataPoint).forEach((key) => {
            if (key !== "time" && typeof dataPoint[key] === "number") {
              dataPoint[key] = Number.parseFloat(dataPoint[key].toFixed(1))
            }
          })

          data.push(dataPoint)
        }

        setAnalyticsData(data)
      } catch (error) {
        console.error("Error fetching analytics data:", error)
      }
    }

    fetchAnalyticsData()
  }, [db, equipment.id, timeRange, dataType])

  const getDataTypeLabel = () => {
    switch (dataType) {
      case "temperature":
        return "Temperature (°F)"
      case "humidity":
        return "Humidity (%)"
      case "uvIndex":
        return "UV Index"
      case "energy":
        return "Energy (kWh)"
      default:
        return "Value"
    }
  }

  const renderChart = (chartType: string) => {
    switch (chartType) {
      case "line":
        return (
          <Card>
            <CardHeader>
              <CardTitle>{getDataTypeLabel()} - Line Chart</CardTitle>
              <CardDescription>
                {equipment.name} - {timeRange} view
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ChartContainer>
                <Chart>
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={analyticsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip content={<ChartTooltip />} />

                      {dataType === "temperature" ? (
                        <>
                          <Line type="monotone" dataKey="value" stroke="#8884d8" name="Average Temperature" />
                          <Line type="monotone" dataKey="sensor1" stroke="#82ca9d" name="Sensor 1" />
                          <Line type="monotone" dataKey="sensor2" stroke="#ffc658" name="Sensor 2" />
                          <Line type="monotone" dataKey="sensor3" stroke="#ff8042" name="Sensor 3" />
                          <Line type="monotone" dataKey="sensor4" stroke="#0088fe" name="Sensor 4" />
                        </>
                      ) : dataType === "humidity" ? (
                        <>
                          <Line type="monotone" dataKey="value" stroke="#8884d8" name="Average Humidity" />
                          <Line type="monotone" dataKey="sensor1" stroke="#82ca9d" name="Sensor 1" />
                          <Line type="monotone" dataKey="sensor2" stroke="#ffc658" name="Sensor 2" />
                          <Line type="monotone" dataKey="sensor3" stroke="#ff8042" name="Sensor 3" />
                        </>
                      ) : dataType === "energy" ? (
                        <>
                          <Line type="monotone" dataKey="value" stroke="#8884d8" name="Total Energy" />
                          <Line type="monotone" dataKey="heating" stroke="#ff8042" name="Heating" />
                          <Line type="monotone" dataKey="ventilation" stroke="#82ca9d" name="Ventilation" />
                        </>
                      ) : (
                        <Line type="monotone" dataKey="value" stroke="#8884d8" name={getDataTypeLabel()} />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </Chart>
                <ChartLegend>
                  {dataType === "temperature" ? (
                    <>
                      <ChartLegendItem name="Average Temperature" color="#8884d8" />
                      <ChartLegendItem name="Sensor 1" color="#82ca9d" />
                      <ChartLegendItem name="Sensor 2" color="#ffc658" />
                      <ChartLegendItem name="Sensor 3" color="#ff8042" />
                      <ChartLegendItem name="Sensor 4" color="#0088fe" />
                    </>
                  ) : dataType === "humidity" ? (
                    <>
                      <ChartLegendItem name="Average Humidity" color="#8884d8" />
                      <ChartLegendItem name="Sensor 1" color="#82ca9d" />
                      <ChartLegendItem name="Sensor 2" color="#ffc658" />
                      <ChartLegendItem name="Sensor 3" color="#ff8042" />
                    </>
                  ) : dataType === "energy" ? (
                    <>
                      <ChartLegendItem name="Total Energy" color="#8884d8" />
                      <ChartLegendItem name="Heating" color="#ff8042" />
                      <ChartLegendItem name="Ventilation" color="#82ca9d" />
                    </>
                  ) : (
                    <ChartLegendItem name={getDataTypeLabel()} color="#8884d8" />
                  )}
                </ChartLegend>
              </ChartContainer>
            </CardContent>
          </Card>
        )

      case "area":
        return (
          <Card>
            <CardHeader>
              <CardTitle>{getDataTypeLabel()} - Area Chart</CardTitle>
              <CardDescription>
                {equipment.name} - {timeRange} view
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ChartContainer>
                <Chart>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={analyticsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip content={<ChartTooltip />} />

                      {dataType === "temperature" ? (
                        <>
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#8884d8"
                            fill="#8884d8"
                            fillOpacity={0.3}
                            name="Average Temperature"
                          />
                          <Area
                            type="monotone"
                            dataKey="sensor1"
                            stroke="#82ca9d"
                            fill="#82ca9d"
                            fillOpacity={0.3}
                            name="Sensor 1"
                          />
                          <Area
                            type="monotone"
                            dataKey="sensor2"
                            stroke="#ffc658"
                            fill="#ffc658"
                            fillOpacity={0.3}
                            name="Sensor 2"
                          />
                          <Area
                            type="monotone"
                            dataKey="sensor3"
                            stroke="#ff8042"
                            fill="#ff8042"
                            fillOpacity={0.3}
                            name="Sensor 3"
                          />
                          <Area
                            type="monotone"
                            dataKey="sensor4"
                            stroke="#0088fe"
                            fill="#0088fe"
                            fillOpacity={0.3}
                            name="Sensor 4"
                          />
                        </>
                      ) : dataType === "humidity" ? (
                        <>
                          <Area
                            type="monotone"
                            dataKey="value"
                            stroke="#8884d8"
                            fill="#8884d8"
                            fillOpacity={0.3}
                            name="Average Humidity"
                          />
                          <Area
                            type="monotone"
                            dataKey="sensor1"
                            stroke="#82ca9d"
                            fill="#82ca9d"
                            fillOpacity={0.3}
                            name="Sensor 1"
                          />
                          <Area
                            type="monotone"
                            dataKey="sensor2"
                            stroke="#ffc658"
                            fill="#ffc658"
                            fillOpacity={0.3}
                            name="Sensor 2"
                          />
                          <Area
                            type="monotone"
                            dataKey="sensor3"
                            stroke="#ff8042"
                            fill="#ff8042"
                            fillOpacity={0.3}
                            name="Sensor 3"
                          />
                        </>
                      ) : dataType === "energy" ? (
                        <>
                          <Area
                            type="monotone"
                            dataKey="heating"
                            stroke="#ff8042"
                            fill="#ff8042"
                            fillOpacity={0.5}
                            name="Heating"
                          />
                          <Area
                            type="monotone"
                            dataKey="ventilation"
                            stroke="#82ca9d"
                            fill="#82ca9d"
                            fillOpacity={0.5}
                            name="Ventilation"
                          />
                        </>
                      ) : (
                        <Area
                          type="monotone"
                          dataKey="value"
                          stroke="#8884d8"
                          fill="#8884d8"
                          fillOpacity={0.3}
                          name={getDataTypeLabel()}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </Chart>
                <ChartLegend>
                  {dataType === "temperature" ? (
                    <>
                      <ChartLegendItem name="Average Temperature" color="#8884d8" />
                      <ChartLegendItem name="Sensor 1" color="#82ca9d" />
                      <ChartLegendItem name="Sensor 2" color="#ffc658" />
                      <ChartLegendItem name="Sensor 3" color="#ff8042" />
                      <ChartLegendItem name="Sensor 4" color="#0088fe" />
                    </>
                  ) : dataType === "humidity" ? (
                    <>
                      <ChartLegendItem name="Average Humidity" color="#8884d8" />
                      <ChartLegendItem name="Sensor 1" color="#82ca9d" />
                      <ChartLegendItem name="Sensor 2" color="#ffc658" />
                      <ChartLegendItem name="Sensor 3" color="#ff8042" />
                    </>
                  ) : dataType === "energy" ? (
                    <>
                      <ChartLegendItem name="Heating" color="#ff8042" />
                      <ChartLegendItem name="Ventilation" color="#82ca9d" />
                    </>
                  ) : (
                    <ChartLegendItem name={getDataTypeLabel()} color="#8884d8" />
                  )}
                </ChartLegend>
              </ChartContainer>
            </CardContent>
          </Card>
        )

      case "bar":
        return (
          <Card>
            <CardHeader>
              <CardTitle>{getDataTypeLabel()} - Bar Chart</CardTitle>
              <CardDescription>
                {equipment.name} - {timeRange} view
              </CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ChartContainer>
                <Chart>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={analyticsData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="time" />
                      <YAxis />
                      <Tooltip content={<ChartTooltip />} />

                      {dataType === "energy" ? (
                        <>
                          <Bar dataKey="heating" fill="#ff8042" name="Heating" />
                          <Bar dataKey="ventilation" fill="#82ca9d" name="Ventilation" />
                        </>
                      ) : (
                        <Bar dataKey="value" fill="#8884d8" name={getDataTypeLabel()} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </Chart>
                <ChartLegend>
                  {dataType === "energy" ? (
                    <>
                      <ChartLegendItem name="Heating" color="#ff8042" />
                      <ChartLegendItem name="Ventilation" color="#82ca9d" />
                    </>
                  ) : (
                    <ChartLegendItem name={getDataTypeLabel()} color="#8884d8" />
                  )}
                </ChartLegend>
              </ChartContainer>
            </CardContent>
          </Card>
        )

      default:
        return null
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Analytics Configuration</CardTitle>
          <CardDescription>Configure the analytics view for {equipment.name}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="time-range">Time Range</Label>
              <Select value={timeRange} onValueChange={setTimeRange}>
                <SelectTrigger id="time-range">
                  <SelectValue placeholder="Select time range" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="24h">Last 24 Hours</SelectItem>
                  <SelectItem value="7d">Last 7 Days</SelectItem>
                  <SelectItem value="30d">Last 30 Days</SelectItem>
                  <SelectItem value="1y">Last Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="data-type">Data Type</Label>
              <Select value={dataType} onValueChange={setDataType}>
                <SelectTrigger id="data-type">
                  <SelectValue placeholder="Select data type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temperature">Temperature</SelectItem>
                  <SelectItem value="humidity">Humidity</SelectItem>
                  <SelectItem value="uvIndex">UV Index</SelectItem>
                  <SelectItem value="energy">Energy Consumption</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="line">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="line">Line Chart</TabsTrigger>
          <TabsTrigger value="area">Area Chart</TabsTrigger>
          <TabsTrigger value="bar">Bar Chart</TabsTrigger>
        </TabsList>

        <TabsContent value="line" className="pt-4">
          {renderChart("line")}
        </TabsContent>

        <TabsContent value="area" className="pt-4">
          {renderChart("area")}
        </TabsContent>

        <TabsContent value="bar" className="pt-4">
          {renderChart("bar")}
        </TabsContent>
      </Tabs>
    </div>
  )
}

