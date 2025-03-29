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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
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
import { EquipmentSettings } from "./equipment-settings"
import { locationSchema, validateTechnician, validateTask, TECHNICIAN_SPECIALTIES, type Technician, type Task } from "@/lib/validation"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"

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
        const technicianData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
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
        const taskData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
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
      const validationResult = validateTechnician(newTechnician)
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

      const techniciansCollection = collection(db, "technicians")
      const docRef = await addDoc(techniciansCollection, {
        ...validationResult.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      setTechnicians([
        ...technicians,
        {
          id: docRef.id,
          ...validationResult.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Technician,
      ])

      setNewTechnician({
        name: "",
        phone: "",
        email: "",
        specialties: [],
        assignedLocations: [],
        color: "#4FD1C5",
        notes: "",
      })

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

  const handleAddTask = async () => {
    if (!db) return

    setIsLoading(true)
    try {
      const validationResult = validateTask(newTask)
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

      const tasksCollection = collection(db, "tasks")
      const docRef = await addDoc(tasksCollection, {
        ...validationResult.data,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      setTasks([
        ...tasks,
        {
          id: docRef.id,
          ...validationResult.data,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Task,
      ])

      setNewTask({
        title: "",
        description: "",
        locationId: "",
        assignedTo: "",
        status: "Pending",
        priority: "Medium",
        dueDate: new Date(),
      })

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
      setLocations(locations.map((location) =>
        location.id === editLocation.id 
          ? { ...editLocation, updatedAt: new Date() } 
          : location
      ))

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

  return (
    <div className="space-y-6">
      <Tabs defaultValue="locations" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="locations">Locations</TabsTrigger>
          <TabsTrigger value="equipment">Equipment</TabsTrigger>
          <TabsTrigger value="technicians">Technicians</TabsTrigger>
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
                            value={newTechnician.specialties?.find(s => s.type === specialty)?.level || "not-selected"}
                            onValueChange={(value) => {
                              const updatedSpecialties = newTechnician.specialties?.filter(s => s.type !== specialty) || [];
                              if (value !== "not-selected") {
                                updatedSpecialties.push({ type: specialty, level: value });
                              }
                              setNewTechnician({ ...newTechnician, specialties: updatedSpecialties });
                            }}
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
                    <Select
                      value={newTechnician.assignedLocations?.[0] || "not-assigned"}
                      onValueChange={(value) => {
                        setNewTechnician({ 
                          ...newTechnician, 
                          assignedLocations: value !== "not-assigned" ? [value] : [] 
                        });
                      }}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select location" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="not-assigned">None</SelectItem>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                      });
                      setIsAddTechnicianDialogOpen(false);
                    }}
                  >
              Cancel
            </Button>
                  <Button 
                    onClick={handleAddTechnician}
                    disabled={isLoading}
                  >
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
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: technician.color }}
                              />
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
                                  setEditLocation(technician)
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
                    <Button>
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
                            <div className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
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
                            `}>
                              {task.status}
                            </div>
                          </TableCell>
                          <TableCell>
                            {new Date(task.dueDate).toLocaleDateString()}
                          </TableCell>
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
        </TabsContent>
      </Tabs>
    </div>
  )
}

