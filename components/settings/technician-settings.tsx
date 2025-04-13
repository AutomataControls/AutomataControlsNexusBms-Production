"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar, Edit, Plus, Trash, Wrench } from "lucide-react"
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
import { validateTechnician, TECHNICIAN_SPECIALTIES, type Technician } from "@/lib/validation"
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc, getDoc } from "firebase/firestore"
import { Checkbox } from "@/components/ui/checkbox"

const COLLECTION_NAME = "automatabmstechnicians"

export function TechnicianSettings() {
  const { db } = useFirebase()
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

  // Fetch technicians
  useEffect(() => {
    const fetchTechnicians = async () => {
      if (!db) return

      try {
        const techniciansCollection = collection(db, COLLECTION_NAME)
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

  const handleAddTechnician = async () => {
    if (!db) return

    setIsLoading(true)
    try {
      // Filter out unselected specialties and unassigned locations before validation
      const technicianData = {
        ...newTechnician,
        specialties: newTechnician.specialties?.filter((s) => s.level !== "unselected") || [],
        assignedLocations: newTechnician.assignedLocations?.filter((l) => l !== "unassigned") || [],
      }

      const validationResult = validateTechnician(technicianData)
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

      const techniciansCollection = collection(db, COLLECTION_NAME)
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
        specialties: Object.keys(TECHNICIAN_SPECIALTIES).map((type) => ({ type, level: "not-selected" })),
        assignedLocations: ["not-assigned"],
        color: "#4FD1C5",
        notes: "",
      })

      setIsAddDialogOpen(false)
      toast({
        title: "Success",
        description: "Technician added successfully",
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
      // Ensure we have valid data
      const technicianData = {
        ...editTechnician,
        specialties: editTechnician.specialties?.filter((s) => s.level !== "not-selected") || [],
        assignedLocations: editTechnician.assignedLocations?.filter((l) => l !== "not-assigned") || [],
      }

      const validationResult = validateTechnician(technicianData)
      if (!validationResult.success) {
        validationResult.errors.forEach((error) => {
          toast({
            title: "Validation Error",
            description: error.message,
            variant: "destructive",
          })
        })
        setIsLoading(false)
        return
      }

      const technicianDoc = doc(db, COLLECTION_NAME, editTechnician.id)
      await updateDoc(technicianDoc, {
        ...validationResult.data,
        updatedAt: new Date(),
      })

      setTechnicians(
        technicians.map((tech) =>
          tech.id === editTechnician.id ? { ...editTechnician, updatedAt: new Date() } : tech,
        ),
      )

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
      const technicianDoc = doc(db, COLLECTION_NAME, technicianId)
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

  const handleCreateTask = async () => {
    if (!db || !selectedTechnician) return

    setIsLoading(true)
    try {
      // Validate task data
      if (!taskData.title || !taskData.description || !taskData.dueDate || !taskData.locationId) {
        toast({
          title: "Validation Error",
          description: "Please fill in all required fields",
          variant: "destructive",
        })
        setIsLoading(false)
        return
      }

      // Create task in Firestore
      const tasksCollection = collection(db, "tasks")
      const taskRef = await addDoc(tasksCollection, {
        title: taskData.title,
        description: taskData.description,
        priority: taskData.priority,
        dueDate: taskData.dueDate,
        locationId: taskData.locationId,
        technicianId: selectedTechnician.id,
        technicianName: selectedTechnician.name,
        status: "assigned",
        createdAt: new Date(),
      })

      // Get location details
      const locationDoc = await getDoc(doc(db, "locations", taskData.locationId))
      const locationData = locationDoc.exists() ? locationDoc.data() : null

      // Send email to technician
      await fetch("/api/send-task-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          taskId: taskRef.id,
          taskTitle: taskData.title,
          taskDescription: taskData.description,
          taskPriority: taskData.priority,
          taskDueDate: taskData.dueDate,
          locationId: taskData.locationId,
          locationName: locationData?.name || "Unknown Location",
          recipients: [selectedTechnician.email],
          technicianName: selectedTechnician.name,
        }),
      })

      // If location has a contact email, send notification to customer
      if (locationData?.contactEmail) {
        await fetch("/api/send-customer-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            alarmType: `Task: ${taskData.title}`,
            details: taskData.description,
            locationId: taskData.locationId,
            locationName: locationData.name,
            severity: taskData.priority === "high" ? "critical" : taskData.priority === "medium" ? "warning" : "info",
            contactEmail: locationData.contactEmail,
            assignedTechs: selectedTechnician.name,
          }),
        })
      }

      toast({
        title: "Success",
        description: "Task created and assigned successfully",
        className: "bg-teal-50 border-teal-200",
      })

      // Reset form and close dialog
      setTaskData({
        title: "",
        description: "",
        priority: "medium",
        dueDate: "",
        locationId: "",
      })
      setIsTaskDialogOpen(false)
    } catch (error) {
      console.error("Error creating task:", error)
      toast({
        title: "Error",
        description: "Failed to create task. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
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

  return (
    <div className="space-y-6">
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
                <Label>
                  Specialties <span className="text-red-500">*</span>
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(TECHNICIAN_SPECIALTIES).map(([specialty, levels]) => (
                    <div key={specialty} className="space-y-2">
                      <Label>{specialty}</Label>
                      <Select
                        value={newTechnician.specialties?.find((s) => s.type === specialty)?.level || "not-selected"}
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
                <Label>
                  Assigned Locations <span className="text-red-500">*</span>
                </Label>
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

      <Card>
        <CardHeader>
          <CardTitle>Manage Technicians</CardTitle>
          <CardDescription>View and manage your team of technicians</CardDescription>
        </CardHeader>
        <CardContent>
          {technicians.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <Wrench className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-lg font-medium">No Technicians</p>
              <p className="text-sm text-muted-foreground">Add your first technician to get started</p>
            </div>
          ) : (
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
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedTechnician(technician)
                            setTaskData({
                              ...taskData,
                              locationId:
                                technician.assignedLocations &&
                                technician.assignedLocations.length > 0 &&
                                technician.assignedLocations[0] !== "not-assigned"
                                  ? technician.assignedLocations[0]
                                  : "",
                            })
                            setIsTaskDialogOpen(true)
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
          )}
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
                        value={editTechnician.specialties?.find((s) => s.type === specialty)?.level || "not-selected"}
                        onValueChange={(value) => handleSpecialtyChange(specialty, value, true)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${specialty} level`}>
                            {editTechnician.specialties?.find((s) => s.type === specialty)?.level === "not-selected"
                              ? "Not Selected"
                              : editTechnician.specialties?.find((s) => s.type === specialty)?.level}
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
            <Button variant="outline" onClick={() => setIsTaskDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreateTask}
              disabled={isLoading || !taskData.locationId || taskData.locationId === "no-locations"}
            >
              {isLoading ? "Creating..." : "Create Task"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
