"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Plus, Trash, Settings } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { validateEquipment, type Equipment } from "@/lib/validation"
import { collection, getDocs, addDoc, doc, updateDoc, deleteDoc } from "firebase/firestore"

const EQUIPMENT_TYPES = [
  "Actuator",
  "Air Handler",
  "Boiler",
  "Chiller",
  "Cooling Tower",
  "DOAS",
  "Exhaust Fan",
  "Fan Coil",
  "Greenhouse",
  "Heat Exchanger",
  "Pump",
  "Steam Bundle",
  "Supply Fan",
  "VAV Box",
  "Water Heater",
]

// Update threshold type definitions with more specific metrics
const THRESHOLD_TYPES = {
  "Supply Air": { 
    temperature: { label: "Temperature (°F)", min: 55, max: 75 },
    humidity: { label: "Humidity (%)", min: 30, max: 60 },
    pressure: { label: "Static Pressure (inW.C.)", min: -1, max: 1 },
    flow: { label: "Airflow (CFM)", min: 0, max: 10000 },
    co2: { label: "CO2 Level (PPM)", min: 400, max: 1000 }
  },
  "Return Air": {
    temperature: { label: "Temperature (°F)", min: 68, max: 78 },
    humidity: { label: "Humidity (%)", min: 30, max: 60 },
    co2: { label: "CO2 Level (PPM)", min: 400, max: 1000 }
  },
  "Outside Air": {
    temperature: { label: "Temperature (°F)", min: -20, max: 120 },
    humidity: { label: "Humidity (%)", min: 0, max: 100 },
    damperPosition: { label: "Damper Position (%)", min: 0, max: 100 },
    co2: { label: "CO2 Level (PPM)", min: 380, max: 500 }
  },
  "Exhaust Air": {
    temperature: { label: "Temperature (°F)", min: 55, max: 85 },
    humidity: { label: "Humidity (%)", min: 20, max: 80 },
    flow: { label: "Airflow (CFM)", min: 0, max: 10000 },
    damperPosition: { label: "Damper Position (%)", min: 0, max: 100 }
  },
  "Energy Recovery": {
    efficiency: { label: "Recovery Efficiency (%)", min: 0, max: 100 },
    temperature: { label: "Temperature (°F)", min: 40, max: 95 },
    bypass: { label: "Bypass Position (%)", min: 0, max: 100 }
  },
  "Mixed Air": {
    temperature: { label: "Temperature (°F)", min: 45, max: 65 },
    humidity: { label: "Humidity (%)", min: 30, max: 60 },
    damperPosition: { label: "Damper Position (%)", min: 0, max: 100 }
  },
  "Water Supply": {
    temperature: { label: "Supply Water Temperature (°F)", min: 120, max: 200 },
    pressure: { label: "Supply Pressure (PSI)", min: 12, max: 60 },
    flow: { label: "Flow Rate (GPM)", min: 0, max: 500 },
    valvePosition: { label: "Valve Position (%)", min: 0, max: 100 }
  },
  "Water Return": {
    temperature: { label: "Return Water Temperature (°F)", min: 100, max: 180 },
    pressure: { label: "Return Pressure (PSI)", min: 8, max: 40 },
    flow: { label: "Flow Rate (GPM)", min: 0, max: 500 }
  },
  "Freeze Stat": {
    temperature: { label: "Temperature (°F)", min: 35, max: 38 }
  },
  "Differential Pressure": {
    pressure: { label: "Pressure (inW.C.)", min: -2, max: 2 },
    flow: { label: "Flow Rate", min: 0, max: 100, unit: "%" }
  },
  "Power": {
    amps: { label: "Current (Amps)", min: 0, max: 100 },
    voltage: { label: "Voltage (V)", min: 0, max: 480 },
    power: { label: "Power (kW)", min: 0, max: 50 },
    frequency: { label: "Frequency (Hz)", min: 0, max: 60 }
  },
  "Fan": {
    speed: { label: "Speed (%)", min: 0, max: 100 },
    status: { label: "Status", min: 0, max: 1 },
    runtime: { label: "Runtime (Hours)", min: 0, max: 100000 }
  },
  "Compressor": {
    status: { label: "Status", min: 0, max: 1 },
    runtime: { label: "Runtime (Hours)", min: 0, max: 100000 },
    suction: { label: "Suction Pressure (PSI)", min: 0, max: 100 },
    discharge: { label: "Discharge Pressure (PSI)", min: 100, max: 400 }
  },
  "Steam": {
    temperature: { label: "Temperature (°F)", min: 250, max: 350 },
    pressure: { label: "Pressure (PSI)", min: 15, max: 150 },
    flow: { label: "Flow Rate (lb/hr)", min: 0, max: 1000 },
    valvePosition: { label: "Valve Position (%)", min: 0, max: 100 }
  },
  "Zone": {
    temperature: { label: "Temperature (°F)", min: 65, max: 75 },
    humidity: { label: "Humidity (%)", min: 30, max: 60 },
    co2: { label: "CO2 Level (PPM)", min: 400, max: 1000 },
    occupancy: { label: "Occupancy Status", min: 0, max: 1 }
  },
  "Boiler": {
    temperature: { label: "Boiler Temperature (°F)", min: 140, max: 200 },
    pressure: { label: "Operating Pressure (PSI)", min: 12, max: 60 },
    waterLevel: { label: "Water Level (%)", min: 50, max: 100 },
    flame: { label: "Flame Signal (V)", min: 0, max: 5 },
    runtime: { label: "Runtime (Hours)", min: 0, max: 100000 }
  }
}

