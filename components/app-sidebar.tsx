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
import { Building, Fan, Thermometer, Droplet, Gauge, BarChart3, Bell, Home, Settings, ChevronDown, LogOut } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirebase } from "@/lib/firebase-context"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { useAuth } from "@/lib/auth-context"
import { Skeleton } from "@/components/ui/skeleton"
import { collection, getDocs, query, where } from "firebase/firestore"

export function AppSidebar() {
    const [locations, setLocations] = useState<any[]>([])
    const [selectedLocation, setSelectedLocation] = useState<string>("")
    const [equipment, setEquipment] = useState<any[]>([])
    const [equipmentTypes, setEquipmentTypes] = useState<string[]>([])
    const [loading, setLoading] = useState(true)
    const [sidebarInitialized, setSidebarInitialized] = useState(false)
    const { db, fetchCachedData } = useFirebase()
    const { user, logout } = useAuth()
    const router = useRouter()
    const pathname = usePathname()

    // Fetch locations with caching
    const fetchLocations = useCallback(async () => {
        if (!db) return

        try {
            setLoading(true)

            const cacheKey = "sidebar_locations"
            const locationData = await fetchCachedData(
                cacheKey,
                async () => {
                    if (!db) return []

                    const locationsCollection = collection(db, "locations")
                    const snapshot = await getDocs(locationsCollection)
                    const data = snapshot.docs.map((doc) => ({
                        id: doc.id,
                        ...doc.data(),
                    }))
                    console.log("Fetched locations for sidebar:", data) // Debug log
                    return data
                },
                10, // Cache for 10 minutes
            )

            console.log("Setting locations in sidebar:", locationData) // Debug log
            setLocations(locationData)

            if (locationData.length > 0 && !selectedLocation) {
                setSelectedLocation(locationData[0].id)
            }
        } catch (error) {
            console.error("Error fetching locations:", error)
        } finally {
            setLoading(false)
        }
    }, [db, selectedLocation, fetchCachedData])

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
                    }))
                },
                5, // Cache for 5 minutes
            )

            setEquipment(equipmentData)

            // Extract unique equipment types
            const types = Array.from(new Set(equipmentData.map((item) => item.type)))
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

    const handleLocationChange = (value: string) => {
        setSelectedLocation(value)
        router.push(`/dashboard/location/${value}`)
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
                                            <SidebarMenuSubButton asChild isActive={isActive} className={isActive ? activeClass : hoverClass}>
                                                <a href={`/dashboard/controls?locationId=${selectedLocation}&equipmentId=${item.id}`}>
                                                    {item.name}
                                                </a>
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
                <Select value={selectedLocation} onValueChange={handleLocationChange} disabled={loading}>
                    <SelectTrigger className="w-full bg-white">
                        <SelectValue placeholder="Select location" />
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
                                    asChild
                                    isActive={pathname === "/dashboard"}
                                    className={pathname === "/dashboard" ? activeClass : hoverClass}
                                >
                                    <a href="/dashboard">
                                        <Home className="h-4 w-4" />
                                        <span>Overview</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === "/dashboard/controls"}
                                    className={pathname === "/dashboard/controls" ? activeClass : hoverClass}
                                >
                                    <a href="/dashboard/controls">
                                        <Gauge className="h-4 w-4" />
                                        <span>Controls</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === "/dashboard/analytics"}
                                    className={pathname === "/dashboard/analytics" ? activeClass : hoverClass}
                                >
                                    <a href="/dashboard/analytics">
                                        <BarChart3 className="h-4 w-4" />
                                        <span>Analytics</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === "/dashboard/alarms"}
                                    className={pathname === "/dashboard/alarms" ? activeClass : hoverClass}
                                >
                                    <a href="/dashboard/alarms">
                                        <Bell className="h-4 w-4" />
                                        <span>Alarms</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>

                            <SidebarMenuItem>
                                <SidebarMenuButton
                                    asChild
                                    isActive={pathname === "/dashboard/settings"}
                                    className={pathname === "/dashboard/settings" ? activeClass : hoverClass}
                                >
                                    <a href="/dashboard/settings">
                                        <Settings className="h-4 w-4" />
                                        <span>Settings</span>
                                    </a>
                                </SidebarMenuButton>
                            </SidebarMenuItem>
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
                                    onClick={logout}
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