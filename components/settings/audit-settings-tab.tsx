// components/settings/audit-settings-tab.tsx
// Audit Settings Tab - System activity logs with filtering, search, and export
// Features: View audit logs, filter by action/user/location, search, export to CSV

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { DownloadCloud, Search, Clock, User, Activity, FileText, Filter, Calendar as CalendarIcon } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { collection, query, orderBy, limit, getDocs, where, startAfter, Timestamp } from "firebase/firestore"
import { format } from "date-fns"
import type { DateRange } from "react-day-picker"

interface AuditLog {
  id: string
  timestamp: any // Firestore Timestamp
  action: string
  userName?: string
  userId?: string
  locationName?: string
  locationId?: string
  details?: string
  path?: string
  changes?: any
}

interface User {
  id: string
  name?: string
  email?: string
}

interface Location {
  id: string
  name: string
}

export function AuditSettingsTab() {
  const { db } = useFirebase()
  const { toast } = useToast()

  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const [users, setUsers] = useState<User[]>([])
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [lastVisible, setLastVisible] = useState<any>(null)
  const [hasMore, setHasMore] = useState(true)
  const [searchTerm, setSearchTerm] = useState("")
  const [actionFilter, setActionFilter] = useState<string>("all")
  const [userFilter, setUserFilter] = useState<string>("all")
  const [locationFilter, setLocationFilter] = useState<string>("all")
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined)

  const pageSize = 25

  useEffect(() => {
    fetchUsers()
    fetchLocations()
    fetchAuditLogs()
  }, [])

  useEffect(() => {
    fetchAuditLogs()
  }, [actionFilter, userFilter, locationFilter, dateRange])

  const fetchUsers = async () => {
    if (!db) return
    try {
      const usersRef = collection(db, "users")
      const snapshot = await getDocs(usersRef)
      const userData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as User[]
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
      })) as Location[]
      setLocations(locationData)
    } catch (error) {
      console.error("Error fetching locations:", error)
    }
  }

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
      })) as AuditLog[]

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
        setLastVisible(snapshot.docs[snapshot.docs.length - 1] || null)
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
    if (!db) return

    try {
      setExporting(true)

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

      // Get all matching documents (no limit for export)
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
      link.setAttribute("download", `neural_bms_audit_logs_${format(new Date(), "yyyy-MM-dd")}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      toast({
        title: "Success",
        description: `Exported ${logs.length} audit logs to CSV`,
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error exporting audit logs:", error)
      toast({
        title: "Error",
        description: "Failed to export audit logs",
        variant: "destructive"
      })
    } finally {
      setExporting(false)
    }
  }

  const getActionBadgeColor = (action: string) => {
    switch (action) {
      case "create":
        return "bg-green-100 text-green-800 border-green-200"
      case "update":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "delete":
        return "bg-red-100 text-red-800 border-red-200"
      case "login":
        return "bg-purple-100 text-purple-800 border-purple-200"
      case "logout":
        return "bg-slate-100 text-slate-800 border-slate-200"
      case "setpoint":
        return "bg-amber-100 text-amber-800 border-amber-200"
      default:
        return "bg-slate-100 text-slate-800 border-slate-200"
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

  const clearFilters = () => {
    setActionFilter("all")
    setUserFilter("all")
    setLocationFilter("all")
    setDateRange(undefined)
    setSearchTerm("")
  }

  const hasActiveFilters = actionFilter !== "all" || userFilter !== "all" || locationFilter !== "all" || dateRange || searchTerm

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-teal-600" />
          Audit Logs
        </CardTitle>
        <CardDescription>Track and review all system activities, user actions, and configuration changes</CardDescription>
      </CardHeader>
      <CardContent>
        {/* Search and Filters */}
        <div className="space-y-4 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <form onSubmit={handleSearch} className="flex w-full items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    type="search"
                    placeholder="Search audit logs..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button type="submit" size="icon" variant="outline" className="border-teal-200 text-teal-700 hover:bg-teal-50">
                  <Search className="h-4 w-4" />
                  <span className="sr-only">Search</span>
                </Button>
              </form>
            </div>

            <div className="flex flex-wrap gap-2 items-center">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="border-slate-200 hover:bg-slate-50">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    {dateRange?.from ? (
                      dateRange.to ? (
                        <>
                          {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}
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
                <SelectTrigger className="w-32 h-9 border-slate-200">
                  <SelectValue placeholder="Action" />
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
                <SelectTrigger className="w-32 h-9 border-slate-200">
                  <SelectValue placeholder="User" />
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
                <SelectTrigger className="w-32 h-9 border-slate-200">
                  <SelectValue placeholder="Location" />
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

              {hasActiveFilters && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="border-slate-200 hover:bg-slate-50">
                  <Filter className="h-4 w-4 mr-1" />
                  Clear
                </Button>
              )}

              <Button
                variant="outline"
                size="sm"
                onClick={handleExport}
                disabled={exporting}
                className="border-teal-200 text-teal-700 hover:bg-teal-50"
              >
                {exporting ? (
                  <>
                    <Clock className="h-4 w-4 mr-2 animate-spin" />
                    Exporting...
                  </>
                ) : (
                  <>
                    <DownloadCloud className="h-4 w-4 mr-2" />
                    Export CSV
                  </>
                )}
              </Button>
            </div>
          </div>

          {hasActiveFilters && (
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Filter className="h-4 w-4" />
              <span>Filters active:</span>
              {actionFilter !== "all" && <Badge variant="outline" className="bg-slate-50">{actionFilter}</Badge>}
              {userFilter !== "all" && <Badge variant="outline" className="bg-slate-50">
                {users.find(u => u.id === userFilter)?.name || "Unknown User"}
              </Badge>}
              {locationFilter !== "all" && <Badge variant="outline" className="bg-slate-50">
                {locations.find(l => l.id === locationFilter)?.name || "Unknown Location"}
              </Badge>}
              {dateRange && <Badge variant="outline" className="bg-slate-50">Date Range</Badge>}
              {searchTerm && <Badge variant="outline" className="bg-slate-50">Search: "{searchTerm}"</Badge>}
            </div>
          )}
        </div>

        {/* Audit Logs Table */}
        {loading && auditLogs.length === 0 ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center space-x-4">
                <Skeleton className="h-12 w-full" />
              </div>
            ))}
          </div>
        ) : auditLogs.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="h-12 w-12 mx-auto text-slate-400 mb-4" />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No audit logs found</h3>
            <p className="text-slate-500 mb-4">
              {hasActiveFilters ? "Try adjusting your filters or search term" : "System activity will appear here"}
            </p>
            {hasActiveFilters && (
              <Button variant="outline" onClick={clearFilters} className="border-teal-200 text-teal-700 hover:bg-teal-50">
                Clear all filters
              </Button>
            )}
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-slate-200 overflow-hidden">
              <Table>
                <TableHeader className="bg-slate-50">
                  <TableRow>
                    <TableHead className="font-medium text-slate-900">Timestamp</TableHead>
                    <TableHead className="font-medium text-slate-900">Action</TableHead>
                    <TableHead className="font-medium text-slate-900">User</TableHead>
                    <TableHead className="font-medium text-slate-900">Location</TableHead>
                    <TableHead className="font-medium text-slate-900 w-[300px]">Details</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {auditLogs.map((log) => (
                    <TableRow key={log.id} className="hover:bg-slate-50">
                      <TableCell className="font-mono text-xs text-slate-600">
                        {formatTimestamp(log.timestamp)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={getActionBadgeColor(log.action)}>
                          <div className="flex items-center">
                            {renderActionIcon(log.action)}
                            {log.action}
                          </div>
                        </Badge>
                      </TableCell>
                      <TableCell className="text-slate-900">{log.userName || "System"}</TableCell>
                      <TableCell className="text-slate-900">{log.locationName || "Global"}</TableCell>
                      <TableCell className="max-w-[300px]">
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="link" className="h-auto p-0 text-left justify-start text-slate-700 hover:text-teal-600">
                              <span className="truncate">{log.details || "No details provided"}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent className="w-[400px]">
                            <div className="space-y-3">
                              <div>
                                <h4 className="font-medium text-slate-900 mb-1">Details</h4>
                                <p className="text-sm text-slate-700">{log.details}</p>
                              </div>

                              {log.path && (
                                <div>
                                  <h4 className="font-medium text-slate-900 mb-1">Path</h4>
                                  <p className="text-sm font-mono text-slate-700 bg-slate-50 p-2 rounded">{log.path}</p>
                                </div>
                              )}

                              {log.changes && Object.keys(log.changes).length > 0 && (
                                <div>
                                  <h4 className="font-medium text-slate-900 mb-1">Changes</h4>
                                  <pre className="text-xs bg-slate-50 p-3 rounded overflow-auto max-h-[200px] text-slate-700">
                                    {JSON.stringify(log.changes, null, 2)}
                                  </pre>
                                </div>
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
              <div className="flex justify-center mt-6">
                <Button
                  variant="outline"
                  onClick={handleLoadMore}
                  disabled={loading}
                  className="border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  {loading ? "Loading..." : `Load More (${auditLogs.length} shown)`}
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}
