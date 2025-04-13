"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { useFirebase } from "@/lib/firebase-context"
import { LocationCard } from "@/components/location-card"
import { Building, Settings, ChevronLeft, ChevronRight } from "lucide-react"
import { Skeleton } from "@/components/ui/skeleton"
import { collection, query, orderBy, limit, startAfter, getDocs } from "firebase/firestore"

// Number of locations to load per page
const LOCATIONS_PER_PAGE = 9

export default function DashboardContent() {
  const [locations, setLocations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastDoc, setLastDoc] = useState<any>(null)
  const [hasMore, setHasMore] = useState(true)
  const [page, setPage] = useState(1)
  const [pageData, setPageData] = useState<{ [key: number]: { data: any[]; lastDoc: any } }>({})
  const { db } = useFirebase()
  const router = useRouter()

  // Fetch locations for a specific page
  const fetchLocations = useCallback(
    async (pageNum: number) => {
      if (!db) return

      try {
        setLoading(true)
        console.log(`Fetching locations for page ${pageNum}`)

        // If we already have this page cached in state, use it
        if (pageData[pageNum]) {
          console.log(`Using cached data for page ${pageNum}`, pageData[pageNum].data)
          setLocations(pageData[pageNum].data)
          setLastDoc(pageData[pageNum].lastDoc)
          setHasMore(pageData[pageNum].data.length === LOCATIONS_PER_PAGE)
          setLoading(false)
          return
        }

        // For first page, start fresh
        if (pageNum === 1) {
          const locationsCollection = collection(db, "locations")
          const q = query(locationsCollection, orderBy("name"), limit(LOCATIONS_PER_PAGE))
          const snapshot = await getDocs(q)

          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))

          console.log(`Fetched ${data.length} locations for page 1`)

          setLocations(data)
          setLastDoc(snapshot.docs[snapshot.docs.length - 1])
          setHasMore(data.length === LOCATIONS_PER_PAGE)

          // Cache this page data
          setPageData((prev) => ({
            ...prev,
            1: { data, lastDoc: snapshot.docs[snapshot.docs.length - 1] },
          }))
        }
        // For subsequent pages, we need the last doc from the previous page
        else {
          // Make sure we have the previous page's last doc
          if (!pageData[pageNum - 1]?.lastDoc) {
            console.error(`Missing last document reference for page ${pageNum - 1}`)
            setLoading(false)
            return
          }

          const prevPageLastDoc = pageData[pageNum - 1].lastDoc
          const locationsCollection = collection(db, "locations")
          const q = query(locationsCollection, orderBy("name"), startAfter(prevPageLastDoc), limit(LOCATIONS_PER_PAGE))
          const snapshot = await getDocs(q)

          const data = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))

          console.log(`Fetched ${data.length} locations for page ${pageNum}`)

          setLocations(data)
          setLastDoc(snapshot.docs[snapshot.docs.length - 1])
          setHasMore(data.length === LOCATIONS_PER_PAGE)

          // Cache this page data
          setPageData((prev) => ({
            ...prev,
            [pageNum]: { data, lastDoc: snapshot.docs[snapshot.docs.length - 1] },
          }))
        }
      } catch (error) {
        console.error(`Error fetching locations for page ${pageNum}:`, error)
      } finally {
        setLoading(false)
      }
    },
    [db, pageData],
  )

  // Initial data load
  useEffect(() => {
    fetchLocations(1)
  }, [fetchLocations])

  // When page changes, fetch that page's data
  useEffect(() => {
    fetchLocations(page)
  }, [page, fetchLocations])

  // Load next page
  const handleNextPage = () => {
    if (hasMore && !loading) {
      setPage((prev) => prev + 1)
    }
  }

  // Go back to previous page
  const handlePrevPage = () => {
    if (page > 1 && !loading) {
      setPage((prev) => prev - 1)
    }
  }

  // Memoize the locations grid to prevent unnecessary re-renders
  const locationsGrid = useMemo(() => {
    if (locations.length === 0 && !loading) {
      return (
        <Card>
          <CardHeader>
            <CardTitle>No Locations Configured</CardTitle>
            <CardDescription>Add your first location in the settings page to get started.</CardDescription>
          </CardHeader>
          <CardFooter>
            <Button
              onClick={() => router.push("/dashboard/settings")}
              className="bg-orange-400/80 hover:bg-orange-400 text-white"
            >
              <Settings className="mr-2 h-4 w-4" />
              Go to Settings
            </Button>
          </CardFooter>
        </Card>
      )
    }

    return (
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {locations.map((location) => (
          <LocationCard key={location.id} location={location} />
        ))}
        <Card
          className="border-dashed cursor-pointer hover:border-primary/50 hover:bg-[#e6f3f1]"
          onClick={() => router.push("/dashboard/settings")}
        >
          <CardContent className="flex flex-col items-center justify-center p-6 h-full min-h-[200px]">
            <Building className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-lg font-medium text-center">Add New Location</p>
          </CardContent>
        </Card>
      </div>
    )
  }, [locations, loading, router])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard Overview</h1>
        <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <div className="flex overflow-auto pb-2 space-x-2">
        <Button variant="default" className="rounded-full bg-orange-400/80 hover:bg-orange-400 text-white">
          Overview
        </Button>
        <Button
          variant="outline"
          className="rounded-full hover:bg-[#e6f3f1]"
          onClick={() => router.push("/dashboard/controls")}
        >
          Controls
        </Button>
        <Button
          variant="outline"
          className="rounded-full hover:bg-[#e6f3f1]"
          onClick={() => router.push("/dashboard/analytics")}
        >
          Analytics
        </Button>
        <Button
          variant="outline"
          className="rounded-full hover:bg-[#e6f3f1]"
          onClick={() => router.push("/dashboard/alarms")}
        >
          Alarms
        </Button>
      </div>

      {loading && locations.length === 0 ? (
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
      ) : (
        <>
          {locationsGrid}

          {/* Pagination controls */}
          {locations.length > 0 && (
            <div className="flex justify-between items-center mt-6">
              <Button
                variant="outline"
                onClick={handlePrevPage}
                disabled={page === 1 || loading}
                className="hover:bg-[#e6f3f1]"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Previous
              </Button>

              <span className="text-sm text-muted-foreground">Page {page}</span>

              <Button
                variant="outline"
                onClick={handleNextPage}
                disabled={!hasMore || loading}
                className="hover:bg-[#e6f3f1]"
              >
                Next
                <ChevronRight className="h-4 w-4 ml-2" />
              </Button>
            </div>
          )}

          {/* Loading indicator for pagination */}
          {loading && locations.length > 0 && (
            <div className="flex justify-center mt-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
