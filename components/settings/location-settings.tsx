"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building, Edit, Plus, Trash } from "lucide-react"
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
import { Textarea } from "@/components/ui/textarea"
import { TECHNICIAN_SPECIALTIES, type Technician } from "@/lib/validation"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, query, where } from "firebase/firestore"
import { Checkbox } from "@/components/ui/checkbox"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ZoneSettings } from "@/components/settings/zone-settings"
import { EquipmentSettings } from "./equipment-settings"
import type { Task } from "@/lib/validation"
import { format } from "date-fns"

// Try a different collection name to see if there's an issue with the original collection
const COLLECTION_NAME = "technicians"

export function LocationSettings() {
  const { config, updateConfig, db } = useFirebase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false)
  const [editTechnician, setEditTechnician] = useState<Technician | null>(null)
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null)
  const [newTechnician, setNewTechnician] = useState<Partial<Technician>>({
    name: "",
    phone: "",
    email: "",
    specialties: Object.keys(TECHNICIAN_SPECIALTIES).map((type) => ({ type, level: "not-selected" })),
    assignedLocations: ["not-assigned"],
    color: "#4FD1C5",
    notes: "",
  })
  const [taskData, setTaskData] = useState({
    title: "",
    description: "",
    priority: "medium",
    dueDate: "",
    locationId: "",
  })
  const [tasks, setTasks] = useState<Task[]>([])
  const [newLocation, setNewLocation] = useState<any>({
    name: "",
    address: "",
    city: "",
    state: "",
    zipCode: "",
    country: "",
    contactName: "",
    contactEmail: "",
    contactPhone: "",
  })
  const [editLocation, setEditLocation] = useState<any>(null)
  const [locationDocuments, setLocationDocuments] = useState<Map<string, string>>(new Map())
  const [isAddTechnicianDialogOpen, setIsAddTechnicianDialogOpen] = useState<boolean>(false)
  const [isEditTechnicianDialogOpen, setIsEditTechnicianDialogOpen] = useState<boolean>(false)
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState<boolean>(false)
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: "",
    description: "",
    locationId: "",
    assignedTo: "",
    status: "Pending",
    priority: "Medium",
    dueDate: new Date(),
  })

  // Fetch technicians
  useEffect(() => {
    const fetchTechnicians = async () => {
      if (!db) return

      try {
        // Try both collection names to ensure we get data
        const techniciansCollection = collection(db, COLLECTION_NAME)
        const snapshot = await getDocs(techniciansCollection)

        // If no data in the new collection, try the old one
        if (snapshot.empty) {
          const oldCollection = collection(db, "automatabmstechnicians")
          const oldSnapshot = await getDocs(oldCollection)
          const technicianData = oldSnapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setTechnicians(technicianData)
        } else {
          const technicianData = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          }))
          setTechnicians(technicianData)
        }
      } catch (error) {
        console.error("Error fetching technicians:", error)
        toast({
          title: "Error",
          description: "Failed to load technicians. Please try again.",
          variant: "destructive",
        })
      }
    }

    fetchTechnicians()
  }, [db, toast])

  // Fetch locations
  useEffect(() => {
    const fetchLocations = async () => {
      if (!db) return

      try {
        const locationsCollection = collection(db, "locations")
        const snapshot = await getDocs(locationsCollection)

        // Create a map of id field to document ID
        const docMap = new Map<string, string>()

        const locationData = snapshot.docs.map((doc) => {
          const data = doc.data()
          // Store the mapping between id field and document ID
          if (data.id) {
            docMap.set(data.id.toString(), doc.id)
          }
          return {
            id: data.id || doc.id, // Use the id field if available, otherwise use doc.id
            _docId: doc.id, // Store the actual document ID in a non-visible field
            ...data,
          }
        })

        setLocationDocuments(docMap)
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

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      if (!db) return

      try {
        const tasksCollection = collection(db, "tasks")
        const snapshot = await getDocs(tasksCollection)
        const taskData: Task[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          title: doc.data().title || "",
          description: doc.data().description || "",
          locationId: doc.data().locationId || "",
          assignedTo: doc.data().assignedTo || "",
          status: doc.data().status || "Pending",
          priority: doc.data().priority || "Medium",
          dueDate: doc.data().dueDate?.toDate() || new Date(),
          createdAt: doc.data().createdAt,
          updatedAt: doc.data().updatedAt,
        }))
        setTasks(taskData)
      } catch (error) {
        console.error("Error fetching tasks:", error)
        toast({
          title: "Error",
          description: "Failed to load tasks. Please try again.",
          variant: "destructive",
        })
      }
    }

    fetchTasks()
  }, [db, toast])

  const handleAddTechnician = async () => {
    if (!db) return

    setIsLoading(true)
    try {
      // Filter out any empty arrays
      const technicianData = {
        ...newTechnician,
        specialties: newTechnician.specialties?.filter((s) => s.type && s.level) || [],
        assignedLocations: newTechnician.assignedLocations?.filter((loc) => loc) || [],
      }

      const techniciansCollection = collection(db, COLLECTION_NAME)
      const docRef = await addDoc(techniciansCollection, {
        ...technicianData,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const newTechnicianWithId = {
        id: docRef.id,
        ...technicianData,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Technician

      setTechnicians([...technicians, newTechnicianWithId])

      // Send email notification if locations are assigned
      if (newTechnicianWithId.assignedLocations && newTechnicianWithId.assignedLocations.length > 0) {
        // Get location details for each assigned location
        const assignedLocationDetails = newTechnicianWithId.assignedLocations
          .map((locId) => {
            const location = locations.find((loc) => loc.id === locId)
            return location
              ? {
                  id: location.id,
                  name: location.name,
                  city: location.city,
                  state: location.state,
                  country: location.country,
                }
              : null
          })
          .filter(Boolean)

        if (assignedLocationDetails.length > 0) {
          try {
            await fetch("/api/send-technician-updates", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                technicianName: newTechnicianWithId.name,
                technicianEmail: newTechnicianWithId.email,
                assignedLocations: assignedLocationDetails,
                action: "added",
              }),
            })
          } catch (emailError) {
            console.error("Error sending location assignment email:", emailError)
          }
        }
      }

      setNewTechnician({
        name: "",
        phone: "",
        email: "",
        specialties: [],
        assignedLocations: [],
        color: "#4FD1C5",
        notes: "",
      })

      setIsAddTechnicianDialogOpen(false)
      toast({
        title: "Technician Added",
        description: "The technician has been added successfully",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error adding technician:", error)
      toast({
        title: "Error",
        description: "Failed to add technician. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditTechnician = async () => {
    console.log("handleEditTechnician function called")
    if (!db || !editTechnician) return

    setIsLoading(true)
    try {
      const technicianRef = doc(db, "technicians", editTechnician.id)
      await updateDoc(technicianRef, {
        name: editTechnician.name,
        phone: editTechnician.phone,
        email: editTechnician.email,
        specialties: editTechnician.specialties,
        assignedLocations: editTechnician.assignedLocations,
        notes: editTechnician.notes,
        updatedAt: new Date(),
      })

      setTechnicians(technicians.map((tech) => (tech.id === editTechnician.id ? { ...tech, ...editTechnician } : tech)))

      setIsEditDialogOpen(false)
      toast({
        title: "Success",
        description: "Technician updated successfully",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error updating technician:", error)
      toast({
        title: "Error",
        description: "Failed to update technician",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteTechnician = async (technicianId: string) => {
    if (!db) return

    try {
      const technicianDoc = doc(db, "technicians", technicianId)
      await deleteDoc(technicianDoc)
      setTechnicians(technicians.filter((tech) => tech.id !== technicianId))

      toast({
        title: "Success",
        description: "Technician deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting technician:", error)
      toast({
        title: "Error",
        description: "Failed to delete technician",
        variant: "destructive",
      })
    }
  }

  const handleDeleteTask = async (taskId: string) => {
    if (!db) return

    try {
      const taskDoc = doc(db, "tasks", taskId)
      await deleteDoc(taskDoc)
      setTasks(tasks.filter((task) => task.id !== taskId))

      toast({
        title: "Task Deleted",
        description: "The task has been deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting task:", error)
      toast({
        title: "Error",
        description: "Failed to delete task",
        variant: "destructive",
      })
    }
  }

  const handleAddTask = async () => {
    if (!db || !selectedTechnician) return

    setIsLoading(true)
    try {
      const tasksCollection = collection(db, "tasks")
      const dueDate = taskData.dueDate ? new Date(taskData.dueDate) : new Date()

      const docRef = await addDoc(tasksCollection, {
        ...taskData,
        assignedTo: selectedTechnician.id,
        dueDate: dueDate,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const newTaskWithId: Task = {
        id: docRef.id,
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        dueDate: dueDate,
        locationId: taskData.locationId,
        assignedTo: selectedTechnician.id,
        status: "Pending",
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      setTasks([...tasks, newTaskWithId])

      // Send email notification to the technician
      try {
        const assignedLocation = locations.find((loc) => loc.id === taskData.locationId)
        const locationDetails = assignedLocation
          ? {
              id: assignedLocation.id,
              name: assignedLocation.name,
              city: assignedLocation.city,
              state: assignedLocation.state,
              country: assignedLocation.country,
            }
          : null

        await fetch("/api/send-task-notification", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            technicianName: selectedTechnician.name,
            technicianEmail: selectedTechnician.email,
            taskTitle: taskData.title,
            taskDescription: taskData.description,
            taskPriority: taskData.priority,
            taskDueDate: format(dueDate, "MMMM dd, yyyy"),
            locationDetails: locationDetails,
          }),
        })
      } catch (emailError) {
        console.error("Error sending task notification email:", emailError)
      }

      setIsTaskDialogOpen(false)
      setSelectedTechnician(null)
      setTaskData({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        locationId: "",
      })

      toast({
        title: "Task Assigned",
        description: "The task has been assigned to the technician successfully",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error adding task:", error)
      toast({
        title: "Error",
        description: "Failed to assign task. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddLocation = async () => {
    if (!db) {
      console.error("No database connection available")
      return
    }

    try {
      setIsLoading(true)
      console.log("Adding new location:", newLocation)

      // Add to Firestore
      const locationsCollection = collection(db, "locations")
      const docRef = await addDoc(locationsCollection, {
        ...newLocation,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      console.log("Location added to Firestore with ID:", docRef.id)

      const locationWithId = {
        id: docRef.id,
        ...newLocation,
        createdAt: new Date(),
        updatedAt: new Date(),
      }

      // Update local state
      setLocations((prev) => [...prev, locationWithId])

      // Reset form and close dialog
      setNewLocation({
        name: "",
        address: "",
        city: "",
        state: "",
        zipCode: "",
        country: "",
        contactName: "",
        contactEmail: "",
        contactPhone: "",
      })
      setIsAddDialogOpen(false)

      toast({
        title: "Success",
        description: "Location added successfully",
      })
    } catch (error) {
      console.error("Error adding location:", error)
      toast({
        title: "Error",
        description: "Failed to add location",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditLocation = async () => {
    if (!db || !editLocation) return

    try {
      setIsLoading(true)
      console.log("Updating location:", editLocation)

      // Find the document with the matching id field
      let docId = editLocation._docId

      // If we don't have _docId, try to find it in the map
      if (!docId && editLocation.id) {
        docId = locationDocuments.get(editLocation.id.toString())
      }

      // If we still don't have a document ID, try to query for it
      if (!docId) {
        const locationsCollection = collection(db, "locations")
        const q = query(locationsCollection, where("id", "==", editLocation.id))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          docId = querySnapshot.docs[0].id
        } else {
          throw new Error(`Could not find document with id field: ${editLocation.id}`)
        }
      }

      if (!docId) {
        throw new Error(`Could not determine document ID for location with id: ${editLocation.id}`)
      }

      // Update in Firestore using the correct document ID
      const locationRef = doc(db, "locations", docId)

      // Remove the _docId field before updating
      const { _docId, ...locationData } = editLocation

      await updateDoc(locationRef, {
        ...locationData,
        updatedAt: new Date(),
      })

      // Update local state
      setLocations(
        locations.map((location) =>
          location.id === editLocation.id ? { ...editLocation, updatedAt: new Date() } : location,
        ),
      )

      // Close the dialog
      setIsEditDialogOpen(false)
      setEditLocation(null)

      toast({
        title: "Success",
        description: "Location updated successfully",
      })
    } catch (error) {
      console.error("Error updating location:", error)
      toast({
        title: "Error",
        description: "Failed to update location",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteLocation = async (locationId: string) => {
    if (!db) return

    try {
      setIsLoading(true)
      console.log("Deleting location:", locationId)

      // Find the document with the matching id field
      let docId = locations.find((loc) => loc.id === locationId)?._docId

      // If we don't have _docId, try to find it in the map
      if (!docId) {
        docId = locationDocuments.get(locationId.toString())
      }

      // If we still don't have a document ID, try to query for it
      if (!docId) {
        const locationsCollection = collection(db, "locations")
        const q = query(locationsCollection, where("id", "==", locationId))
        const querySnapshot = await getDocs(q)

        if (!querySnapshot.empty) {
          docId = querySnapshot.docs[0].id
        } else {
          throw new Error(`Could not find document with id field: ${locationId}`)
        }
      }

      if (!docId) {
        throw new Error(`Could not determine document ID for location with id: ${locationId}`)
      }

      // Delete from Firestore using the correct document ID
      const locationRef = doc(db, "locations", docId)
      await deleteDoc(locationRef)

      // Update local state
      setLocations(locations.filter((location) => location.id !== locationId))

      toast({
        title: "Success",
        description: "Location deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting location:", error)
      toast({
        title: "Error",
        description: "Failed to delete location",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleSpecialtyChange = (specialty: string, level: string, forEdit = false) => {
    const updateFunction = forEdit
      ? (prev: any) => {
          if (!prev) return prev
          const specialties = [...(prev.specialties || [])]
          const existingIndex = specialties.findIndex((s) => s.type === specialty)

          if (level === "not-selected") {
            if (existingIndex !== -1) {
              specialties.splice(existingIndex, 1)
            }
          } else {
            if (existingIndex !== -1) {
              specialties[existingIndex] = { type: specialty, level }
            } else {
              specialties.push({ type: specialty, level })
            }
          }

          return {
            ...prev,
            specialties,
          }
        }
      : (prev: any) => {
          const specialties = [...(prev.specialties || [])]
          const existingIndex = specialties.findIndex((s) => s.type === specialty)

          if (level === "not-selected") {
            if (existingIndex !== -1) {
              specialties.splice(existingIndex, 1)
            }
          } else {
            if (existingIndex !== -1) {
              specialties[existingIndex] = { type: specialty, level }
            } else {
              specialties.push({ type: specialty, level })
            }
          }

          return {
            ...prev,
            specialties,
          }
        }

    if (forEdit) {
      setEditTechnician(updateFunction)
    } else {
      setNewTechnician(updateFunction)
    }
  }

  const handleLocationChange = (locationId: string, checked: boolean, forEdit = false) => {
    const updateFunction = (prev: any) => {
      if (!prev) return prev

      let assignedLocations = [...(prev.assignedLocations || [])].filter((id) => id !== "not-assigned")

      if (checked) {
        // Add location if not already included
        if (!assignedLocations.includes(locationId)) {
          assignedLocations.push(locationId)
        }
      } else {
        // Remove location if present
        assignedLocations = assignedLocations.filter((id) => id !== locationId)
      }

      return {
        ...prev,
        assignedLocations: assignedLocations.length ? assignedLocations : ["not-assigned"],
      }
    }

    if (forEdit) {
      setEditTechnician(updateFunction)
    } else {
      setNewTechnician(updateFunction)
    }
  }

  const resetForm = () => {
    setNewTechnician({
      name: "",
      phone: "",
      email: "",
      specialties: Object.keys(TECHNICIAN_SPECIALTIES).map((type) => ({ type, level: "not-selected" })),
      assignedLocations: ["not-assigned"],
      color: "#4FD1C5",
      notes: "",
    })
  }

  const handleCreateTask = async () => {
    // Placeholder function for creating tasks
    console.log("Creating task:", taskData, "for technician:", selectedTechnician)
    setIsTaskDialogOpen(false)
    setSelectedTechnician(null)
    setTaskData({
      title: "",
      description: "",
      priority: "medium",
      dueDate: "",
      locationId: "",
    })
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="locations" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
          <TabsTrigger value="zones">Zones</TabsTrigger>
        </TabsList>

        <TabsContent value="locations">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Locations</h2>
            <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
              <DialogTrigger asChild>
                <Button disabled={isLoading}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Location
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add New Location</DialogTitle>
                  <DialogDescription>Add a new location to your building management system</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Location Name *</Label>
                      <Input
                        id="name"
                        value={newLocation.name}
                        onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, minimum 2 characters</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="country">Country *</Label>
                      <Input
                        id="country"
                        value={newLocation.country}
                        onChange={(e) => setNewLocation({ ...newLocation, country: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, minimum 2 characters</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Address *</Label>
                    <Input
                      id="address"
                      value={newLocation.address}
                      onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">Required, minimum 5 characters</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="city">City *</Label>
                      <Input
                        id="city"
                        value={newLocation.city}
                        onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, minimum 2 characters</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="state">State/Province *</Label>
                      <Input
                        id="state"
                        value={newLocation.state}
                        onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, 2 characters</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="zipCode">Zip/Postal Code *</Label>
                      <Input
                        id="zipCode"
                        value={newLocation.zipCode}
                        onChange={(e) => setNewLocation({ ...newLocation, zipCode: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, format: 12345 or 12345-6789</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="contactName">Contact Name</Label>
                      <Input
                        id="contactName"
                        value={newLocation.contactName}
                        onChange={(e) => setNewLocation({ ...newLocation, contactName: e.target.value })}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Contact Email</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        value={newLocation.contactEmail}
                        onChange={(e) => setNewLocation({ ...newLocation, contactEmail: e.target.value })}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Contact Phone</Label>
                      <Input
                        id="contactPhone"
                        value={newLocation.contactPhone}
                        onChange={(e) => setNewLocation({ ...newLocation, contactPhone: e.target.value })}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)} disabled={isLoading}>
                    Cancel
                  </Button>
                  <Button onClick={handleAddLocation} disabled={isLoading || !newLocation.name}>
                    {isLoading ? "Adding..." : "Add Location"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Manage Locations</CardTitle>
              <CardDescription>View and manage all locations in your building management system</CardDescription>
            </CardHeader>
            <CardContent>
              {locations.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Building className="h-10 w-10 text-muted-foreground mb-2" />
                  <p className="text-lg font-medium">No Locations</p>
                  <p className="text-sm text-muted-foreground">Add your first location to get started</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {locations.map((location) => (
                      <TableRow key={location.id}>
                        <TableCell className="font-medium">{location.name}</TableCell>
                        <TableCell>
                          {[location.city, location.state, location.country].filter(Boolean).join(", ")}
                        </TableCell>
                        <TableCell>{location.contactName}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end space-x-2">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                setEditLocation(location)
                                setIsEditDialogOpen(true)
                              }}
                              disabled={isLoading}
                            >
                              <Edit className="h-4 w-4" />
                              <span className="sr-only">Edit</span>
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="ghost" size="icon" disabled={isLoading}>
                                  <Trash className="h-4 w-4" />
                                  <span className="sr-only">Delete</span>
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete Location</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    Are you sure you want to delete this location? This action cannot be undone.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel disabled={isLoading}>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => handleDeleteLocation(location.id)}
                                    className="bg-red-600 hover:bg-red-700"
                                    disabled={isLoading}
                                  >
                                    {isLoading ? "Deleting..." : "Delete"}
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
                <DialogTitle>Edit Location</DialogTitle>
                <DialogDescription>Update the location details</DialogDescription>
              </DialogHeader>
              {editLocation && (
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Location Name *</Label>
                      <Input
                        id="edit-name"
                        value={editLocation.name}
                        onChange={(e) => setEditLocation({ ...editLocation, name: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, minimum 2 characters</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-country">Country *</Label>
                      <Input
                        id="edit-country"
                        value={editLocation.country}
                        onChange={(e) => setEditLocation({ ...editLocation, country: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, minimum 2 characters</p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-address">Address *</Label>
                    <Input
                      id="edit-address"
                      value={editLocation.address}
                      onChange={(e) => setEditLocation({ ...editLocation, address: e.target.value })}
                      required
                      disabled={isLoading}
                    />
                    <p className="text-xs text-muted-foreground">Required, minimum 5 characters</p>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-city">City *</Label>
                      <Input
                        id="edit-city"
                        value={editLocation.city}
                        onChange={(e) => setEditLocation({ ...editLocation, city: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, minimum 2 characters</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-state">State/Province *</Label>
                      <Input
                        id="edit-state"
                        value={editLocation.state}
                        onChange={(e) => setEditLocation({ ...editLocation, state: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, 2 characters</p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-zipCode">Zip/Postal Code *</Label>
                      <Input
                        id="edit-zipCode"
                        value={editLocation.zipCode}
                        onChange={(e) => setEditLocation({ ...editLocation, zipCode: e.target.value })}
                        required
                        disabled={isLoading}
                      />
                      <p className="text-xs text-muted-foreground">Required, format: 12345 or 12345-6789</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-contactName">Contact Name</Label>
                      <Input
                        id="edit-contactName"
                        value={editLocation.contactName}
                        onChange={(e) => setEditLocation({ ...editLocation, contactName: e.target.value })}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-contactEmail">Contact Email</Label>
                      <Input
                        id="edit-contactEmail"
                        type="email"
                        value={editLocation.contactEmail}
                        onChange={(e) => setEditLocation({ ...editLocation, contactEmail: e.target.value })}
                        disabled={isLoading}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-contactPhone">Contact Phone</Label>
                      <Input
                        id="edit-contactPhone"
                        value={editLocation.contactPhone}
                        onChange={(e) => setEditLocation({ ...editLocation, contactPhone: e.target.value })}
                        disabled={isLoading}
                      />
                    </div>
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditDialogOpen(false)} disabled={isLoading}>
                  Cancel
                </Button>
                <Button onClick={handleEditLocation} disabled={isLoading || !editLocation?.name}>
                  {isLoading ? "Saving..." : "Save Changes"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>

        <TabsContent value="equipment">
          <EquipmentSettings />
        </TabsContent>

        <TabsContent value="technicians">
          <div className="flex justify-between items-center">
            <h2 className="text-2xl font-bold">Technicians</h2>
            <Dialog
              open={isAddDialogOpen}
              onOpenChange={(open) => {
                if (!open) {
                  resetForm()
                }
                setIsAddDialogOpen(open)
              }}
            >
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Technician
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add New Technician</DialogTitle>
                  <DialogDescription>Add a new technician to your team</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        value={newTechnician.name}
                        onChange={(e) => setNewTechnician({ ...newTechnician, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone</Label>
                      <Input
                        id="phone"
                        value={newTechnician.phone}
                        onChange={(e) => setNewTechnician({ ...newTechnician, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={newTechnician.email}
                      onChange={(e) => setNewTechnician({ ...newTechnician, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label>Specialties</Label>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(TECHNICIAN_SPECIALTIES).map(([specialty, levels]) => (
                        <div key={specialty} className="space-y-2">
                          <Label>{specialty}</Label>
                          <Select
                            value={
                              newTechnician.specialties?.find((s) => s.type === specialty)?.level || "not-selected"
                            }
                            onValueChange={(value) => handleSpecialtyChange(specialty, value)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${specialty} level`}>
                                {newTechnician.specialties?.find((s) => s.type === specialty)?.level === "not-selected"
                                  ? "Not Selected"
                                  : newTechnician.specialties?.find((s) => s.type === specialty)?.level}
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not-selected">Not Selected</SelectItem>
                              {levels.map((level) => (
                                <SelectItem key={`${specialty}-${level}`} value={level}>
                                  {level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned Locations</Label>
                    {locations.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto border rounded p-2">
                        {locations.map((location) => (
                          <div key={location.id} className="flex items-center space-x-2 py-1">
                            <Checkbox
                              id={`loc-${location.id}`}
                              checked={newTechnician.assignedLocations?.includes(location.id)}
                              onCheckedChange={(checked) => handleLocationChange(location.id, checked as boolean)}
                            />
                            <Label htmlFor={`loc-${location.id}`} className="text-sm font-normal cursor-pointer">
                              {location.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No locations available. Please add locations first.
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      value={newTechnician.notes}
                      onChange={(e) => setNewTechnician({ ...newTechnician, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
                      resetForm()
                      setIsAddDialogOpen(false)
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddTechnician} disabled={isLoading}>
                    {isLoading ? "Adding..." : "Add Technician"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Manage Technicians</CardTitle>
              <CardDescription>View and manage your team of technicians</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Phone</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Specialties</TableHead>
                    <TableHead>Locations</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {technicians.map((technician) => (
                    <TableRow key={technician.id}>
                      <TableCell className="font-medium">{technician.name}</TableCell>
                      <TableCell>{technician.phone}</TableCell>
                      <TableCell>{technician.email}</TableCell>
                      <TableCell>{technician.specialties.map((s) => `${s.type}: ${s.level}`).join(", ")}</TableCell>
                      <TableCell>
                        {technician.assignedLocations
                          .filter((loc) => loc !== "not-assigned")
                          .map(
                            (locationId) =>
                              locations.find((location) => location.id === locationId)?.name || "Unknown Location",
                          )
                          .join(", ")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              setEditTechnician(technician)
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
                                <AlertDialogTitle>Delete Technician</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Are you sure you want to delete this technician? This action cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleDeleteTechnician(technician.id)}
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
            </CardContent>
          </Card>

          {/* Edit Technician Dialog */}
          {editTechnician && (
            <Dialog
              open={isEditDialogOpen}
              onOpenChange={(open) => {
                if (!open) {
                  setEditTechnician(null)
                }
                setIsEditDialogOpen(open)
              }}
            >
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Edit Technician</DialogTitle>
                  <DialogDescription>Update technician information</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="edit-name">Name</Label>
                      <Input
                        id="edit-name"
                        value={editTechnician.name}
                        onChange={(e) => setEditTechnician({ ...editTechnician, name: e.target.value })}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="edit-phone">Phone</Label>
                      <Input
                        id="edit-phone"
                        value={editTechnician.phone}
                        onChange={(e) => setEditTechnician({ ...editTechnician, phone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-email">Email</Label>
                    <Input
                      id="edit-email"
                      type="email"
                      value={editTechnician.email}
                      onChange={(e) => setEditTechnician({ ...editTechnician, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-4">
                    <Label>
                      Specialties <span className="text-red-500">*</span>
                    </Label>
                    <div className="grid grid-cols-2 gap-4">
                      {Object.entries(TECHNICIAN_SPECIALTIES).map(([specialty, levels]) => (
                        <div key={specialty} className="space-y-2">
                          <Label>{specialty}</Label>
                          <Select
                            value={
                              editTechnician.specialties?.find((s) => s.type === specialty)?.level || "not-selected"
                            }
                            onValueChange={(value) => handleSpecialtyChange(specialty, value, true)}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder={`Select ${specialty} Level`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not-selected">Not Selected</SelectItem>
                              {levels.map((level) => (
                                <SelectItem key={`${specialty}-${level}`} value={level}>
                                  {level}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>
                      Assigned Locations <span className="text-red-500">*</span>
                    </Label>
                    {locations.length > 0 ? (
                      <div className="max-h-40 overflow-y-auto border rounded p-2">
                        {locations.map((location) => (
                          <div key={location.id} className="flex items-center space-x-2 py-1">
                            <Checkbox
                              id={`edit-loc-${location.id}`}
                              checked={editTechnician.assignedLocations?.includes(location.id)}
                              onCheckedChange={(checked) => handleLocationChange(location.id, checked as boolean, true)}
                            />
                            <Label htmlFor={`edit-loc-${location.id}`} className="text-sm font-normal cursor-pointer">
                              {location.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">
                        No locations available. Please add locations first.
                      </div>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-notes">Notes</Label>
                    <Textarea
                      id="edit-notes"
                      value={editTechnician.notes}
                      onChange={(e) => setEditTechnician({ ...editTechnician, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleEditTechnician} disabled={isLoading}>
                    {isLoading ? "Updating..." : "Update Technician"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}

          {/* Add Task Dialog */}
          <Dialog
            open={isTaskDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedTechnician(null)
                setTaskData({
                  title: "",
                  description: "",
                  priority: "medium",
                  dueDate: "",
                  locationId: "",
                })
              }
              setIsTaskDialogOpen(open)
            }}
          >
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Assign Task to {selectedTechnician?.name}</DialogTitle>
                <DialogDescription>Create a new task and notify the technician</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Task Title</Label>
                  <Input
                    id="task-title"
                    value={taskData.title}
                    onChange={(e) => setTaskData({ ...taskData, title: e.target.value })}
                    placeholder="Enter task title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-description">Description</Label>
                  <Textarea
                    id="task-description"
                    value={taskData.description}
                    onChange={(e) => setTaskData({ ...taskData, description: e.target.value })}
                    placeholder="Describe the task in detail"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-priority">Priority</Label>
                    <Select
                      value={taskData.priority}
                      onValueChange={(value) => setTaskData({ ...taskData, priority: value })}
                    >
                      <SelectTrigger id="task-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="low">Low</SelectItem>
                        <SelectItem value="medium">Medium</SelectItem>
                        <SelectItem value="high">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-due-date">Due Date</Label>
                    <Input
                      id="task-due-date"
                      type="date"
                      value={taskData.dueDate}
                      onChange={(e) => setTaskData({ ...taskData, dueDate: e.target.value })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-location">Location</Label>
                  <Select
                    value={taskData.locationId}
                    onValueChange={(value) => setTaskData({ ...taskData, locationId: value })}
                  >
                    <SelectTrigger id="task-location">
                      <SelectValue placeholder="Select location" />
                    </SelectTrigger>
                    <SelectContent>
                      {selectedTechnician?.assignedLocations
                        .filter((loc) => loc !== "not-assigned")
                        .map((locationId) => {
                          const location = locations.find((loc) => loc.id === locationId)
                          return location ? (
                            <SelectItem key={locationId} value={locationId}>
                              {location.name}
                            </SelectItem>
                          ) : null
                        })}
                      {(!selectedTechnician?.assignedLocations ||
                        selectedTechnician.assignedLocations.length === 0 ||
                        (selectedTechnician.assignedLocations.length === 1 &&
                          selectedTechnician.assignedLocations[0] === "not-assigned")) && (
                        <SelectItem value="no-locations" disabled>
                          No locations assigned to this technician
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsTaskDialogOpen(false)
                    setSelectedTechnician(null)
                    setTaskData({
                      title: "",
                      description: "",
                      priority: "medium",
                      dueDate: "",
                      locationId: "",
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddTask}
                  disabled={
                    isLoading ||
                    !taskData.title ||
                    !taskData.locationId ||
                    (!selectedTechnician && !taskData.assignedTo)
                  }
                >
                  {isLoading ? "Creating..." : "Create Task"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </TabsContent>
        <TabsContent value="zones">
          <ZoneSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}
