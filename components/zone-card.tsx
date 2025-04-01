"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useFirebase } from "@/lib/firebase-context"
import { Thermometer, Fan, ArrowRight } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { collection, query, where, getDocs } from "firebase/firestore"

interface ZoneCardProps {
    zone: {
        id: string
        name: string
        type?: string
        setpoint?: number
        currentTemperature?: number
        status?: string
    }
}

export function ZoneCard({ zone }: ZoneCardProps) {
    const [equipmentCount, setEquipmentCount] = useState<number>(0)
    const { db } = useFirebase()
    const router = useRouter()

    useEffect(() => {
        const fetchEquipmentCount = async () => {
            if (!db || !zone.id) return

            try {
                // Fetch equipment count for this zone
                const equipmentRef = collection(db, "equipment")
                const equipmentQuery = query(equipmentRef, where("zoneId", "==", zone.id))
                const equipmentSnapshot = await getDocs(equipmentQuery)

                setEquipmentCount(equipmentSnapshot.size)
            } catch (error) {
                console.error("Error fetching equipment count:", error)
            }
        }

        fetchEquipmentCount()
    }, [db, zone.id])

    return (
        <Card className="hover:bg-muted/50 cursor-pointer transition-colors">
            <CardHeader className="p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <CardTitle className="text-base">{zone.name}</CardTitle>
                        <CardDescription>{zone.type || "Zone"}</CardDescription>
                    </div>
                    {zone.status && (
                        <Badge
                            variant={
                                zone.status === "error" || zone.status === "Fault"
                                    ? "destructive"
                                    : zone.status === "warning" || zone.status === "Warning"
                                        ? "outline"
                                        : "default"
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
                        <span>{equipmentCount} devices</span>
                    </div>
                </div>
            </CardContent>
            <CardFooter className="p-4 pt-0">
                <Button
                    variant="ghost"
                    className="w-full justify-between"
                    onClick={() => router.push(`/dashboard/zones/${zone.id}`)}
                >
                    View Details
                    <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
            </CardFooter>
        </Card>
    )
}

