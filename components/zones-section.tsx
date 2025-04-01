"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import { Plus } from "lucide-react"
import { collection, query, where, getDocs } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"
import { ZoneCard } from "./zone-card"

interface ZonesSectionProps {
    locationId: string
}

export function ZonesSection({ locationId }: ZonesSectionProps) {
    const [zones, setZones] = useState<any[]>([])
    const [loading, setLoading] = useState(true)
    const { db } = useFirebase()
    const router = useRouter()

    useEffect(() => {
        const fetchZones = async () => {
            if (!db || !locationId) return

            setLoading(true)
            try {
                // Fetch zones for this location
                const zonesRef = collection(db, "zones")
                const zonesQuery = query(zonesRef, where("locationId", "==", locationId))
                const zonesSnapshot = await getDocs(zonesQuery)

                const zonesData = zonesSnapshot.docs.map((doc) => ({
                    id: doc.id,
                    ...doc.data(),
                }))
                setZones(zonesData)
            } catch (error) {
                console.error("Error fetching zones:", error)
                toast({
                    title: "Error",
                    description: "Failed to load zones",
                    variant: "destructive",
                })
            } finally {
                setLoading(false)
            }
        }

        fetchZones()
    }, [db, locationId])

    if (loading) {
        return <div>Loading zones...</div>
    }

    // If no zones, don't render anything
    if (zones.length === 0) {
        return null
    }

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Zones</CardTitle>
                    <CardDescription>Temperature controlled areas at this location</CardDescription>
                </div>
                <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/dashboard/settings/zones/new?locationId=${locationId}`)}
                >
                    <Plus className="mr-2 h-4 w-4" />
                    Add Zone
                </Button>
            </CardHeader>
            <CardContent>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {zones.map((zone) => (
                        <ZoneCard key={zone.id} zone={zone} />
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}

