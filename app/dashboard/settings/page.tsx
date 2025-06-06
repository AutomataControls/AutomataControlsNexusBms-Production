// app/dashboard/settings/page.tsx
//
// Author: Juelz NeuralBms DevOps
// Last Updated: June 5, 2025
//
// ===============================================================================
// NEURAL BMS SETTINGS PAGE - MAIN ADMINISTRATIVE INTERFACE
// ===============================================================================
//
// OVERVIEW:
// This is the main settings interface for the Neural BMS system providing a tabbed
// interface for managing all system configurations, user access, equipment setup,
// and operational parameters. The page uses role-based access control to ensure
// only authorized personnel can modify critical system settings.
//
// TAB STRUCTURE (6 Total Tabs):
// 1. **Locations** - Public access for viewing and managing building locations
//    * Add/edit/delete facility locations
//    * Configure location-specific parameters
//    * Set up Firebase paths and system identifiers
//    * No role restrictions - accessible to all authenticated users
//
// 2. **Equipment** - DevOps restricted for HVAC equipment management
//    * Add/edit/delete HVAC equipment (chillers, boilers, AHUs, etc.)
//    * Configure equipment thresholds and operational parameters
//    * Set up Firebase Real-time Database paths for data integration
//    * Define equipment types, zones, and monitoring points
//    * IP address configuration for network-connected equipment
//
// 3. **Users** - DevOps restricted for user account management
//    * Create/modify/delete user accounts
//    * Assign user roles and permissions
//    * Configure authentication settings
//    * Manage user access levels and restrictions
//
// 4. **Notifications** - DevOps restricted for alert system configuration
//    * Configure system alerts and notification rules
//    * Set up email/SMS notification preferences
//    * Define threshold-based alert triggers
//    * Manage notification recipients and escalation procedures
//
// 5. **Session** - DevOps restricted for session management
//    * Configure session timeout settings
//    * Manage authentication parameters
//    * Set up session security policies
//    * Configure login/logout behavior
//
// 6. **Audit** - DevOps restricted for system audit and logging
//    * View system audit logs and user activity
//    * Configure logging levels and retention policies
//    * Monitor system changes and access patterns
//    * Export audit trails for compliance
//
// SECURITY FEATURES:
// - **AdminGuard**: Wraps entire page to ensure only admin users can access
// - **Role-Based Access**: Most tabs restricted to "devops" role for security
// - **Protected Components**: Uses ProtectedTabTrigger and ProtectedTabContent
// - **Authentication**: Integrated with Firebase Auth for secure access control
//
// COMPONENT ARCHITECTURE:
// - **Modular Design**: Each tab implemented as separate component for maintainability
// - **Lazy Loading**: Tab content only rendered when selected for performance
// - **Consistent Styling**: Uses Tailwind CSS with teal theme for brand consistency
// - **Responsive Layout**: Grid-based layout adapts to different screen sizes
//
// TAB COMPONENT LOCATIONS:
// - LocationSettingsTab: /components/settings/location-settings-tab.tsx
// - EquipmentSettingsTab: /components/settings/equipment-settings-tab.tsx  
// - UserSettingsTab: /components/settings/user-settings-tab.tsx
// - NotificationSettingsTab: /components/settings/notification-settings-tab.tsx
// - SessionSettingsTab: /components/settings/session-settings-tab.tsx
// - AuditSettingsTab: /components/settings/audit-settings-tab.tsx
//
// UI COMPONENTS:
// - Uses shadcn/ui components for consistent design system
// - Tabs, TabsContent, TabsList, TabsTrigger from @/components/ui/tabs
// - Custom ProtectedTabTrigger and ProtectedTabContent for role-based access
// - AdminGuard wrapper for page-level access control
//
// STYLING:
// - **Active State**: Teal background (#14B8A6) with white text
// - **Hover State**: Light teal background (#F0FDFA) with teal text
// - **Grid Layout**: 6-column responsive grid for tab triggers
// - **Spacing**: Consistent spacing using Tailwind space utilities
//
// ACCESSIBILITY:
// - Proper ARIA labels and semantic HTML structure
// - Keyboard navigation support for all interactive elements
// - High contrast colors for readability
// - Screen reader compatible with proper heading hierarchy
//
// INTEGRATION POINTS:
// - **Firebase**: Authentication and database integration
// - **Role Management**: Integrated with user role system
// - **Equipment Management**: Direct integration with equipment control systems
// - **Audit Logging**: All setting changes logged for compliance
//
// FUTURE ENHANCEMENTS:
// - Additional tabs for advanced system configuration
// - Real-time collaboration features for multi-user editing
// - Backup/restore functionality for system settings
// - API integration for external system management
//
// PERFORMANCE CONSIDERATIONS:
// - Tab content only loads when selected (lazy loading)
// - Minimal re-renders with proper React optimization
// - Efficient state management within individual tab components
// - Optimized for fast switching between tabs
//
// ===============================================================================

