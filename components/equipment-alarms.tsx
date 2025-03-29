"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { AlertCircle, Check } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { AdminGuard } from "@/components/admin-guard"

interface EquipmentAlarmsProps {
  equipment: any
}

export function EquipmentAlarms({ equipment }: EquipmentAlarmsProps) {
  const [alarms, setAlarms] = useState<any[]>([])
  const [alarmHistory, setAlarmHistory] = useState<any[]>([])
  const [alarmConfig, setAlarmConfig] = useState<any>(equipment.alarmConfig || {})
  const { db } = useFirebase()
  const { toast } = useToast()

  useEffect(() => {
    const fetchAlarms = async () => {
      if (!db || !equipment.id) return

      try {
        const alarmsRef = db
          .collection("alarms")
          .where("equipmentId", "==", equipment.id)
          .where("active", "==", true)
          .orderBy("timestamp", "desc")

        const snapshot = await alarmsRef.get()

        const alarmData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date(),
        }))

        setAlarms(alarmData)
      } catch (error) {
        console.error("Error fetching alarms:", error)
      }
    }

    const fetchAlarmHistory = async () => {
      if (!db || !equipment.id) return

      try {
        const historyRef = db
          .collection("alarms")
          .where("equipmentId", "==", equipment.id)
          .where("active", "==", false)
          .orderBy("timestamp", "desc")
          .limit(50)

        const snapshot = await historyRef.get()

        const historyData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
          timestamp: doc.data().timestamp?.toDate?.() || new Date(),
          resolvedTimestamp: doc.data().resolvedTimestamp?.toDate?.() || new Date(),
        }))

        setAlarmHistory(historyData)
      } catch (error) {
        console.error("Error fetching alarm history:", error)
      }
    }

    fetchAlarms()
    fetchAlarmHistory()
  }, [db, equipment.id])

  const handleAcknowledgeAlarm = async (alarmId: string) => {
    if (!db) return

    try {
      await db.collection("alarms").doc(alarmId).update({
        acknowledged: true,
        acknowledgedTimestamp: new Date(),
      })

      // Update local state
      setAlarms(
        alarms.map((alarm) =>
          alarm.id === alarmId ? { ...alarm, acknowledged: true, acknowledgedTimestamp: new Date() } : alarm,
        ),
      )

      toast({
        title: "Alarm Acknowledged",
        description: "The alarm has been acknowledged",
      })
    } catch (error) {
      console.error("Error acknowledging alarm:", error)
      toast({
        title: "Error",
        description: "Failed to acknowledge alarm",
        variant: "destructive",
      })
    }
  }

  const handleResolveAlarm = async (alarmId: string) => {
    if (!db) return

    try {
      await db.collection("alarms").doc(alarmId).update({
        active: false,
        resolved: true,
        resolvedTimestamp: new Date(),
      })

      // Update local state
      const resolvedAlarm = alarms.find((alarm) => alarm.id === alarmId)

      if (resolvedAlarm) {
        setAlarms(alarms.filter((alarm) => alarm.id !== alarmId))
        setAlarmHistory([
          {
            ...resolvedAlarm,
            active: false,
            resolved: true,
            resolvedTimestamp: new Date(),
          },
          ...alarmHistory,
        ])
      }

      toast({
        title: "Alarm Resolved",
        description: "The alarm has been resolved",
      })
    } catch (error) {
      console.error("Error resolving alarm:", error)
      toast({
        title: "Error",
        description: "Failed to resolve alarm",
        variant: "destructive",
      })
    }
  }

  const handleAlarmConfigChange = (key: string, field: string, value: any) => {
    setAlarmConfig({
      ...alarmConfig,
      [key]: {
        ...alarmConfig[key],
        [field]: value,
      },
    })
  }

  const handleSaveAlarmConfig = async () => {
    if (!db) return

    try {
      await db.collection("equipment").doc(equipment.id).update({
        alarmConfig,
      })

      toast({
        title: "Alarm Configuration Saved",
        description: "The alarm configuration has been updated",
      })
    } catch (error) {
      console.error("Error saving alarm configuration:", error)
      toast({
        title: "Error",
        description: "Failed to save alarm configuration",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Tabs defaultValue="active">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="active">Active Alarms</TabsTrigger>
          <TabsTrigger value="history">Alarm History</TabsTrigger>
          <TabsTrigger value="config">Alarm Configuration</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
                Active Alarms
              </CardTitle>
              <CardDescription>
                {equipment.name} - {equipment.type}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alarms.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <Check className="h-10 w-10 text-green-500 mb-2" />
                  <p className="text-lg font-medium">No Active Alarms</p>
                  <p className="text-sm text-muted-foreground">This equipment is operating normally</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alarm</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Time</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alarms.map((alarm) => (
                      <TableRow key={alarm.id}>
                        <TableCell className="font-medium">{alarm.name}</TableCell>
                        <TableCell>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              alarm.severity === "critical"
                                ? "bg-red-100 text-red-800"
                                : alarm.severity === "warning"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : "bg-blue-100 text-blue-800"
                            }`}
                          >
                            {alarm.severity}
                          </span>
                        </TableCell>
                        <TableCell>
                          {alarm.timestamp instanceof Date
                            ? alarm.timestamp.toLocaleString()
                            : new Date(alarm.timestamp).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {alarm.acknowledged ? (
                            <span className="text-yellow-600">Acknowledged</span>
                          ) : (
                            <span className="text-red-600">Unacknowledged</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            {!alarm.acknowledged && (
                              <Button variant="outline" size="sm" onClick={() => handleAcknowledgeAlarm(alarm.id)}>
                                Acknowledge
                              </Button>
                            )}
                            <Button variant="outline" size="sm" onClick={() => handleResolveAlarm(alarm.id)}>
                              Resolve
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <CardTitle>Alarm History</CardTitle>
              <CardDescription>
                {equipment.name} - {equipment.type}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {alarmHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-6 text-center">
                  <p className="text-lg font-medium">No Alarm History</p>
                  <p className="text-sm text-muted-foreground">
                    No previous alarms have been recorded for this equipment
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alarm</TableHead>
                      <TableHead>Severity</TableHead>
                      <TableHead>Occurred</TableHead>
                      <TableHead>Resolved</TableHead>
                      <TableHead>Duration</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {alarmHistory.map((alarm) => {
                      const startTime = alarm.timestamp instanceof Date ? alarm.timestamp : new Date(alarm.timestamp)

                      const endTime =
                        alarm.resolvedTimestamp instanceof Date
                          ? alarm.resolvedTimestamp
                          : new Date(alarm.resolvedTimestamp)

                      const durationMs = endTime.getTime() - startTime.getTime()
                      const durationMinutes = Math.floor(durationMs / 60000)
                      const durationHours = Math.floor(durationMinutes / 60)
                      const remainingMinutes = durationMinutes % 60

                      let durationText = ""
                      if (durationHours > 0) {
                        durationText = `${durationHours}h ${remainingMinutes}m`
                      } else {
                        durationText = `${durationMinutes}m`
                      }

                      return (
                        <TableRow key={alarm.id}>
                          <TableCell className="font-medium">{alarm.name}</TableCell>
                          <TableCell>
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                alarm.severity === "critical"
                                  ? "bg-red-100 text-red-800"
                                  : alarm.severity === "warning"
                                    ? "bg-yellow-100 text-yellow-800"
                                    : "bg-blue-100 text-blue-800"
                              }`}
                            >
                              {alarm.severity}
                            </span>
                          </TableCell>
                          <TableCell>{startTime.toLocaleString()}</TableCell>
                          <TableCell>{endTime.toLocaleString()}</TableCell>
                          <TableCell>{durationText}</TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="config" className="space-y-4 pt-4">
          <AdminGuard>
            <Card>
              <CardHeader>
                <CardTitle>Alarm Configuration</CardTitle>
                <CardDescription>Configure alarm thresholds and notifications for {equipment.name}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {Object.entries(alarmConfig).map(([key, config]: [string, any]) => (
                  <div key={key} className="space-y-4 p-4 border rounded-lg">
                    <div className="flex items-center justify-between">
                      <h3 className="text-lg font-medium">{config.label}</h3>
                      <Switch
                        checked={config.enabled}
                        onCheckedChange={(checked) => handleAlarmConfigChange(key, "enabled", checked)}
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor={`${key}-high`}>High Threshold</Label>
                        <Input
                          id={`${key}-high`}
                          type="number"
                          value={config.highThreshold}
                          onChange={(e) =>
                            handleAlarmConfigChange(key, "highThreshold", Number.parseFloat(e.target.value))
                          }
                        />
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor={`${key}-low`}>Low Threshold</Label>
                        <Input
                          id={`${key}-low`}
                          type="number"
                          value={config.lowThreshold}
                          onChange={(e) =>
                            handleAlarmConfigChange(key, "lowThreshold", Number.parseFloat(e.target.value))
                          }
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor={`${key}-severity`}>Alarm Severity</Label>
                      <select
                        id={`${key}-severity`}
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                        value={config.severity}
                        onChange={(e) => handleAlarmConfigChange(key, "severity", e.target.value)}
                      >
                        <option value="info">Info</option>
                        <option value="warning">Warning</option>
                        <option value="critical">Critical</option>
                      </select>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id={`${key}-notify`}
                        checked={config.notify}
                        onCheckedChange={(checked) => handleAlarmConfigChange(key, "notify", checked)}
                      />
                      <Label htmlFor={`${key}-notify`}>Send Notifications</Label>
                    </div>
                  </div>
                ))}

                <div className="flex justify-end">
                  <Button onClick={handleSaveAlarmConfig}>Save Configuration</Button>
                </div>
              </CardContent>
            </Card>
          </AdminGuard>
        </TabsContent>
      </Tabs>
    </div>
  )
}

