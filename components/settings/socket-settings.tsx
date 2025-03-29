"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/use-toast"
import { useFirebase } from "@/lib/firebase-context"

export function SocketSettings() {
  const { config, updateConfig } = useFirebase()
  const [topics, setTopics] = useState({
    metrics: config?.mqttTopics?.metrics || "equipment/+/metrics",
    status: config?.mqttTopics?.status || "equipment/+/status",
    alarms: config?.mqttTopics?.alarms || "equipment/+/alarms",
    locations: config?.mqttTopics?.locations || "locations/+/status",
  })
  const [isLoading, setIsLoading] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    if (config?.mqttTopics) {
      setTopics(config.mqttTopics)
    }
  }, [config])

  const handleSaveTopics = async () => {
    try {
      setIsLoading(true)
      await updateConfig({
        ...config,
        mqttTopics: topics,
      })

      toast({
        title: "Topics Saved",
        description: "MQTT topics have been updated successfully.",
        className: "bg-teal-50 border-teal-200",
      })
    } catch (error) {
      console.error("Error saving topics:", error)
      toast({
        title: "Save Error",
        description: "Failed to save MQTT topics. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Socket.IO Topics Configuration</CardTitle>
          <CardDescription>
            Configure the MQTT topics that the bridge server will subscribe to.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="metrics-topic">Metrics Topic</Label>
            <Input
              id="metrics-topic"
              value={topics.metrics}
              onChange={(e) => setTopics({ ...topics, metrics: e.target.value })}
              placeholder="equipment/+/metrics"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status-topic">Status Topic</Label>
            <Input
              id="status-topic"
              value={topics.status}
              onChange={(e) => setTopics({ ...topics, status: e.target.value })}
              placeholder="equipment/+/status"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alarms-topic">Alarms Topic</Label>
            <Input
              id="alarms-topic"
              value={topics.alarms}
              onChange={(e) => setTopics({ ...topics, alarms: e.target.value })}
              placeholder="equipment/+/alarms"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="locations-topic">Locations Topic</Label>
            <Input
              id="locations-topic"
              value={topics.locations}
              onChange={(e) => setTopics({ ...topics, locations: e.target.value })}
              placeholder="locations/+/status"
            />
          </div>

          <div className="p-3 text-sm rounded-md bg-blue-50 text-blue-700">
            <p>
              Use the + wildcard to match any single level in the topic hierarchy.
              For example: equipment/+/metrics will match equipment/123/metrics,
              equipment/456/metrics, etc.
            </p>
          </div>
        </CardContent>
        <CardFooter>
          <Button onClick={handleSaveTopics} disabled={isLoading}>
            {isLoading ? "Saving..." : "Save Topics"}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
} 