"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Plus, Trash, MapPin } from "lucide-react"
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
import { Checkbox } from "@/components/ui/checkbox"
import { useFirebase } from "@/lib/firebase-context"
import { collection, getDocs, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore"
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"

export function UserSettings() {
  const [users, setUsers] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newUser, setNewUser] = useState<any>({
    email: "",
    password: "",
    name: "",
    roles: ["user"],
    assignedLocations: [],
  })
  const [editUser, setEditUser] = useState<any>(null)
  const { db } = useFirebase()
  const { toast } = useToast()
  const auth = getAuth()

  useEffect(() => {
    const fetchUsers = async () => {
      if (!db) return

      try {
        const usersRef = collection(db, "users")
        const snapshot = await getDocs(usersRef)
        const userData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setUsers(userData)
      } catch (error) {
        console.error("Error fetching users:", error)
        toast({
          title: "Error",
          description: "Failed to fetch users",
          variant: "destructive",
        })
      }
    }

    const fetchLocations = async () => {
      if (!db) return

      try {
        const locationsRef = collection(db, "locations")
        const snapshot = await getDocs(locationsRef)
        const locationData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setLocations(locationData)
      } catch (error) {
        console.error("Error fetching locations:", error)
        toast({
          title: "Error",
          description: "Failed to fetch locations",
          variant: "destructive",
        })
      }
    }

    fetchUsers()
    fetchLocations()
  }, [db, toast])

  const handleAddUser = async () => {
    if (!db || !auth) return

    try {
      setIsLoading(true)

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

      // Update local state
      setUsers((prev) => [
        ...prev,
        {
          id: firebaseUser.uid,
          email: newUser.email,
          name: newUser.name,
          roles: newUser.roles,
          assignedLocations: newUser.assignedLocations,
        },
      ])

      // Reset form and close dialog
      setNewUser({
        email: "",
        password: "",
        name: "",
        roles: ["user"],
        assignedLocations: [],
      })
      setIsAddDialogOpen(false)

      toast({
        title: "Success",
        description: "User added successfully",
      })
    } catch (error) {
      console.error("Error adding user:", error)
      toast({
        title: "Error",
        description: "Failed to add user",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditUser = async () => {
    if (!db || !editUser) return

    try {
      setIsLoading(true)

      // Update user data in Firestore
      await updateDoc(doc(db, "users", editUser.id), {
        name: editUser.name,
        roles: editUser.roles,
        assignedLocations: editUser.assignedLocations || [],
        updatedAt: new Date(),
      })

      // Update local state
      setUsers((prev) => prev.map((user) => (user.id === editUser.id ? { ...user, ...editUser } : user)))

      // Close dialog
      setIsEditDialogOpen(false)

      toast({
        title: "Success",
        description: "User updated successfully",
      })
    } catch (error) {
      console.error("Error updating user:", error)
      toast({
        title: "Error",
        description: "Failed to update user",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!db) return

    try {
      setIsLoading(true)
      await deleteDoc(doc(db, "users", userId))
      setUsers((prev) => prev.filter((user) => user.id !== userId))

      toast({
        title: "Success",
        description: "User deleted successfully",
      })
    } catch (error) {
      console.error("Error deleting user:", error)
      toast({
        title: "Error",
        description: "Failed to delete user",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const toggleRole = (user: any, role: string) => {
    const updatedRoles = user.roles.includes(role)
      ? user.roles.filter((r: string) => r !== role)
      : [...user.roles, role]

    return {
      ...user,
      roles: updatedRoles,
    }
  }

  const toggleLocation = (user: any, locationId: string) => {
    const assignedLocations = user.assignedLocations || []
    const updatedLocations = assignedLocations.includes(locationId)
      ? assignedLocations.filter((id: string) => id !== locationId)
      : [...assignedLocations, locationId]

    return {
      ...user,
      assignedLocations: updatedLocations,
    }
  }

  const getLocationName = (locationId: string) => {
    const location = locations.find((loc) => loc.id === locationId)
    return location ? location.name : "Unknown Location"
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Management</CardTitle>
        <CardDescription>Add, edit, and manage users.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-4">
          <Dialog>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add User
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Add User</DialogTitle>
                <DialogDescription>Create a new user account.</DialogDescription>
              </DialogHeader>

              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <Input
                      id="password"
                      type="password"
                      value={newUser.password}
                      onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={newUser.name}
                      onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Roles</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="user-role"
                          checked={newUser.roles.includes("user")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewUser({ ...newUser, roles: [...newUser.roles, "user"] })
                            } else {
                              setNewUser({ ...newUser, roles: newUser.roles.filter((r: string) => r !== "user") })
                            }
                          }}
                        />
                        <Label htmlFor="user-role">User</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="operator-role"
                          checked={newUser.roles.includes("operator")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewUser({ ...newUser, roles: [...newUser.roles, "operator"] })
                            } else {
                              setNewUser({ ...newUser, roles: newUser.roles.filter((r: string) => r !== "operator") })
                            }
                          }}
                        />
                        <Label htmlFor="operator-role">Operator</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="admin-role"
                          checked={newUser.roles.includes("admin")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewUser({ ...newUser, roles: [...newUser.roles, "admin"] })
                            } else {
                              setNewUser({ ...newUser, roles: newUser.roles.filter((r: string) => r !== "admin") })
                            }
                          }}
                        />
                        <Label htmlFor="admin-role">Administrator</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="devops-role"
                          checked={newUser.roles.includes("devops")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewUser({ ...newUser, roles: [...newUser.roles, "devops"] })
                            } else {
                              setNewUser({ ...newUser, roles: newUser.roles.filter((r: string) => r !== "devops") })
                            }
                          }}
                        />
                        <Label htmlFor="devops-role">DevOps</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="facilities-role"
                          checked={newUser.roles.includes("facilities")}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setNewUser({ ...newUser, roles: [...newUser.roles, "facilities"] })
                            } else {
                              setNewUser({ ...newUser, roles: newUser.roles.filter((r: string) => r !== "facilities") })
                            }
                          }}
                        />
                        <Label htmlFor="facilities-role">Facilities</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add Assigned Locations section */}
                <div className="space-y-2">
                  <Label>Assigned Locations</Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    {locations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No locations available</p>
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
                            <Label htmlFor={`location-${location.id}`} className="text-sm">
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
                <Button type="button" variant="secondary" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit" onClick={handleAddUser} disabled={isLoading}>
                  {isLoading ? "Creating..." : "Create"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Username</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Roles</TableHead>
              <TableHead>Assigned Locations</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((user) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">{user.name}</TableCell>
                <TableCell>{user.name}</TableCell>
                <TableCell>{user.email}</TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.roles.map((role: string) => (
                      <span
                        key={role}
                        className={`px-2 py-1 rounded-full text-xs font-medium ${
                          role === "admin"
                            ? "bg-red-100 text-red-800"
                            : role === "operator"
                              ? "bg-blue-100 text-blue-800"
                              : role === "devops"
                                ? "bg-teal-100 text-teal-800"
                                : "bg-gray-100 text-gray-800"
                        }`}
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </TableCell>
                <TableCell>
                  <div className="flex flex-wrap gap-1">
                    {user.assignedLocations && user.assignedLocations.length > 0 ? (
                      user.assignedLocations.map((locationId: string) => (
                        <span
                          key={locationId}
                          className="px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 flex items-center"
                        >
                          <MapPin className="h-3 w-3 mr-1" />
                          {getLocationName(locationId)}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {user.roles.includes("admin") ? "All locations (Admin)" : "No locations assigned"}
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
                          ...user,
                          assignedLocations: user.assignedLocations || [],
                        })
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
                          <AlertDialogTitle>Delete User</AlertDialogTitle>
                          <AlertDialogDescription>
                            Are you sure you want to delete this user? This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDeleteUser(user.id)}
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

        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent className="sm:max-w-[425px]">
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>Make changes to the user's profile.</DialogDescription>
            </DialogHeader>

            {editUser && (
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-name">Full Name</Label>
                    <Input
                      id="edit-name"
                      value={editUser.name}
                      onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Roles</Label>
                    <div className="flex flex-col space-y-2">
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-user-role"
                          checked={editUser.roles.includes("user")}
                          onCheckedChange={(checked) => {
                            setEditUser(toggleRole(editUser, "user"))
                          }}
                        />
                        <Label htmlFor="edit-user-role">User</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-operator-role"
                          checked={editUser.roles.includes("operator")}
                          onCheckedChange={(checked) => {
                            setEditUser(toggleRole(editUser, "operator"))
                          }}
                        />
                        <Label htmlFor="edit-operator-role">Operator</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-admin-role"
                          checked={editUser.roles.includes("admin")}
                          onCheckedChange={(checked) => {
                            setEditUser(toggleRole(editUser, "admin"))
                          }}
                        />
                        <Label htmlFor="edit-admin-role">Administrator</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-devops-role"
                          checked={editUser.roles.includes("devops")}
                          onCheckedChange={(checked) => {
                            setEditUser(toggleRole(editUser, "devops"))
                          }}
                        />
                        <Label htmlFor="edit-devops-role">DevOps</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <Checkbox
                          id="edit-facilities-role"
                          checked={editUser.roles.includes("facilities")}
                          onCheckedChange={(checked) => {
                            setEditUser(toggleRole(editUser, "facilities"))
                          }}
                        />
                        <Label htmlFor="edit-facilities-role">Facilities</Label>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Add Assigned Locations section */}
                <div className="space-y-2">
                  <Label>Assigned Locations</Label>
                  <div className="border rounded-md p-3 max-h-40 overflow-y-auto">
                    {locations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No locations available</p>
                    ) : (
                      <div className="space-y-2">
                        {locations.map((location) => (
                          <div key={location.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`edit-location-${location.id}`}
                              checked={editUser.assignedLocations.includes(location.id)}
                              onCheckedChange={() => {
                                setEditUser(toggleLocation(editUser, location.id))
                              }}
                            />
                            <Label htmlFor={`edit-location-${location.id}`} className="text-sm">
                              {location.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {editUser.roles.includes("admin") && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Note: Admins have access to all locations by default
                    </p>
                  )}
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="secondary" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" onClick={handleEditUser} disabled={isLoading}>
                {isLoading ? "Updating..." : "Update"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  )
}
