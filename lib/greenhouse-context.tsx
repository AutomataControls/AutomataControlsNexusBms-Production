// @ts-nocheck
"use client"

import { createContext, useContext, useState, useEffect, type ReactNode } from "react"
import { ref, onValue } from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase"

// Define the types for our context
interface GreenhouseControls {
  ridgeVentEnable: boolean
  ridgeVentPosition: number
  sideVentEnable: boolean
  sideVentPosition: number
  exhaustFan1Enable: boolean
  exhaustFan1Speed: number
  exhaustFan2Enable: boolean
  exhaustFan2Speed: number
  supplyFanEnable: boolean
  supplyFanSpeed: number
  hangingHeater1Enable: boolean
  hangingHeater2Enable: boolean
  hangingHeater3Enable: boolean
  hangingHeater4Enable: boolean
  floorHeater1Enable: boolean
  floorHeater2Enable: boolean
}

interface GreenhouseSensorData {
  temperature: { avg: number; values: number[] }
  humidity: { avg: number; values: number[] }
  uvIndex: number
  isRaining: boolean
  outsideTemp: number
  timeOfDay: string
  lastUpdated: string
  globalSetpoint: number
}

interface GreenhouseContextType {
  controls: GreenhouseControls
  sensorData: GreenhouseSensorData
  loading: boolean
  error: string | null
  refreshData: () => void
  rawData: any
}

// Create default values
const defaultControls: GreenhouseControls = {
  ridgeVentEnable: false,
  ridgeVentPosition: 0,
  sideVentEnable: false,
  sideVentPosition: 0,
  exhaustFan1Enable: false,
  exhaustFan1Speed: 100,
  exhaustFan2Enable: false,
  exhaustFan2Speed: 100,
  supplyFanEnable: false,
  supplyFanSpeed: 100,
  hangingHeater1Enable: false,
  hangingHeater2Enable: false,
  hangingHeater3Enable: false,
  hangingHeater4Enable: false,
  floorHeater1Enable: false,
  floorHeater2Enable: false,
}

const defaultSensorData: GreenhouseSensorData = {
  temperature: { avg: 72, values: [70, 72, 74, 72] },
  humidity: { avg: 65, values: [64, 65, 66, 65] },
  uvIndex: 3,
  isRaining: false,
  outsideTemp: 68,
  timeOfDay: "day",
  lastUpdated: "Unknown",
  globalSetpoint: 72,
}

// Create the context
const GreenhouseContext = createContext<GreenhouseContextType>({
  controls: defaultControls,
  sensorData: defaultSensorData,
  loading: true,
  error: null,
  refreshData: () => {},
  rawData: null,
})

