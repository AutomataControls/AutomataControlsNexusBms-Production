"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { useRouter, usePathname } from "next/navigation"
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
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
} from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirebase } from "@/lib/firebase-context"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { collection, getDocs, query, where } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"

interface Location {
  id: string;
  name: string;
  [key: string]: any;
}

interface Equipment {
  id: string;
  name: string;
  type: string;
  locationId: string;
  [key: string]: any;
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
    return user?.roles && (user.roles.includes("admin") || user.roles.includes("DevOps"));
  }, [user]);

  // Helper function to get the correct navigation URL based on user role
  const getNavUrl = useCallback((basePath: string) => {
    // Admin/DevOps users can access the global pages
    if (isAdminOrDevOps) {
      return basePath;
    }
    
    // Regular users should always go to their location-specific pages
    if (selectedLocation) {
      // For overview page
      if (basePath === "/dashboard") {
        return `/dashboard/location/${selectedLocation}`;
      }
      
      // For other pages, add the locationId parameter
      return `${basePath}?locationId=${selectedLocation}`;
    }
    
    // Fallback to base path if no location is selected
    return basePath;
  }, [isAdminOrDevOps, selectedLocation]);

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
          if (user.roles && (user.roles.includes("admin") || user.roles.includes("DevOps"))) {
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
                const locationData = doc.data();
                return user.assignedLocations?.includes(locationData.id);
              })
              .map((doc) => ({
                id: doc.id,
                ...doc.data(),
              })) as Location[];
            
            console.log("Found assigned location documents:", assignedLocationDocs);
            return assignedLocationDocs;
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
          console.log("Setting default location for regular user:", user.assignedLocations[0]);
          setSelectedLocation(user.assignedLocations[0]);
          localStorage.setItem("selectedLocation", user.assignedLocations[0]);
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
      const types = Array.from(new Set(equipmentData.map((item: Equipment) => item.type))) as string[];
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

  const activeClass = "bg-[#e6f3f1] text-gray-900 font-medium"
  const hoverClass = "transition-colors duration-200 hover:bg-[#e6f3f1] hover:text-gray-900"

  // Memoize the equipment list to prevent unnecessary re-renders
  const equipmentList = useMemo(() => {
    if (loading) {
      return (
        <div className="space-y-2 px-2 py-1">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-8 w-full" />
        </div>
      )
    }

    if (!selectedLocation || equipmentTypes.length === 0) {
      return <div className="px-2 py-4 text-sm text-gray-500">No equipment available</div>
    }

    return equipmentTypes.map((type) => {
      const Icon = getEquipmentIcon(type)
      const equipmentOfType = equipment.filter((e) => e.type === type)

      return (
        <SidebarMenuItem key={type}>
          <Collapsible className="w-full">
            <CollapsibleTrigger asChild>
              <SidebarMenuButton className={hoverClass}>
                <Icon className="h-4 w-4" />
                <span>{type}s</span>
                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </SidebarMenuButton>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <SidebarMenuSub>
                {equipmentOfType.map((item) => {
                  const isActive = pathname.includes(`/dashboard/controls`) && pathname.includes(item.id)
                  return (
                    <SidebarMenuSubItem key={item.id}>
                      <SidebarMenuSubButton 
                        onClick={() => router.push(`/dashboard/controls?locationId=${selectedLocation}&equipmentId=${item.id}`)}
                        isActive={isActive} 
                        className={isActive ? activeClass : hoverClass}
                      >
                        {item.name}
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
  }, [loading, selectedLocation, equipmentTypes, equipment, pathname, getEquipmentIcon, activeClass, hoverClass])

  // Show a skeleton sidebar while initializing
  if (!sidebarInitialized) {
    return (
      <Sidebar className="bg-[#f8fcfa] h-full">
        <SidebarHeader className="p-4 bg-[#f8fcfa] border-b border-gray-200">
          {user && (
            <div className="mb-3 pb-2 border-b border-gray-100">
              <p className="text-sm text-teal-600">Welcome,</p>
              <p className="font-medium text-orange-500">{user.name || user.username}</p>
            </div>
          )}
          <Skeleton className="h-9 w-full rounded-md" />
        </SidebarHeader>
        <SidebarContent className="bg-[#f8fcfa]">
          <div className="p-4 space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
          </div>
        </SidebarContent>
      </Sidebar>
    )
  }

  return (
    <Sidebar className="bg-[#f8fcfa] h-full">
      <SidebarHeader className="p-4 bg-[#f8fcfa] border-b border-gray-200">
        {user && (
          <div className="mb-3 pb-2 border-b border-gray-100">
            <p className="text-sm text-teal-600">Welcome,</p>
            <p className="font-medium text-orange-500">{user.name || user.username}</p>
          </div>
        )}
        {selectedLocation && locations.find((loc) => loc.id === selectedLocation) && (
          <div className="mb-3 text-xs">
            <p className="text-gray-500">Client:</p>
            <p className="font-medium text-teal-700">{locations.find((loc) => loc.id === selectedLocation)?.name}</p>
          </div>
        )}
        <Select 
          value={selectedLocation} 
          onValueChange={handleLocationChange} 
          disabled={loading || (!isAdminOrDevOps && locations.length <= 1)}
        >
          <SelectTrigger className="w-full bg-white">
            <SelectValue placeholder={isAdminOrDevOps ? "Select location" : "Assigned location"} />
          </SelectTrigger>
          <SelectContent>
            {locations.map((location) => (
              <SelectItem key={location.id} value={location.id}>
                {location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SidebarHeader>

      <SidebarContent className="bg-[#f8fcfa]">
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-600">Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    if (isAdminOrDevOps) {
                      router.push("/dashboard");
                    } else if (selectedLocation) {
                      router.push(`/dashboard/location/${selectedLocation}`);
                    } else {
                      router.push("/dashboard");
                    }
                  }}
                  isActive={isAdminOrDevOps ? pathname === "/dashboard" : pathname.includes(`/dashboard/location/${selectedLocation}`)}
                  className={isAdminOrDevOps ? 
                    (pathname === "/dashboard" ? activeClass : hoverClass) : 
                    (pathname.includes(`/dashboard/location/${selectedLocation}`) ? activeClass : hoverClass)}
                >
                  <Home className="h-4 w-4" />
                  <span>Overview</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    if (selectedLocation) {
                      router.push(`/dashboard/controls?locationId=${selectedLocation}`);
                    } else {
                      router.push("/dashboard/controls");
                    }
                  }}
                  isActive={pathname.includes("/dashboard/controls")}
                  className={pathname.includes("/dashboard/controls") ? activeClass : hoverClass}
                >
                  <Gauge className="h-4 w-4" />
                  <span>Controls</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    if (selectedLocation) {
                      router.push(`/dashboard/analytics?locationId=${selectedLocation}`);
                    } else {
                      router.push("/dashboard/analytics");
                    }
                  }}
                  isActive={pathname.includes("/dashboard/analytics")}
                  className={pathname.includes("/dashboard/analytics") ? activeClass : hoverClass}
                >
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={() => {
                    if (selectedLocation) {
                      router.push(`/dashboard/alarms?locationId=${selectedLocation}`);
                    } else {
                      router.push("/dashboard/alarms");
                    }
                  }}
                  isActive={pathname.includes("/dashboard/alarms")}
                  className={pathname.includes("/dashboard/alarms") ? activeClass : hoverClass}
                >
                  <Bell className="h-4 w-4" />
                  <span>Alarms</span>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {isAdminOrDevOps && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    onClick={() => router.push("/dashboard/settings")}
                    isActive={pathname.includes("/dashboard/settings")}
                    className={pathname.includes("/dashboard/settings") ? activeClass : hoverClass}
                  >
                    <Settings className="h-4 w-4" />
                    <span>Settings</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <Collapsible defaultOpen className="group/collapsible">
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="flex w-full items-center justify-between text-gray-600">
                Equipment
                <ChevronDown className="h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent>
                <SidebarMenu>{equipmentList}</SidebarMenu>
              </SidebarGroupContent>
            </CollapsibleContent>
          </Collapsible>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton 
                  onClick={async () => {
                    try {
                      await logout();
                      router.push('/login');  // Add redirect to login page
                    } catch (error) {
                      console.error("Logout error:", error);
                      toast({
                        title: "Logout Error",
                        description: "Failed to sign out. Please try again.",
                        variant: "destructive",
                      });
                    }
                  }} 
                  className="hover:bg-red-50 hover:text-red-600"
                >
                  <LogOut className="h-4 w-4" />
                  <span>Sign Out</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  )
}
