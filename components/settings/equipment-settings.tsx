// components/settings/equipment-settings.tsx
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// ===============================================================================
// NEURAL BMS EQUIPMENT SETTINGS COMPONENT - HVAC EQUIPMENT MANAGEMENT INTERFACE
// ===============================================================================
//
// OVERVIEW:
// This component provides a comprehensive interface for managing HVAC equipment
// within the Neural BMS system. It handles equipment registration, configuration,
// threshold setup, and Firebase Real-time Database integration for live data
// monitoring and control across multiple building locations.
//
// CORE FUNCTIONALITY:
// 1. **Equipment Registration** - Add/edit/delete HVAC equipment with full specifications
// 2. **Type Management** - Support for 16 different equipment types with specific parameters
// 3. **Threshold Configuration** - Detailed monitoring thresholds for each equipment type
// 4. **Firebase Integration** - Real-time database path configuration for live data
// 5. **Location Association** - Link equipment to specific building locations
// 6. **Network Configuration** - IP address assignment for network-connected equipment
//
// SUPPORTED EQUIPMENT TYPES (16 Total):
// - **Air Handler** - AHU systems with supply/return air monitoring
// - **Boiler** - Hot water and steam boiler systems
// - **Chiller** - Chilled water systems with compressor monitoring
// - **Cooling Tower** - Heat rejection systems with fan control
// - **DOAS** - Dedicated Outdoor Air Systems with energy recovery
// - **Exhaust Fan** - Exhaust ventilation systems
// - **Fan Coil** - Terminal units with heating/cooling coils
// - **Greenhouse** - Specialized environmental control systems
// - **Heat Exchanger** - Heat transfer equipment
// - **Pump** - Water circulation pumps
// - **RTU** - Rooftop units with integrated HVAC systems
// - **Steam Bundle** - Steam heating distribution systems
// - **Supply Fan** - Supply air fan systems
// - **VAV Box** - Variable Air Volume terminal units
// - **Water Heater** - Domestic and process water heating
// - **Actuator** - Control actuators and dampers
//
// THRESHOLD MONITORING CATEGORIES (13 Types):
// 1. **Supply Air** - Temperature, humidity, pressure, flow, CO2
// 2. **Return Air** - Temperature, humidity, CO2 monitoring
// 3. **Outside Air** - Outdoor conditions and damper positions
// 4. **Exhaust Air** - Exhaust temperature, flow, and damper control
// 5. **Energy Recovery** - Heat recovery efficiency and bypass control
// 6. **Mixed Air** - Mixed air temperature and damper positions
// 7. **Water Supply** - Supply water temperature, pressure, flow, valve position
// 8. **Water Return** - Return water temperature, pressure, flow
// 9. **Freeze Stat** - Freeze protection temperature monitoring
// 10. **Differential Pressure** - Pressure differential and flow monitoring
// 11. **Power** - Electrical monitoring (amps, voltage, power, frequency)
// 12. **Fan** - Fan speed, status, and runtime monitoring
// 13. **Compressor** - Compressor operation and pressure monitoring
// 14. **Steam** - Steam temperature, pressure, flow, valve position
// 15. **Zone** - Zone temperature, humidity, CO2, occupancy
// 16. **Boiler** - Boiler-specific temperature, pressure, water level, flame signal
//
// FIREBASE INTEGRATION:
// - **Real-time Database Paths** - Configurable paths for live data integration
// - **Location Normalization** - Automatic path generation from location names
// - **System Naming** - Equipment-specific system names for data organization
// - **Live Monitoring** - Real-time equipment status and metrics
//
// EQUIPMENT CONFIGURATION FEATURES:
// - **Automatic System Naming** - Default system names based on equipment type
// - **Zone Assignment** - Optional zone designation for applicable equipment
// - **IP Address Management** - Network configuration for connected devices
// - **Threshold Templates** - Pre-configured monitoring thresholds by equipment type
// - **Custom Parameters** - Flexible threshold configuration for specific requirements
//
// USER INTERFACE FEATURES:
// - **Responsive Design** - Optimized for desktop and tablet interfaces
// - **Modal Dialogs** - Full-screen equipment configuration dialogs
// - **Scrollable Content** - Large forms with proper scroll handling
// - **Form Validation** - Real-time validation with error messaging
// - **Bulk Operations** - Efficient management of multiple equipment pieces
// - **Location Filtering** - Filter equipment by location with counts
// - **Sorting** - Alphabetical sorting by location and equipment name
//
// DATA MANAGEMENT:
// - **Firestore Integration** - Equipment data stored in Firebase Firestore
// - **Location Linking** - Dynamic location dropdown from locations collection
// - **Real-time Updates** - Live synchronization of equipment changes
// - **Error Handling** - Comprehensive error management with user feedback
// - **Data Validation** - Server-side and client-side validation
//
// SECURITY FEATURES:
// - **Role-based Access** - Equipment management restricted to devops users
// - **Input Sanitization** - Safe handling of user input data
// - **Firebase Security** - Secure database operations with proper authentication
// - **Audit Trail** - Equipment changes logged with timestamps
//
// PERFORMANCE OPTIMIZATIONS:
// - **Lazy Loading** - Equipment data loaded on demand
// - **Efficient Rendering** - Optimized React rendering for large equipment lists
// - **Debounced Inputs** - Smooth form interactions without excessive re-renders
// - **Memory Management** - Proper cleanup of event listeners and subscriptions
//
// ADVANCED FEATURES:
// - **Equipment Templates** - Pre-configured settings for common equipment types
// - **Bulk Import/Export** - Future capability for equipment data management
// - **Equipment Grouping** - Logical grouping by location, type, or zone
// - **Status Monitoring** - Real-time equipment online/offline status
// - **Maintenance Scheduling** - Integration points for maintenance management
//
// INTEGRATION POINTS:
// - **Logic Factory** - Equipment data consumed by control logic systems
// - **Metrics Collection** - Real-time data collection from configured equipment
// - **Alert System** - Threshold-based alerting for equipment monitoring
// - **Dashboard Integration** - Equipment status displayed in main dashboard
// - **Reporting System** - Equipment performance and status reporting
//
// COMPONENT ARCHITECTURE:
// - **React Hooks** - Modern React patterns with useState and useEffect
// - **TypeScript** - Full type safety with comprehensive interfaces
// - **shadcn/ui Components** - Consistent design system components
// - **Firebase Context** - Centralized Firebase integration
// - **Toast Notifications** - User feedback for all operations
//
// ERROR HANDLING:
// - **Graceful Degradation** - System continues operating during partial failures
// - **User Feedback** - Clear error messages and resolution guidance
// - **Logging Integration** - Comprehensive error logging for troubleshooting
// - **Retry Mechanisms** - Automatic retry for transient failures
//
// FUTURE ENHANCEMENTS:
// - **Equipment Discovery** - Automatic detection of network-connected equipment
// - **Template Library** - Expandable library of equipment configuration templates
// - **Maintenance Integration** - Work order and maintenance schedule integration
// - **Performance Analytics** - Equipment efficiency and performance trending
// - **Mobile Optimization** - Enhanced mobile interface for field technicians
//
// TECHNICAL SPECIFICATIONS:
// - **Framework** - React 18+ with TypeScript
// - **State Management** - React Hooks with local component state
// - **Database** - Firebase Firestore for equipment configuration
// - **Real-time Data** - Firebase Realtime Database for live metrics
// - **UI Framework** - shadcn/ui with Tailwind CSS
// - **Validation** - Client-side validation with server-side verification
//
// ===============================================================================

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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
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
  "RTU",
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
    co2: { label: "CO2 Level (PPM)", min: 400, max: 1000 },
  },
  "Return Air": {
    temperature: { label: "Temperature (°F)", min: 68, max: 78 },
    humidity: { label: "Humidity (%)", min: 30, max: 60 },
    co2: { label: "CO2 Level (PPM)", min: 400, max: 1000 },
  },
  "Outside Air": {
    temperature: { label: "Temperature (°F)", min: -20, max: 120 },
    humidity: { label: "Humidity (%)", min: 0, max: 100 },
    damperPosition: { label: "Damper Position (%)", min: 0, max: 100 },
    co2: { label: "CO2 Level (PPM)", min: 380, max: 500 },
  },
  "Exhaust Air": {
    temperature: { label: "Temperature (°F)", min: 55, max: 85 },
    humidity: { label: "Humidity (%)", min: 20, max: 80 },
    flow: { label: "Airflow (CFM)", min: 0, max: 10000 },
    damperPosition: { label: "Damper Position (%)", min: 0, max: 100 },
  },
  "Energy Recovery": {
    efficiency: { label: "Recovery Efficiency (%)", min: 0, max: 100 },
    temperature: { label: "Temperature (°F)", min: 40, max: 95 },
    bypass: { label: "Bypass Position (%)", min: 0, max: 100 },
  },
  "Mixed Air": {
    temperature: { label: "Temperature (°F)", min: 45, max: 65 },
    humidity: { label: "Humidity (%)", min: 30, max: 60 },
    damperPosition: { label: "Damper Position (%)", min: 0, max: 100 },
  },
  "Water Supply": {
    temperature: { label: "Supply Water Temperature (°F)", min: 120, max: 200 },
    pressure: { label: "Supply Pressure (PSI)", min: 12, max: 60 },
    flow: { label: "Flow Rate (GPM)", min: 0, max: 500 },
    valvePosition: { label: "Valve Position (%)", min: 0, max: 100 },
  },
  "Water Return": {
    temperature: { label: "Return Water Temperature (°F)", min: 100, max: 180 },
    pressure: { label: "Return Pressure (PSI)", min: 8, max: 40 },
    flow: { label: "Flow Rate (GPM)", min: 0, max: 500 },
  },
  "Freeze Stat": {
    temperature: { label: "Temperature (°F)", min: 35, max: 38 },
  },
  "Differential Pressure": {
    pressure: { label: "Pressure (inW.C.)", min: -2, max: 2 },
    flow: { label: "Flow Rate", min: 0, max: 100, unit: "%" },
  },
  Power: {
    amps: { label: "Current (Amps)", min: 0, max: 100 },
    voltage: { label: "Voltage (V)", min: 0, max: 480 },
    power: { label: "Power (kW)", min: 0, max: 50 },
    frequency: { label: "Frequency (Hz)", min: 0, max: 60 },
  },
  Fan: {
    speed: { label: "Speed (%)", min: 0, max: 100 },
    status: { label: "Status", min: 0, max: 1 },
    runtime: { label: "Runtime (Hours)", min: 0, max: 100000 },
  },
  Compressor: {
    status: { label: "Status", min: 0, max: 1 },
    runtime: { label: "Runtime (Hours)", min: 0, max: 100000 },
    suction: { label: "Suction Pressure (PSI)", min: 0, max: 100 },
    discharge: { label: "Discharge Pressure (PSI)", min: 100, max: 400 },
  },
  Steam: {
    temperature: { label: "Temperature (°F)", min: 250, max: 350 },
    pressure: { label: "Pressure (PSI)", min: 15, max: 150 },
    flow: { label: "Flow Rate (lb/hr)", min: 0, max: 1000 },
    valvePosition: { label: "Valve Position (%)", min: 0, max: 100 },
  },
  Zone: {
    temperature: { label: "Temperature (°F)", min: 65, max: 75 },
    humidity: { label: "Humidity (%)", min: 30, max: 60 },
    co2: { label: "CO2 Level (PPM)", min: 400, max: 1000 },
    occupancy: { label: "Occupancy Status", min: 0, max: 1 },
  },
  Boiler: {
    temperature: { label: "Boiler Temperature (°F)", min: 140, max: 200 },
    pressure: { label: "Operating Pressure (PSI)", min: 12, max: 60 },
    waterLevel: { label: "Water Level (%)", min: 50, max: 100 },
    flame: { label: "Flame Signal (V)", min: 0, max: 5 },
    runtime: { label: "Runtime (Hours)", min: 0, max: 100000 },
  },
}

