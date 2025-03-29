import { Server } from "socket.io"
import mqtt, { 
  MqttClient, 
  IClientOptions,
  IClientSubscribeOptions,
  ClientSubscribeCallback,
  PacketCallback,
  IClientPublishOptions,
  ErrorWithReasonCode
} from "mqtt"
import {
  validateMQTTConfig,
  validateMQTTMessage,
  validateEquipmentControl,
  validateEquipmentMetrics,
  validateEquipmentStatus,
  type MQTTConfig,
  type MQTTMessage,
} from "./lib/validation"
import { type Firestore, type DocumentSnapshot } from 'firebase-admin/firestore'

interface TopicConfig {
  metrics: string
  status: string
  alarms: string
  locations: string
  locationEquipment: string
}

const DEFAULT_TOPICS: TopicConfig = {
  metrics: "equipment/+/metrics",
  status: "equipment/+/status",
  alarms: "equipment/+/alarms",
  locations: "locations/+/status",
  locationEquipment: "locations/+/equipment/+/metrics",
}

export class MQTTClient {
  private client!: MqttClient
  private io: Server
  private config: MQTTConfig
  private db: Firestore
  private currentTopics: TopicConfig = DEFAULT_TOPICS
  private isConnected: boolean = false

  constructor(io: Server, config: MQTTConfig, db: Firestore) {
    this.io = io
    this.config = config
    this.db = db
    this.initializeTopics()
    this.connect()
  }

  private initializeTopics() {
    try {
      const topicsRef = this.db.collection('config').doc('mqtt_topics')
      
      // Listen for topic configuration changes
      topicsRef.onSnapshot((doc: DocumentSnapshot) => {
        if (doc.exists) {
          const data = doc.data()
          if (data) {
            this.currentTopics = {
              metrics: data.metrics || DEFAULT_TOPICS.metrics,
              status: data.status || DEFAULT_TOPICS.status,
              alarms: data.alarms || DEFAULT_TOPICS.alarms,
              locations: data.locations || DEFAULT_TOPICS.locations,
              locationEquipment: data.locationEquipment || DEFAULT_TOPICS.locationEquipment,
            }
            console.log("Updated MQTT topics configuration:", this.currentTopics)
            
            // Resubscribe to topics if connected
            if (this.isConnected) {
              this.subscribeToTopics()
            }
          }
        }
      }, (error) => {
        console.error("Error listening to topics configuration:", error)
      })
    } catch (error) {
      console.error("Error initializing topics:", error)
      // Continue with default topics
      this.currentTopics = DEFAULT_TOPICS
    }
  }

  private connect() {
    try {
      // Validate MQTT configuration
      const validationResult = validateMQTTConfig(this.config)
      if (!validationResult.success) {
        throw new Error(`Invalid MQTT configuration: ${validationResult.errors?.[0]?.message}`)
      }

      // Create MQTT client
      this.client = mqtt.connect({
        host: this.config.host,
        port: this.config.port,
        username: this.config.username,
        password: this.config.password,
        clientId: this.config.clientId,
      })

      // Set up event handlers
      this.client.on('connect', () => {
        console.log('Connected to MQTT broker')
        this.isConnected = true
        this.subscribeToTopics()
      })

      this.client.on('error', (error) => {
        console.error('MQTT client error:', error)
        this.isConnected = false
      })

      this.client.on('close', () => {
        console.log('MQTT client disconnected')
        this.isConnected = false
      })

      this.client.on('message', (topic: string, message: Buffer) => {
        try {
          const payload = JSON.parse(message.toString())
          // Emit to all connected Socket.IO clients
          this.io.emit('mqtt_message', { topic, payload })
        } catch (error) {
          console.error('Error parsing MQTT message:', error)
        }
      })
    } catch (error) {
      console.error('Error connecting to MQTT broker:', error)
      throw error
    }
  }

  private subscribeToTopics() {
    Object.values(this.currentTopics).forEach(topic => {
      this.client.subscribe(topic, (error) => {
        if (error) {
          console.error(`Error subscribing to ${topic}:`, error)
        } else {
          console.log(`Subscribed to ${topic}`)
        }
      })
    })
  }

  public publish(topic: string, message: any): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.client) {
        reject(new Error("MQTT client not connected"))
        return
      }

      const mqttMessage: MQTTMessage = {
        topic,
        payload: message,
        qos: 1,
        retain: false
      }

      const validationResult = validateMQTTMessage(mqttMessage)
      if (!validationResult.success) {
        reject(new Error(`Invalid MQTT message: ${validationResult.errors?.[0]?.message}`))
        return
      }

      this.client.publish(topic, JSON.stringify(message), { qos: 1 }, (error?: Error) => {
        if (error) {
          console.error(`Error publishing to topic ${topic}:`, error)
          reject(error)
        } else {
          console.log(`Published to ${topic}:`, message)
          resolve()
        }
      })
    })
  }

  public disconnect(): void {
    if (this.client) {
      this.client.end(false, {}, ((error?: Error) => {
        if (error) {
          console.error("Error disconnecting from MQTT broker:", error)
        } else {
          console.log("Disconnected from MQTT broker")
        }
      }))
      this.client.removeAllListeners()
    }
  }
}

export function initializeMqttClient(io: Server, db: Firestore): MQTTClient {
  const username = process.env.MQTT_USERNAME
  const password = process.env.MQTT_PASSWORD

  if (!username || !password) {
    throw new Error('MQTT_USERNAME and MQTT_PASSWORD environment variables are required')
  }

  return new MQTTClient(io, {
    host: process.env.MQTT_HOST || 'localhost',
    port: parseInt(process.env.MQTT_PORT || '1883'),
    username: username,
    password: password,
    clientId: `bridge-server-${Date.now()}`,
    topics: [
      'equipment/+/metrics',
      'equipment/+/status',
      'equipment/+/alarms',
      'locations/+/status',
      'locations/+/equipment/+/metrics'
    ]
  }, db)
} 