"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

export function ControlSettings() {
  const [controlConfig, setControlConfig] = useState({
    controlServerIp: "",
    controlServerPort: "1883",
    controlServerUsername: "",
    controlServerPassword: "",
    controlProtocol: "mqtt",
  })
  const { db, config, updateConfig } = useFirebase()
  const { toast } = useToast()

  useEffect(() => {
    if (config) {
      setControlConfig({
        controlServerIp: config.controlServerIp || "",
        controlServerPort: config.controlServerPort || "1883",
        controlServerUsername: config.controlServerUsername || "",
        controlServerPassword: config.controlServerPassword || "",
        controlProtocol: config.controlProtocol || "mqtt",
      })
    }
  }, [config])

  const handleSaveConfig = async () => {
    try {
      await updateConfig({
        ...config,
        ...controlConfig,
      })

      toast({
        title: "Control Configuration Saved",
        description: "Your control server configuration has been updated",
      })
    } catch (error) {
      console.error("Error saving control config:", error)
      toast({
        title: "Error",
        description: "Failed to save control server configuration",
        variant: "destructive",
      })
    }
  }

  const handleTestConnection = async () => {
    try {
      // In a real application, this would test the connection to the control server
      toast({
        title: "Connection Test",
        description: "This is a placeholder for testing the connection to your control server",
      })
    } catch (error) {
      console.error("Error testing control server connection:", error)
      toast({
        title: "Error",
        description: "Failed to test control server connection",
        variant: "destructive",
      })
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Control Server Configuration</CardTitle>
          <CardDescription>Configure the connection to your equipment control server</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="control-protocol">Control Protocol</Label>
            <Select
              value={controlConfig.controlProtocol}
              onValueChange={(value) => setControlConfig({ ...controlConfig, controlProtocol: value })}
            >
              <SelectTrigger id="control-protocol">
                <SelectValue placeholder="Select protocol" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mqtt">MQTT</SelectItem>
                <SelectItem value="http">HTTP/REST</SelectItem>
                <SelectItem value="modbus">Modbus TCP</SelectItem>
                <SelectItem value="bacnet">BACnet</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="server-ip">Server IP/Hostname</Label>
              <Input
                id="server-ip"
                value={controlConfig.controlServerIp}
                onChange={(e) => setControlConfig({ ...controlConfig, controlServerIp: e.target.value })}
                placeholder="192.168.1.100 or server.example.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-port">Server Port</Label>
              <Input
                id="server-port"
                value={controlConfig.controlServerPort}
                onChange={(e) => setControlConfig({ ...controlConfig, controlServerPort: e.target.value })}
                placeholder="1883"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="server-username">Username</Label>
              <Input
                id="server-username"
                value={controlConfig.controlServerUsername}
                onChange={(e) => setControlConfig({ ...controlConfig, controlServerUsername: e.target.value })}
                placeholder="Username (if required)"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="server-password">Password</Label>
              <Input
                id="server-password"
                type="password"
                value={controlConfig.controlServerPassword}
                onChange={(e) => setControlConfig({ ...controlConfig, controlServerPassword: e.target.value })}
                placeholder="Password (if required)"
              />
            </div>
          </div>

          <div className="p-3 text-sm rounded-md bg-blue-50 text-blue-700">
            <p>
              The system will use Socket.IO to connect to the local server, which will bridge to{" "}
              {controlConfig.controlProtocol.toUpperCase()} for equipment control.
            </p>
          </div>
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={handleTestConnection} disabled={!controlConfig.controlServerIp}>
            Test Connection
          </Button>
          <Button onClick={handleSaveConfig} disabled={!controlConfig.controlServerIp}>
            Save Configuration
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}

