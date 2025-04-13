"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Building, Calendar, Edit, Plus, Trash } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ZoneSettings } from "@/components/settings/zone-settings"
import { EquipmentSettings } from "./equipment-settings"
import { validateTechnician, validateTask, TECHNICIAN_SPECIALTIES, type Technician, type Task } from "@/lib/validation"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { Checkbox } from "@/components/ui/checkbox"
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

export function LocationSettings() {
  const { config, updateConfig, db } = useFirebase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [locations, setLocations] = useState<any[]>([])
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [tasks, setTasks] = useState<Task[]>([])
  const [newTechnician, setNewTechnician] = useState<Partial<Technician>>({
    name: "",
    phone: "",
    email: "",
    specialties: [],
    assignedLocations: [],
    color: "#4FD1C5",
    notes: "",
  })
  const [editTechnician, setEditTechnician] = useState<Technician | null>(null)
  const [newTask, setNewTask] = useState<Partial<Task>>({
    title: "",
    description: "",
    locationId: "",
    assignedTo: "",
    status: "Pending",
    priority: "Medium",
    dueDate: new Date(),
  })
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false)
  const [isAddTechnicianDialogOpen, setIsAddTechnicianDialogOpen] = useState<boolean>(false)
  const [isEditTechnicianDialogOpen, setIsEditTechnicianDialogOpen] = useState<boolean>(false)
  const [isAddTaskDialogOpen, setIsAddTaskDialogOpen] = useState<boolean>(false)
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
  const [selectedTechnician, setSelectedTechnician] = useState<Technician | null>(null)

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

  // Fetch technicians
  useEffect(() => {
    const fetchTechnicians = async () => {
      if (!db) return

      try {
        const techniciansCollection = collection(db, "technicians")
        const snapshot = await getDocs(techniciansCollection)
        const technicianData: Technician[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name || "",
          email: doc.data().email || "",
          phone: doc.data().phone || "",
          color: doc.data().color || "#4FD1C5",
          specialties: doc.data().specialties || [],
          assignedLocations: doc.data().assignedLocations || [],
          notes: doc.data().notes,
          createdAt: doc.data().createdAt,
          updatedAt: doc.data().updatedAt,
        }))
        setTechnicians(technicianData)
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

      const validationResult = validateTechnician(technicianData)
      if (!validationResult.success) {
        const errors = validationResult.errors || []
        errors.forEach((error) => {
          toast({
            title: "Validation Error",
            description: error.message,
            variant: "destructive",
          })
        })
        setIsLoading(false)
        return
      }

      const techniciansCollection = collection(db, "technicians")
      const docRef = await addDoc(techniciansCollection, {
        ...validationResult.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const newTechnicianWithId = {
        id: docRef.id,
        ...validationResult.data,
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
    if (!db || !editTechnician) return

    setIsLoading(true)
    try {
      // Filter out any empty arrays
      const technicianData = {
        ...editTechnician,
        specialties: editTechnician.specialties?.filter((s) => s.type && s.level) || [],
        assignedLocations: editTechnician.assignedLocations?.filter((loc) => loc) || [],
      }

      const validationResult = validateTechnician(technicianData)
      if (!validationResult.success) {
        const errors = validationResult.errors || []
        errors.forEach((error) => {
          toast({
            title: "Validation Error",
            description: error.message,
            variant: "destructive",
          })
        })
        setIsLoading(false)
        return
      }

      // Find the original technician to compare location changes
      const originalTechnician = technicians.find((tech) => tech.id === editTechnician.id)
      const hasLocationChanges =
        originalTechnician &&
        JSON.stringify(originalTechnician.assignedLocations.sort()) !==
          JSON.stringify(technicianData.assignedLocations.sort())

      const technicianRef = doc(db, "technicians", editTechnician.id)
      await updateDoc(technicianRef, {
        ...validationResult.data,
        updatedAt: new Date(),
      })

      const updatedTechnician = {
        ...editTechnician,
        ...validationResult.data,
        updatedAt: new Date(),
      }

      setTechnicians(technicians.map((tech) => (tech.id === editTechnician.id ? updatedTechnician : tech)))

      // Send email notification if locations have changed
      if (hasLocationChanges && updatedTechnician.assignedLocations && updatedTechnician.assignedLocations.length > 0) {
        // Get location details for each assigned location
        const assignedLocationDetails = updatedTechnician.assignedLocations
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
                technicianName: updatedTechnician.name,
                technicianEmail: updatedTechnician.email,
                assignedLocations: assignedLocationDetails,
                action: "updated",
              }),
            })
          } catch (emailError) {
            console.error("Error sending location assignment update email:", emailError)
          }
        }
      }

      setEditTechnician(null)
      setIsEditTechnicianDialogOpen(false)
      toast({
        title: "Technician Updated",
        description: "The technician has been updated successfully",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error updating technician:", error)
      toast({
        title: "Error",
        description: "Failed to update technician. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddTask = async () => {
    if (!db) return

    setIsLoading(true)
    try {
      const validationResult = validateTask(newTask)
      if (!validationResult.success) {
        const errors = validationResult.errors || []
        errors.forEach((error) => {
          toast({
            title: "Validation Error",
            description: error.message,
            variant: "destructive",
          })
        })
        setIsLoading(false)
        return
      }

      const tasksCollection = collection(db, "tasks")
      const docRef = await addDoc(tasksCollection, {
        ...validationResult.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const newTaskWithId = {
        id: docRef.id,
        ...validationResult.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Task

      setTasks([...tasks, newTaskWithId])

      // Get assigned technician details
      const assignedTechnician = technicians.find((tech) => tech.id === newTask.assignedTo)

      // Get location details
      const locationDoc = await getDoc(doc(db, "locations", newTask.locationId || ""))
      const locationData = locationDoc.exists() ? locationDoc.data() : null

      // Send email notification to technician only
      if (assignedTechnician?.email) {
        await fetch("/api/send-task-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            taskId: docRef.id,
            taskTitle: newTask.title,
            taskDescription: newTask.description,
            taskPriority: newTask.priority,
            taskDueDate: newTask.dueDate,
            locationId: newTask.locationId,
            locationName: locationData?.name || "Unknown Location",
            recipients: [assignedTechnician.email],
            technicianName: assignedTechnician.name,
          }),
        })
      }

      setNewTask({
        title: "",
        description: "",
        locationId: "",
        assignedTo: "",
        status: "Pending",
        priority: "Medium",
        dueDate: new Date(),
      })

      setIsAddTaskDialogOpen(false)
      toast({
        title: "Task Added",
        description: "The task has been added successfully",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error adding task:", error)
      toast({
        title: "Error",
        description: "Failed to add task. Please try again.",
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
        title: "Technician Deleted",
        description: "The technician has been deleted successfully",
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

      // Update in Firestore
      const locationRef = doc(db, "locations", editLocation.id)
      await updateDoc(locationRef, {
        ...editLocation,
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

      // Delete from Firestore
      const locationRef = doc(db, "locations", locationId)
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

  const handleLocationChange = (locationId: string, checked: boolean, forEdit = false) => {
    const updateFunction = (prev: any) => {
      if (!prev) return prev

      let assignedLocations = [...(prev.assignedLocations || [])]

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
        assignedLocations,
      }
    }

    if (forEdit) {
      setEditTechnician(updateFunction)
    } else {
      setNewTechnician(updateFunction)
    }
  }

  const handleSpecialtyChange = (specialty: string, level: string, forEdit = false) => {
    const updateFunction = (prev: any) => {
      if (!prev) return prev

      const specialties = [...(prev.specialties || [])]
      const existingIndex = specialties.findIndex((s) => s.type === specialty)

      if (level === "not-selected") {
        // Remove the specialty if it exists
        if (existingIndex !== -1) {
          specialties.splice(existingIndex, 1)
        }
      } else {
        // Update or add the specialty
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
            <Dialog open={isAddTechnicianDialogOpen} onOpenChange={setIsAddTechnicianDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setIsAddTechnicianDialogOpen(true)}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Technician
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[600px]">
                <DialogHeader>
                  <DialogTitle>Add New Technician</DialogTitle>
                  <DialogDescription>Add a new technician to your building management system</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Name</Label>
                      <Input
                        id="name"
                        placeholder="John Doe"
                        value={newTechnician.name}
                        onChange={(e) => setNewTechnician({ ...newTechnician, name: e.target.value })}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Phone Number</Label>
                      <Input
                        id="phone"
                        placeholder="+1234567890"
                        value={newTechnician.phone}
                        onChange={(e) => setNewTechnician({ ...newTechnician, phone: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="john@example.com"
                      value={newTechnician.email}
                      onChange={(e) => setNewTechnician({ ...newTechnician, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
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
                              <SelectValue placeholder={`Select ${specialty} Level`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="not-selected">None</SelectItem>
                              {levels.map((level) => (
                                <SelectItem key={level} value={level}>
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="color">Color</Label>
                    <Input
                      id="color"
                      type="color"
                      className="h-10 px-3 py-2"
                      value={newTechnician.color}
                      onChange={(e) => setNewTechnician({ ...newTechnician, color: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Notes</Label>
                    <Textarea
                      id="notes"
                      placeholder="Any additional notes about the technician..."
                      className="min-h-[100px]"
                      value={newTechnician.notes}
                      onChange={(e) => setNewTechnician({ ...newTechnician, notes: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => {
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
                    }}
                  >
                    Cancel
                  </Button>
                  <Button onClick={handleAddTechnician} disabled={isLoading}>
                    Add Technician
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="mt-6">
            <CardHeader>
              <CardTitle>Manage Technicians</CardTitle>
              <CardDescription>View and manage all technicians in your building management system</CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="technicians" className="w-full">
                <TabsList>
                  <TabsTrigger value="technicians">Technicians</TabsTrigger>
                  <TabsTrigger value="tasks">Tasks</TabsTrigger>
                </TabsList>

                <TabsContent value="technicians">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Specialties</TableHead>
                        <TableHead>Locations</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {technicians.map((technician) => (
                        <TableRow key={technician.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <div className="w-3 h-3 rounded-full" style={{ backgroundColor: technician.color }} />
                              {technician.name}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {technician.specialties.map((specialty, index) => (
                                <span key={index} className="text-sm">
                                  {specialty.type} - {specialty.level}
                                </span>
                              ))}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {technician.assignedLocations.map((locationId) => {
                                const location = locations.find((loc) => loc.id === locationId)
                                return (
                                  <span key={locationId} className="text-sm">
                                    {location?.name || "Unknown Location"}
                                  </span>
                                )
                              })}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              <span className="text-sm">{technician.phone}</span>
                              <span className="text-sm">{technician.email}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setEditTechnician(technician)
                                  setIsEditTechnicianDialogOpen(true)
                                }}
                              >
                                <Edit className="h-4 w-4" />
                                <span className="sr-only">Edit</span>
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  setSelectedTechnician(technician)
                                  setIsAddTaskDialogOpen(true)
                                }}
                              >
                                <Calendar className="h-4 w-4" />
                                <span className="sr-only">Add Task</span>
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
                                      onClick={() => handleDeleteTechnician(technician.id!)}
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
                </TabsContent>

                <TabsContent value="tasks">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-medium">Tasks</h3>
                    <Button onClick={() => setIsAddTaskDialogOpen(true)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add Task
                    </Button>
                  </div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Title</TableHead>
                        <TableHead>Assigned To</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Due Date</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task) => (
                        <TableRow key={task.id}>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{task.title}</span>
                              <span className="text-sm text-muted-foreground">{task.description}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            {technicians.find((tech) => tech.id === task.assignedTo)?.name || "Unassigned"}
                          </TableCell>
                          <TableCell>
                            {locations.find((loc) => loc.id === task.locationId)?.name || "Unknown Location"}
                          </TableCell>
                          <TableCell>
                            <div
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                              ${
                                task.status === "Completed"
                                  ? "bg-green-100 text-green-800"
                                  : task.status === "In Progress"
                                    ? "bg-blue-100 text-blue-800"
                                    : task.status === "Delayed"
                                      ? "bg-yellow-100 text-yellow-800"
                                      : task.status === "Cancelled"
                                        ? "bg-red-100 text-red-800"
                                        : "bg-gray-100 text-gray-800"
                              }
                            `}
                            >
                              {task.status}
                            </div>
                          </TableCell>
                          <TableCell>{new Date(task.dueDate).toLocaleDateString()}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end space-x-2">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => {
                                  // Handle edit
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
                                    <AlertDialogTitle>Delete Task</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      Are you sure you want to delete this task? This action cannot be undone.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction
                                      onClick={() => handleDeleteTask(task.id!)}
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Edit Technician Dialog */}
          <Dialog open={isEditTechnicianDialogOpen} onOpenChange={setIsEditTechnicianDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Edit Technician</DialogTitle>
                <DialogDescription>Update technician information</DialogDescription>
              </DialogHeader>
              {editTechnician && (
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
                  <div className="space-y-2">
                    <Label>Specialties</Label>
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
                              <SelectItem value="not-selected">None</SelectItem>
                              {levels.map((level) => (
                                <SelectItem key={level} value={level}>
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
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="edit-color">Color</Label>
                    <Input
                      id="edit-color"
                      type="color"
                      className="h-10 px-3 py-2"
                      value={editTechnician.color}
                      onChange={(e) => setEditTechnician({ ...editTechnician, color: e.target.value })}
                    />
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
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsEditTechnicianDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleEditTechnician} disabled={isLoading}>
                  {isLoading ? "Updating..." : "Update Technician"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Add Task Dialog */}
          <Dialog open={isAddTaskDialogOpen} onOpenChange={setIsAddTaskDialogOpen}>
            <DialogContent className="sm:max-w-[600px]">
              <DialogHeader>
                <DialogTitle>Add New Task</DialogTitle>
                <DialogDescription>
                  {selectedTechnician
                    ? `Create a task for ${selectedTechnician.name}`
                    : "Create a new task and assign it to a technician"}
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="task-title">Task Title</Label>
                  <Input
                    id="task-title"
                    value={newTask.title}
                    onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
                    placeholder="Enter task title"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-description">Description</Label>
                  <Textarea
                    id="task-description"
                    value={newTask.description}
                    onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
                    placeholder="Describe the task in detail"
                    rows={4}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="task-priority">Priority</Label>
                    <Select
                      value={newTask.priority}
                      onValueChange={(value) => setNewTask({ ...newTask, priority: value })}
                    >
                      <SelectTrigger id="task-priority">
                        <SelectValue placeholder="Select priority" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Low">Low</SelectItem>
                        <SelectItem value="Medium">Medium</SelectItem>
                        <SelectItem value="High">High</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="task-due-date">Due Date</Label>
                    <Input
                      id="task-due-date"
                      type="date"
                      value={
                        newTask.dueDate instanceof Date
                          ? newTask.dueDate.toISOString().split("T")[0]
                          : typeof newTask.dueDate === "string"
                            ? newTask.dueDate
                            : new Date().toISOString().split("T")[0]
                      }
                      onChange={(e) => setNewTask({ ...newTask, dueDate: new Date(e.target.value) })}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="task-location">Location</Label>
                  <Select
                    value={newTask.locationId}
                    onValueChange={(value) => setNewTask({ ...newTask, locationId: value })}
                  >
                    <SelectTrigger id="task-location">
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
                {!selectedTechnician && (
                  <div className="space-y-2">
                    <Label htmlFor="task-technician">Assign To</Label>
                    <Select
                      value={newTask.assignedTo}
                      onValueChange={(value) => setNewTask({ ...newTask, assignedTo: value })}
                    >
                      <SelectTrigger id="task-technician">
                        <SelectValue placeholder="Select technician" />
                      </SelectTrigger>
                      <SelectContent>
                        {technicians.map((tech) => (
                          <SelectItem key={tech.id} value={tech.id}>
                            {tech.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddTaskDialogOpen(false)
                    setSelectedTechnician(null)
                    setNewTask({
                      title: "",
                      description: "",
                      locationId: "",
                      assignedTo: "",
                      status: "Pending",
                      priority: "Medium",
                      dueDate: new Date(),
                    })
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleAddTask}
                  disabled={
                    isLoading || !newTask.title || !newTask.locationId || (!selectedTechnician && !newTask.assignedTo)
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
