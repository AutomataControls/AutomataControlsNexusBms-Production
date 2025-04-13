import { z } from "zod"

// Common validation schemas
const mqttTopicsSchema = z.object({
  metrics: z.string().min(1, "Metrics topic is required"),
  status: z.string().min(1, "Status topic is required"),
  control: z.string().min(1, "Control topic is required"),
})

const mqttConfigSchema = z.object({
  ip: z.string().ip("Invalid IP address"),
  port: z.number().int().min(1).max(65535),
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required"),
  topics: mqttTopicsSchema,
})

// Base threshold value schema
const thresholdValueSchema = z
  .object({
    min: z.number(),
    max: z.number(),
  })
  .refine((data) => data.max > data.min, {
    message: "Maximum value must be greater than minimum value",
    path: ["max"],
  })

// Measurement validation schemas
const temperatureSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    unit: z.literal("°F"),
    label: z.string(),
  })
  .refine((data) => data.max > data.min, {
    message: "Maximum value must be greater than minimum value",
    path: ["max"],
  })

const pressureSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    unit: z.literal("inWC"),
    label: z.string(),
  })
  .refine((data) => data.max > data.min, {
    message: "Maximum value must be greater than minimum value",
    path: ["max"],
  })

const humiditySchema = z
  .object({
    min: z.number(),
    max: z.number(),
    unit: z.literal("%"),
    label: z.string(),
  })
  .refine((data) => data.max > data.min, {
    message: "Maximum value must be greater than minimum value",
    path: ["max"],
  })

const flowSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    unit: z.literal("CFM"),
    label: z.string(),
  })
  .refine((data) => data.max > data.min, {
    message: "Maximum value must be greater than minimum value",
    path: ["max"],
  })

const powerSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    unit: z.literal("kW"),
    label: z.string(),
  })
  .refine((data) => data.max > data.min, {
    message: "Maximum value must be greater than minimum value",
    path: ["max"],
  })

const positionSchema = z
  .object({
    min: z.number(),
    max: z.number(),
    unit: z.literal("%"),
    label: z.string(),
  })
  .refine((data) => data.max > data.min, {
    message: "Maximum value must be greater than minimum value",
    path: ["max"],
  })

const co2Schema = z
  .object({
    min: z.number(),
    max: z.number(),
    unit: z.literal("ppm"),
    label: z.string(),
  })
  .refine((data) => data.max > data.min, {
    message: "Maximum value must be greater than minimum value",
    path: ["max"],
  })

// Threshold type validation schemas
export const thresholdTypesSchema = z.object({
  supplyAir: z.object({
    temperature: temperatureSchema,
    pressure: pressureSchema,
    humidity: humiditySchema,
    flow: flowSchema,
    co2: co2Schema,
  }),
  returnAir: z.object({
    temperature: temperatureSchema,
    pressure: pressureSchema,
    humidity: humiditySchema,
    flow: flowSchema,
    co2: co2Schema,
  }),
  mixedAir: z.object({
    temperature: temperatureSchema,
    pressure: pressureSchema,
    humidity: humiditySchema,
    flow: flowSchema,
    co2: co2Schema,
  }),
  waterSupply: z.object({
    temperature: temperatureSchema,
    pressure: pressureSchema,
    flow: flowSchema,
  }),
  waterReturn: z.object({
    temperature: temperatureSchema,
    pressure: pressureSchema,
    flow: flowSchema,
  }),
  power: z.object({
    total: powerSchema,
    fan: powerSchema,
    cooling: powerSchema,
    heating: powerSchema,
  }),
  damper: z.object({
    position: positionSchema,
  }),
})

// Equipment configuration validation
export const equipmentConfigSchema = z.object({
  name: z.string().min(1, "Name is required"),
  type: z.string().min(1, "Type is required"),
  locationId: z.string().min(1, "Location ID is required"),
  mqttConfig: z.object({
    topic: z.string().min(1, "MQTT topic is required"),
    clientId: z.string().min(1, "Client ID is required"),
  }),
  thresholds: thresholdTypesSchema,
})

// Equipment type configurations
export const equipmentTypeConfigSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  availableTypes: z.array(z.string()),
  requiredThresholds: z.array(z.string()),
  optionalThresholds: z.array(z.string()),
})

// Location validation
export const locationSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  description: z.string().optional(),
  address: z.string().min(5, "Address must be at least 5 characters"),
  city: z.string().min(2, "City must be at least 2 characters"),
  state: z.string().length(2, "State must be 2 characters"),
  zipCode: z.string().regex(/^\d{5}(-\d{4})?$/, "Invalid ZIP code format"),
  country: z.string().min(2, "Country must be at least 2 characters"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  timezone: z.string().min(1, "Timezone is required"),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
})

