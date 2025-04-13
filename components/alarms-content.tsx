"use client"

import type React from "react"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCaption, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import {
  collection,
  doc,
  getDocs,
  updateDoc,
  query,
  where,
  limit,
  Timestamp,
  addDoc,
  getDoc,
  orderBy,
  deleteDoc,
} from "firebase/firestore"
import { ref, onValue } from "firebase/database"
import { secondaryDb } from "@/lib/secondary-firebase" // Import the RTDB directly
import {
  Settings,
  Bell,
  BellOff,
  AlertTriangle,
  Clock,
  CheckCircle,
  Filter,
  Search,
  RefreshCw,
  Loader2,
  X,
  Check,
  AlertCircle,
  Info,
  Thermometer,
  Droplets,
  Fan,
  Trash2,
  Download,
} from "lucide-react"

// Add this at the very top of the file, right after the imports
console.log("Alarms Content component file is being loaded")
console.log("Secondary DB available:", !!secondaryDb)

// Types
interface Alarm {
  id: string
  name: string
  equipmentId: string
  locationId: string
  locationName?: string
  equipmentName?: string
  severity: "info" | "warning" | "critical"
  message: string
  active: boolean
  acknowledged: boolean
  resolved: boolean
  timestamp: Date
  acknowledgedTimestamp?: Date
  resolvedTimestamp?: Date
  acknowledgedBy?: string
  resolvedBy?: string
}

interface EquipmentMetric {
  id: string
  name: string
  value: number
  unit: string
  timestamp: Date
}

interface ThresholdSetting {
  id: string
  equipmentId: string
  metricPath: string // Path to the metric in the equipment document
  metricName: string
  warningThreshold?: number
  criticalThreshold?: number
  minThreshold?: number
  maxThreshold?: number
  enabled: boolean
  locationId?: string // Added to help with metrics lookup
  systemId?: string // Added to help with metrics lookup
}

interface Technician {
  id: string
  name: string
  email: string
  phone: string
  assignedLocations: string[]
  specialties?: {
    level: string
    type: string
  }[]
}

interface User {
  id: string
  name: string
  email: string
  responsibleFor: string
  roles: string[]
}

