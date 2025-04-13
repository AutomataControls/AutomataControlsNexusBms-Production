import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import { config } from 'dotenv';
import cors from 'cors';
import mqtt from 'mqtt';
import { initializeFirebase } from './firebase';

config();
const app = express();
const server = http.createServer(app);

// Add CORS headers to allow requests from neuralbms.automatacontrols.com
// Add CORS headers to allow requests from multiple domains
app.use(cors({
    origin: ['https://neuralbms.automatacontrols.com', 'http://143.198.162.31:3000'],
    methods: ['GET', 'POST'],
    credentials: true
}));

// Manually add Access-Control-Allow-Origin headers
app.use((req, res, next) => {
    const allowedOrigins = ['https://neuralbms.automatacontrols.com', 'http://143.198.162.31:3000'];
    const origin = req.headers.origin;
    if (origin && allowedOrigins.includes(origin)) {
        res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    next();
});

// Update Socket.IO CORS configuration
const io = new Server(server, {
    path: '/socket.io',
    cors: {
        origin: ['https://neuralbms.automatacontrols.com', 'http://143.198.162.31:3000'],
        methods: ['GET', 'POST'],
        credentials: true
    }
});

// Initialize Firebase
const { db } = initializeFirebase();

// Keep track of MQTT client connections by socket ID
const mqttClients = new Map();

// Initialize global shared MQTT client for system-wide communications
const initializeSharedMqttClient = () => {
    try {
        const username = process.env.MQTT_USERNAME || 'AutomataControls';
        const password = process.env.MQTT_PASSWORD || '';
        
        if (!username) {
            console.error('MQTT_USERNAME environment variable is not set');
            return null;
        }
        
        const client = mqtt.connect({
            host: process.env.MQTT_HOST || 'localhost',
            port: parseInt(process.env.MQTT_PORT || '1883'),
            username,
            password,
            clientId: `bridge-server-${Date.now()}`,
            clean: true,
            reconnectPeriod: 5000
        });
        
        client.on('connect', () => {
            console.log('Shared MQTT client connected');
            
            // Subscribe to system topics
            const systemTopics = [
                'equipment/+/metrics',
                'equipment/+/status',
                'equipment/+/alarms',
                'locations/+/status',
                'locations/+/equipment/+/metrics'
            ];
            
            systemTopics.forEach(topic => {
                client.subscribe(topic, (err) => {
                    if (err) {
                        console.error(`Error subscribing to ${topic}:`, err);
                    } else {
                        console.log(`Subscribed to ${topic}`);
                    }
                });
            });
        });
        
        client.on('message', (topic, message) => {
            try {
                // Try to parse as JSON
                let payload;
                try {
                    payload = JSON.parse(message.toString());
                } catch (e) {
                    // If not valid JSON, use as string
                    payload = message.toString();
                }
                
                // Broadcast to all connected Socket.IO clients
                io.emit('mqtt_message', { topic, payload });
            } catch (error) {
                console.error('Error handling MQTT message:', error);
            }
        });
        
        client.on('error', (error) => {
            console.error('Shared MQTT client error:', error);
        });
        
        client.on('close', () => {
            console.log('Shared MQTT client disconnected');
        });
        
        return client;
    } catch (error) {
        console.error('Error initializing shared MQTT client:', error);
        return null;
    }
};

// Initialize shared MQTT client
const sharedMqttClient = initializeSharedMqttClient();

io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    
    // Handle MQTT connection requests for individual connections
    socket.on('mqtt_connect', (config) => {
        try {
            // Disconnect any existing client for this socket
            if (mqttClients.has(socket.id)) {
                const existingClient = mqttClients.get(socket.id);
                existingClient.end(true);
                mqttClients.delete(socket.id);
            }

            console.log(`Connecting to MQTT broker at ${config.host}:${config.port} with client ID ${config.clientId}`);
            
            // Create MQTT client
            const client = mqtt.connect({
                host: config.host,
                port: config.port,
                clientId: config.clientId,
                username: config.username,
                password: config.password,
                clean: true,
                reconnectPeriod: 5000
            });

            // Handle MQTT connection events
            client.on('connect', () => {
                console.log(`MQTT client ${config.clientId} connected successfully`);
                mqttClients.set(socket.id, client);
                
                // Subscribe to topic if provided
                if (config.topic) {
                    client.subscribe(config.topic, (err) => {
                        if (err) {
                            console.error(`Error subscribing to ${config.topic}:`, err);
                        } else {
                            console.log(`Subscribed to ${config.topic}`);
                        }
                    });
                }
                
                socket.emit('mqtt_connect_result', { success: true });
            });

            client.on('message', (topic, message) => {
                try {
                    // Try to parse as JSON
                    let payload;
                    try {
                        payload = JSON.parse(message.toString());
                    } catch (e) {
                        // If not valid JSON, use as string
                        payload = message.toString();
                    }
                    
                    // Forward to the Socket.IO client
                    socket.emit('mqtt_message', { topic, payload });
                } catch (error) {
                    console.error('Error handling MQTT message:', error);
                }
            });

            client.on('error', (error) => {
                console.error('MQTT client error:', error);
                socket.emit('mqtt_connect_result', { 
                    success: false, 
                    error: error.message || 'MQTT connection error' 
                });
            });
            
        } catch (error) {
            console.error('Error connecting to MQTT broker:', error);
            socket.emit('mqtt_connect_result', { 
                success: false, 
                error: error.message || 'MQTT connection error' 
            });
        }
    });

    // Handle MQTT publish requests
    socket.on('mqtt_publish', (data) => {
        // First try user's individual client
        const client = mqttClients.get(socket.id);
        
        // If no individual client, fall back to shared client
        const activeClient = client?.connected ? client : sharedMqttClient;
        
        if (!activeClient || !activeClient.connected) {
            socket.emit('mqtt_publish_result', { 
                success: false, 
                error: 'Not connected to MQTT broker' 
            });
            return;
        }

        try {
            // Parse message if it's a string that should be JSON
            let message = data.message;
            if (typeof message === 'string' && 
                (message.trim().startsWith('{') || message.trim().startsWith('['))) {
                try {
                    message = JSON.parse(message);
                } catch (e) {
                    // If invalid JSON, use as string
                    console.warn('Invalid JSON in message, using as string');
                }
            }
            
            activeClient.publish(data.topic, typeof message === 'string' ? message : JSON.stringify(message), (error) => {
                if (error) {
                    console.error('Error publishing message:', error);
                    socket.emit('mqtt_publish_result', { 
                        success: false, 
                        error: error.message || 'Failed to publish message' 
                    });
                } else {
                    console.log(`Published message to ${data.topic}`);
                    socket.emit('mqtt_publish_result', { success: true });
                }
            });
        } catch (error) {
            console.error('Error publishing message:', error);
            socket.emit('mqtt_publish_result', { 
                success: false, 
                error: error.message || 'Failed to publish message' 
            });
        }
    });

    // Handle MQTT disconnect requests
    socket.on('mqtt_disconnect', () => {
        const client = mqttClients.get(socket.id);
        if (client) {
            client.end(true);
            mqttClients.delete(socket.id);
            socket.emit('mqtt_disconnect_result', { success: true });
            console.log(`MQTT client for socket ${socket.id} disconnected`);
        } else {
            socket.emit('mqtt_disconnect_result', { 
                success: false, 
                error: 'No active MQTT connection' 
            });
        }
    });

    // Original bridgeMessage handler
    socket.on('bridgeMessage', (data) => {
        console.log('Received from client:', data);
        io.emit('bridgeMessage', data);
    });

    // Clean up MQTT client on disconnect
    socket.on('disconnect', () => {
        const client = mqttClients.get(socket.id);
        if (client) {
            client.end(true);
            mqttClients.delete(socket.id);
            console.log(`Cleaned up MQTT client for socket ${socket.id}`);
        }
        console.log('Client disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3099;
server.listen(PORT, () => {
    console.log(`Bridge server listening on port ${PORT}`);
});