// Equipment validation
export const equipmentSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  type: z.string().min(1, "Equipment type is required"),
  locationId: z.string().min(1, "Location is required"),
  status: z.enum(["online", "offline", "error", "maintenance"]).default("offline"),
  mqttConfig: z
    .object({
      ip: z.string().default("localhost"),
      port: z.number().default(1883),
      username: z.string().optional(),
      password: z.string().optional(),
      topics: z
        .object({
          metrics: z.string().default("metrics"),
          status: z.string().default("status"),
          control: z.string().default("control"),
        })
        .default({
          metrics: "metrics",
          status: "status",
          control: "control",
        }),
    })
    .default({
      ip: "localhost",
      port: 1883,
      topics: {
        metrics: "metrics",
        status: "status",
        control: "control",
      },
    }),
  thresholds: z.record(z.string(), z.record(z.string(), thresholdValueSchema)).default({}),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

// User validation
export const userSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters"),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter")
    .regex(/[0-9]/, "Password must contain at least one number"),
  name: z.string().min(2, "Name must be at least 2 characters"),
  email: z.string().email("Invalid email address"),
  role: z.enum(["admin", "user", "viewer", "devops"]),
})

// System configuration validation
export const systemConfigSchema = z.object({
  refreshInterval: z.number().min(1000, "Refresh interval must be at least 1 second"),
  retryAttempts: z.number().min(1, "Must have at least 1 retry attempt"),
  timeout: z.number().min(1000, "Timeout must be at least 1 second"),
  logLevel: z.enum(["error", "warn", "info", "debug"]),
})

// Firebase configuration validation
export const firebaseConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  authDomain: z.string().min(1, "Auth domain is required"),
  projectId: z.string().min(1, "Project ID is required"),
  storageBucket: z.string().min(1, "Storage bucket is required"),
  messagingSenderId: z.string().min(1, "Messaging sender ID is required"),
  appId: z.string().min(1, "App ID is required"),
})

// Weather API configuration validation
export const weatherConfigSchema = z.object({
  apiKey: z.string().min(1, "API key is required"),
  location: z.object({
    city: z.string().min(2, "City must be at least 2 characters"),
    country: z.string().length(2, "Country code must be 2 characters"),
  }),
  units: z.enum(["metric", "imperial"]),
  updateInterval: z.number().min(300000, "Update interval must be at least 5 minutes"),
})

// Threshold type validation
export const thresholdTypeSchema = z.object({
  label: z.string().min(1, "Label is required"),
  min: z.number(),
  max: z.number(),
  unit: z.string().optional(),
})

// Equipment threshold configuration validation
export const equipmentThresholdConfigSchema = z.object({
  availableTypes: z.array(z.string().min(1, "Threshold type is required")),
})

