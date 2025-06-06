// components/controls/air-handler-controls.tsx
"use client"

import { useState, useEffect, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  Fan,
  Filter
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"

interface ControlProps {
  equipmentInfo: any
  metrics: any
  onUpdate: () => void
}

interface AirHandlerSettings {
  enabled: boolean
  mode: 'heating' | 'cooling' | 'auto' | 'economizer'
  fanMode: 'auto' | 'manual'
  fanSpeed: number
  supplyTempSetpoint: number
  mixedAirTempSetpoint: number
  oaDamperMode: 'auto' | 'manual'
  oaDamperPosition: number
  raDamperMode: 'auto' | 'manual'
  raDamperPosition: number
  heatingValveMode: 'auto' | 'manual'
  heatingValvePosition: number
  coolingValveMode: 'auto' | 'manual'
  coolingValvePosition: number
  eaFanEnabled: boolean
  filterAlarmEnabled: boolean
  lastModified?: string
  modifiedBy?: string
}

interface CommandStatus {
  id?: string
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  progress?: number
}

export function AirHandlerControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<AirHandlerSettings>({
    enabled: false,
    mode: 'auto',
    fanMode: 'auto',
    fanSpeed: 75,
    supplyTempSetpoint: 55,
    mixedAirTempSetpoint: 50,
    oaDamperMode: 'auto',
    oaDamperPosition: 15,
    raDamperMode: 'auto',
    raDamperPosition: 85,
    heatingValveMode: 'auto',
    heatingValvePosition: 0,
    coolingValveMode: 'auto',
    coolingValvePosition: 0,
    eaFanEnabled: false,
    filterAlarmEnabled: true
  })
  const [commandStatus, setCommandStatus] = useState<CommandStatus>({ status: 'idle' })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastKnownState, setLastKnownState] = useState<AirHandlerSettings | null>(null)
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
        settings.fanMode !== lastKnownState.fanMode ||
        settings.fanSpeed !== lastKnownState.fanSpeed ||
        settings.supplyTempSetpoint !== lastKnownState.supplyTempSetpoint ||
        settings.mixedAirTempSetpoint !== lastKnownState.mixedAirTempSetpoint ||
        settings.oaDamperMode !== lastKnownState.oaDamperMode ||
        settings.oaDamperPosition !== lastKnownState.oaDamperPosition ||
        settings.raDamperMode !== lastKnownState.raDamperMode ||
        settings.raDamperPosition !== lastKnownState.raDamperPosition ||
        settings.heatingValveMode !== lastKnownState.heatingValveMode ||
        settings.heatingValvePosition !== lastKnownState.heatingValvePosition ||
        settings.coolingValveMode !== lastKnownState.coolingValveMode ||
        settings.coolingValvePosition !== lastKnownState.coolingValvePosition ||
        settings.eaFanEnabled !== lastKnownState.eaFanEnabled ||
        settings.filterAlarmEnabled !== lastKnownState.filterAlarmEnabled

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
            fanMode: data.state.settings.fanMode ?? 'auto',
            fanSpeed: data.state.settings.fanSpeed ?? 75,
            supplyTempSetpoint: data.state.settings.supplyTempSetpoint ?? 55,
            mixedAirTempSetpoint: data.state.settings.mixedAirTempSetpoint ?? 50,
            oaDamperMode: data.state.settings.oaDamperMode ?? 'auto',
            oaDamperPosition: data.state.settings.oaDamperPosition ?? 15,
            raDamperMode: data.state.settings.raDamperMode ?? 'auto',
            raDamperPosition: data.state.settings.raDamperPosition ?? 85,
            heatingValveMode: data.state.settings.heatingValveMode ?? 'auto',
            heatingValvePosition: data.state.settings.heatingValvePosition ?? 0,
            coolingValveMode: data.state.settings.coolingValveMode ?? 'auto',
            coolingValvePosition: data.state.settings.coolingValvePosition ?? 0,
            eaFanEnabled: data.state.settings.eaFanEnabled ?? false,
            filterAlarmEnabled: data.state.settings.filterAlarmEnabled ?? true,
            lastModified: data.state.lastModified,
            modifiedBy: data.state.modifiedBy
          }

          setSettings(newSettings)
          setLastKnownState(newSettings)
          lastModifiedRef.current = data.state.lastModified || ''
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
            fanMode: data.state.settings?.fanMode ?? 'auto',
            fanSpeed: data.state.settings?.fanSpeed ?? 75,
            supplyTempSetpoint: data.state.settings?.supplyTempSetpoint ?? 55,
            mixedAirTempSetpoint: data.state.settings?.mixedAirTempSetpoint ?? 50,
            oaDamperMode: data.state.settings?.oaDamperMode ?? 'auto',
            oaDamperPosition: data.state.settings?.oaDamperPosition ?? 15,
            raDamperMode: data.state.settings?.raDamperMode ?? 'auto',
            raDamperPosition: data.state.settings?.raDamperPosition ?? 85,
            heatingValveMode: data.state.settings?.heatingValveMode ?? 'auto',
            heatingValvePosition: data.state.settings?.heatingValvePosition ?? 0,
            coolingValveMode: data.state.settings?.coolingValveMode ?? 'auto',
            coolingValvePosition: data.state.settings?.coolingValvePosition ?? 0,
            eaFanEnabled: data.state.settings?.eaFanEnabled ?? false,
            filterAlarmEnabled: data.state.settings?.filterAlarmEnabled ?? true,
            lastModified: data.state.lastModified,
            modifiedBy: data.state.modifiedBy
          }

          setSettings(newSettings)
          setLastKnownState(newSettings)
          setHasUnsavedChanges(false)
          lastModifiedRef.current = data.state.lastModified

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
             (keyLower === 'return' && (metricKey.includes('return') || metricKey.includes('returntemp'))) ||
             (keyLower === 'mixed' && (metricKey.includes('mixed') || metricKey.includes('mixedair'))) ||
             (keyLower === 'outdoor' && (metricKey.includes('outdoor') || metricKey.includes('oat'))) ||
             (keyLower === 'fanspeed' && (metricKey.includes('fan') && metricKey.includes('speed'))) ||
             (keyLower === 'amps' && (metricKey.includes('amp') || metricKey.includes('current'))) ||
             (keyLower === 'filter' && (metricKey.includes('filter') || metricKey.includes('differential')))
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
          fanMode: settings.fanMode,
          fanSpeed: settings.fanSpeed,
          supplyTempSetpoint: settings.supplyTempSetpoint,
          mixedAirTempSetpoint: settings.mixedAirTempSetpoint,
          oaDamperMode: settings.oaDamperMode,
          oaDamperPosition: settings.oaDamperPosition,
          raDamperMode: settings.raDamperMode,
          raDamperPosition: settings.raDamperPosition,
          heatingValveMode: settings.heatingValveMode,
          heatingValvePosition: settings.heatingValvePosition,
          coolingValveMode: settings.coolingValveMode,
          coolingValvePosition: settings.coolingValvePosition,
          eaFanEnabled: settings.eaFanEnabled,
          filterAlarmEnabled: settings.filterAlarmEnabled
        },
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
        description: "Air handler control settings are being applied.",
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
          fanMode: settings.fanMode,
          fanSpeed: settings.fanSpeed,
          supplyTempSetpoint: settings.supplyTempSetpoint,
          mixedAirTempSetpoint: settings.mixedAirTempSetpoint,
          oaDamperMode: settings.oaDamperMode,
          oaDamperPosition: settings.oaDamperPosition,
          raDamperMode: settings.raDamperMode,
          raDamperPosition: settings.raDamperPosition,
          heatingValveMode: settings.heatingValveMode,
          heatingValvePosition: settings.heatingValvePosition,
          coolingValveMode: settings.coolingValveMode,
          coolingValvePosition: settings.coolingValvePosition,
          eaFanEnabled: settings.eaFanEnabled,
          filterAlarmEnabled: settings.filterAlarmEnabled
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
        description: "Air handler configuration has been saved to historical records.",
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
              description: "Air handler control settings have been successfully applied.",
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

  // Get current status from metrics
  const getCurrentStatus = () => {
    const enabled = getMetricValue('enabled', false)
    const fanSpeed = getMetricValue('fanspeed', 0)
    const amps = getMetricValue('amps', 0)

    if (!enabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800', icon: Power }
    if (fanSpeed > 0 && amps > 1) {
      if (settings.mode === 'heating') return { status: 'Heating', className: 'bg-red-100 text-red-800', icon: Flame }
      if (settings.mode === 'cooling') return { status: 'Cooling', className: 'bg-blue-100 text-blue-800', icon: Snowflake }
      if (settings.mode === 'economizer') return { status: 'Economizer', className: 'bg-green-100 text-green-800', icon: Wind }
      return { status: 'Running', className: 'bg-green-100 text-green-800', icon: Fan }
    }
    if (enabled) return { status: 'Standby', className: 'bg-yellow-100 text-yellow-800', icon: Clock }
    return { status: 'Unknown', className: 'bg-gray-100 text-gray-800', icon: AlertTriangle }
  }

  // Get filter status
  const getFilterStatus = () => {
    const filterDiff = getMetricValue('filter', 0)
    if (!settings.filterAlarmEnabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800' }
    if (filterDiff > 2.0) return { status: 'Replace', className: 'bg-red-100 text-red-800' }
    if (filterDiff > 1.5) return { status: 'Warning', className: 'bg-yellow-100 text-yellow-800' }
    return { status: 'Good', className: 'bg-green-100 text-green-800' }
  }

  const currentStatus = getCurrentStatus()
  const filterStatus = getFilterStatus()

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
      <Card className="border-l-4 border-l-indigo-400">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Fan className="w-5 h-5 text-indigo-600" />
              Air Handler Status & Controls
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
                settings.mode === 'economizer' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              } border`}>
                {settings.mode.charAt(0).toUpperCase() + settings.mode.slice(1)}
              </Badge>
              <Badge className={`${filterStatus.className} border flex items-center gap-1`}>
                <Filter className="w-3 h-3" />
                Filter: {filterStatus.status}
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
                Target: {settings.supplyTempSetpoint}°F
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Thermometer className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Return Temp</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('return', '--') !== '--' ? `${getMetricValue('return', '--')}°F` : '--'}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Wind className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <p className="text-sm font-medium">Mixed Air Temp</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('mixed', '--') !== '--' ? `${getMetricValue('mixed', '--')}°F` : '--'}
              </p>
              <p className="text-xs text-gray-500">
                Target: {settings.mixedAirTempSetpoint}°F
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Thermometer className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <p className="text-sm font-medium">Outdoor Temp</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('outdoor', '--') !== '--' ? `${getMetricValue('outdoor', '--')}°F` : '--'}
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
            Air Handler Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Air Handler Enable</Label>
              <p className="text-sm text-gray-500">Turn air handler system on/off</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings(prev => ({ ...prev, enabled }))}
              disabled={loading || commandStatus.status === 'processing'}
            />
          </div>

          {/* Operating Mode */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <Label className="text-base font-medium">Operating Mode</Label>
            <Select
              value={settings.mode}
              onValueChange={(mode: 'heating' | 'cooling' | 'auto' | 'economizer') =>
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
                <SelectItem value="economizer">Economizer</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Auto mode switches between heating, cooling, and economizer automatically
            </p>
          </div>

          {/* Fan Controls */}
          <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Fan Control</Label>
              <Select
                value={settings.fanMode}
                onValueChange={(fanMode: 'auto' | 'manual') =>
                  setSettings(prev => ({ ...prev, fanMode }))
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
            {settings.fanMode === 'manual' && (
              <>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Fan Speed</span>
                  <span className="text-sm font-bold">{settings.fanSpeed}%</span>
                </div>
                <Slider
                  value={[settings.fanSpeed]}
                  onValueChange={([value]) => setSettings(prev => ({ ...prev, fanSpeed: value }))}
                  min={0}
                  max={100}
                  step={5}
                  className="w-full"
                  disabled={loading || commandStatus.status === 'processing'}
                />
              </>
            )}
          </div>

          {/* Temperature Setpoints */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Supply Temperature Setpoint */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Supply Temp Setpoint</Label>
                <span className="text-lg font-bold text-gray-900">{settings.supplyTempSetpoint}°F</span>
              </div>
              <Slider
                value={[settings.supplyTempSetpoint]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, supplyTempSetpoint: value }))}
                min={45}
                max={85}
                step={1}
                className="w-full"
                disabled={loading || commandStatus.status === 'processing'}
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>45°F</span>
                <span>65°F</span>
                <span>85°F</span>
              </div>
            </div>

            {/* Mixed Air Temperature Setpoint */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Mixed Air Setpoint</Label>
                <span className="text-lg font-bold text-gray-900">{settings.mixedAirTempSetpoint}°F</span>
              </div>
              <Slider
                value={[settings.mixedAirTempSetpoint]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, mixedAirTempSetpoint: value }))}
                min={40}
                max={80}
                step={1}
                className="w-full"
                disabled={loading || commandStatus.status === 'processing'}
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>40°F</span>
                <span>60°F</span>
                <span>80°F</span>
              </div>
            </div>
          </div>

          {/* Damper Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* OA Damper */}
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

            {/* RA Damper */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">RA Damper</Label>
                <Select
                  value={settings.raDamperMode}
                  onValueChange={(mode: 'auto' | 'manual') =>
                    setSettings(prev => ({ ...prev, raDamperMode: mode }))
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
              {settings.raDamperMode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Position</span>
                    <span className="text-sm font-medium">{settings.raDamperPosition}%</span>
                  </div>
                  <Slider
                    value={[settings.raDamperPosition]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, raDamperPosition: value }))}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                </>
              )}
            </div>
          </div>

          {/* Valve Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Heating Valve */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Heating Valve</Label>
                <Select
                  value={settings.heatingValveMode}
                  onValueChange={(mode: 'auto' | 'manual') =>
                    setSettings(prev => ({ ...prev, heatingValveMode: mode }))
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
              {settings.heatingValveMode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Position</span>
                    <span className="text-sm font-medium">{settings.heatingValvePosition}%</span>
                  </div>
                  <Slider
                    value={[settings.heatingValvePosition]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, heatingValvePosition: value }))}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                </>
              )}
            </div>

            {/* Cooling Valve */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Cooling Valve</Label>
                <Select
                  value={settings.coolingValveMode}
                  onValueChange={(mode: 'auto' | 'manual') =>
                    setSettings(prev => ({ ...prev, coolingValveMode: mode }))
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
              {settings.coolingValveMode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Position</span>
                    <span className="text-sm font-medium">{settings.coolingValvePosition}%</span>
                  </div>
                  <Slider
                    value={[settings.coolingValvePosition]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, coolingValvePosition: value }))}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                </>
              )}
            </div>
          </div>

          {/* Additional Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Exhaust Air Fan */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-base font-medium">Exhaust Air Fan</Label>
                <p className="text-sm text-gray-500">Enable exhaust air fan operation</p>
              </div>
              <Switch
                checked={settings.eaFanEnabled}
                onCheckedChange={(eaFanEnabled) => setSettings(prev => ({ ...prev, eaFanEnabled }))}
                disabled={loading || commandStatus.status === 'processing'}
              />
            </div>

            {/* Filter Alarm */}
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-base font-medium">Filter Alarm</Label>
                <p className="text-sm text-gray-500">Enable filter differential pressure alarm</p>
              </div>
              <Switch
                checked={settings.filterAlarmEnabled}
                onCheckedChange={(filterAlarmEnabled) => setSettings(prev => ({ ...prev, filterAlarmEnabled }))}
                disabled={loading || commandStatus.status === 'processing'}
              />
            </div>
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
              No live metrics available for this air handler.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
