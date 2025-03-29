"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Plus, Trash, Wrench } from "lucide-react"
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
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from "firebase/firestore"

const COLLECTION_NAME = "automatabmstechnicians"

export function TechnicianSettings() {
  const { db } = useFirebase()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [technicians, setTechnicians] = useState<Technician[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false)
  const [editTechnician, setEditTechnician] = useState<Technician | null>(null)
  const [newTechnician, setNewTechnician] = useState<Partial<Technician>>({
    name: "",
    phone: "",
    email: "",
    specialties: Object.keys(TECHNICIAN_SPECIALTIES).map(type => ({ type, level: "not-selected" })),
    assignedLocations: ["not-assigned"],
    color: "#4FD1C5",
    notes: "",
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
        specialties: newTechnician.specialties?.filter(s => s.level !== "unselected") || [],
        assignedLocations: newTechnician.assignedLocations?.filter(l => l !== "unassigned") || []
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
        specialties: Object.keys(TECHNICIAN_SPECIALTIES).map(type => ({ type, level: "not-selected" })),
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

    try {
      const validationResult = validateTechnician(editTechnician)
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

  const handleSpecialtyChange = (specialty: string, level: string) => {
    setNewTechnician((prev) => {
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
    })
  }

  const resetForm = () => {
    setNewTechnician({
      name: "",
      phone: "",
      email: "",
      specialties: [],
      assignedLocations: [],
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
                <Label>Specialties <span className="text-red-500">*</span></Label>
                <div className="grid grid-cols-2 gap-4">
                  {Object.entries(TECHNICIAN_SPECIALTIES).map(([specialty, levels]) => (
                    <div key={specialty} className="space-y-2">
                      <Label>{specialty}</Label>
                      <Select
                        value={newTechnician.specialties?.find(s => s.type === specialty)?.level || "not-selected"}
                        onValueChange={(value) => handleSpecialtyChange(specialty, value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={`Select ${specialty} level`}>
                            {newTechnician.specialties?.find(s => s.type === specialty)?.level === "not-selected" 
                              ? "Not Selected" 
                              : newTechnician.specialties?.find(s => s.type === specialty)?.level}
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
                <Label>Assigned Location <span className="text-red-500">*</span></Label>
                {locations.length > 0 ? (
                  <Select
                    value={newTechnician.assignedLocations?.[0] || "not-assigned"}
                    onValueChange={(value) =>
                      setNewTechnician({
                        ...newTechnician,
                        assignedLocations: value === "not-assigned" ? [] : [value],
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a location">
                        {newTechnician.assignedLocations?.[0] === "not-assigned" 
                          ? "Select a location"
                          : locations.find(l => l.id === newTechnician.assignedLocations?.[0])?.name || "Select a location"}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="not-assigned">Select a location</SelectItem>
                      {locations.map((location) => (
                        <SelectItem key={location.id} value={location.id}>
                          {location.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Select value="no-locations">
                    <SelectTrigger>
                      <SelectValue>No locations available</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no-locations">No locations available</SelectItem>
                    </SelectContent>
                  </Select>
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
              <Button variant="outline" onClick={() => {
                resetForm()
                setIsAddDialogOpen(false)
              }}>
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
                    <TableCell>
                      {technician.specialties
                        .map((s) => `${s.type}: ${s.level}`)
                        .join(", ")}
                    </TableCell>
                    <TableCell>
                      {technician.assignedLocations
                        .map(
                          (locationId) =>
                            locations.find((location) => location.id === locationId)?.name ||
                            "Unknown Location",
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
                                Are you sure you want to delete this technician? This action cannot be
                                undone.
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
    </div>
  )
}