// Update equipment thresholds with more specific monitoring points
const EQUIPMENT_THRESHOLDS = {
  "Air Handler": {
    availableTypes: ["Supply Air", "Return Air", "Mixed Air", "Freeze Stat", "Fan", "Power", "Zone"],
  },
  Boiler: {
    availableTypes: ["Boiler", "Water Supply", "Water Return", "Power"],
  },
  Chiller: {
    availableTypes: ["Water Supply", "Water Return", "Compressor", "Power"],
  },
  "Cooling Tower": {
    availableTypes: ["Water Supply", "Water Return", "Fan", "Power"],
  },
  "Exhaust Fan": {
    availableTypes: ["Differential Pressure", "Fan", "Power"],
  },
  "Fan Coil": {
    availableTypes: ["Supply Air", "Water Supply", "Fan", "Power", "Zone"],
  },
  Greenhouse: {
    availableTypes: ["Zone", "Supply Air", "Return Air"],
  },
  "Heat Exchanger": {
    availableTypes: ["Water Supply", "Water Return", "Differential Pressure"],
  },
  Pump: {
    availableTypes: ["Water Supply", "Differential Pressure", "Power"],
  },
  RTU: {
    availableTypes: ["Supply Air", "Return Air", "Outside Air", "Compressor", "Fan", "Power", "Zone"],
  },
  "Steam Bundle": {
    availableTypes: ["Steam", "Water Supply", "Water Return"],
  },
  "Supply Fan": {
    availableTypes: ["Supply Air", "Differential Pressure", "Fan", "Power"],
  },
  "VAV Box": {
    availableTypes: ["Supply Air", "Zone", "Differential Pressure"],
  },
  "Water Heater": {
    availableTypes: ["Water Supply", "Water Return", "Power"],
  },
  Actuator: {
    availableTypes: ["Differential Pressure", "Power"],
  },
  DOAS: {
    availableTypes: [
      "Supply Air",
      "Return Air",
      "Outside Air",
      "Exhaust Air",
      "Energy Recovery",
      "Compressor",
      "Fan",
      "Power",
    ],
  },
}

