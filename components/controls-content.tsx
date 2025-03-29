"use client"

import { useState, useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import { Settings } from "lucide-react"

export default function ControlsContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { db } = useFirebase()

  const locationId = searchParams.get("locationId")
  const equipmentId = searchParams.get("equipmentId")

  const [location, setLocation] = useState<any>(null)
  const [equipment, setEquipment] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      if (!db) return

      setLoading(true)

      try {
        // If we have specific equipment selected
        if (locationId && equipmentId) {
          const locationDoc = await db.collection("locations").doc(locationId).get()
          const equipmentDoc = await db.collection("equipment").doc(equipmentId).get()

          if (locationDoc.exists && equipmentDoc.exists) {
            setLocation({ id: locationDoc.id, ...locationDoc.data() })
            setEquipment({ id: equipmentDoc.id, ...equipmentDoc.data() })
          }
        }
      } catch (error) {
        console.error("Error fetching data:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [db, locationId, equipmentId])

  if (!locationId || !equipmentId) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Controls</h1>
          <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>No Equipment Selected</CardTitle>
            <CardDescription>Please select a location and equipment from the sidebar to view controls.</CardDescription>
          </CardHeader>
        </Card>
      </div>
    )
  }

  if (loading) {
    return <div>Loading equipment controls...</div>
  }

  if (!equipment) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Equipment Not Found</CardTitle>
          <CardDescription>The selected equipment could not be found. It may have been deleted.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">{equipment.name} Controls</h1>
        <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{equipment.name}</CardTitle>
          <CardDescription>
            Type: {equipment.type} | Location: {location?.name || "Unknown"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p>Control interface for this equipment will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  )
}

