import { NextApiRequest } from "next"
import { NextApiResponseServerIO } from "@/server/socket-server"
import initSocketServer from "@/server/socket-server"

export const config = {
  api: {
    bodyParser: false,
  },
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponseServerIO
) {
  if (!res.socket.server?.io) {
    // Initialize Socket.IO server
    initSocketServer(res.socket.server)
  }

  res.end()
} 