"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc } from "firebase/firestore"
import { useAuth } from "@/lib/auth-context" // Assuming you have an auth context

export function WeatherSettings() {
  const { toast } = useToast()
  const { user } = useAuth() // Get current user from auth context

  const [weatherApiKey, setWeatherApiKey] = useState("")
  const [enableWeather, setEnableWeather] = useState(true)
  const [weatherProvider, setWeatherProvider] = useState("openweathermap")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Load settings from Firestore when component mounts
  useEffect(() => {
    async function loadSettings() {
      try {
        setLoading(true)

        // First try to get organization-wide settings
        const orgSettingsDoc = await getDoc(doc(db, "settings", "weather"))

        if (orgSettingsDoc.exists()) {
          const data = orgSettingsDoc.data()
          setWeatherApiKey(data.apiKey || "")
          setEnableWeather(data.enabled !== false) // Default to true if not specified
          setWeatherProvider(data.provider || "openweathermap")
          console.log("Loaded organization weather settings")
        } else {
          // If no org settings, try user-specific settings
          if (user?.uid) {
            const userSettingsDoc = await getDoc(doc(db, "users", user.uid, "settings", "weather"))

            if (userSettingsDoc.exists()) {
              const data = userSettingsDoc.data()
              setWeatherApiKey(data.apiKey || "")
              setEnableWeather(data.enabled !== false)
              setWeatherProvider(data.provider || "openweathermap")
              console.log("Loaded user weather settings")
            }
          }
        }
      } catch (error) {
        console.error("Error loading weather settings:", error)
        toast({
          title: "Error",
          description: "Failed to load weather settings",
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
    if (!weatherApiKey && enableWeather) {
      toast({
        title: "Validation Error",
        description: "Please enter a Weather API key or disable weather features",
        variant: "destructive",
      })
      return
    }

    try {
      setSaving(true)

      const settingsData = {
        apiKey: weatherApiKey,
        enabled: enableWeather,
        provider: weatherProvider,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.uid || "unknown",
      }

      // Save to organization settings
      await setDoc(doc(db, "settings", "weather"), settingsData, { merge: true })

      // Also save to user settings if user is logged in
      if (user?.uid) {
        await setDoc(doc(db, "users", user.uid, "settings", "weather"), settingsData, { merge: true })
      }

      toast({
        title: "Settings Saved",
        description: "Weather settings have been saved successfully",
      })
    } catch (error) {
      console.error("Error saving weather settings:", error)
      toast({
        title: "Error",
        description: "Failed to save weather settings",
        variant: "destructive",
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weather Integration</CardTitle>
        <CardDescription>Configure weather data integration for your locations</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-0.5">
            <Label htmlFor="enable-weather">Enable Weather Data</Label>
            <p className="text-sm text-muted-foreground">Show weather data on dashboards and location pages</p>
          </div>
          <Switch id="enable-weather" checked={enableWeather} onCheckedChange={setEnableWeather} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="weather-provider">Weather Provider</Label>
          <select
            id="weather-provider"
            value={weatherProvider}
            onChange={(e) => setWeatherProvider(e.target.value)}
            className="w-full p-2 border rounded-md"
            disabled={!enableWeather}
          >
            <option value="openweathermap">OpenWeatherMap</option>
            <option value="weatherapi">WeatherAPI.com</option>
            <option value="accuweather">AccuWeather</option>
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="weather-api-key">API Key</Label>
          <Input
            id="weather-api-key"
            type="password"
            placeholder="Enter your weather API key"
            value={weatherApiKey}
            onChange={(e) => setWeatherApiKey(e.target.value)}
            disabled={!enableWeather}
          />
          <p className="text-xs text-muted-foreground">
            {weatherProvider === "openweathermap" && "Get your API key from OpenWeatherMap.org"}
            {weatherProvider === "weatherapi" && "Get your API key from WeatherAPI.com"}
            {weatherProvider === "accuweather" && "Get your API key from developer.accuweather.com"}
          </p>
        </div>
      </CardContent>
      <CardFooter>
        <Button onClick={saveSettings} disabled={saving || loading}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardFooter>
    </Card>
  )
}
