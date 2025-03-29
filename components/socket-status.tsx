"use client"

import { useSocket } from "@/lib/socket-context"
import { Wifi, WifiOff } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

export function SocketStatus() {
  const { connected } = useSocket()

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center">
            {connected ? <Wifi className="h-5 w-5 text-teal-200" /> : <WifiOff className="h-5 w-5 text-amber-200/50" />}
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <p>{connected ? "Connected to control system" : "Disconnected from control system"}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