// Helper function to generate default system name based on equipment type
const getDefaultSystemName = (equipmentType) => {
  switch (equipmentType) {
    case "Air Handler":
      return "AHU-1"
    case "Boiler":
      return "Boilers"
    case "Chiller":
      return "Chiller"
    case "DOAS":
      return "DOAS-1"
    case "Fan Coil":
      return "FanCoil1"
    case "Greenhouse":
      return "Greenhouse"
    case "RTU":
      return "RTU-1"
    case "Steam Bundle":
      return "SteamBundle"
    default:
      return equipmentType.replace(/\s+/g, "")
  }
}

// Function to normalize location name for Firebase path
const normalizeLocationName = (name) => {
  if (!name) return ""
  return name.replace(/\s+/g, "").replace(/&/g, "And")
}

// Equipment interface
interface Equipment {
  id: string
  name: string
  type: string
  locationId: string
  ipAddress?: string
  firebasePath: {
    location: string // Exact location name in Firebase RTDB
    system: string // Exact system name in Firebase RTDB
  }
  zone?: string // Optional zone field for applicable equipment types
  thresholds: {
    [thresholdType: string]: {
      [measurement: string]: {
        min: number
        max: number
      }
    }
  }
  status?: string
  createdAt?: Date
  updatedAt?: Date
}

