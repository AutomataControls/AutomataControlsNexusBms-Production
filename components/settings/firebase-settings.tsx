"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"
import { AlertCircle, CheckCircle2 } from "lucide-react"

export function FirebaseSettings() {
  const { config, updateConfig, testConnection } = useFirebase()
  const [firebaseConfig, setFirebaseConfig] = useState({
    apiKey: config?.apiKey || "",
    authDomain: config?.authDomain || "",
    projectId: config?.projectId || "",
    storageBucket: config?.storageBucket || "",
    messagingSenderId: config?.messagingSenderId || "",
    appId: config?.appId || "",
  })
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "success" | "error">("idle")
  const { toast } = useToast()

  const handleSaveConfig = async () => {
    try {
      await updateConfig(firebaseConfig)

      toast({
        title: "Firebase Configuration Saved",
        description:
          "Your Firebase configuration has been updated. You may need to refresh the page for changes to take effect.",
      })
    } catch (error) {
      console.error("Error saving Firebase config:", error)
      toast({
        title: "Error",
        description: "Failed to save Firebase configuration",
        variant: "destructive",
      })
    }
  }

  const handleTestConnection = async () => {
    setTestStatus("testing")

    try {
      const result = await testConnection(firebaseConfig)

      if (result) {
        setTestStatus("success")
        toast({
          title: "Connection Successful",
          description: "Successfully connected to Firebase",
        })
      } else {
        setTestStatus("error")
        toast({
          title: "Connection Failed",
          description: "Failed to connect to Firebase. Please check your configuration.",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error testing Firebase connection:", error)
      setTestStatus("error")
      toast({
        title: "Connection Error",
        description: "An error occurred while testing the connection",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Firebase Configuration</CardTitle>
          <CardDescription>Configure your Firebase connection for data storage</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="api-key">API Key</Label>
            <Input
              id="api-key"
              value={firebaseConfig.apiKey}
              onChange={(e) => setFirebaseConfig({ ...firebaseConfig, apiKey: e.target.value })}
              placeholder="Your Firebase API Key"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="auth-domain">Auth Domain</Label>
            <Input
              id="auth-domain"
              value={firebaseConfig.authDomain}
              onChange={(e) => setFirebaseConfig({ ...firebaseConfig, authDomain: e.target.value })}
              placeholder="your-project-id.firebaseapp.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project-id">Project ID</Label>
            <Input
              id="project-id"
              value={firebaseConfig.projectId}
              onChange={(e) => setFirebaseConfig({ ...firebaseConfig, projectId: e.target.value })}
              placeholder="your-project-id"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="storage-bucket">Storage Bucket</Label>
            <Input
              id="storage-bucket"
              value={firebaseConfig.storageBucket}
              onChange={(e) => setFirebaseConfig({ ...firebaseConfig, storageBucket: e.target.value })}
              placeholder="your-project-id.appspot.com"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="messaging-sender-id">Messaging Sender ID</Label>
            <Input
              id="messaging-sender-id"
              value={firebaseConfig.messagingSenderId}
              onChange={(e) => setFirebaseConfig({ ...firebaseConfig, messagingSenderId: e.target.value })}
              placeholder="Your Messaging Sender ID"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="app-id">App ID</Label>
            <Input
              id="app-id"
              value={firebaseConfig.appId}
              onChange={(e) => setFirebaseConfig({ ...firebaseConfig, appId: e.target.value })}
              placeholder="Your Firebase App ID"
            />
          </div>

          {testStatus === "success" && (
            <div className="flex items-center p-3 text-sm rounded-md bg-green-50 text-green-700">
              <CheckCircle2 className="h-5 w-5 mr-2 text-green-500" />
              Connection to Firebase successful
            </div>
          )}

          {testStatus === "error" && (
            <div className="flex items-center p-3 text-sm rounded-md bg-red-50 text-red-700">
              <AlertCircle className="h-5 w-5 mr-2 text-red-500" />
              Failed to connect to Firebase. Please check your configuration.
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={
              !firebaseConfig.apiKey ||
              !firebaseConfig.authDomain ||
              !firebaseConfig.projectId ||
              testStatus === "testing"
            }
          >
            {testStatus === "testing" ? "Testing..." : "Test Connection"}
          </Button>
          <Button
            onClick={handleSaveConfig}
            disabled={!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId}
          >
            Save Configuration
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

