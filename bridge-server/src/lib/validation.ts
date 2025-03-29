import { z } from "zod"

// MQTT Configuration validation
export const mqttConfigSchema = z.object({
  host: z.string().min(1, "MQTT host is required"),
  port: z.number().int().min(1).max(65535, "Port must be between 1 and 65535"),
  username: z.string().min(1, "MQTT username is required"),
  password: z.string().min(1, "MQTT password is required"),
  clientId: z.string().min(1, "Client ID is required"),
  topics: z.array(z.string().min(1, "Topic cannot be empty")),
})

// MQTT Message validation
export const mqttMessageSchema = z.object({
  topic: z.string().min(1, "Topic is required"),
  payload: z.any(),
  qos: z.number().int().min(0).max(2, "QoS must be between 0 and 2"),
  retain: z.boolean().optional(),
})

// Equipment Control Message validation
export const equipmentControlSchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
  controls: z.record(z.string(), z.any()),
  timestamp: z.date().optional().default(() => new Date()),
})

// Equipment Metrics Message validation
export const equipmentMetricsSchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
  metrics: z.record(z.string(), z.number()),
  timestamp: z.date().optional().default(() => new Date()),
})

// Equipment Status Message validation
export const equipmentStatusSchema = z.object({
  equipmentId: z.string().min(1, "Equipment ID is required"),
  status: z.enum(["online", "offline", "error", "maintenance"]),
  errorCode: z.string().optional(),
  errorMessage: z.string().optional(),
  timestamp: z.date().optional().default(() => new Date()),
})

// Validation helper functions
export function validateMQTTConfig(data: unknown) {
  try {
    const result = mqttConfigSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateMQTTMessage(data: unknown) {
  try {
    const result = mqttMessageSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateEquipmentControl(data: unknown) {
  try {
    const result = equipmentControlSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateEquipmentMetrics(data: unknown) {
  try {
    const result = equipmentMetricsSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateEquipmentStatus(data: unknown) {
  try {
    const result = equipmentStatusSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

// Type exports
export type MQTTConfig = z.infer<typeof mqttConfigSchema>
export type MQTTMessage = z.infer<typeof mqttMessageSchema>
export type EquipmentControl = z.infer<typeof equipmentControlSchema>
export type EquipmentMetrics = z.infer<typeof equipmentMetricsSchema>
export type EquipmentStatus = z.infer<typeof equipmentStatusSchema> 