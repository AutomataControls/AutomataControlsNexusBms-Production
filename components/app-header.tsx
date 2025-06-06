"use client"

import { useState, useEffect, useMemo } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { useRouter, usePathname } from "next/navigation"
import { Settings, RefreshCw, Wifi, WifiOff, Cloud, MapPin, Calendar, Clock } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { WeatherDisplay } from "@/components/weather-display"
import { Badge } from "@/components/ui/badge"
import { collection, getDocs } from "firebase/firestore"

// Firebase Connection Status Component
function FirebaseStatus() {
  const [isConnected, setIsConnected] = useState(true)
  const [isChecking, setIsChecking] = useState(false)
  const { db } = useFirebase()

  const checkFirebaseConnection = async () => {
    if (!db) {
      setIsConnected(false)
      return
    }

    try {
      setIsChecking(true)
      // Try to fetch a small collection to test connectivity
      const testCollection = collection(db, "locations")
      await getDocs(testCollection)
      setIsConnected(true)
    } catch (error) {
      console.error("Firebase connection error:", error)
      setIsConnected(false)
    } finally {
      setIsChecking(false)
    }
  }

  useEffect(() => {
    checkFirebaseConnection()
    // Check connection every 30 seconds
    const interval = setInterval(checkFirebaseConnection, 30000)
    return () => clearInterval(interval)
  }, [db])

  return (
    <div className="flex items-center gap-2">
      <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-colors ${
        isConnected 
          ? "bg-green-100 text-green-700" 
          : "bg-red-100 text-red-700"
      }`}>
        {isChecking ? (
          <RefreshCw className="h-3 w-3 animate-spin" />
        ) : isConnected ? (
          <Wifi className="h-3 w-3" />
        ) : (
          <WifiOff className="h-3 w-3" />
        )}
        <span>{isConnected ? "Connected" : "Disconnected"}</span>
      </div>
    </div>
  )
}

// Enhanced Location Display Component
function LocationDisplay({ locationId }: { locationId: string }) {
  const [locationName, setLocationName] = useState<string>("")
  const { db } = useFirebase()

  useEffect(() => {
    const fetchLocationName = async () => {
      if (!db || !locationId) return

      try {
        const locationsCollection = collection(db, "locations")
        const snapshot = await getDocs(locationsCollection)
        const location = snapshot.docs.find(doc => {
          const data = doc.data()
          return data.id === locationId
        })
        
        if (location) {
          setLocationName(location.data().name || "Unknown Location")
        }
      } catch (error) {
        console.error("Error fetching location name:", error)
        setLocationName("Unknown Location")
      }
    }

    fetchLocationName()
  }, [db, locationId])

  if (!locationId || !locationName) return null

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-[#14b8a6]/10 rounded-full border border-[#14b8a6]/20">
      <MapPin className="h-3 w-3 text-[#14b8a6]" />
      <span className="text-xs font-medium text-[#14b8a6] max-w-32 truncate">
        {locationName}
      </span>
    </div>
  )
}

export function AppHeader() {
  const [date, setDate] = useState<string>("")
  const [time, setTime] = useState<string>("")
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [mounted, setMounted] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const { config } = useFirebase()
  const { user } = useAuth()

  // Handle mounting to prevent hydration issues
  useEffect(() => {
    setMounted(true)
  }, [])

  // Get the selected location from localStorage with better handling
  useEffect(() => {
    if (!mounted) return

    const savedLocation = localStorage.getItem("selectedLocation")
    if (savedLocation) {
      setSelectedLocation(savedLocation)
    }

    // Listen for changes to the selected location
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === "selectedLocation") {
        setSelectedLocation(e.newValue || "")
      }
    }

    // Listen for custom events from sidebar location changes
    const handleLocationChange = (e: CustomEvent) => {
      setSelectedLocation(e.detail.locationId)
    }

    window.addEventListener("storage", handleStorageChange)
    window.addEventListener("locationChanged" as any, handleLocationChange)
    
    return () => {
      window.removeEventListener("storage", handleStorageChange)
      window.removeEventListener("locationChanged" as any, handleLocationChange)
    }
  }, [mounted])

  // Enhanced date/time formatting
  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()

      // Format date in US format (MM/DD/YYYY)
      const formattedDate = now.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
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
    // Show loading state briefly before refresh
    const refreshButton = document.querySelector('[title="Refresh"] svg')
    if (refreshButton) {
      refreshButton.classList.add('animate-spin')
    }
    
    setTimeout(() => {
      window.location.reload()
    }, 300)
  }

  // Check if user has admin access for settings
  const hasAdminAccess = useMemo(() => {
    return user?.roles && (user.roles.includes("admin") || user.roles.includes("DevOps"))
  }, [user])

  // Don't render until mounted to prevent hydration mismatch
  if (!mounted) {
    return (
      <header className="sticky top-0 z-50 w-full border-b bg-[#f0faf8] shadow-sm">
        <div className="h-1 w-full bg-gradient-to-r from-[#14b8a6]/30 to-[#fb923c]/30"></div>
        <div className="flex items-center justify-between px-4 py-2 w-full">
          <div className="flex items-center py-1">
            <div className="w-12 h-12 bg-gray-200 rounded mr-4 animate-pulse"></div>
            <div>
              <div className="h-5 w-48 bg-gray-200 rounded animate-pulse mb-1"></div>
              <div className="h-4 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
          <div className="flex items-center space-x-6">
            <div className="w-32 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-20 h-8 bg-gray-200 rounded animate-pulse"></div>
            <div className="w-16 h-8 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-[#f0faf8] shadow-sm">
      {/* Gradient accent bar */}
      <div className="h-1 w-full bg-gradient-to-r from-[#14b8a6]/30 to-[#fb923c]/30"></div>
      
      <div className="flex items-center justify-between px-4 py-2 w-full">
        {/* Logo and branding */}
        <div className="flex items-center py-1">
          <div className="relative mr-4">
            <div className="bg-white rounded-full p-1 shadow-sm">
              <Image
                src="/neural-loader.png"
                alt="Automata Controls Logo"
                width={50}
                height={50}
                className="drop-shadow-sm"
                priority
              />
            </div>
          </div>
          <div>
            <h1 className="font-cinzel text-xl text-[#14b8a6] leading-tight font-bold">
              AUTOMATA CONTROLS
            </h1>
            <p className="text-sm text-[#fb923c]/80 -mt-1 font-medium">
              Building Management System
            </p>
          </div>
        </div>

        {/* Right side content */}
        <div className="flex items-center space-x-4">
          {/* Current location indicator */}
          {selectedLocation && (
            <LocationDisplay locationId={selectedLocation} />
          )}

          {/* Weather display with enhanced error handling */}
          <div className="hidden md:block">
            <WeatherDisplay 
              locationId={selectedLocation} 
              defaultLocation="Fort Wayne, Indiana" 
              defaultZipCode="46803"
              className="text-gray-500"
              tempClassName="text-gray-500"
              locationClassName="text-gray-500"
            />
          </div>

          {/* Date and time */}
          <div className="flex flex-col items-end">
            <div className="flex items-center gap-1 text-sm font-medium text-[#14b8a6]">
              <Calendar className="h-3 w-3" />
              {date}
            </div>
            <div className="flex items-center gap-1 text-xs text-gray-500">
              <Clock className="h-3 w-3" />
              {time}
            </div>
          </div>

          {/* Status indicators */}
          <div className="flex items-center space-x-2">
            <FirebaseStatus />
            {user && (
              <Badge 
                variant={hasAdminAccess ? "default" : "secondary"}
                className={`text-xs ${
                  hasAdminAccess 
                    ? "bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20" 
                    : "bg-slate-100 text-slate-600"
                }`}
              >
                {user.name?.split(' ')[0] || user.username}
              </Badge>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              title="Refresh Dashboard"
              className="text-gray-500 hover:text-[#14b8a6] hover:bg-[#14b8a6]/10 transition-all duration-200 h-8 w-8 p-0"
            >
              <RefreshCw className="h-4 w-4" />
              <span className="sr-only">Refresh</span>
            </Button>

            {hasAdminAccess && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard/settings")}
                title="System Settings"
                className="text-gray-500 hover:text-[#14b8a6] hover:bg-[#14b8a6]/10 transition-all duration-200 h-8 w-8 p-0"
              >
                <Settings className="h-4 w-4" />
                <span className="sr-only">Settings</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    </header>
  )
}
