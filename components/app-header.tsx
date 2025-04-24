"use client"

import { useState, useEffect } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useRouter, usePathname } from "next/navigation"
import { Settings, RefreshCw } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { WeatherDisplay } from "@/components/weather-display"
import { SocketStatus } from "@/components/socket-status"
import { AuthStatus } from "@/components/auth-status"

export function AppHeader() {
  const [date, setDate] = useState<string>("")
  const [time, setTime] = useState<string>("")
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const router = useRouter()
  const pathname = usePathname()
  const { config } = useFirebase()

  // Get the selected location from localStorage
  useEffect(() => {
    const savedLocation = localStorage.getItem("selectedLocation")
    if (savedLocation) {
      setSelectedLocation(savedLocation)
    }

    // Listen for changes to the selected location
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selectedLocation" && e.newValue) {
        setSelectedLocation(e.newValue)
      }
    }

    window.addEventListener("storage", handleStorageChange)
    return () => window.removeEventListener("storage", handleStorageChange)
  }, [])

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()

      // Format date
      const formattedDate = now.toLocaleDateString("en-GB", {
        day: "numeric",
        month: "numeric",
        year: "numeric",
      })

      // Format time in Eastern Time
      const options: Intl.DateTimeFormatOptions = {
        hour: "numeric",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
        timeZone: "America/New_York",
      }

      const formattedTime = new Intl.DateTimeFormat("en-US", options).format(now)

      setDate(formattedDate)
      setTime(formattedTime + " EST")
    }

    updateDateTime()
    const interval = setInterval(updateDateTime, 1000)

    return () => clearInterval(interval)
  }, [])

  const handleRefresh = () => {
    window.location.reload()
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-gray-800 border-gray-700 py-4">
      <div className="flex items-center justify-between px-4 w-full">
        <div className="flex items-center py-1">
          <Image src="/neural-loader.png" alt="Automata Controls Logo" width={180} height={180} className="mr-6" />
          <div className="-mt-2">
            <h1 className="font-cinzel text-3xl text-orange-300 leading-tight">Automata Controls</h1>
            <p className="text-base text-teal-200/80 -mt-1">Building Management System</p>
          </div>
        </div>

        <div className="flex items-center space-x-6 pr-4">
          {/* Pass the selected location ID to the WeatherDisplay component */}
          <WeatherDisplay locationId={selectedLocation} defaultLocation="Fort Wayne, Indiana" defaultZipCode="46803" />

          <div className="flex flex-col items-end">
            <div className="text-sm font-medium text-amber-200/90">{date}</div>
            <div className="text-xs text-teal-200/80">{time}</div>
          </div>

          <div className="flex items-center space-x-3">
            <SocketStatus />
            <AuthStatus />
          </div>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleRefresh}
            title="Refresh"
            className="text-amber-200/90 hover:text-amber-200 hover:bg-teal-800/20"
          >
            <RefreshCw className="h-5 w-5" />
            <span className="sr-only">Refresh</span>
          </Button>

          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push("/dashboard/settings")}
            title="Settings"
            className="text-amber-200/90 hover:text-amber-200 hover:bg-teal-800/20"
          >
            <Settings className="h-5 w-5" />
            <span className="sr-only">Settings</span>
          </Button>
        </div>
      </div>
    </header>
  )
}
