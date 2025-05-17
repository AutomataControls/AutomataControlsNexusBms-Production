"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"

interface OutdoorAirResetSettings {
  enabled: boolean
  outdoorTempLow: number
  outdoorTempHigh: number
  setpointLow: number
  setpointHigh: number
}

interface FanCoilOutdoorAirResetProps {
  outdoorAirReset?: OutdoorAirResetSettings
  onOutdoorAirResetChange: (key: string, value: any) => void
}

export function FanCoilOutdoorAirReset({ outdoorAirReset, onOutdoorAirResetChange }: FanCoilOutdoorAirResetProps) {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="outdoor-air-reset">
        <AccordionTrigger>Outdoor Air Reset</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Label htmlFor="oar-enable">Enable Outdoor Air Reset</Label>
              <Switch
                id="oar-enable"
                checked={outdoorAirReset?.enabled === true}
                onCheckedChange={(checked) => {
                  onOutdoorAirResetChange("enabled", checked)
                }}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="outdoor-temp-low">Outdoor Temp Low (°F)</Label>
                <Input
                  id="outdoor-temp-low"
                  type="number"
                  value={outdoorAirReset?.outdoorTempLow || 20}
                  onChange={(e) => {
                    onOutdoorAirResetChange("outdoorTempLow", Number.parseFloat(e.target.value) || 20)
                  }}
                  step={1}
                  min={-20}
                  max={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setpoint-low">Setpoint at Low Temp (°F)</Label>
                <Input
                  id="setpoint-low"
                  type="number"
                  value={outdoorAirReset?.setpointLow || 75}
                  onChange={(e) => {
                    onOutdoorAirResetChange("setpointLow", Number.parseFloat(e.target.value) || 75)
                  }}
                  step={1}
                  min={50}
                  max={90}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outdoor-temp-high">Outdoor Temp High (°F)</Label>
                <Input
                  id="outdoor-temp-high"
                  type="number"
                  value={outdoorAirReset?.outdoorTempHigh || 70}
                  onChange={(e) => {
                    onOutdoorAirResetChange("outdoorTempHigh", Number.parseFloat(e.target.value) || 70)
                  }}
                  step={1}
                  min={-20}
                  max={120}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="setpoint-high">Setpoint at High Temp (°F)</Label>
                <Input
                  id="setpoint-high"
                  type="number"
                  value={outdoorAirReset?.setpointHigh || 68}
                  onChange={(e) => {
                    onOutdoorAirResetChange("setpointHigh", Number.parseFloat(e.target.value) || 68)
                  }}
                  step={1}
                  min={50}
                  max={90}
                />
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
