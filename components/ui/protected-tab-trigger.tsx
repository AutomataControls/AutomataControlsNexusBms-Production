"use client"

import { TabsTrigger } from "@/components/ui/tabs"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/components/ui/use-toast"

interface ProtectedTabTriggerProps {
  value: string
  requiredRoles: string[]
  children: React.ReactNode
  className?: string
}

export function ProtectedTabTrigger({ value, requiredRoles, children, className }: ProtectedTabTriggerProps) {
  const { user } = useAuth()
  const { toast } = useToast()

  const handleClick = () => {
    // If no user or user doesn't have required role, show toast and prevent access
    if (!user || !requiredRoles.some(role => user.roles.includes(role))) {
      toast({
        title: "Access Denied",
        description: "You don't have permission to access this section.",
        variant: "destructive",
      })
      return
    }
  }

  return (
    <TabsTrigger 
      value={value} 
      className={className}
      onClick={handleClick}
    >
      {children}
    </TabsTrigger>
  )
}
