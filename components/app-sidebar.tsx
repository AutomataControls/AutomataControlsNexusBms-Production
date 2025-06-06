"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import {
  Building,
  Fan,
  Thermometer,
  Droplet,
  Gauge,
  BarChart3,
  Bell,
  Home,
  Settings,
  ChevronDown,
  LogOut,
  MapPin,
  Activity,
  Shield,
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirebase } from "@/lib/firebase-context"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { collection, getDocs, query, where } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import Image from "next/image"

interface Location {
  id: string
  name: string
  [key: string]: any
}

interface Equipment {
  id: string
  name: string
  type: string
  locationId: string
  [key: string]: any
}

export function AppSidebar() {
  const [locations, setLocations] = useState<Location[]>([])
  const [selectedLocation, setSelectedLocation] = useState<string>("")
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [equipmentTypes, setEquipmentTypes] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [sidebarInitialized, setSidebarInitialized] = useState(false)
  const { db, fetchCachedData } = useFirebase()
  const { user, logout } = useAuth()
  const router = useRouter()
  const pathname = usePathname()

  // Check if user has admin or DevOps privileges
  const isAdminOrDevOps = useMemo(() => {
    if (!user?.roles || !Array.isArray(user.roles)) return false
    // Use the same logic as hasEquipmentControlAccess but only for actual admins/devops
    return user.roles.some(role =>
      role.toLowerCase() === "admin" ||
      role.toLowerCase() === "devops"
    )
  }, [user])

  // Helper function to get the correct navigation URL based on user role
  const getNavUrl = useCallback(
    (basePath: string) => {
      // Admin/DevOps users can access the global pages
      if (isAdminOrDevOps) {
        return basePath
      }

      // Regular users should always go to their location-specific pages
      if (selectedLocation) {
        // For overview page
        if (basePath === "/dashboard") {
          return `/dashboard/location/${selectedLocation}`
        }

        // For other pages, add the locationId parameter
        return `${basePath}?locationId=${selectedLocation}`
      }

      // Fallback to base path if no location is selected
      return basePath
    },
    [isAdminOrDevOps, selectedLocation],
  )

  // Fetch locations with caching
  const fetchLocations = useCallback(async () => {
    if (!db || !user) return

    try {
      setLoading(true)

      const cacheKey = `sidebar_locations_${user.id}`
      const locationData = await fetchCachedData(
        cacheKey,
        async () => {
          if (!db) return []

          // If user is admin, fetch all locations
          if (isAdminOrDevOps) {
            console.log("Admin user - fetching all locations")
            const locationsCollection = collection(db, "locations")
            const snapshot = await getDocs(locationsCollection)
            return snapshot.docs.map((doc) => ({
              id: doc.id,
              ...doc.data(),
            })) as Location[]
          }
          // Otherwise, fetch only assigned locations
          else if (user.assignedLocations && user.assignedLocations.length > 0) {
            console.log("Regular user - fetching assigned locations:", user.assignedLocations)

            // Get all locations that match the assigned location IDs
            const locationsCollection = collection(db, "locations")
            const snapshot = await getDocs(locationsCollection)
            const assignedLocationDocs = snapshot.docs
              .filter((doc) => {
                // Filter by the id field inside the document (not the document ID)
                const locationData = doc.data()
                return user.assignedLocations?.includes(locationData.id)
              })
              .map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as Location[]

            console.log("Found assigned location documents:", assignedLocationDocs)
            return assignedLocationDocs
          }
          // Fallback for users with no assigned locations
          else {
            console.log("User has no assigned locations")
            return []
          }
        },
        5, // Cache for 5 minutes - reduced from 10 to ensure more frequent updates
      )

      console.log("Setting locations in sidebar:", locationData)
      setLocations(locationData)

      // Auto-select location logic
      if (locationData.length === 1) {
        // If user has only one location, auto-select it
        setSelectedLocation(locationData[0].id)
        localStorage.setItem("selectedLocation", locationData[0].id)
      } else {
        // Check localStorage for saved location
        const savedLocation = localStorage.getItem("selectedLocation")
        if (savedLocation && locationData.some((loc: Location) => loc.id === savedLocation)) {
          setSelectedLocation(savedLocation)
        } else if (locationData.length > 0 && !selectedLocation) {
          setSelectedLocation(locationData[0].id)
        }
      }

      // If user is not admin/DevOps and has assignedLocations, make sure we're using the first one
      if (!isAdminOrDevOps && user.assignedLocations && user.assignedLocations.length > 0) {
        // Use the first assigned location if none is selected
        if (!selectedLocation) {
          console.log("Setting default location for regular user:", user.assignedLocations[0])
          setSelectedLocation(user.assignedLocations[0])
          localStorage.setItem("selectedLocation", user.assignedLocations[0])
        }
      }
    } catch (error) {
      console.error("Error fetching locations:", error)
    } finally {
      setLoading(false)
    }
  }, [db, user, selectedLocation, fetchCachedData, isAdminOrDevOps])

  // Fetch equipment with caching
  const fetchEquipment = useCallback(async () => {
    if (!db || !selectedLocation) return

    try {
      setLoading(true)

      const cacheKey = `sidebar_equipment_${selectedLocation}`
      const equipmentData = await fetchCachedData(
        cacheKey,
        async () => {
          if (!db) return []

          const equipmentCollection = collection(db, "equipment")
          const equipmentQuery = query(equipmentCollection, where("locationId", "==", selectedLocation))
          const snapshot = await getDocs(equipmentQuery)

          return snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Equipment[]
        },
        5, // Cache for 5 minutes
      )

      setEquipment(equipmentData)

      // Extract unique equipment types
      const types = Array.from(new Set(equipmentData.map((item: Equipment) => item.type))) as string[]
      setEquipmentTypes(types)
    } catch (error) {
      console.error("Error fetching equipment:", error)
    } finally {
      setLoading(false)
    }
  }, [db, selectedLocation, fetchCachedData])

  // Initial data loading
  useEffect(() => {
    console.log("AppSidebar - Initial render with user:", user?.id)
    if (user) {
      fetchLocations().then(() => {
        setSidebarInitialized(true)
        console.log("AppSidebar - Sidebar initialized")
      })
    }
  }, [fetchLocations, user])

  // Load equipment when location changes
  useEffect(() => {
    if (selectedLocation) {
      fetchEquipment()
    }
  }, [selectedLocation, fetchEquipment])

  // Modified to maintain the current page when changing locations
  const handleLocationChange = (value: string) => {
    setSelectedLocation(value)
    localStorage.setItem("selectedLocation", value)

    // If we're on a controls page, stay on controls but update the locationId
    if (pathname.includes("/dashboard/controls")) {
      router.push(`/dashboard/controls?locationId=${value}`)
    } else {
      // Otherwise go to the location overview
      router.push(`/dashboard/location/${value}`)
    }
  }

  // Memoize the equipment icon function to avoid recreating it on every render
  const getEquipmentIcon = useCallback((type: string) => {
    if (!type) return Building
    switch (type.toLowerCase()) {
      case "air handler":
      case "doas":
      case "fan coil":
      case "make up air":
      case "exhaust fan":
      case "supply fan":
        return Fan
      case "boiler":
      case "unit heater":
      case "heating actuator":
        return Thermometer
      case "chiller":
      case "cooling actuator":
        return Droplet
      case "pump":
        return Gauge
      default:
        return Building
    }
  }, [])

  // Get user initials for avatar
  const getUserInitials = useCallback(() => {
    if (user?.name) {
      return user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    }
    if (user?.username) {
      return user.username.slice(0, 2).toUpperCase()
    }
    return "U"
  }, [user])

  // Get equipment count for a type
  const getEquipmentCount = useCallback(
    (type: string) => {
      return equipment.filter((e) => e.type === type).length
    },
    [equipment],
  )

  // Memoize the equipment list to prevent unnecessary re-renders
  const equipmentList = useMemo(() => {
    if (loading) {
      return [
        <div key="equipment-loading" className="space-y-2 px-2 py-1">
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
          <Skeleton className="h-8 w-full rounded-md" />
        </div>
      ]
    }

    if (!selectedLocation || equipmentTypes.length === 0) {
      return [
        <div key="equipment-empty" className="px-3 py-6 text-center">
          <Building className="h-8 w-8 mx-auto text-slate-400 mb-2" />
          <p className="text-sm text-slate-500 font-medium">No equipment available</p>
          <p className="text-xs text-slate-400">Select a location to view equipment</p>
        </div>
      ]
    }

    return equipmentTypes.map((type, index) => {
      const Icon = getEquipmentIcon(type)
      const equipmentOfType = equipment.filter((e) => e.type === type)
      const count = getEquipmentCount(type)

      return (
        <SidebarMenuItem key={`equipment-type-${type}-${index}`}>
          <Collapsible className="w-full">
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className="group hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-all duration-200">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#14b8a6]/10 group-hover:bg-[#14b8a6]/20 transition-colors">
                  <Icon className="h-4 w-4 text-[#14b8a6]" />
                </div>
                <div className="flex-1 text-left">
                  <span className="font-medium">{type}s</span>
                  <Badge variant="secondary" className="ml-2 text-xs bg-slate-100 text-slate-600">
                    {count}
                  </Badge>
                </div>
                <ChevronDown className="h-4 w-4 text-slate-400 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub className="ml-2 border-l border-slate-200">
                {equipmentOfType.map((item, itemIndex) => {
                  const isActive = pathname.includes(`/dashboard/controls`) && pathname.includes(item.id)
                  return (
                    <SidebarMenuSubItem key={`equipment-item-${item.id}-${itemIndex}`}>
                      <SidebarMenuSubButton
                        onClick={() =>
                          router.push(`/dashboard/controls?locationId=${selectedLocation}&equipmentId=${item.id}`)
                        }
                        isActive={isActive}
                        className={`transition-all duration-200 ${
                          isActive
                            ? "bg-[#14b8a6]/10 text-[#14b8a6] font-medium border-r-2 border-[#14b8a6]"
                            : "hover:bg-slate-50 hover:text-slate-900"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <div className={`w-2 h-2 rounded-full ${isActive ? "bg-[#14b8a6]" : "bg-slate-300"}`} />
                          <span className="truncate">{item.name}</span>
                        </div>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  )
                })}
              </SidebarMenuSub>
            </CollapsibleContent>
          </Collapsible>
        </SidebarMenuItem>
      )
    })
  }, [loading, selectedLocation, equipmentTypes, equipment, pathname, getEquipmentIcon, getEquipmentCount, router])

  // Show a skeleton sidebar while initializing
  if (!sidebarInitialized) {
    return (
      <Sidebar className="bg-white border-r border-slate-200">
        <SidebarHeader className="p-6 border-b border-slate-100">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-4 w-24 mb-1" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
          <Skeleton className="h-10 w-full rounded-md" />
        </SidebarHeader>
        <SidebarContent className="p-4">
          <div className="space-y-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-20" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-16" />
              <Skeleton className="h-8 w-full rounded-md" />
              <Skeleton className="h-8 w-full rounded-md" />
            </div>
          </div>
        </SidebarContent>
      </Sidebar>
    )
  }

  return (
    <Sidebar className="bg-white border-r border-slate-200 shadow-sm">
      <SidebarHeader className="p-6 border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white">
        {/* Logo Section */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative">
            <div className="bg-white rounded-full p-2 shadow-md">
              <Image
                src="/neural-loader.png"
                alt="Automata Controls"
                width={40}
                height={40}
                className="drop-shadow-sm"
              />
            </div>
          </div>
          <div>
            <h1 className="font-cinzel text-lg font-bold text-[#14b8a6] leading-tight">AUTOMATA</h1>
            <p className="text-xs text-[#fb923c] font-medium tracking-wide">CONTROLS</p>
          </div>
        </div>

        {/* User Info */}
        {user && (
          <div className="flex items-center gap-3 mb-4 p-3 bg-white rounded-lg shadow-sm border border-slate-100">
            <Avatar className="h-10 w-10 border-2 border-[#14b8a6]/20">
              <AvatarFallback className="bg-[#14b8a6]/10 text-[#14b8a6] font-semibold text-sm">
                {getUserInitials()}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 truncate">{user.name || user.username}</p>
              <div className="flex items-center gap-2">
                <Badge
                  variant={isAdminOrDevOps ? "default" : "secondary"}
                  className={`text-xs ${
                    isAdminOrDevOps
                      ? "bg-[#fb923c]/10 text-[#fb923c] border-[#fb923c]/20"
                      : "bg-slate-100 text-slate-600"
                  }`}
                >
                  {isAdminOrDevOps ? "Admin" : "User"}
                </Badge>
              </div>
            </div>
          </div>
        )}

        {/* Location Info */}
        {selectedLocation && locations.find((loc) => loc.id === selectedLocation) && (
          <div className="mb-4 p-3 bg-[#14b8a6]/5 rounded-lg border border-[#14b8a6]/10">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-[#14b8a6]" />
              <span className="text-xs font-medium text-[#14b8a6] uppercase tracking-wide">Current Location</span>
            </div>
            <p className="font-semibold text-slate-900 text-sm">
              {locations.find((loc) => loc.id === selectedLocation)?.name}
            </p>
          </div>
        )}

        {/* Location Selector */}
        <Select
          value={selectedLocation}
          onValueChange={handleLocationChange}
          disabled={loading || (!isAdminOrDevOps && locations.length <= 1)}
        >
          <SelectTrigger className="w-full bg-white border-slate-200 hover:border-[#14b8a6]/50 focus:border-[#14b8a6] transition-colors">
            <SelectValue placeholder={isAdminOrDevOps ? "Select location" : "Assigned location"} />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                <div className="flex items-center gap-2">
                  <Building className="h-4 w-4 text-slate-500" />
                  {location.name}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SidebarHeader>

      <SidebarContent className="p-4">
        {/* Navigation Section */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-slate-600 font-semibold text-xs uppercase tracking-wide mb-3">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu className="space-y-1">
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    if (isAdminOrDevOps) {
                      router.push("/dashboard")
                    } else if (selectedLocation) {
                      router.push(`/dashboard/location/${selectedLocation}`)
                    } else {
                      router.push("/dashboard")
                    }
                  }}
                  isActive={
                    isAdminOrDevOps
                      ? pathname === "/dashboard"
                      : pathname.includes(`/dashboard/location/${selectedLocation}`)
                  }
                  className={`transition-all duration-200 ${
                    (
                      isAdminOrDevOps
                        ? pathname === "/dashboard"
                        : pathname.includes(`/dashboard/location/${selectedLocation}`)
                    )
                      ? "bg-[#14b8a6]/10 text-[#14b8a6] font-medium shadow-sm"
                      : "hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#14b8a6]/10">
                    <Home className="h-4 w-4 text-[#14b8a6]" />
                  </div>
                  <span className="font-medium">Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    router.push("/dashboard/control-logic")
                  }}
                  isActive={pathname.includes("/dashboard/control-logic")}
                  className={`transition-all duration-200 ${
                    pathname.includes("/dashboard/control-logic")
                      ? "bg-[#14b8a6]/10 text-[#14b8a6] font-medium shadow-sm"
                      : "hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#fb923c]/10">
                    <Gauge className="h-4 w-4 text-[#fb923c]" />
                  </div>
                  <span className="font-medium">Controls</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    if (selectedLocation) {
                      router.push(`/dashboard/analytics?locationId=${selectedLocation}`)
                    } else {
                      router.push("/dashboard/analytics")
                    }
                  }}
                  isActive={pathname.includes("/dashboard/analytics")}
                  className={`transition-all duration-200 ${
                    pathname.includes("/dashboard/analytics")
                      ? "bg-[#14b8a6]/10 text-[#14b8a6] font-medium shadow-sm"
                      : "hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-blue-500/10">
                    <BarChart3 className="h-4 w-4 text-blue-600" />
                  </div>
                  <span className="font-medium">Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    if (selectedLocation) {
                      router.push(`/dashboard/alarms?locationId=${selectedLocation}`)
                    } else {
                      router.push("/dashboard/alarms")
                    }
                  }}
                  isActive={pathname.includes("/dashboard/alarms")}
                  className={`transition-all duration-200 ${
                    pathname.includes("/dashboard/alarms")
                      ? "bg-[#14b8a6]/10 text-[#14b8a6] font-medium shadow-sm"
                      : "hover:bg-slate-50 hover:text-slate-900"
                  }`}
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10">
                    <Bell className="h-4 w-4 text-red-600" />
                  </div>
                  <span className="font-medium">Alarms</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isAdminOrDevOps && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => router.push("/dashboard/settings")}
                    isActive={pathname.includes("/dashboard/settings")}
                    className={`transition-all duration-200 ${
                      pathname.includes("/dashboard/settings")
                        ? "bg-[#14b8a6]/10 text-[#14b8a6] font-medium shadow-sm"
                        : "hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-slate-500/10">
                      <Settings className="h-4 w-4 text-slate-600" />
                    </div>
                    <span className="font-medium">Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarSeparator className="my-4" />

        {/* Equipment Section */}
        <SidebarGroup>
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-slate-600 font-semibold text-xs uppercase tracking-wide hover:text-slate-900 transition-colors">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Equipment
                  {equipment.length > 0 && (
                    <Badge variant="secondary" className="text-xs bg-[#14b8a6]/10 text-[#14b8a6]">
                      {equipment.length}
                    </Badge>
                  )}
                </div>
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="mt-3">
                <SidebarMenu className="space-y-1">{equipmentList}</SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 border-t border-slate-100">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={async () => {
                    try {
                      await logout()
                      router.push("/login")
                    } catch (error) {
                      console.error("Logout error:", error)
                      toast({
                        title: "Logout Error",
                        description: "Failed to sign out. Please try again.",
                        variant: "destructive",
                      })
                    }
                  }}
                  className="hover:bg-red-50 hover:text-red-600 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 group-hover:bg-red-500/20 transition-colors">
                    <LogOut className="h-4 w-4 text-red-600" />
                  </div>
                  <span className="font-medium">Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Footer branding */}
        <div className="mt-4 pt-4 border-t border-slate-100">
          <div className="flex items-center justify-center gap-2 text-xs text-slate-400">
            <Shield className="h-3 w-3" />
            <span>Secured by Automata Controls</span>
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}
