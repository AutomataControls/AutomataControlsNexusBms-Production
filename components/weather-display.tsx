"use client"

import { useState, useEffect } from "react"
import { Cloud, CloudRain, Sun, Snowflake, CloudLightning, CloudFog, Loader2 } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { doc, getDoc } from "firebase/firestore"
import { db } from "@/lib/firebase"

interface WeatherDisplayProps {
  locationId?: string
  defaultLocation?: string
  defaultZipCode?: string
}

export function WeatherDisplay({
  locationId,
  defaultLocation = "Fort Wayne, Indiana",
  defaultZipCode = "46803",
}: WeatherDisplayProps) {
  const [weather, setWeather] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [locationName, setLocationName] = useState<string | null>(null)
  const [weatherSettings, setWeatherSettings] = useState<any>(null)
  const { config } = useFirebase()

  // Fetch location-specific weather settings
  useEffect(() => {
    async function fetchLocationSettings() {
      if (!locationId) return

      try {
        // Get location name
        const locationDoc = await getDoc(doc(db, "locations", locationId))
        if (locationDoc.exists()) {
          setLocationName(locationDoc.data().name || null)
        }

        // Get location weather settings
        const weatherSettingsDoc = await getDoc(doc(db, "locations", locationId, "settings", "weather"))
        if (weatherSettingsDoc.exists()) {
          const data = weatherSettingsDoc.data()
          setWeatherSettings(data)
        } else {
          setWeatherSettings(null)
        }
      } catch (error) {
        console.error("Error fetching location weather settings:", error)
        setWeatherSettings(null)
      }
    }

    fetchLocationSettings()
  }, [locationId])

  // Fetch weather data
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true)

        // Determine which API key and zip code to use
        let apiKey = null
        let zipCode = defaultZipCode

        // First priority: location-specific settings
        if (weatherSettings && weatherSettings.enabled && weatherSettings.apiKey) {
          apiKey = weatherSettings.apiKey
          zipCode = weatherSettings.zipCode || defaultZipCode
        }
        // Second priority: global settings from config
        else if (config?.weatherApiKey) {
          apiKey = config.weatherApiKey
          zipCode = config.weatherZipCode || defaultZipCode
        }

        if (apiKey) {
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?zip=${zipCode},us&units=imperial&appid=${apiKey}`,
          )

          if (!response.ok) {
            throw new Error("Weather API request failed")
          }

          const data = await response.json()
          setWeather(data)
        } else {
          // Mock data if no API key is available
          setWeather({
            name: locationName || defaultLocation.split(",")[0],
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
        setWeather({
          name: locationName || defaultLocation.split(",")[0],
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
  }, [config, defaultLocation, defaultZipCode, weatherSettings, locationName])

  const getWeatherIcon = () => {
    if (!weather) return <Cloud className="h-5 w-5" />

    const condition = weather.weather[0].main.toLowerCase()

    switch (condition) {
      case "clear":
        return <Sun className="h-5 w-5 text-amber-300" />
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
        return <Cloud className="h-5 w-5" />
    }
  }

  if (loading) {
    return (
      <div className="flex items-center text-sm text-amber-200/90">
        <Loader2 className="h-5 w-5 mr-1 animate-spin" />
        <span>Loading weather...</span>
      </div>
    )
  }

  if (!weather) {
    return (
      <div className="flex items-center text-sm text-amber-200/90">
        <Cloud className="h-5 w-5 mr-1" />
        <span>Weather unavailable</span>
      </div>
    )
  }

  return (
    <div className="flex items-center text-sm text-amber-200/90">
      <div className="mr-1">{getWeatherIcon()}</div>
      <div>
        <span>{Math.round(weather.main.temp)}°F</span>
        <span className="mx-1">|</span>
        <span>{weather.name}</span>
      </div>
    </div>
  )
}