// Validation helper functions
export function validateLocation(data: unknown) {
  try {
    const result = locationSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateEquipment(data: unknown) {
  try {
    const result = equipmentSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateUser(data: unknown) {
  try {
    const result = userSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateSystemConfig(data: unknown) {
  try {
    const result = systemConfigSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateFirebaseConfig(data: unknown) {
  try {
    const result = firebaseConfigSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateWeatherConfig(data: unknown) {
  try {
    const result = weatherConfigSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateEquipmentConfig(data: unknown) {
  try {
    const result = equipmentConfigSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateThresholds(data: unknown) {
  try {
    const result = thresholdTypesSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

// Equipment type configurations
export const EQUIPMENT_TYPES = {
  "Air Handler": {
    availableTypes: ["Supply Air", "Return Air", "Mixed Air", "Freeze Stat", "Fan", "Power", "Zone"],
    requiredThresholds: ["Supply Air", "Fan", "Power"],
  },
  Boiler: {
    availableTypes: ["Water Supply", "Water Return", "Power"],
    requiredThresholds: ["Water Supply", "Power"],
  },
  Chiller: {
    availableTypes: ["Water Supply", "Water Return", "Compressor", "Power"],
    requiredThresholds: ["Water Supply", "Compressor"],
  },
  "Cooling Tower": {
    availableTypes: ["Water Supply", "Water Return", "Fan", "Power"],
    requiredThresholds: ["Water Supply", "Fan"],
  },
  "Exhaust Fan": {
    availableTypes: ["Differential Pressure", "Fan", "Power"],
    requiredThresholds: ["Fan", "Power"],
  },
  "Fan Coil": {
    availableTypes: ["Supply Air", "Water Supply", "Fan", "Power", "Zone"],
    requiredThresholds: ["Supply Air", "Fan"],
  },
  Greenhouse: {
    availableTypes: ["Zone", "Supply Air", "Return Air"],
    requiredThresholds: ["Zone"],
  },
  "Heat Exchanger": {
    availableTypes: ["Water Supply", "Water Return", "Differential Pressure"],
    requiredThresholds: ["Water Supply", "Water Return"],
  },
  Pump: {
    availableTypes: ["Water Supply", "Differential Pressure", "Power"],
    requiredThresholds: ["Differential Pressure", "Power"],
  },
  "Steam Bundle": {
    availableTypes: ["Water Supply", "Water Return"],
    requiredThresholds: ["Water Supply"],
  },
  "Supply Fan": {
    availableTypes: ["Supply Air", "Differential Pressure", "Fan", "Power"],
    requiredThresholds: ["Supply Air", "Fan"],
  },
  "VAV Box": {
    availableTypes: ["Supply Air", "Zone", "Differential Pressure"],
    requiredThresholds: ["Supply Air", "Zone"],
  },
  "Water Heater": {
    availableTypes: ["Water Supply", "Water Return", "Power"],
    requiredThresholds: ["Water Supply"],
  },
  Actuator: {
    availableTypes: ["Differential Pressure", "Power"],
    requiredThresholds: ["Differential Pressure"],
  },
} as const

// Type exports
export type Location = z.infer<typeof locationSchema>
export type Equipment = z.infer<typeof equipmentSchema>
export type User = z.infer<typeof userSchema>
export type SystemConfig = z.infer<typeof systemConfigSchema>
export type FirebaseConfig = z.infer<typeof firebaseConfigSchema>
export type WeatherConfig = z.infer<typeof weatherConfigSchema>
export type ThresholdType = z.infer<typeof thresholdTypeSchema>
export type EquipmentThresholdConfig = z.infer<typeof equipmentThresholdConfigSchema>
export type ThresholdTypes = z.infer<typeof thresholdTypesSchema>
export type EquipmentConfig = z.infer<typeof equipmentConfigSchema>
export type EquipmentTypeConfig = z.infer<typeof equipmentTypeConfigSchema>
export type ThresholdValue = z.infer<typeof thresholdValueSchema>
export type Temperature = z.infer<typeof temperatureSchema>
export type Pressure = z.infer<typeof pressureSchema>
export type Humidity = z.infer<typeof humiditySchema>
export type Flow = z.infer<typeof flowSchema>
export type Power = z.infer<typeof powerSchema>
export type Position = z.infer<typeof positionSchema>
export type CO2 = z.infer<typeof co2Schema>

// Technician specialties and levels
export const TECHNICIAN_SPECIALTIES = {
  "HVAC Systems": ["Beginner", "Intermediate", "Advanced"],
  Electrical: ["Beginner", "Intermediate", "Advanced"],
  Plumbing: ["Beginner", "Intermediate", "Advanced"],
  Controls: ["Beginner", "Intermediate", "Advanced"],
} as const

// Task status enum
export const TASK_STATUS = ["Pending", "In Progress", "Completed", "Delayed", "Cancelled"] as const

// Technician validation
export const technicianSchema = z.object({
  id: z.string().optional(),
  name: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().regex(/^\+?[1-9]\d{1,14}$/, "Invalid phone number format"),
  email: z.string().email("Invalid email address"),
  specialties: z
    .array(
      z.object({
        type: z.enum(Object.keys(TECHNICIAN_SPECIALTIES) as [string, ...string[]]),
        level: z.string(),
      }),
    )
    .min(1, "At least one specialty must be selected"),
  assignedLocations: z.array(z.string()).min(1, "At least one location must be assigned"),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/, "Invalid color format")
    .optional(),
  notes: z.string().optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

// Task validation
export const taskSchema = z.object({
  id: z.string().optional(),
  title: z.string().min(3, "Title must be at least 3 characters"),
  description: z.string().min(10, "Description must be at least 10 characters"),
  locationId: z.string().min(1, "Location is required"),
  equipmentId: z.string().optional(),
  assignedTo: z.string().min(1, "Technician must be assigned"),
  status: z.enum(TASK_STATUS),
  priority: z.enum(["Low", "Medium", "High", "Critical"]),
  dueDate: z.date(),
  completedDate: z.date().optional(),
  notes: z
    .array(
      z.object({
        text: z.string(),
        createdBy: z.string(),
        createdAt: z.date(),
      }),
    )
    .optional(),
  createdAt: z.date().optional(),
  updatedAt: z.date().optional(),
})

// Helper functions for validation
export function validateTechnician(data: unknown) {
  try {
    const result = technicianSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

export function validateTask(data: unknown) {
  try {
    const result = taskSchema.parse(data)
    return { success: true, data: result }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, errors: error.errors }
    }
    return { success: false, errors: [{ message: "Unknown validation error" }] }
  }
}

// Type exports
export type Technician = z.infer<typeof technicianSchema>
export type Task = z.infer<typeof taskSchema>
export type TechnicianSpecialty = keyof typeof TECHNICIAN_SPECIALTIES
