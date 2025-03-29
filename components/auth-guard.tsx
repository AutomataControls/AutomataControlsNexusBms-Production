"use client"
import type React from "react"
import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"

interface AuthGuardProps {
  children: React.ReactNode
  requiredRole?: string
}

export function AuthGuard({ children, requiredRole }: AuthGuardProps) {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [redirectAttempted, setRedirectAttempted] = useState(false)

  useEffect(() => {
    // Add console logging to debug authentication state
    console.log("Auth state:", { loading, user: !!user, requiredRole, redirectAttempted });
    
    // Only redirect once to prevent loops
    if (!redirectAttempted && !loading) {
      if (!user) {
        console.log("Redirecting to login: Not authenticated");
        setRedirectAttempted(true);
        router.push("/login");
      } else if (user && requiredRole && !user.roles.includes(requiredRole)) {
        console.log("Redirecting to dashboard: Missing required role");
        setRedirectAttempted(true);
        router.push("/dashboard");
      }
    }
  }, [user, loading, router, requiredRole, redirectAttempted]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }
  
  if (!user) {
    return null
  }
  
  if (requiredRole && !user.roles.includes(requiredRole)) {
    return null
  }
  
  return <>{children}</>
}
