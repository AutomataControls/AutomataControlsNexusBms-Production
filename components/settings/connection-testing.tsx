"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/hooks/use-toast"
import { Send, Power, MessageSquare } from "lucide-react"
import { io, Socket } from "socket.io-client"
import { Textarea } from "@/components/ui/textarea"

export function ConnectionTestingSettings() {
  const [brokerIp, setBrokerIp] = useState("143.198.162.31")
  const [port, setPort] = useState("1883")
  const [clientId, setClientId] = useState(`app-test-${Math.random().toString(16).substring(2, 8)}`)
  const [username, setUsername] = useState("AutomataControls")
  const [password, setPassword] = useState("")
  const [topic, setTopic] = useState("")
  const [publishTopic, setPublishTopic] = useState("")
  const [publishMessage, setPublishMessage] = useState("")
  
  const [isConnected, setIsConnected] = useState(false)
  const [connectionStatus, setConnectionStatus] = useState("Disconnected")
  const [showRealTimeMessages, setShowRealTimeMessages] = useState(true)
  const [messages, setMessages] = useState<{topic: string, message: string, timestamp: Date}[]>([])
  
  const socketRef = useRef<Socket | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const { toast } = useToast()

  // Auto-scroll to latest messages
  useEffect(() => {
    if (messagesEndRef.current && showRealTimeMessages) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, showRealTimeMessages])

  // Setup socket connection
  useEffect(() => {
    console.log("Setting up Socket.IO connection for MQTT testing...")
    
    // Connect to Socket.IO server - FORCE POLLING TRANSPORT
    const socket = io({
      path: '/socket.io',
      transports: ['polling'],  // Force polling transport only
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    })
    
    socketRef.current = socket
    
    socket.on('connect', () => {
      console.log("Socket.IO connected for MQTT testing. ID:", socket.id)
    })
    
    socket.on('connect_error', (error) => {
      console.error("Socket.IO connection error:", error)
      toast({
        title: "Connection Error",
        description: "Could not connect to the server. Please try again.",
        variant: "destructive",
      })
    })

    // Listen for MQTT messages from the bridge
    socket.on('mqtt_message', (data) => {
      console.log('MQTT message received:', data)
      if (showRealTimeMessages) {
        addMessage(data.topic, typeof data.payload === 'object' ? 
          JSON.stringify(data.payload, null, 2) : 
          String(data.payload))
      }
    })

    // Handle publish results
    socket.on('mqtt_publish_result', (result) => {
      if (result.success) {
        toast({
          title: "Message Published",
          description: "Your message was successfully published to the broker",
          variant: "default",
        })
      } else {
        toast({
          title: "Publish Failed",
          description: result.error || "Failed to publish message",
          variant: "destructive",
        })
      }
    })

    // Handle connect results
    socket.on('mqtt_connect_result', (result) => {
      if (result.success) {
        setIsConnected(true)
        setConnectionStatus("Connected")
        toast({
          title: "Connection Successful",
          description: `Connected to MQTT broker at ${brokerIp}:${port}`,
          variant: "default",
        })
        addMessage("system", `Connected to broker at ${brokerIp}:${port} with client ID ${clientId}`)
      } else {
        setIsConnected(false)
        setConnectionStatus("Connection Failed")
        toast({
          title: "Connection Failed",
          description: result.error || "Failed to connect to the MQTT broker",
          variant: "destructive",
        })
        addMessage("system", `Connection error: ${result.error || "Unknown error"}`)
      }
    })

    // Handle disconnect results
    socket.on('mqtt_disconnect_result', (result) => {
      setIsConnected(false)
      setConnectionStatus("Disconnected")
      toast({
        title: "Disconnected",
        description: "Disconnected from MQTT broker",
        variant: "default",
      })
      addMessage("system", "Disconnected from broker")
    })

    // Clean up on unmount
    return () => {
      console.log("Cleaning up Socket.IO connection for MQTT testing")
      socket.off('mqtt_message')
      socket.off('mqtt_publish_result')
      socket.off('mqtt_connect_result')
      socket.off('mqtt_disconnect_result')
      socket.disconnect()
    }
  }, [])

  const addMessage = (topic: string, message: string) => {
    console.log(`Adding message from topic ${topic}:`, message)
    setMessages(prev => [...prev, {
      topic,
      message,
      timestamp: new Date()
    }])
  }

  const clearMessages = () => {
    setMessages([])
  }

  const handleConnect = () => {
    if (!socketRef.current) {
      toast({
        title: "Connection Error",
        description: "Socket.IO not initialized. Please refresh the page.",
        variant: "destructive",
      })
      return
    }
    
    setConnectionStatus("Connecting...")
    
    console.log("Requesting MQTT connection with:", {
      host: brokerIp,
      port: parseInt(port),
      clientId,
      username,
      password,
      topic
    })
    
    // Request connection via Socket.IO bridge
    socketRef.current.emit('mqtt_connect', {
      host: brokerIp,
      port: parseInt(port),
      clientId,
      username,
      password,
      topic
    })
  }

  const handleDisconnect = () => {
    if (!socketRef.current) return
    
    // Request disconnection via Socket.IO bridge
    socketRef.current.emit('mqtt_disconnect')
  }

  const handlePublish = () => {
    if (!socketRef.current || !isConnected) {
      toast({
        title: "Not Connected",
        description: "Connect to a broker before publishing messages",
        variant: "destructive",
      })
      return
    }
    
    if (!publishTopic) {
      toast({
        title: "Empty Topic",
        description: "Please enter a topic to publish to",
        variant: "destructive",
      })
      return
    }
    
    try {
      // For JSON payloads, try to parse
      let messagePayload = publishMessage
      try {
        // If it's a JSON string, parse it to validate and then stringify again
        // This ensures valid JSON is sent
        if (publishMessage.trim().startsWith('{') || publishMessage.trim().startsWith('[')) {
          JSON.parse(publishMessage)
        }
      } catch (error) {
        toast({
          title: "Invalid JSON",
          description: "Your message doesn't appear to be valid JSON",
          variant: "destructive",
        })
        return
      }
      
      console.log("Publishing message to topic:", publishTopic, messagePayload)
      
      // Request publish via Socket.IO bridge
      socketRef.current.emit('mqtt_publish', {
        topic: publishTopic,
        message: messagePayload
      })
      
      addMessage("outgoing", `Published to ${publishTopic}: ${messagePayload}`)
    } catch (error) {
      toast({
        title: "Publish Error",
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive",
      })
    }
  }

  const toggleRealTimeView = (checked: boolean) => {
    setShowRealTimeMessages(checked)
    if (!checked) {
      // Do nothing when turning off
    } else if (isConnected) {
      // If we're connected and turning on real-time view
      addMessage("system", `Real-time view enabled for ${brokerIp}`)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium">MQTT Connection Testing</h3>
        <p className="text-sm text-muted-foreground">
          Test your connection to MQTT brokers and monitor message exchange.
        </p>
      </div>

      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="broker-ip">Broker IP Address</Label>
            <Input
              id="broker-ip"
              placeholder="e.g., mqtt.example.com or 192.168.1.100"
              value={brokerIp}
              onChange={(e) => setBrokerIp(e.target.value)}
              disabled={isConnected}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="port">Port</Label>
            <Input
              id="port"
              placeholder="1883"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              disabled={isConnected}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="client-id">Client ID</Label>
          <Input
            id="client-id"
            placeholder="Client ID (must be unique)"
            value={clientId}
            onChange={(e) => setClientId(e.target.value)}
            disabled={isConnected}
          />
          <p className="text-xs text-muted-foreground">Must be unique for each connection to the broker</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="username">Username</Label>
            <Input
              id="username"
              placeholder="MQTT Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={isConnected}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="MQTT Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isConnected}
            />
          </div>
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="topic">Topic Filter</Label>
          <Input
            id="topic"
            placeholder="e.g., equipment/+/metrics or # for all topics"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            disabled={isConnected}
          />
          <p className="text-xs text-muted-foreground">
            Use + for single-level wildcard, # for multi-level wildcard
          </p>
        </div>

        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <div className={`h-3 w-3 rounded-full ${
              isConnected ? 'bg-green-500' : 
              connectionStatus.includes('Connecting') ? 'bg-yellow-500' : 'bg-red-500'
            }`}></div>
            <span className="text-sm font-medium">{connectionStatus}</span>
          </div>
          
          {isConnected ? (
            <Button onClick={handleDisconnect} variant="destructive">
              <Power className="mr-2 h-4 w-4" /> Disconnect
            </Button>
          ) : (
            <Button onClick={handleConnect} className="w-32" disabled={!brokerIp || !clientId}>
              <Send className="mr-2 h-4 w-4" /> Connect
            </Button>
          )}
        </div>
        
        {isConnected && (
          <div className="space-y-4 pt-4 border-t">
            <h4 className="text-md font-medium">Publish Message</h4>
            <div className="space-y-2">
              <Label htmlFor="publish-topic">Publish Topic</Label>
              <Input
                id="publish-topic"
                placeholder="Topic to publish to"
                value={publishTopic}
                onChange={(e) => setPublishTopic(e.target.value)}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="publish-message">Message Payload (JSON)</Label>
              <Textarea
                id="publish-message"
                placeholder='{"key": "value"}'
                value={publishMessage}
                onChange={(e) => setPublishMessage(e.target.value)}
                className="min-h-24"
              />
            </div>
            
            <Button 
              onClick={handlePublish} 
              className="w-full"
              disabled={!publishTopic || !publishMessage}
            >
              <MessageSquare className="mr-2 h-4 w-4" /> Publish Message
            </Button>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Switch id="real-time-view" checked={showRealTimeMessages} onCheckedChange={toggleRealTimeView} />
            <Label htmlFor="real-time-view">Show Real-time Messages</Label>
          </div>
          <Button variant="outline" size="sm" onClick={clearMessages}>Clear Messages</Button>
        </div>

        {showRealTimeMessages && (
          <Card>
            <CardContent className="p-4">
              <h4 className="text-sm font-semibold mb-2">Message Log</h4>
              <div className="bg-muted p-2 rounded-md h-60 overflow-y-auto">
                {messages.length > 0 ? (
                  <div className="space-y-2">
                    {messages.map((msg, index) => (
                      <div key={index} className="text-xs font-mono border-l-2 pl-2 py-1 border-l-zinc-400">
                        <div className="flex justify-between text-muted-foreground mb-1">
                          <span>{msg.timestamp.toLocaleTimeString()}</span>
                          <span className="font-semibold">{msg.topic}</span>
                        </div>
                        <div className="bg-background rounded p-1 whitespace-pre-wrap break-all">
                          {msg.message}
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef}></div>
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No messages received yet.</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