// Create a provider component
export function GreenhouseProvider({ children, locationId }: { children: ReactNode; locationId: string }) {
  const [controls, setControls] = useState<GreenhouseControls>(defaultControls)
  const [sensorData, setSensorData] = useState<GreenhouseSensorData>(defaultSensorData)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [rawData, setRawData] = useState<any>(null)

  const refreshData = () => {
    console.log("Manual refresh triggered")
    setRefreshKey((prev) => prev + 1)
  }

  useEffect(() => {
    if (!secondaryDb || !locationId) {
      setError("Database or location ID not available")
      setLoading(false)
      return
    }

    console.log(`Fetching greenhouse data for location: ${locationId}, refresh key: ${refreshKey}`)

    // Reference to the greenhouse data in the database
    const greenhouseRef = ref(secondaryDb, `locations/${locationId}/systems/Greenhouse`)

    const unsubscribe = onValue(
      greenhouseRef,
      (snapshot) => {
        const greenhouseData = snapshot.val()
        if (!greenhouseData) {
          console.error("No greenhouse data found for this location")
          setError("No greenhouse data found for this location")
          setLoading(false)
          return
        }

        console.log("Received greenhouse data:", greenhouseData)
        setRawData(greenhouseData)

        // Extract metrics from the greenhouse data
        const metrics = greenhouseData.metrics || {}
        console.log("Metrics from greenhouse data:", metrics)

        // Map the database values to the format expected by the GreenhouseVisualization component
        const newControls: GreenhouseControls = {
          // Ventilation
          ridgeVentEnable: metrics["Ridge Vent Open"] === true,
          ridgeVentPosition: Number(metrics["Ridge Vent Position"] || 0),

          sideVentEnable: metrics["Window Vent Open"] === true,
          sideVentPosition: Number(metrics["Window Vent Position"] || 0),

          // Exhaust fans
          exhaustFan1Enable:
            metrics["Exhaust Fan 1 Enabled"] === true || metrics["Exhaust Fan 1 Active Control"] === true,
          exhaustFan1Speed: 100, // Fixed speed for Taylor

          exhaustFan2Enable:
            metrics["Exhaust Fan 2 Enabled"] === true || metrics["Exhaust Fan 2 Active Control"] === true,
          exhaustFan2Speed: 100, // Fixed speed for Taylor

          // Supply fan
          supplyFanEnable: metrics["Supply Enabled"] === true || metrics["Supply Active Control"] === true,
          supplyFanSpeed: 100, // Fixed speed for Taylor

          // FCUs (treating as hanging heaters for visualization)
          hangingHeater1Enable: metrics["FCU 1 Enabled"] === true || metrics["FCU 1 Active Control"] === true,
          hangingHeater2Enable: metrics["FCU 2 Enabled"] === true || metrics["FCU 2 Active Control"] === true,
          hangingHeater3Enable: metrics["FCU 3 Enabled"] === true,
          hangingHeater4Enable: metrics["FCU 4 Enabled"] === true || metrics["FCU 4 Active Control"] === true,

          // Floor heating
          floorHeater1Enable: metrics["Floor Heat Active Control"] === true,
          floorHeater2Enable: metrics["Floor Heat 2 Enabled"] === true,
        }

        console.log("Mapped controls:", newControls)
        setControls(newControls)

        // Prepare sensor data using exact property names from your database
        const newSensorData: GreenhouseSensorData = {
          temperature: {
            avg: Number(metrics["Average Temperature"] || 0),
            values: [
              Number(metrics["Temperature 1"] || 0),
              Number(metrics["Temperature 2"] || 0),
              Number(metrics["Zone 1 Temperature"] || 0),
              Number(metrics["Zone 2 Temperature"] || 0),
            ],
          },
          humidity: {
            avg: Number(metrics["Average Humidity"] || 0),
            values: [
              Number(metrics["Humidity 1"] || 0),
              Number(metrics["Humidity 2"] || 0),
              Number(metrics["Zone 1 Humidity"] || 0),
              Number(metrics["Zone 2 Humidity"] || 0),
            ],
          },
          uvIndex: 3, // Default value as it's not in the provided metrics
          isRaining: metrics["Is Raining"] === true,
          outsideTemp: Number(metrics["Outside Temperature"] || 0),
          timeOfDay: metrics["Time of Day"] || "day",
          lastUpdated: greenhouseData.dateTime ? new Date(greenhouseData.dateTime).toLocaleString() : "Unknown",
          globalSetpoint: Number(metrics["Global Setpoint"] || 0),
        }

        console.log("Mapped sensor data:", newSensorData)
        setSensorData(newSensorData)

        setLoading(false)
      },
      (error) => {
        console.error("Error fetching greenhouse data:", error)
        setError(`Failed to fetch greenhouse data: ${error.message}`)
        setLoading(false)
      },
    )

    // Clean up the listener when the component unmounts
    return () => unsubscribe()
  }, [secondaryDb, locationId, refreshKey])

  // Create the context value
  const contextValue = {
    controls,
    sensorData,
    loading,
    error,
    refreshData,
    rawData,
  }

  return <GreenhouseContext.Provider value={contextValue}>{children}</GreenhouseContext.Provider>
}

// Create a custom hook to use the context
export function useGreenhouseContext() {
  const context = useContext(GreenhouseContext)
  if (context === undefined) {
    throw new Error("useGreenhouseContext must be used within a GreenhouseProvider")
  }
  return context
}
