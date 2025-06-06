// app/dashboard/alarms/page.tsx - Updated with Your Color Palette
"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"
import {
  AlertTriangle,
  AlertCircle,
  Clock,
  CheckCircle,
  Filter,
  Search,
  Bell,
  BellOff,
  MessageSquare,
  User,
  MapPin,
  Settings,
  RefreshCw,
  Mail,
  Eye,
  EyeOff
} from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from "firebase/firestore"

interface Alarm {
  id: string
  name: string
  equipmentId: string
  equipmentName: string
  locationId: string
  locationName: string
  severity: 'warning' | 'critical' | 'info'
  message: string
  active: boolean
  acknowledged: boolean
  resolved: boolean
  timestamp: any
  acknowledgedBy?: string
  acknowledgedAt?: any
  resolvedBy?: string
  resolvedAt?: any
  notes?: string
}

interface AlarmAction {
  id: string
  alarmId: string
  action: 'acknowledged' | 'resolved' | 'note_added' | 'escalated'
  performedBy: string
  timestamp: any
  notes?: string
}

export default function AlarmsPage() {
  const { db } = useFirebase()
  const { user } = useAuth()
  const { toast } = useToast()

  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [alarmActions, setAlarmActions] = useState<AlarmAction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedAlarm, setSelectedAlarm] = useState<Alarm | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>("active")
  const [filterSeverity, setFilterSeverity] = useState<string>("all")
  const [filterLocation, setFilterLocation] = useState<string>("all")
  const [searchTerm, setSearchTerm] = useState("")
  const [noteText, setNoteText] = useState("")
  const [showResolved, setShowResolved] = useState(false)

  // Real-time alarm monitoring
  useEffect(() => {
    if (!db) return

    let alarmQuery

    if (showResolved) {
      // Show all alarms including resolved ones
      alarmQuery = query(
        collection(db, "alarms"),
        orderBy("timestamp", "desc")
      )
    } else {
      // Show only active alarms
      alarmQuery = query(
        collection(db, "alarms"),
        where("active", "==", true),
        orderBy("timestamp", "desc")
      )
    }

    const unsubscribe = onSnapshot(alarmQuery, (snapshot) => {
      const alarmData: Alarm[] = []
      snapshot.forEach((doc) => {
        alarmData.push({
          id: doc.id,
          ...doc.data()
        } as Alarm)
      })
      setAlarms(alarmData)
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db, showResolved])

  // Load alarm actions for detailed view
  useEffect(() => {
    if (!db || !selectedAlarm) return

    const actionsQuery = query(
      collection(db, "alarmActions"),
      where("alarmId", "==", selectedAlarm.id),
      orderBy("timestamp", "desc")
    )

    const unsubscribe = onSnapshot(actionsQuery, (snapshot) => {
      const actionData: AlarmAction[] = []
      snapshot.forEach((doc) => {
        actionData.push({
          id: doc.id,
          ...doc.data()
        } as AlarmAction)
      })
      setAlarmActions(actionData)
    })

    return () => unsubscribe()
  }, [db, selectedAlarm])

  // Acknowledge alarm
  const acknowledgeAlarm = async (alarm: Alarm) => {
    if (!db || !user) return

    try {
      await updateDoc(doc(db, "alarms", alarm.id), {
        acknowledged: true,
        acknowledgedBy: user.name || user.username || user.email || "Unknown User",
        acknowledgedAt: serverTimestamp()
      })

      // Add action record
      await addDoc(collection(db, "alarmActions"), {
        alarmId: alarm.id,
        action: "acknowledged",
        performedBy: user.name || user.username || user.email || "Unknown User",
        timestamp: serverTimestamp()
      })

      toast({
        title: "Alarm Acknowledged",
        description: `${alarm.name} has been acknowledged.`
      })
    } catch (error) {
      console.error("Error acknowledging alarm:", error)
      toast({
        title: "Error",
        description: "Failed to acknowledge alarm.",
        variant: "destructive"
      })
    }
  }

  // Resolve alarm
  const resolveAlarm = async (alarm: Alarm) => {
    if (!db || !user) return

    try {
      await updateDoc(doc(db, "alarms", alarm.id), {
        resolved: true,
        active: false,
        resolvedBy: user.name || user.username || user.email || "Unknown User",
        resolvedAt: serverTimestamp()
      })

      // Add action record
      await addDoc(collection(db, "alarmActions"), {
        alarmId: alarm.id,
        action: "resolved",
        performedBy: user.name || user.username || user.email || "Unknown User",
        timestamp: serverTimestamp(),
        notes: noteText || undefined
      })

      toast({
        title: "Alarm Resolved",
        description: `${alarm.name} has been resolved.`
      })

      setNoteText("")
      setSelectedAlarm(null)
    } catch (error) {
      console.error("Error resolving alarm:", error)
      toast({
        title: "Error",
        description: "Failed to resolve alarm.",
        variant: "destructive"
      })
    }
  }

  // Add note to alarm
  const addNote = async (alarm: Alarm) => {
    if (!db || !user || !noteText.trim()) return

    try {
      await addDoc(collection(db, "alarmActions"), {
        alarmId: alarm.id,
        action: "note_added",
        performedBy: user.name || user.username || user.email || "Unknown User",
        timestamp: serverTimestamp(),
        notes: noteText.trim()
      })

      toast({
        title: "Note Added",
        description: "Note has been added to the alarm."
      })

      setNoteText("")
    } catch (error) {
      console.error("Error adding note:", error)
      toast({
        title: "Error",
        description: "Failed to add note.",
        variant: "destructive"
      })
    }
  }

  // Filter and search alarms
  const filteredAlarms = alarms.filter(alarm => {
    // Status filter
    if (filterStatus === "active" && (!alarm.active)) return false
    if (filterStatus === "acknowledged" && !alarm.acknowledged) return false
    if (filterStatus === "unacknowledged" && alarm.acknowledged) return false
    if (filterStatus === "resolved" && !alarm.resolved) return false

    // Severity filter
    if (filterSeverity !== "all" && alarm.severity !== filterSeverity) return false

    // Location filter
    if (filterLocation !== "all" && alarm.locationId !== filterLocation) return false

    // Search filter
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase()
      return (
        alarm.name.toLowerCase().includes(searchLower) ||
        alarm.equipmentName.toLowerCase().includes(searchLower) ||
        alarm.locationName.toLowerCase().includes(searchLower) ||
        alarm.message.toLowerCase().includes(searchLower)
      )
    }

    return true
  })

  // Get unique locations for filter
  const uniqueLocations = Array.from(new Set(alarms.map(alarm => alarm.locationId)))

  // Get severity badge styling with your color palette
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case 'critical':
        return 'bg-red-50 text-red-700 border border-red-200'
      case 'warning':
        return 'bg-amber-50 text-amber-700 border border-amber-200'
      case 'info':
        return 'bg-sky-50 text-sky-700 border border-sky-200'
      default:
        return 'bg-slate-50 text-slate-700 border border-slate-200'
    }
  }

  // Get severity icon
  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'critical':
        return <AlertTriangle className="w-4 h-4" />
      case 'warning':
        return <AlertCircle className="w-4 h-4" />
      case 'info':
        return <Bell className="w-4 h-4" />
      default:
        return <AlertCircle className="w-4 h-4" />
    }
  }

  // Format timestamp
  const formatTimestamp = (timestamp: any) => {
    if (!timestamp) return "Unknown"
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp)
    return date.toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    })
  }

  // Get alarm counts for summary
  const alarmCounts = {
    total: alarms.length,
    active: alarms.filter(a => a.active).length,
    critical: alarms.filter(a => a.severity === 'critical' && a.active).length,
    warning: alarms.filter(a => a.severity === 'warning' && a.active).length,
    acknowledged: alarms.filter(a => a.acknowledged && a.active).length,
    unacknowledged: alarms.filter(a => !a.acknowledged && a.active).length
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#14b8a6] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading alarms...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Alarms Dashboard</h1>
            <p className="text-gray-500">Real-time equipment monitoring and alerts</p>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowResolved(!showResolved)}
              className="flex items-center gap-2 border-[#14b8a6]/20 text-[#14b8a6] hover:bg-[#14b8a6]/10"
            >
              {showResolved ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showResolved ? "Hide Resolved" : "Show Resolved"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Total</p>
                  <p className="text-2xl font-bold text-slate-900">{alarmCounts.total}</p>
                </div>
                <Bell className="w-8 h-8 text-slate-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-slate-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-600">Active</p>
                  <p className="text-2xl font-bold text-slate-900">{alarmCounts.active}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-sky-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Critical</p>
                  <p className="text-2xl font-bold text-red-600">{alarmCounts.critical}</p>
                </div>
                <AlertTriangle className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-200 bg-amber-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-amber-600">Warning</p>
                  <p className="text-2xl font-bold text-amber-600">{alarmCounts.warning}</p>
                </div>
                <AlertCircle className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-teal-200 bg-teal-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-teal-600">Acknowledged</p>
                  <p className="text-2xl font-bold text-teal-600">{alarmCounts.acknowledged}</p>
                </div>
                <CheckCircle className="w-8 h-8 text-teal-500" />
              </div>
            </CardContent>
          </Card>

          <Card className="border-red-200 bg-red-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-red-600">Unacknowledged</p>
                  <p className="text-2xl font-bold text-red-600">{alarmCounts.unacknowledged}</p>
                </div>
                <BellOff className="w-8 h-8 text-red-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-6 border-slate-200">
          <CardContent className="p-6">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-500" />
                <Input
                  placeholder="Search alarms..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-64 border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
                />
              </div>

              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-48 border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active Alarms</SelectItem>
                  <SelectItem value="acknowledged">Acknowledged</SelectItem>
                  <SelectItem value="unacknowledged">Unacknowledged</SelectItem>
                  <SelectItem value="resolved">Resolved</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSeverity} onValueChange={setFilterSeverity}>
                <SelectTrigger className="w-48 border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Severities</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="info">Info</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterLocation} onValueChange={setFilterLocation}>
                <SelectTrigger className="w-48 border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Locations</SelectItem>
                  {uniqueLocations.map(locationId => (
                    <SelectItem key={locationId} value={locationId}>
                      {alarms.find(a => a.locationId === locationId)?.locationName || locationId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={() => {
                  setSearchTerm("")
                  setFilterStatus("active")
                  setFilterSeverity("all")
                  setFilterLocation("all")
                }}
                className="flex items-center gap-2 border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                <Filter className="w-4 h-4" />
                Clear Filters
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Alarms List */}
        <div className="grid gap-4">
          {filteredAlarms.length === 0 ? (
            <Card className="border-slate-200">
              <CardContent className="p-8 text-center">
                <Bell className="w-12 h-12 text-slate-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-slate-900 mb-2">No Alarms Found</h3>
                <p className="text-slate-500">
                  {searchTerm || filterStatus !== "active" || filterSeverity !== "all" || filterLocation !== "all"
                    ? "No alarms match your current filters."
                    : "All systems are operating normally."}
                </p>
              </CardContent>
            </Card>
          ) : (
            filteredAlarms.map((alarm) => (
              <Card key={alarm.id} className={`hover:shadow-md transition-shadow border-slate-200 ${
                alarm.severity === 'critical' ? 'border-l-4 border-l-red-500' :
                alarm.severity === 'warning' ? 'border-l-4 border-l-amber-500' :
                'border-l-4 border-l-sky-500'
              }`}>
                <CardContent className="p-6">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge className={`${getSeverityBadge(alarm.severity)} flex items-center gap-1`}>
                          {getSeverityIcon(alarm.severity)}
                          {alarm.severity.toUpperCase()}
                        </Badge>

                        {alarm.acknowledged && (
                          <Badge className="bg-[#14b8a6]/10 text-[#14b8a6] border border-[#14b8a6]/20">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Acknowledged
                          </Badge>
                        )}

                        {alarm.resolved && (
                          <Badge className="bg-[#14b8a6]/10 text-[#14b8a6] border border-[#14b8a6]/20">
                            <CheckCircle className="w-3 h-3 mr-1" />
                            Resolved
                          </Badge>
                        )}
                      </div>

                      <h3 className="text-lg font-semibold text-slate-900 mb-2">{alarm.name}</h3>
                      <p className="text-slate-600 mb-3">{alarm.message}</p>

                      <div className="flex items-center gap-4 text-sm text-slate-500">
                        <div className="flex items-center gap-1">
                          <Settings className="w-4 h-4" />
                          {alarm.equipmentName}
                        </div>
                        <div className="flex items-center gap-1">
                          <MapPin className="w-4 h-4" />
                          {alarm.locationName}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-4 h-4" />
                          {formatTimestamp(alarm.timestamp)}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 ml-4">
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setSelectedAlarm(alarm)}
                            className="border-slate-200 text-slate-700 hover:bg-slate-50"
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            View Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Alarm Details</DialogTitle>
                          </DialogHeader>

                          {selectedAlarm && (
                            <div className="space-y-6">
                              {/* Alarm Info */}
                              <div className="grid grid-cols-2 gap-4">
                                <div>
                                  <label className="text-sm font-medium text-slate-600">Equipment</label>
                                  <p className="text-sm text-slate-900">{selectedAlarm.equipmentName}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-slate-600">Location</label>
                                  <p className="text-sm text-slate-900">{selectedAlarm.locationName}</p>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-slate-600">Severity</label>
                                  <Badge className={getSeverityBadge(selectedAlarm.severity)}>
                                    {selectedAlarm.severity.toUpperCase()}
                                  </Badge>
                                </div>
                                <div>
                                  <label className="text-sm font-medium text-slate-600">Status</label>
                                  <div className="flex gap-2">
                                    {selectedAlarm.acknowledged && (
                                      <Badge className="bg-[#14b8a6]/10 text-[#14b8a6]">Acknowledged</Badge>
                                    )}
                                    {selectedAlarm.resolved && (
                                      <Badge className="bg-[#14b8a6]/10 text-[#14b8a6]">Resolved</Badge>
                                    )}
                                    {selectedAlarm.active && !selectedAlarm.resolved && (
                                      <Badge className="bg-red-50 text-red-800">Active</Badge>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Message */}
                              <div>
                                <label className="text-sm font-medium text-slate-600">Message</label>
                                <p className="text-sm text-slate-900 mt-1">{selectedAlarm.message}</p>
                              </div>

                              {/* Actions History */}
                              <div>
                                <label className="text-sm font-medium text-slate-600 mb-3 block">Action History</label>
                                <div className="space-y-2 max-h-40 overflow-y-auto">
                                  {alarmActions.map((action) => (
                                    <div key={action.id} className="bg-slate-50 p-3 rounded-lg">
                                      <div className="flex items-center justify-between">
                                        <span className="font-medium text-sm">
                                          {action.action.replace('_', ' ').toUpperCase()}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          {formatTimestamp(action.timestamp)}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-600">By: {action.performedBy}</p>
                                      {action.notes && (
                                        <p className="text-sm text-slate-800 mt-1">{action.notes}</p>
                                      )}
                                    </div>
                                  ))}

                                  {/* Initial alarm creation */}
                                  <div className="bg-slate-50 p-3 rounded-lg">
                                    <div className="flex items-center justify-between">
                                      <span className="font-medium text-sm">ALARM CREATED</span>
                                      <span className="text-xs text-slate-500">
                                        {formatTimestamp(selectedAlarm.timestamp)}
                                      </span>
                                    </div>
                                    <p className="text-xs text-slate-600">By: Monitoring System</p>
                                  </div>
                                </div>
                              </div>

                              {/* Add Note */}
                              <div>
                                <label className="text-sm font-medium text-slate-600">Add Note</label>
                                <Textarea
                                  value={noteText}
                                  onChange={(e) => setNoteText(e.target.value)}
                                  placeholder="Add a note about this alarm..."
                                  className="mt-1 border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]"
                                />
                                <Button
                                  onClick={() => addNote(selectedAlarm)}
                                  disabled={!noteText.trim()}
                                  className="mt-2 bg-[#14b8a6] hover:bg-[#14b8a6]/90"
                                  size="sm"
                                >
                                  <MessageSquare className="w-4 h-4 mr-1" />
                                  Add Note
                                </Button>
                              </div>

                              {/* Action Buttons */}
                              <div className="flex gap-3 pt-4 border-t border-slate-200">
                                {!selectedAlarm.acknowledged && (
                                  <Button
                                    onClick={() => acknowledgeAlarm(selectedAlarm)}
                                    className="bg-[#14b8a6] hover:bg-[#14b8a6]/90"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Acknowledge
                                  </Button>
                                )}

                                {selectedAlarm.acknowledged && !selectedAlarm.resolved && (
                                  <Button
                                    onClick={() => resolveAlarm(selectedAlarm)}
                                    className="bg-[#14b8a6] hover:bg-[#14b8a6]/90"
                                  >
                                    <CheckCircle className="w-4 h-4 mr-1" />
                                    Resolve
                                  </Button>
                                )}
                              </div>
                            </div>
                          )}
                        </DialogContent>
                      </Dialog>

                      {!alarm.acknowledged && alarm.active && (
                        <Button
                          onClick={() => acknowledgeAlarm(alarm)}
                          size="sm"
                          className="bg-[#14b8a6] hover:bg-[#14b8a6]/90"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Acknowledge
                        </Button>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
