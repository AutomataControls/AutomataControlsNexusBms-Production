"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import { Plus, Thermometer, Fan } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { collection, query, where, getDocs } from "firebase/firestore"
import { toast } from "@/components/ui/use-toast"

interface ZoneListProps {
    locationId: string
}

export function ZoneList({ locationId }: ZoneListProps) {
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

    return (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between">
                <div>
                    <CardTitle>Zones</CardTitle>
                    <CardDescription>Manage zones for this location</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={() => router.push("/dashboard/settings")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Zone
                </Button>
            </CardHeader>
            <CardContent>
                {zones.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-6 text-center">
                        <Thermometer className="h-10 w-10 text-muted-foreground mb-2" />
                        <p className="text-lg font-medium">No Zones</p>
                        <p className="text-sm text-muted-foreground">Create zones to organize your equipment</p>
                        <Button className="mt-4" onClick={() => router.push("/dashboard/settings")}>
                            Create Zone
                        </Button>
                    </div>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                        {zones.map((zone) => (
                            <Card
                                key={zone.id}
                                className="hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={() => router.push(`/dashboard/zones/${zone.id}`)}
                            >
                                <CardHeader className="p-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <CardTitle className="text-base">{zone.name}</CardTitle>
                                            <CardDescription>{zone.type || "Zone"}</CardDescription>
                                        </div>
                                        {zone.status && (
                                            <Badge
                                                variant={
                                                    zone.status === "error" ? "destructive" : zone.status === "warning" ? "outline" : "default"
                                                }
                                            >
                                                {zone.status}
                                            </Badge>
                                        )}
                                    </div>
                                </CardHeader>
                                <CardContent className="p-4 pt-0">
                                    <div className="flex items-center justify-between text-sm">
                                        <div className="flex items-center">
                                            <Thermometer className="h-4 w-4 mr-1 text-muted-foreground" />
                                            <span>{zone.currentTemperature || zone.setpoint || "--"}°F</span>
                                        </div>
                                        <div className="flex items-center">
                                            <Fan className="h-4 w-4 mr-1 text-muted-foreground" />
                                            <span>{zone.equipmentCount || "--"} devices</span>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    )
}

