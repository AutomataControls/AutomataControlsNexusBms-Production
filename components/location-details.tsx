"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import { Building, Settings, ArrowLeft, Fan, AlertTriangle, MapPin, Phone, Mail, Edit } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { doc, getDoc, collection, query, where, getDocs } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"

interface LocationDetailsProps {
  id: string
}

export function LocationDetails({ id }: LocationDetailsProps) {
  const [location, setLocation] = useState<any>(null)
  const [equipment, setEquipment] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const { db } = useFirebase()
  const router = useRouter()

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !id) return

      setLoading(true)
      try {
        // Fetch location data
        const locationRef = collection(db, "locations")
        const locationDoc = doc(locationRef, id)
        const locationSnapshot = await getDoc(locationDoc)

        if (locationSnapshot.exists()) {
          const locationData = { id: locationSnapshot.id, ...locationSnapshot.data() }
          setLocation(locationData)

          // Fetch equipment for this location
          const equipmentRef = collection(db, "equipment")
          const equipmentQuery = query(equipmentRef, where("locationId", "==", id))
          const equipmentSnapshot = await getDocs(equipmentQuery)
          
          const equipmentData = equipmentSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }))
          setEquipment(equipmentData)
        } else {
          console.error("Location not found:", id)
          toast({
            title: "Error",
            description: "Location not found",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error fetching location data:", error)
        toast({
          title: "Error",
          description: "Failed to load location data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [db, id, toast])

  if (loading) {
    return <div>Loading location details...</div>
  }

  if (!location) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Location Not Found</CardTitle>
          <CardDescription>The requested location could not be found.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">{location.name}</h1>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={() => router.push(`/dashboard/settings`)} className="hover:bg-[#e6f3f1]">
            <Edit className="mr-2 h-4 w-4" />
            Edit Location
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Location Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Location Overview</CardTitle>
          <CardDescription>Details and statistics for {location.name}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-start space-x-2">
              <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
              <div>
                <p className="font-medium">Address</p>
                <p className="text-sm text-muted-foreground">{location.address}</p>
                <p className="text-sm text-muted-foreground">
                  {[location.city, location.state, location.zipCode, location.country].filter(Boolean).join(", ")}
                </p>
              </div>
            </div>
            {location.contactName && (
              <div className="flex items-start space-x-2">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium">Contact</p>
                  <p className="text-sm text-muted-foreground">{location.contactName}</p>
                  <p className="text-sm text-muted-foreground">{location.contactPhone}</p>
                </div>
              </div>
            )}
            {location.contactEmail && (
              <div className="flex items-start space-x-2">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{location.contactEmail}</p>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <Fan className="h-4 w-4 text-blue-500" />
                  <span className="text-2xl font-bold">{equipment.length}</span>
                </div>
                <p className="text-sm text-muted-foreground">Total Equipment</p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <AlertTriangle className="h-4 w-4 text-yellow-500" />
                  <span className="text-2xl font-bold">
                    {equipment.filter(e => e.status === "warning").length}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Warnings</p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <span className="text-2xl font-bold">
                    {equipment.filter(e => e.status === "error").length}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Errors</p>
              </CardHeader>
            </Card>
            <Card>
              <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                  <Building className="h-4 w-4 text-green-500" />
                  <span className="text-2xl font-bold">
                    {equipment.filter(e => e.status === "online").length}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">Online</p>
              </CardHeader>
            </Card>
          </div>
        </CardContent>
      </Card>

      {/* Equipment List */}
      <Card>
        <CardHeader>
          <CardTitle>Equipment</CardTitle>
          <CardDescription>Equipment installed at this location</CardDescription>
        </CardHeader>
        <CardContent>
          {equipment.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Fan className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-lg font-medium">No Equipment</p>
              <p className="text-sm text-muted-foreground">Add equipment to this location to get started</p>
              <Button 
                className="mt-4"
                onClick={() => router.push("/dashboard/settings")}
              >
                Add Equipment
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {equipment.map((item) => (
                <Card 
                  key={item.id} 
                  className="hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => {
                    // Normalize the type to match the URL format
                    const normalizedType = item.type.toLowerCase().replace(/\s+/g, '-')
                    router.push(`/dashboard/controls/${normalizedType}/${item.id}`)
                  }}
                >
                  <CardHeader className="p-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="text-base">{item.name}</CardTitle>
                        <CardDescription>{item.type}</CardDescription>
                      </div>
                      <Badge 
                        variant={
                          item.status === "Fault" ? "destructive" : 
                          item.status === "Offline" ? "warning" : 
                          "default"
                        }
                      >
                        {item.status || "Unknown"}
                      </Badge>
                    </div>
                  </CardHeader>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
} 