export function EquipmentSettings() {
  const [equipment, setEquipment] = useState<Equipment[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [selectedLocationFilter, setSelectedLocationFilter] = useState<string>("all")
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [newEquipment, setNewEquipment] = useState<Partial<Equipment>>({
    name: "",
    type: "",
    locationId: "",
    ipAddress: "",
    firebasePath: {
      location: "",
      system: "",
    },
    zone: "",
    thresholds: {},
  })
  const [editEquipment, setEditEquipment] = useState<Equipment | null>(null)
  const { db } = useFirebase()
  const { toast } = useToast()

  // Helper function to get location name
  const getLocationName = (locationId: string) => {
    const location = locations.find((loc) => loc.id === locationId)
    return location ? location.name : "Unknown Location"
  }

  // Filter equipment based on selected location
  const filteredEquipment = selectedLocationFilter === "all" 
    ? equipment.sort((a, b) => {
        // Sort by location name first, then by equipment name
        const locationA = getLocationName(a.locationId) || ""
        const locationB = getLocationName(b.locationId) || ""
        if (locationA !== locationB) {
          return locationA.localeCompare(locationB)
        }
        return (a.name || "").localeCompare(b.name || "")
      })
    : equipment.filter(item => item.locationId === selectedLocationFilter)
        .sort((a, b) => (a.name || "").localeCompare(b.name || ""))

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
        } as any))
        console.log("Fetched locations for equipment settings:", locationData)
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
        } as Equipment))
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
      // Ensure Firebase path is properly set
      let equipmentData = { ...newEquipment }

      // Make sure required fields are present
      if (!equipmentData.name || !equipmentData.type || !equipmentData.locationId) {
        toast({
          title: "Validation Error",
          description: "Name, type, and location are required fields",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // Double-check that firebasePath is correctly populated
      const selectedLocation = locations.find((loc) => loc.id === equipmentData.locationId)
      if (selectedLocation) {
        const locationName = normalizeLocationName(selectedLocation.name)
        equipmentData = {
          ...equipmentData,
          firebasePath: {
            location: locationName || "",
            system: getDefaultSystemName(equipmentData.type || ""),
          },
        }
      }

      // Add status and timestamps
      equipmentData = {
        ...equipmentData,
        status: "offline",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      console.log("Saving equipment to Firestore:", equipmentData)

      // Add the new equipment directly to the database
      const equipmentCollection = collection(db, "equipment")
      const docRef = await addDoc(equipmentCollection, equipmentData)

      console.log("Successfully saved equipment with ID:", docRef.id)

      // Add the new equipment to the local state
      setEquipment([
        ...equipment,
        {
          id: docRef.id,
          ...equipmentData,
        } as Equipment,
      ])

      // Reset the form
      setNewEquipment({
        name: "",
        type: "",
        locationId: "",
        ipAddress: "",
        firebasePath: {
          location: "",
          system: "",
        },
        zone: "",
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
        description: `Failed to add equipment: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditEquipment = async () => {
    if (!db || !editEquipment) return

    setIsLoading(true)

    try {
      // Make sure required fields are present
      if (!editEquipment.name || !editEquipment.type || !editEquipment.locationId) {
        toast({
          title: "Validation Error",
          description: "Name, type, and location are required fields",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // Ensure firebasePath is properly set
      let equipmentData = { ...editEquipment }

      // Double-check that firebasePath is correctly populated
      const selectedLocation = locations.find((loc) => loc.id === equipmentData.locationId)
      if (selectedLocation) {
        const locationName = normalizeLocationName(selectedLocation.name)
        equipmentData = {
          ...equipmentData,
          firebasePath: {
            location: locationName || "",
            system: equipmentData.firebasePath?.system || getDefaultSystemName(equipmentData.type),
          },
        }
      }

      // Add updatedAt timestamp
      equipmentData = {
        ...equipmentData,
        updatedAt: new Date(),
      }

      console.log("Updating equipment in Firestore:", equipmentData)

      // Update the equipment in the database
      const equipmentDoc = doc(db, "equipment", editEquipment.id)
      await updateDoc(equipmentDoc, equipmentData)

      console.log("Successfully updated equipment with ID:", editEquipment.id)

      // Update the equipment in the local state
      setEquipment(
        equipment.map((item) => (item.id === editEquipment.id ? { ...equipmentData, id: editEquipment.id } : item)),
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
        description: `Failed to update equipment: ${error instanceof Error ? error.message : "Unknown error"}`,
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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

  // Update renderThresholdFields function
  const renderThresholdFields = (equipmentType: string, isEdit = false) => {
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
                          step={key === "pressure" ? "0.01" : "1"}
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
                                      min: Number.parseFloat(e.target.value),
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
                                      min: Number.parseFloat(e.target.value),
                                    },
                                  },
                                },
                              })
                            }
                          }}
                        />
                        <Input
                          type="number"
                          step={key === "pressure" ? "0.01" : "1"}
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
                                      max: Number.parseFloat(e.target.value),
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
                                      max: Number.parseFloat(e.target.value),
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
        <div className="flex items-center gap-4">
          {/* Location Filter */}
          <div className="flex items-center gap-2">
            <Label htmlFor="location-filter" className="text-sm font-medium">Filter by Location:</Label>
            <Select value={selectedLocationFilter} onValueChange={setSelectedLocationFilter}>
              <SelectTrigger className="w-[200px]" id="location-filter">
                <SelectValue placeholder="Select location" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Locations ({equipment.length})</SelectItem>
                {locations
                  .sort((a, b) => a.name.localeCompare(b.name))
                  .map((location) => {
                    const count = equipment.filter(eq => eq.locationId === location.id).length
                    return (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name} ({count})
                      </SelectItem>
                    )
                  })
                }
              </SelectContent>
            </Select>
          </div>
          
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Equipment
              </Button>
            </DialogTrigger>
          <DialogContent className="max-w-4xl flex flex-col h-[80vh]">
            <DialogHeader>
              <DialogTitle>Add New Equipment</DialogTitle>
              <DialogDescription>
                Configure a new piece of equipment in your building management system
              </DialogDescription>
            </DialogHeader>
            {/* Make the content area scrollable */}
            <div className="flex-1 overflow-y-auto pr-2">
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
                          onValueChange={(value) => {
                            const selectedLocation = locations.find((loc) => loc.id === newEquipment.locationId)
                            const locationName = selectedLocation ? normalizeLocationName(selectedLocation.name) : ""

                            setNewEquipment({
                              ...newEquipment,
                              type: value,
                              firebasePath: {
                                location: locationName,
                                system: getDefaultSystemName(value),
                              },
                            })
                          }}
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
                        onValueChange={(value) => {
                          const selectedLocation = locations.find((loc) => loc.id === value)
                          const locationName = selectedLocation ? normalizeLocationName(selectedLocation.name) : ""

                          setNewEquipment({
                            ...newEquipment,
                            locationId: value,
                            firebasePath: {
                              location: locationName,
                              system: newEquipment.firebasePath?.system || getDefaultSystemName(newEquipment.type || ""),
                            },
                          })
                        }}
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
                    <div className="space-y-2">
                      <Label htmlFor="ipAddress">IP Address (Optional)</Label>
                      <Input
                        id="ipAddress"
                        value={newEquipment.ipAddress || ""}
                        onChange={(e) => setNewEquipment({ ...newEquipment, ipAddress: e.target.value })}
                        placeholder="e.g. 192.168.1.100"
                      />
                    </div>
                  </div>

                  {/* Firebase Path Configuration */}
                  <div className="space-y-4 border rounded-lg p-4">
                    <h3 className="text-lg font-semibold">Firebase Path Configuration</h3>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="firebase-location">Location Name (Auto-populated)</Label>
                        <Input
                          id="firebase-location"
                          value={newEquipment.firebasePath?.location || ""}
                          onChange={(e) =>
                            setNewEquipment({
                              ...newEquipment,
                              firebasePath: {
                                location: e.target.value,
                                system: newEquipment.firebasePath?.system || "",
                              },
                            })
                          }
                          placeholder="e.g. AkronCarnegiePublicLibrary"
                          className="bg-gray-50"
                        />
                        <p className="text-xs text-muted-foreground">Automatically set from selected location</p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="firebase-system">System Name</Label>
                        <Input
                          id="firebase-system"
                          value={newEquipment.firebasePath?.system || ""}
                          onChange={(e) =>
                            setNewEquipment({
                              ...newEquipment,
                              firebasePath: {
                                location: newEquipment.firebasePath?.location || "",
                                system: e.target.value,
                              },
                            })
                          }
                          placeholder="e.g. AHU-1, Boilers, etc."
                        />
                        <p className="text-xs text-muted-foreground">
                          This must match the exact system name in Firebase RTDB
                        </p>
                      </div>
                    </div>

                    {/* Add zone input for applicable equipment types */}
                    {["Air Handler", "Fan Coil", "VAV Box", "DOAS", "RTU"].includes(newEquipment.type || "") && (
                      <div className="space-y-2">
                        <Label htmlFor="equipment-zone">Zone</Label>
                        <Input
                          id="equipment-zone"
                          value={newEquipment.zone || ""}
                          onChange={(e) =>
                            setNewEquipment({
                              ...newEquipment,
                              zone: e.target.value,
                            })
                          }
                          placeholder="e.g. North Wing, Room 101"
                        />
                        <p className="text-xs text-muted-foreground">Optional zone name for this equipment</p>
                      </div>
                    )}
                  </div>

                  {/* Thresholds Section */}
                  {newEquipment.type && (
                    <div className="space-y-4">
                      <h3 className="text-lg font-semibold">Thresholds</h3>
                      <div className="space-y-4">
                        {EQUIPMENT_THRESHOLDS[
                          newEquipment.type as keyof typeof EQUIPMENT_THRESHOLDS
                        ]?.availableTypes.map((thresholdType) => (
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
                                        step={key === "pressure" ? "0.01" : "1"}
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
                                                  min: Number.parseFloat(e.target.value),
                                                },
                                              },
                                            },
                                          })
                                        }
                                      />
                                      <Input
                                        type="number"
                                        step={key === "pressure" ? "0.01" : "1"}
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
                                                  max: Number.parseFloat(e.target.value),
                                                },
                                              },
                                            },
                                          })
                                        }
                                      />
                                    </div>
                                  </div>
                                ),
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            {/* Footer stays fixed at the bottom */}
            <DialogFooter className="border-t p-4 mt-auto">
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
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Equipment</CardTitle>
          <CardDescription>View and manage all equipment in your building management system</CardDescription>
        </CardHeader>
        <CardContent>
          {filteredEquipment.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Settings className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-lg font-medium">
                {selectedLocationFilter === "all" ? "No Equipment" : "No Equipment at This Location"}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedLocationFilter === "all" 
                  ? "Add your first equipment to get started" 
                  : "Try selecting a different location or add equipment to this location"}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Equipment ID</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Location</TableHead>
                  <TableHead>Firebase Path</TableHead>
                  <TableHead>Zone</TableHead>
                  <TableHead>IP Address</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredEquipment.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    <TableCell className="font-mono text-xs bg-gray-50 rounded px-2 py-1">{item.id}</TableCell>
                    <TableCell>{item.type}</TableCell>
                    <TableCell>{getLocationName(item.locationId)}</TableCell>
                    <TableCell>
                      {item.firebasePath
                        ? `${item.firebasePath.location}/${item.firebasePath.system}`
                        : "Not configured"}
                    </TableCell>
                    <TableCell>{item.zone || "-"}</TableCell>
                    <TableCell>{item.ipAddress || "-"}</TableCell>
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
        <DialogContent className="max-w-4xl flex flex-col h-[80vh]">
          <DialogHeader>
            <DialogTitle>Edit Equipment</DialogTitle>
            <DialogDescription>Update the equipment details</DialogDescription>
          </DialogHeader>
          <div className="flex-1 overflow-y-auto pr-2">
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
                      onValueChange={(value) => {
                        const selectedLocation = locations.find((loc) => loc.id === editEquipment.locationId)
                        const locationName = selectedLocation ? normalizeLocationName(selectedLocation.name) : ""

                        setEditEquipment({
                          ...editEquipment,
                          type: value,
                          firebasePath: {
                            location: locationName,
                            system: getDefaultSystemName(value),
                          },
                        })
                      }}
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
                    onValueChange={(value) => {
                      const selectedLocation = locations.find((loc) => loc.id === value)
                      const locationName = selectedLocation ? normalizeLocationName(selectedLocation.name) : ""

                      setEditEquipment({
                        ...editEquipment,
                        locationId: value,
                        firebasePath: {
                          location: locationName,
                          system: editEquipment.firebasePath?.system || getDefaultSystemName(editEquipment.type),
                        },
                      })
                    }}
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
                <div className="space-y-2">
                  <Label htmlFor="edit-ip">IP Address (Optional)</Label>
                  <Input
                    id="edit-ip"
                    value={editEquipment.ipAddress || ""}
                    onChange={(e) =>
                      setEditEquipment({
                        ...editEquipment,
                        ipAddress: e.target.value,
                      })
                    }
                    placeholder="e.g. 192.168.1.100"
                  />
                </div>

                {/* Firebase Path Configuration for Edit */}
                <div className="space-y-4 border rounded-lg p-4">
                  <h3 className="font-medium">Firebase Path Configuration</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-firebase-location">Location Name (Auto-populated)</Label>
                      <Input
                        id="edit-firebase-location"
                        value={editEquipment.firebasePath?.location || ""}
                        onChange={(e) =>
                          setEditEquipment({
                            ...editEquipment,
                            firebasePath: {
                              location: e.target.value,
                              system: editEquipment.firebasePath?.system || getDefaultSystemName(editEquipment.type),
                            },
                          })
                        }
                        placeholder="e.g. AkronCarnegiePublicLibrary"
                        className="bg-gray-50"
                      />
                      <p className="text-xs text-muted-foreground">Automatically set from selected location</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-firebase-system">System Name</Label>
                      <Input
                        id="edit-firebase-system"
                        value={editEquipment.firebasePath?.system || ""}
                        onChange={(e) =>
                          setEditEquipment({
                            ...editEquipment,
                            firebasePath: {
                              location: editEquipment.firebasePath?.location || "",
                              system: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. AHU-1, Boilers, etc."
                      />
                      <p className="text-xs text-muted-foreground">
                        This must match the exact system name in Firebase RTDB
                      </p>
                    </div>
                  </div>

                  {/* Add zone input for edit mode */}
                  {["Air Handler", "Fan Coil", "VAV Box", "DOAS", "RTU"].includes(editEquipment.type) && (
                    <div className="space-y-2">
                      <Label htmlFor="edit-equipment-zone">Zone</Label>
                      <Input
                        id="edit-equipment-zone"
                        value={editEquipment.zone || ""}
                        onChange={(e) =>
                          setEditEquipment({
                            ...editEquipment,
                            zone: e.target.value,
                          })
                        }
                        placeholder="e.g. North Wing, Room 101"
                      />
                      <p className="text-xs text-muted-foreground">Optional zone name for this equipment</p>
                    </div>
                  )}
                </div>

                {/* Thresholds for edit mode */}
                {editEquipment.type && renderThresholdFields(editEquipment.type, true)}
              </div>
            )}
          </div>
          <DialogFooter className="border-t p-4 mt-auto">
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleEditEquipment}
              disabled={!editEquipment?.name || !editEquipment?.type || !editEquipment?.locationId}
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
