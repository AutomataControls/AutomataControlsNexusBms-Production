"use client"

import { useState, useEffect } from "react"
import { Cloud, CloudRain, Sun, Snowflake, CloudLightning, CloudFog } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"

interface WeatherDisplayProps {
  defaultLocation?: string
  defaultZipCode?: string
}

export function WeatherDisplay({
  defaultLocation = "Fort Wayne, Indiana",
  defaultZipCode = "46803",
}: WeatherDisplayProps) {
  const [weather, setWeather] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const { config } = useFirebase()

  useEffect(() => {
    const fetchWeather = async () => {
      try {
        setLoading(true)

        // Use API key from config if available, otherwise use mock data
        if (config?.weatherApiKey) {
          const response = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?zip=${config.weatherZipCode || defaultZipCode},us&units=imperial&appid=${config.weatherApiKey}`,
          )

          if (!response.ok) {
            throw new Error("Weather API request failed")
          }

          const data = await response.json()
          setWeather(data)
        } else {
          // Mock data for Fort Wayne
          setWeather({
            name: defaultLocation.split(",")[0],
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
          name: defaultLocation.split(",")[0],
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
  }, [config, defaultLocation, defaultZipCode])

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
        <Cloud className="h-5 w-5 mr-1 animate-pulse" />
        <span>Loading...</span>
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

