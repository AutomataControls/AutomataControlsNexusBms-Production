// components/controls/fan-coil-controls.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Wind,
  Thermometer,
  Power,
  AlertTriangle,
  Settings,
  Clock,
  Activity,
  Send,
  Save,
  Loader2,
  AlertCircle,
  Snowflake,
  Flame,
  Gauge,
  Zap,
  Users,
  Calendar
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"

interface ControlProps {
  equipmentInfo: any
  metrics: any
  onUpdate: () => void
}

interface FanCoilSettings {
  enabled: boolean
  mode: 'heating' | 'cooling' | 'auto'
  tempSetpoint: number
  occupancyEnabled: boolean
  oaDamperMode: 'auto' | 'manual'
  oaDamperPosition: number
  cwActuatorMode: 'auto' | 'manual'
  cwActuatorPosition: number
  hwActuatorMode: 'auto' | 'manual'
  hwActuatorPosition: number
  lastModified?: string
  modifiedBy?: string
}

interface OccupancySchedule {
  [day: string]: {
    enabled: boolean
    startTime: string
    endTime: string
  }
}

interface CommandStatus {
  id?: string
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  progress?: number
}

export function FanCoilControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<FanCoilSettings>({
    enabled: false,
    mode: 'auto',
    tempSetpoint: 72,
    occupancyEnabled: false,
    oaDamperMode: 'auto',
    oaDamperPosition: 0,
    cwActuatorMode: 'auto',
    cwActuatorPosition: 0,
    hwActuatorMode: 'auto',
    hwActuatorPosition: 0
  })
  const [occupancySchedule, setOccupancySchedule] = useState<OccupancySchedule>({
    monday: { enabled: true, startTime: '08:00', endTime: '17:00' },
    tuesday: { enabled: true, startTime: '08:00', endTime: '17:00' },
    wednesday: { enabled: true, startTime: '08:00', endTime: '17:00' },
    thursday: { enabled: true, startTime: '08:00', endTime: '17:00' },
    friday: { enabled: true, startTime: '08:00', endTime: '17:00' },
    saturday: { enabled: false, startTime: '08:00', endTime: '17:00' },
    sunday: { enabled: false, startTime: '08:00', endTime: '17:00' }
  })
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false)
  const [commandStatus, setCommandStatus] = useState<CommandStatus>({ status: 'idle' })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastKnownState, setLastKnownState] = useState<FanCoilSettings | null>(null)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastModifiedRef = useRef<string>('')

  // Load initial state from Redis on component mount
  useEffect(() => {
    loadEquipmentState()
    startPolling()
    return () => stopPolling()
  }, [equipmentInfo.id])

  // Track changes for unsaved indicator
  useEffect(() => {
    if (lastKnownState) {
      const hasChanges =
        settings.enabled !== lastKnownState.enabled ||
        settings.mode !== lastKnownState.mode ||
        settings.tempSetpoint !== lastKnownState.tempSetpoint ||
        settings.occupancyEnabled !== lastKnownState.occupancyEnabled ||
        settings.oaDamperMode !== lastKnownState.oaDamperMode ||
        settings.oaDamperPosition !== lastKnownState.oaDamperPosition ||
        settings.cwActuatorMode !== lastKnownState.cwActuatorMode ||
        settings.cwActuatorPosition !== lastKnownState.cwActuatorPosition ||
        settings.hwActuatorMode !== lastKnownState.hwActuatorMode ||
        settings.hwActuatorPosition !== lastKnownState.hwActuatorPosition

      setHasUnsavedChanges(hasChanges)
    } else {
      setHasUnsavedChanges(true)
    }
  }, [settings, lastKnownState])

  // Load equipment state from Redis
  const loadEquipmentState = async () => {
    try {
      const response = await fetch(`/api/equipment/${equipmentInfo.id}/state`)
      if (response.ok) {
        const data = await response.json()

        if (data.state?.settings) {
          const newSettings = {
            enabled: data.state.settings.enabled ?? false,
            mode: data.state.settings.mode ?? 'auto',
            tempSetpoint: data.state.settings.tempSetpoint ?? 72,
            occupancyEnabled: data.state.settings.occupancyEnabled ?? false,
            oaDamperMode: data.state.settings.oaDamperMode ?? 'auto',
            oaDamperPosition: data.state.settings.oaDamperPosition ?? 0,
            cwActuatorMode: data.state.settings.cwActuatorMode ?? 'auto',
            cwActuatorPosition: data.state.settings.cwActuatorPosition ?? 0,
            hwActuatorMode: data.state.settings.hwActuatorMode ?? 'auto',
            hwActuatorPosition: data.state.settings.hwActuatorPosition ?? 0,
            lastModified: data.state.lastModified,
            modifiedBy: data.state.modifiedBy
          }

          setSettings(newSettings)
          setLastKnownState(newSettings)
          lastModifiedRef.current = data.state.lastModified || ''

          // Load occupancy schedule if present
          if (data.state.occupancySchedule) {
            setOccupancySchedule(data.state.occupancySchedule)
          }
        }
      }
    } catch (error) {
      console.error('Error loading equipment state:', error)
    }
  }

  // Start polling for state changes
  const startPolling = () => {
    if (pollIntervalRef.current) return
    pollIntervalRef.current = setInterval(async () => {
      await checkForStateChanges()
    }, 3000)
  }

  // Stop polling
  const stopPolling = () => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current)
      pollIntervalRef.current = null
    }
  }

  // Check for state changes from other users
  const checkForStateChanges = async () => {
    try {
      const response = await fetch(`/api/equipment/${equipmentInfo.id}/state`)
      if (response.ok) {
        const data = await response.json()

        if (data.state?.lastModified &&
            data.state.lastModified !== lastModifiedRef.current &&
            data.state.modifiedBy !== user?.id) {

          const newSettings = {
            enabled: data.state.settings?.enabled ?? false,
            mode: data.state.settings?.mode ?? 'auto',
            tempSetpoint: data.state.settings?.tempSetpoint ?? 72,
            occupancyEnabled: data.state.settings?.occupancyEnabled ?? false,
            oaDamperMode: data.state.settings?.oaDamperMode ?? 'auto',
            oaDamperPosition: data.state.settings?.oaDamperPosition ?? 0,
            cwActuatorMode: data.state.settings?.cwActuatorMode ?? 'auto',
            cwActuatorPosition: data.state.settings?.cwActuatorPosition ?? 0,
            hwActuatorMode: data.state.settings?.hwActuatorMode ?? 'auto',
            hwActuatorPosition: data.state.settings?.hwActuatorPosition ?? 0,
            lastModified: data.state.lastModified,
            modifiedBy: data.state.modifiedBy
          }

          setSettings(newSettings)
          setLastKnownState(newSettings)
          setHasUnsavedChanges(false)
          lastModifiedRef.current = data.state.lastModified

          // Load occupancy schedule if present
          if (data.state.occupancySchedule) {
            setOccupancySchedule(data.state.occupancySchedule)
          }

          toast({
            title: "Settings Updated",
            description: `Equipment settings were updated by ${data.state.modifiedByName || 'another user'}.`,
            duration: 4000,
          })
        }
      }
    } catch (error) {
      console.error('Error checking for state changes:', error)
    }
  }

  // Helper function to get metric value with enhanced key matching
  const getMetricValue = (key: string, defaultValue: any) => {
    const keyLower = key.toLowerCase()

    const metric = Object.entries(metrics).find(([k]) => {
      const metricKey = k.toLowerCase()
      return metricKey.includes(keyLower) ||
             (keyLower === 'supply' && (metricKey.includes('supply') || metricKey.includes('supplytemp'))) ||
             (keyLower === 'mixedair' && (metricKey.includes('mixed') || metricKey.includes('mixedair'))) ||
             (keyLower === 'oar' && (metricKey.includes('oar') || metricKey.includes('outdoor'))) ||
             (keyLower === 'amps' && (metricKey.includes('amp') || metricKey.includes('current')))
    })

    return metric ? (metric[1] as any)?.value ?? defaultValue : defaultValue
  }

  // Apply control settings via BullMQ
  const applyControlSettings = async () => {
    setCommandStatus({ status: 'pending', message: 'Queueing command...' })

    try {
      const commandData = {
        equipmentId: equipmentInfo.id,
        equipmentName: equipmentInfo.name,
        equipmentType: equipmentInfo.type,
        locationId: equipmentInfo.locationId,
        locationName: equipmentInfo.locationName,
        command: 'APPLY_CONTROL_SETTINGS',
        settings: {
          enabled: settings.enabled,
          mode: settings.mode,
          tempSetpoint: settings.tempSetpoint,
          occupancyEnabled: settings.occupancyEnabled,
          oaDamperMode: settings.oaDamperMode,
          oaDamperPosition: settings.oaDamperPosition,
          cwActuatorMode: settings.cwActuatorMode,
          cwActuatorPosition: settings.cwActuatorPosition,
          hwActuatorMode: settings.hwActuatorMode,
          hwActuatorPosition: settings.hwActuatorPosition
        },
        occupancySchedule: settings.occupancyEnabled ? occupancySchedule : null,
        userId: user?.id || 'unknown',
        userName: user?.name || user?.username || 'Unknown User'
      }

      const response = await fetch(`/api/equipment/${equipmentInfo.id}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandData)
      })

      if (!response.ok) {
        throw new Error('Failed to queue control command')
      }

      const result = await response.json()

      // Update Redis state immediately for responsive UI
      const newSettings = { ...settings, lastModified: new Date().toISOString(), modifiedBy: user?.id }
      setLastKnownState(newSettings)
      setHasUnsavedChanges(false)
      lastModifiedRef.current = newSettings.lastModified!

      // Track command status
      setCommandStatus({
        status: 'processing',
        id: result.jobId,
        message: 'Applying settings to equipment...'
      })

      // Poll for command completion
      pollCommandStatus(result.jobId)

      toast({
        title: "Controls Applied",
        description: "Fan coil control settings are being applied.",
        duration: 3000,
      })

    } catch (error) {
      console.error('Error applying control settings:', error)
      setCommandStatus({
        status: 'failed',
        message: 'Failed to apply settings. Please try again.'
      })

      toast({
        title: "Apply Failed",
        description: "Failed to apply control settings. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Save equipment configuration to InfluxDB
  const saveConfiguration = async () => {
    setLoading(true)
    try {
      const configData = {
        equipmentId: equipmentInfo.id,
        equipmentName: equipmentInfo.name,
        equipmentType: equipmentInfo.type,
        locationId: equipmentInfo.locationId,
        locationName: equipmentInfo.locationName,
        configuration: {
          enabled: settings.enabled,
          mode: settings.mode,
          tempSetpoint: settings.tempSetpoint,
          occupancyEnabled: settings.occupancyEnabled,
          occupancySchedule: settings.occupancyEnabled ? occupancySchedule : null,
          oaDamperMode: settings.oaDamperMode,
          oaDamperPosition: settings.oaDamperPosition,
          cwActuatorMode: settings.cwActuatorMode,
          cwActuatorPosition: settings.cwActuatorPosition,
          hwActuatorMode: settings.hwActuatorMode,
          hwActuatorPosition: settings.hwActuatorPosition
        },
        userId: user?.id || 'unknown',
        userName: user?.name || user?.username || 'Unknown User'
      }

      const response = await fetch('/api/influx/equipment-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(configData)
      })

      if (!response.ok) {
        throw new Error('Failed to save equipment configuration')
      }

      toast({
        title: "Configuration Saved",
        description: "Fan coil configuration has been saved to historical records.",
        duration: 3000,
      })

    } catch (error) {
      console.error('Error saving equipment configuration:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save equipment configuration. Please try again.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Poll for command completion status
  const pollCommandStatus = async (jobId: string) => {
    const checkStatus = async () => {
      try {
        const response = await fetch(`/api/equipment/${equipmentInfo.id}/status/${jobId}`)
        if (response.ok) {
          const statusData = await response.json()

          setCommandStatus({
            status: statusData.status,
            message: statusData.message,
            progress: statusData.progress
          })

          if (statusData.status === 'completed') {
            toast({
              title: "Settings Applied",
              description: "Fan coil control settings have been successfully applied.",
              duration: 3000,
            })
            // *** FIXED: Call onUpdate instead of page reload ***
            onUpdate()
            return
          } else if (statusData.status === 'failed') {
            toast({
              title: "Application Failed",
              description: statusData.message || "Failed to apply settings to equipment.",
              variant: "destructive",
            })
            return
          }

          if (statusData?.status === 'processing' || statusData?.status === 'pending') {
            setTimeout(checkStatus, 2000)
          }
        }
      } catch (error) {
        console.error('Error checking command status:', error)
        setCommandStatus({
          status: 'failed',
          message: 'Failed to check command status'
        })
      }
    }

    checkStatus()
  }

  // Emergency shutdown
  const emergencyShutdown = async () => {
    setLoading(true)
    try {
      const commandData = {
        equipmentId: equipmentInfo.id,
        command: 'EMERGENCY_SHUTDOWN',
        priority: 'high',
        userId: user?.id,
        userName: user?.name || user?.username
      }

      const response = await fetch(`/api/equipment/${equipmentInfo.id}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(commandData)
      })

      if (!response.ok) {
        throw new Error('Emergency shutdown failed')
      }

      setSettings(prev => ({ ...prev, enabled: false }))

      toast({
        title: "Emergency Shutdown",
        description: `${equipmentInfo.name} emergency shutdown initiated.`,
        variant: "destructive",
      })

    } catch (error) {
      toast({
        title: "Shutdown Failed",
        description: "Emergency shutdown failed. Contact maintenance immediately.",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  // Save occupancy schedule
  const saveOccupancySchedule = async () => {
    try {
      const scheduleData = {
        equipmentId: equipmentInfo.id,
        occupancySchedule: occupancySchedule,
        userId: user?.id || 'unknown',
        userName: user?.name || user?.username || 'Unknown User'
      }

      // Update the equipment state with new schedule
      const response = await fetch(`/api/equipment/${equipmentInfo.id}/command`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...scheduleData,
          command: 'UPDATE_OCCUPANCY_SCHEDULE',
          settings: { occupancySchedule: occupancySchedule }
        })
      })

      if (!response.ok) {
        throw new Error('Failed to save occupancy schedule')
      }

      toast({
        title: "Schedule Saved",
        description: "Occupancy schedule has been updated successfully.",
        duration: 3000,
      })

      setScheduleDialogOpen(false)

    } catch (error) {
      console.error('Error saving occupancy schedule:', error)
      toast({
        title: "Save Failed",
        description: "Failed to save occupancy schedule. Please try again.",
        variant: "destructive",
      })
    }
  }

  // Get current occupancy status
  const getCurrentOccupancyStatus = () => {
    if (!settings.occupancyEnabled) return 'Manual'

    const now = new Date()
    const currentDay = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase()
    const currentTime = now.toTimeString().slice(0, 5) // HH:MM format

    const todaySchedule = occupancySchedule[currentDay as keyof OccupancySchedule]

    if (!todaySchedule?.enabled) return 'Unoccupied'

    if (currentTime >= todaySchedule.startTime && currentTime <= todaySchedule.endTime) {
      return 'Occupied'
    }

    return 'Unoccupied'
  }
  // Get current status from metrics
  const getCurrentStatus = () => {
    const enabled = getMetricValue('enabled', false)
    const amps = getMetricValue('amps', 0)

    if (!enabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800', icon: Power }
    if (amps > 5) {
      if (settings.mode === 'heating') return { status: 'Heating', className: 'bg-red-100 text-red-800', icon: Flame }
      if (settings.mode === 'cooling') return { status: 'Cooling', className: 'bg-blue-100 text-blue-800', icon: Snowflake }
      return { status: 'Running', className: 'bg-green-100 text-green-800', icon: Wind }
    }
    if (enabled) return { status: 'Standby', className: 'bg-yellow-100 text-yellow-800', icon: Clock }
    return { status: 'Unknown', className: 'bg-gray-100 text-gray-800', icon: AlertTriangle }
  }

  const currentStatus = getCurrentStatus()
  const occupancyStatus = getCurrentOccupancyStatus()

  return (
    <div className="space-y-6">
      {/* Command Status Banner */}
      {commandStatus.status !== 'idle' && commandStatus.status !== 'completed' && (
        <Card className={`border-l-4 ${
          commandStatus.status === 'failed' ? 'border-l-red-400 bg-red-50' :
          commandStatus.status === 'processing' ? 'border-l-yellow-400 bg-yellow-50' :
          'border-l-blue-400 bg-blue-50'
        }`}>
          <CardContent className="py-3">
            <div className="flex items-center gap-3">
              {commandStatus.status === 'failed' ? (
                <AlertCircle className="w-5 h-5 text-red-600" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
              )}
              <div className="flex-1">
                <p className="font-medium text-sm">
                  {commandStatus.status === 'pending' && 'Command Queued'}
                  {commandStatus.status === 'processing' && 'Applying Settings'}
                  {commandStatus.status === 'failed' && 'Command Failed'}
                </p>
                <p className="text-xs text-gray-600">{commandStatus.message}</p>
              </div>
              {commandStatus.progress && (
                <div className="text-sm font-medium">{commandStatus.progress}%</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Status Overview Card */}
      <Card className="border-l-4 border-l-blue-400">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-blue-600" />
              Fan Coil Status & Controls
              {hasUnsavedChanges && (
                <Badge className="bg-yellow-100 text-yellow-800 border border-yellow-200 ml-2">
                  Unsaved Changes
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Badge className={`${currentStatus.className} flex items-center gap-1`}>
                <currentStatus.icon className="w-3 h-3" />
                {currentStatus.status}
              </Badge>
              <Badge className={`${
                settings.mode === 'heating' ? 'bg-red-100 text-red-800' :
                settings.mode === 'cooling' ? 'bg-blue-100 text-blue-800' :
                'bg-green-100 text-green-800'
              } border`}>
                {settings.mode.charAt(0).toUpperCase() + settings.mode.slice(1)}
              </Badge>
              <Badge className={`${
                occupancyStatus === 'Occupied' ? 'bg-green-100 text-green-800' :
                occupancyStatus === 'Unoccupied' ? 'bg-gray-100 text-gray-800' :
                'bg-blue-100 text-blue-800'
              } border flex items-center gap-1`}>
                <Users className="w-3 h-3" />
                {occupancyStatus}
              </Badge>
            </div>
          </div>
          {settings.lastModified && settings.modifiedBy !== user?.id && (
            <p className="text-xs text-gray-500">
              Last updated: {new Date(settings.lastModified).toLocaleString()} by {settings.modifiedBy}
            </p>
          )}
        </CardHeader>

        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Thermometer className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <p className="text-sm font-medium">Supply Temp</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('supply', '--') !== '--' ? `${getMetricValue('supply', '--')}°F` : '--'}
              </p>
              <p className="text-xs text-gray-500">
                Target: {settings.tempSetpoint}°F
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Wind className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Mixed Air Temp</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('mixedair', '--') !== '--' ? `${getMetricValue('mixedair', '--')}°F` : '--'}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Thermometer className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <p className="text-sm font-medium">OAR Temp</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('oar', '--') !== '--' ? `${getMetricValue('oar', '--')}°F` : '--'}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Zap className="w-6 h-6 mx-auto text-yellow-500 mb-2" />
              <p className="text-sm font-medium">Fan Amps</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('amps', '--') !== '--' ? `${getMetricValue('amps', '--')}A` : '--'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Fan Coil Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Fan Coil Enable</Label>
              <p className="text-sm text-gray-500">Turn fan coil unit on/off</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings(prev => ({ ...prev, enabled }))}
              disabled={loading || commandStatus.status === 'processing'}
            />
          </div>

          {/* Occupancy Control */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Occupancy Control</Label>
              <p className="text-sm text-gray-500">Enable automatic occupancy-based scheduling</p>
            </div>
            <div className="flex items-center gap-3">
              <Dialog open={scheduleDialogOpen} onOpenChange={setScheduleDialogOpen}>
                <DialogTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={!settings.occupancyEnabled}
                  >
                    <Calendar className="w-4 h-4 mr-2" />
                    Schedule
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>Weekly Occupancy Schedule</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    {Object.entries(occupancySchedule).map(([day, schedule]) => (
                      <div key={day} className="flex items-center gap-4 p-3 border rounded-lg">
                        <div className="w-20">
                          <Label className="capitalize font-medium">{day}</Label>
                        </div>
                        <Switch
                          checked={schedule.enabled}
                          onCheckedChange={(enabled) =>
                            setOccupancySchedule(prev => ({
                              ...prev,
                              [day]: { ...prev[day as keyof OccupancySchedule], enabled }
                            }))
                          }
                        />
                        {schedule.enabled && (
                          <>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">Start:</Label>
                              <Input
                                type="time"
                                value={schedule.startTime}
                                onChange={(e) =>
                                  setOccupancySchedule(prev => ({
                                    ...prev,
                                    [day]: { ...prev[day as keyof OccupancySchedule], startTime: e.target.value }
                                  }))
                                }
                                className="w-24"
                              />
                            </div>
                            <div className="flex items-center gap-2">
                              <Label className="text-sm">End:</Label>
                              <Input
                                type="time"
                                value={schedule.endTime}
                                onChange={(e) =>
                                  setOccupancySchedule(prev => ({
                                    ...prev,
                                    [day]: { ...prev[day as keyof OccupancySchedule], endTime: e.target.value }
                                  }))
                                }
                                className="w-24"
                              />
                            </div>
                          </>
                        )}
                      </div>
                    ))}
                    <div className="flex justify-end gap-2 pt-4">
                      <Button
                        variant="outline"
                        onClick={() => setScheduleDialogOpen(false)}
                      >
                        Cancel
                      </Button>
                      <Button onClick={saveOccupancySchedule}>
                        Save Schedule
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Switch
                checked={settings.occupancyEnabled}
                onCheckedChange={(occupancyEnabled) => setSettings(prev => ({ ...prev, occupancyEnabled }))}
                disabled={loading || commandStatus.status === 'processing'}
              />
            </div>
          </div>

          {/* Mode Selection */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <Label className="text-base font-medium">Operating Mode</Label>
            <Select
              value={settings.mode}
              onValueChange={(mode: 'heating' | 'cooling' | 'auto') =>
                setSettings(prev => ({ ...prev, mode }))
              }
              disabled={loading || commandStatus.status === 'processing'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Auto</SelectItem>
                <SelectItem value="heating">Heating</SelectItem>
                <SelectItem value="cooling">Cooling</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Auto mode switches between heating and cooling automatically
            </p>
          </div>

          {/* Temperature Setpoint */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Temperature Setpoint</Label>
              <span className="text-lg font-bold text-gray-900">{settings.tempSetpoint}°F</span>
            </div>
            <Slider
              value={[settings.tempSetpoint]}
              onValueChange={([value]) => setSettings(prev => ({ ...prev, tempSetpoint: value }))}
              min={60}
              max={85}
              step={1}
              className="w-full"
              disabled={loading || commandStatus.status === 'processing'}
            />
            <div className="flex justify-between text-sm text-gray-500">
              <span>60°F</span>
              <span>72°F</span>
              <span>85°F</span>
            </div>
          </div>

          {/* OA Damper Controls */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">OA Damper</Label>
              <Select
                value={settings.oaDamperMode}
                onValueChange={(mode: 'auto' | 'manual') =>
                  setSettings(prev => ({ ...prev, oaDamperMode: mode }))
                }
                disabled={loading || commandStatus.status === 'processing'}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {settings.oaDamperMode === 'manual' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Position</span>
                  <span className="text-sm font-medium">{settings.oaDamperPosition}%</span>
                </div>
                <Slider
                  value={[settings.oaDamperPosition]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, oaDamperPosition: value }))}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  disabled={loading || commandStatus.status === 'processing'}
                />
              </>
            )}
          </div>

          {/* CW Actuator Controls */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">CW Actuator (Cooling)</Label>
              <Select
                value={settings.cwActuatorMode}
                onValueChange={(mode: 'auto' | 'manual') =>
                  setSettings(prev => ({ ...prev, cwActuatorMode: mode }))
                }
                disabled={loading || commandStatus.status === 'processing'}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {settings.cwActuatorMode === 'manual' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Position</span>
                  <span className="text-sm font-medium">{settings.cwActuatorPosition}%</span>
                </div>
                <Slider
                  value={[settings.cwActuatorPosition]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, cwActuatorPosition: value }))}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  disabled={loading || commandStatus.status === 'processing'}
                />
              </>
            )}
          </div>

          {/* HW Actuator Controls */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">HW Actuator (Heating)</Label>
              <Select
                value={settings.hwActuatorMode}
                onValueChange={(mode: 'auto' | 'manual') =>
                  setSettings(prev => ({ ...prev, hwActuatorMode: mode }))
                }
                disabled={loading || commandStatus.status === 'processing'}
              >
                <SelectTrigger className="w-24">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Auto</SelectItem>
                  <SelectItem value="manual">Manual</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {settings.hwActuatorMode === 'manual' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Position</span>
                  <span className="text-sm font-medium">{settings.hwActuatorPosition}%</span>
                </div>
                <Slider
                  value={[settings.hwActuatorPosition]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, hwActuatorPosition: value }))}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  disabled={loading || commandStatus.status === 'processing'}
                />
              </>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Action Buttons */}
      <div className="flex items-center justify-between pt-4 border-t">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={onUpdate} // *** FIXED: Use onUpdate instead of page reload ***
            disabled={loading}
          >
            <Activity className="w-4 h-4 mr-2" />
            Refresh Data
          </Button>

          {/* Apply Controls Button */}
          <Button
            onClick={applyControlSettings}
            disabled={commandStatus.status === 'processing'}
            className="bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 hover:border-green-300 disabled:opacity-50"
          >
            {commandStatus.status === 'processing' ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Send className="w-4 h-4 mr-2" />
            )}
            {commandStatus.status === 'processing' ? "Applying..." : "Apply Controls"}
          </Button>

          {/* Save Configuration Button */}
          <Button
            onClick={saveConfiguration}
            disabled={loading}
            className="bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 hover:border-blue-300"
          >
            <Save className="w-4 h-4 mr-2" />
            {loading ? "Saving..." : "Save Configuration"}
          </Button>
        </div>

        <Button
          variant="destructive"
          onClick={emergencyShutdown}
          disabled={loading}
          className="bg-red-600 hover:bg-red-700"
        >
          <AlertTriangle className="w-4 h-4 mr-2" />
          Emergency Stop
        </Button>
      </div>

      {/* Current Metrics Display */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="w-4 h-4" />
            Live Metrics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {Object.entries(metrics).map(([key, value]: [string, any]) => (
              <div key={key} className="text-center p-3 bg-gray-50 rounded">
                <p className="text-xs font-medium text-gray-600 mb-1">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </p>
                <p className="text-sm font-bold text-gray-900">
                  {typeof value.value === 'number' ? value.value.toFixed(1) : String(value.value)}
                  {value.unit && ` ${value.unit}`}
                </p>
              </div>
            ))}
          </div>

          {Object.keys(metrics).length === 0 && (
            <p className="text-center text-gray-500 py-8">
              No live metrics available for this fan coil unit.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
