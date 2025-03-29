"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/use-toast"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useFirebase } from "@/lib/firebase-context"

export function NotificationSettings() {
  const [emailSettings, setEmailSettings] = useState({
    enabled: false,
    senderEmail: "",
    senderPassword: "",
    recipients: "",
    sendOnCritical: true,
    sendOnWarning: true,
    sendOnInfo: false,
    dailySummary: true,
    weeklySummary: false,
  })

  const [smsSettings, setSmsSettings] = useState({
    enabled: false,
    apiKey: "",
    recipients: "",
    sendOnCritical: true,
    sendOnWarning: false,
    sendOnInfo: false,
  })

  const { db } = useFirebase()
  const { toast } = useToast()

  const handleSaveEmailSettings = async () => {
    if (!db) return

    try {
      // In a real application, this would save to your database
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
    }
  }

  const handleSaveSmsSettings = async () => {
    if (!db) return

    try {
      // In a real application, this would save to your database
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
    }
  }

  const handleTestEmail = async () => {
    try {
      // In a real application, this would send a test email
      toast({
        title: "Test Email Sent",
        description: "A test email has been sent to the configured recipients",
      })
    } catch (error) {
      console.error("Error sending test email:", error)
      toast({
        title: "Error",
        description: "Failed to send test email",
        variant: "destructive",
      })
    }
  }

  const handleTestSms = async () => {
    try {
      // In a real application, this would send a test SMS
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
    }
  }

  return (
    <div className="space-y-6">
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
              <div className="space-y-2">
                <Label htmlFor="sender-email">Sender Email (Gmail)</Label>
                <Input
                  id="sender-email"
                  type="email"
                  placeholder="your-email@gmail.com"
                  value={emailSettings.senderEmail}
                  onChange={(e) => setEmailSettings({ ...emailSettings, senderEmail: e.target.value })}
                  disabled={!emailSettings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  This should be a Gmail account that will be used to send notifications
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="sender-password">App Password</Label>
                <Input
                  id="sender-password"
                  type="password"
                  placeholder="Google App Password"
                  value={emailSettings.senderPassword}
                  onChange={(e) => setEmailSettings({ ...emailSettings, senderPassword: e.target.value })}
                  disabled={!emailSettings.enabled}
                />
                <p className="text-xs text-muted-foreground">
                  Use a Google App Password, not your regular account password.{" "}
                  <a
                    href="https://support.google.com/accounts/answer/185833"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                  >
                    Learn more
                  </a>
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="recipients">Recipients</Label>
                <Input
                  id="recipients"
                  placeholder="email1@example.com, email2@example.com"
                  value={emailSettings.recipients}
                  onChange={(e) => setEmailSettings({ ...emailSettings, recipients: e.target.value })}
                  disabled={!emailSettings.enabled}
                />
                <p className="text-xs text-muted-foreground">Separate multiple email addresses with commas</p>
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
              <Button
                variant="outline"
                onClick={handleTestEmail}
                disabled={
                  !emailSettings.enabled ||
                  !emailSettings.senderEmail ||
                  !emailSettings.senderPassword ||
                  !emailSettings.recipients
                }
              >
                Send Test Email
              </Button>
              <Button
                onClick={handleSaveEmailSettings}
                disabled={
                  !emailSettings.enabled ||
                  !emailSettings.senderEmail ||
                  !emailSettings.senderPassword ||
                  !emailSettings.recipients
                }
              >
                Save Settings
              </Button>
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

