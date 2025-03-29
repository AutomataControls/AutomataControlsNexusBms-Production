"use client"

import { TabsContent } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth-context"

interface ProtectedTabContentProps {
  value: string
  requiredRoles: string[]
  children: React.ReactNode
}

export function ProtectedTabContent({ value, requiredRoles, children }: ProtectedTabContentProps) {
  const { user } = useAuth()

  // Check if user has at least one of the required roles
  const hasAccess = user && requiredRoles.some(role => user.roles.includes(role))

  if (!hasAccess) {
    return (
      <TabsContent value={value}>
        <div className="p-8 text-center">
          <h3 className="text-lg font-medium">Access Denied</h3>
          <p className="text-muted-foreground mt-2">
            You don't have permission to view this section.
          </p>
        </div>
      </TabsContent>
    )
  }

  return <TabsContent value={value}>{children}</TabsContent>
}
