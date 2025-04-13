"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { collection, doc, setDoc, getDoc, getDocs, deleteDoc } from "firebase/firestore"
import { Loader2, X, Mail, AlertTriangle } from "lucide-react"

// Types
interface Location {
  id: string
  name: string
  address: string
  city: string
  state: string
}

interface Recipient {
  id: string
  email: string
  locationId: string
  locationName: string
  locationAddress?: string
  locationCity?: string
  locationState?: string
}

export function NotificationSettings() {
  // Basic email notification settings
  const [emailSettings, setEmailSettings] = useState({
    enabled: true,
    sendOnCritical: true,
    sendOnWarning: true,
    sendOnInfo: false,
    dailySummary: true,
    weeklySummary: false,
  })

  // Basic SMS notification settings
  const [smsSettings, setSmsSettings] = useState({
    enabled: false,
    apiKey: "",
    recipients: "",
    sendOnCritical: true,
    sendOnWarning: false,
    sendOnInfo: false,
  })

  // State for batch email testing
  const [testLocationId, setTestLocationId] = useState("")
  const [isTestingBatch, setIsTestingBatch] = useState(false)
  const [isSendingTestEmail, setIsSendingTestEmail] = useState(false)
  const [locations, setLocations] = useState<Location[]>([])
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  // Recipient management state
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [newRecipient, setNewRecipient] = useState({
    email: "",
    location: "",
  })

  // Firebase hooks
  const { db } = useFirebase()
  const { user } = useAuth()
  const { toast } = useToast()

  // Fetch locations and settings from Firebase on component mount
  useEffect(() => {
    if (!db || !user) {
      setIsLoading(false)
      return
    }

    const fetchData = async () => {
      try {
        // Fetch locations
        const locationsSnapshot = await getDocs(collection(db, "locations"))
        const locationsData = locationsSnapshot.docs.map((doc) => ({
          id: doc.id,
          name: doc.data().name,
          address: doc.data().address,
          city: doc.data().city,
          state: doc.data().state,
        }))
        setLocations(locationsData)

        // Fetch email settings
        const emailSettingsDoc = await getDoc(doc(db, "settings", "email"))
        if (emailSettingsDoc.exists()) {
          setEmailSettings((prevSettings) => ({
            ...prevSettings,
            ...emailSettingsDoc.data(),
          }))
        }

        // Fetch SMS settings
        const smsSettingsDoc = await getDoc(doc(db, "settings", "sms"))
        if (smsSettingsDoc.exists()) {
          setSmsSettings((prevSettings) => ({
            ...prevSettings,
            ...smsSettingsDoc.data(),
          }))
        }

        // Fetch recipients
        const recipientsSnapshot = await getDocs(collection(db, "recipients"))
        const recipientsData = recipientsSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Recipient[]
        setRecipients(recipientsData)

        setIsLoading(false)
      } catch (error) {
        console.error("Error fetching data:", error)
        toast({
          title: "Error",
          description: "Failed to load notification settings",
          variant: "destructive",
        })
        setIsLoading(false)
      }
    }

    fetchData()
  }, [db, user, toast])

  // Handler for adding a new recipient
  const handleAddRecipient = async () => {
    if (!db || !user) return

    if (!newRecipient.email || !newRecipient.location) {
      toast({
        title: "Missing Information",
        description: "Please provide both email and location",
        variant: "destructive",
      })
      return
    }

    try {
      setIsLoading(true)
      // Create a new document in the recipients collection
      const recipientRef = doc(collection(db, "recipients"))
      const locationData = locations.find((loc) => loc.id === newRecipient.location)
      await setDoc(recipientRef, {
        email: newRecipient.email,
        locationId: newRecipient.location,
        locationName: locationData?.name || "",
        locationAddress: locationData?.address || "",
        locationCity: locationData?.city || "",
        locationState: locationData?.state || "",
        createdAt: new Date(),
        userId: user.id,
      })

      // Update local state
      const newRecipientData = {
        id: recipientRef.id,
        email: newRecipient.email,
        locationId: newRecipient.location,
        locationName: locations.find((loc) => loc.id === newRecipient.location)?.name || "",
      }
      setRecipients([...recipients, newRecipientData])

      // Reset form and close dialog
      setNewRecipient({ email: "", location: "" })
      setIsDialogOpen(false)

      toast({
        title: "Recipient Added",
        description: `${newRecipient.email} will now receive notifications for the selected location`,
      })
    } catch (error) {
      console.error("Error adding recipient:", error)
      toast({
        title: "Error",
        description: "Failed to add recipient",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handler for removing a recipient
  const handleRemoveRecipient = async (recipientId: string) => {
    if (!db) return

    try {
      setIsLoading(true)
      // Delete the document from Firebase
      await deleteDoc(doc(db, "recipients", recipientId))

      // Update local state
      setRecipients(recipients.filter((recipient) => recipient.id !== recipientId))

      toast({
        title: "Recipient Removed",
        description: "The recipient has been removed from notification list",
      })
    } catch (error) {
      console.error("Error removing recipient:", error)
      toast({
        title: "Error",
        description: "Failed to remove recipient",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handler for saving email settings
  const handleSaveEmailSettings = async () => {
    if (!db || !user) return

    try {
      setIsLoading(true)
      // Save email settings to Firebase
      await setDoc(doc(db, "settings", "email"), {
        ...emailSettings,
        updatedAt: new Date(),
        userId: user.id,
      })

      toast({
        title: "Email Notification Settings Saved",
        description: "Your email notification settings have been updated",
      })
    } catch (error) {
      console.error("Error saving email settings:", error)
      toast({
        title: "Error",
        description: "Failed to save email notification settings",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handler for saving SMS settings
  const handleSaveSmsSettings = async () => {
    if (!db || !user) return

    try {
      setIsLoading(true)
      // Save SMS settings to Firebase
      await setDoc(doc(db, "settings", "sms"), {
        ...smsSettings,
        updatedAt: new Date(),
        userId: user.id,
      })

      toast({
        title: "SMS Notification Settings Saved",
        description: "Your SMS notification settings have been updated",
      })
    } catch (error) {
      console.error("Error saving SMS settings:", error)
      toast({
        title: "Error",
        description: "Failed to save SMS notification settings",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Handler for batch testing emails for a specific location
  const handleBatchTestEmail = async () => {
    if (!db || !testLocationId) return

    try {
      setIsTestingBatch(true)

      // Get all recipients for the selected location
      const locationRecipients = recipients.filter((recipient) => recipient.locationId === testLocationId)

      if (locationRecipients.length === 0) {
        toast({
          title: "No Recipients Found",
          description: "There are no recipients configured for this location",
          variant: "destructive",
        })
        setIsTestingBatch(false)
        return
      }

      const locationName = locations.find((loc) => loc.id === testLocationId)?.name || "Unknown"

      // Call the API to send test emails to all recipients for this location
      const response = await fetch("/api/send-alarm-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alarmType: "Test Alarm",
          details: "This is a test alarm to verify email notifications are working correctly.",
          locationId: testLocationId,
          alarmId: "test-" + Date.now(),
          severity: "info",
          recipients: locationRecipients.map((r) => r.email),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Server responded with ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Test Emails Sent",
          description: `Sent test emails to ${locationRecipients.length} recipients for "${locationName}"`,
        })
      } else {
        throw new Error(result.error || "Failed to send test emails")
      }
    } catch (error) {
      console.error("Error sending batch test emails:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send batch test emails",
        variant: "destructive",
      })
    } finally {
      setIsTestingBatch(false)
    }
  }

  // Handler for sending a test email to all recipients
  const handleTestEmail = async () => {
    try {
      setIsSendingTestEmail(true)

      if (recipients.length === 0) {
        toast({
          title: "No Recipients",
          description: "There are no recipients configured. Please add at least one recipient.",
          variant: "destructive",
        })
        setIsSendingTestEmail(false)
        return
      }

      // Call the API to send a test email to all recipients
      const response = await fetch("/api/send-alarm-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alarmType: "Global Test Alarm",
          details: "This is a test alarm to verify email notifications are working correctly for all recipients.",
          locationId: "global-test",
          alarmId: "global-test-" + Date.now(),
          severity: "info",
          recipients: recipients.map((r) => r.email),
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Server responded with ${response.status}: ${errorText}`)
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Test Email Sent",
          description: `Sent test email to ${result.recipients || recipients.length} recipients`,
        })
      } else {
        throw new Error(result.error || "Failed to send test email")
      }
    } catch (error) {
      console.error("Error sending test email:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive",
      })
    } finally {
      setIsSendingTestEmail(false)
    }
  }

  // Handler for sending a test SMS
  const handleTestSms = async () => {
    try {
      setIsLoading(true)
      // In a real application, you'd call an API to send a test SMS
      // For demo purposes, we'll just show a toast

      // Add a short delay to simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000))

      toast({
        title: "Test SMS Sent",
        description: "A test SMS has been sent to the configured recipients",
      })
    } catch (error) {
      console.error("Error sending test SMS:", error)
      toast({
        title: "Error",
        description: "Failed to send test SMS",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading && !recipients.length && !locations.length) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6 relative">
      {isLoading && (
        <div className="absolute inset-0 bg-background/80 flex items-center justify-center z-50">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      )}

      <Tabs defaultValue="email">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="email">Email Notifications</TabsTrigger>
          <TabsTrigger value="sms">SMS Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="email" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Email Notifications</CardTitle>
                  <CardDescription>Configure email notifications for alarms and system events</CardDescription>
                </div>
                <Switch
                  checked={emailSettings.enabled}
                  onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Email Configuration Info */}
              <div className="bg-muted p-4 rounded-md flex items-start space-x-3">
                <Mail className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <h4 className="font-medium text-sm">Email Configuration</h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Emails are sent from <span className="font-medium">automatacontrols@gmail.com</span> using Gmail
                    SMTP. The email credentials are configured in the server environment.
                  </p>
                </div>
              </div>

              {/* Recipients Management Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Recipients by Location</Label>

                  <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" disabled={!emailSettings.enabled || locations.length === 0}>
                        Add Recipient
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                      <DialogHeader>
                        <DialogTitle>Add Notification Recipient</DialogTitle>
                        <DialogDescription>
                          Add an email address and select which location they should receive alerts for.
                        </DialogDescription>
                      </DialogHeader>

                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="new-recipient-email">Email Address</Label>
                          <Input
                            id="new-recipient-email"
                            type="email"
                            placeholder="email@example.com"
                            value={newRecipient.email}
                            onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                          />
                        </div>

                        <div className="grid gap-2">
                          <Label htmlFor="new-recipient-location">Location</Label>
                          <Select
                            value={newRecipient.location}
                            onValueChange={(value) => setNewRecipient({ ...newRecipient, location: value })}
                          >
                            <SelectTrigger id="new-recipient-location">
                              <SelectValue placeholder="Select a location" />
                            </SelectTrigger>
                            <SelectContent>
                              {locations.map((location) => (
                                <SelectItem key={location.id} value={location.id}>
                                  {location.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>

                      <DialogFooter>
                        <Button onClick={handleAddRecipient} disabled={!newRecipient.email || !newRecipient.location}>
                          Add Recipient
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

                {/* Display list of recipients */}
                {recipients.length > 0 ? (
                  <div className="border rounded-md divide-y">
                    {recipients.map((recipient) => (
                      <div key={recipient.id} className="flex items-center justify-between p-3">
                        <div>
                          <p className="text-sm font-medium">{recipient.email}</p>
                          <p className="text-xs text-muted-foreground">Location: {recipient.locationName}</p>
                          <p className="text-xs text-muted-foreground">
                            {recipient.locationAddress && recipient.locationCity
                              ? `${recipient.locationAddress}, ${recipient.locationCity}, ${recipient.locationState}`
                              : ""}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveRecipient(recipient.id)}
                          disabled={!emailSettings.enabled}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border rounded-md p-4 flex items-start space-x-3">
                    <AlertTriangle className="h-5 w-5 text-amber-500 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium">No recipients configured</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        No recipients added yet. Click "Add Recipient" to add someone who will receive notifications for
                        a specific location.
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>Notification Triggers</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="critical-alarms" className="cursor-pointer">
                      Critical Alarms
                    </Label>
                    <Switch
                      id="critical-alarms"
                      checked={emailSettings.sendOnCritical}
                      onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, sendOnCritical: checked })}
                      disabled={!emailSettings.enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="warning-alarms" className="cursor-pointer">
                      Warning Alarms
                    </Label>
                    <Switch
                      id="warning-alarms"
                      checked={emailSettings.sendOnWarning}
                      onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, sendOnWarning: checked })}
                      disabled={!emailSettings.enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="info-alarms" className="cursor-pointer">
                      Informational Alerts
                    </Label>
                    <Switch
                      id="info-alarms"
                      checked={emailSettings.sendOnInfo}
                      onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, sendOnInfo: checked })}
                      disabled={!emailSettings.enabled}
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Summary Reports</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="daily-summary" className="cursor-pointer">
                      Daily Summary
                    </Label>
                    <Switch
                      id="daily-summary"
                      checked={emailSettings.dailySummary}
                      onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, dailySummary: checked })}
                      disabled={!emailSettings.enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="weekly-summary" className="cursor-pointer">
                      Weekly Summary
                    </Label>
                    <Switch
                      id="weekly-summary"
                      checked={emailSettings.weeklySummary}
                      onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, weeklySummary: checked })}
                      disabled={!emailSettings.enabled}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <div className="flex flex-col gap-2 w-full">
                <div className="flex justify-between w-full">
                  <Button
                    variant="outline"
                    onClick={handleTestEmail}
                    disabled={!emailSettings.enabled || recipients.length === 0 || isSendingTestEmail}
                  >
                    {isSendingTestEmail ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Sending...
                      </>
                    ) : (
                      "Send Test Email to All"
                    )}
                  </Button>
                  <Button onClick={handleSaveEmailSettings} disabled={!emailSettings.enabled}>
                    Save Settings
                  </Button>
                </div>

                <div className="border-t pt-3 mt-1">
                  <Label htmlFor="batch-test-location" className="mb-2 block">
                    Test Emails for Specific Location
                  </Label>
                  <div className="flex gap-2 items-center">
                    <Select
                      value={testLocationId}
                      onValueChange={setTestLocationId}
                      disabled={!emailSettings.enabled || isTestingBatch}
                    >
                      <SelectTrigger id="batch-test-location" className="flex-1">
                        <SelectValue placeholder="Select a location" />
                      </SelectTrigger>
                      <SelectContent>
                        {locations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      variant="secondary"
                      disabled={!emailSettings.enabled || !testLocationId || isTestingBatch}
                      onClick={handleBatchTestEmail}
                    >
                      {isTestingBatch ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        "Test Location"
                      )}
                    </Button>
                  </div>
                </div>
              </div>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="sms" className="space-y-4 pt-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>SMS Notifications</CardTitle>
                  <CardDescription>Configure SMS notifications for critical alarms</CardDescription>
                </div>
                <Switch
                  checked={smsSettings.enabled}
                  onCheckedChange={(checked) => setSmsSettings({ ...smsSettings, enabled: checked })}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="sms-api-key">SMS API Key</Label>
                <Input
                  id="sms-api-key"
                  type="password"
                  placeholder="Your SMS service API key"
                  value={smsSettings.apiKey}
                  onChange={(e) => setSmsSettings({ ...smsSettings, apiKey: e.target.value })}
                  disabled={!smsSettings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  API key for your SMS service provider (Twilio, Nexmo, etc.)
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sms-recipients">Recipients</Label>
                <Input
                  id="sms-recipients"
                  placeholder="+1234567890, +0987654321"
                  value={smsSettings.recipients}
                  onChange={(e) => setSmsSettings({ ...smsSettings, recipients: e.target.value })}
                  disabled={!smsSettings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Separate multiple phone numbers with commas. Include country code.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Notification Triggers</Label>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="sms-critical-alarms" className="cursor-pointer">
                      Critical Alarms
                    </Label>
                    <Switch
                      id="sms-critical-alarms"
                      checked={smsSettings.sendOnCritical}
                      onCheckedChange={(checked) => setSmsSettings({ ...smsSettings, sendOnCritical: checked })}
                      disabled={!smsSettings.enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="sms-warning-alarms" className="cursor-pointer">
                      Warning Alarms
                    </Label>
                    <Switch
                      id="sms-warning-alarms"
                      checked={smsSettings.sendOnWarning}
                      onCheckedChange={(checked) => setSmsSettings({ ...smsSettings, sendOnWarning: checked })}
                      disabled={!smsSettings.enabled}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <Label htmlFor="sms-info-alarms" className="cursor-pointer">
                      Informational Alerts
                    </Label>
                    <Switch
                      id="sms-info-alarms"
                      checked={smsSettings.sendOnInfo}
                      onCheckedChange={(checked) => setSmsSettings({ ...smsSettings, sendOnInfo: checked })}
                      disabled={!smsSettings.enabled}
                    />
                  </div>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex justify-between">
              <Button
                variant="outline"
                onClick={handleTestSms}
                disabled={!smsSettings.enabled || !smsSettings.apiKey || !smsSettings.recipients}
              >
                Send Test SMS
              </Button>
              <Button
                onClick={handleSaveSmsSettings}
                disabled={!smsSettings.enabled || !smsSettings.apiKey || !smsSettings.recipients}
              >
                Save Settings
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
