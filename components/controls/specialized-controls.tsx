// components/controls/boiler-controls.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Flame, Thermometer, Gauge } from "lucide-react"

interface ControlProps {
  equipmentInfo: any
  metrics: any
  onUpdate: () => void
}

export function BoilerControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-600" />
            Boiler Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Boiler control interface will include temperature setpoints, firing rate controls, 
            lead/lag settings, and safety parameters.
          </p>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded">
              <Thermometer className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <p className="text-sm font-medium">Temperature</p>
              <p className="text-xs text-gray-500">Setpoint Control</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <Flame className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <p className="text-sm font-medium">Firing Rate</p>
              <p className="text-xs text-gray-500">Output Control</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <Gauge className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <p className="text-sm font-medium">Pressure</p>
              <p className="text-xs text-gray-500">Monitoring</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <Badge className="w-6 h-6 mx-auto bg-orange-500 mb-2 flex items-center justify-center text-xs">
                L/L
              </Badge>
              <p className="text-sm font-medium">Lead/Lag</p>
              <p className="text-xs text-gray-500">Sequencing</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/air-handler-controls.tsx
import { Wind, Fan, Sliders } from "lucide-react"

export function AirHandlerControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="w-5 h-5 text-blue-600" />
            Air Handler Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Air handler control interface will include fan speed controls, temperature setpoints, 
            damper positions, and scheduling.
          </p>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded">
              <Fan className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Fan Speed</p>
              <p className="text-xs text-gray-500">Variable Control</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <Thermometer className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Temperature</p>
              <p className="text-xs text-gray-500">Setpoint Control</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <Sliders className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Dampers</p>
              <p className="text-xs text-gray-500">Position Control</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <Gauge className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Pressure</p>
              <p className="text-xs text-gray-500">Static Control</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/fan-coil-controls.tsx
export function FanCoilControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fan className="w-5 h-5 text-blue-600" />
            Fan Coil Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Fan coil control interface will include fan speed, temperature control, 
            and occupancy scheduling.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/pump-controls.tsx
import { Droplets, Power, Clock } from "lucide-react"

export function PumpControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Droplets className="w-5 h-5 text-cyan-600" />
            Pump Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Pump control interface will include on/off controls, speed settings, 
            pressure monitoring, and scheduling.
          </p>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded">
              <Power className="w-6 h-6 mx-auto text-cyan-500 mb-2" />
              <p className="text-sm font-medium">Power</p>
              <p className="text-xs text-gray-500">On/Off Control</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <Gauge className="w-6 h-6 mx-auto text-cyan-500 mb-2" />
              <p className="text-sm font-medium">Pressure</p>
              <p className="text-xs text-gray-500">Monitoring</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded">
              <Clock className="w-6 h-6 mx-auto text-cyan-500 mb-2" />
              <p className="text-sm font-medium">Schedule</p>
              <p className="text-xs text-gray-500">Time Control</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/chiller-controls.tsx
import { Snowflake } from "lucide-react"

export function ChillerControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-blue-600" />
            Chiller Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Chiller control interface will include temperature setpoints, capacity control, 
            and energy optimization settings.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/actuator-controls.tsx
import { Settings } from "lucide-react"

export function ActuatorControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-purple-600" />
            Actuator Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Actuator control interface will include position control, calibration, 
            and manual override options.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/exhaust-fan-controls.tsx
export function ExhaustFanControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Fan className="w-5 h-5 text-gray-600" />
            Exhaust Fan Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Exhaust fan control interface will include speed control, scheduling, 
            and pressure monitoring.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/heating-system-controls.tsx
export function HeatingSystemControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-orange-600" />
            Heating System Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Heating system control interface will include temperature control, 
            zone management, and scheduling for baseboard and steam systems.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/cooling-system-controls.tsx
export function CoolingSystemControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Snowflake className="w-5 h-5 text-blue-600" />
            Cooling System Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Cooling system control interface will include temperature setpoints, 
            capacity control, and efficiency optimization.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/doas-controls.tsx
export function DOASControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wind className="w-5 h-5 text-green-600" />
            DOAS Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Dedicated Outdoor Air System controls will include ventilation rates, 
            energy recovery, and air quality management.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/rtu-controls.tsx
import { Building } from "lucide-react"

export function RTUControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-purple-600" />
            RTU Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Roof Top Unit controls will include heating/cooling setpoints, 
            fan control, and economizer management.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/specialized-controls.tsx
export function SpecializedControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Thermometer className="w-5 h-5 text-green-600" />
            Specialized Controls
            <Badge variant="outline">Coming Soon</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600">
            Specialized control interface for unique equipment like greenhouse controls, 
            process equipment, and custom automation systems.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// components/controls/default-controls.tsx
export function DefaultControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building className="w-5 h-5 text-gray-600" />
            Equipment Controls
            <Badge variant="outline">Generic</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-gray-600 mb-4">
            This equipment type doesn't have a specific control interface yet. 
            Here are the available metrics and basic controls.
          </p>
          
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-900">Available Metrics:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(metrics).map(([key, value]: [string, any]) => (
                <div key={key} className="flex items-center justify-between p-3 bg-gray-50 rounded">
                  <span className="text-sm font-medium text-gray-700">{key}</span>
                  <span className="text-sm text-gray-900">
                    {typeof value.value === 'number' ? value.value.toFixed(1) : String(value.value)}
                    {value.unit && ` ${value.unit}`}
                  </span>
                </div>
              ))}
            </div>
            
            {Object.keys(metrics).length === 0 && (
              <p className="text-gray-500 italic">No metrics available for this equipment.</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
