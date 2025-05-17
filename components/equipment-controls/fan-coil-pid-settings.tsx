"use client"

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Info } from "lucide-react"
import type { PIDSettings } from "./types"

interface FanCoilPIDSettingsProps {
  pidControllers?: {
    heating?: PIDSettings
    cooling?: PIDSettings
    outdoorDamper?: PIDSettings
  }
  onPidChange: (
    controllerType: "heating" | "cooling" | "outdoorDamper",
    paramName: keyof PIDSettings,
    value: number | boolean,
  ) => Promise<void>
}

export function FanCoilPIDSettings({ pidControllers, onPidChange }: FanCoilPIDSettingsProps) {
  return (
    <Accordion type="single" collapsible className="w-full">
      <AccordionItem value="pid-settings">
        <AccordionTrigger>PID Controller Settings</AccordionTrigger>
        <AccordionContent>
          <div className="space-y-4">
            {/* Heating PID Controller */}
            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Heating PID Controller</h4>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="heating-pid-enable">Enable</Label>
                  <Switch
                    id="heating-pid-enable"
                    checked={pidControllers?.heating?.enabled === true}
                    onCheckedChange={(checked) => {
                      onPidChange("heating", "enabled", checked)
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="heating-kp">Proportional Gain (Kp)</Label>
                  <Input
                    id="heating-kp"
                    type="number"
                    value={pidControllers?.heating?.kp || 1.0}
                    onChange={(e) => {
                      onPidChange("heating", "kp", Number.parseFloat(e.target.value) || 0)
                    }}
                    step={0.1}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heating-ki">Integral Gain (Ki)</Label>
                  <Input
                    id="heating-ki"
                    type="number"
                    value={pidControllers?.heating?.ki || 0.1}
                    onChange={(e) => {
                      onPidChange("heating", "ki", Number.parseFloat(e.target.value) || 0)
                    }}
                    step={0.01}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="heating-kd">Derivative Gain (Kd)</Label>
                  <Input
                    id="heating-kd"
                    type="number"
                    value={pidControllers?.heating?.kd || 0.01}
                    onChange={(e) => {
                      onPidChange("heating", "kd", Number.parseFloat(e.target.value) || 0)
                    }}
                    step={0.01}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="heating-reverse">Reverse Acting</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 inline-block ml-1 align-text-top cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            When enabled, the output is reversed (100% becomes 0%, 0% becomes 100%). Use this for
                            heating valves that close when fully powered.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    id="heating-reverse"
                    checked={pidControllers?.heating?.reverseActing === true}
                    onCheckedChange={(checked) => {
                      onPidChange("heating", "reverseActing", checked)
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Cooling PID Controller */}
            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Cooling PID Controller</h4>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="cooling-pid-enable">Enable</Label>
                  <Switch
                    id="cooling-pid-enable"
                    checked={pidControllers?.cooling?.enabled === true}
                    onCheckedChange={(checked) => {
                      onPidChange("cooling", "enabled", checked)
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="cooling-kp">Proportional Gain (Kp)</Label>
                  <Input
                    id="cooling-kp"
                    type="number"
                    value={pidControllers?.cooling?.kp || 1.0}
                    onChange={(e) => {
                      onPidChange("cooling", "kp", Number.parseFloat(e.target.value) || 0)
                    }}
                    step={0.1}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cooling-ki">Integral Gain (Ki)</Label>
                  <Input
                    id="cooling-ki"
                    type="number"
                    value={pidControllers?.cooling?.ki || 0.1}
                    onChange={(e) => {
                      onPidChange("cooling", "ki", Number.parseFloat(e.target.value) || 0)
                    }}
                    step={0.01}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cooling-kd">Derivative Gain (Kd)</Label>
                  <Input
                    id="cooling-kd"
                    type="number"
                    value={pidControllers?.cooling?.kd || 0.01}
                    onChange={(e) => {
                      onPidChange("cooling", "kd", Number.parseFloat(e.target.value) || 0)
                    }}
                    step={0.01}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="cooling-reverse">Reverse Acting</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 inline-block ml-1 align-text-top cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            When enabled, the output is reversed (100% becomes 0%, 0% becomes 100%). Use this for
                            cooling valves that close when fully powered.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    id="cooling-reverse"
                    checked={pidControllers?.cooling?.reverseActing === true}
                    onCheckedChange={(checked) => {
                      onPidChange("cooling", "reverseActing", checked)
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Outdoor Damper PID Controller */}
            <div className="border p-4 rounded-md">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium">Outdoor Damper PID Controller</h4>
                <div className="flex items-center space-x-2">
                  <Label htmlFor="damper-pid-enable">Enable</Label>
                  <Switch
                    id="damper-pid-enable"
                    checked={pidControllers?.outdoorDamper?.enabled === true}
                    onCheckedChange={(checked) => {
                      onPidChange("outdoorDamper", "enabled", checked)
                    }}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="damper-kp">Proportional Gain (Kp)</Label>
                  <Input
                    id="damper-kp"
                    type="number"
                    value={pidControllers?.outdoorDamper?.kp || 1.0}
                    onChange={(e) => {
                      onPidChange("outdoorDamper", "kp", Number.parseFloat(e.target.value) || 0)
                    }}
                    step={0.1}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="damper-ki">Integral Gain (Ki)</Label>
                  <Input
                    id="damper-ki"
                    type="number"
                    value={pidControllers?.outdoorDamper?.ki || 0.1}
                    onChange={(e) => {
                      onPidChange("outdoorDamper", "ki", Number.parseFloat(e.target.value) || 0)
                    }}
                    step={0.01}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="damper-kd">Derivative Gain (Kd)</Label>
                  <Input
                    id="damper-kd"
                    type="number"
                    value={pidControllers?.outdoorDamper?.kd || 0.01}
                    onChange={(e) => {
                      onPidChange("outdoorDamper", "kd", Number.parseFloat(e.target.value) || 0)
                    }}
                    step={0.01}
                    min={0}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Label htmlFor="damper-reverse">Reverse Acting</Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Info className="h-4 w-4 inline-block ml-1 align-text-top cursor-pointer" />
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>
                            When enabled, the output is reversed (100% becomes 0%, 0% becomes 100%). Use this for
                            dampers that close when fully powered.
                          </p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Switch
                    id="damper-reverse"
                    checked={pidControllers?.outdoorDamper?.reverseActing === true}
                    onCheckedChange={(checked) => {
                      onPidChange("outdoorDamper", "reverseActing", checked)
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}
