// components/settings/location-settings-tab.tsx
// Location Settings Tab - CRUD operations for building locations
// Features: Add/edit/delete locations with contact information

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"
import { Edit, Plus, Trash, Building } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc } from "firebase/firestore"

export function LocationSettingsTab() {
  const { db } = useFirebase()
  const { toast } = useToast()
  
  const [locations, setLocations] = useState<any[]>([])
  const [isAddLocationOpen, setIsAddLocationOpen] = useState(false)
  const [isEditLocationOpen, setIsEditLocationOpen] = useState(false)
  const [editLocation, setEditLocation] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [newLocation, setNewLocation] = useState({
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

  useEffect(() => {
    fetchLocations()
  }, [])

  const fetchLocations = async () => {
    if (!db) return
    try {
      const snapshot = await getDocs(collection(db, "locations"))
      const locationData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setLocations(locationData)
    } catch (error) {
      console.error("Error fetching locations:", error)
      toast({
        title: "Error",
        description: "Failed to fetch locations",
        variant: "destructive"
      })
    }
  }

  const handleAddLocation = async () => {
    if (!db) return
    if (!newLocation.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Location name is required",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      await addDoc(collection(db, "locations"), { 
        ...newLocation, 
        createdAt: new Date(),
        updatedAt: new Date()
      })
      
      setNewLocation({ 
        name: "", address: "", city: "", state: "", zipCode: "", 
        country: "", contactName: "", contactEmail: "", contactPhone: "" 
      })
      setIsAddLocationOpen(false)
      await fetchLocations()
      
      toast({ 
        title: "Success", 
        description: "Location added successfully",
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error adding location:", error)
      toast({ 
        title: "Error", 
        description: "Failed to add location", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditLocation = async () => {
    if (!db || !editLocation) return
    if (!editLocation.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Location name is required",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      await updateDoc(doc(db, "locations", editLocation.id), { 
        ...editLocation, 
        updatedAt: new Date() 
      })
      
      setIsEditLocationOpen(false)
      setEditLocation(null)
      await fetchLocations()
      
      toast({ 
        title: "Success", 
        description: "Location updated successfully",
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error updating location:", error)
      toast({ 
        title: "Error", 
        description: "Failed to update location", 
        variant: "destructive" 
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteLocation = async (locationId: string) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "locations", locationId))
      await fetchLocations()
      toast({ 
        title: "Success", 
        description: "Location deleted successfully",
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error deleting location:", error)
      toast({ 
        title: "Error", 
        description: "Failed to delete location", 
        variant: "destructive" 
      })
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Building className="h-5 w-5 text-teal-600" />
            Locations
          </CardTitle>
          <CardDescription>Manage building locations in your Neural BMS system</CardDescription>
        </div>
        <Dialog open={isAddLocationOpen} onOpenChange={setIsAddLocationOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-500 hover:bg-teal-600 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Add Location
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[600px]">
            <DialogHeader>
              <DialogTitle>Add New Location</DialogTitle>
              <DialogDescription>Add a new building location to your BMS system</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Location Name *</Label>
                  <Input
                    id="name"
                    value={newLocation.name}
                    onChange={(e) => setNewLocation({ ...newLocation, name: e.target.value })}
                    placeholder="Building Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country</Label>
                  <Input
                    id="country"
                    value={newLocation.country}
                    onChange={(e) => setNewLocation({ ...newLocation, country: e.target.value })}
                    placeholder="United States"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  value={newLocation.address}
                  onChange={(e) => setNewLocation({ ...newLocation, address: e.target.value })}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input
                    id="city"
                    value={newLocation.city}
                    onChange={(e) => setNewLocation({ ...newLocation, city: e.target.value })}
                    placeholder="New York"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Input
                    id="state"
                    value={newLocation.state}
                    onChange={(e) => setNewLocation({ ...newLocation, state: e.target.value })}
                    placeholder="NY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="zipCode">Zip Code</Label>
                  <Input
                    id="zipCode"
                    value={newLocation.zipCode}
                    onChange={(e) => setNewLocation({ ...newLocation, zipCode: e.target.value })}
                    placeholder="10001"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="contactName">Contact Name</Label>
                  <Input
                    id="contactName"
                    value={newLocation.contactName}
                    onChange={(e) => setNewLocation({ ...newLocation, contactName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    value={newLocation.contactEmail}
                    onChange={(e) => setNewLocation({ ...newLocation, contactEmail: e.target.value })}
                    placeholder="john@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactPhone">Contact Phone</Label>
                  <Input
                    id="contactPhone"
                    value={newLocation.contactPhone}
                    onChange={(e) => setNewLocation({ ...newLocation, contactPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddLocationOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleAddLocation} disabled={loading || !newLocation.name.trim()} className="bg-teal-500 hover:bg-teal-600 text-white">
                {loading ? "Adding..." : "Add Location"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {locations.length === 0 ? (
          <div className="text-center py-8">
            <Building className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No locations</h3>
            <p className="text-slate-500">Get started by adding your first location.</p>
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
                  <TableCell>{location.contactName || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditLocation(location)
                          setIsEditLocationOpen(true)
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <Trash className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Location</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{location.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteLocation(location.id)}
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

      {/* Edit Location Dialog */}
      <Dialog open={isEditLocationOpen} onOpenChange={setIsEditLocationOpen}>
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
                    placeholder="Building Name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-country">Country</Label>
                  <Input
                    id="edit-country"
                    value={editLocation.country || ""}
                    onChange={(e) => setEditLocation({ ...editLocation, country: e.target.value })}
                    placeholder="United States"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="edit-address">Address</Label>
                <Input
                  id="edit-address"
                  value={editLocation.address || ""}
                  onChange={(e) => setEditLocation({ ...editLocation, address: e.target.value })}
                  placeholder="123 Main Street"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-city">City</Label>
                  <Input
                    id="edit-city"
                    value={editLocation.city || ""}
                    onChange={(e) => setEditLocation({ ...editLocation, city: e.target.value })}
                    placeholder="New York"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-state">State</Label>
                  <Input
                    id="edit-state"
                    value={editLocation.state || ""}
                    onChange={(e) => setEditLocation({ ...editLocation, state: e.target.value })}
                    placeholder="NY"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-zipCode">Zip Code</Label>
                  <Input
                    id="edit-zipCode"
                    value={editLocation.zipCode || ""}
                    onChange={(e) => setEditLocation({ ...editLocation, zipCode: e.target.value })}
                    placeholder="10001"
                  />
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="edit-contactName">Contact Name</Label>
                  <Input
                    id="edit-contactName"
                    value={editLocation.contactName || ""}
                    onChange={(e) => setEditLocation({ ...editLocation, contactName: e.target.value })}
                    placeholder="John Doe"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contactEmail">Contact Email</Label>
                  <Input
                    id="edit-contactEmail"
                    type="email"
                    value={editLocation.contactEmail || ""}
                    onChange={(e) => setEditLocation({ ...editLocation, contactEmail: e.target.value })}
                    placeholder="john@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="edit-contactPhone">Contact Phone</Label>
                  <Input
                    id="edit-contactPhone"
                    value={editLocation.contactPhone || ""}
                    onChange={(e) => setEditLocation({ ...editLocation, contactPhone: e.target.value })}
                    placeholder="(555) 123-4567"
                  />
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditLocationOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditLocation} disabled={loading || !editLocation?.name?.trim()} className="bg-teal-500 hover:bg-teal-600 text-white">
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