// Update equipment thresholds with more specific monitoring points
const EQUIPMENT_THRESHOLDS = {
  "Air Handler": {
    availableTypes: ["Supply Air", "Return Air", "Mixed Air", "Freeze Stat", "Fan", "Power", "Zone"]
  },
  "Boiler": {
    availableTypes: ["Boiler", "Water Supply", "Water Return", "Power"]
  },
  "Chiller": {
    availableTypes: ["Water Supply", "Water Return", "Compressor", "Power"]
  },
  "Cooling Tower": {
    availableTypes: ["Water Supply", "Water Return", "Fan", "Power"]
  },
  "Exhaust Fan": {
    availableTypes: ["Differential Pressure", "Fan", "Power"]
  },
  "Fan Coil": {
    availableTypes: ["Supply Air", "Water Supply", "Fan", "Power", "Zone"]
  },
  "Greenhouse": {
    availableTypes: ["Zone", "Supply Air", "Return Air"]
  },
  "Heat Exchanger": {
    availableTypes: ["Water Supply", "Water Return", "Differential Pressure"]
  },
  "Pump": {
    availableTypes: ["Water Supply", "Differential Pressure", "Power"]
  },
  "Steam Bundle": {
    availableTypes: ["Steam", "Water Supply", "Water Return"]
  },
  "Supply Fan": {
    availableTypes: ["Supply Air", "Differential Pressure", "Fan", "Power"]
  },
  "VAV Box": {
    availableTypes: ["Supply Air", "Zone", "Differential Pressure"]
  },
  "Water Heater": {
    availableTypes: ["Water Supply", "Water Return", "Power"]
  },
  "Actuator": {
    availableTypes: ["Differential Pressure", "Power"]
  },
  "DOAS": {
    availableTypes: [
      "Supply Air",
      "Return Air",
      "Outside Air",
      "Exhaust Air",
      "Energy Recovery",
      "Compressor",
      "Fan",
      "Power"
    ]
  },
}

interface Equipment {
  id: string
  name: string
  type: string
  locationId: string
  mqttConfig: {
    ip: string
    port: number
    username: string
    password: string
    topics: {
      metrics: string
      status: string
      control: string
    }
  }
  thresholds: {
    [thresholdType: string]: {
      [measurement: string]: {
        min: number
        max: number
      }
    }
  }
}