"use client"

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ProtectedTabTrigger } from "@/components/ui/protected-tab-trigger"
import { ProtectedTabContent } from "@/components/ui/protected-tab-content"
import { AdminGuard } from "@/components/admin-guard"
import { LocationSettingsTab } from "@/components/settings/location-settings-tab"
import { EquipmentSettingsTab } from "@/components/settings/equipment-settings-tab"
import { UserSettingsTab } from "@/components/settings/user-settings-tab"
import { NotificationSettingsTab } from "@/components/settings/notification-settings-tab"
import { SessionSettingsTab } from "@/components/settings/session-settings-tab"
import { AuditSettingsTab } from "@/components/settings/audit-settings-tab"

export default function SettingsPage() {
  return (
    <AdminGuard>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
          <p className="text-slate-600">Manage your Neural BMS system settings and preferences.</p>
        </div>
        <Tabs defaultValue="locations" className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-white border border-slate-200">
            <TabsTrigger
              value="locations"
              className="data-[state=active]:bg-teal-500 data-[state=active]:text-white hover:bg-teal-50 hover:text-teal-700"
            >
              Locations
            </TabsTrigger>
            <ProtectedTabTrigger
              value="equipment"
              requiredRoles={["devops"]}
              className="data-[state=active]:bg-teal-500 data-[state=active]:text-white hover:bg-teal-50 hover:text-teal-700"
            >
              Equipment
            </ProtectedTabTrigger>
            <ProtectedTabTrigger
              value="users"
              requiredRoles={["devops"]}
              className="data-[state=active]:bg-teal-500 data-[state=active]:text-white hover:bg-teal-50 hover:text-teal-700"
            >
              Users
            </ProtectedTabTrigger>
            <ProtectedTabTrigger
              value="notifications"
              requiredRoles={["devops"]}
              className="data-[state=active]:bg-teal-500 data-[state=active]:text-white hover:bg-teal-50 hover:text-teal-700"
            >
              Notifications
            </ProtectedTabTrigger>
            <ProtectedTabTrigger
              value="session"
              requiredRoles={["devops"]}
              className="data-[state=active]:bg-teal-500 data-[state=active]:text-white hover:bg-teal-50 hover:text-teal-700"
            >
              Session
            </ProtectedTabTrigger>
            <ProtectedTabTrigger
              value="audit"
              requiredRoles={["devops"]}
              className="data-[state=active]:bg-teal-500 data-[state=active]:text-white hover:bg-teal-50 hover:text-teal-700"
            >
              Audit
            </ProtectedTabTrigger>
          </TabsList>
          <TabsContent value="locations">
            <LocationSettingsTab />
          </TabsContent>
          <ProtectedTabContent value="equipment" requiredRoles={["devops"]}>
            <EquipmentSettingsTab />
          </ProtectedTabContent>
          <ProtectedTabContent value="users" requiredRoles={["devops"]}>
            <UserSettingsTab />
          </ProtectedTabContent>
          <ProtectedTabContent value="notifications" requiredRoles={["devops"]}>
            <NotificationSettingsTab />
          </ProtectedTabContent>
          <ProtectedTabContent value="session" requiredRoles={["devops"]}>
            <SessionSettingsTab />
          </ProtectedTabContent>
          <ProtectedTabContent value="audit" requiredRoles={["devops"]}>
            <AuditSettingsTab />
          </ProtectedTabContent>
        </Tabs>
      </div>
    </AdminGuard>
  )
}
