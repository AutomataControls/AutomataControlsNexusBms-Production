// components/controls/boiler-controls.tsx
"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import {
  Flame,
  Thermometer,
  Power,
  AlertTriangle,
  Settings,
  Clock,
  Activity,
  Send,
  Save,
  CheckCircle,
  Loader2,
  AlertCircle
} from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { useAuth } from "@/lib/auth-context"

interface ControlProps {
  equipmentInfo: any
  metrics: any
  onUpdate: () => void
}

interface BoilerSettings {
  enabled: boolean
  supplyTempSetpoint: number
  isLead: boolean
  lastModified?: string
  modifiedBy?: string
}

interface CommandStatus {
  id?: string
  status: 'idle' | 'pending' | 'processing' | 'completed' | 'failed'
  message?: string
  progress?: number
}

export function BoilerControls({ equipmentInfo, metrics, onUpdate }: ControlProps) {
  const { toast } = useToast()
  const { user } = useAuth()
  const [loading, setLoading] = useState(false)
  const [settings, setSettings] = useState<BoilerSettings>({
    enabled: false,
    supplyTempSetpoint: 160,
    isLead: false
  })
  const [oarSetpoint, setOarSetpoint] = useState<number | null>(null)
  const [commandStatus, setCommandStatus] = useState<CommandStatus>({ status: 'idle' })
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [lastKnownState, setLastKnownState] = useState<BoilerSettings | null>(null)
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
        settings.supplyTempSetpoint !== lastKnownState.supplyTempSetpoint ||
        settings.isLead !== lastKnownState.isLead

      console.log('Checking for changes:', {
        currentSettings: settings,
        lastKnownState: lastKnownState,
        hasChanges: hasChanges
      })

      setHasUnsavedChanges(hasChanges)
    } else {
      // If no lastKnownState yet, allow changes
      setHasUnsavedChanges(true)
    }
  }, [settings, lastKnownState])

  // Load equipment state from Redis
  const loadEquipmentState = async () => {
    try {
      const response = await fetch(`/api/equipment/${equipmentInfo.id}/state`)
      if (response.ok) {
        const data = await response.json()

        if (data.state) {
          const newSettings = {
            enabled: data.state.settings?.enabled ?? false,
            supplyTempSetpoint: data.state.settings?.supplyTempSetpoint ?? 160,
            isLead: data.state.settings?.isLead ?? false,
            lastModified: data.state.lastModified,
            modifiedBy: data.state.modifiedBy
          }

          setSettings(newSettings)
          setLastKnownState(newSettings)
          lastModifiedRef.current = data.state.lastModified || ''
        }

        if (data.oarSetpoint !== undefined) {
          setOarSetpoint(data.oarSetpoint)
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
    }, 3000) // Poll every 3 seconds
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

        // Check if state was modified by someone else
        if (data.state?.lastModified &&
            data.state.lastModified !== lastModifiedRef.current &&
            data.state.modifiedBy !== user?.id) {

          // Update state from Redis (another user made changes)
          const newSettings = {
            enabled: data.state.settings?.enabled ?? false,
            supplyTempSetpoint: data.state.settings?.supplyTempSetpoint ?? 160,
            isLead: data.state.settings?.isLead ?? false,
            lastModified: data.state.lastModified,
            modifiedBy: data.state.modifiedBy
          }

          setSettings(newSettings)
          setLastKnownState(newSettings)
          setHasUnsavedChanges(false)
          lastModifiedRef.current = data.state.lastModified

          // Show notification about external changes
          toast({
            title: "Settings Updated",
            description: `Equipment settings were updated by ${data.state.modifiedByName || 'another user'}.`,
            duration: 4000,
          })
        }

        // Update OAR setpoint if changed
        if (data.oarSetpoint !== oarSetpoint) {
          setOarSetpoint(data.oarSetpoint)
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
             metricKey.includes(keyLower.replace('temp', '')) ||
             (keyLower === 'supply' && (metricKey.includes('supply') || metricKey.includes('h20supply') || metricKey.includes('h2osupply'))) ||
             (keyLower === 'return' && (metricKey.includes('return') || metricKey.includes('h20return') || metricKey.includes('h2oreturn'))) ||
             (keyLower === 'firing' && metricKey.includes('firing'))
    })

    return metric ? (metric[1] as any)?.value ?? defaultValue : defaultValue
  }

  // Get firing rate display (convert binary to percentage)
  const getFiringRateDisplay = () => {
    const firing = getMetricValue('firing', 0)
    return firing === 1 ? '50%' : '0%'
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
          supplyTempSetpoint: settings.supplyTempSetpoint,
          isLead: settings.isLead
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
        description: "Equipment control settings are being applied.",
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
          supplyTempSetpoint: settings.supplyTempSetpoint,
          isLead: settings.isLead,
          oarSetpoint: oarSetpoint
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
        description: "Equipment configuration has been saved to historical records.",
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
              description: "Equipment control settings have been successfully applied.",
              duration: 3000,
            })
            // *** FIXED: Call onUpdate instead of page reload ***
            onUpdate()
            return // Stop polling
          } else if (statusData.status === 'failed') {
            toast({
              title: "Application Failed",
              description: statusData.message || "Failed to apply settings to equipment.",
              variant: "destructive",
            })
            return // Stop polling
          }

          // Continue polling if not completed/failed
          if (statusData?.status === 'processing' || statusData?.status === 'pending') {
            setTimeout(checkStatus, 2000)
          }
        }
      } catch (error) {
        console.error('Error checking command status:', error)
        // Set failed status on error
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
    const firing = getMetricValue('firing', 0)
    const enabled = getMetricValue('enabled', false)

    if (!enabled) return { status: 'Disabled', className: 'bg-gray-100 text-gray-800', icon: Power }
    if (firing > 0) return { status: 'Firing', className: 'bg-orange-100 text-orange-800', icon: Flame }
    if (enabled) return { status: 'Standby', className: 'bg-blue-100 text-blue-800', icon: Clock }
    return { status: 'Unknown', className: 'bg-gray-100 text-gray-800', icon: AlertTriangle }
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
      <Card className="border-l-4 border-l-orange-400">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-600" />
              Boiler Status & Controls
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
              <Flame className="w-6 h-6 mx-auto text-orange-500 mb-2" />
              <p className="text-sm font-medium">Firing Rate</p>
              <p className="text-lg font-bold text-gray-900">
                {getFiringRateDisplay()}
              </p>
              <p className="text-xs text-gray-500">Auto Control</p>
            </div>

            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <Thermometer className="w-6 h-6 mx-auto text-green-500 mb-2" />
              <p className="text-sm font-medium">OAR Temp</p>
              <p className="text-lg font-bold text-gray-900">
                {oarSetpoint !== null ? `${oarSetpoint}°F` : '--'}
              </p>
              <p className="text-xs text-gray-500">Setpoint</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Boiler Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Enable/Disable */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Boiler Enable</Label>
              <p className="text-sm text-gray-500">Turn boiler on/off</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(enabled) => setSettings(prev => ({ ...prev, enabled }))}
              disabled={loading || commandStatus.status === 'processing'}
            />
          </div>

          {/* Lead/Lag Selection */}
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div>
              <Label className="text-base font-medium">Lead Unit</Label>
              <p className="text-sm text-gray-500">Set as primary boiler in sequence</p>
            </div>
            <Switch
              checked={settings.isLead}
              onCheckedChange={(isLead) => setSettings(prev => ({ ...prev, isLead }))}
              disabled={loading || commandStatus.status === 'processing'}
            />
          </div>

          {/* Supply Temperature Setpoint */}
          <div className="space-y-4 p-4 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Supply Temperature Setpoint</Label>
              <span className="text-lg font-bold text-gray-900">{settings.supplyTempSetpoint}°F</span>
            </div>
            <Slider
              value={[settings.supplyTempSetpoint]}
              onValueChange={([value]) => setSettings(prev => ({ ...prev, supplyTempSetpoint: value }))}
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
            <p className="text-xs text-gray-500">
              Adjust temperature setpoint. Use "Apply Controls" to send changes to equipment.
            </p>
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
              No live metrics available for this boiler.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
