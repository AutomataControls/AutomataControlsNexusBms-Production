"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { db } from "@/lib/firebase"
import { doc, getDoc, setDoc, collection, getDocs } from "firebase/firestore"
import { useAuth } from "@/lib/auth-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"

export function WeatherSettings() {
  const { toast } = useToast()
  const { user } = useAuth()

  const [locations, setLocations] = useState<any[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [weatherApiKey, setWeatherApiKey] = useState("")
  const [zipCode, setZipCode] = useState("")
  const [enableWeather, setEnableWeather] = useState(true)
  const [weatherProvider, setWeatherProvider] = useState("openweathermap")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [fetchingLocations, setFetchingLocations] = useState(true)

  // Fetch available locations
  useEffect(() => {
    async function fetchLocations() {
      try {
        setFetchingLocations(true)
        const locationsCollection = collection(db, "locations")
        const snapshot = await getDocs(locationsCollection)
        const locationData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setLocations(locationData)

        // Select the first location by default if none is selected
        if (locationData.length > 0 && !selectedLocation) {
          setSelectedLocation(locationData[0].id)
        }
      } catch (error) {
        console.error("Error fetching locations:", error)
        toast({
          title: "Error",
          description: "Failed to load locations",
          variant: "destructive",
        })
      } finally {
        setFetchingLocations(false)
      }
    }

    fetchLocations()
  }, [db, toast, selectedLocation])

  // Load settings for the selected location
  useEffect(() => {
    async function loadSettings() {
      if (!selectedLocation) return

      try {
        setLoading(true)

        // Get location-specific weather settings
        const weatherSettingsDoc = await getDoc(doc(db, "locations", selectedLocation, "settings", "weather"))

        if (weatherSettingsDoc.exists()) {
          const data = weatherSettingsDoc.data()
          setWeatherApiKey(data.apiKey || "")
          setZipCode(data.zipCode || "")
          setEnableWeather(data.enabled !== false) // Default to true if not specified
          setWeatherProvider(data.provider || "openweathermap")
          console.log("Loaded location weather settings")
        } else {
          // If no settings exist for this location, reset to defaults
          setWeatherApiKey("")
          setZipCode("")
          setEnableWeather(true)
          setWeatherProvider("openweathermap")

          // Try to get the location's zip code from its address
          const locationDoc = await getDoc(doc(db, "locations", selectedLocation))
          if (locationDoc.exists()) {
            const locationData = locationDoc.data()
            // Extract zip code from address if available
            if (locationData.address) {
              const addressParts = locationData.address.split(",")
              const zipPart = addressParts[addressParts.length - 1]?.trim()
              // Simple regex to extract US zip code
              const zipMatch = zipPart?.match(/\d{5}/)
              if (zipMatch) {
                setZipCode(zipMatch[0])
              }
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
  }, [db, selectedLocation, toast])

  // Save settings to Firestore
  const saveSettings = async () => {
    if (!selectedLocation) {
      toast({
        title: "Error",
        description: "Please select a location",
        variant: "destructive",
      })
      return
    }

    if (!zipCode) {
      toast({
        title: "Validation Error",
        description: "Please enter a ZIP code for the location",
        variant: "destructive",
      })
      return
    }

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
        zipCode: zipCode,
        enabled: enableWeather,
        provider: weatherProvider,
        updatedAt: new Date().toISOString(),
        updatedBy: user?.id || "unknown",
      }

      // Save to location-specific settings
      await setDoc(doc(db, "locations", selectedLocation, "settings", "weather"), settingsData, { merge: true })

      toast({
        title: "Settings Saved",
        description: `Weather settings for ${locations.find((l) => l.id === selectedLocation)?.name || "location"} have been saved successfully`,
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
      <CardContent className="space-y-6">
        {/* Location Selector */}
        <div className="space-y-2">
          <Label htmlFor="location-selector">Select Location</Label>
          {fetchingLocations ? (
            <div className="flex items-center space-x-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm text-muted-foreground">Loading locations...</span>
            </div>
          ) : (
            <Select value={selectedLocation} onValueChange={setSelectedLocation} disabled={locations.length === 0}>
              <SelectTrigger id="location-selector" className="w-full">
                <SelectValue placeholder="Select a location" />
              </SelectTrigger>
              <SelectContent>
                {locations.map((location) => (
                  <SelectItem key={location.id} value={location.id}>
                    {location.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <p className="text-xs text-muted-foreground">Configure weather settings specific to each location</p>
        </div>

        {loading ? (
          <div className="py-4 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="enable-weather">Enable Weather Data</Label>
                <p className="text-sm text-muted-foreground">Show weather data on dashboards and location pages</p>
              </div>
              <Switch id="enable-weather" checked={enableWeather} onCheckedChange={setEnableWeather} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="zip-code">ZIP Code</Label>
              <Input
                id="zip-code"
                placeholder="Enter location ZIP code"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value)}
                disabled={!enableWeather}
              />
              <p className="text-xs text-muted-foreground">The ZIP code for this location's weather data</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="weather-provider">Weather Provider</Label>
              <Select
                id="weather-provider"
                value={weatherProvider}
                onValueChange={setWeatherProvider}
                disabled={!enableWeather}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select provider" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="openweathermap">OpenWeatherMap</SelectItem>
                  <SelectItem value="weatherapi">WeatherAPI.com</SelectItem>
                  <SelectItem value="accuweather">AccuWeather</SelectItem>
                </SelectContent>
              </Select>
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
          </>
        )}
      </CardContent>
      <CardFooter>
        <Button onClick={saveSettings} disabled={saving || loading || !selectedLocation}>
          {saving ? "Saving..." : "Save Settings"}
        </Button>
      </CardFooter>
    </Card>
  )
}
