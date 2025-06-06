// components/settings/user-settings-tab.tsx
// User Settings Tab - User management with role assignment and location access
// Features: Add/edit/delete users, assign roles (user, admin, devops), assign locations

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
import { Checkbox } from "@/components/ui/checkbox"
import { Badge } from "@/components/ui/badge"
import { Edit, Plus, Trash, Users, MapPin } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore"
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"

export function UserSettingsTab() {
  const { db } = useFirebase()
  const { user } = useAuth()
  const { toast } = useToast()
  const auth = getAuth()
  
  const [users, setUsers] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [isAddUserOpen, setIsAddUserOpen] = useState(false)
  const [isEditUserOpen, setIsEditUserOpen] = useState(false)
  const [editUser, setEditUser] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [newUser, setNewUser] = useState({
    email: "",
    password: "",
    name: "",
    roles: ["user"],
    assignedLocations: [],
  })

  useEffect(() => {
    fetchUsers()
    fetchLocations()
  }, [])

  const fetchUsers = async () => {
    if (!db) return
    try {
      const snapshot = await getDocs(collection(db, "users"))
      const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setUsers(userData)
    } catch (error) {
      console.error("Error fetching users:", error)
      toast({
        title: "Error",
        description: "Failed to fetch users",
        variant: "destructive"
      })
    }
  }

  const fetchLocations = async () => {
    if (!db) return
    try {
      const snapshot = await getDocs(collection(db, "locations"))
      const locationData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }))
      setLocations(locationData)
    } catch (error) {
      console.error("Error fetching locations:", error)
    }
  }

  const handleAddUser = async () => {
    if (!db || !auth) return
    if (!newUser.email.trim() || !newUser.password.trim() || !newUser.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Email, password, and name are required",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      
      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, newUser.email, newUser.password)
      const firebaseUser = userCredential.user

      // Add user data to Firestore
      await setDoc(doc(db, "users", firebaseUser.uid), {
        email: newUser.email,
        name: newUser.name,
        roles: newUser.roles,
        assignedLocations: newUser.assignedLocations,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      setNewUser({
        email: "",
        password: "",
        name: "",
        roles: ["user"],
        assignedLocations: [],
      })
      setIsAddUserOpen(false)
      await fetchUsers()
      
      toast({
        title: "Success",
        description: "User created successfully",
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error: any) {
      console.error("Error adding user:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to create user",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleEditUser = async () => {
    if (!db || !editUser) return
    if (!editUser.name.trim()) {
      toast({
        title: "Validation Error",
        description: "Name is required",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      await updateDoc(doc(db, "users", editUser.id), {
        name: editUser.name,
        roles: editUser.roles,
        assignedLocations: editUser.assignedLocations || [],
        updatedAt: new Date(),
      })

      setIsEditUserOpen(false)
      setEditUser(null)
      await fetchUsers()
      
      toast({
        title: "Success",
        description: "User updated successfully",
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error updating user:", error)
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "users", userId))
      await fetchUsers()
      toast({
        title: "Success",
        description: "User deleted successfully",
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive"
      })
    }
  }

  const toggleRole = (userObj: any, role: string) => {
    const updatedRoles = userObj.roles.includes(role)
      ? userObj.roles.filter((r: string) => r !== role)
      : [...userObj.roles, role]
    return { ...userObj, roles: updatedRoles }
  }

  const toggleLocation = (userObj: any, locationId: string) => {
    const assignedLocations = userObj.assignedLocations || []
    const updatedLocations = assignedLocations.includes(locationId)
      ? assignedLocations.filter((id: string) => id !== locationId)
      : [...assignedLocations, locationId]
    return { ...userObj, assignedLocations: updatedLocations }
  }

  const getLocationName = (locationId: string) => {
    const location = locations.find((loc) => loc.id === locationId)
    return location ? location.name : "Unknown Location"
  }

  const getRoleBadgeClass = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 border-red-200"
      case "devops":
        return "bg-teal-100 text-teal-800 border-teal-200"
      case "operator":
        return "bg-amber-100 text-amber-800 border-amber-200"
      case "user":
      default:
        return "bg-slate-100 text-slate-800 border-slate-200"
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-teal-600" />
            User Management
          </CardTitle>
          <CardDescription>Manage system users, roles, and location access</CardDescription>
        </div>
        <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
          <DialogTrigger asChild>
            <Button className="bg-teal-500 hover:bg-teal-600 text-white">
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Create a new user account with roles and location access</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email *</Label>
                  <Input
                    id="email"
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    placeholder="user@company.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password *</Label>
                  <Input
                    id="password"
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    placeholder="Password"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="name">Full Name *</Label>
                <Input
                  id="name"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              
              <div className="space-y-3">
                <Label>Roles</Label>
                <div className="grid grid-cols-2 gap-3">
                  {["user", "operator", "admin", "devops"].map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role}`}
                        checked={newUser.roles.includes(role)}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setNewUser({ ...newUser, roles: [...newUser.roles, role] })
                          } else {
                            setNewUser({ ...newUser, roles: newUser.roles.filter((r: string) => r !== role) })
                          }
                        }}
                      />
                      <Label htmlFor={`role-${role}`} className="capitalize cursor-pointer">
                        {role}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Assigned Locations</Label>
                <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                  {locations.length === 0 ? (
                    <p className="text-sm text-slate-500">No locations available</p>
                  ) : (
                    <div className="space-y-2">
                      {locations.map((location) => (
                        <div key={location.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`location-${location.id}`}
                            checked={newUser.assignedLocations.includes(location.id)}
                            onCheckedChange={(checked) => {
                              if (checked) {
                                setNewUser({
                                  ...newUser,
                                  assignedLocations: [...newUser.assignedLocations, location.id],
                                })
                              } else {
                                setNewUser({
                                  ...newUser,
                                  assignedLocations: newUser.assignedLocations.filter(
                                    (id: string) => id !== location.id,
                                  ),
                                })
                              }
                            }}
                          />
                          <Label htmlFor={`location-${location.id}`} className="text-sm cursor-pointer">
                            {location.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddUserOpen(false)}>
                Cancel
              </Button>
              <Button 
                onClick={handleAddUser} 
                disabled={loading || !newUser.email.trim() || !newUser.password.trim() || !newUser.name.trim()}
                className="bg-teal-500 hover:bg-teal-600"
              >
                {loading ? "Creating..." : "Create User"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {users.length === 0 ? (
          <div className="text-center py-8">
            <Users className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No users</h3>
            <p className="text-slate-500">Get started by adding your first user.</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Roles</TableHead>
                <TableHead>Assigned Locations</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((userItem) => (
                <TableRow key={userItem.id}>
                  <TableCell className="font-medium">{userItem.name}</TableCell>
                  <TableCell>{userItem.email}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {userItem.roles?.map((role: string) => (
                        <Badge key={role} variant="outline" className={getRoleBadgeClass(role)}>
                          {role}
                        </Badge>
                      ))}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {userItem.assignedLocations && userItem.assignedLocations.length > 0 ? (
                        userItem.assignedLocations.map((locationId: string) => (
                          <Badge key={locationId} variant="outline" className="bg-slate-100 text-slate-800 border-slate-200">
                            <MapPin className="h-3 w-3 mr-1" />
                            {getLocationName(locationId)}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-slate-500">
                          {userItem.roles?.includes("admin") ? "All locations (Admin)" : "No locations assigned"}
                        </span>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end space-x-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditUser({
                            ...userItem,
                            assignedLocations: userItem.assignedLocations || [],
                          })
                          setIsEditUserOpen(true)
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
                            <AlertDialogTitle>Delete User</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete "{userItem.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteUser(userItem.id)}
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

      {/* Edit User Dialog */}
      <Dialog open={isEditUserOpen} onOpenChange={setIsEditUserOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update user information, roles, and location access</DialogDescription>
          </DialogHeader>
          {editUser && (
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Full Name *</Label>
                <Input
                  id="edit-name"
                  value={editUser.name}
                  onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                  placeholder="John Doe"
                />
              </div>
              
              <div className="space-y-3">
                <Label>Roles</Label>
                <div className="grid grid-cols-2 gap-3">
                  {["user", "operator", "admin", "devops"].map((role) => (
                    <div key={role} className="flex items-center space-x-2">
                      <Checkbox
                        id={`edit-role-${role}`}
                        checked={editUser.roles?.includes(role)}
                        onCheckedChange={() => {
                          setEditUser(toggleRole(editUser, role))
                        }}
                      />
                      <Label htmlFor={`edit-role-${role}`} className="capitalize cursor-pointer">
                        {role}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <Label>Assigned Locations</Label>
                <div className="border rounded-lg p-3 max-h-32 overflow-y-auto">
                  {locations.length === 0 ? (
                    <p className="text-sm text-slate-500">No locations available</p>
                  ) : (
                    <div className="space-y-2">
                      {locations.map((location) => (
                        <div key={location.id} className="flex items-center space-x-2">
                          <Checkbox
                            id={`edit-location-${location.id}`}
                            checked={editUser.assignedLocations?.includes(location.id)}
                            onCheckedChange={() => {
                              setEditUser(toggleLocation(editUser, location.id))
                            }}
                          />
                          <Label htmlFor={`edit-location-${location.id}`} className="text-sm cursor-pointer">
                            {location.name}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                {editUser.roles?.includes("admin") && (
                  <p className="text-xs text-slate-500">
                    Note: Admins have access to all locations by default
                  </p>
                )}
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditUserOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleEditUser} 
              disabled={loading || !editUser?.name?.trim()}
              className="bg-teal-500 hover:bg-teal-600"
            >
              {loading ? "Updating..." : "Update User"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  )
}
