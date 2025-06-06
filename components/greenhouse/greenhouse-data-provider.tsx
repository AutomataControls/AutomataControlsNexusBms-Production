"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"
import { useGreenhouseContext } from "@/lib/greenhouse-context"
import { GreenhouseVisualizationWithContext } from "./greenhouse-visualization-with-context"

export function GreenhouseDataProvider({ locationId }: { locationId: string }) {
  const { loading, error, refreshData, sensorData, rawData } = useGreenhouseContext()

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <Skeleton className="h-[800px] w-full" />
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center">
            <h3 className="text-lg font-medium mb-2">Error Loading Greenhouse Data</h3>
            <p className="text-muted-foreground">{error}</p>
            <Button onClick={refreshData} variant="outline" className="mt-4">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  console.log("GreenhouseDataProvider rendering with rawData:", rawData)

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <p className="text-sm text-muted-foreground">
            Temperature: <span className="font-medium">{rawData["Average Temperature"] || 0}°F</span> • Humidity:{" "}
            <span className="font-medium">{rawData["Average Humidity"] || 0}%</span>
          </p>
        </div>
        <Button onClick={refreshData} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Data
        </Button>
      </div>

      {/* Use our context-based visualization */}
      <GreenhouseVisualizationWithContext />
    </div>
  )
}
