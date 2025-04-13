"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DownloadCloud, Search, Clock, User, Activity, FileText } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { collection, query, orderBy, limit, getDocs, where, startAfter, Timestamp } from "firebase/firestore"
import { format } from "date-fns"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import type { DateRange } from "react-day-picker"

export function AuditSettings() {
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [lastVisible, setLastVisible] = useState<any>(null)
  const [hasMore, setHasMore] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [userFilter, setUserFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [users, setUsers] = useState<any[]>([])
  const [locations, setLocations] = useState<any[]>([])
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)
  const { db } = useFirebase()
  const { toast } = useToast()
  const pageSize = 25

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
      }
    }

    fetchUsers()
    fetchLocations()
  }, [db])

  useEffect(() => {
    fetchAuditLogs()
  }, [db, actionFilter, userFilter, locationFilter, dateRange])

  const fetchAuditLogs = async (loadMore = false) => {
    if (!db) return

    try {
      setLoading(true)

      let auditQuery = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"))

      // Apply filters
      if (actionFilter !== "all") {
        auditQuery = query(auditQuery, where("action", "==", actionFilter))
      }

      if (userFilter !== "all") {
        auditQuery = query(auditQuery, where("userId", "==", userFilter))
      }

      if (locationFilter !== "all") {
        auditQuery = query(auditQuery, where("locationId", "==", locationFilter))
      }

      // Apply date range filter
      if (dateRange?.from) {
        const fromDate = new Date(dateRange.from)
        fromDate.setHours(0, 0, 0, 0)
        auditQuery = query(auditQuery, where("timestamp", ">=", Timestamp.fromDate(fromDate)))
      }

      if (dateRange?.to) {
        const toDate = new Date(dateRange.to)
        toDate.setHours(23, 59, 59, 999)
        auditQuery = query(auditQuery, where("timestamp", "<=", Timestamp.fromDate(toDate)))
      }

      // Apply pagination
      if (loadMore && lastVisible) {
        auditQuery = query(auditQuery, startAfter(lastVisible), limit(pageSize))
      } else {
        auditQuery = query(auditQuery, limit(pageSize))
      }

      const snapshot = await getDocs(auditQuery)

      // Update last visible for pagination
      if (!snapshot.empty) {
        setLastVisible(snapshot.docs[snapshot.docs.length - 1])
      } else {
        setHasMore(false)
      }

      const logs = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))

      // Filter by search term if provided
      const filteredLogs = searchTerm
        ? logs.filter(
            (log) =>
              log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
              log.locationName?.toLowerCase().includes(searchTerm.toLowerCase()),
          )
        : logs

      if (loadMore) {
        setAuditLogs((prev) => [...prev, ...filteredLogs])
      } else {
        setAuditLogs(filteredLogs)
      }

      setHasMore(snapshot.docs.length === pageSize)
    } catch (error) {
      console.error("Error fetching audit logs:", error)
      toast({
        title: "Error",
        description: "Failed to fetch audit logs",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }

  const handleLoadMore = () => {
    fetchAuditLogs(true)
  }

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    fetchAuditLogs()
  }

  const handleExport = async () => {
    try {
      // Create a more comprehensive query for export
      let exportQuery = query(collection(db, "auditLogs"), orderBy("timestamp", "desc"))

      // Apply the same filters as the view
      if (actionFilter !== "all") {
        exportQuery = query(exportQuery, where("action", "==", actionFilter))
      }

      if (userFilter !== "all") {
        exportQuery = query(exportQuery, where("userId", "==", userFilter))
      }

      if (locationFilter !== "all") {
        exportQuery = query(exportQuery, where("locationId", "==", locationFilter))
      }

      // Apply date range filter
      if (dateRange?.from) {
        const fromDate = new Date(dateRange.from)
        fromDate.setHours(0, 0, 0, 0)
        exportQuery = query(exportQuery, where("timestamp", ">=", Timestamp.fromDate(fromDate)))
      }

      if (dateRange?.to) {
        const toDate = new Date(dateRange.to)
        toDate.setHours(23, 59, 59, 999)
        exportQuery = query(exportQuery, where("timestamp", "<=", Timestamp.fromDate(toDate)))
      }

      // Get all matching documents (no limit)
      const snapshot = await getDocs(exportQuery)

      let logs = snapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          timestamp: data.timestamp?.toDate().toISOString() || "",
          action: data.action || "",
          userName: data.userName || "",
          userId: data.userId || "",
          locationName: data.locationName || "",
          locationId: data.locationId || "",
          details: data.details || "",
          path: data.path || "",
          changes: JSON.stringify(data.changes || {}),
        }
      })

      // Filter by search term if provided
      if (searchTerm) {
        logs = logs.filter(
          (log) =>
            log.details?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.action?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.userName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.locationName?.toLowerCase().includes(searchTerm.toLowerCase()),
        )
      }

      // Convert to CSV
      const headers = ["Timestamp", "Action", "User", "Location", "Details", "Path", "Changes"]

      const csvContent = [
        headers.join(","),
        ...logs.map((log) =>
          [
            `"${log.timestamp}"`,
            `"${log.action}"`,
            `"${log.userName}"`,
            `"${log.locationName}"`,
            `"${log.details.replace(/"/g, '""')}"`,
            `"${log.path}"`,
            `"${log.changes.replace(/"/g, '""')}"`,
          ].join(","),
        ),
      ].join("\n")

      // Create and download the file
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Success",
        description: `Exported ${logs.length} audit logs to CSV`,
      })
    } catch (error) {
      console.error("Error exporting audit logs:", error)
      toast({
        title: "Error",
        description: "Failed to export audit logs",
        variant: "destructive",
      })
    }
  }

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800"
      case "update":
        return "bg-blue-100 text-blue-800"
      case "delete":
        return "bg-red-100 text-red-800"
      case "login":
        return "bg-purple-100 text-purple-800"
      case "logout":
        return "bg-gray-100 text-gray-800"
      case "setpoint":
        return "bg-amber-100 text-amber-800"
      default:
        return "bg-gray-100 text-gray-800"
    }
  }

  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "N/A"

    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
      return format(date, "MMM d, yyyy h:mm:ss a")
    } catch (error) {
      console.error("Error formatting timestamp:", error)
      return "Invalid date"
    }
  }

  const renderActionIcon = (action: string) => {
    switch (action) {
      case "create":
        return <FileText className="h-4 w-4 mr-1" />
      case "update":
        return <Activity className="h-4 w-4 mr-1" />
      case "delete":
        return <FileText className="h-4 w-4 mr-1" />
      case "login":
        return <User className="h-4 w-4 mr-1" />
      case "logout":
        return <User className="h-4 w-4 mr-1" />
      case "setpoint":
        return <Activity className="h-4 w-4 mr-1" />
      default:
        return <Activity className="h-4 w-4 mr-1" />
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Audit Logs</CardTitle>
          <CardDescription>Track and review all system activities and changes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <form onSubmit={handleSearch} className="flex w-full max-w-sm items-center space-x-2">
                  <Input
                    type="search"
                    placeholder="Search audit logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  <Button type="submit" size="icon">
                    <Search className="h-4 w-4" />
                    <span className="sr-only">Search</span>
                  </Button>
                </form>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-9">
                      <Clock className="h-4 w-4 mr-2" />
                      {dateRange?.from ? (
                        dateRange.to ? (
                          <>
                            {format(dateRange.from, "LLL dd, y")} - {format(dateRange.to, "LLL dd, y")}
                          </>
                        ) : (
                          format(dateRange.from, "LLL dd, y")
                        )
                      ) : (
                        "Date Range"
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      initialFocus
                      mode="range"
                      defaultMonth={dateRange?.from}
                      selected={dateRange}
                      onSelect={setDateRange}
                      numberOfMonths={2}
                    />
                  </PopoverContent>
                </Popover>

                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Filter by action" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Actions</SelectItem>
                    <SelectItem value="create">Create</SelectItem>
                    <SelectItem value="update">Update</SelectItem>
                    <SelectItem value="delete">Delete</SelectItem>
                    <SelectItem value="login">Login</SelectItem>
                    <SelectItem value="logout">Logout</SelectItem>
                    <SelectItem value="setpoint">Setpoint</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Filter by user" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    {users.map((user) => (
                      <SelectItem key={user.id} value={user.id}>
                        {user.name || user.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={locationFilter} onValueChange={setLocationFilter}>
                  <SelectTrigger className="w-[130px] h-9">
                    <SelectValue placeholder="Filter by location" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Locations</SelectItem>
                    {locations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        {location.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Button variant="outline" size="sm" className="h-9" onClick={handleExport}>
                  <DownloadCloud className="h-4 w-4 mr-2" />
                  Export
                </Button>
              </div>
            </div>

            {loading && auditLogs.length === 0 ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center space-x-4">
                    <Skeleton className="h-12 w-full" />
                  </div>
                ))}
              </div>
            ) : auditLogs.length === 0 ? (
              <div className="text-center py-8">
                <Activity className="h-12 w-12 mx-auto text-gray-400" />
                <h3 className="mt-2 text-lg font-medium">No audit logs found</h3>
                <p className="text-sm text-gray-500">Try adjusting your filters or search term</p>
              </div>
            ) : (
              <>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Timestamp</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>User</TableHead>
                        <TableHead>Location</TableHead>
                        <TableHead className="w-[300px]">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log) => (
                        <TableRow key={log.id}>
                          <TableCell className="font-mono text-xs">{formatTimestamp(log.timestamp)}</TableCell>
                          <TableCell>
                            <Badge className={getActionBadgeColor(log.action)}>
                              <div className="flex items-center">
                                {renderActionIcon(log.action)}
                                {log.action}
                              </div>
                            </Badge>
                          </TableCell>
                          <TableCell>{log.userName || "System"}</TableCell>
                          <TableCell>{log.locationName || "Global"}</TableCell>
                          <TableCell className="max-w-[300px] truncate">
                            <Popover>
                              <PopoverTrigger asChild>
                                <Button variant="link" className="h-auto p-0 text-left">
                                  {log.details || "No details provided"}
                                </Button>
                              </PopoverTrigger>
                              <PopoverContent className="w-[400px]">
                                <div className="space-y-2">
                                  <h4 className="font-medium">Details</h4>
                                  <p className="text-sm">{log.details}</p>

                                  {log.path && (
                                    <>
                                      <h4 className="font-medium">Path</h4>
                                      <p className="text-sm font-mono">{log.path}</p>
                                    </>
                                  )}

                                  {log.changes && Object.keys(log.changes).length > 0 && (
                                    <>
                                      <h4 className="font-medium">Changes</h4>
                                      <pre className="text-xs bg-gray-100 p-2 rounded overflow-auto max-h-[200px]">
                                        {JSON.stringify(log.changes, null, 2)}
                                      </pre>
                                    </>
                                  )}
                                </div>
                              </PopoverContent>
                            </Popover>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {hasMore && (
                  <div className="flex justify-center mt-4">
                    <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
                      {loading ? "Loading..." : "Load More"}
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
