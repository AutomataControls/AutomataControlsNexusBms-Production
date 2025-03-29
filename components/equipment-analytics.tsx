"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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

interface EquipmentAnalyticsProps {
  equipment: any
}

export function EquipmentAnalytics({ equipment }: EquipmentAnalyticsProps) {
  const [analyticsData, setAnalyticsData] = useState<any[]>([])
  const [timeRange, setTimeRange] = useState<string>("24h")
  const [dataType, setDataType] = useState<string>("temperature")
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
            points = 7
            interval = 24 * 60 * 60 * 1000 // 1 day
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

          // Generate different data based on the selected data type
          let value, secondaryValue

          switch (dataType) {
            case "temperature":
              value = 20 + Math.random() * 5 // Temperature between 20-25°C
              secondaryValue = 18 + Math.random() * 3 // Secondary temperature
              break
            case "humidity":
              value = 40 + Math.random() * 20 // Humidity between 40-60%
              break
            case "pressure":
              value = 1000 + Math.random() * 20 // Pressure between 1000-1020 hPa
              break
            case "energy":
              value = 50 + Math.random() * 30 // Energy consumption
              break
            default:
              value = Math.random() * 100
          }

          const dataPoint: any = {
            time: time.toLocaleString(),
            value: Number.parseFloat(value.toFixed(1)),
          }

          if (secondaryValue !== undefined) {
            dataPoint.secondaryValue = Number.parseFloat(secondaryValue.toFixed(1))
          }

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
        return "Temperature (°C)"
      case "humidity":
        return "Humidity (%)"
      case "pressure":
        return "Pressure (hPa)"
      case "energy":
        return "Energy (kWh)"
      default:
        return "Value"
    }
  }

  const getSecondaryDataTypeLabel = () => {
    switch (dataType) {
      case "temperature":
        return "Return Temperature (°C)"
      default:
        return "Secondary Value"
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
                  <SelectItem value="pressure">Pressure</SelectItem>
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

        <TabsContent value="line" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{getDataTypeLabel()} - Line Chart</CardTitle>
              <CardDescription>
                {equipment.name} - {equipment.type}
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
                      <Line type="monotone" dataKey="value" stroke="#8884d8" name={getDataTypeLabel()} />
                      {dataType === "temperature" && (
                        <Line
                          type="monotone"
                          dataKey="secondaryValue"
                          stroke="#82ca9d"
                          name={getSecondaryDataTypeLabel()}
                        />
                      )}
                    </LineChart>
                  </ResponsiveContainer>
                </Chart>
                <ChartLegend>
                  <ChartLegendItem name={getDataTypeLabel()} color="#8884d8" />
                  {dataType === "temperature" && <ChartLegendItem name={getSecondaryDataTypeLabel()} color="#82ca9d" />}
                </ChartLegend>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="area" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{getDataTypeLabel()} - Area Chart</CardTitle>
              <CardDescription>
                {equipment.name} - {equipment.type}
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
                      <Area type="monotone" dataKey="value" stroke="#8884d8" fill="#8884d8" name={getDataTypeLabel()} />
                      {dataType === "temperature" && (
                        <Area
                          type="monotone"
                          dataKey="secondaryValue"
                          stroke="#82ca9d"
                          fill="#82ca9d"
                          name={getSecondaryDataTypeLabel()}
                        />
                      )}
                    </AreaChart>
                  </ResponsiveContainer>
                </Chart>
                <ChartLegend>
                  <ChartLegendItem name={getDataTypeLabel()} color="#8884d8" />
                  {dataType === "temperature" && <ChartLegendItem name={getSecondaryDataTypeLabel()} color="#82ca9d" />}
                </ChartLegend>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="bar" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>{getDataTypeLabel()} - Bar Chart</CardTitle>
              <CardDescription>
                {equipment.name} - {equipment.type}
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
                      <Bar dataKey="value" fill="#8884d8" name={getDataTypeLabel()} />
                      {dataType === "temperature" && (
                        <Bar dataKey="secondaryValue" fill="#82ca9d" name={getSecondaryDataTypeLabel()} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </Chart>
                <ChartLegend>
                  <ChartLegendItem name={getDataTypeLabel()} color="#8884d8" />
                  {dataType === "temperature" && <ChartLegendItem name={getSecondaryDataTypeLabel()} color="#82ca9d" />}
                </ChartLegend>
              </ChartContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

