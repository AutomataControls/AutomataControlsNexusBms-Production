"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ZoneControlPanel } from "./zone-control-panel"
import { Thermometer, Settings } from "lucide-react"
import { useRouter } from "next/navigation"

interface ZoneCardProps {
  zone: {
    id: string
    name: string
    type?: string
    description?: string
    setpoint?: number
    currentTemperature?: number
    status?: string
  }
}

export function ZoneCard({ zone }: ZoneCardProps) {
  const [controlsOpen, setControlsOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <Card className="hover:bg-muted/50 cursor-pointer transition-colors" onClick={() => setControlsOpen(true)}>
        <CardHeader className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">{zone.name}</CardTitle>
              <CardDescription>{zone.description || zone.type || "Zone"}</CardDescription>
            </div>
            <Badge
              variant={
                zone.status === "offline" || zone.status === "error"
                  ? "destructive"
                  : zone.status === "warning"
                    ? "outline"
                    : "default"
              }
            >
              {zone.status || "Unknown"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 pt-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Thermometer className="h-4 w-4 mr-2 text-muted-foreground" />
              <span>{zone.currentTemperature || zone.setpoint || "--"}°F</span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                router.push(`/dashboard/settings/zones/${zone.id}`)
              }}
            >
              <Settings className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <Dialog open={controlsOpen} onOpenChange={setControlsOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Zone Controls</DialogTitle>
          </DialogHeader>
          <ZoneControlPanel zoneId={zone.id} />
        </DialogContent>
      </Dialog>
    </>
  )
}

