// components/controls/steam-bundle-controls.tsx
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
  Waves,
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
  Flame,
  Gauge,
  Zap,
  Droplet,
  ShieldAlert
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"

interface ControlProps {
  equipmentInfo: any
  metrics: any
  onUpdate: () => void
}

interface SteamBundleSettings {
  enabled: boolean
  hwPumpEnabled: boolean
  hwPumpMode: 'auto' | 'manual'
  valve1_3Mode: 'auto' | 'manual'
  valve1_3Position: number
  valve2_3Mode: 'auto' | 'manual'
  valve2_3Position: number
  temperatureSetpoint: number
  pressureSetpoint: number
  safetyInterlockEnabled: boolean
  pumpRunDelaySeconds: number
  valveCloseDelaySeconds: number
  lastModified?: string
  modifiedBy?: string
}

interface CommandStatus {
  id?: string
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  progress?: number
}

export function SteamBundleControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<SteamBundleSettings>({
    enabled: false,
    hwPumpEnabled: false,
    hwPumpMode: 'auto',
    valve1_3Mode: 'auto',
    valve1_3Position: 0,
    valve2_3Mode: 'auto',
    valve2_3Position: 0,
    temperatureSetpoint: 180,
    pressureSetpoint: 15,
    safetyInterlockEnabled: true,
    pumpRunDelaySeconds: 30,
    valveCloseDelaySeconds: 10
  })
  const [commandStatus, setCommandStatus] = useState<CommandStatus>({ status: 'idle' })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastKnownState, setLastKnownState] = useState<SteamBundleSettings | null>(null)
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
        settings.hwPumpEnabled !== lastKnownState.hwPumpEnabled ||
        settings.hwPumpMode !== lastKnownState.hwPumpMode ||
        settings.valve1_3Mode !== lastKnownState.valve1_3Mode ||
        settings.valve1_3Position !== lastKnownState.valve1_3Position ||
        settings.valve2_3Mode !== lastKnownState.valve2_3Mode ||
        settings.valve2_3Position !== lastKnownState.valve2_3Position ||
        settings.temperatureSetpoint !== lastKnownState.temperatureSetpoint ||
        settings.pressureSetpoint !== lastKnownState.pressureSetpoint ||
        settings.safetyInterlockEnabled !== lastKnownState.safetyInterlockEnabled ||
        settings.pumpRunDelaySeconds !== lastKnownState.pumpRunDelaySeconds ||
        settings.valveCloseDelaySeconds !== lastKnownState.valveCloseDelaySeconds

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
            hwPumpEnabled: data.state.settings.hwPumpEnabled ?? false,
            hwPumpMode: data.state.settings.hwPumpMode ?? 'auto',
            valve1_3Mode: data.state.settings.valve1_3Mode ?? 'auto',
            valve1_3Position: data.state.settings.valve1_3Position ?? 0,
            valve2_3Mode: data.state.settings.valve2_3Mode ?? 'auto',
            valve2_3Position: data.state.settings.valve2_3Position ?? 0,
            temperatureSetpoint: data.state.settings.temperatureSetpoint ?? 180,
            pressureSetpoint: data.state.settings.pressureSetpoint ?? 15,
            safetyInterlockEnabled: data.state.settings.safetyInterlockEnabled ?? true,
            pumpRunDelaySeconds: data.state.settings.pumpRunDelaySeconds ?? 30,
            valveCloseDelaySeconds: data.state.settings.valveCloseDelaySeconds ?? 10,
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
            hwPumpEnabled: data.state.settings?.hwPumpEnabled ?? false,
            hwPumpMode: data.state.settings?.hwPumpMode ?? 'auto',
            valve1_3Mode: data.state.settings?.valve1_3Mode ?? 'auto',
            valve1_3Position: data.state.settings?.valve1_3Position ?? 0,
            valve2_3Mode: data.state.settings?.valve2_3Mode ?? 'auto',
            valve2_3Position: data.state.settings?.valve2_3Position ?? 0,
            temperatureSetpoint: data.state.settings?.temperatureSetpoint ?? 180,
            pressureSetpoint: data.state.settings?.pressureSetpoint ?? 15,
            safetyInterlockEnabled: data.state.settings?.safetyInterlockEnabled ?? true,
            pumpRunDelaySeconds: data.state.settings?.pumpRunDelaySeconds ?? 30,
            valveCloseDelaySeconds: data.state.settings?.valveCloseDelaySeconds ?? 10,
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
             (keyLower === 'temperature' && (metricKey.includes('temp') || metricKey.includes('temperature'))) ||
             (keyLower === 'pressure' && (metricKey.includes('pressure') || metricKey.includes('psi'))) ||
             (keyLower === 'pump' && (metricKey.includes('pump') || metricKey.includes('hw'))) ||
             (keyLower === 'valve1' && (metricKey.includes('valve1') || metricKey.includes('1/3'))) ||
             (keyLower === 'valve2' && (metricKey.includes('valve2') || metricKey.includes('2/3'))) ||
             (keyLower === 'steam' && (metricKey.includes('steam') || metricKey.includes('heating'))) ||
             (keyLower === 'flow' && (metricKey.includes('flow') || metricKey.includes('gpm'))) ||
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
          hwPumpEnabled: settings.hwPumpEnabled,
          hwPumpMode: settings.hwPumpMode,
          valve1_3Mode: settings.valve1_3Mode,
          valve1_3Position: settings.valve1_3Position,
          valve2_3Mode: settings.valve2_3Mode,
          valve2_3Position: settings.valve2_3Position,
          temperatureSetpoint: settings.temperatureSetpoint,
          pressureSetpoint: settings.pressureSetpoint,
          safetyInterlockEnabled: settings.safetyInterlockEnabled,
          pumpRunDelaySeconds: settings.pumpRunDelaySeconds,
          valveCloseDelaySeconds: settings.valveCloseDelaySeconds
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
        description: "Steam bundle control settings are being applied.",
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
          hwPumpEnabled: settings.hwPumpEnabled,
          hwPumpMode: settings.hwPumpMode,
          valve1_3Mode: settings.valve1_3Mode,
          valve1_3Position: settings.valve1_3Position,
          valve2_3Mode: settings.valve2_3Mode,
          valve2_3Position: settings.valve2_3Position,
          temperatureSetpoint: settings.temperatureSetpoint,
          pressureSetpoint: settings.pressureSetpoint,
          safetyInterlockEnabled: settings.safetyInterlockEnabled,
          pumpRunDelaySeconds: settings.pumpRunDelaySeconds,
          valveCloseDelaySeconds: settings.valveCloseDelaySeconds
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
        description: "Steam bundle configuration has been saved to historical records.",
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
              description: "Steam bundle control settings have been successfully applied.",
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

      setSettings(prev => ({ ...prev, enabled: false, hwPumpEnabled: false }))

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
    const pumpRunning = getMetricValue('pump', false)
    const temperature = getMetricValue('temperature', 0)

    if (!enabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800', icon: Power }
    if (!pumpRunning) return { status: 'Pump Off', className: 'bg-red-100 text-red-800', icon: AlertTriangle }
    if (temperature > 150) return { status: 'Heating', className: 'bg-orange-100 text-orange-800', icon: Flame }
    if (pumpRunning) return { status: 'Ready', className: 'bg-green-100 text-green-800', icon: Waves }
    return { status: 'Standby', className: 'bg-yellow-100 text-yellow-800', icon: Clock }
  }

  // Get pump status
  const getPumpStatus = () => {
    const pumpRunning = getMetricValue('pump', false)
    const pumpAmps = getMetricValue('amps', 0)
    
    if (!settings.hwPumpEnabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800' }
    if (pumpRunning && pumpAmps > 1) return { status: 'Running', className: 'bg-green-100 text-green-800' }
    if (settings.hwPumpEnabled && !pumpRunning) return { status: 'Starting', className: 'bg-yellow-100 text-yellow-800' }
    return { status: 'Stopped', className: 'bg-red-100 text-red-800' }
  }

  // Get interlock status
  const getInterlockStatus = () => {
    if (!settings.safetyInterlockEnabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800' }
    const pumpRunning = getMetricValue('pump', false)
    const valvesOpen = settings.valve1_3Position > 0 || settings.valve2_3Position > 0
    
    if (!pumpRunning && valvesOpen) return { status: 'Violated', className: 'bg-red-100 text-red-800' }
    if (pumpRunning) return { status: 'Satisfied', className: 'bg-green-100 text-green-800' }
    return { status: 'Active', className: 'bg-blue-100 text-blue-800' }
  }

  const currentStatus = getCurrentStatus()
  const pumpStatus = getPumpStatus()
  const interlockStatus = getInterlockStatus()

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
      <Card className="border-l-4 border-l-orange-500">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-600" />
              Steam Bundle Status & Controls
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
              <Badge className={`${pumpStatus.className} border flex items-center gap-1`}>
                <Waves className="w-3 h-3" />
                HW Pump: {pumpStatus.status}
              </Badge>
              <Badge className={`${interlockStatus.className} border flex items-center gap-1`}>
                <ShieldAlert className="w-3 h-3" />
                Interlock: {interlockStatus.status}
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
              <p className="text-sm font-medium">Steam Temperature</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('temperature', '--') !== '--' ? `${getMetricValue('temperature', '--')}°F` : '--'}
              </p>
              <p className="text-xs text-gray-500">
                Target: {settings.temperatureSetpoint}°F
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Gauge className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Steam Pressure</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('pressure', '--') !== '--' ? `${getMetricValue('pressure', '--')} PSI` : '--'}
              </p>
              <p className="text-xs text-gray-500">
                Target: {settings.pressureSetpoint} PSI
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Droplet className="w-6 h-6 mx-auto text-cyan-500 mb-2" />
              <p className="text-sm font-medium">1/3 Valve</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('valve1', '--') !== '--' ? `${getMetricValue('valve1', '--')}%` : `${settings.valve1_3Position}%`}
              </p>
              <p className="text-xs text-gray-500">
                Mode: {settings.valve1_3Mode}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Droplet className="w-6 h-6 mx-auto text-indigo-500 mb-2" />
              <p className="text-sm font-medium">2/3 Valve</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('valve2', '--') !== '--' ? `${getMetricValue('valve2', '--')}%` : `${settings.valve2_3Position}%`}
              </p>
              <p className="text-xs text-gray-500">
                Mode: {settings.valve2_3Mode}
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
            Steam Bundle Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* System Enable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Steam Bundle Enable</Label>
              <p className="text-sm text-gray-500">Turn steam bundle system on/off</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings(prev => ({ ...prev, enabled }))}
              disabled={loading || commandStatus.status === 'processing'}
            />
          </div>

          {/* HW Pump Control */}
          <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">HW Pump Enable</Label>
                <p className="text-sm text-gray-500">Hot water pump must run before valves can open</p>
              </div>
              <Switch
                checked={settings.hwPumpEnabled}
                onCheckedChange={(hwPumpEnabled) => setSettings(prev => ({ ...prev, hwPumpEnabled }))}
                disabled={loading || commandStatus.status === 'processing'}
              />
            </div>

            {settings.hwPumpEnabled && (
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Pump Mode</Label>
                <Select
                  value={settings.hwPumpMode}
                  onValueChange={(hwPumpMode: 'auto' | 'manual') => 
                    setSettings(prev => ({ ...prev, hwPumpMode }))
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
            )}
          </div>

          {/* Setpoints */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Temperature Setpoint */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Temperature Setpoint</Label>
                <span className="text-lg font-bold text-gray-900">{settings.temperatureSetpoint}°F</span>
              </div>
              <Slider
                value={[settings.temperatureSetpoint]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, temperatureSetpoint: value }))}
                min={120}
                max={220}
                step={5}
                className="w-full"
                disabled={loading || commandStatus.status === 'processing'}
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>120°F</span>
                <span>170°F</span>
                <span>220°F</span>
              </div>
            </div>

            {/* Pressure Setpoint */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">Pressure Setpoint</Label>
                <span className="text-lg font-bold text-gray-900">{settings.pressureSetpoint} PSI</span>
              </div>
              <Slider
                value={[settings.pressureSetpoint]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, pressureSetpoint: value }))}
                min={5}
                max={50}
                step={1}
                className="w-full"
                disabled={loading || commandStatus.status === 'processing'}
              />
              <div className="flex justify-between text-sm text-gray-500">
                <span>5 PSI</span>
                <span>25 PSI</span>
                <span>50 PSI</span>
              </div>
            </div>
          </div>

          {/* Valve Controls */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* 1/3 Valve */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">1/3 Valve</Label>
                <Select
                  value={settings.valve1_3Mode}
                  onValueChange={(mode: 'auto' | 'manual') => 
                    setSettings(prev => ({ ...prev, valve1_3Mode: mode }))
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
              {settings.valve1_3Mode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Position</span>
                    <span className="text-sm font-bold">{settings.valve1_3Position}%</span>
                  </div>
                  <Slider
                    value={[settings.valve1_3Position]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, valve1_3Position: value }))}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing' || (!settings.hwPumpEnabled && settings.safetyInterlockEnabled)}
                  />
                  {(!settings.hwPumpEnabled && settings.safetyInterlockEnabled) && (
                    <p className="text-xs text-red-500">HW Pump must be enabled before valves can be opened</p>
                  )}
                </>
              )}
            </div>

            {/* 2/3 Valve */}
            <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between">
                <Label className="text-base font-medium">2/3 Valve</Label>
                <Select
                  value={settings.valve2_3Mode}
                  onValueChange={(mode: 'auto' | 'manual') => 
                    setSettings(prev => ({ ...prev, valve2_3Mode: mode }))
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
              {settings.valve2_3Mode === 'manual' && (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Position</span>
                    <span className="text-sm font-bold">{settings.valve2_3Position}%</span>
                  </div>
                  <Slider
                    value={[settings.valve2_3Position]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, valve2_3Position: value }))}
                    min={0}
                    max={100}
                    step={5}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing' || (!settings.hwPumpEnabled && settings.safetyInterlockEnabled)}
                  />
                  {(!settings.hwPumpEnabled && settings.safetyInterlockEnabled) && (
                    <p className="text-xs text-red-500">HW Pump must be enabled before valves can be opened</p>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Safety Controls */}
          <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-base font-medium">Safety Interlock</Label>
                <p className="text-sm text-gray-500">Prevent valve operation without pump running</p>
              </div>
              <Switch
                checked={settings.safetyInterlockEnabled}
                onCheckedChange={(safetyInterlockEnabled) => setSettings(prev => ({ ...prev, safetyInterlockEnabled }))}
                disabled={loading || commandStatus.status === 'processing'}
              />
            </div>

            {settings.safetyInterlockEnabled && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Pump Run Delay */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Pump Run Delay</Label>
                    <span className="text-sm font-bold">{settings.pumpRunDelaySeconds}s</span>
                  </div>
                  <Slider
                    value={[settings.pumpRunDelaySeconds]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, pumpRunDelaySeconds: value }))}
                    min={0}
                    max={120}
                    step={5}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                  <p className="text-xs text-gray-500">Time pump must run before valves can open</p>
                </div>

                {/* Valve Close Delay */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm font-medium">Valve Close Delay</Label>
                    <span className="text-sm font-bold">{settings.valveCloseDelaySeconds}s</span>
                  </div>
                  <Slider
                    value={[settings.valveCloseDelaySeconds]}
                    onValueChange={([value]) => setSettings(prev => ({ ...prev, valveCloseDelaySeconds: value }))}
                    min={0}
                    max={60}
                    step={1}
                    className="w-full"
                    disabled={loading || commandStatus.status === 'processing'}
                  />
                  <p className="text-xs text-gray-500">Time for valves to close before pump stops</p>
                </div>
              </div>
            )}
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
              No live metrics available for this steam bundle.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
