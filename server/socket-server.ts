import { Server } from "socket.io"
import { createServer } from "http"
import { Server as NetServer } from "net"
import { NextApiResponse } from "next"
import { db } from "@/lib/firebase"

export type NextApiResponseServerIO = NextApiResponse & {
  socket: NetServer & {
    server?: NetServer & {
      io?: Server
    }
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
}

const initSocketServer = (server: NetServer) => {
  if (!(server as any).io) {
    console.log("Initializing Socket.IO server...")
    const io = new Server(server, {
      path: "/api/socket",
      addTrailingSlash: false,
      cors: {
        origin: "*",
        methods: ["GET", "POST"],
      },
    })

    // Store the io instance on the server object
    ;(server as any).io = io

    io.on("connection", (socket) => {
      console.log("Client connected:", socket.id)

      // Handle equipment control messages
      socket.on("control", async (data) => {
        try {
          const { equipmentId, controls } = data
          console.log(`Received control command for equipment ${equipmentId}:`, controls)

          // Update equipment controls in Firebase
          await db.collection("equipment").doc(equipmentId).update({
            controls,
            lastUpdated: new Date(),
          })

          // Broadcast the control update to all connected clients
          io.emit("equipment_update", {
            equipmentId,
            type: "control",
            data: controls,
          })

          // Acknowledge the control command
          socket.emit("control_ack", {
            success: true,
            equipmentId,
            message: "Control command processed successfully",
          })
        } catch (error) {
          console.error("Error processing control command:", error)
          socket.emit("control_ack", {
            success: false,
            equipmentId: data.equipmentId,
            message: "Failed to process control command",
          })
        }
      })

      // Handle equipment data subscriptions
      socket.on("subscribe", (data) => {
        const { equipmentId } = data
        socket.join(`equipment_${equipmentId}`)
        console.log(`Client ${socket.id} subscribed to equipment ${equipmentId}`)
      })

      // Handle equipment data unsubscriptions
      socket.on("unsubscribe", (data) => {
        const { equipmentId } = data
        socket.leave(`equipment_${equipmentId}`)
        console.log(`Client ${socket.id} unsubscribed from equipment ${equipmentId}`)
      })

      // Handle client disconnection
      socket.on("disconnect", () => {
        console.log("Client disconnected:", socket.id)
      })
    })
  }

  return (server as any).io
}

export default initSocketServer 