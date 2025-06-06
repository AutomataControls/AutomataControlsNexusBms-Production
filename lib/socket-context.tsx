// @ts-nocheck
"use client"

import type React from "react"
import { createContext, useContext } from "react"
import type { Socket } from "socket.io-client"

interface SocketContextType {
    socket: Socket | null
    connected: boolean
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function SocketProvider({ children }: { children: React.ReactNode }) {
    // Provide dummy values since sockets aren't being used
    return <SocketContext.Provider value={{ socket: null, connected: false }}>{children}</SocketContext.Provider>
}

export function useSocket() {
    const context = useContext(SocketContext)
    if (context === undefined) {
        throw new Error("useSocket must be used within a SocketProvider")
    }
    return context
}
