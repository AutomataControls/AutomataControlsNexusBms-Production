"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface SessionConfig {
  enableTimeout: boolean
  timeoutMinutes: number
  warnBeforeTimeout: boolean
  warningSeconds: number
}

export function SessionTimeout() {
  const router = useRouter()
  const { user, logout } = useAuth()
  const [lastActivity, setLastActivity] = useState<number>(Date.now())
  const [showWarning, setShowWarning] = useState<boolean>(false)
  const [timeRemaining, setTimeRemaining] = useState<number>(0)
  const [config, setConfig] = useState<SessionConfig>({
    enableTimeout: true,
    timeoutMinutes: 3,
    warnBeforeTimeout: true,
    warningSeconds: 30,
  })

  // Load config from localStorage
  useEffect(() => {
    const savedConfig = localStorage.getItem("sessionConfig")
    if (savedConfig) {
      setConfig(JSON.parse(savedConfig))
    }

    // Listen for config updates
    const handleConfigUpdate = (e: CustomEvent) => {
      setConfig(e.detail)
    }

    window.addEventListener("session-config-updated", handleConfigUpdate as EventListener)
    return () => {
      window.removeEventListener("session-config-updated", handleConfigUpdate as EventListener)
    }
  }, [])

  // Track user activity
  useEffect(() => {
    if (!user || !config.enableTimeout) return

    const updateActivity = () => {
      setLastActivity(Date.now())
      setShowWarning(false)
    }

    // Events to track
    const events = ["mousedown", "mousemove", "keypress", "scroll", "touchstart", "click"]

    // Add event listeners
    events.forEach((event) => {
      document.addEventListener(event, updateActivity)
    })

    return () => {
      // Remove event listeners
      events.forEach((event) => {
        document.removeEventListener(event, updateActivity)
      })
    }
  }, [user, config.enableTimeout])

  // Check for inactivity
  useEffect(() => {
    if (!user || !config.enableTimeout) return

    const timeoutMs = config.timeoutMinutes * 60 * 1000
    const warningMs = config.warningSeconds * 1000

    const interval = setInterval(() => {
      const now = Date.now()
      const elapsed = now - lastActivity

      // If warning is enabled and we're in the warning period
      if (config.warnBeforeTimeout && elapsed > timeoutMs - warningMs && elapsed < timeoutMs) {
        setShowWarning(true)
        setTimeRemaining(Math.ceil((timeoutMs - elapsed) / 1000))
      }
      // If timeout has been reached
      else if (elapsed >= timeoutMs) {
        clearInterval(interval)
        handleTimeout()
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [user, lastActivity, config])

  const handleTimeout = () => {
    setShowWarning(false)
    logout()
    router.push("/login")
  }

  const handleContinue = () => {
    setLastActivity(Date.now())
    setShowWarning(false)
  }

  if (!user) return null

  return (
    <Dialog open={showWarning} onOpenChange={setShowWarning}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Session Timeout Warning</DialogTitle>
        </DialogHeader>
        <div className="py-4">
          <p>Your session is about to expire due to inactivity.</p>
          <p className="mt-2 font-medium">You will be logged out in {timeRemaining} seconds.</p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={handleTimeout}>
            Logout Now
          </Button>
          <Button onClick={handleContinue}>Continue Session</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

