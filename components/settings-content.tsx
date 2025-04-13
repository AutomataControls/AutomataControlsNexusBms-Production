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
import { AuditSettings } from "@/components/settings/audit-settings"
import { AdminGuard } from "@/components/admin-guard"

export default function SettingsContent() {
  return (
    <AdminGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your system settings and preferences.</p>
        </div>
        <Tabs defaultValue="locations" className="w-full">
          <TabsList className="grid w-full grid-cols-10">
            <TabsTrigger value="locations" className="hover:bg-[#e6f3f1]">
              Locations
            </TabsTrigger>

            {/* Protected Tabs - Only for DevOps */}
            <ProtectedTabTrigger value="users" requiredRoles={["devops"]} className="hover:bg-[#e6f3f1]">
              Users
            </ProtectedTabTrigger>

            <ProtectedTabTrigger value="notifications" requiredRoles={["devops"]} className="hover:bg-[#e6f3f1]">
              Notifications
            </ProtectedTabTrigger>

            <ProtectedTabTrigger value="firebase" requiredRoles={["devops"]} className="hover:bg-[#e6f3f1]">
              Firebase
            </ProtectedTabTrigger>

            <ProtectedTabTrigger value="weather" requiredRoles={["devops"]} className="hover:bg-[#e6f3f1]">
              Weather
            </ProtectedTabTrigger>

            <ProtectedTabTrigger value="control" requiredRoles={["devops"]} className="hover:bg-[#e6f3f1]">
              Control
            </ProtectedTabTrigger>

            <ProtectedTabTrigger value="session" requiredRoles={["devops"]} className="hover:bg-[#e6f3f1]">
              Session
            </ProtectedTabTrigger>

            <ProtectedTabTrigger value="database" requiredRoles={["devops"]} className="hover:bg-[#e6f3f1]">
              Database
            </ProtectedTabTrigger>

            <ProtectedTabTrigger value="connection" requiredRoles={["devops"]} className="hover:bg-[#e6f3f1]">
              Connection
            </ProtectedTabTrigger>

            {/* New Audit Tab - Only for DevOps */}
            <ProtectedTabTrigger value="audit" requiredRoles={["devops"]} className="hover:bg-[#e6f3f1]">
              Audit
            </ProtectedTabTrigger>
          </TabsList>

          <TabsContent value="locations">
            <LocationSettings />
          </TabsContent>

          {/* Protected Content - Only for DevOps */}
          <ProtectedTabContent value="users" requiredRoles={["devops"]}>
            <UserSettings />
          </ProtectedTabContent>

          <ProtectedTabContent value="notifications" requiredRoles={["devops"]}>
            <NotificationSettings />
          </ProtectedTabContent>

          <ProtectedTabContent value="firebase" requiredRoles={["devops"]}>
            <FirebaseSettings />
          </ProtectedTabContent>

          <ProtectedTabContent value="weather" requiredRoles={["devops"]}>
            <WeatherSettings />
          </ProtectedTabContent>

          <ProtectedTabContent value="control" requiredRoles={["devops"]}>
            <ControlSettings />
          </ProtectedTabContent>

          <ProtectedTabContent value="session" requiredRoles={["devops"]}>
            <SessionSettings />
          </ProtectedTabContent>

          <ProtectedTabContent value="database" requiredRoles={["devops"]}>
            <DatabaseSettings />
          </ProtectedTabContent>

          <ProtectedTabContent value="connection" requiredRoles={["devops"]}>
            <ConnectionTestingSettings />
          </ProtectedTabContent>

          {/* New Audit Tab Content - Only for DevOps */}
          <ProtectedTabContent value="audit" requiredRoles={["devops"]}>
            <AuditSettings />
          </ProtectedTabContent>
        </Tabs>
      </div>
    </AdminGuard>
  )
}
