"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { useAuth } from "@/lib/auth-context" // Assuming you have an auth context

export function SessionSettings() {
  const { toast } = useToast()
  const { user } = useAuth() // Get current user from auth context

  const [sessionTimeout, setSessionTimeout] = useState(30) // Default 30 minutes
  const [enableAutoLogout, setEnableAutoLogout] = useState(true)
  const [rememberLastLocation, setRememberLastLocation] = useState(true)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const [sessionConfig, setSessionConfig] = useState({
    timeoutMinutes: 30,
    autoLogout: true,
    rememberLastLocation: true,
  })
  const [isSaving, setIsSaving] = useState(false)
  const config = { sessionConfig } // Replace with your actual config object

  // Load settings from Firestore when component mounts
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true)

        // First try to get organization-wide settings
        const orgSettingsDoc = await getDoc(doc(db, "settings", "session"))

        if (orgSettingsDoc.exists()) {
          const data = orgSettingsDoc.data()
          setSessionTimeout(data.timeoutMinutes || 30)
          setEnableAutoLogout(data.autoLogout !== false) // Default to true if not specified
          setRememberLastLocation(data.rememberLastLocation !== false) // Default to true if not specified
          console.log("Loaded organization session settings")
        } else {
          // If no org settings, try user-specific settings
          if (user?.uid) {
            const userSettingsDoc = await getDoc(doc(db, "users", user.uid, "settings", "session"))

            if (userSettingsDoc.exists()) {
              const data = userSettingsDoc.data()
              setSessionTimeout(data.timeoutMinutes || 30)
              setEnableAutoLogout(data.autoLogout !== false)
              setRememberLastLocation(data.rememberLastLocation !== false)
              console.log("Loaded user session settings")
            }
          }
        }
      } catch (error) {
        console.error("Error loading session settings:", error)
        toast({
          title: "Error",
          description: "Failed to load session settings",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    loadSettings()
  }, [user, toast])

  // Save settings to Firestore
  const saveSettings = async () => {
    try {
      setSaving(true)

      const settingsData = {
        timeoutMinutes: sessionTimeout,
        autoLogout: enableAutoLogout,
        rememberLastLocation: rememberLastLocation,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || "unknown",
      }

      // Save to organization settings
      await setDoc(doc(db, "settings", "session"), settingsData, { merge: true })

      // Also save to user settings if user is logged in
      if (user?.uid) {
        await setDoc(doc(db, "users", user.uid, "settings", "session"), settingsData, { merge: true })
      }

      // Also save to localStorage for immediate use
      localStorage.setItem(
        "sessionSettings",
        JSON.stringify({
          timeoutMinutes: sessionTimeout,
          autoLogout: enableAutoLogout,
          rememberLastLocation: rememberLastLocation,
        }),
      )

      toast({
        title: "Settings Saved",
        description: "Session settings have been saved successfully",
      })
    } catch (error) {
      console.error("Error saving session settings:", error)
      toast({
        title: "Error",
        description: "Failed to save session settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleSaveConfig = async () => {
    try {
      setIsSaving(true)
      // await updateConfig({
      //   ...config,
      //   sessionConfig,
      // })

      // Update the global timeout tracker
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("session-config-updated", {
            detail: sessionConfig,
          }),
        )

        // Also save to localStorage for immediate use
        localStorage.setItem("sessionConfig", JSON.stringify(sessionConfig))
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
    <Card>
      <CardHeader>
        <CardTitle>Session Settings</CardTitle>
        <CardDescription>Configure user session behavior and timeouts</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enable-auto-logout">Auto Logout</Label>
            <p className="text-sm text-muted-foreground">
              Automatically log out inactive users after the timeout period
            </p>
          </div>
          <Switch
            id="enable-auto-logout"
            checked={sessionConfig.autoLogout}
            onCheckedChange={(checked) => setSessionConfig({ ...sessionConfig, autoLogout: checked })}
          />
        </div>

        <div className="space-y-2">
          <div className="flex justify-between">
            <Label htmlFor="session-timeout">Session Timeout (minutes)</Label>
            <span className="text-sm font-medium">{sessionConfig.timeoutMinutes} min</span>
          </div>
          <Slider
            id="session-timeout"
            min={5}
            max={120}
            step={5}
            value={[sessionConfig.timeoutMinutes]}
            onValueChange={(value) => setSessionConfig({ ...sessionConfig, timeoutMinutes: value[0] })}
            disabled={!sessionConfig.autoLogout}
            className="py-4"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>5 min</span>
            <span>120 min</span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="space-y-0.5">
            <Label htmlFor="remember-location">Remember Last Location</Label>
            <p className="text-sm text-muted-foreground">Return to the last viewed location when logging back in</p>
          </div>
          <Switch
            id="remember-location"
            checked={sessionConfig.rememberLastLocation}
            onCheckedChange={(checked) => setSessionConfig({ ...sessionConfig, rememberLastLocation: checked })}
          />
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={handleSaveConfig} disabled={isSaving || loading}>
          {isSaving ? "Saving..." : "Save Settings"}
        </Button>
      </CardFooter>
    </Card>
  )
}
