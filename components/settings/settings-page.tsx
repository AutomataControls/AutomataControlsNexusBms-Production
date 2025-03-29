"use client"

import { useState } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DatabaseSettings } from "./database-settings"
import { ControlSettings } from "./control-settings"
import { SocketSettings } from "./socket-settings"

export function SettingsPage() {
  const [activeTab, setActiveTab] = useState("database")

  return (
    <div className="container mx-auto py-6">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="database">Database</TabsTrigger>
          <TabsTrigger value="control">Control System</TabsTrigger>
          <TabsTrigger value="socket">Socket.IO</TabsTrigger>
        </TabsList>

        <TabsContent value="database" className="space-y-4">
          <DatabaseSettings />
        </TabsContent>

        <TabsContent value="control" className="space-y-4">
          <ControlSettings />
        </TabsContent>

        <TabsContent value="socket" className="space-y-4">
          <SocketSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
} 