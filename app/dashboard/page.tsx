// app/dashboard/page.tsx - Clean New Foundation with Fixed Navigation
"use client"

import { useAuth } from "@/lib/auth-context"
import { useRouter } from "next/navigation"
import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Building, Settings, ChevronLeft, ChevronRight, MapPin, Phone, Mail } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { useLocations } from "@/lib/hooks/use-locations"

const LOCATIONS_PER_PAGE = 9

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const { locations, loading: locationsLoading, error } = useLocations()
  const [currentPage, setCurrentPage] = useState(1)
  const [navigating, setNavigating] = useState(false)

  // Calculate pagination
  const totalLocations = locations.length
  const startIndex = (currentPage - 1) * LOCATIONS_PER_PAGE
  const endIndex = startIndex + LOCATIONS_PER_PAGE
  const currentLocations = locations.slice(startIndex, endIndex)
  const totalPages = Math.ceil(totalLocations / LOCATIONS_PER_PAGE)

  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])

  // Safe navigation with loading state
  const handleNavigation = (path: string) => {
    setNavigating(true)
    router.push(path)
  }

  if (loading) {
    return <DashboardSkeleton />
  }

  if (!user) {
    return null
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <Card>
          <CardHeader>
            <CardTitle className="text-red-600">Error Loading Locations</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button onClick={() => window.location.reload()}>Retry</Button>
          </CardFooter>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <Button
          variant="outline"
          onClick={() => handleNavigation("/dashboard/settings")}
          disabled={navigating}
          className="hover:bg-[#e6f3f1]"
        >
          <Settings className="mr-2 h-4 w-4" />
          {navigating ? "Loading..." : "Settings"}
        </Button>
      </div>

      {/* Navigation Pills */}
      <div className="flex overflow-auto pb-2 space-x-2">
        <Button
          variant="default"
          className="rounded-full bg-orange-400/80 hover:bg-orange-400 text-white"
          disabled={navigating}
        >
          Overview
        </Button>
        <Button
          variant="outline"
          className="rounded-full hover:bg-[#e6f3f1]"
          onClick={() => handleNavigation("/dashboard/controls-overview")}
          disabled={navigating}
        >
          {navigating ? "Loading..." : "Controls"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full hover:bg-[#e6f3f1]"
          onClick={() => handleNavigation("/dashboard/analytics")}
          disabled={navigating}
        >
          {navigating ? "Loading..." : "Analytics"}
        </Button>
        <Button
          variant="outline"
          className="rounded-full hover:bg-[#e6f3f1]"
          onClick={() => handleNavigation("/dashboard/alarms")}
          disabled={navigating}
        >
          {navigating ? "Loading..." : "Alarms"}
        </Button>
      </div>

      {/* Loading overlay during navigation */}
      {navigating && (
        <div className="fixed inset-0 bg-black/20 z-50 flex items-center justify-center">
          <div className="bg-white p-4 rounded-lg shadow-lg flex items-center space-x-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-400"></div>
            <span>Loading page...</span>
          </div>
        </div>
      )}

      {/* Content */}
      {locationsLoading ? (
        <DashboardSkeleton />
      ) : (
        <>
          <LocationsGrid
            locations={currentLocations}
            currentPage={currentPage}
            totalLocations={totalLocations}
          />

          {/* Simple Pagination */}
          {totalLocations > LOCATIONS_PER_PAGE && (
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="hover:bg-[#e6f3f1]"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages} • {totalLocations} locations
              </span>

              <Button
                variant="outline"
                onClick={() => setCurrentPage(prev => prev + 1)}
                disabled={currentPage >= totalPages}
                className="hover:bg-[#e6f3f1]"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

// Dashboard skeleton component
function DashboardSkeleton() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {[...Array(6)].map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-6 w-3/4 mb-2" />
            <Skeleton className="h-4 w-1/2" />
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

// Locations grid component
function LocationsGrid({
  locations,
  currentPage,
  totalLocations
}: {
  locations: any[]
  currentPage: number
  totalLocations: number
}) {
  const gridRouter = useRouter()
  const [navigating, setNavigating] = useState(false)

  const handleNavigation = (path: string) => {
    setNavigating(true)
    gridRouter.push(path)
  }

  if (locations.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>No Locations Configured</CardTitle>
          <CardDescription>
            Add your first location in the settings page to get started.
          </CardDescription>
        </CardHeader>
        <CardFooter>
          <Button
            onClick={() => handleNavigation("/dashboard/settings")}
            disabled={navigating}
            className="bg-orange-400/80 hover:bg-orange-400 text-white"
          >
            <Settings className="mr-2 h-4 w-4" />
            {navigating ? "Loading..." : "Go to Settings"}
          </Button>
        </CardFooter>
      </Card>
    )
  }

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {locations.map((location) => (
        <Card
          key={location.id}
          className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
          onClick={() => handleNavigation(`/dashboard/location/${location.numericId}`)}
        >
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building className="h-5 w-5 text-teal-500" />
              {location.name}
            </CardTitle>
            <CardDescription className="flex items-center gap-1">
              <MapPin className="h-4 w-4" />
              {location.address && `${location.address}, `}
              {location.city}, {location.state}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {location.contactName && (
              <p className="text-sm text-muted-foreground">
                Contact: {location.contactName}
              </p>
            )}
            {location.contactEmail && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Mail className="h-3 w-3" />
                {location.contactEmail}
              </p>
            )}
            {location.contactPhone && (
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Phone className="h-3 w-3" />
                {location.contactPhone}
              </p>
            )}
            <div className="pt-2 border-t">
              <span className="text-xs bg-teal-100 text-teal-800 px-2 py-1 rounded-full">
                {location.equipmentCount || 0} Equipment
              </span>
            </div>
          </CardContent>
        </Card>
      ))}

      {/* Add New Location Card */}
      <Card
        className={`border-dashed cursor-pointer hover:border-primary/50 hover:bg-[#e6f3f1] transition-all duration-200 ${
          navigating ? 'opacity-50 cursor-not-allowed' : ''
        }`}
        onClick={() => {
          if (!navigating) {
            handleNavigation("/dashboard/settings")
          }
        }}
      >
        <CardContent className="flex flex-col items-center justify-center p-6 h-full min-h-[200px]">
          <Building className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium text-center">
            {navigating ? "Loading..." : "Add New Location"}
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
