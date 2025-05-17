"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Fan, Thermometer, Droplet, Wind, Gauge } from "lucide-react"

interface AirHandlerGeneralControlsProps {
  controls: any
  onControlChange: (key: string, value: any) => void
}

export function AirHandlerGeneralControls({ controls, onControlChange }: AirHandlerGeneralControlsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>General Controls</CardTitle>
        <CardDescription>Basic control settings for the air handler unit</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="operation" className="w-full">
          <TabsList className="grid grid-cols-4 mb-4">
            <TabsTrigger
              value="operation"
              className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500"
            >
              <Wind className="h-4 w-4 mr-2" />
              Operation
            </TabsTrigger>
            <TabsTrigger value="fans" className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500">
              <Fan className="h-4 w-4 mr-2" />
              Fans
            </TabsTrigger>
            <TabsTrigger
              value="temperature"
              className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500"
            >
              <Thermometer className="h-4 w-4 mr-2" />
              Temperature
            </TabsTrigger>
            <TabsTrigger
              value="dampers"
              className="data-[state=active]:border-b-2 data-[state=active]:border-orange-500"
            >
              <Droplet className="h-4 w-4 mr-2" />
              Dampers
            </TabsTrigger>
          </TabsList>

          {/* Operation Tab */}
          <TabsContent value="operation" className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="unit-enable"
                checked={controls.unitEnable}
                onCheckedChange={(checked) => {
                  onControlChange("unitEnable", checked)
                }}
                className="data-[state=checked]:bg-[#d2f4ea]"
              />
              <Label htmlFor="unit-enable">Enable Unit</Label>
            </div>

            <div className="space-y-2">
              <Label htmlFor="operation-mode">Operation Mode</Label>
              <Select
                value={controls.operationMode}
                onValueChange={(value) => {
                  onControlChange("operationMode", value)
                }}
              >
                <SelectTrigger id="operation-mode">
                  <SelectValue placeholder="Select operation mode" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="heating">Heating</SelectItem>
                  <SelectItem value="cooling">Cooling</SelectItem>
                  <SelectItem value="ventilation">Ventilation Only</SelectItem>
                  <SelectItem value="off">Off</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {controls.hasStaticPressureControl && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="static-pressure-setpoint">Static Pressure Setpoint (inWC)</Label>
                  <span className="text-sm font-medium">{controls.staticPressureSetpoint?.toFixed(2)}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <Gauge className="h-4 w-4 text-gray-500" />
                  <Slider
                    id="static-pressure-setpoint"
                    min={0}
                    max={3}
                    step={0.1}
                    value={[controls.staticPressureSetpoint || 1.0]}
                    onValueChange={(value) => {
                      onControlChange("staticPressureSetpoint", value[0])
                    }}
                    className="flex-1 accent-[#d2f4ea]"
                  />
                </div>
              </div>
            )}
          </TabsContent>

          {/* Fans Tab */}
          <TabsContent value="fans" className="space-y-4">
            <div className="space-y-4">
              {/* Supply Fan Controls */}
              <div className="border p-4 rounded-md space-y-3">
                <h4 className="font-medium">Supply Fan</h4>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="supply-fan-enable"
                    checked={controls.supplyFanEnable}
                    onCheckedChange={(checked) => {
                      onControlChange("supplyFanEnable", checked)
                    }}
                    className="data-[state=checked]:bg-[#d2f4ea]"
                  />
                  <Label htmlFor="supply-fan-enable">Enable Supply Fan</Label>
                </div>

                {controls.supplyFanVFD ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="supply-fan-speed">Supply Fan Speed (%)</Label>
                      <span className="text-sm font-medium">{controls.supplyFanSpeed}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Fan className="h-4 w-4 text-gray-500" />
                      <Slider
                        id="supply-fan-speed"
                        min={0}
                        max={100}
                        step={1}
                        value={[controls.supplyFanSpeed || 0]}
                        onValueChange={(value) => {
                          onControlChange("supplyFanSpeed", value[0])
                        }}
                        className="flex-1 accent-[#d2f4ea]"
                        disabled={!controls.supplyFanEnable}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="supply-fan-speed-select">Supply Fan Speed</Label>
                    <Select
                      value={
                        controls.supplyFanSpeed === 100 ? "high" : controls.supplyFanSpeed === 66 ? "medium" : "low"
                      }
                      onValueChange={(value) => {
                        const speedValue = value === "high" ? 100 : value === "medium" ? 66 : 33
                        onControlChange("supplyFanSpeed", speedValue)
                      }}
                      disabled={!controls.supplyFanEnable}
                    >
                      <SelectTrigger id="supply-fan-speed-select">
                        <SelectValue placeholder="Select fan speed" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              {/* Return Fan Controls */}
              <div className="border p-4 rounded-md space-y-3">
                <h4 className="font-medium">Return Fan</h4>
                <div className="flex items-center space-x-2">
                  <Switch
                    id="return-fan-enable"
                    checked={controls.returnFanEnable}
                    onCheckedChange={(checked) => {
                      onControlChange("returnFanEnable", checked)
                    }}
                    className="data-[state=checked]:bg-[#d2f4ea]"
                  />
                  <Label htmlFor="return-fan-enable">Enable Return Fan</Label>
                </div>

                {controls.returnFanVFD ? (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="return-fan-speed">Return Fan Speed (%)</Label>
                      <span className="text-sm font-medium">{controls.returnFanSpeed}%</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Fan className="h-4 w-4 text-gray-500" />
                      <Slider
                        id="return-fan-speed"
                        min={0}
                        max={100}
                        step={1}
                        value={[controls.returnFanSpeed || 0]}
                        onValueChange={(value) => {
                          onControlChange("returnFanSpeed", value[0])
                        }}
                        className="flex-1 accent-[#d2f4ea]"
                        disabled={!controls.returnFanEnable}
                      />
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="return-fan-speed-select">Return Fan Speed</Label>
                    <Select
                      value={
                        controls.returnFanSpeed === 100 ? "high" : controls.returnFanSpeed === 66 ? "medium" : "low"
                      }
                      onValueChange={(value) => {
                        const speedValue = value === "high" ? 100 : value === "medium" ? 66 : 33
                        onControlChange("returnFanSpeed", speedValue)
                      }}
                      disabled={!controls.returnFanEnable}
                    >
                      <SelectTrigger id="return-fan-speed-select">
                        <SelectValue placeholder="Select fan speed" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Temperature Tab */}
          <TabsContent value="temperature" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="temperature-setpoint">Temperature Setpoint (°F)</Label>
                <span className="text-sm font-medium">{controls.temperatureSetpoint}°F</span>
              </div>
              <div className="flex items-center space-x-2">
                <Thermometer className="h-4 w-4 text-gray-500" />
                <Slider
                  id="temperature-setpoint"
                  min={55}
                  max={85}
                  step={1}
                  value={[controls.temperatureSetpoint || 72]}
                  onValueChange={(value) => {
                    onControlChange("temperatureSetpoint", value[0])
                  }}
                  className="flex-1 accent-[#d2f4ea]"
                />
              </div>
            </div>

            {/* Heating Controls */}
            <div className="border p-4 rounded-md space-y-3">
              <h4 className="font-medium">Heating</h4>
              {controls.hasHotWaterValve ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="heating-valve-position">Heating Valve Position (%)</Label>
                    <span className="text-sm font-medium">{controls.heatingValvePosition}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Droplet className="h-4 w-4 text-gray-500" />
                    <Slider
                      id="heating-valve-position"
                      min={0}
                      max={100}
                      step={1}
                      value={[controls.heatingValvePosition || 0]}
                      onValueChange={(value) => {
                        onControlChange("heatingValvePosition", value[0])
                      }}
                      className="flex-1 accent-[#d2f4ea]"
                    />
                  </div>
                </div>
              ) : controls.heatingStages > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="active-heating-stages">Active Heating Stages</Label>
                  <Select
                    value={controls.activeHeatingStages?.toString() || "0"}
                    onValueChange={(value) => {
                      onControlChange("activeHeatingStages", Number.parseInt(value))
                    }}
                  >
                    <SelectTrigger id="active-heating-stages">
                      <SelectValue placeholder="Select active stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 Stages</SelectItem>
                      {Array.from({ length: controls.heatingStages }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1} {i === 0 ? "Stage" : "Stages"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No heating control available</div>
              )}
            </div>

            {/* Cooling Controls */}
            <div className="border p-4 rounded-md space-y-3">
              <h4 className="font-medium">Cooling</h4>
              {controls.hasCoolingValve ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="cooling-valve-position">Cooling Valve Position (%)</Label>
                    <span className="text-sm font-medium">{controls.coolingValvePosition}%</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Droplet className="h-4 w-4 text-gray-500" />
                    <Slider
                      id="cooling-valve-position"
                      min={0}
                      max={100}
                      step={1}
                      value={[controls.coolingValvePosition || 0]}
                      onValueChange={(value) => {
                        onControlChange("coolingValvePosition", value[0])
                      }}
                      className="flex-1 accent-[#d2f4ea]"
                    />
                  </div>
                </div>
              ) : controls.coolingStages > 0 ? (
                <div className="space-y-2">
                  <Label htmlFor="active-cooling-stages">Active Cooling Stages</Label>
                  <Select
                    value={controls.activeCoolingStages?.toString() || "0"}
                    onValueChange={(value) => {
                      onControlChange("activeCoolingStages", Number.parseInt(value))
                    }}
                  >
                    <SelectTrigger id="active-cooling-stages">
                      <SelectValue placeholder="Select active stages" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">0 Stages</SelectItem>
                      {Array.from({ length: controls.coolingStages }, (_, i) => (
                        <SelectItem key={i + 1} value={(i + 1).toString()}>
                          {i + 1} {i === 0 ? "Stage" : "Stages"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="text-sm text-gray-500">No cooling control available</div>
              )}
            </div>
          </TabsContent>

          {/* Dampers Tab */}
          <TabsContent value="dampers" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="outdoor-damper-position">Outdoor Air Damper (%)</Label>
                <span className="text-sm font-medium">{controls.outdoorDamperPosition || 0}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <Wind className="h-4 w-4 text-gray-500" />
                <Slider
                  id="outdoor-damper-position"
                  min={0}
                  max={100}
                  step={1}
                  value={[controls.outdoorDamperPosition || 0]}
                  onValueChange={(value) => {
                    onControlChange("outdoorDamperPosition", value[0])
                  }}
                  className="flex-1 accent-[#d2f4ea]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="return-damper-position">Return Air Damper (%)</Label>
                <span className="text-sm font-medium">{controls.returnDamperPosition || 0}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <Wind className="h-4 w-4 text-gray-500" />
                <Slider
                  id="return-damper-position"
                  min={0}
                  max={100}
                  step={1}
                  value={[controls.returnDamperPosition || 0]}
                  onValueChange={(value) => {
                    onControlChange("returnDamperPosition", value[0])
                  }}
                  className="flex-1 accent-[#d2f4ea]"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="exhaust-damper-position">Exhaust Air Damper (%)</Label>
                <span className="text-sm font-medium">{controls.exhaustDamperPosition || 0}%</span>
              </div>
              <div className="flex items-center space-x-2">
                <Wind className="h-4 w-4 text-gray-500" />
                <Slider
                  id="exhaust-damper-position"
                  min={0}
                  max={100}
                  step={1}
                  value={[controls.exhaustDamperPosition || 0]}
                  onValueChange={(value) => {
                    onControlChange("exhaustDamperPosition", value[0])
                  }}
                  className="flex-1 accent-[#d2f4ea]"
                />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
