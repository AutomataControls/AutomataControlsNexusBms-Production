"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect } from "react"
import io, { type Socket } from "socket.io-client"
import { useFirebase } from "./firebase-context"

interface SocketContextType {
    socket: Socket | null
    connected: boolean
}

const SocketContext = createContext<SocketContextType | undefined>(undefined)

export function SocketProvider({ children }: { children: React.ReactNode }) {
    const [socket, setSocket] = useState<Socket | null>(null)
    const [connected, setConnected] = useState<boolean>(false)
    const { config } = useFirebase()

    useEffect(() => {
        // Initialize socket connection
        const initSocket = () => {
            try {
                // Determine proper connection URL and path based on environment
                const currentUrl = typeof window !== 'undefined' ? window.location.origin : '';
                console.log("Current URL:", currentUrl);

                // Use the current domain as the Socket.IO URL
                const url = currentUrl || process.env.NEXT_PUBLIC_BRIDGE_URL || "http://localhost:3099";
                const path = '/socket.io';

                console.log("Initializing Socket.IO connection to:", url, "with path:", path)

                // Connect to the bridge server with proper configuration
                const socketInstance = io(url, {
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    timeout: 60000,
                    transports: ["polling", "websocket"], // Try polling first, then websocket
                    withCredentials: true,
                    autoConnect: true,
                    path: path
                })

                console.log("Socket.IO instance created with config:", {
                    url,
                    reconnectionAttempts: 5,
                    reconnectionDelay: 1000,
                    timeout: 60000,
                    transports: ["polling", "websocket"],
                    withCredentials: true,
                    autoConnect: true,
                    path: path
                })

                socketInstance.on("connect", () => {
                    console.log("Socket.IO connected to bridge server")
                    console.log("Transport:", socketInstance.io.engine.transport.name)
                    console.log("Socket ID:", socketInstance.id)
                    setConnected(true)
                })

                socketInstance.on("disconnect", (reason) => {
                    console.log("Socket.IO disconnected from bridge server. Reason:", reason)
                    setConnected(false)
                })

                socketInstance.on("connect_error", (error) => {
                    console.error("Socket.IO connection error:", error.message, error)
                    setConnected(false)
                })

                socketInstance.on("error", (error) => {
                    console.error("Socket.IO error:", error)
                    setConnected(false)
                })

                socketInstance.io.on("reconnect_attempt", (attempt) => {
                    console.log("Socket.IO reconnection attempt:", attempt)
                })

                socketInstance.io.on("reconnect", (attempt) => {
                    console.log("Socket.IO reconnected after", attempt, "attempts")
                })

                socketInstance.io.on("reconnect_error", (error) => {
                    console.error("Socket.IO reconnection error:", error)
                })

                socketInstance.io.on("reconnect_failed", () => {
                    console.error("Socket.IO reconnection failed")
                })

                // Handle equipment updates
                socketInstance.on("equipment_update", (data) => {
                    console.log("Equipment update received:", data)
                })

                // Handle control acknowledgments
                socketInstance.on("control_ack", (data) => {
                    console.log("Control acknowledgment received:", data)
                })

                setSocket(socketInstance)

                return () => {
                    console.log("Cleaning up Socket.IO connection...")
                    socketInstance.disconnect()
                }
            } catch (error) {
                console.error("Error initializing Socket.IO:", error)
                setConnected(false)
            }
        }

        initSocket()

        return () => {
            if (socket) {
                socket.disconnect()
            }
        }
    }, [])

    return <SocketContext.Provider value={{ socket, connected }}>{children}</SocketContext.Provider>
}

export function useSocket() {
    const context = useContext(SocketContext)
    if (context === undefined) {
        throw new Error("useSocket must be used within a SocketProvider")
    }
    return context
}
