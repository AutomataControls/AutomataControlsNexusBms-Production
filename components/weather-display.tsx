"use client"

import { useState, useEffect } from "react"
import { Cloud, CloudRain, Sun, Snowflake, CloudLightning, CloudFog, Loader2 } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { doc, getDoc, collection, getDocs } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface WeatherDisplayProps {
  locationId?: string
  defaultLocation?: string
  defaultZipCode?: string
  className?: string
  tempClassName?: string
  locationClassName?: string
}

export function WeatherDisplay({
  locationId,
  defaultLocation = "Fort Wayne, Indiana",
  defaultZipCode = "46803",
  className = "text-gray-500",
  tempClassName = "text-gray-500", 
  locationClassName = "text-gray-500",
}: WeatherDisplayProps) {
  const [weather, setWeather] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [weatherSettings, setWeatherSettings] = useState<any>(null)
  const { config } = useFirebase()

  // Fetch location-specific weather settings
  useEffect(() => {
    async function fetchLocationSettings() {
      if (!locationId) {
        setLocationName(null)
        setWeatherSettings(null)
        return
      }

      try {
        console.log("Fetching weather settings for location:", locationId)
        
        // Get location name - try both document ID and data.id approaches
        const locationsCollection = collection(db, "locations")
        const snapshot = await getDocs(locationsCollection)
        
        let foundLocation: any = null
        snapshot.docs.forEach(doc => {
          const data = doc.data()
          // Check if the location matches either the document ID or the id field in the data
          if (doc.id === locationId || data.id === locationId) {
            foundLocation = data
          }
        })

        if (foundLocation) {
          setLocationName(foundLocation.name || null)
          console.log("Found location name:", foundLocation.name)
        } else {
          console.log("Location not found:", locationId)
          setLocationName(null)
        }

        // Try to get location weather settings
        try {
          const weatherSettingsDoc = await getDoc(doc(db, "locations", locationId, "settings", "weather"))
          if (weatherSettingsDoc.exists()) {
            const data = weatherSettingsDoc.data()
            setWeatherSettings(data)
            console.log("Found weather settings:", data)
          } else {
            console.log("No weather settings found for location")
            setWeatherSettings(null)
          }
        } catch (settingsError) {
          console.log("Could not fetch weather settings:", settingsError)
          setWeatherSettings(null)
        }
      } catch (error) {
        console.error("Error fetching location weather settings:", error)
        setLocationName(null)
        setWeatherSettings(null)
      }
    }

    fetchLocationSettings()
  }, [locationId]) // Re-run when locationId changes

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true)

        // Determine which API key and zip code to use
        let apiKey = null
        let zipCode = defaultZipCode
        let displayLocation = locationName || defaultLocation.split(",")[0]

        // First priority: location-specific settings
        if (weatherSettings && weatherSettings.enabled && weatherSettings.apiKey) {
          apiKey = weatherSettings.apiKey
          zipCode = weatherSettings.zipCode || defaultZipCode
          console.log("Using location-specific weather settings")
        }
        // Second priority: global settings from config
        else if (config?.weatherApiKey) {
          apiKey = (config as any)?.weatherApiKey
          zipCode = (config as any)?.weatherZipCode || defaultZipCode
          console.log("Using global weather settings")
        }

        if (apiKey) {
          console.log(`Fetching weather for zip: ${zipCode}`)
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?zip=${zipCode},us&units=imperial&appid=${apiKey}`,
          )

          if (!response.ok) {
            throw new Error(`Weather API request failed: ${response.status}`)
          }

          const data = await response.json()
          console.log("Weather data received:", data.name, data.main.temp)
          setWeather(data)
        } else {
          console.log("No API key available, using mock data")
          // Mock data if no API key is available
          setWeather({
            name: displayLocation,
            main: {
              temp: 72,
              humidity: 65,
            },
            weather: [
              {
                main: "Clear",
                description: "clear sky",
              },
            ],
          })
        }
      } catch (error) {
        console.error("Error fetching weather:", error)
        // Fallback to mock data
        const displayLocation = locationName || defaultLocation.split(",")[0]
        setWeather({
          name: displayLocation,
          main: {
            temp: 72,
            humidity: 65,
          },
          weather: [
            {
              main: "Clear",
              description: "clear sky",
            },
          ],
        })
      } finally {
        setLoading(false)
      }
    }

    fetchWeather()

    // Refresh weather every 30 minutes
    const interval = setInterval(fetchWeather, 30 * 60 * 1000)

    return () => clearInterval(interval)
  }, [config, defaultLocation, defaultZipCode, weatherSettings, locationName]) // Re-run when any dependency changes

  const getWeatherIcon = () => {
    if (!weather) return <Cloud className="h-5 w-5" />

    const condition = weather.weather[0].main.toLowerCase()

    switch (condition) {
      case "clear":
        return <Sun className="h-5 w-5 text-amber-400" />
      case "clouds":
        return <Cloud className="h-5 w-5 text-gray-400" />
      case "rain":
      case "drizzle":
        return <CloudRain className="h-5 w-5 text-blue-400" />
      case "snow":
        return <Snowflake className="h-5 w-5 text-blue-200" />
      case "thunderstorm":
        return <CloudLightning className="h-5 w-5 text-purple-400" />
      case "mist":
      case "fog":
      case "haze":
        return <CloudFog className="h-5 w-5 text-gray-300" />
      default:
        return <Cloud className="h-5 w-5 text-gray-400" />
    }
  }

  if (loading) {
    return (
      <div className={`flex items-center text-sm ${className}`}>
        <Loader2 className="h-5 w-5 mr-1 animate-spin" />
        <span>Loading weather...</span>
      </div>
    )
  }

  if (!weather) {
    return (
      <div className={`flex items-center text-sm ${className}`}>
        <Cloud className="h-5 w-5 mr-1" />
        <span>Weather unavailable</span>
      </div>
    )
  }

  return (
    <div className={`flex items-center text-sm ${className}`}>
      <div className="mr-1">{getWeatherIcon()}</div>
      <div>
        <span className={tempClassName}>{Math.round(weather.main.temp)}°F</span>
        <span className="mx-1">|</span>
        <span className={locationClassName}>{weather.name}</span>
      </div>
    </div>
  )
}
