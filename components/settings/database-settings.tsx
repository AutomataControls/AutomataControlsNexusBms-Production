"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Loader2, RefreshCw, Plus, Trash2, Eye, Database } from "lucide-react"
import { collection, getDocs, addDoc, deleteDoc, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

interface DatabaseEntry {
  id: string
  [key: string]: any
}

interface DatabaseConfig {
  id: string
  name: string
  collection: string
  fields: {
    name: string
    type: 'text' | 'number' | 'select' | 'datetime'
    label: string
    options?: string[]
    required?: boolean
  }[]
  columns: {
    header: string
    accessor: string
  }[]
}

const EQUIPMENT_TYPES = [
  'Air Handler',
  'DOAS',
  'Fan Coil',
  'Chiller',
  'Boiler',
  'Greenhouse',
  'Pump',
  'Supply Fan',
  'Exhaust Fan'
]

const databases: DatabaseConfig[] = [
  {
    id: 'alarms',
    name: 'Alarms',
    collection: 'automatebmsalarms',
    fields: [
      { name: 'name', type: 'text', label: 'Alarm Name', required: true },
      { name: 'equipmentId', type: 'text', label: 'Equipment ID', required: true },
      { name: 'severity', type: 'select', label: 'Severity', options: ['Info', 'Warning', 'Critical'], required: true },
      { name: 'status', type: 'select', label: 'Status', options: ['Active', 'Acknowledged', 'Resolved'], required: true },
      { name: 'timestamp', type: 'datetime', label: 'Timestamp', required: true },
      { name: 'description', type: 'text', label: 'Description' }
    ],
    columns: [
      { header: 'Name', accessor: 'name' },
      { header: 'Equipment', accessor: 'equipmentId' },
      { header: 'Severity', accessor: 'severity' },
      { header: 'Status', accessor: 'status' },
      { header: 'Timestamp', accessor: 'timestamp' }
    ]
  },
  {
    id: 'equipment',
    name: 'Equipment',
    collection: 'automatebmsequipment',
    fields: [
      { name: 'name', type: 'text', label: 'Equipment Name', required: true },
      { name: 'type', type: 'select', label: 'Type', options: EQUIPMENT_TYPES, required: true },
      { name: 'locationId', type: 'text', label: 'Location ID', required: true },
      { name: 'status', type: 'select', label: 'Status', options: ['Online', 'Offline', 'Fault'], required: true },
      { name: 'model', type: 'text', label: 'Model Number' },
      { name: 'serialNumber', type: 'text', label: 'Serial Number' }
    ],
    columns: [
      { header: 'Name', accessor: 'name' },
      { header: 'Type', accessor: 'type' },
      { header: 'Location', accessor: 'locationId' },
      { header: 'Status', accessor: 'status' }
    ]
  },
  {
    id: 'locations',
    name: 'Locations',
    collection: 'automatebmslocations',
    fields: [
      { name: 'name', type: 'text', label: 'Location Name', required: true },
      { name: 'address', type: 'text', label: 'Address', required: true },
      { name: 'city', type: 'text', label: 'City', required: true },
      { name: 'state', type: 'text', label: 'State', required: true },
      { name: 'zipCode', type: 'text', label: 'Zip Code', required: true },
      { name: 'timezone', type: 'text', label: 'Timezone' }
    ],
    columns: [
      { header: 'Name', accessor: 'name' },
      { header: 'Address', accessor: 'address' },
      { header: 'City', accessor: 'city' },
      { header: 'State', accessor: 'state' }
    ]
  },
  {
    id: 'metrics',
    name: 'Metrics',
    collection: 'automatebmsmetrics',
    fields: [
      { name: 'equipmentId', type: 'text', label: 'Equipment ID', required: true },
      { name: 'type', type: 'select', label: 'Type', options: ['Temperature', 'Pressure', 'Speed', 'Power'], required: true },
      { name: 'value', type: 'number', label: 'Value', required: true },
      { name: 'timestamp', type: 'datetime', label: 'Timestamp', required: true }
    ],
    columns: [
      { header: 'Equipment', accessor: 'equipmentId' },
      { header: 'Type', accessor: 'type' },
      { header: 'Value', accessor: 'value' },
      { header: 'Timestamp', accessor: 'timestamp' }
    ]
  },
  {
    id: 'systemconfig',
    name: 'System Config',
    collection: 'automatebmssystemconfig',
    fields: [
      { name: 'name', type: 'text', label: 'Config Name', required: true },
      { name: 'value', type: 'text', label: 'Value', required: true },
      { name: 'description', type: 'text', label: 'Description' },
      { name: 'lastModified', type: 'datetime', label: 'Last Modified', required: true }
    ],
    columns: [
      { header: 'Name', accessor: 'name' },
      { header: 'Value', accessor: 'value' },
      { header: 'Last Modified', accessor: 'lastModified' }
    ]
  },
  {
    id: 'users',
    name: 'Users',
    collection: 'automatebmsusers',
    fields: [
      { name: 'username', type: 'text', label: 'Username', required: true },
      { name: 'name', type: 'text', label: 'Full Name', required: true },
      { name: 'role', type: 'select', label: 'Role', options: ['Admin', 'Operator', 'User'], required: true },
      { name: 'lastLogin', type: 'datetime', label: 'Last Login' }
    ],
    columns: [
      { header: 'Username', accessor: 'username' },
      { header: 'Name', accessor: 'name' },
      { header: 'Role', accessor: 'role' },
      { header: 'Last Login', accessor: 'lastLogin' }
    ]
  }
]

export function DatabaseSettings() {
  const [selectedDb, setSelectedDb] = useState(databases[0])
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<DatabaseEntry[]>([])
  const [showViewModal, setShowViewModal] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<DatabaseEntry | null>(null)
  const [newEntry, setNewEntry] = useState<{ [key: string]: any }>({})
  const { toast } = useToast()

  const fetchData = async () => {
    setLoading(true)
    try {
      const querySnapshot = await getDocs(collection(db, selectedDb.collection))
      const fetchedData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      setData(fetchedData)
      toast({
        title: "Data Retrieved",
        description: `Successfully fetched ${fetchedData.length} entries from ${selectedDb.name}`,
      })
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch data from database",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleSync = async () => {
    setLoading(true)
    try {
      const querySnapshot = await getDocs(collection(db, selectedDb.collection))
      const documents = querySnapshot.docs

      const updatePromises = documents.map(async (doc) => {
        const data = doc.data()
        const updates: any = {
          lastSynced: new Date().toISOString(),
          syncStatus: 'synced'
        }

        switch (selectedDb.id) {
          case 'alarms':
            updates.status = data.status === 'Active' ? 'Active' : 'Resolved'
            break
          case 'equipment':
            updates.lastStatusUpdate = new Date().toISOString()
            break
          case 'metrics':
            updates.lastUpdate = new Date().toISOString()
            break
        }

        return updateDoc(doc.ref, updates)
      })

      await Promise.all(updatePromises)
      toast({
        title: "Sync Completed",
        description: `Successfully synced ${documents.length} entries in ${selectedDb.name}`,
      })
      fetchData()
    } catch (error) {
      console.error("Error syncing data:", error)
      toast({
        title: "Error",
        description: "Failed to sync database",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleValidate = async () => {
    setLoading(true)
    try {
      const querySnapshot = await getDocs(collection(db, selectedDb.collection))
      const documents = querySnapshot.docs
      let validationErrors = 0

      for (const doc of documents) {
        const data = doc.data()
        const errors = []

        selectedDb.fields.forEach(field => {
          if (field.required && !data[field.name]) {
            errors.push(`Missing required field: ${field.label}`)
          }
        })

        selectedDb.fields.forEach(field => {
          if (data[field.name] !== undefined) {
            switch (field.type) {
              case 'number':
                if (isNaN(Number(data[field.name]))) {
                  errors.push(`${field.label} must be a number`)
                }
                break
              case 'datetime':
                if (isNaN(Date.parse(data[field.name]))) {
                  errors.push(`${field.label} must be a valid date`)
                }
                break
              case 'select':
                if (field.options && !field.options.includes(data[field.name])) {
                  errors.push(`${field.label} must be one of: ${field.options.join(', ')}`)
                }
                break
            }
          }
        })

        if (errors.length > 0) {
          validationErrors++
          console.error(`Validation errors in document ${doc.id}:`, errors)
        }
      }

      if (validationErrors > 0) {
        toast({
          title: "Validation Complete",
          description: `Found ${validationErrors} documents with validation errors in ${selectedDb.name}`,
          variant: "destructive",
        })
      } else {
        toast({
          title: "Validation Complete",
          description: `All ${documents.length} documents in ${selectedDb.name} are valid`,
        })
      }
    } catch (error) {
      console.error("Error validating data:", error)
      toast({
        title: "Error",
        description: "Failed to validate database",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleAddEntry = async () => {
    // Validate required fields
    const missingFields = selectedDb.fields
      .filter(field => field.required && !newEntry[field.name])
      .map(field => field.label)

    if (missingFields.length > 0) {
      toast({
        title: "Validation Error",
        description: `Required fields missing: ${missingFields.join(", ")}`,
        variant: "destructive",
      })
      return
    }

    try {
      // Format timestamps
      if (newEntry.timestamp) {
        newEntry.timestamp = new Date(newEntry.timestamp).toISOString()
      }
      if (newEntry.lastModified) {
        newEntry.lastModified = new Date().toISOString()
      }
      if (newEntry.lastLogin) {
        newEntry.lastLogin = new Date(newEntry.lastLogin).toISOString()
      }

      await addDoc(collection(db, selectedDb.collection), newEntry)
      toast({
        title: "Entry Added",
        description: "Successfully added new entry to database",
      })
      setNewEntry({})
      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to add new entry",
        variant: "destructive",
      })
    }
  }

  const handleDeleteEntry = async (id: string) => {
    try {
      await deleteDoc(doc(db, selectedDb.collection, id))
      toast({
        title: "Entry Deleted",
        description: "Successfully deleted entry from database",
      })
      fetchData()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete entry",
        variant: "destructive",
      })
    }
  }

  const renderField = (field: DatabaseConfig['fields'][0]) => {
    switch (field.type) {
      case 'text':
      case 'number':
        return (
          <Input
            type={field.type}
            value={newEntry[field.name] || ''}
            onChange={(e) => setNewEntry({ ...newEntry, [field.name]: e.target.value })}
            required={field.required}
          />
        )
      case 'select':
        return (
          <Select
            value={newEntry[field.name] || ''}
            onValueChange={(value) => setNewEntry({ ...newEntry, [field.name]: value })}
          >
            <SelectTrigger>
              <SelectValue placeholder={`Select ${field.label}`} />
            </SelectTrigger>
            <SelectContent>
              {field.options?.map((option) => (
                <SelectItem key={option} value={option}>
                  {option}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )
      case 'datetime':
        return (
          <Input
            type="datetime-local"
            value={newEntry[field.name] || ''}
            onChange={(e) => setNewEntry({ ...newEntry, [field.name]: e.target.value })}
            required={field.required}
          />
        )
      default:
        return null
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Database Management</CardTitle>
        <CardDescription>Manage and monitor your system databases</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue={databases[0].id} className="w-full" onValueChange={(value) => {
          const db = databases.find(db => db.id === value)
          if (db) {
            setSelectedDb(db)
            setNewEntry({})
          }
        }}>
          <TabsList className="grid w-full" style={{ gridTemplateColumns: `repeat(${databases.length}, 1fr)` }}>
            {databases.map(db => (
              <TabsTrigger key={db.id} value={db.id} className="hover:bg-[#e6f3f1]">
                {db.name}
              </TabsTrigger>
            ))}
          </TabsList>

          {databases.map(db => (
            <TabsContent key={db.id} value={db.id}>
              <div className="space-y-4">
                <div className="flex space-x-4">
                  <Button onClick={handleSync} className="bg-teal-500/80 hover:bg-teal-500">
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Sync
                  </Button>
                  <Button onClick={fetchData} className="bg-orange-400/80 hover:bg-orange-400">
                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Database className="mr-2 h-4 w-4" />}
                    Retrieve
                  </Button>
                  <Button onClick={handleValidate} variant="outline" className="hover:bg-[#e6f3f1]">
                    Validate
                  </Button>
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" className="hover:bg-[#e6f3f1]">
                        <Plus className="mr-2 h-4 w-4" />
                        Add Entry
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Add New {selectedDb.name} Entry</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 py-4">
                        {selectedDb.fields.map((field) => (
                          <div key={field.name} className="space-y-2">
                            <Label>{field.label}{field.required && ' *'}</Label>
                            {renderField(field)}
                          </div>
                        ))}
                        <Button onClick={handleAddEntry} className="w-full">Add Entry</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                </div>

                <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
                  <DialogContent className="max-w-3xl">
                    <DialogHeader>
                      <DialogTitle>{selectedDb.name} Entry Details</DialogTitle>
                    </DialogHeader>
                    <ScrollArea className="h-[400px]">
                      {selectedEntry && (
                        <div className="space-y-4">
                          {Object.entries(selectedEntry).map(([key, value]) => (
                            <div key={key} className="grid grid-cols-2 gap-4">
                              <Label>{key}</Label>
                              <div>{String(value)}</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </ScrollArea>
                  </DialogContent>
                </Dialog>

                {data.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Database Contents</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[300px]">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              {selectedDb.columns.map((column) => (
                                <TableHead key={column.accessor}>{column.header}</TableHead>
                              ))}
                              <TableHead>Actions</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {data.map((entry) => (
                              <TableRow key={entry.id}>
                                {selectedDb.columns.map((column) => (
                                  <TableCell key={column.accessor}>
                                    {entry[column.accessor] !== undefined ? String(entry[column.accessor]) : ''}
                                  </TableCell>
                                ))}
                                <TableCell>
                                  <div className="flex space-x-2">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => handleDeleteEntry(entry.id)}
                                      className="hover:bg-red-100"
                                    >
                                      <Trash2 className="h-4 w-4 text-red-500" />
                                    </Button>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedEntry(entry)
                                        setShowViewModal(true)
                                      }}
                                      className="hover:bg-[#e6f3f1]"
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                  </div>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </CardContent>
    </Card>
  )
} 