// components/controls/doas-controls.tsx
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
  Droplets,
  Zap,
  Fan,
  Filter,
  RotateCcw,
  Gauge
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"

interface ControlProps {
  equipmentInfo: any
  metrics: any
  onUpdate: () => void
}

interface DOASSettings {
  enabled: boolean
  mode: 'heating' | 'cooling' | 'auto' | 'ventilation'
  supplyFanMode: 'auto' | 'manual'
  supplyFanSpeed: number
  exhaustFanMode: 'auto' | 'manual'
  exhaustFanSpeed: number
  supplyTempSetpoint: number
  supplyHumiditySetpoint: number
  ervEnabled: boolean
  ervBypassMode: 'auto' | 'manual'
  ervBypassPosition: number
  heatingCoilMode: 'auto' | 'manual'
  heatingCoilPosition: number
  coolingCoilMode: 'auto' | 'manual'
  coolingCoilPosition: number
  reheatCoilMode: 'auto' | 'manual'
  reheatCoilPosition: number
  filterAlarmEnabled: boolean
  energyRecoveryEnabled: boolean
  demandControlVentilation: boolean
  co2Setpoint: number
  lastModified?: string
  modifiedBy?: string
}

interface CommandStatus {
  id?: string
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  progress?: number
}

export function DOASControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<DOASSettings>({
    enabled: false,
    mode: 'auto',
    supplyFanMode: 'auto',
    supplyFanSpeed: 75,
    exhaustFanMode: 'auto',
    exhaustFanSpeed: 75,
    supplyTempSetpoint: 68,
    supplyHumiditySetpoint: 50,
    ervEnabled: true,
    ervBypassMode: 'auto',
    ervBypassPosition: 0,
    heatingCoilMode: 'auto',
    heatingCoilPosition: 0,
    coolingCoilMode: 'auto',
    coolingCoilPosition: 0,
    reheatCoilMode: 'auto',
    reheatCoilPosition: 0,
    filterAlarmEnabled: true,
    energyRecoveryEnabled: true,
    demandControlVentilation: false,
    co2Setpoint: 1000
  })
  const [commandStatus, setCommandStatus] = useState<CommandStatus>({ status: 'idle' })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastKnownState, setLastKnownState] = useState<DOASSettings | null>(null)
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
        settings.supplyFanMode !== lastKnownState.supplyFanMode ||
        settings.supplyFanSpeed !== lastKnownState.supplyFanSpeed ||
        settings.exhaustFanMode !== lastKnownState.exhaustFanMode ||
        settings.exhaustFanSpeed !== lastKnownState.exhaustFanSpeed ||
        settings.supplyTempSetpoint !== lastKnownState.supplyTempSetpoint ||
        settings.supplyHumiditySetpoint !== lastKnownState.supplyHumiditySetpoint ||
        settings.ervEnabled !== lastKnownState.ervEnabled ||
        settings.ervBypassMode !== lastKnownState.ervBypassMode ||
        settings.ervBypassPosition !== lastKnownState.ervBypassPosition ||
        settings.heatingCoilMode !== lastKnownState.heatingCoilMode ||
        settings.heatingCoilPosition !== lastKnownState.heatingCoilPosition ||
        settings.coolingCoilMode !== lastKnownState.coolingCoilMode ||
        settings.coolingCoilPosition !== lastKnownState.coolingCoilPosition ||
        settings.reheatCoilMode !== lastKnownState.reheatCoilMode ||
        settings.reheatCoilPosition !== lastKnownState.reheatCoilPosition ||
        settings.filterAlarmEnabled !== lastKnownState.filterAlarmEnabled ||
        settings.energyRecoveryEnabled !== lastKnownState.energyRecoveryEnabled ||
        settings.demandControlVentilation !== lastKnownState.demandControlVentilation ||
        settings.co2Setpoint !== lastKnownState.co2Setpoint

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
            supplyFanMode: data.state.settings.supplyFanMode ?? 'auto',
            supplyFanSpeed: data.state.settings.supplyFanSpeed ?? 75,
            exhaustFanMode: data.state.settings.exhaustFanMode ?? 'auto',
            exhaustFanSpeed: data.state.settings.exhaustFanSpeed ?? 75,
            supplyTempSetpoint: data.state.settings.supplyTempSetpoint ?? 68,
            supplyHumiditySetpoint: data.state.settings.supplyHumiditySetpoint ?? 50,
            ervEnabled: data.state.settings.ervEnabled ?? true,
            ervBypassMode: data.state.settings.ervBypassMode ?? 'auto',
            ervBypassPosition: data.state.settings.ervBypassPosition ?? 0,
            heatingCoilMode: data.state.settings.heatingCoilMode ?? 'auto',
            heatingCoilPosition: data.state.settings.heatingCoilPosition ?? 0,
            coolingCoilMode: data.state.settings.coolingCoilMode ?? 'auto',
            coolingCoilPosition: data.state.settings.coolingCoilPosition ?? 0,
            reheatCoilMode: data.state.settings.reheatCoilMode ?? 'auto',
            reheatCoilPosition: data.state.settings.reheatCoilPosition ?? 0,
            filterAlarmEnabled: data.state.settings.filterAlarmEnabled ?? true,
            energyRecoveryEnabled: data.state.settings.energyRecoveryEnabled ?? true,
            demandControlVentilation: data.state.settings.demandControlVentilation ?? false,
            co2Setpoint: data.state.settings.co2Setpoint ?? 1000,
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
            supplyFanMode: data.state.settings?.supplyFanMode ?? 'auto',
            supplyFanSpeed: data.state.settings?.supplyFanSpeed ?? 75,
            exhaustFanMode: data.state.settings?.exhaustFanMode ?? 'auto',
            exhaustFanSpeed: data.state.settings?.exhaustFanSpeed ?? 75,
            supplyTempSetpoint: data.state.settings?.supplyTempSetpoint ?? 68,
            supplyHumiditySetpoint: data.state.settings?.supplyHumiditySetpoint ?? 50,
            ervEnabled: data.state.settings?.ervEnabled ?? true,
            ervBypassMode: data.state.settings?.ervBypassMode ?? 'auto',
            ervBypassPosition: data.state.settings?.ervBypassPosition ?? 0,
            heatingCoilMode: data.state.settings?.heatingCoilMode ?? 'auto',
            heatingCoilPosition: data.state.settings?.heatingCoilPosition ?? 0,
            coolingCoilMode: data.state.settings?.coolingCoilMode ?? 'auto',
            coolingCoilPosition: data.state.settings?.coolingCoilPosition ?? 0,
            reheatCoilMode: data.state.settings?.reheatCoilMode ?? 'auto',
            reheatCoilPosition: data.state.settings?.reheatCoilPosition ?? 0,
            filterAlarmEnabled: data.state.settings?.filterAlarmEnabled ?? true,
            energyRecoveryEnabled: data.state.settings?.energyRecoveryEnabled ?? true,
            demandControlVentilation: data.state.settings?.demandControlVentilation ?? false,
            co2Setpoint: data.state.settings?.co2Setpoint ?? 1000,
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
             (keyLower === 'exhaust' && (metricKey.includes('exhaust') || metricKey.includes('ea'))) ||
             (keyLower === 'outdoor' && (metricKey.includes('outdoor') || metricKey.includes('oa') || metricKey.includes('oat'))) ||
             (keyLower === 'humidity' && (metricKey.includes('humidity') || metricKey.includes('rh'))) ||
             (keyLower === 'co2' && (metricKey.includes('co2') || metricKey.includes('carbon'))) ||
             (keyLower === 'erv' && (metricKey.includes('erv') || metricKey.includes('recovery'))) ||
             (keyLower === 'filter' && (metricKey.includes('filter') || metricKey.includes('differential'))) ||
             (keyLower === 'fanspeed' && (metricKey.includes('fan') && metricKey.includes('speed'))) ||
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
          supplyFanMode: settings.supplyFanMode,
          supplyFanSpeed: settings.supplyFanSpeed,
          exhaustFanMode: settings.exhaustFanMode,
          exhaustFanSpeed: settings.exhaustFanSpeed,
          supplyTempSetpoint: settings.supplyTempSetpoint,
          supplyHumiditySetpoint: settings.supplyHumiditySetpoint,
          ervEnabled: settings.ervEnabled,
          ervBypassMode: settings.ervBypassMode,
          ervBypassPosition: settings.ervBypassPosition,
          heatingCoilMode: settings.heatingCoilMode,
          heatingCoilPosition: settings.heatingCoilPosition,
          coolingCoilMode: settings.coolingCoilMode,
          coolingCoilPosition: settings.coolingCoilPosition,
          reheatCoilMode: settings.reheatCoilMode,
          reheatCoilPosition: settings.reheatCoilPosition,
          filterAlarmEnabled: settings.filterAlarmEnabled,
          energyRecoveryEnabled: settings.energyRecoveryEnabled,
          demandControlVentilation: settings.demandControlVentilation,
          co2Setpoint: settings.co2Setpoint
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
        description: "DOAS control settings are being applied.",
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
          supplyFanMode: settings.supplyFanMode,
          supplyFanSpeed: settings.supplyFanSpeed,
          exhaustFanMode: settings.exhaustFanMode,
          exhaustFanSpeed: settings.exhaustFanSpeed,
          supplyTempSetpoint: settings.supplyTempSetpoint,
          supplyHumiditySetpoint: settings.supplyHumiditySetpoint,
          ervEnabled: settings.ervEnabled,
          ervBypassMode: settings.ervBypassMode,
          ervBypassPosition: settings.ervBypassPosition,
          heatingCoilMode: settings.heatingCoilMode,
          heatingCoilPosition: settings.heatingCoilPosition,
          coolingCoilMode: settings.coolingCoilMode,
          coolingCoilPosition: settings.coolingCoilPosition,
          reheatCoilMode: settings.reheatCoilMode,
          reheatCoilPosition: settings.reheatCoilPosition,
          filterAlarmEnabled: settings.filterAlarmEnabled,
          energyRecoveryEnabled: settings.energyRecoveryEnabled,
          demandControlVentilation: settings.demandControlVentilation,
          co2Setpoint: settings.co2Setpoint
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
        description: "DOAS configuration has been saved to historical records.",
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
              description: "DOAS control settings have been successfully applied.",
              duration: 3000,
            })
            onUpdate() // Refresh metrics
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
    const supplyFanSpeed = getMetricValue('fanspeed', 0)
    const amps = getMetricValue('amps', 0)

    if (!enabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800', icon: Power }
    if (supplyFanSpeed > 0 && amps > 1) {
      if (settings.mode === 'heating') return { status: 'Heating', className: 'bg-red-100 text-red-800', icon: Flame }
      if (settings.mode === 'cooling') return { status: 'Cooling', className: 'bg-blue-100 text-blue-800', icon: Snowflake }
      if (settings.mode === 'ventilation') return { status: 'Ventilating', className: 'bg-green-100 text-green-800', icon: Wind }
      return { status: 'Running', className: 'bg-green-100 text-green-800', icon: Fan }
    }
    if (enabled) return { status: 'Standby', className: 'bg-yellow-100 text-yellow-800', icon: Clock }
    return { status: 'Unknown', className: 'bg-gray-100 text-gray-800', icon: AlertTriangle }
  }

  // Get ERV status
  const getERVStatus = () => {
    if (!settings.ervEnabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800' }
    if (!settings.energyRecoveryEnabled) return { status: 'Bypassed', className: 'bg-yellow-100 text-yellow-800' }
    const ervEfficiency = getMetricValue('erv', 0)
    if (ervEfficiency > 70) return { status: 'Excellent', className: 'bg-green-100 text-green-800' }
    if (ervEfficiency > 50) return { status: 'Good', className: 'bg-blue-100 text-blue-800' }
    if (ervEfficiency > 30) return { status: 'Fair', className: 'bg-yellow-100 text-yellow-800' }
    return { status: 'Poor', className: 'bg-red-100 text-red-800' }
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
  const ervStatus = getERVStatus()
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
      <Card className="border-l-4 border-l-cyan-400">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Wind className="w-5 h-5 text-cyan-600" />
              DOAS Status & Controls
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
                settings.mode === 'ventilation' ? 'bg-green-100 text-green-800' :
                'bg-gray-100 text-gray-800'
              } border`}>
                {settings.mode.charAt(0).toUpperCase() + settings.mode.slice(1)}
              </Badge>
              <Badge className={`${ervStatus.className} border flex items-center gap-1`}>
                <RotateCcw className="w-3 h-3" />
                ERV: {ervStatus.status}
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
              <Droplets className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Supply Humidity</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('humidity', '--') !== '--' ? `${getMetricValue('humidity', '--')}%` : '--'}
              </p>
              <p className="text-xs text-gray-500">
                Target: {settings.supplyHumiditySetpoint}%
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Thermometer className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <p className="text-sm font-medium">Outdoor Temp</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('outdoor', '--') !== '--' ? `${getMetricValue('outdoor', '--')}°F` : '--'}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Gauge className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <p className="text-sm font-medium">CO₂ Level</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('co2', '--') !== '--' ? `${getMetricValue('co2', '--')} ppm` : '--'}
              </p>
              {settings.demandControlVentilation && (
                <p className="text-xs text-gray-500">
                  Target: {settings.co2Setpoint} ppm
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            DOAS Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">DOAS Enable</Label>
              <p className="text-sm text-gray-500">Turn DOAS system on/off</p>
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
              onValueChange={(mode: 'heating' | 'cooling' | 'auto' | 'ventilation') => 
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
                <SelectItem value="ventilation">Ventilation Only</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Auto mode optimizes between heating, cooling, and energy recovery
            </p>
          </div>

          {/* Fan Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Supply Fan */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Supply Fan</Label>
                <Select
                  value={settings.supplyFanMode}
                  onValueChange={(supplyFanMode: 'auto' | 'manual') => 
                    setSettings(prev => ({ ...prev, supplyFanMode }))
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
              {settings.supplyFanMode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Speed</span>
                    <span className="text-sm font-bold">{settings.supplyFanSpeed}%</span>
                  </div>
                  <Slider
                    value={[settings.supplyFanSpeed]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, supplyFanSpeed: value }))}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                </>
              )}
            </div>

            {/* Exhaust Fan */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Exhaust Fan</Label>
                <Select
                  value={settings.exhaustFanMode}
                  onValueChange={(exhaustFanMode: 'auto' | 'manual') => 
                    setSettings(prev => ({ ...prev, exhaustFanMode }))
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
              {settings.exhaustFanMode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Speed</span>
                    <span className="text-sm font-bold">{settings.exhaustFanSpeed}%</span>
                  </div>
                  <Slider
                    value={[settings.exhaustFanSpeed]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, exhaustFanSpeed: value }))}
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

          {/* Setpoints */}
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
                min={55}
                max={85}
                step={1}
                className="w-full"
                disabled={loading || commandStatus.status === 'processing'}
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>55°F</span>
                <span>70°F</span>
                <span>85°F</span>
              </div>
            </div>

            {/* Supply Humidity Setpoint */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Humidity Setpoint</Label>
                <span className="text-lg font-bold text-gray-900">{settings.supplyHumiditySetpoint}%</span>
              </div>
              <Slider
                value={[settings.supplyHumiditySetpoint]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, supplyHumiditySetpoint: value }))}
                min={30}
                max={70}
                step={5}
                className="w-full"
                disabled={loading || commandStatus.status === 'processing'}
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>30%</span>
                <span>50%</span>
                <span>70%</span>
              </div>
            </div>
          </div>

          {/* Energy Recovery Ventilator */}
          <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Energy Recovery Ventilator</Label>
                <p className="text-sm text-gray-500">Enable ERV for energy recovery</p>
              </div>
              <Switch
                checked={settings.ervEnabled}
                onCheckedChange={(ervEnabled) => setSettings(prev => ({ ...prev, ervEnabled }))}
                disabled={loading || commandStatus.status === 'processing'}
              />
            </div>

            {settings.ervEnabled && (
              <>
                <div className="flex items-center justify-between">
                  <Label className="text-base font-medium">ERV Bypass</Label>
                  <Select
                    value={settings.ervBypassMode}
                    onValueChange={(ervBypassMode: 'auto' | 'manual') => 
                      setSettings(prev => ({ ...prev, ervBypassMode }))
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

                {settings.ervBypassMode === 'manual' && (
                  <>
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium">Bypass Position</span>
                      <span className="text-sm font-bold">{settings.ervBypassPosition}%</span>
                    </div>
                    <Slider
                      value={[settings.ervBypassPosition]}
                      onValueChange={([value]) => setSettings(prev => ({ ...prev, ervBypassPosition: value }))}
                      min={0}
                      max={100}
                      step={10}
                      className="w-full"
                      disabled={loading || commandStatus.status === 'processing'}
                    />
                  </>
                )}

                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-base font-medium">Energy Recovery</Label>
                    <p className="text-sm text-gray-500">Enable energy transfer through ERV</p>
                  </div>
                  <Switch
                    checked={settings.energyRecoveryEnabled}
                    onCheckedChange={(energyRecoveryEnabled) => setSettings(prev => ({ ...prev, energyRecoveryEnabled }))}
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                </div>
              </>
            )}
          </div>

          {/* Coil Controls */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Heating Coil */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Heating Coil</Label>
                <Select
                  value={settings.heatingCoilMode}
                  onValueChange={(mode: 'auto' | 'manual') => 
                    setSettings(prev => ({ ...prev, heatingCoilMode: mode }))
                  }
                  disabled={loading || commandStatus.status === 'processing'}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.heatingCoilMode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Position</span>
                    <span className="text-sm font-medium">{settings.heatingCoilPosition}%</span>
                  </div>
                  <Slider
                    value={[settings.heatingCoilPosition]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, heatingCoilPosition: value }))}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                </>
              )}
            </div>

            {/* Cooling Coil */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Cooling Coil</Label>
                <Select
                  value={settings.coolingCoilMode}
                  onValueChange={(mode: 'auto' | 'manual') => 
                    setSettings(prev => ({ ...prev, coolingCoilMode: mode }))
                  }
                  disabled={loading || commandStatus.status === 'processing'}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.coolingCoilMode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Position</span>
                    <span className="text-sm font-medium">{settings.coolingCoilPosition}%</span>
                  </div>
                  <Slider
                    value={[settings.coolingCoilPosition]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, coolingCoilPosition: value }))}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                </>
              )}
            </div>

            {/* Reheat Coil */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Reheat Coil</Label>
                <Select
                  value={settings.reheatCoilMode}
                  onValueChange={(mode: 'auto' | 'manual') => 
                    setSettings(prev => ({ ...prev, reheatCoilMode: mode }))
                  }
                  disabled={loading || commandStatus.status === 'processing'}
                >
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Auto</SelectItem>
                    <SelectItem value="manual">Manual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {settings.reheatCoilMode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Position</span>
                    <span className="text-sm font-medium">{settings.reheatCoilPosition}%</span>
                  </div>
                  <Slider
                    value={[settings.reheatCoilPosition]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, reheatCoilPosition: value }))}
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

          {/* Advanced Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Demand Control Ventilation */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-base font-medium">Demand Control Ventilation</Label>
                  <p className="text-sm text-gray-500">Adjust ventilation based on CO₂ levels</p>
                </div>
                <Switch
                  checked={settings.demandControlVentilation}
                  onCheckedChange={(demandControlVentilation) => setSettings(prev => ({ ...prev, demandControlVentilation }))}
                  disabled={loading || commandStatus.status === 'processing'}
                />
              </div>
              {settings.demandControlVentilation && (
                <>
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">CO₂ Setpoint</Label>
                    <span className="text-sm font-bold">{settings.co2Setpoint} ppm</span>
                  </div>
                  <Slider
                    value={[settings.co2Setpoint]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, co2Setpoint: value }))}
                    min={400}
                    max={1500}
                    step={50}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                  <div className="flex justify-between text-sm text-gray-500">
                    <span>400 ppm</span>
                    <span>1000 ppm</span>
                    <span>1500 ppm</span>
                  </div>
                </>
              )}
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
            onClick={onUpdate}
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
              No live metrics available for this DOAS unit.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
