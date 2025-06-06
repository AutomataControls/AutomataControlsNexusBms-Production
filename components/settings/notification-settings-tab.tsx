// components/settings/notification-settings-tab.tsx
// Notification Settings Tab - Email notification configuration and recipient management
// Features: Enable/disable notifications, manage email recipients by location, test emails

"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Bell, Plus, X, Mail, AlertTriangle, Send, Loader2 } from "lucide-react"
import { useFirebase } from "@/lib/firebase-context"
import { useAuth } from "@/lib/auth-context"
import { collection, getDocs, addDoc, deleteDoc, doc, setDoc, getDoc } from "firebase/firestore"

interface Location {
  id: string
  name: string
  address?: string
  city?: string
  state?: string
}

interface Recipient {
  id: string
  email: string
  locationId: string
  locationName: string
  locationAddress?: string
  locationCity?: string
  locationState?: string
  createdAt: any
  userId?: string
}

interface EmailSettings {
  enabled: boolean
  sendOnCritical: boolean
  sendOnWarning: boolean
  sendOnInfo: boolean
  dailySummary: boolean
  weeklySummary: boolean
}

export function NotificationSettingsTab() {
  const { db } = useFirebase()
  const { user } = useAuth()
  const { toast } = useToast()

  const [locations, setLocations] = useState<Location[]>([])
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testingEmail, setTestingEmail] = useState(false)
  const [isTestEmailOpen, setIsTestEmailOpen] = useState(false)
  const [testEmailAddresses, setTestEmailAddresses] = useState("")
  const [emailSettings, setEmailSettings] = useState<EmailSettings>({
    enabled: true,
    sendOnCritical: true,
    sendOnWarning: true,
    sendOnInfo: false,
    dailySummary: true,
    weeklySummary: false,
  })
  const [newRecipient, setNewRecipient] = useState({
    email: "",
    location: "",
  })

  useEffect(() => {
    fetchLocations()
    fetchRecipients()
    fetchEmailSettings()
  }, [])

  const fetchLocations = async () => {
    if (!db) return
    try {
      const snapshot = await getDocs(collection(db, "locations"))
      const locationData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Location[]
      setLocations(locationData)
    } catch (error) {
      console.error("Error fetching locations:", error)
    }
  }

  const fetchRecipients = async () => {
    if (!db) return
    try {
      const snapshot = await getDocs(collection(db, "recipients"))
      const recipientData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Recipient[]
      setRecipients(recipientData)
    } catch (error) {
      console.error("Error fetching recipients:", error)
      toast({
        title: "Error",
        description: "Failed to fetch notification recipients",
        variant: "destructive"
      })
    }
  }

  const fetchEmailSettings = async () => {
    if (!db) return
    try {
      const settingsDoc = await getDoc(doc(db, "settings", "email"))
      if (settingsDoc.exists()) {
        setEmailSettings(prevSettings => ({
          ...prevSettings,
          ...settingsDoc.data()
        }))
      }
    } catch (error) {
      console.error("Error fetching email settings:", error)
    }
  }

  const handleAddRecipient = async () => {
    if (!db || !newRecipient.email.trim() || !newRecipient.location) {
      toast({
        title: "Validation Error",
        description: "Email and location are required",
        variant: "destructive"
      })
      return
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(newRecipient.email)) {
      toast({
        title: "Validation Error",
        description: "Please enter a valid email address",
        variant: "destructive"
      })
      return
    }

    try {
      setLoading(true)
      const locationData = locations.find(loc => loc.id === newRecipient.location)

      await addDoc(collection(db, "recipients"), {
        email: newRecipient.email.trim(),
        locationId: newRecipient.location,
        locationName: locationData?.name || "",
        locationAddress: locationData?.address || "",
        locationCity: locationData?.city || "",
        locationState: locationData?.state || "",
        createdAt: new Date(),
        ...(user?.id && { userId: user.id }),
      })

      setNewRecipient({ email: "", location: "" })
      setIsAddRecipientOpen(false)
      await fetchRecipients()

      toast({
        title: "Success",
        description: `${newRecipient.email} will now receive notifications for ${locationData?.name}`,
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error adding recipient:", error)
      toast({
        title: "Error",
        description: "Failed to add recipient",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRemoveRecipient = async (recipientId: string) => {
    if (!db) return
    try {
      await deleteDoc(doc(db, "recipients", recipientId))
      await fetchRecipients()
      toast({
        title: "Success",
        description: "Recipient removed successfully",
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error removing recipient:", error)
      toast({
        title: "Error",
        description: "Failed to remove recipient",
        variant: "destructive"
      })
    }
  }

  const handleSaveEmailSettings = async () => {
    if (!db) return
    try {
      setLoading(true)
      await setDoc(doc(db, "settings", "email"), {
        ...emailSettings,
        updatedAt: new Date(),
        ...(user?.id && { userId: user.id }),
      })

      toast({
        title: "Success",
        description: "Email notification settings saved successfully",
        className: "bg-teal-50 border-teal-200"
      })
    } catch (error) {
      console.error("Error saving email settings:", error)
      toast({
        title: "Error",
        description: "Failed to save email notification settings",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleTestEmail = async () => {
    if (recipients.length === 0) {
      toast({
        title: "No Recipients",
        description: "Please add at least one recipient before testing emails",
        variant: "destructive"
      })
      return
    }

    try {
      setTestingEmail(true)

      const response = await fetch("/api/send-alarm-email", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          alarmType: "Test Notification",
          details: "This is a test email to verify that notifications are working correctly in your Neural BMS system.",
          locationId: "test",
          alarmId: "test-" + Date.now(),
          severity: "info",
          recipients: recipients.map(r => r.email),
        }),
      })

      if (!response.ok) {
        throw new Error(`Server responded with ${response.status}`)
      }

      const result = await response.json()

      if (result.success) {
        toast({
          title: "Test Email Sent",
          description: `Test notification sent to ${recipients.length} recipient(s)`,
          className: "bg-teal-50 border-teal-200"
        })
      } else {
        throw new Error(result.error || "Failed to send test email")
      }
    } catch (error: any) {
      console.error("Error sending test email:", error)
      toast({
        title: "Error",
        description: error.message || "Failed to send test email",
        variant: "destructive"
      })
    } finally {
      setTestingEmail(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="h-5 w-5 text-teal-600" />
          Notification Settings
        </CardTitle>
        <CardDescription>Configure email notifications and alert recipients for your Neural BMS system</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Settings Section */}
        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
            <div className="flex items-center gap-3">
              <Mail className="h-5 w-5 text-teal-600" />
              <div>
                <h4 className="font-medium text-slate-900">Email Notifications</h4>
                <p className="text-sm text-slate-600">Send email alerts for system events and alarms</p>
              </div>
            </div>
            <Switch
              checked={emailSettings.enabled}
              onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, enabled: checked })}
            />
          </div>

          {/* Notification Triggers */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-900">Notification Triggers</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium text-slate-900">Critical Alarms</Label>
                  <p className="text-sm text-slate-600">High priority system alerts requiring immediate attention</p>
                </div>
                <Switch
                  checked={emailSettings.sendOnCritical}
                  onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, sendOnCritical: checked })}
                  disabled={!emailSettings.enabled}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium text-slate-900">Warning Alarms</Label>
                  <p className="text-sm text-slate-600">Medium priority alerts that may require attention</p>
                </div>
                <Switch
                  checked={emailSettings.sendOnWarning}
                  onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, sendOnWarning: checked })}
                  disabled={!emailSettings.enabled}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium text-slate-900">Informational Alerts</Label>
                  <p className="text-sm text-slate-600">Low priority notifications and system status updates</p>
                </div>
                <Switch
                  checked={emailSettings.sendOnInfo}
                  onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, sendOnInfo: checked })}
                  disabled={!emailSettings.enabled}
                />
              </div>
            </div>
          </div>

          {/* Summary Reports */}
          <div className="space-y-3">
            <Label className="text-sm font-medium text-slate-900">Summary Reports</Label>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium text-slate-900">Daily Summary</Label>
                  <p className="text-sm text-slate-600">Daily digest of system activity and alerts</p>
                </div>
                <Switch
                  checked={emailSettings.dailySummary}
                  onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, dailySummary: checked })}
                  disabled={!emailSettings.enabled}
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <Label className="font-medium text-slate-900">Weekly Summary</Label>
                  <p className="text-sm text-slate-600">Weekly overview of system performance and trends</p>
                </div>
                <Switch
                  checked={emailSettings.weeklySummary}
                  onCheckedChange={(checked) => setEmailSettings({ ...emailSettings, weeklySummary: checked })}
                  disabled={!emailSettings.enabled}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Recipients Section */}
        <div className="border-t pt-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="font-medium text-slate-900">Email Recipients</h4>
              <p className="text-sm text-slate-600">Manage who receives notifications for each location</p>
            </div>
            <Dialog open={isAddRecipientOpen} onOpenChange={setIsAddRecipientOpen}>
              <DialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={!emailSettings.enabled || locations.length === 0}
                  className="border-teal-200 text-teal-700 hover:bg-teal-50"
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Recipient
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>Add Email Recipient</DialogTitle>
                  <DialogDescription>
                    Add someone to receive notifications for a specific location
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label htmlFor="recipient-email">Email Address *</Label>
                    <Input
                      id="recipient-email"
                      type="email"
                      value={newRecipient.email}
                      onChange={(e) => setNewRecipient({ ...newRecipient, email: e.target.value })}
                      placeholder="user@company.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="recipient-location">Location *</Label>
                    <Select
                      value={newRecipient.location}
                      onValueChange={(value) => setNewRecipient({ ...newRecipient, location: value })}
                    >
                      <SelectTrigger id="recipient-location">
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
                  <Button variant="outline" onClick={() => setIsAddRecipientOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={handleAddRecipient}
                    disabled={loading || !newRecipient.email.trim() || !newRecipient.location}
                    className="bg-teal-500 hover:bg-teal-600 text-white"
                  >
                    {loading ? "Adding..." : "Add Recipient"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          {recipients.length === 0 ? (
            <div className="text-center py-8 border border-dashed rounded-lg bg-slate-50">
              <AlertTriangle className="h-8 w-8 mx-auto text-amber-500 mb-3" />
              <h3 className="font-medium text-slate-900 mb-1">No recipients configured</h3>
              <p className="text-sm text-slate-600 mb-4">
                Add email recipients to receive notifications for specific locations
              </p>
              {locations.length === 0 && (
                <p className="text-xs text-amber-600">
                  Note: You need to add locations first before configuring recipients
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {recipients.map((recipient) => (
                <div key={recipient.id} className="flex items-center justify-between p-3 border rounded-lg hover:bg-slate-50">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Mail className="h-4 w-4 text-teal-600" />
                      <p className="font-medium text-slate-900">{recipient.email}</p>
                    </div>
                    <p className="text-sm text-slate-600">{recipient.locationName}</p>
                    {recipient.locationAddress && (
                      <p className="text-xs text-slate-500">
                        {[recipient.locationAddress, recipient.locationCity, recipient.locationState]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveRecipient(recipient.id)}
                    disabled={!emailSettings.enabled}
                    className="text-slate-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t">
          <Dialog open={isTestEmailOpen} onOpenChange={setIsTestEmailOpen}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                disabled={!emailSettings.enabled}
                className="border-teal-200 text-teal-700 hover:bg-teal-50"
              >
                <Send className="mr-2 h-4 w-4" />
                Send Test Email
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Send Test Email</DialogTitle>
                <DialogDescription>
                  Enter email addresses to receive a test notification. Separate multiple emails with commas.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="test-emails">Email Addresses *</Label>
                  <Input
                    id="test-emails"
                    type="email"
                    value={testEmailAddresses}
                    onChange={(e) => setTestEmailAddresses(e.target.value)}
                    placeholder="user1@company.com, user2@company.com"
                    className="min-h-[80px]"
                  />
                  <p className="text-xs text-slate-500">
                    Enter one or more email addresses separated by commas
                  </p>
                </div>

                {/* Quick Add from Recipients */}
                {recipients.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-sm text-slate-600">Quick Add from Recipients:</Label>
                    <div className="flex flex-wrap gap-2">
                      {recipients.slice(0, 5).map((recipient) => (
                        <Button
                          key={recipient.id}
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const currentEmails = testEmailAddresses.trim()
                            const newEmail = recipient.email
                            if (!currentEmails.includes(newEmail)) {
                              setTestEmailAddresses(currentEmails ? `${currentEmails}, ${newEmail}` : newEmail)
                            }
                          }}
                          className="text-xs border-slate-200 hover:bg-slate-50"
                        >
                          {recipient.email}
                        </Button>
                      ))}
                      {recipients.length > 5 && (
                        <span className="text-xs text-slate-500 self-center">
                          +{recipients.length - 5} more
                        </span>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsTestEmailOpen(false)
                    setTestEmailAddresses("")
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleTestEmail}
                  disabled={testingEmail || !testEmailAddresses.trim()}
                  className="bg-teal-500 hover:bg-teal-600 text-white"
                >
                  {testingEmail ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Send Test Email
                    </>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            onClick={handleSaveEmailSettings}
            disabled={!emailSettings.enabled || loading}
            className="bg-teal-500 hover:bg-teal-600 text-white"
          >
            {loading ? "Saving..." : "Save Settings"}
          </Button>
        </div>

        {/* Info Section */}
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Mail className="h-5 w-5 text-teal-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-teal-900 mb-1">Email Configuration</h4>
              <p className="text-sm text-teal-800">
                Emails are sent from <span className="font-medium">DevOps@automatacontrols.com</span> using
                Resend API with React Email templates for professional notifications.
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
