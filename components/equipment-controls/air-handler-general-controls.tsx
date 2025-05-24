"use client"

import { FormEvent, useState } from "react"
import {
    Card,
    CardContent,
    CardDescription,
    CardFooter,
    CardHeader,
    CardTitle,
} from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Slider } from "@/components/ui/slider"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { InfoIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

// Import types
import type { AirHandlerControls } from "./types"

interface AirHandlerGeneralControlsProps {
    controls: AirHandlerControls
    onControlChange: (key: string, value: any) => void
}

export function AirHandlerGeneralControls({ controls, onControlChange }: AirHandlerGeneralControlsProps) {
    // Default values from provided controls or fallbacks
    const [temperatureSetpoint, setTemperatureSetpoint] = useState<number>(controls.temperatureSetpoint || 70)
    const [supplyAirTempSetpoint, setSupplyAirTempSetpoint] = useState<number>(controls.supplyAirTempSetpoint || 55)
    
    // State for controlling sliders
    const [tempSubmitMode, setTempSubmitMode] = useState<boolean>(false)
    const [satSubmitMode, setSatSubmitMode] = useState<boolean>(false)

    // Temperature setpoint handler with input validation
    const handleTemperatureSetpointChange = (value: number) => {
        // Validate range
        const validatedValue = Math.max(60, Math.min(80, value))
        setTemperatureSetpoint(validatedValue)
        
        if (!tempSubmitMode) {
            onControlChange("temperatureSetpoint", validatedValue)
        }
    }

    // Submit handler for temperature when using submit mode
    const handleTempSubmit = (e: FormEvent) => {
        e.preventDefault()
        onControlChange("temperatureSetpoint", temperatureSetpoint)
    }

    // Supply air temperature setpoint handler with input validation
    const handleSupplyAirTempSetpointChange = (value: number) => {
        // Validate range
        const validatedValue = Math.max(45, Math.min(75, value))
        setSupplyAirTempSetpoint(validatedValue)
        
        if (!satSubmitMode) {
            onControlChange("supplyAirTempSetpoint", validatedValue)
        }
    }

    // Submit handler for supply air temp when using submit mode
    const handleSATSubmit = (e: FormEvent) => {
        e.preventDefault()
        onControlChange("supplyAirTempSetpoint", supplyAirTempSetpoint)
    }

    // Unit enable toggle handler
    const handleUnitEnableChange = (checked: boolean) => {
        onControlChange("unitEnable", checked)
    }

    // Operation mode handler
    const handleOperationModeChange = (value: string) => {
        onControlChange("operationMode", value)
    }

    // Control mode handler
    const handleControlModeChange = (value: string) => {
        onControlChange("controlMode", value)
    }

    // Equipment type handlers
    const handleCoolingTypeChange = (value: string) => {
        onControlChange("coolingType", value)
    }

    const handleHeatingTypeChange = (value: string) => {
        onControlChange("heatingType", value)
    }

    // Economizer toggle handler
    const handleEconomizerEnableChange = (checked: boolean) => {
        onControlChange("economizerEnable", checked)
    }

    // Fan enable handler
    const handleFanEnableChange = (checked: boolean) => {
        onControlChange("supplyFanEnable", checked)
    }

    // Fan speed handler
    const handleFanSpeedChange = (value: number) => {
        const validatedValue = Math.max(0, Math.min(100, value))
        onControlChange("supplyFanSpeed", validatedValue)
    }

    // Return the UI component
    return (
        <div className="grid gap-4 grid-cols-1 lg:grid-cols-2">
            {/* Temperature Control Card */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center">
                        Temperature Controls
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <InfoIcon className="h-4 w-4 ml-2 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Set temperature setpoints for the space and supply air</p>
                                </TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Temperature Setpoint (Zone/Room) */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label htmlFor="temperatureSetpoint">Zone Temperature Setpoint</Label>
                            <span className="text-muted-foreground text-sm">{temperatureSetpoint}°F</span>
                        </div>
                        <form onSubmit={handleTempSubmit} className="flex space-x-2">
                            <div className="flex-1">
                                <Slider
                                    id="temperatureSetpoint"
                                    min={60}
                                    max={80}
                                    step={0.5}
                                    value={[temperatureSetpoint]}
                                    onValueChange={(values) => handleTemperatureSetpointChange(values[0])}
                                />
                            </div>
                            {tempSubmitMode && (
                                <Button type="submit" size="sm">Set</Button>
                            )}
                        </form>
                    </div>

                    {/* Supply Air Temperature Setpoint */}
                    <div className="space-y-2">
                        <div className="flex justify-between">
                            <Label htmlFor="supplyAirTempSetpoint">Supply Air Temperature Setpoint</Label>
                            <span className="text-muted-foreground text-sm">{supplyAirTempSetpoint}°F</span>
                        </div>
                        <form onSubmit={handleSATSubmit} className="flex space-x-2">
                            <div className="flex-1">
                                <Slider
                                    id="supplyAirTempSetpoint"
                                    min={45}
                                    max={75}
                                    step={0.5}
                                    value={[supplyAirTempSetpoint]}
                                    onValueChange={(values) => handleSupplyAirTempSetpointChange(values[0])}
                                />
                            </div>
                            {satSubmitMode && (
                                <Button type="submit" size="sm">Set</Button>
                            )}
                        </form>
                    </div>

                    {/* Control Mode */}
                    <div className="space-y-2">
                        <Label htmlFor="controlMode">Control Mode</Label>
                        <Select
                            value={controls.controlMode || "space"}
                            onValueChange={handleControlModeChange}
                        >
                            <SelectTrigger id="controlMode">
                                <SelectValue placeholder="Select Control Mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="space">Space Temperature</SelectItem>
                                <SelectItem value="supply">Supply Air Temperature</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* System Operation Card */}
            <Card>
                <CardHeader>
                    <CardTitle>System Operation</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Unit Enable Switch */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="unitEnable">Unit Enable</Label>
                        <Switch
                            id="unitEnable"
                            checked={controls.unitEnable || false}
                            onCheckedChange={handleUnitEnableChange}
                        />
                    </div>

                    {/* Operation Mode */}
                    <div className="space-y-2">
                        <Label htmlFor="operationMode">Operation Mode</Label>
                        <Select
                            value={controls.operationMode || "auto"}
                            onValueChange={handleOperationModeChange}
                        >
                            <SelectTrigger id="operationMode">
                                <SelectValue placeholder="Select Mode" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="auto">Auto</SelectItem>
                                <SelectItem value="heating">Heating</SelectItem>
                                <SelectItem value="cooling">Cooling</SelectItem>
                                <SelectItem value="off">Off</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Economizer Enable */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="economizerEnable">Economizer Enable</Label>
                        <Switch
                            id="economizerEnable"
                            checked={controls.economizerEnable || false}
                            onCheckedChange={handleEconomizerEnableChange}
                        />
                    </div>

                    {/* Supply Fan Enable */}
                    <div className="flex items-center justify-between">
                        <Label htmlFor="supplyFanEnable">Supply Fan Enable</Label>
                        <Switch
                            id="supplyFanEnable"
                            checked={controls.supplyFanEnable || false}
                            onCheckedChange={handleFanEnableChange}
                        />
                    </div>

                    {/* Supply Fan Speed */}
                    {controls.supplyFanEnable && (
                        <div className="space-y-2">
                            <div className="flex justify-between">
                                <Label htmlFor="supplyFanSpeed">Supply Fan Speed</Label>
                                <span className="text-muted-foreground text-sm">{controls.supplyFanSpeed || 0}%</span>
                            </div>
                            <Slider
                                id="supplyFanSpeed"
                                min={0}
                                max={100}
                                step={1}
                                value={[controls.supplyFanSpeed || 0]}
                                onValueChange={(values) => handleFanSpeedChange(values[0])}
                            />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Equipment Configuration Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Equipment Configuration</CardTitle>
                    <CardDescription>System type and components</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                    {/* Cooling Type */}
                    <div className="space-y-2">
                        <Label htmlFor="coolingType">Cooling Type</Label>
                        <Select
                            value={controls.coolingType || "chilled_water"}
                            onValueChange={handleCoolingTypeChange}
                        >
                            <SelectTrigger id="coolingType">
                                <SelectValue placeholder="Select Cooling Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="chilled_water">Chilled Water</SelectItem>
                                <SelectItem value="dx_single_stage">DX Single Stage</SelectItem>
                                <SelectItem value="dx_two_stage">DX Two Stage</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    {/* Heating Type */}
                    <div className="space-y-2">
                        <Label htmlFor="heatingType">Heating Type</Label>
                        <Select
                            value={controls.heatingType || "hot_water"}
                            onValueChange={handleHeatingTypeChange}
                        >
                            <SelectTrigger id="heatingType">
                                <SelectValue placeholder="Select Heating Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="hot_water">Hot Water</SelectItem>
                                <SelectItem value="none">None</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* System Status Card */}
            <Card>
                <CardHeader>
                    <CardTitle>Current Status</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-sm font-medium">Unit Status</p>
                            <p className={`text-lg ${controls.unitEnable ? "text-green-600" : "text-red-600"}`}>
                                {controls.unitEnable ? "Running" : "Off"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Mode</p>
                            <p className="text-lg">{controls.operationMode || "Auto"}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Control Type</p>
                            <p className="text-lg">{controls.controlMode === "space" ? "Space Temp" : "Supply Temp"}</p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Economizer</p>
                            <p className={`text-lg ${controls.economizerEnable ? "text-green-600" : "text-gray-600"}`}>
                                {controls.economizerEnable ? "Enabled" : "Disabled"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Fan Status</p>
                            <p className={`text-lg ${controls.supplyFanEnable ? "text-green-600" : "text-red-600"}`}>
                                {controls.supplyFanEnable ? "Running" : "Off"}
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-medium">Fan Speed</p>
                            <p className="text-lg">{controls.supplyFanSpeed || 0}%</p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