// Modify the component function to add basic logging
export default function AlarmsContent() {
  console.log("AlarmsContent component is rendering")

  const router = useRouter()
  const { db } = useFirebase() // Only get Firestore from context
  const { user } = useAuth()
  const { toast } = useToast()
  const rtdb = secondaryDb // Use the directly imported RTDB

  console.log("Firebase contexts loaded:", {
    dbExists: !!db,
    rtdbExists: !!rtdb,
    userExists: !!user,
  })

  // State
  const [alarms, setAlarms] = useState<Alarm[]>([])
  const [filteredAlarms, setFilteredAlarms] = useState<Alarm[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState("all") // all, active, acknowledged, resolved
  const [searchTerm, setSearchTerm] = useState("")
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [selectedSeverity, setSelectedSeverity] = useState<string | null>(null)
  const [equipmentMetrics, setEquipmentMetrics] = useState<Record<string, EquipmentMetric[]>>({})
  const [thresholdSettings, setThresholdSettings] = useState<ThresholdSetting[]>([])
  const [monitoringActive, setMonitoringActive] = useState(true)
  const [lastCheck, setLastCheck] = useState<Date | null>(null)
  const [checkInterval, setCheckInterval] = useState(60000) // 1 minute in milliseconds
  const [locationTechnicians, setLocationTechnicians] = useState<Record<string, Technician[]>>({})
  const [locationUsers, setLocationUsers] = useState<Record<string, User[]>>({})
  const [rtdbData, setRtdbData] = useState<any>(null)
  const [thresholdsLoaded, setThresholdsLoaded] = useState(false)
  const [thresholdsLoading, setThresholdsLoading] = useState(false) // Add a loading state for thresholds
  const [isAutoRefreshing, setIsAutoRefreshing] = useState(true) // Add state for auto-refresh
  const [personnelDataLoaded, setPersonnelDataLoaded] = useState(false)
  const [isExporting, setIsExporting] = useState(false) // Add state for export operation

  // Add this function to send alarm emails
  const sendAlarmEmail = useCallback(
    async (alarmData: any, alarmId: string) => {
      try {
        // Get technicians and users for this location
        const locationId = alarmData.locationId
        const techs = locationTechnicians[locationId] || []
        const users = locationUsers[locationId] || []

        // Combine emails from both groups
        const techEmails = techs.map((tech) => tech.email).filter(Boolean)
        const userEmails = users.map((user) => user.email).filter(Boolean)
        const allEmails = [...new Set([...techEmails, ...userEmails])]

        // Get tech names for the email
        const techNames = techs.map((tech) => tech.name).join(", ")

        // Skip email sending if no recipients or if we're in development mode
        if (allEmails.length === 0 || window.location.hostname === "localhost") {
          console.log("Skipping email send - no recipients or in development mode")
          return
        }

        try {
          const response = await fetch("/api/send-alarm-email", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              alarmType: alarmData.name,
              details: alarmData.message,
              locationId: alarmData.locationId,
              alarmId: alarmId,
              severity: alarmData.severity,
              recipients: allEmails,
              assignedTechs: techNames || "None",
            }),
          })

          if (!response.ok) {
            console.warn("Email API returned error status:", response.status)
          } else {
            console.log("Alarm email sent successfully to", allEmails.length, "recipients")
          }
        } catch (error) {
          console.warn("Email sending failed but continuing alarm creation:", error)
        }
      } catch (error) {
        console.error("Error in sendAlarmEmail function:", error)
        // Don't throw the error so alarm creation can continue
      }
    },
    [locationTechnicians, locationUsers],
  )

  // Fetch RTDB data
  useEffect(() => {
    if (!rtdb) {
      console.log("RTDB not available for fetching metrics")
      return
    }

    console.log("Setting up RTDB listener for /locations")
    const locationsRef = ref(rtdb, "/locations")

    const unsubscribe = onValue(
      locationsRef,
      (snapshot) => {
        const data = snapshot.val()
        console.log("RTDB data updated:", data ? Object.keys(data).length : 0, "locations")
        setRtdbData(data || {})
      },
      (error) => {
        console.error("Error fetching RTDB data:", error)
      },
    )

    return () => {
      console.log("Cleaning up RTDB listener")
      unsubscribe()
    }
  }, [rtdb])

  // Fetch alarms from Firebase
  const fetchAlarms = useCallback(async () => {
    if (!db) return

    setLoading(true)
    try {
      // Create query based on filter
      let alarmsQuery
      const alarmsRef = collection(db, "alarms")

      if (filter === "active") {
        // Use a simple query without orderBy to avoid composite index requirement
        alarmsQuery = query(alarmsRef, where("active", "==", true))
      } else if (filter === "acknowledged") {
        alarmsQuery = query(alarmsRef, where("acknowledged", "==", true), where("active", "==", true))
      } else if (filter === "resolved") {
        alarmsQuery = query(alarmsRef, where("resolved", "==", true))
      } else {
        // Only use orderBy on the "all" filter
        alarmsQuery = query(alarmsRef, orderBy("timestamp", "desc"), limit(100))
      }

      const alarmsSnapshot = await getDocs(alarmsQuery)

      // Get all alarms and then sort them in memory
      const alarmsData = alarmsSnapshot.docs.map((doc) => {
        const data = doc.data()
        return {
          id: doc.id,
          ...data,
          timestamp: data.timestamp instanceof Timestamp ? data.timestamp.toDate() : new Date(data.timestamp),
          acknowledgedTimestamp:
            data.acknowledgedTimestamp instanceof Timestamp
              ? data.acknowledgedTimestamp.toDate()
              : data.acknowledgedTimestamp
                ? new Date(data.acknowledgedTimestamp)
                : undefined,
          resolvedTimestamp:
            data.resolvedTimestamp instanceof Timestamp
              ? data.resolvedTimestamp.toDate()
              : data.resolvedTimestamp
                ? new Date(data.resolvedTimestamp)
                : undefined,
        } as Alarm
      })

      // Sort in memory instead of in the query
      const sortedAlarmsData = [...alarmsData].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

      // Apply limit after sorting
      const limitedAlarmsData = sortedAlarmsData.slice(0, 100)

      setAlarms(limitedAlarmsData)
      setFilteredAlarms(limitedAlarmsData)
    } catch (error) {
      console.error("Error fetching alarms:", error)
      toast({
        title: "Error",
        description: "Failed to load alarms",
        variant: "destructive",
      })
    } finally {
      setLoading(false)
    }
  }, [db, filter, toast])

  // Extract thresholds from equipment document
  const extractThresholdsFromEquipment = async () => {
    if (!db) {
      console.log("DB is not available for threshold extraction")
      return []
    }

    try {
      console.log("🔍 Starting threshold extraction from equipment documents")
      const equipmentRef = collection(db, "equipment")
      const equipmentSnapshot = await getDocs(equipmentRef)
      console.log(`📊 Found ${equipmentSnapshot.docs.length} equipment documents to check for thresholds`)

      // Log the first equipment document to see its structure
      if (equipmentSnapshot.docs.length > 0) {
        const firstDoc = equipmentSnapshot.docs[0]
        console.log("First equipment document structure:", {
          id: firstDoc.id,
          name: firstDoc.data().name,
          hasThresholds: !!firstDoc.data().thresholds,
        })
      }

      const thresholds: ThresholdSetting[] = []

      for (const docSnapshot of equipmentSnapshot.docs) {
        const equipmentData = docSnapshot.data()
        const equipmentId = docSnapshot.id
        const locationId = equipmentData.locationId || ""
        const systemId = equipmentData.system || equipmentData.name || ""

        console.log(`📌 Processing equipment: ${equipmentId}`, {
          name: equipmentData.name,
          type: equipmentData.type,
          system: equipmentData.system,
          locationId,
        })

        // Skip if no thresholds defined
        if (!equipmentData.thresholds) {
          console.log(`❌ No thresholds found for equipment ${equipmentId}`)
          continue
        }

        console.log(`✅ Found thresholds for ${equipmentId} (${equipmentData.name})`)

        // Process thresholds based on their structure
        const processNestedThresholds = (parentPath: string, thresholdObj: any, parentName: string) => {
          console.log(`  Processing threshold at ${parentPath || "root"}:`, thresholdObj)

          // Check if this object has min/max properties directly
          if (thresholdObj.min !== undefined || thresholdObj.max !== undefined) {
            console.log(
              `  ✅ Found min/max threshold at ${parentPath || "root"}: min=${thresholdObj.min}, max=${thresholdObj.max}`,
            )
            thresholds.push({
              id: `${equipmentId}-${parentPath.replace(/\//g, "-")}`,
              equipmentId,
              metricPath: parentPath,
              metricName: parentName || "Default",
              minThreshold: thresholdObj.min,
              maxThreshold: thresholdObj.max,
              enabled: true,
              locationId,
              systemId,
            })
            return
          }

          // Otherwise, iterate through properties looking for nested objects
          Object.entries(thresholdObj).forEach(([key, value]) => {
            if (typeof value === "object" && value !== null) {
              const newPath = parentPath ? `${parentPath}/${key}` : key
              const newName = parentName ? `${parentName} ${key}` : key
              processNestedThresholds(newPath, value, newName)
            }
          })
        }

        // Start processing from the root thresholds object
        processNestedThresholds("", equipmentData.thresholds, "")
      }

      console.log(`🎯 Extracted ${thresholds.length} thresholds from equipment documents`)

      // Log a sample of the extracted thresholds
      if (thresholds.length > 0) {
        console.log("Sample thresholds:", thresholds.slice(0, 3))
      }

      return thresholds
    } catch (error) {
      console.error("❌ Error extracting thresholds from equipment:", error)
      return []
    }
  }

  // Function to fetch technicians and users for locations
  const fetchLocationPersonnel = async () => {
    if (!db) return

    try {
      // Fetch all technicians
      const techniciansRef = collection(db, "technicians")
      const techniciansSnapshot = await getDocs(techniciansRef)

      const technicians = techniciansSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as Technician,
      )

      // Fetch all users
      const usersRef = collection(db, "users")
      const usersSnapshot = await getDocs(usersRef)

      const users = usersSnapshot.docs.map(
        (doc) =>
          ({
            id: doc.id,
            ...doc.data(),
          }) as User,
      )

      // Map technicians to locations
      const techMap: Record<string, Technician[]> = {}
      technicians.forEach((tech) => {
        if (tech.assignedLocations && Array.isArray(tech.assignedLocations)) {
          tech.assignedLocations.forEach((locationId) => {
            if (!techMap[locationId]) {
              techMap[locationId] = []
            }
            techMap[locationId].push(tech)
          })
        }
      })

      // Map users to locations
      const userMap: Record<string, User[]> = {}
      users.forEach((user) => {
        if (user.responsibleFor) {
          const locationIds = user.responsibleFor.split(",").map((id) => id.trim())
          locationIds.forEach((locationId) => {
            if (!userMap[locationId]) {
              userMap[locationId] = []
            }
            userMap[locationId].push(user)
          })
        }
      })

      setLocationTechnicians(techMap)
      setLocationUsers(userMap)
      setPersonnelDataLoaded(true)

      console.log("Personnel data loaded:", {
        technicians: Object.keys(techMap).length,
        users: Object.keys(userMap).length,
      })
    } catch (error) {
      console.error("Error fetching personnel data:", error)
      toast({
        title: "Error",
        description: "Failed to load personnel data",
        variant: "destructive",
      })
    }
  }

  // Function to get location name from ID
  const getLocationName = async (locationId: string) => {
    if (!db || !rtdbData) return null

    console.log(`Attempting to resolve location name for ID: ${locationId}`)

    try {
      // First try to get from Firestore
      console.log(`Checking Firestore for location with id=${locationId}`)
      const locationsRef = collection(db, "locations")
      const locationQuery = query(locationsRef, where("id", "==", locationId), limit(1))
      const locationSnapshot = await getDocs(locationQuery)

      if (!locationSnapshot.empty) {
        const name = locationSnapshot.docs[0].data().name
        console.log(`Found in Firestore by id field: ${name || "No name field"}`)
        return name || null
      }

      // If not found in Firestore, try RTDB
      if (rtdbData) {
        console.log(`Checking RTDB for location with id=${locationId}`)

        // Search through all locations in RTDB
        for (const [key, value] of Object.entries(rtdbData)) {
          const locationData = value as any
          if (locationData.id === locationId) {
            // Found a match by id
            console.log(`Found location in RTDB with matching id: ${key}`)

            // Try to get the name from Firestore using the key
            const locationDocRef = doc(db, "locations", key)
            const locationDoc = await getDoc(locationDocRef)

            if (locationDoc.exists() && locationDoc.data().name) {
              console.log(`Found name in Firestore for key ${key}: ${locationDoc.data().name}`)
              return locationDoc.data().name
            }

            // If no name in Firestore, use the key as the name
            console.log(`Using location key as name: ${key}`)
            return key
          }
        }
      }

      console.log(`No location found for ID ${locationId} in any data source`)
      return null
    } catch (error) {
      console.error("Error getting location name:", error)
      return null
    }
  }

  // Get metric value from RTDB data
  const getMetricValue = useCallback(
    (locationId: string, systemId: string, metricName: string): number | null => {
      if (!rtdbData) {
        console.log("No RTDB data available")
        return null
      }

      try {
        // First, find the location key that matches the locationId
        let locationKey = null

        // Try direct match first
        if (rtdbData[locationId]) {
          locationKey = locationId
        } else {
          // If not found directly, search through all locations
          console.log(`Location ${locationId} not found directly, searching through all locations`)
          console.log(`Available locations: ${Object.keys(rtdbData).join(", ")}`)

          // Try to find a location with a matching ID property
          for (const [key, value] of Object.entries(rtdbData)) {
            const locationData = value as any
            if (locationData.id === locationId) {
              locationKey = key
              console.log(`Found location with matching ID: ${key}`)
              break
            }
          }

          if (!locationKey) {
            console.log(`No location found for ID: ${locationId}`)
            return null
          }
        }

        // Check if location has systems
        if (!rtdbData[locationKey].systems) {
          console.log(`No systems found for location ${locationKey}`)
          return null
        }

        // Check if system exists
        if (!rtdbData[locationKey].systems[systemId]) {
          console.log(`System ${systemId} not found in location ${locationKey}`)

          // Try to find a system with a similar name
          const systemKeys = Object.keys(rtdbData[locationKey].systems)
          console.log(`Available systems in ${locationKey}: ${systemKeys.join(", ")}`)

          // Try case-insensitive match with more flexible matching
          const systemMatch = systemKeys.find((key) => {
            // Try exact match first (case insensitive)
            if (key.toLowerCase() === systemId.toLowerCase()) {
              return true
            }

            // Try partial matches
            if (
              key.toLowerCase().includes(systemId.toLowerCase()) ||
              systemId.toLowerCase().includes(key.toLowerCase())
            ) {
              return true
            }

            // Try matching by type (if systemId contains a type like "Boiler", "AHU", etc.)
            const commonTypes = ["boiler", "ahu", "chiller", "pump", "fan", "vav", "rtu", "fcu"]
            for (const type of commonTypes) {
              if (systemId.toLowerCase().includes(type) && key.toLowerCase().includes(type)) {
                return true
              }
            }

            return false
          })

          if (systemMatch) {
            console.log(`Found system with similar name: ${systemMatch}`)
            systemId = systemMatch
          } else {
            // If no match found, try looking for any system that might contain similar metrics
            // This is a fallback for cases where the system name is completely different
            if (metricName.toLowerCase().includes("temperature") || metricName.toLowerCase().includes("humidity")) {
              // For temperature/humidity metrics, try to find any system that has these metrics
              for (const sysKey of systemKeys) {
                const sysMetrics = rtdbData[locationKey].systems[sysKey].metrics
                if (
                  sysMetrics &&
                  Object.keys(sysMetrics).some(
                    (m) => m.toLowerCase().includes("temperature") || m.toLowerCase().includes("humidity"),
                  )
                ) {
                  console.log(`Found alternative system with relevant metrics: ${sysKey}`)
                  systemId = sysKey
                  return null // We'll retry with the new systemId
                }
              }
            }
            return null
          }
        }

        // Check if system has metrics
        if (!rtdbData[locationKey].systems[systemId].metrics) {
          console.log(`No metrics found for system ${systemId} in location ${locationKey}`)
          return null
        }

        // Get the metrics object
        const metrics = rtdbData[locationKey].systems[systemId].metrics
        console.log(`Available metrics for ${locationKey}/${systemId}:`, Object.keys(metrics))

        // Try exact match first
        if (metrics[metricName] !== undefined) {
          const value = metrics[metricName]
          console.log(`Found exact match for metric ${metricName}: ${value}`)
          return typeof value === "number" ? value : Number.parseFloat(value)
        }

        // Try case-insensitive match
        const metricNameLower = metricName.toLowerCase()
        for (const key of Object.keys(metrics)) {
          if (key.toLowerCase() === metricNameLower) {
            const value = metrics[key]
            console.log(`Found case-insensitive match for metric ${metricName} -> ${key}: ${value}`)
            return typeof value === "number" ? value : Number.parseFloat(value)
          }
        }

        // Try partial match (if metric name contains the search term or vice versa)
        for (const key of Object.keys(metrics)) {
          if (key.toLowerCase().includes(metricNameLower) || metricNameLower.includes(key.toLowerCase())) {
            const value = metrics[key]
            console.log(`Found partial match for metric ${metricName} -> ${key}: ${value}`)
            return typeof value === "number" ? value : Number.parseFloat(value)
          }
        }

        console.log(`Metric ${metricName} not found in system ${systemId} in location ${locationKey}`)
        return null
      } catch (error) {
        console.error(`Error getting metric value for ${locationId}/${systemId}/${metricName}:`, error)
        return null
      }
    },
    [rtdbData],
  )

  // Add this function to monitor equipment metrics
  const monitorEquipmentMetrics = useCallback(async (): Promise<void> => {
    console.log("🔍 monitorEquipmentMetrics called with", {
      thresholdCount: thresholdSettings.length,
      rtdbAvailable: !!rtdbData,
    })
    if (!db || !rtdbData || !thresholdSettings.length) {
      console.log("Cannot monitor metrics - missing dependencies:", {
        dbExists: !!db,
        rtdbDataExists: !!rtdbData,
        thresholdsCount: thresholdSettings.length,
      })
      return
    }

    const checkTime = new Date()
    setLastCheck(checkTime)
    console.log(
      `🔍 CHECKING METRICS at ${checkTime.toLocaleTimeString()} - ${thresholdSettings.length} thresholds to check`,
    )

    // Track metrics check statistics
    let metricsChecked = 0
    let metricsFound = 0
    let thresholdsExceeded = 0

    // For each threshold setting, check the corresponding metric
    for (const threshold of thresholdSettings) {
      try {
        metricsChecked++
        console.log(`\n📊 Checking threshold: ${threshold.metricName} (${threshold.id})`)
        console.log(`Min: ${threshold.minThreshold}, Max: ${threshold.maxThreshold}`)

        // Get the equipment document to access current metrics
        const equipmentRef = doc(db, "equipment", threshold.equipmentId)
        const equipmentDoc = await getDoc(equipmentRef)

        if (!equipmentDoc.exists()) {
          console.log(`❌ Equipment ${threshold.equipmentId} not found in Firestore`)
          continue
        }

        const equipmentData = equipmentDoc.data()
        const locationId = equipmentData.locationId || threshold.locationId
        const systemId = equipmentData.system || equipmentData.name || threshold.systemId

        console.log(`📍 Equipment: ${equipmentData.name} (${threshold.equipmentId}) at location ${locationId}`)

        // Extract metric name from path (e.g., "Supply Air/temperature" -> "temperature")
        const metricParts = threshold.metricPath.split("/")
        const metricName = metricParts.length > 0 ? metricParts[metricParts.length - 1] : threshold.metricPath

        // Try to get the metric value from RTDB
        let currentValue: number | null = null
        let metricSource = ""

        // Try different variations of the metric name
        const possibleMetricNames = [
          metricName,
          metricName.toLowerCase(),
          `${metricName}_value`,
          `${metricName.toLowerCase()}_value`,
          threshold.metricName,
          threshold.metricName.toLowerCase(),
          // Add more variations based on common patterns
          metricName.replace(/\s+/g, "_"),
          metricName.replace(/\s+/g, ""),
          metricName.replace(/_/g, " "),
          // Try with common prefixes/suffixes
          `${metricName} value`,
          `${metricName} reading`,
          `${metricName} sensor`,
          // Try with common metric types if they're in the name
          metricName.includes("temp") ? "Temperature" : null,
          metricName.includes("humid") ? "Humidity" : null,
          metricName.includes("press") ? "Pressure" : null,
          // If it's a path like "Supply Air/Temperature", try both parts
          ...metricParts,
          // Try the last part of the threshold path (most specific)
          threshold.metricPath.split("/").pop() || "",
          // Add these specific metric names that might be in your system
          "Supply Air Temperature",
          "Return Air Temperature",
          "Mixed Air Temperature",
          "Outside Air Temperature",
          "Zone Temperature",
          "Supply Air Humidity",
          "Return Air Humidity",
          "Zone Humidity",
          "Static Pressure",
          "Fan Speed",
          "Valve Position",
          "Damper Position",
          "Cooling Setpoint",
          "Heating Setpoint",
          "Temperature Setpoint",
          "Humidity Setpoint",
          "Pressure Setpoint",
        ].filter(Boolean) as string[]

        // Log all the metric names we're going to try
        console.log(`🔍 Will try these metric names:`, possibleMetricNames)

        // Add a debug log to show all available metrics for this system
        if (rtdbData && locationId && systemId && rtdbData[locationId]?.systems?.[systemId]?.metrics) {
          const availableMetrics = Object.keys(rtdbData[locationId].systems[systemId].metrics)
          console.log(`📊 Available metrics for ${locationId}/${systemId}:`, availableMetrics)
        }

        for (const name of possibleMetricNames) {
          console.log(`🔍 Looking for metric: ${name} in location ${locationId}, system ${systemId}`)
          const value = getMetricValue(locationId, systemId, name)
          if (value !== null) {
            currentValue = value
            metricSource = "RTDB"
            metricsFound++
            console.log(`✅ Found metric in RTDB: ${name} = ${currentValue}`)
            break
          }
        }

        // If we still don't have a value, try to get it from Firestore
        if (currentValue === null) {
          console.log(`⚠️ Metric not found in RTDB, checking Firestore at path: thresholds.${threshold.metricPath}`)
          const firestoreValue = threshold.metricPath
            .split("/")
            .reduce((obj, key) => (obj && typeof obj === "object" ? obj[key] : null), equipmentData.thresholds || {})

          console.log(`Firestore value for ${threshold.metricPath}:`, firestoreValue)

          if (
            firestoreValue &&
            (typeof firestoreValue.value !== "undefined" || typeof firestoreValue.current !== "undefined")
          ) {
            metricsFound++
            metricSource = "Firestore"
            currentValue =
              typeof firestoreValue.value !== "undefined"
                ? typeof firestoreValue.value === "number"
                  ? firestoreValue.value
                  : Number.parseFloat(firestoreValue.value)
                : typeof firestoreValue.current === "number"
                  ? firestoreValue.current
                  : Number.parseFloat(firestoreValue.current)
            console.log(`✅ Found metric in Firestore: ${currentValue}`)
          } else {
            console.log(`❌ Metric not found in Firestore either`)
          }
        }

        console.log(`📈 Current value for ${threshold.metricName}: ${currentValue} (source: ${metricSource})`)

        // Check if value exceeds thresholds
        let severity: "info" | "warning" | "critical" | null = null
        let message = ""

        // Check against min/max thresholds
        if (threshold.maxThreshold !== undefined && currentValue !== null && currentValue > threshold.maxThreshold) {
          severity = "critical"
          thresholdsExceeded++
          message = `${threshold.metricName} value of ${currentValue} exceeds maximum threshold of ${threshold.maxThreshold}`
          console.log(`🚨 THRESHOLD EXCEEDED (MAX): ${currentValue} > ${threshold.maxThreshold}`)
        } else if (
          threshold.minThreshold !== undefined &&
          currentValue !== null &&
          currentValue < threshold.minThreshold
        ) {
          severity = "warning"
          thresholdsExceeded++
          message = `${threshold.metricName} value of ${currentValue} is below minimum threshold of ${threshold.minThreshold}`
          console.log(`⚠️ THRESHOLD EXCEEDED (MIN): ${currentValue} < ${threshold.minThreshold}`)
        } else if (currentValue !== null) {
          console.log(`✅ Value is within acceptable range`)
        }

        // Add this check before trying to create an alarm (around line 690)
        if (currentValue === null) {
          console.log(`⚠️ Skipping alarm creation for ${threshold.metricName} - no valid metric value found`)
          continue // Skip to the next threshold
        }

        // If threshold exceeded, create an alarm
        if (severity) {
          // Check if there's already an active alarm for this metric
          const existingAlarmQuery = query(
            collection(db, "alarms"),
            where("equipmentId", "==", threshold.equipmentId),
            where("name", "==", `${threshold.metricName} Threshold Exceeded`),
            where("active", "==", true),
            limit(1),
          )

          const existingAlarmSnapshot = await getDocs(existingAlarmQuery)

          if (existingAlarmSnapshot.empty) {
            // Get location name
            let locationName = equipmentData.locationName || equipmentData.location || "Unknown Location"

            // Try to get a better location name if we don't have one
            if (locationName === "Unknown Location") {
              // First try to get it directly from RTDB
              if (rtdbData && locationId) {
                // Direct match by ID
                if (rtdbData[locationId] && rtdbData[locationId].name) {
                  locationName = rtdbData[locationId].name
                  console.log(`Found location name directly in RTDB: ${locationName}`)
                } else {
                  // Search through all locations
                  for (const [key, value] of Object.entries(rtdbData)) {
                    const locData = value as any
                    if ((locData.id === locationId || key === locationId) && locData.name) {
                      locationName = locData.name
                      console.log(`Found location name in RTDB by searching: ${locationName}`)
                      break
                    }
                  }
                }
              }

              // If still unknown, try Firestore
              if (locationName === "Unknown Location") {
                try {
                  const resolvedName = await getLocationName(locationId)
                  if (resolvedName) {
                    locationName = resolvedName
                    console.log(`Found location name in Firestore: ${locationName}`)
                  } else {
                    // Last resort - try to get location name from equipment's parent location
                    const equipmentLocRef = doc(db, "locations", locationId)
                    const equipmentLocDoc = await getDoc(equipmentLocRef)
                    if (equipmentLocDoc.exists() && equipmentLocDoc.data().name) {
                      locationName = equipmentLocDoc.data().name
                      console.log(`Found location name from equipment's parent location: ${locationName}`)
                    }
                  }
                } catch (error) {
                  console.error(`Error resolving location name for ${locationId}:`, error)
                }
              }
            }

            console.log(`Final location name for alarm: ${locationName}`)

            // Create new alarm
            const alarmData = {
              name: `${threshold.metricName} Threshold Exceeded`,
              equipmentId: threshold.equipmentId,
              equipmentName: equipmentData.name || "Unknown Equipment",
              locationId: locationId,
              locationName: locationName,
              severity,
              message,
              active: true,
              acknowledged: false,
              resolved: false,
              timestamp: new Date(),
            }

            // Add to Firestore
            const alarmsRef = collection(db, "alarms")
            const newAlarmRef = await addDoc(alarmsRef, alarmData)

            console.log(`🔔 New ${severity} alarm created for ${threshold.metricName} with ID ${newAlarmRef.id}`)

            // Send email notification
            sendAlarmEmail(alarmData, newAlarmRef.id)
          } else {
            console.log(`ℹ️ Alarm already exists for this metric, not creating a new one`)
          }
        }
      } catch (error) {
        console.error(`❌ Error monitoring metric ${threshold.metricName}:`, error)
      }
    }

    console.log(`\n📊 METRICS CHECK SUMMARY:
    - Time: ${checkTime.toLocaleTimeString()}
    - Thresholds checked: ${metricsChecked}
    - Metrics found: ${metricsFound}
    - Thresholds exceeded: ${thresholdsExceeded}
    `)

    // Refresh the alarms list if any thresholds were exceeded
    if (thresholdsExceeded > 0) {
      console.log(`Refreshing alarms list after finding ${thresholdsExceeded} exceeded thresholds`)
      fetchAlarms()
    }
  }, [db, rtdbData, thresholdSettings, locationTechnicians, locationUsers, getMetricValue, sendAlarmEmail, fetchAlarms])

  // Initial fetch
  useEffect(() => {
    fetchAlarms()
  }, [db, filter, fetchAlarms]) // Remove fetchAlarms from here

  // Filter alarms based on search term and severity
  useEffect(() => {
    let result = [...alarms]

    // Apply search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase()
      result = result.filter(
        (alarm) =>
          alarm.name.toLowerCase().includes(term) ||
          alarm.message.toLowerCase().includes(term) ||
          (alarm.equipmentName && alarm.equipmentName.toLowerCase().includes(term)) ||
          (alarm.locationName && alarm.locationName.toLowerCase().includes(term)),
      )
    }

    // Apply severity filter
    if (selectedSeverity) {
      result = result.filter((alarm) => alarm.severity === selectedSeverity)
    }

    setFilteredAlarms(result)
  }, [alarms, searchTerm, selectedSeverity])

  // Add this useEffect after the other useEffects
  useEffect(() => {
    let refreshInterval: NodeJS.Timeout | null = null

    if (isAutoRefreshing) {
      console.log("Auto-refreshing alarms list enabled")
      refreshInterval = setInterval(() => {
        console.log("Auto-refreshing alarms list")
        fetchAlarms()
      }, 30000) // Refresh every 30 seconds
    } else {
      console.log("Auto-refreshing alarms list disabled")
    }

    return () => {
      if (refreshInterval) {
        console.log("Clearing auto-refresh interval")
        clearInterval(refreshInterval)
      }
    }
  }, [isAutoRefreshing, fetchAlarms]) // Remove fetchAlarms from here

  // Acknowledge alarm
  const acknowledgeAlarm = useCallback(
    async (alarmId: string) => {
      if (!db || !user) return

      try {
        setIsRefreshing(true)
        const alarmRef = doc(db, "alarms", alarmId)
        await updateDoc(alarmRef, {
          acknowledged: true,
          acknowledgedTimestamp: new Date(),
          acknowledgedBy: user.id,
        })

        // Update local state
        setAlarms((prev) =>
          prev.map((alarm) =>
            alarm.id === alarmId
              ? {
                  ...alarm,
                  acknowledged: true,
                  acknowledgedTimestamp: new Date(),
                  acknowledgedBy: user.id,
                }
              : alarm,
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
      } finally {
        setIsRefreshing(false)
      }
    },
    [db, user, toast],
  )

  // Resolve alarm
  const resolveAlarm = async (alarmId: string) => {
    if (!db || !user) return

    try {
      setIsRefreshing(true)
      const alarmRef = doc(db, "alarms", alarmId)
      await updateDoc(alarmRef, {
        active: false,
        resolved: true,
        resolvedTimestamp: new Date(),
        resolvedBy: user.id,
      })

      // Update local state
      setAlarms((prev) =>
        prev.map((alarm) =>
          alarm.id === alarmId
            ? {
                ...alarm,
                active: false,
                resolved: true,
                resolvedTimestamp: new Date(),
                resolvedBy: user.id,
              }
            : alarm,
        ),
      )

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
    } finally {
      setIsRefreshing(false)
    }
  }

  // Delete alarm
  const deleteAlarm = async (alarmId: string) => {
    if (!db) return

    try {
      setIsRefreshing(true)
      const alarmRef = doc(db, "alarms", alarmId)
      await deleteDoc(alarmRef)

      // Update local state
      setAlarms((prev) => prev.filter((alarm) => alarm.id !== alarmId))
      setFilteredAlarms((prev) => prev.filter((alarm) => alarm.id !== alarmId))

      toast({
        title: "Alarm Deleted",
        description: "The alarm has been permanently deleted",
      })
    } catch (error) {
      console.error("Error deleting alarm:", error)
      toast({
        title: "Error",
        description: "Failed to delete alarm",
        variant: "destructive",
      })
    } finally {
      setIsRefreshing(false)
    }
  }

  // Export alarms to CSV
  const exportAlarms = () => {
    try {
      setIsExporting(true)

      // Create CSV content
      const headers = [
        "ID",
        "Name",
        "Location",
        "Equipment",
        "Severity",
        "Message",
        "Status",
        "Created",
        "Acknowledged",
        "Resolved",
      ]

      const rows = filteredAlarms.map((alarm) => [
        alarm.id,
        alarm.name,
        alarm.locationName || "Unknown",
        alarm.equipmentName || "Unknown",
        alarm.severity,
        alarm.message,
        alarm.resolved ? "Resolved" : alarm.acknowledged ? "Acknowledged" : "Active",
        formatTimestamp(alarm.timestamp),
        alarm.acknowledgedTimestamp ? formatTimestamp(alarm.acknowledgedTimestamp) : "",
        alarm.resolvedTimestamp ? formatTimestamp(alarm.resolvedTimestamp) : "",
      ])

      // Convert to CSV string
      const csvContent = [
        headers.join(","),
        ...rows.map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(",")),
      ].join("\n")

      // Create download link
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `alarms_export_${new Date().toISOString().slice(0, 10)}.csv`)
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)

      toast({
        title: "Export Complete",
        description: `${filteredAlarms.length} alarms exported to CSV`,
      })
    } catch (error) {
      console.error("Error exporting alarms:", error)
      toast({
        title: "Export Failed",
        description: "Failed to export alarms to CSV",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Get alarm severity badge
  const getSeverityBadge = (severity: string) => {
    switch (severity) {
      case "critical":
        return (
          <Badge variant="destructive" className="flex items-center gap-1">
            <AlertCircle className="h-3 w-3" /> Critical
          </Badge>
        )
      case "warning":
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <AlertTriangle className="h-3 w-3" /> Warning
          </Badge>
        )
      case "info":
        return (
          <Badge variant="outline" className="flex items-center gap-1">
            <Info className="h-3 w-3" /> Info
          </Badge>
        )
      default:
        return <Badge variant="outline">Unknown</Badge>
    }
  }

  // Format timestamp
  const formatTimestamp = (timestamp: Date | undefined) => {
    if (!timestamp) return "Unknown"

    try {
      return timestamp.toLocaleString()
    } catch (error) {
      return "Invalid Date"
    }
  }

  // Get alarm status badge
  const getStatusBadge = (alarm: Alarm) => {
    if (alarm.resolved) {
      return (
        <Badge variant="outline" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" /> Resolved
        </Badge>
      )
    } else if (alarm.acknowledged) {
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Check className="h-3 w-3" /> Acknowledged
        </Badge>
      )
    } else {
      return (
        <Badge variant="default" className="flex items-center gap-1">
          <Bell className="h-3 w-3" /> Active
        </Badge>
      )
    }
  }

  // Get metric icon
  const getMetricIcon = (metricName: string) => {
    if (metricName.toLowerCase().includes("temperature")) {
      return <Thermometer className="h-3 w-3 mr-1" />
    } else if (metricName.toLowerCase().includes("humidity")) {
      return <Droplets className="h-3 w-3 mr-1" />
    } else if (metricName.toLowerCase().includes("air")) {
      return <Fan className="h-3 w-3 mr-1" />
    }
    return null
  }

  // Handle refresh
  const handleRefresh = async () => {
    setIsRefreshing(true)
    await fetchAlarms()
    setIsRefreshing(false)
  }

  // Handle filter change
  const handleFilterChange = (value: string) => {
    setFilter(value)
  }

  // Handle severity filter change
  const handleSeverityFilterChange = (severity: string | null) => {
    setSelectedSeverity(severity)
  }

  // Handle search
  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value)
  }

  // Clear filters
  const clearFilters = () => {
    setSearchTerm("")
    setSelectedSeverity(null)
  }

  // Add this useEffect to set up real-time monitoring of equipment metrics
  useEffect(() => {
    console.log("Monitoring useEffect triggered", {
      dbExists: !!db,
      monitoringActive,
      rtdbDataExists: !!rtdbData,
      thresholdsLoaded,
    })

    if (!db) {
      console.log("Skipping monitoring setup due to missing db")
      return
    }

    // Define the loadThresholds function inside the useEffect
    const loadThresholds = async () => {
      if (thresholdsLoading || thresholdsLoaded) return // Prevent multiple calls
      setThresholdsLoading(true)
      try {
        console.log("Starting threshold loading process")
        const extractedThresholds = await extractThresholdsFromEquipment()
        console.log(`Setting ${extractedThresholds.length} thresholds to state`)
        setThresholdSettings(extractedThresholds)
        setThresholdsLoaded(true)

        // After loading thresholds, do an initial check if RTDB data is available
        if (extractedThresholds.length > 0 && rtdbData && monitoringActive) {
          console.log("Scheduling initial metrics check")
          setTimeout(() => {
            monitorEquipmentMetrics()
          }, 2000) // Wait 2 seconds before first check
        } else if (!rtdbData) {
          console.log("RTDB data not available yet, skipping metrics check")
        } else if (!monitoringActive) {
          console.log("Monitoring is not active, skipping metrics check")
        } else {
          console.log("No thresholds found, skipping metrics check")
        }
      } finally {
        setThresholdsLoading(false)
      }
    }

    // Call loadThresholds only once
    loadThresholds()

    // Set up interval for periodic checking only if RTDB is available and monitoring is active
    let intervalId: NodeJS.Timeout | null = null
    if (rtdbData && monitoringActive) {
      console.log(`Setting up monitoring interval: ${checkInterval}ms`)
      intervalId = setInterval(() => {
        monitorEquipmentMetrics()
      }, checkInterval)
    }

    // Clean up on unmount
    return () => {
      console.log("Cleaning up monitoring interval")
      if (intervalId) {
        clearInterval(intervalId)
      }
    }
  }, [db, monitoringActive, checkInterval, rtdbData, thresholdsLoaded, thresholdsLoading, monitorEquipmentMetrics])

  // Fetch personnel data and load thresholds only once after component mounts
  useEffect(() => {
    if (!db) {
      console.log("Skipping personnel data and threshold setup due to missing db")
      return
    }

    let isMounted = true

    const setupData = async () => {
      // Fetch personnel data
      if (!personnelDataLoaded && isMounted) {
        console.log("Starting personnel data fetch")
        await fetchLocationPersonnel()
      }

      // Load thresholds
      if (!thresholdsLoaded && !thresholdsLoading && isMounted) {
        setThresholdsLoading(true)
        try {
          console.log("Starting threshold loading process")
          const extractedThresholds = await extractThresholdsFromEquipment()
          if (isMounted) {
            console.log(`Setting ${extractedThresholds.length} thresholds to state`)
            setThresholdSettings(extractedThresholds)
            setThresholdsLoaded(true)

            // After loading thresholds, do an initial check if RTDB data is available
            if (extractedThresholds.length > 0 && rtdbData && monitoringActive) {
              console.log("Scheduling initial metrics check")
              setTimeout(() => {
                if (isMounted) {
                  monitorEquipmentMetrics()
                }
              }, 2000) // Wait 2 seconds before first check
            } else if (!rtdbData) {
              console.log("RTDB data not available yet, skipping metrics check")
            } else if (!monitoringActive) {
              console.log("Monitoring is not active, skipping metrics check")
            } else {
              console.log("No thresholds found, skipping metrics check")
            }
          }
        } finally {
          if (isMounted) {
            setThresholdsLoading(false)
          }
        }
      }
    }

    setupData()

    return () => {
      isMounted = false
    }
  }, [db, personnelDataLoaded, thresholdsLoaded, thresholdsLoading, rtdbData, monitoringActive])

  // Add this function to update location names for existing alarms
  const updateLocationNames = async () => {
    if (!db || !rtdbData) return

    console.log("Starting location name update for existing alarms...")

    try {
      // Get all alarms with unknown location
      const alarmsRef = collection(db, "alarms")
      const alarmsQuery = query(alarmsRef, where("locationName", "==", "Unknown Location"))
      const alarmsSnapshot = await getDocs(alarmsQuery)

      console.log(`Found ${alarmsSnapshot.docs.length} alarms with unknown location`)

      for (const alarmDoc of alarmsSnapshot.docs) {
        const alarmData = alarmDoc.data()
        const locationId = alarmData.locationId

        if (!locationId) {
          console.log(`Alarm ${alarmDoc.id} has no locationId, skipping`)
          continue
        }

        console.log(`Trying to resolve location name for alarm ${alarmDoc.id} with locationId ${locationId}`)

        // Try to get location name from Firestore first
        const locationsRef = collection(db, "locations")
        const locationQuery = query(locationsRef, where("id", "==", locationId), limit(1))
        const locationSnapshot = await getDocs(locationQuery)

        let locationName = null

        if (!locationSnapshot.empty) {
          locationName = locationSnapshot.docs[0].data().name
          console.log(`Found location name in Firestore: ${locationName}`)
        } else {
          // Try RTDB
          for (const [key, value] of Object.entries(rtdbData)) {
            const locationData = value as any
            if (locationData.id === locationId) {
              // Try to get the name from Firestore using the key
              const locationDocRef = doc(db, "locations", key)
              const locationDoc = await getDoc(locationDocRef)

              if (locationDoc.exists() && locationDoc.data().name) {
                locationName = locationDoc.data().name
                console.log(`Found name in Firestore for RTDB key ${key}: ${locationName}`)
                break
              }

              // If no name in Firestore, use the key as the name
              locationName = key
              console.log(`Using RTDB location key as name: ${locationName}`)
              break
            }
          }
        }

        // Update alarm if location name was found
        if (locationName) {
          console.log(`Updating alarm ${alarmDoc.id} with location name: ${locationName}`)
          await updateDoc(doc(db, "alarms", alarmDoc.id), {
            locationName,
          })
        } else {
          console.log(`Could not resolve location name for alarm ${alarmDoc.id}`)
        }
      }

      console.log("Finished updating location names")
      toast({
        title: "Location Names Updated",
        description: `Updated ${alarmsSnapshot.docs.length} alarms with location information`,
      })

      // Refresh alarms list
      fetchAlarms()
    } catch (error) {
      console.error("Error updating location names:", error)
      toast({
        title: "Error",
        description: "Failed to update location names",
        variant: "destructive",
      })
    }
  }

  const renderAlarmsTable = () => {
    if (loading) {
      return (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )
    }

    if (filteredAlarms.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center h-64 text-center">
          <BellOff className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium">No alarms found</h3>
          <p className="text-sm text-muted-foreground">
            {searchTerm || selectedSeverity
              ? "Try adjusting your filters"
              : "There are no alarms matching your current filter"}
          </p>
        </div>
      )
    }

    return (
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableCaption>A list of system alarms</TableCaption>
          <TableHeader>
            <TableRow>
              <TableHead>Severity</TableHead>
              <TableHead>Name</TableHead>
              <TableHead>Location</TableHead>
              <TableHead>Equipment</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Time</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAlarms.map((alarm) => (
              <TableRow key={alarm.id}>
                <TableCell>{getSeverityBadge(alarm.severity)}</TableCell>
                <TableCell className="font-medium">
                  <div className="flex items-center">
                    {getMetricIcon(alarm.name)}
                    {alarm.name}
                  </div>
                </TableCell>
                <TableCell>{alarm.locationName || "Unknown"}</TableCell>
                <TableCell>{alarm.equipmentName || "Unknown"}</TableCell>
                <TableCell>{getStatusBadge(alarm)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span className="text-xs">{formatTimestamp(alarm.timestamp)}</span>
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    {alarm.active && !alarm.acknowledged && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => acknowledgeAlarm(alarm.id)}
                        disabled={isRefreshing}
                      >
                        Acknowledge
                      </Button>
                    )}
                    {alarm.active && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => resolveAlarm(alarm.id)}
                        disabled={isRefreshing}
                      >
                        Resolve
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => deleteAlarm(alarm.id)}
                      disabled={isRefreshing}
                      className="text-red-500 hover:text-red-700 hover:bg-red-50"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Alarms</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="hover:bg-[#e6f3f1]"
          >
            {isRefreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
          <Button
            variant="outline"
            onClick={exportAlarms}
            disabled={isExporting || filteredAlarms.length === 0}
            className="hover:bg-[#e6f3f1]"
          >
            {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
            Export
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className="flex items-center gap-2">
          <div className={`h-2 w-2 rounded-full ${monitoringActive ? "bg-green-500" : "bg-gray-300"}`}></div>
          <span className="text-sm text-muted-foreground">Monitoring {monitoringActive ? "Active" : "Paused"}</span>
        </div>
        {lastCheck && (
          <span className="text-xs text-muted-foreground ml-4">Last check: {lastCheck.toLocaleTimeString()}</span>
        )}
        <Button variant="ghost" size="sm" onClick={() => setMonitoringActive(!monitoringActive)} className="ml-2">
          {monitoringActive ? "Pause" : "Resume"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            if (thresholdSettings.length === 0) {
              // If no thresholds are loaded yet, load them first
              const loadAndCheck = async () => {
                const extractedThresholds = await extractThresholdsFromEquipment()
                setThresholdSettings(extractedThresholds)
                if (extractedThresholds.length > 0) {
                  setTimeout(() => {
                    monitorEquipmentMetrics().then(() => {
                      // Refresh alarms list after check completes
                      fetchAlarms()
                    })
                  }, 500)
                }
              }
              loadAndCheck()
            } else {
              // If thresholds are already loaded, just run the check
              monitorEquipmentMetrics().then(() => {
                // Refresh alarms list after check completes
                fetchAlarms()
              })
            }
          }}
          className="ml-2"
          disabled={!rtdbData}
        >
          Run Check Now
        </Button>
        <Button variant="outline" size="sm" onClick={updateLocationNames} className="ml-2">
          Update Locations
        </Button>
        <div className="ml-auto text-xs text-muted-foreground">{thresholdSettings.length} thresholds configured</div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>Alarm Management</CardTitle>
              <CardDescription>View and manage system alarms.</CardDescription>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search alarms..."
                  value={searchTerm}
                  onChange={handleSearch}
                  className="pl-8 w-full sm:w-[250px]"
                />
              </div>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" className="gap-2">
                    <Filter className="h-4 w-4" />
                    Severity
                    {selectedSeverity && (
                      <Badge variant="secondary" className="ml-1">
                        {selectedSeverity}
                      </Badge>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Filter by Severity</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => handleSeverityFilterChange(null)}>All Severities</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSeverityFilterChange("critical")}>
                    <Badge variant="destructive" className="mr-2">
                      Critical
                    </Badge>
                    Critical Alarms
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSeverityFilterChange("warning")}>
                    <Badge variant="secondary" className="mr-2">
                      Warning
                    </Badge>
                    Warning Alarms
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSeverityFilterChange("info")}>
                    <Badge variant="outline" className="mr-2">
                      Info
                    </Badge>
                    Info Alarms
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {selectedSeverity && (
                <Button variant="ghost" size="icon" onClick={() => setSelectedSeverity(null)} className="h-10 w-10">
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent>
          <Tabs defaultValue="all" className="w-full" onValueChange={handleFilterChange}>
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="all">All Alarms</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="acknowledged">Acknowledged</TabsTrigger>
              <TabsTrigger value="resolved">Resolved</TabsTrigger>
            </TabsList>

            <TabsContent value="all" className="mt-4">
              {renderAlarmsTable()}
            </TabsContent>

            <TabsContent value="active" className="mt-4">
              {renderAlarmsTable()}
            </TabsContent>

            <TabsContent value="acknowledged" className="mt-4">
              {renderAlarmsTable()}
            </TabsContent>

            <TabsContent value="resolved" className="mt-4">
              {renderAlarmsTable()}
            </TabsContent>
          </Tabs>
        </CardContent>

        <CardFooter className="flex justify-between">
          <div className="text-sm text-muted-foreground">
            {filteredAlarms.length} {filteredAlarms.length === 1 ? "alarm" : "alarms"} found
          </div>
          {searchTerm || selectedSeverity ? (
            <Button variant="ghost" size="sm" onClick={clearFilters}>
              Clear Filters
            </Button>
          ) : null}
        </CardFooter>
      </Card>
      <div className="flex items-center mt-4">
        <input
          id="auto-refresh"
          type="checkbox"
          className="mr-2 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:ring-offset-gray-800 dark:focus:ring-blue-600"
          checked={isAutoRefreshing}
          onChange={(e) => setIsAutoRefreshing(e.target.checked)}
        />
        <label htmlFor="auto-refresh" className="text-sm font-medium text-gray-900 dark:text-gray-300">
          Auto-refresh alarms
        </label>
      </div>
    </div>
  )
}
