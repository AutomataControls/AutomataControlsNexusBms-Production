"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { ScrollArea } from "@/components/ui/scroll-area"
import { useRouter } from "next/navigation"
import { PlusCircle } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { collection, query, where, getDocs, doc, getDoc } from "firebase/firestore"

// Define types for equipment and location
interface Equipment {
    id: string
    name: string
    type: string
    locationId: string
    isAssigned?: boolean
}

interface Location {
    id: string
    name: string
}

export function AddEquipmentModal({
    open,
    onOpenChange,
    locationId,
    zoneName,
    onEquipmentAdded,
}: {
    open: boolean
    onOpenChange: (open: boolean) => void
    locationId: string
    zoneName: string
    onEquipmentAdded: (equipmentIds: string[]) => void
}) {
    const router = useRouter()
    const { db } = useFirebase()
    const [searchTerm, setSearchTerm] = useState("")
    const [selectedEquipment, setSelectedEquipment] = useState<string[]>([])
    const [equipment, setEquipment] = useState<Equipment[]>([])
    const [loading, setLoading] = useState(true)
    const [currentLocation, setCurrentLocation] = useState<Location | null>(null)

    // Fetch equipment for the current location
    useEffect(() => {
        if (open && locationId && db) {
            setLoading(true)
            
            // Reset selected equipment when modal opens
            setSelectedEquipment([])
            
            // Fetch location name
            const fetchLocationName = async () => {
                try {
                    const locationRef = doc(db, "locations", locationId)
                    const locationSnap = await getDoc(locationRef)
                    
                    if (locationSnap.exists()) {
                        const locationData = locationSnap.data()
                        setCurrentLocation({
                            id: locationId,
                            name: locationData.name || "This Location"
                        })
                    }
                } catch (error) {
                    console.error("Error fetching location:", error)
                }
            }
            
            // Fetch equipment
            fetchEquipmentForLocation(locationId)
                .then((data) => {
                    setEquipment(data)
                })
                .catch((error) => {
                    console.error("Error fetching equipment:", error)
                })
                .finally(() => {
                    setLoading(false)
                })
                
            fetchLocationName()
        }
    }, [open, locationId, db])

    // Function to fetch equipment from Firebase
    const fetchEquipmentForLocation = async (locationId: string) => {
        if (!db) return []

        try {
            // Query equipment that belongs to this location but isn't assigned to any zone
            const equipmentRef = collection(db, "equipment")
            
            // Query for equipment that belongs to this location and either:
            // 1. Has no zoneId field
            // 2. Has an empty zoneId
            // 3. Has a null zoneId
            const equipmentQuery = query(
                equipmentRef, 
                where("locationId", "==", locationId)
            )
            
            const equipmentSnapshot = await getDocs(equipmentQuery)
            
            // Filter out equipment that already has a zone assigned
            const unassignedEquipment = equipmentSnapshot.docs
                .map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    name: doc.data().name || "Unnamed Equipment",
                    type: doc.data().type || "Unknown Type",
                    locationId: locationId
                }))
                .filter(item => !item.zoneId || item.zoneId === "");
            
            return unassignedEquipment as Equipment[]
        } catch (error) {
            console.error("Error fetching equipment:", error)
            return []
        }
    }

    const filteredEquipment = equipment.filter((item) => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleCheckboxChange = (equipmentId: string) => {
        setSelectedEquipment((prev) =>
            prev.includes(equipmentId) ? prev.filter((id) => id !== equipmentId) : [...prev, equipmentId],
        )
    }

    const handleAddEquipment = () => {
        onEquipmentAdded(selectedEquipment)
        onOpenChange(false)
    }

    const navigateToAddNewEquipment = () => {
        onOpenChange(false)
        router.push("/dashboard/settings?tab=equipment")
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle>Add Equipment to {zoneName}</DialogTitle>
                    <DialogDescription>
                        Select equipment from {currentLocation?.name || "this location"} to add to this zone.
                    </DialogDescription>
                </DialogHeader>

                <Tabs defaultValue="existing" className="w-full">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="existing">Existing Equipment</TabsTrigger>
                        <TabsTrigger value="new">Add New Equipment</TabsTrigger>
                    </TabsList>

                    <TabsContent value="existing">
                        <div className="space-y-4 py-2">
                            <div className="space-y-2">
                                <Label htmlFor="search">Search Equipment</Label>
                                <Input
                                    id="search"
                                    placeholder="Search by name..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-4">Loading equipment...</div>
                            ) : filteredEquipment.length === 0 ? (
                                <div className="text-center py-4">
                                    <p className="text-muted-foreground">No unassigned equipment found for this location</p>
                                </div>
                            ) : (
                                <ScrollArea className="h-[300px] pr-4">
                                    <div className="space-y-2">
                                        {filteredEquipment.map((item) => (
                                            <div key={item.id} className="flex items-center space-x-2 p-2 rounded-md hover:bg-muted">
                                                <Checkbox
                                                    id={`equipment-${item.id}`}
                                                    checked={selectedEquipment.includes(item.id)}
                                                    onCheckedChange={() => handleCheckboxChange(item.id)}
                                                />
                                                <Label htmlFor={`equipment-${item.id}`} className="flex-1 cursor-pointer">
                                                    <div className="font-medium">{item.name}</div>
                                                    <div className="text-sm text-muted-foreground">{item.type}</div>
                                                </Label>
                                            </div>
                                        ))}
                                    </div>
                                </ScrollArea>
                            )}
                        </div>
                    </TabsContent>

                    <TabsContent value="new" className="py-4">
                        <div className="flex flex-col items-center justify-center space-y-4 py-8">
                            <PlusCircle className="h-12 w-12 text-muted-foreground" />
                            <div className="text-center space-y-2">
                                <h3 className="font-medium">Add New Equipment</h3>
                                <p className="text-sm text-muted-foreground">
                                    Create new equipment in the settings page and then add it to this zone.
                                </p>
                            </div>
                            <Button onClick={navigateToAddNewEquipment}>Go to Equipment Settings</Button>
                        </div>
                    </TabsContent>
                </Tabs>

                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Cancel
                    </Button>
                    <Button onClick={handleAddEquipment} disabled={selectedEquipment.length === 0}>
                        Add Selected ({selectedEquipment.length})
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )
}
