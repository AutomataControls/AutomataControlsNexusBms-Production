"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"
import { AlertCircle, CheckCircle2, Cloud } from "lucide-react"

export function WeatherSettings() {
  const { config, updateConfig } = useFirebase()
  const [weatherConfig, setWeatherConfig] = useState({
    weatherApiKey: config?.weatherApiKey || "",
    weatherLocation: config?.weatherLocation || "",
  })
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (config) {
      setWeatherConfig({
        weatherApiKey: config.weatherApiKey || "",
        weatherLocation: config.weatherLocation || "",
      })
    }
  }, [config])

  const handleSaveConfig = async () => {
    try {
      setIsSaving(true)
      await updateConfig({
        ...config,
        weatherApiKey: weatherConfig.weatherApiKey,
        weatherLocation: weatherConfig.weatherLocation,
      })

      toast({
        title: "Weather Configuration Saved",
        description: "Your weather configuration has been updated and persisted",
      })
    } catch (error) {
      console.error("Error saving weather config:", error)
      toast({
        title: "Error",
        description: "Failed to save weather configuration. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const handleTestWeatherApi = async () => {
    setTestStatus("testing")

    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?q=${weatherConfig.weatherLocation}&appid=${weatherConfig.weatherApiKey}&units=metric`,
      )

      if (response.ok) {
        setTestStatus("success")
        toast({
          title: "Weather API Test Successful",
          description: "Successfully connected to OpenWeatherMap API",
        })
      } else {
        setTestStatus("error")
        toast({
          title: "Weather API Test Failed",
          description: "Failed to connect to OpenWeatherMap API. Please check your API key and location.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error testing weather API:", error)
      setTestStatus("error")
      toast({
        title: "Weather API Test Error",
        description: "An error occurred while testing the OpenWeatherMap API",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Cloud className="h-5 w-5 mr-2" />
            Weather Configuration
          </CardTitle>
          <CardDescription>Configure OpenWeatherMap API for weather display</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="weather-api-key">OpenWeatherMap API Key</Label>
            <Input
              id="weather-api-key"
              value={weatherConfig.weatherApiKey}
              onChange={(e) => setWeatherConfig({ ...weatherConfig, weatherApiKey: e.target.value })}
              placeholder="Your OpenWeatherMap API Key"
            />
            <p className="text-xs text-muted-foreground">
              Get your API key from{" "}
              <a href="https://openweathermap.org/api" target="_blank" rel="noopener noreferrer" className="underline">
                OpenWeatherMap
              </a>
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="weather-location">Location</Label>
            <Input
              id="weather-location"
              value={weatherConfig.weatherLocation}
              onChange={(e) => setWeatherConfig({ ...weatherConfig, weatherLocation: e.target.value })}
              placeholder="City name (e.g., London,UK)"
            />
            <p className="text-xs text-muted-foreground">
              Enter city name and country code separated by comma (e.g., London,UK)
            </p>
          </div>

          {testStatus === "success" && (
            <div className="flex items-center p-3 text-sm rounded-md bg-green-50 text-green-700">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              Weather API connection successful
            </div>
          )}

          {testStatus === "error" && (
            <div className="flex items-center p-3 text-sm rounded-md bg-red-50 text-red-700">
              <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
              Failed to connect to Weather API. Please check your API key and location.
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleTestWeatherApi}
            disabled={!weatherConfig.weatherApiKey || !weatherConfig.weatherLocation || testStatus === "testing" || isSaving}
          >
            {testStatus === "testing" ? "Testing..." : "Test API Connection"}
          </Button>
          <Button 
            onClick={handleSaveConfig} 
            disabled={!weatherConfig.weatherApiKey || !weatherConfig.weatherLocation || isSaving}
          >
            {isSaving ? "Saving..." : "Save Configuration"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

