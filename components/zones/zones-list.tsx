"use client"

import { useState, useEffect } from "react"
import { ZoneCard } from "./zone-card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import { collection, getDocs } from "firebase/firestore"
import { PlusCircle } from "lucide-react"
import { useRouter } from "next/navigation"

export function ZonesList() {
  const { db } = useFirebase()
  const [zones, setZones] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    const fetchZones = async () => {
      if (!db) return

      setLoading(true)
      try {
        const zonesRef = collection(db, "zones")
        const zonesSnapshot = await getDocs(zonesRef)

        const zonesData = zonesSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))

        setZones(zonesData)
      } catch (error) {
        console.error("Error fetching zones:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchZones()
  }, [db])

  if (loading) {
    return <div>Loading zones...</div>
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Zones</h2>
        <Button onClick={() => router.push("/dashboard/settings/zones/new")}>
          <PlusCircle className="mr-2 h-4 w-4" />
          Add Zone
        </Button>
      </div>

      {zones.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-muted-foreground">No zones found</p>
          <Button variant="outline" className="mt-4" onClick={() => router.push("/dashboard/settings/zones/new")}>
            Create your first zone
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {zones.map((zone) => (
            <ZoneCard key={zone.id} zone={zone} />
          ))}
        </div>
      )}
    </div>
  )
}