export function EquipmentSettings() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [newEquipment, setNewEquipment] = useState<Partial<Equipment>>({
    name: "",
    type: "",
    locationId: "",
    mqttConfig: {
      ip: "localhost",
      port: 1883,
      username: "",
      password: "",
      topics: {
        metrics: "metrics",
        status: "status",
        control: "control",
      },
    },
    thresholds: {},
  })
  const [editEquipment, setEditEquipment] = useState<Equipment | null>(null)
  const { db } = useFirebase()
  const { toast } = useToast()

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      if (!db) return

      try {
        const locationsCollection = collection(db, "locations")
        const snapshot = await getDocs(locationsCollection)
        const locationData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        console.log("Fetched locations for equipment settings:", locationData) // Debug log
        setLocations(locationData)
      } catch (error) {
        console.error("Error fetching locations:", error)
        toast({
          title: "Error",
          description: "Failed to load locations. Please try again.",
          variant: "destructive",
        })
      }
    }

    fetchLocations()
  }, [db, toast])

  useEffect(() => {
    const fetchData = async () => {
      if (!db) return

      try {
        // Fetch equipment
        const equipmentCollection = collection(db, "equipment")
        const snapshot = await getDocs(equipmentCollection)
        const equipmentData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setEquipment(equipmentData)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load data. Please try again.",
          variant: "destructive",
        })
      }
    }

    fetchData()
  }, [db, toast])

  const handleAddEquipment = async () => {
    if (!db) return

    setIsLoading(true)
    try {
      // Validate equipment data before saving
      const validationResult = validateEquipment({
        ...newEquipment,
        status: "offline",
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      if (!validationResult.success) {
        validationResult.errors.forEach((error) => {
          toast({
            title: "Validation Error",
            description: error.message,
            variant: "destructive",
          })
        })
        return
      }

      // Add the new equipment to the database
      const equipmentCollection = collection(db, "equipment")
      const docRef = await addDoc(equipmentCollection, {
        ...validationResult.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Add the new equipment to the local state
      setEquipment([
        ...equipment,
        {
          id: docRef.id,
          ...validationResult.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Equipment,
      ])

      // Reset the form
      setNewEquipment({
        name: "",
        type: "",
        locationId: "",
        mqttConfig: {
          ip: "localhost",
          port: 1883,
          username: "",
          password: "",
          topics: {
            metrics: "metrics",
            status: "status",
            control: "control",
          },
        },
        thresholds: {},
      })

      // Close the dialog
      setIsAddDialogOpen(false)

      toast({
        title: "Equipment Added",
        description: "The equipment has been added successfully",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error adding equipment:", error)
      toast({
        title: "Error",
        description: "Failed to add equipment. Please check your permissions.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditEquipment = async () => {
    if (!db || !editEquipment) return

    // Validate equipment data before saving
    const validationResult = validateEquipment(editEquipment)
    if (!validationResult.success) {
      validationResult.errors.forEach((error) => {
        toast({
          title: "Validation Error",
          description: error.message,
          variant: "destructive",
        })
      })
      return
    }

    try {
      // Update the equipment in the database
      const equipmentDoc = doc(db, "equipment", editEquipment.id)
      await updateDoc(equipmentDoc, {
        ...validationResult.data,
        updatedAt: new Date(),
      })

      // Update the equipment in the local state
      setEquipment(
        equipment.map((item) =>
          item.id === editEquipment.id ? { ...editEquipment, updatedAt: new Date() } : item,
        ),
      )

      // Close the dialog
      setIsEditDialogOpen(false)

      toast({
        title: "Equipment Updated",
        description: "The equipment has been updated successfully",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error updating equipment:", error)
      toast({
        title: "Error",
        description: "Failed to update equipment",
        variant: "destructive",
      })
    }
  }

  const handleDeleteEquipment = async (equipmentId: string) => {
    if (!db) return

    try {
      // Delete the equipment from the database
      const equipmentDoc = doc(db, "equipment", equipmentId)
      await deleteDoc(equipmentDoc)

      // Remove the equipment from the local state
      setEquipment(equipment.filter((item) => item.id !== equipmentId))

      toast({
        title: "Equipment Deleted",
        description: "The equipment has been deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting equipment:", error)
      toast({
        title: "Error",
        description: "Failed to delete equipment",
        variant: "destructive",
      })
    }
  }

  const getLocationName = (locationId: string) => {
    const location = locations.find((loc) => loc.id === locationId)
    return location ? location.name : "Unknown Location"
  }

  // Update renderThresholdFields function
  const renderThresholdFields = (equipmentType: string, isEdit: boolean = false) => {
    const equipment = EQUIPMENT_THRESHOLDS[equipmentType as keyof typeof EQUIPMENT_THRESHOLDS]
    if (!equipment) return null

    const currentThresholds = isEdit ? editEquipment?.thresholds : newEquipment.thresholds

    return (
      <div className="space-y-4">
        <h3 className="font-medium">Thresholds</h3>
        <div className="space-y-6">
          {equipment.availableTypes.map((thresholdType) => {
            const thresholdConfig = THRESHOLD_TYPES[thresholdType as keyof typeof THRESHOLD_TYPES]
            return (
              <div key={thresholdType} className="space-y-4 border rounded-lg p-4">
                <h4 className="font-medium text-sm">{thresholdType}</h4>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(thresholdConfig).map(([key, config]) => (
                    <div key={key} className="space-y-2">
                      <Label>{config.label}</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Input
                          type="number"
                          step={key === 'pressure' ? "0.01" : "1"}
                          placeholder={`Min (${config.min})`}
                          value={currentThresholds?.[thresholdType]?.[key]?.min}
                          onChange={(e) => {
                            if (isEdit && editEquipment) {
                              setEditEquipment({
                                ...editEquipment,
                                thresholds: {
                                  ...editEquipment.thresholds,
                                  [thresholdType]: {
                                    ...editEquipment.thresholds[thresholdType],
                                    [key]: {
                                      ...editEquipment.thresholds[thresholdType]?.[key],
                                      min: parseFloat(e.target.value),
                                    },
                                  },
                                },
                              })
                            } else {
                              setNewEquipment({
                                ...newEquipment,
                                thresholds: {
                                  ...newEquipment.thresholds!,
                                  [thresholdType]: {
                                    ...newEquipment.thresholds![thresholdType],
                                    [key]: {
                                      ...newEquipment.thresholds![thresholdType]?.[key],
                                      min: parseFloat(e.target.value),
                                    },
                                  },
                                },
                              })
                            }
                          }}
                        />
                        <Input
                          type="number"
                          step={key === 'pressure' ? "0.01" : "1"}
                          placeholder={`Max (${config.max})`}
                          value={currentThresholds?.[thresholdType]?.[key]?.max}
                          onChange={(e) => {
                            if (isEdit && editEquipment) {
                              setEditEquipment({
                                ...editEquipment,
                                thresholds: {
                                  ...editEquipment.thresholds,
                                  [thresholdType]: {
                                    ...editEquipment.thresholds[thresholdType],
                                    [key]: {
                                      ...editEquipment.thresholds[thresholdType]?.[key],
                                      max: parseFloat(e.target.value),
                                    },
                                  },
                                },
                              })
                            } else {
                              setNewEquipment({
                                ...newEquipment,
                                thresholds: {
                                  ...newEquipment.thresholds!,
                                  [thresholdType]: {
                                    ...newEquipment.thresholds![thresholdType],
                                    [key]: {
                                      ...newEquipment.thresholds![thresholdType]?.[key],
                                      max: parseFloat(e.target.value),
                                    },
                                  },
                                },
                              })
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Equipment</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add Equipment
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Equipment</DialogTitle>
              <DialogDescription>Configure a new piece of equipment in your building management system</DialogDescription>
            </DialogHeader>
            {newEquipment && (
              <div className="space-y-6 py-4">
                {/* Basic Information Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">Basic Information</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={newEquipment.name}
                        onChange={(e) => setNewEquipment({ ...newEquipment, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Type</Label>
                      <Select
                        value={newEquipment.type}
                        onValueChange={(value) => setNewEquipment({ ...newEquipment, type: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          {EQUIPMENT_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {type}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="location">Location</Label>
                    <Select
                      value={newEquipment.locationId}
                      onValueChange={(value) => setNewEquipment({ ...newEquipment, locationId: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* MQTT Configuration Section */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold">MQTT Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="topic">Topic</Label>
                      <Input
                        id="topic"
                        value={newEquipment.mqttConfig.topic}
                        onChange={(e) =>
                          setNewEquipment({
                            ...newEquipment,
                            mqttConfig: { ...newEquipment.mqttConfig, topic: e.target.value },
                          })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="clientId">Client ID</Label>
                      <Input
                        id="clientId"
                        value={newEquipment.mqttConfig.clientId}
                        onChange={(e) =>
                          setNewEquipment({
                            ...newEquipment,
                            mqttConfig: { ...newEquipment.mqttConfig, clientId: e.target.value },
                          })
                        }
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Thresholds Section */}
                {newEquipment.type && (
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Thresholds</h3>
                    <div className="space-y-4">
                      {EQUIPMENT_THRESHOLDS[newEquipment.type as keyof typeof EQUIPMENT_THRESHOLDS]?.availableTypes.map(
                        (thresholdType) => (
                          <div key={thresholdType} className="space-y-4 border rounded-lg p-4">
                            <h4 className="font-medium text-sm">{thresholdType}</h4>
                            <div className="grid grid-cols-2 gap-4">
                              {Object.entries(THRESHOLD_TYPES[thresholdType as keyof typeof THRESHOLD_TYPES]).map(
                                ([key, config]) => (
                                  <div key={key} className="space-y-2">
                                    <Label>{config.label}</Label>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Input
                                        type="number"
                                        step={key === 'pressure' ? "0.01" : "1"}
                                        placeholder={`Min (${config.min})`}
                                        value={newEquipment.thresholds?.[thresholdType]?.[key]?.min || ""}
                                        onChange={(e) =>
                                          setNewEquipment({
                                            ...newEquipment,
                                            thresholds: {
                                              ...newEquipment.thresholds,
                                              [thresholdType]: {
                                                ...newEquipment.thresholds?.[thresholdType],
                                                [key]: {
                                                  ...newEquipment.thresholds?.[thresholdType]?.[key],
                                                  min: parseFloat(e.target.value),
                                                },
                                              },
                                            },
                                          })
                                        }
                                        required
                                      />
                                      <Input
                                        type="number"
                                        step={key === 'pressure' ? "0.01" : "1"}
                                        placeholder={`Max (${config.max})`}
                                        value={newEquipment.thresholds?.[thresholdType]?.[key]?.max || ""}
                                        onChange={(e) =>
                                          setNewEquipment({
                                            ...newEquipment,
                                            thresholds: {
                                              ...newEquipment.thresholds,
                                              [thresholdType]: {
                                                ...newEquipment.thresholds?.[thresholdType],
                                                [key]: {
                                                  ...newEquipment.thresholds?.[thresholdType]?.[key],
                                                  max: parseFloat(e.target.value),
                                                },
                                              },
                                            },
                                          })
                                        }
                                        required
                                      />
                                    </div>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            <DialogFooter className="sticky bottom-0 bg-background border-t p-4">
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddEquipment} disabled={isLoading}>
                {isLoading ? "Adding..." : "Add Equipment"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Equipment</CardTitle>
          <CardDescription>View and manage all equipment in your building management system</CardDescription>
        </CardHeader>
        <CardContent>
          {equipment.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Settings className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-lg font-medium">No Equipment</p>
              <p className="text-sm text-muted-foreground">Add your first equipment to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>MQTT IP</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {equipment.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>{getLocationName(item.locationId)}</TableCell>
                    <TableCell>{item.mqttConfig.ip}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditEquipment(item)
                            setIsEditDialogOpen(true)
                          }}
                        >
                          <Edit className="h-4 w-4" />
                          <span className="sr-only">Edit</span>
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon">
                              <Trash className="h-4 w-4" />
                              <span className="sr-only">Delete</span>
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Delete Equipment</AlertDialogTitle>
                              <AlertDialogDescription>
                                Are you sure you want to delete this equipment? This action cannot be undone.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDeleteEquipment(item.id)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Delete
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
            <DialogDescription>Update the equipment details</DialogDescription>
          </DialogHeader>
          {editEquipment && (
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-name">Equipment Name</Label>
                  <Input
                    id="edit-name"
                    value={editEquipment.name}
                    onChange={(e) => setEditEquipment({ ...editEquipment, name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-type">Equipment Type</Label>
                  <Select
                    value={editEquipment.type}
                    onValueChange={(value) => setEditEquipment({ ...editEquipment, type: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select type" />
                    </SelectTrigger>
                    <SelectContent>
                      {EQUIPMENT_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-location">Location</Label>
                <Select
                  value={editEquipment.locationId}
                  onValueChange={(value) => setEditEquipment({ ...editEquipment, locationId: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-4">
                <h3 className="font-medium">MQTT Configuration</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-mqtt-ip">IP Address</Label>
                    <Input
                      id="edit-mqtt-ip"
                      value={editEquipment.mqttConfig.ip}
                      onChange={(e) =>
                        setEditEquipment({
                          ...editEquipment,
                          mqttConfig: { ...editEquipment.mqttConfig, ip: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-mqtt-port">Port</Label>
                    <Input
                      id="edit-mqtt-port"
                      type="number"
                      value={editEquipment.mqttConfig.port}
                      onChange={(e) =>
                        setEditEquipment({
                          ...editEquipment,
                          mqttConfig: { ...editEquipment.mqttConfig, port: parseInt(e.target.value) },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-mqtt-username">Username</Label>
                    <Input
                      id="edit-mqtt-username"
                      value={editEquipment.mqttConfig.username}
                      onChange={(e) =>
                        setEditEquipment({
                          ...editEquipment,
                          mqttConfig: { ...editEquipment.mqttConfig, username: e.target.value },
                        })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-mqtt-password">Password</Label>
                    <Input
                      id="edit-mqtt-password"
                      type="password"
                      value={editEquipment.mqttConfig.password}
                      onChange={(e) =>
                        setEditEquipment({
                          ...editEquipment,
                          mqttConfig: { ...editEquipment.mqttConfig, password: e.target.value },
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-mqtt-topics">Topics</Label>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-mqtt-topic-metrics">Metrics</Label>
                      <Input
                        id="edit-mqtt-topic-metrics"
                        value={editEquipment.mqttConfig.topics.metrics}
                        onChange={(e) =>
                          setEditEquipment({
                            ...editEquipment,
                            mqttConfig: {
                              ...editEquipment.mqttConfig,
                              topics: { ...editEquipment.mqttConfig.topics, metrics: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-mqtt-topic-status">Status</Label>
                      <Input
                        id="edit-mqtt-topic-status"
                        value={editEquipment.mqttConfig.topics.status}
                        onChange={(e) =>
                          setEditEquipment({
                            ...editEquipment,
                            mqttConfig: {
                              ...editEquipment.mqttConfig,
                              topics: { ...editEquipment.mqttConfig.topics, status: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-mqtt-topic-control">Control</Label>
                      <Input
                        id="edit-mqtt-topic-control"
                        value={editEquipment.mqttConfig.topics.control}
                        onChange={(e) =>
                          setEditEquipment({
                            ...editEquipment,
                            mqttConfig: {
                              ...editEquipment.mqttConfig,
                              topics: { ...editEquipment.mqttConfig.topics, control: e.target.value },
                            },
                          })
                        }
                      />
                    </div>
                  </div>
                </div>
              </div>

              {editEquipment?.type && renderThresholdFields(editEquipment.type, true)}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditEquipment} disabled={!editEquipment?.name || !editEquipment?.type || !editEquipment?.locationId}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
} 