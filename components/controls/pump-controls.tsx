// components/controls/pump-controls.tsx
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
  Gauge,
  Zap,
  TrendingUp,
  Droplet,
  RotateCcw,
  Timer
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"

interface ControlProps {
  equipmentInfo: any
  metrics: any
  onUpdate: () => void
}

interface PumpSettings {
  enabled: boolean
  controlMode: 'pressure' | 'flow'
  pressureSetpoint: number
  flowSwitchEnabled: boolean
  isLead: boolean
  autoRotation: boolean
  minSpeed: number
  maxSpeed: number
  lastModified?: string
  modifiedBy?: string
}

interface CommandStatus {
  id?: string
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  progress?: number
}

export function PumpControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<PumpSettings>({
    enabled: false,
    controlMode: 'pressure',
    pressureSetpoint: 15,
    flowSwitchEnabled: true,
    isLead: false,
    autoRotation: true,
    minSpeed: 20,
    maxSpeed: 100
  })
  const [commandStatus, setCommandStatus] = useState<CommandStatus>({ status: 'idle' })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastKnownState, setLastKnownState] = useState<PumpSettings | null>(null)
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
        settings.controlMode !== lastKnownState.controlMode ||
        settings.pressureSetpoint !== lastKnownState.pressureSetpoint ||
        settings.flowSwitchEnabled !== lastKnownState.flowSwitchEnabled ||
        settings.isLead !== lastKnownState.isLead ||
        settings.autoRotation !== lastKnownState.autoRotation ||
        settings.minSpeed !== lastKnownState.minSpeed ||
        settings.maxSpeed !== lastKnownState.maxSpeed

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
            controlMode: data.state.settings.controlMode ?? 'pressure',
            pressureSetpoint: data.state.settings.pressureSetpoint ?? 15,
            flowSwitchEnabled: data.state.settings.flowSwitchEnabled ?? true,
            isLead: data.state.settings.isLead ?? false,
            autoRotation: data.state.settings.autoRotation ?? true,
            minSpeed: data.state.settings.minSpeed ?? 20,
            maxSpeed: data.state.settings.maxSpeed ?? 100,
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
            controlMode: data.state.settings?.controlMode ?? 'pressure',
            pressureSetpoint: data.state.settings?.pressureSetpoint ?? 15,
            flowSwitchEnabled: data.state.settings?.flowSwitchEnabled ?? true,
            isLead: data.state.settings?.isLead ?? false,
            autoRotation: data.state.settings?.autoRotation ?? true,
            minSpeed: data.state.settings?.minSpeed ?? 20,
            maxSpeed: data.state.settings?.maxSpeed ?? 100,
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
             (keyLower === 'speed' && (metricKey.includes('speed') || metricKey.includes('rpm'))) ||
             (keyLower === 'pressure' && (metricKey.includes('pressure') || metricKey.includes('psi'))) ||
             (keyLower === 'flow' && (metricKey.includes('flow') || metricKey.includes('switch'))) ||
             (keyLower === 'amps' && (metricKey.includes('amp') || metricKey.includes('current'))) ||
             (keyLower === 'runtime' && (metricKey.includes('runtime') || metricKey.includes('hours'))) ||
             (keyLower === 'changeover' && (metricKey.includes('changeover') || metricKey.includes('rotation'))) ||
             (keyLower === 'failover' && (metricKey.includes('failover') || metricKey.includes('fault')))
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
          controlMode: settings.controlMode,
          pressureSetpoint: settings.pressureSetpoint,
          flowSwitchEnabled: settings.flowSwitchEnabled,
          isLead: settings.isLead,
          autoRotation: settings.autoRotation,
          minSpeed: settings.minSpeed,
          maxSpeed: settings.maxSpeed
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
        description: "Pump control settings are being applied.",
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
          controlMode: settings.controlMode,
          pressureSetpoint: settings.pressureSetpoint,
          flowSwitchEnabled: settings.flowSwitchEnabled,
          isLead: settings.isLead,
          autoRotation: settings.autoRotation,
          minSpeed: settings.minSpeed,
          maxSpeed: settings.maxSpeed
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
        description: "Pump configuration has been saved to historical records.",
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
              description: "Pump control settings have been successfully applied.",
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
    const speed = getMetricValue('speed', 0)
    const amps = getMetricValue('amps', 0)

    if (!enabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800', icon: Power }
    if (speed > 0 && amps > 1) return { status: 'Running', className: 'bg-green-100 text-green-800', icon: Waves }
    if (enabled && speed === 0) return { status: 'Standby', className: 'bg-yellow-100 text-yellow-800', icon: Clock }
    return { status: 'Unknown', className: 'bg-gray-100 text-gray-800', icon: AlertTriangle }
  }

  // Get failover status
  const getFailoverStatus = () => {
    const failover = getMetricValue('failover', false)
    return failover ? 'Active' : 'Normal'
  }

  // Format runtime hours
  const formatRuntime = (hours: number) => {
    if (hours < 1) return `${Math.round(hours * 60)}m`
    if (hours < 24) return `${Math.round(hours)}h`
    return `${Math.round(hours / 24)}d ${Math.round(hours % 24)}h`
  }

  // Format time to next changeover
  const formatTimeToChangeover = (minutes: number) => {
    if (minutes < 60) return `${Math.round(minutes)}m`
    const hours = Math.floor(minutes / 60)
    const mins = Math.round(minutes % 60)
    return `${hours}h ${mins}m`
  }

  const currentStatus = getCurrentStatus()

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
      <Card className="border-l-4 border-l-blue-600">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Waves className="w-5 h-5 text-blue-600" />
              Pump Status & Controls
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
              {settings.isLead && (
                <Badge className="bg-green-100 text-green-800 border border-green-200">
                  Lead Unit
                </Badge>
              )}
              <Badge className={`${
                getFailoverStatus() === 'Active' ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'
              } border`}>
                Failover: {getFailoverStatus()}
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
              <TrendingUp className="w-6 h-6 mx-auto text-blue-500 mb-2" />
              <p className="text-sm font-medium">Pump Speed</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('speed', '--') !== '--' ? `${getMetricValue('speed', '--')}%` : '--'}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              {settings.controlMode === 'pressure' ? (
                <>
                  <Gauge className="w-6 h-6 mx-auto text-orange-500 mb-2" />
                  <p className="text-sm font-medium">System Pressure</p>
                  <p className="text-lg font-bold text-gray-900">
                    {getMetricValue('pressure', '--') !== '--' ? `${getMetricValue('pressure', '--')} PSI` : '--'}
                  </p>
                  <Badge className="bg-orange-100 text-orange-800 text-xs mt-1">
                    Target: {settings.pressureSetpoint} PSI
                  </Badge>
                </>
              ) : (
                <>
                  <Droplet className="w-6 h-6 mx-auto text-blue-500 mb-2" />
                  <p className="text-sm font-medium">Flow Switch</p>
                  <p className="text-lg font-bold text-gray-900">
                    {getMetricValue('flow', false) ? 'FLOW DETECTED' : 'NO FLOW'}
                  </p>
                  <Badge className={`${
                    getMetricValue('flow', false) ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  } text-xs mt-1`}>
                    Switch {settings.flowSwitchEnabled ? 'Enabled' : 'Disabled'}
                  </Badge>
                </>
              )}
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Timer className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <p className="text-sm font-medium">Runtime Hours</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('runtime', 0) !== 0 ? formatRuntime(getMetricValue('runtime', 0)) : '--'}
              </p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <RotateCcw className="w-6 h-6 mx-auto text-purple-500 mb-2" />
              <p className="text-sm font-medium">Next Changeover</p>
              <p className="text-lg font-bold text-gray-900">
                {getMetricValue('changeover', 0) !== 0 ? formatTimeToChangeover(getMetricValue('changeover', 0)) : '--'}
              </p>
              <p className="text-xs text-gray-500">
                {settings.autoRotation ? 'Auto' : 'Manual'}
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
            Pump Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Pump Enable</Label>
              <p className="text-sm text-gray-500">Turn pump system on/off</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings(prev => ({ ...prev, enabled }))}
              disabled={loading || commandStatus.status === 'processing'}
            />
          </div>

          {/* Control Mode Selection */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <Label className="text-base font-medium">Control Mode</Label>
            <Select
              value={settings.controlMode}
              onValueChange={(controlMode: 'pressure' | 'flow') =>
                setSettings(prev => ({ ...prev, controlMode }))
              }
              disabled={loading || commandStatus.status === 'processing'}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pressure">Pressure Control</SelectItem>
                <SelectItem value="flow">Flow Switch Control</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-gray-500">
              Choose between constant pressure control or flow switch monitoring
            </p>
          </div>

          {/* Pressure Setpoint (only show when pressure mode) */}
          {settings.controlMode === 'pressure' && (
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
          )}

          {/* Flow Switch Control (only show when flow mode) */}
          {settings.controlMode === 'flow' && (
            <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
              <div>
                <Label className="text-base font-medium">Flow Switch Monitoring</Label>
                <p className="text-sm text-gray-500">Enable flow switch detection and alarms</p>
              </div>
              <Switch
                checked={settings.flowSwitchEnabled}
                onCheckedChange={(flowSwitchEnabled) => setSettings(prev => ({ ...prev, flowSwitchEnabled }))}
                disabled={loading || commandStatus.status === 'processing'}
              />
            </div>
          )}

          {/* Lead/Lag Selection */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Lead Unit</Label>
              <p className="text-sm text-gray-500">Set as primary pump in lead/lag sequence</p>
            </div>
            <Switch
              checked={settings.isLead}
              onCheckedChange={(isLead) => setSettings(prev => ({ ...prev, isLead }))}
              disabled={loading || commandStatus.status === 'processing'}
            />
          </div>

          {/* Auto Rotation */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Auto Rotation</Label>
              <p className="text-sm text-gray-500">Automatically rotate lead/lag pumps</p>
            </div>
            <Switch
              checked={settings.autoRotation}
              onCheckedChange={(autoRotation) => setSettings(prev => ({ ...prev, autoRotation }))}
              disabled={loading || commandStatus.status === 'processing'}
            />
          </div>

          {/* Speed Limits */}
          <div className="space-y-6 p-4 bg-gray-50 rounded-lg">
            <Label className="text-base font-medium">Speed Limits</Label>

            {/* Minimum Speed */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Minimum Speed</Label>
                <span className="text-sm font-bold text-gray-900">{settings.minSpeed}%</span>
              </div>
              <Slider
                value={[settings.minSpeed]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, minSpeed: value }))}
                min={0}
                max={50}
                step={5}
                className="w-full"
                disabled={loading || commandStatus.status === 'processing'}
              />
            </div>

            {/* Maximum Speed */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Maximum Speed</Label>
                <span className="text-sm font-bold text-gray-900">{settings.maxSpeed}%</span>
              </div>
              <Slider
                value={[settings.maxSpeed]}
                onValueChange={([value]) => setSettings(prev => ({ ...prev, maxSpeed: value }))}
                min={50}
                max={100}
                step={5}
                className="w-full"
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
              No live metrics available for this pump.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
