"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Slider } from "@/components/ui/slider"
import { Clock } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"

export function SessionSettings() {
  const { config, updateConfig } = useFirebase()
  const [sessionConfig, setSessionConfig] = useState({
    enableTimeout: config?.sessionConfig?.enableTimeout ?? true,
    timeoutMinutes: config?.sessionConfig?.timeoutMinutes ?? 3,
    warnBeforeTimeout: config?.sessionConfig?.warnBeforeTimeout ?? true,
    warningSeconds: config?.sessionConfig?.warningSeconds ?? 30,
  })
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (config?.sessionConfig) {
      setSessionConfig(config.sessionConfig)
    }
  }, [config])

  const handleSaveConfig = async () => {
    try {
      setIsSaving(true)
      await updateConfig({
        ...config,
        sessionConfig,
      })

      // Update the global timeout tracker
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("session-config-updated", {
            detail: sessionConfig,
          }),
        )
      }

      toast({
        title: "Session Settings Saved",
        description: "Your session timeout settings have been updated and persisted",
      })
    } catch (error) {
      console.error("Error saving session config:", error)
      toast({
        title: "Error",
        description: "Failed to save session settings. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Clock className="h-5 w-5 mr-2" />
            Session Timeout Settings
          </CardTitle>
          <CardDescription>Configure how long users can remain inactive before being logged out</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="enable-timeout">Enable Session Timeout</Label>
              <p className="text-sm text-muted-foreground">Automatically log out users after period of inactivity</p>
            </div>
            <Switch
              id="enable-timeout"
              checked={sessionConfig.enableTimeout}
              onCheckedChange={(checked) => setSessionConfig({ ...sessionConfig, enableTimeout: checked })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="timeout-slider">
                Timeout: {sessionConfig.timeoutMinutes} minutes
              </Label>
            </div>
            <Slider
              id="timeout-slider"
              disabled={!sessionConfig.enableTimeout}
              min={1}
              max={60}
              step={1}
              value={[sessionConfig.timeoutMinutes]}
              onValueChange={(value) => setSessionConfig({ ...sessionConfig, timeoutMinutes: value[0] })}
            />
            <p className="text-sm text-muted-foreground">How long before an inactive user is logged out</p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <div className="space-y-0.5">
              <Label htmlFor="warn-timeout">Show Warning Before Timeout</Label>
              <p className="text-sm text-muted-foreground">Display a warning message before automatic logout</p>
            </div>
            <Switch
              id="warn-timeout"
              disabled={!sessionConfig.enableTimeout}
              checked={sessionConfig.warnBeforeTimeout}
              onCheckedChange={(checked) => setSessionConfig({ ...sessionConfig, warnBeforeTimeout: checked })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex justify-between">
              <Label htmlFor="warning-slider">
                Warning Time: {sessionConfig.warningSeconds} seconds before timeout
              </Label>
            </div>
            <Slider
              id="warning-slider"
              disabled={!sessionConfig.enableTimeout || !sessionConfig.warnBeforeTimeout}
              min={10}
              max={120}
              step={5}
              value={[sessionConfig.warningSeconds]}
              onValueChange={(value) => setSessionConfig({ ...sessionConfig, warningSeconds: value[0] })}
            />
            <p className="text-sm text-muted-foreground">How long before timeout to show the warning message</p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveConfig} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save Settings"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

