"use client"

import { useGreenhouseContext } from "@/lib/greenhouse-context"
import { useEffect } from "react"
import { GreenhouseVisualization } from "./greenhouse-visualization"

export function GreenhouseVisualizationWithContext() {
  const { controls, sensorData } = useGreenhouseContext()

  // Log the data from context for debugging
  useEffect(() => {
    console.log("GreenhouseVisualizationWithContext received from context:", {
      controls,
      sensorData,
    })
  }, [controls, sensorData])

  // Generate a unique key to force re-render when data changes
  const renderKey = `viz-${JSON.stringify(controls)}-${JSON.stringify(sensorData)}`

  return <GreenhouseVisualization controls={controls} sensorData={sensorData} key={renderKey} />
}
