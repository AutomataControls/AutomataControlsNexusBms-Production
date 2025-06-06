// components/settings/session-settings-tab.tsx
// Session Settings Tab - Configure user session behavior and security settings
// Features: Session timeout, auto-logout, remember last location, security preferences

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { useToast } from "@/components/ui/use-toast"
import { Clock, Shield, User, Settings, AlertCircle } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { doc, getDoc, setDoc } from "firebase/firestore"

interface SessionSettings {
  timeoutMinutes: number
  autoLogout: boolean
  rememberLastLocation: boolean
  showSessionWarning: boolean
  extendOnActivity: boolean
  logoutOnBrowserClose: boolean
}

export function SessionSettingsTab() {
  const { db } = useFirebase()
  const { user } = useAuth()
  const { toast } = useToast()

  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [sessionSettings, setSessionSettings] = useState<SessionSettings>({
    timeoutMinutes: 30,
    autoLogout: true,
    rememberLastLocation: true,
    showSessionWarning: true,
    extendOnActivity: true,
    logoutOnBrowserClose: false,
  })

  useEffect(() => {
    loadSessionSettings()
  }, [])

  const loadSessionSettings = async () => {
    if (!db || !user) return

    try {
      setLoading(true)

      // Try to get organization-wide settings first
      const orgSettingsDoc = await getDoc(doc(db, "settings", "session"))

      if (orgSettingsDoc.exists()) {
        const data = orgSettingsDoc.data()
        setSessionSettings(prevSettings => ({
          ...prevSettings,
          timeoutMinutes: data.timeoutMinutes || 30,
          autoLogout: data.autoLogout !== false,
          rememberLastLocation: data.rememberLastLocation !== false,
          showSessionWarning: data.showSessionWarning !== false,
          extendOnActivity: data.extendOnActivity !== false,
          logoutOnBrowserClose: data.logoutOnBrowserClose === true,
        }))
      } else {
        // If no org settings, try user-specific settings
        const userSettingsDoc = await getDoc(doc(db, "users", user.id, "settings", "session"))
        if (userSettingsDoc.exists()) {
          const data = userSettingsDoc.data()
          setSessionSettings(prevSettings => ({
            ...prevSettings,
            timeoutMinutes: data.timeoutMinutes || 30,
            autoLogout: data.autoLogout !== false,
            rememberLastLocation: data.rememberLastLocation !== false,
            showSessionWarning: data.showSessionWarning !== false,
            extendOnActivity: data.extendOnActivity !== false,
            logoutOnBrowserClose: data.logoutOnBrowserClose === true,
          }))
        }
      }
    } catch (error) {
      console.error("Error loading session settings:", error)
      toast({
        title: "Error",
        description: "Failed to load session settings",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSaveSettings = async () => {
    if (!db || !user) return

    try {
      setSaving(true)

      const settingsData = {
        ...sessionSettings,
        updatedAt: new Date(),
        updatedBy: user.id,
      }

      // Save to organization settings
      await setDoc(doc(db, "settings", "session"), settingsData, { merge: true })

      // Also save to user settings if user is logged in
      await setDoc(doc(db, "users", user.id, "settings", "session"), settingsData, { merge: true })

      // Save to localStorage for immediate use
      if (typeof window !== "undefined") {
        localStorage.setItem("sessionSettings", JSON.stringify({
          timeoutMinutes: sessionSettings.timeoutMinutes,
          autoLogout: sessionSettings.autoLogout,
          rememberLastLocation: sessionSettings.rememberLastLocation,
          showSessionWarning: sessionSettings.showSessionWarning,
          extendOnActivity: sessionSettings.extendOnActivity,
          logoutOnBrowserClose: sessionSettings.logoutOnBrowserClose,
        }))

        // Dispatch event to update session timeout tracker
        window.dispatchEvent(new CustomEvent("session-config-updated", {
          detail: sessionSettings,
        }))
      }

      toast({
        title: "Success",
        description: "Session settings saved and applied successfully",
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error saving session settings:", error)
      toast({
        title: "Error",
        description: "Failed to save session settings",
        variant: "destructive"
      })
    } finally {
      setSaving(false)
    }
  }

  const formatTimeoutDisplay = (minutes: number) => {
    if (minutes < 60) {
      return `${minutes} minute${minutes !== 1 ? 's' : ''}`
    } else {
      const hours = Math.floor(minutes / 60)
      const remainingMinutes = minutes % 60
      if (remainingMinutes === 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''}`
      } else {
        return `${hours}h ${remainingMinutes}m`
      }
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-teal-600" />
          Session Settings
        </CardTitle>
        <CardDescription>Configure user session behavior, timeouts, and security preferences</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Auto Logout Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Shield className="h-5 w-5 text-teal-600" />
              <div>
                <h4 className="font-medium text-slate-900">Auto Logout</h4>
                <p className="text-sm text-slate-600">Automatically log out inactive users for security</p>
              </div>
            </div>
            <Switch
              checked={sessionSettings.autoLogout}
              onCheckedChange={(checked) => setSessionSettings({ ...sessionSettings, autoLogout: checked })}
            />
          </div>

          {/* Session Timeout Slider */}
          {sessionSettings.autoLogout && (
            <div className="space-y-4 p-4 border rounded-lg">
              <div className="flex justify-between items-center">
                <Label className="font-medium text-slate-900">Session Timeout</Label>
                <span className="text-sm font-medium text-teal-600 bg-teal-50 px-2 py-1 rounded">
                  {formatTimeoutDisplay(sessionSettings.timeoutMinutes)}
                </span>
              </div>
              <Slider
                value={[sessionSettings.timeoutMinutes]}
                onValueChange={(value) => setSessionSettings({ ...sessionSettings, timeoutMinutes: value[0] })}
                min={5}
                max={240}
                step={5}
                className="py-4"
              />
              <div className="flex justify-between text-xs text-slate-500">
                <span>5 minutes</span>
                <span>4 hours</span>
              </div>
              <p className="text-sm text-slate-600">
                Users will be automatically logged out after {formatTimeoutDisplay(sessionSettings.timeoutMinutes)} of inactivity
              </p>
            </div>
          )}
        </div>

        {/* Session Behavior Settings */}
        <div className="space-y-4">
          <h4 className="font-medium text-slate-900 flex items-center gap-2">
            <User className="h-4 w-4 text-teal-600" />
            Session Behavior
          </h4>

          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="font-medium text-slate-900">Show Session Warning</Label>
                <p className="text-sm text-slate-600">Display warning before automatic logout</p>
              </div>
              <Switch
                checked={sessionSettings.showSessionWarning}
                onCheckedChange={(checked) => setSessionSettings({ ...sessionSettings, showSessionWarning: checked })}
                disabled={!sessionSettings.autoLogout}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="font-medium text-slate-900">Extend on Activity</Label>
                <p className="text-sm text-slate-600">Reset timeout when user is active</p>
              </div>
              <Switch
                checked={sessionSettings.extendOnActivity}
                onCheckedChange={(checked) => setSessionSettings({ ...sessionSettings, extendOnActivity: checked })}
                disabled={!sessionSettings.autoLogout}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="font-medium text-slate-900">Remember Last Location</Label>
                <p className="text-sm text-slate-600">Return to last viewed location on login</p>
              </div>
              <Switch
                checked={sessionSettings.rememberLastLocation}
                onCheckedChange={(checked) => setSessionSettings({ ...sessionSettings, rememberLastLocation: checked })}
              />
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <Label className="font-medium text-slate-900">Logout on Browser Close</Label>
                <p className="text-sm text-slate-600">Automatically logout when browser is closed</p>
              </div>
              <Switch
                checked={sessionSettings.logoutOnBrowserClose}
                onCheckedChange={(checked) => setSessionSettings({ ...sessionSettings, logoutOnBrowserClose: checked })}
              />
            </div>
          </div>
        </div>

        {/* Security Information */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900 mb-1">Security Recommendations</h4>
              <ul className="text-sm text-amber-800 space-y-1">
                <li>• Enable auto-logout for enhanced security in shared environments</li>
                <li>• Use shorter timeouts (15-30 minutes) for sensitive operations</li>
                <li>• Show session warnings to prevent unexpected logouts</li>
                <li>• Consider browser close logout for public computers</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Current Session Info */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Settings className="h-5 w-5 text-teal-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-medium text-teal-900 mb-2">Current Session Information</h4>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-teal-700 font-medium">Status:</span>
                  <span className="text-teal-800 ml-2">Active</span>
                </div>
                <div>
                  <span className="text-teal-700 font-medium">User:</span>
                  <span className="text-teal-800 ml-2">{user?.email || 'Unknown'}</span>
                </div>
                <div>
                  <span className="text-teal-700 font-medium">Auto Logout:</span>
                  <span className="text-teal-800 ml-2">
                    {sessionSettings.autoLogout ? 'Enabled' : 'Disabled'}
                  </span>
                </div>
                <div>
                  <span className="text-teal-700 font-medium">Timeout:</span>
                  <span className="text-teal-800 ml-2">
                    {sessionSettings.autoLogout ? formatTimeoutDisplay(sessionSettings.timeoutMinutes) : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="pt-4 border-t">
          <Button
            onClick={handleSaveSettings}
            disabled={loading || saving}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            {saving ? "Saving Settings..." : "Save Session Settings"}
          </Button>
          {saving && (
            <p className="text-sm text-slate-600 mt-2">
              Applying changes to current session and saving to database...
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
