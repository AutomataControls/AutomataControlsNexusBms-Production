"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Settings } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { useToast } from "@/components/ui/use-toast"
import { collection, doc, getDoc } from "firebase/firestore"
import { AirHandlerControls } from "@/components/equipment-controls/air-handler-controls"
import { DOASControls } from "@/components/equipment-controls/doas-controls"
import { FanCoilControls } from "@/components/equipment-controls/fan-coil-controls"
import { ChillerControls } from "@/components/equipment-controls/chiller-controls"
import { PumpControls } from "@/components/equipment-controls/pump-controls"
import { BoilerControls } from "@/components/equipment-controls/boiler-controls"
import { ExhaustFanControls } from "@/components/equipment-controls/exhaust-fan-controls"
import { ActuatorControls } from "@/components/equipment-controls/actuator-controls"
import { CoolingTowerControls } from "@/components/equipment-controls/cooling-tower-controls"
import { GreenhouseControls } from "@/components/equipment-controls/greenhouse-controls"
import { SteamBundleControls } from "@/components/equipment-controls/steam-bundle-controls"

export default function EquipmentTypeControls({ type, id }: { type: string; id: string }) {
  const [equipment, setEquipment] = useState<any>(null)
  const [location, setLocation] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { db } = useFirebase()
  const router = useRouter()
  const { toast } = useToast()

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !id) return

      setLoading(true)
      setError(null)

      try {
        const equipmentRef = collection(db, "equipment")
        const equipmentDoc = doc(equipmentRef, id)
        const equipmentSnapshot = await getDoc(equipmentDoc)

        if (equipmentSnapshot.exists()) {
          const equipmentData = { id: equipmentSnapshot.id, ...equipmentSnapshot.data() }
          setEquipment(equipmentData)

          if (equipmentData.locationId) {
            const locationRef = collection(db, "locations")
            const locationDoc = doc(locationRef, equipmentData.locationId)
            const locationSnapshot = await getDoc(locationDoc)
            if (locationSnapshot.exists()) {
              setLocation({ id: locationSnapshot.id, ...locationSnapshot.data() })
            }
          }
        } else {
          setError("Equipment not found")
          toast({
            title: "Error",
            description: "Equipment not found. It may have been deleted.",
            variant: "destructive",
          })
        }
      } catch (error) {
        console.error("Error fetching equipment data:", error)
        setError("Failed to load equipment data")
        toast({
          title: "Error",
          description: "Failed to load equipment data",
          variant: "destructive",
        })
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [db, id, toast])

  const renderControlComponent = () => {
    if (!equipment) return null

    // Normalize the equipment type to match our component naming
    const normalizedType = type.toLowerCase().replace(/-/g, "")

    switch (normalizedType) {
      case "airhandler":
        return <AirHandlerControls equipment={equipment} />
      case "doas":
        return <DOASControls equipment={equipment} />
      case "fancoil":
        return <FanCoilControls equipment={equipment} />
      case "chiller":
        return <ChillerControls equipment={equipment} />
      case "pump":
        return <PumpControls equipment={equipment} />
      case "boiler":
        return <BoilerControls equipment={equipment} />
      case "exhaustfan":
        return <ExhaustFanControls equipment={equipment} />
      case "actuator":
        return <ActuatorControls equipment={equipment} />
      case "coolingtower":
        return <CoolingTowerControls equipment={equipment} />
      case "greenhouse":
        return <GreenhouseControls equipment={equipment} />
      case "steambundle":
        return <SteamBundleControls equipment={equipment} />
      default:
        return (
          <Card>
            <CardHeader>
              <CardTitle>Unsupported Equipment Type</CardTitle>
              <CardDescription>Controls for {type} are not currently supported.</CardDescription>
            </CardHeader>
          </Card>
        )
    }
  }

  if (loading) {
    return <div>Loading equipment controls...</div>
  }

  if (error || !equipment) {
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
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">{equipment.name} Controls</h1>
        </div>
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
      </Card>

      {renderControlComponent()}
    </div>
  )
}

