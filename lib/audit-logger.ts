// @ts-nocheck
import { getFirestore, collection, addDoc, serverTimestamp } from "firebase/firestore"

type AuditAction =
  | "create"
  | "update"
  | "delete"
  | "login"
  | "logout"
  | "setpoint"
  | "view"
  | "download"
  | "upload"
  | "email"
  | "reset"
  | "enable"
  | "disable"

interface AuditLogData {
  action: AuditAction
  userId: string
  userName: string
  locationId?: string
  locationName?: string
  details: string
  path?: string
  changes?: Record<string, any>
}

export async function logAuditEvent(data: AuditLogData) {
  try {
    const db = getFirestore()

    await addDoc(collection(db, "auditLogs"), {
      ...data,
      timestamp: serverTimestamp(),
    })

    console.log("Audit log created:", data.action)
  } catch (error) {
    console.error("Error creating audit log:", error)
  }
}
