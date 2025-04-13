"use client"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProtectedTabTrigger } from "@/components/ui/protected-tab-trigger"
import { ProtectedTabContent } from "@/components/ui/protected-tab-content"
import { LocationSettings } from "@/components/settings/location-settings"
import { UserSettings } from "@/components/settings/user-settings"
import { NotificationSettings } from "@/components/settings/notification-settings"
import { FirebaseSettings } from "@/components/settings/firebase-settings"
import { WeatherSettings } from "@/components/settings/weather-settings"
import { ControlSettings } from "@/components/settings/control-settings"
import { SessionSettings } from "@/components/settings/session-settings"
import { DatabaseSettings } from "@/components/settings/database-settings"
import { ConnectionTestingSettings } from "@/components/settings/connection-testing"

export default function SettingsContent() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground">Manage your system settings and preferences.</p>
      </div>
      <Tabs defaultValue="locations" className="w-full">
        <TabsList className="grid w-full grid-cols-9">
          <TabsTrigger value="locations" className="hover:bg-[#e6f3f1]">
            Locations
          </TabsTrigger>
          <TabsTrigger value="users" className="hover:bg-[#e6f3f1]">
            Users
          </TabsTrigger>
          <TabsTrigger value="notifications" className="hover:bg-[#e6f3f1]">
            Notifications
          </TabsTrigger>

          {/* Protected Firebase Tab - Only for DevOps */}
          <ProtectedTabTrigger value="firebase" requiredRoles={["devops", "admin"]} className="hover:bg-[#e6f3f1]">
            Firebase
          </ProtectedTabTrigger>

          <TabsTrigger value="weather" className="hover:bg-[#e6f3f1]">
            Weather
          </TabsTrigger>
          <TabsTrigger value="control" className="hover:bg-[#e6f3f1]">
            Control
          </TabsTrigger>
          <TabsTrigger value="session" className="hover:bg-[#e6f3f1]">
            Session
          </TabsTrigger>
          <TabsTrigger value="database" className="hover:bg-[#e6f3f1]">
            Database
          </TabsTrigger>
          <TabsTrigger value="connection" className="hover:bg-[#e6f3f1]">
            Connection
          </TabsTrigger>
        </TabsList>
        <TabsContent value="locations">
          <LocationSettings />
        </TabsContent>
        <TabsContent value="users">
          <UserSettings />
        </TabsContent>
        <TabsContent value="notifications">
          <NotificationSettings />
        </TabsContent>

        {/* Protected Firebase Content */}
        <ProtectedTabContent value="firebase" requiredRoles={["devops", "admin"]}>
          <FirebaseSettings />
        </ProtectedTabContent>

        <TabsContent value="weather">
          <WeatherSettings />
        </TabsContent>
        <TabsContent value="control">
          <ControlSettings />
        </TabsContent>
        <TabsContent value="session">
          <SessionSettings />
        </TabsContent>
        <TabsContent value="database">
          <DatabaseSettings />
        </TabsContent>
        <TabsContent value="connection">
          <ConnectionTestingSettings />
        </TabsContent>
      </Tabs>
    </div>
  )
}

