"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Edit, Plus, Trash, User } from "lucide-react"
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
import { collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore"
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth"

export function UserSettings() {
  const [users, setUsers] = useState<any[]>([])
  const [isAddDialogOpen, setIsAddDialogOpen] = useState<boolean>(false)
  const [isEditDialogOpen, setIsEditDialogOpen] = useState<boolean>(false)
  const [isLoading, setIsLoading] = useState(false)
  const [newUser, setNewUser] = useState<any>({
    email: "",
    password: "",
    name: "",
    roles: ["user"],
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

    fetchUsers()
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
        },
      ])

      // Reset form and close dialog
      setNewUser({
        email: "",
        password: "",
        name: "",
        roles: ["user"],
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
        updatedAt: new Date(),
      })

      // Update local state
      setUsers((prev) =>
        prev.map((user) => (user.id === editUser.id ? { ...user, ...editUser } : user))
      )

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

      // Delete user data from Firestore
      await deleteDoc(doc(db, "users", userId))

      // Update local state
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Users</h2>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Add User
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Add New User</DialogTitle>
              <DialogDescription>Add a new user to your building management system</DialogDescription>
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
                  </div>
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleAddUser}
                disabled={!newUser.email || !newUser.password || newUser.roles.length === 0}
              >
                Add User
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Manage Users</CardTitle>
          <CardDescription>View and manage all users in your building management system</CardDescription>
        </CardHeader>
        <CardContent>
          {users.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <User className="h-10 w-10 text-muted-foreground mb-2" />
              <p className="text-lg font-medium">No Users</p>
              <p className="text-sm text-muted-foreground">Add your first user to get started</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Roles</TableHead>
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
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setEditUser(user)
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
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>Update the user details</DialogDescription>
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
                  </div>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleEditUser} disabled={!editUser?.name || editUser?.roles.length === 0}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

