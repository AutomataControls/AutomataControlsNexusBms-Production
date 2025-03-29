"use client"

import { useAuth } from "@/lib/auth-context"
import { Shield, ShieldOff } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function AuthStatus() {
  const { user } = useAuth()
  const isAuthenticated = !!user

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={`flex items-center px-2 py-1 rounded-md ${
              isAuthenticated
                ? "bg-teal-100" // ultra light teal
                : "bg-teal-50" // ultra ultra ultra light teal
            }`}
          >
            {isAuthenticated ? (
              <>
                <Shield className="h-4 w-4 mr-1 text-teal-600" />
                <span className="text-xs font-medium text-black">Authenticated</span>
              </>
            ) : (
              <>
                <ShieldOff className="h-4 w-4 mr-1 text-teal-400" />
                <span className="text-xs font-medium text-black">Unauthenticated</span>
              </>
            )}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{isAuthenticated ? `Logged in as ${user?.name || user?.username}` : "Not logged in"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

