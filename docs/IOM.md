## Automata Controls App - Installation, Operation, and Maintenance Manual

# Automata Controls App

## Installation, Operation, and Maintenance Manual

### Table of Contents

1. [Introduction](#introduction)
2. [Installation](#installation)
3. [Getting Started](#getting-started)
4. [Dashboard Overview](#dashboard-overview)
5. [Equipment Controls](#equipment-controls)
6. [Analytics](#analytics)
7. [Alarms](#alarms)
8. [Settings](#settings)
9. [User Management](#user-management)
10. [Maintenance](#maintenance)
11. [Troubleshooting](#troubleshooting)
12. [Glossary](#glossary)


## Introduction

### Welcome to Automata Controls

The Automata Controls App is a comprehensive building automation system designed to help you monitor and control various equipment in your facilities. This user-friendly application provides real-time monitoring, control capabilities, data analytics, and alarm management for your building systems.

### Key Features

- **Real-time Monitoring**: View the current status of all your equipment at a glance
- **Equipment Control**: Adjust settings for HVAC, lighting, and other building systems
- **Multi-location Support**: Manage multiple facilities from a single interface
- **Data Analytics**: Track performance metrics and identify trends
- **Alarm Management**: Receive notifications when equipment requires attention
- **User-friendly Interface**: Intuitive design requires minimal training


### Who Should Use This Manual

This manual is designed for:

- Facility managers
- Building operators
- Maintenance personnel
- Property managers
- Anyone responsible for building systems


No technical background is required to use the Automata Controls App effectively.

## Installation

### System Requirements

- **Web Browser**: Google Chrome, Mozilla Firefox, Safari, or Microsoft Edge (latest versions recommended)
- **Internet Connection**: Broadband connection (minimum 5 Mbps)
- **Screen Resolution**: 1280×720 or higher (1920×1080 recommended)
- **Devices**: Desktop, laptop, tablet, or smartphone


### Installation Steps

#### For IT Personnel:

1. **Download the Application**:

1. Download the application files from the provided link
2. Extract the files to a directory on your server or local machine



2. **Install Node.js**:

1. Download and install Node.js from [nodejs.org](https://nodejs.org/)
2. Verify installation by opening a command prompt or terminal and typing:

```plaintext
node -v
```


3. You should see the version number displayed



3. **Install Dependencies**:

1. Open a command prompt or terminal
2. Navigate to the application directory
3. Run the following command:

```plaintext
npm install
```


4. Wait for all dependencies to install



4. **Configure Firebase**:

1. Create a Firebase account if you don't have one
2. Create a new Firebase project
3. Enable Firestore Database
4. Get your Firebase configuration (API key, auth domain, etc.)
5. You'll enter these in the app's settings page after starting



5. **Start the Application**:

1. Run the following command:

```plaintext
npm run dev
```


2. The application will start and be available at [http://localhost:3000](http://localhost:3000)





#### For End Users:

If your IT department has already set up the application, you can simply:

1. Open your web browser
2. Navigate to the URL provided by your IT department
3. Log in with your provided credentials


## Getting Started

### Logging In

1. Open the Automata Controls App in your web browser
2. You'll see the login screen
3. Enter your username and password
4. Click the "Login" button
5. If this is your first time logging in, you may be prompted to change your password


### First-Time Setup

After logging in for the first time, you'll need to:

1. **Configure Firebase** (if not already done):

1. Go to Settings > Firebase Configuration
2. Enter the Firebase credentials provided by your IT department
3. Click "Test Connection" to verify
4. Click "Save Configuration"



2. **Set Up Your User Profile**:

1. Go to Settings > User Settings
2. Enter your name and contact information
3. Set your notification preferences
4. Click "Save"



3. **Add Locations** (for administrators):

1. Go to Settings > Location Settings
2. Click "Add Location"
3. Enter the location details (name, address, etc.)
4. Click "Save Location"



4. **Add Equipment** (for administrators):

1. After adding a location, go to the Controls section
2. Click "Add Equipment"
3. Select the equipment type
4. Enter the equipment details
5. Click "Save Equipment"





### Navigation Basics

- **Sidebar**: Use the sidebar on the left to navigate between different sections
- **Location Selector**: Use the dropdown at the top of the sidebar to switch between locations
- **Equipment Menu**: Expand the Equipment section in the sidebar to access specific equipment
- **Settings**: Access application settings through the gear icon in the sidebar


## Dashboard Overview

### Dashboard Elements

The Dashboard provides a quick overview of your building systems:

1. **Location Summary**:

1. Shows all your locations
2. Displays key metrics for each location
3. Indicates any active alarms



2. **Equipment Status**:

1. Shows the status of key equipment
2. Green indicates normal operation
3. Yellow indicates warnings
4. Red indicates critical issues



3. **Weather Display**:

1. Shows current weather conditions for the selected location
2. Displays forecast information



4. **Quick Actions**:

1. Provides shortcuts to common tasks
2. Allows quick adjustment of frequently used settings





### Customizing Your Dashboard

You can customize what appears on your Dashboard:

1. Go to Settings > User Settings
2. Scroll to "Dashboard Preferences"
3. Select which items you want to display
4. Arrange items by dragging and dropping
5. Click "Save Preferences"


## Equipment Controls

### Accessing Equipment Controls

1. Click "Controls" in the sidebar
2. Select a location from the dropdown (if not already selected)
3. In the sidebar, expand the Equipment section
4. Select the equipment type (Air Handlers, Chillers, etc.)
5. Click on the specific piece of equipment you want to control


### Understanding the Control Panel

The Control Panel is divided into sections:

1. **Status Information**:

1. Equipment name and type
2. Current operational status
3. Key performance metrics



2. **Basic Controls**:

1. On/Off switches
2. Mode selection (Auto, Cool, Heat, etc.)
3. Primary setpoints



3. **Advanced Controls**:

1. Detailed settings
2. Component-specific controls
3. Schedule settings





### Adjusting Equipment Settings

To change equipment settings:

1. Locate the setting you want to change
2. For switches, simply click to toggle on/off
3. For sliders, drag to the desired position
4. For dropdown menus, click and select the desired option
5. For numeric values, either:

1. Use the up/down arrows
2. Click and type the desired value



6. Click "Apply Changes" to send your adjustments to the equipment


### Schedules

You can set schedules for equipment operation:

1. In the Control Panel, find the Schedule section
2. Click "Edit Schedule"
3. Select the days of the week
4. Set the time periods and desired settings
5. Click "Save Schedule"


### Saving Presets

For frequently used configurations:

1. Adjust all settings as desired
2. Click "Save as Preset"
3. Enter a name for the preset
4. Click "Save"
5. To use a preset later, click "Load Preset" and select from the list


## Analytics

### Accessing Analytics

1. Click "Analytics" in the sidebar
2. Select a location from the dropdown
3. Select the equipment you want to analyze


### Available Analytics

The Analytics section provides various data visualizations:

1. **Performance Trends**:

1. Temperature trends
2. Energy usage
3. Runtime hours
4. Efficiency metrics



2. **Comparison Reports**:

1. Compare current performance to historical data
2. Compare performance across similar equipment
3. Compare performance to industry benchmarks



3. **Energy Analysis**:

1. Energy consumption patterns
2. Peak usage times
3. Cost analysis





### Using the Analytics Tools

To get the most from the Analytics section:

1. **Select Time Range**:

1. Use the time range selector (24h, 7d, 30d, 1y)
2. Or set a custom date range



2. **Choose Data Points**:

1. Select which metrics to display
2. Add multiple metrics to compare relationships



3. **Change Chart Type**:

1. Line charts for trends over time
2. Bar charts for comparisons
3. Pie charts for distribution analysis



4. **Export Data**:

1. Click "Export" to download data as CSV
2. Click "Print Report" to generate a printable report





## Alarms

### Understanding Alarms

Alarms alert you to conditions that require attention:

- **Info** (Blue): Informational messages that don't require immediate action
- **Warning** (Yellow): Conditions that may require attention soon
- **Critical** (Red): Urgent issues that require immediate attention


### Viewing Alarms

1. Click "Alarms" in the sidebar
2. The Alarms page shows:

1. Active alarms
2. Alarm history
3. Alarm statistics





### Managing Alarms

When an alarm occurs:

1. **Review**: Click on the alarm to see details
2. **Acknowledge**: Click "Acknowledge" to indicate you're aware of the alarm
3. **Investigate**: Check the equipment that triggered the alarm
4. **Resolve**: Address the underlying issue
5. **Clear**: Once resolved, click "Clear Alarm" to remove it from the active list


### Alarm Configuration

To configure alarm settings:

1. Go to Settings > Alarm Settings
2. Select the equipment type
3. For each parameter:

1. Set the high and low thresholds
2. Set the severity level
3. Enable or disable notifications



4. Click "Save Configuration"


### Alarm Notifications

You can receive alarm notifications via:

1. **In-App**: Notifications appear in the application
2. **Email**: Sent to your registered email address
3. **SMS**: Sent to your registered phone number (if configured)


To configure notifications:

1. Go to Settings > Notification Settings
2. Select which alarms you want to be notified about
3. Choose your preferred notification methods
4. Set quiet hours if desired
5. Click "Save Preferences"


## Settings

### Accessing Settings

Click "Settings" in the sidebar to access the Settings page.

### Available Settings

#### User Settings

- Profile information
- Password change
- Notification preferences
- Dashboard customization
- Theme selection


#### Location Settings

- Add, edit, or remove locations
- Set location details (address, timezone, etc.)
- Configure location-specific settings


#### Notification Settings

- Configure email notifications
- Set up SMS alerts (if available)
- Set notification preferences by alarm type
- Configure quiet hours


#### Firebase Settings

- Configure Firebase connection
- Test database connectivity
- Manage data synchronization settings


#### Weather Settings

- Configure weather display
- Set location for weather data
- Choose temperature units (°F or °C)


#### Control Settings

- Configure control server connection
- Set control authentication requirements
- Configure control timeout settings


#### Session Settings

- Set session timeout duration
- Configure automatic logout
- Manage active sessions


### Saving Settings

After making changes to any settings:

1. Review your changes
2. Click "Save" or "Save Configuration"
3. Some settings may require you to refresh the page or log out and back in


## User Management

### User Roles

The Automata Controls App supports different user roles:

- **Administrator**: Full access to all features and settings
- **Technician**: Can view and control equipment, but cannot change system settings
- **Operator**: Can view equipment status and make basic adjustments
- **Viewer**: Can only view information, cannot make changes


### Managing Users (Administrators Only)

To manage users:

1. Go to Settings > User Management
2. View the list of current users
3. To add a user:

1. Click "Add User"
2. Enter user details (name, email, etc.)
3. Assign a role
4. Click "Create User"



4. To edit a user:

1. Click on the user's name
2. Make changes as needed
3. Click "Save Changes"



5. To deactivate a user:

1. Click on the user's name
2. Click "Deactivate User"
3. Confirm the action





### Changing Your Password

To change your password:

1. Go to Settings > User Settings
2. Click "Change Password"
3. Enter your current password
4. Enter and confirm your new password
5. Click "Update Password"


## Maintenance

### Regular Maintenance Tasks

To keep the Automata Controls App running smoothly:

#### Daily Tasks

- Check for active alarms
- Review equipment status
- Verify that all connections are working


#### Weekly Tasks

- Review performance trends
- Check for equipment that may need attention
- Verify that schedules are working correctly


#### Monthly Tasks

- Review user accounts and remove any that are no longer needed
- Back up configuration settings
- Check for any software updates


### Backing Up Configuration

To back up your configuration:

1. Go to Settings > Session Settings
2. Click "Export Configuration"
3. Choose what to include in the backup
4. Click "Download"
5. Store the backup file in a secure location


### Restoring Configuration

To restore from a backup:

1. Go to Settings > Session Settings
2. Click "Import Configuration"
3. Click "Choose File" and select your backup file
4. Click "Upload and Restore"
5. Confirm the action


## Troubleshooting

### Common Issues and Solutions

#### Cannot Log In

- Verify your username and password
- Check if Caps Lock is on
- Try resetting your password
- Contact your administrator if problems persist


#### Equipment Not Responding

- Check the connection status indicator
- Verify that the equipment is powered on
- Check network connections
- Try refreshing the page
- Contact your administrator if problems persist


#### Data Not Updating

- Check your internet connection
- Refresh the page
- Verify Firebase configuration in Settings
- Log out and log back in
- Contact your administrator if problems persist


#### Charts Not Displaying

- Try changing the time range
- Switch to a different data type
- Clear your browser cache
- Try a different browser
- Contact your administrator if problems persist


### Getting Help

If you encounter issues not covered in this manual:

- Click the "Help" button in the footer
- Check the FAQ section
- Contact your system administrator
- Email support at [support@automatacontrols.com](mailto:support@automatacontrols.com)


## Glossary

**Air Handler**: Equipment that regulates and circulates air as part of a heating, ventilating, and air-conditioning system.

**Alarm**: A notification that alerts users to conditions that require attention.

**Analytics**: Tools for analyzing data to identify patterns, trends, and insights.

**BACnet**: A communications protocol for Building Automation and Control networks.

**Boiler**: A closed vessel in which water or other fluid is heated.

**Chiller**: A machine that removes heat from a liquid via a vapor-compression or absorption refrigeration cycle.

**Dashboard**: A visual display of the most important information needed to achieve objectives, consolidated on a single screen.

**DOAS**: Dedicated Outdoor Air System, a type of HVAC system that brings in fresh outdoor air.

**Equipment**: The mechanical systems in a building, such as HVAC, lighting, and security systems.

**Fan Coil**: A simple device consisting of a heating or cooling coil and fan.

**Firebase**: A platform developed by Google for creating mobile and web applications.

**HVAC**: Heating, Ventilation, and Air Conditioning.

**Location**: A physical site or building managed by the Automata Controls App.

**Modbus**: A serial communications protocol widely used in industrial control systems.

**MQTT**: Message Queuing Telemetry Transport, a lightweight messaging protocol for small sensors and mobile devices.

**Preset**: A saved configuration of equipment settings that can be quickly applied.

**Schedule**: A timetable for when equipment should operate and at what settings.

**Setpoint**: A desired value for a controlled variable, such as temperature.

**Socket.IO**: A JavaScript library for real-time web applications.

**User Role**: A set of permissions that determine what actions a user can perform in the application.

---

## Automata Controls App - Technical Documentation

# Automata Controls App

## Technical Documentation

### Table of Contents

1. [System Architecture](#system-architecture)
2. [Data Models](#data-models)
3. [Firebase Integration](#firebase-integration)
4. [Socket.IO Communication](#socketio-communication)
5. [Message Payload Formats](#message-payload-formats)
6. [Authentication System](#authentication-system)
7. [Alarm System](#alarm-system)
8. [Analytics System](#analytics-system)
9. [Control System](#control-system)
10. [Integration Examples](#integration-examples)
11. [API Reference](#api-reference)
12. [Troubleshooting](#troubleshooting)


## System Architecture

### Overview

The Automata Controls App is built on a modern web architecture using Next.js for the frontend and Firebase for data storage. Real-time communication with equipment is handled through Socket.IO, which can be integrated with various building automation protocols.

### Key Components

1. **Frontend**: Next.js React application

1. Server-side rendering for improved performance
2. Client-side components for interactive elements
3. Responsive design for all device sizes



2. **Database**: Firebase Firestore

1. NoSQL document database
2. Real-time data synchronization
3. Secure authentication and access control



3. **Real-time Communication**: Socket.IO

1. Bidirectional event-based communication
2. Automatic reconnection handling
3. Support for various transport methods



4. **Authentication**: Custom authentication system

1. Role-based access control
2. Session management
3. Secure password handling



5. **Analytics**: Recharts library

1. Interactive data visualization
2. Support for various chart types
3. Responsive design





### Component Diagram

```plaintext
┌─────────────────────────────────────────────────────────────┐
│                      Client Browser                         │
│                                                             │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐     │
│  │   React UI  │    │  Socket.IO  │    │   Firebase  │     │
│  │  Components │    │    Client   │    │    Client   │     │
│  └─────────────┘    └─────────────┘    └─────────────┘     │
└─────────────────────────────────────────────────────────────┘
           ▲                  ▲                  ▲
           │                  │                  │
           ▼                  ▼                  ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│    Next.js      │  │    Socket.IO    │  │     Firebase    │
│     Server      │  │      Server     │  │     Firestore   │
└─────────────────┘  └─────────────────┘  └─────────────────┘
                              ▲
                              │
                              ▼
                     ┌─────────────────┐
                     │  Building       │
                     │  Automation     │
                     │  Systems        │
                     │  (BACnet/Modbus/│
                     │   MQTT/etc.)    │
                     └─────────────────┘
```

### Data Flow

1. User interacts with the React UI
2. UI components update state and trigger actions
3. Actions may:

1. Update Firebase data
2. Send control commands via Socket.IO
3. Request data from the server



4. Socket.IO server relays commands to building automation systems
5. Building systems send status updates back through Socket.IO
6. Firebase updates trigger UI refreshes through real-time listeners


## Data Models

### Locations

Locations represent physical sites or buildings.

```typescript
interface Location {
  id: string;                  // Unique identifier
  name: string;                // Display name
  address?: string;            // Street address
  city?: string;               // City
  state?: string;              // State/province
  zipCode?: string;            // Postal code
  country?: string;            // Country
  timezone?: string;           // IANA timezone (e.g., "America/New_York")
  weatherApiKey?: string;      // API key for weather data
  weatherLocation?: string;    // Location ID for weather API
  displayItems?: string[];     // Equipment IDs to display on dashboard
  createdAt: Date;             // Creation timestamp
  updatedAt: Date;             // Last update timestamp
}
```

### Equipment

Equipment represents physical devices or systems.

```typescript
interface Equipment {
  id: string;                  // Unique identifier
  name: string;                // Display name
  type: string;                // Equipment type (e.g., "air handler", "chiller")
  model?: string;              // Model number
  manufacturer?: string;       // Manufacturer name
  serialNumber?: string;       // Serial number
  locationId: string;          // Reference to parent location
  parentId?: string;           // Reference to parent equipment (if applicable)
  status?: string;             // Current status (e.g., "online", "offline", "fault")
  controls?: Record<string, any>; // Current control values
  readings?: Record<string, any>; // Current sensor readings
  alarmConfig?: Record<string, AlarmConfig>; // Alarm configuration
  schedules?: Schedule[];      // Operating schedules
  createdAt: Date;             // Creation timestamp
  updatedAt: Date;             // Last update timestamp
}
```

### Alarms

Alarms represent conditions that require attention.

```typescript
interface Alarm {
  id: string;                  // Unique identifier
  name: string;                // Display name
  equipmentId: string;         // Reference to equipment
  locationId: string;          // Reference to location
  severity: "info" | "warning" | "critical"; // Alarm severity
  message: string;             // Descriptive message
  active: boolean;             // Whether alarm is currently active
  acknowledged: boolean;       // Whether alarm has been acknowledged
  resolved: boolean;           // Whether alarm has been resolved
  timestamp: Date;             // When alarm was triggered
  acknowledgedTimestamp?: Date; // When alarm was acknowledged
  resolvedTimestamp?: Date;    // When alarm was resolved
  acknowledgedBy?: string;     // User who acknowledged the alarm
  resolvedBy?: string;         // User who resolved the alarm
}
```

### Alarm Configuration

Configuration for when alarms should be triggered.

```typescript
interface AlarmConfig {
  label: string;               // Display name
  enabled: boolean;            // Whether alarm is enabled
  highThreshold?: number;      // Upper limit that triggers alarm
  lowThreshold?: number;       // Lower limit that triggers alarm
  severity: "info" | "warning" | "critical"; // Alarm severity
  notify: boolean;             // Whether to send notifications
  notifyUsers?: string[];      // User IDs to notify
}
```

### Users

User accounts for accessing the application.

```typescript
interface User {
  id: string;                  // Unique identifier
  username: string;            // Login username
  passwordHash: string;        // Hashed password (stored securely)
  name?: string;               // Display name
  email?: string;              // Email address
  phone?: string;              // Phone number
  role: "admin" | "technician" | "operator" | "viewer"; // User role
  preferences?: Record<string, any>; // User preferences
  lastLogin?: Date;            // Last login timestamp
  createdAt: Date;             // Creation timestamp
  updatedAt: Date;             // Last update timestamp
}
```

### Schedules

Operating schedules for equipment.

```typescript
interface Schedule {
  id: string;                  // Unique identifier
  name: string;                // Display name
  equipmentId: string;         // Reference to equipment
  active: boolean;             // Whether schedule is active
  days: number[];              // Days of week (0-6, where 0 is Sunday)
  periods: SchedulePeriod[];   // Time periods
  createdAt: Date;             // Creation timestamp
  updatedAt: Date;             // Last update timestamp
}

interface SchedulePeriod {
  id: string;                  // Unique identifier
  startTime: string;           // Start time (HH:MM format)
  endTime: string;             // End time (HH:MM format)
  settings: Record<string, any>; // Settings to apply during this period
}
```

## Firebase Integration

### Configuration

The application requires the following Firebase configuration:

```typescript
interface FirebaseConfig {
  apiKey: string;              // Firebase API key
  authDomain: string;          // Firebase auth domain
  projectId: string;           // Firebase project ID
  storageBucket: string;       // Firebase storage bucket
  messagingSenderId: string;   // Firebase messaging sender ID
  appId: string;               // Firebase app ID
}
```

This configuration is stored in localStorage and can be updated through the Settings interface.

### Collections

The application uses the following Firestore collections:

- `locations`: Stores location data
- `equipment`: Stores equipment data
- `alarms`: Stores alarm data
- `users`: Stores user data
- `schedules`: Stores schedule data
- `analytics`: Stores analytics data


### Data Access Patterns

#### Reading Data

The application uses several patterns for reading data:

1. **One-time reads**: For data that doesn't change frequently

```typescript
const getLocation = async (locationId) => {
  const doc = await db.collection("locations").doc(locationId).get();
  return { id: doc.id, ...doc.data() };
};
```


2. **Real-time listeners**: For data that changes frequently

```typescript
const subscribeToEquipment = (equipmentId, callback) => {
  return db.collection("equipment").doc(equipmentId)
    .onSnapshot((doc) => {
      callback({ id: doc.id, ...doc.data() });
    });
};
```


3. **Cached reads**: For improved performance

```typescript
const fetchCachedData = async (cacheKey, fetchFn, expirationMinutes) => {
  const cached = localStorage.getItem(cacheKey);
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    const expirationTime = new Date(timestamp);
    expirationTime.setMinutes(expirationTime.getMinutes() + expirationMinutes);
    
    if (new Date() < expirationTime) {
      return data;
    }
  }
  
  const data = await fetchFn();
  localStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: new Date().toISOString()
  }));
  
  return data;
};
```




#### Writing Data

The application uses several patterns for writing data:

1. **Simple writes**: For basic data updates

```typescript
const updateEquipment = async (equipmentId, data) => {
  await db.collection("equipment").doc(equipmentId).update({
    ...data,
    updatedAt: new Date()
  });
};
```


2. **Batch writes**: For updating multiple documents atomically

```typescript
const updateEquipmentAndLocation = async (equipmentId, equipmentData, locationId, locationData) => {
  const batch = db.batch();
  
  const equipmentRef = db.collection("equipment").doc(equipmentId);
  batch.update(equipmentRef, {
    ...equipmentData,
    updatedAt: new Date()
  });
  
  const locationRef = db.collection("locations").doc(locationId);
  batch.update(locationRef, {
    ...locationData,
    updatedAt: new Date()
  });
  
  await batch.commit();
};
```


3. **Transactions**: For read-then-write operations

```typescript
const incrementAlarmCount = async (locationId) => {
  await db.runTransaction(async (transaction) => {
    const locationRef = db.collection("locations").doc(locationId);
    const locationDoc = await transaction.get(locationRef);
    
    if (!locationDoc.exists) {
      throw new Error("Location does not exist");
    }
    
    const currentCount = locationDoc.data().alarmCount || 0;
    
    transaction.update(locationRef, {
      alarmCount: currentCount + 1,
      updatedAt: new Date()
    });
  });
};
```




## Socket.IO Communication

### Connection

The application connects to a Socket.IO server for real-time communication with equipment. The connection is established in the `SocketProvider` component:

```typescript
const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    // Create Socket.IO connection
    const socketInstance = io("http://localhost:3001", {
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: true
    });
    
    // Set up event handlers
    socketInstance.on("connect", () => {
      console.log("Socket.IO connected");
      setConnected(true);
    });
    
    socketInstance.on("disconnect", () => {
      console.log("Socket.IO disconnected");
      setConnected(false);
    });
    
    socketInstance.on("connect_error", (err) => {
      console.error("Socket.IO connection error:", err);
      setConnected(false);
    });
    
    // Store socket instance
    setSocket(socketInstance);
    
    // Clean up on unmount
    return () => {
      socketInstance.disconnect();
    };
  }, []);
  
  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
};
```

### Events

The application listens for and emits the following events:

#### Incoming Events

- `mqtt_message`: Receives updates from equipment

```typescript
socket.on("mqtt_message", (message) => {
  const { equipmentId, data } = message;
  // Process equipment update
  updateEquipmentData(equipmentId, data);
});
```


- `alarm`: Receives alarm notifications

```typescript
socket.on("alarm", (alarm) => {
  // Process alarm notification
  addAlarm(alarm);
});
```




#### Outgoing Events

- `control`: Sends control commands to equipment

```typescript
const sendControlCommand = (equipmentId, controls) => {
  socket.emit("control", {
    equipmentId,
    controls
  });
};
```


- `subscribe`: Subscribes to equipment updates

```typescript
const subscribeToEquipment = (equipmentId) => {
  socket.emit("subscribe", {
    equipmentId
  });
};
```


- `unsubscribe`: Unsubscribes from equipment updates

```typescript
const unsubscribeFromEquipment = (equipmentId) => {
  socket.emit("unsubscribe", {
    equipmentId
  });
};
```




## Message Payload Formats

### General Format

All message payloads should follow this general structure:

```json
{
  "equipmentId": "equipment-unique-id",
  "data": {
    "key1": "value1",
    "key2": "value2",
    ...
  }
}
```

### Equipment Status Updates

To update the general status of equipment:

```json
{
  "equipmentId": "equipment-unique-id",
  "data": {
    "status": "online",
    "lastUpdated": "2023-03-25T12:34:56Z"
  }
}
```

Valid status values:

- `online`: Equipment is online and functioning normally
- `offline`: Equipment is offline or not responding
- `fault`: Equipment is reporting a fault condition
- `maintenance`: Equipment is in maintenance mode
- `standby`: Equipment is in standby mode


### Sensor Data Updates

To update sensor readings:

```json
{
  "equipmentId": "temperature-sensor-1",
  "data": {
    "readings": {
      "temperature": {
        "value": 72.5,
        "unit": "F",
        "timestamp": "2023-03-25T12:34:56Z"
      },
      "humidity": {
        "value": 45.2,
        "unit": "%",
        "timestamp": "2023-03-25T12:34:56Z"
      }
    }
  }
}
```

### Equipment-Specific Payloads

#### Air Handler

```json
{
  "equipmentId": "air-handler-1",
  "data": {
    "controls": {
      "unitEnable": true,
      "operationMode": "cooling",
      "temperatureSetpoint": 72.5,
      "humiditySetpoint": 50,
      "economizerEnable": true,
      "supplyAirTempSetpoint": 55,
      "supplyFanSpeed": 75,
      "supplyFanEnable": true,
      "staticPressureSetpoint": 1.5,
      "returnFanEnable": true,
      "returnFanSpeed": 60,
      "returnAirDamper": 50
    },
    "readings": {
      "supplyAirTemp": {
        "value": 56.2,
        "unit": "F"
      },
      "returnAirTemp": {
        "value": 74.3,
        "unit": "F"
      },
      "staticPressure": {
        "value": 1.48,
        "unit": "inWC"
      },
      "filterStatus": {
        "value": "clean",
        "unit": ""
      }
    }
  }
}
```

Valid operation modes for Air Handler:

- `auto`: Automatic mode selection
- `cooling`: Cooling mode
- `heating`: Heating mode
- `fan`: Fan-only mode
- `dehumidification`: Dehumidification mode


#### Chiller

```json
{
  "equipmentId": "chiller-1",
  "data": {
    "controls": {
      "unitEnable": true,
      "operationMode": "auto",
      "chilledWaterSetpoint": 44,
      "demandLimit": 100
    },
    "readings": {
      "currentCapacity": {
        "value": 85,
        "unit": "%"
      },
      "chilledWaterSupplyTemp": {
        "value": 44.2,
        "unit": "F"
      },
      "chilledWaterReturnTemp": {
        "value": 54.1,
        "unit": "F"
      },
      "condenserWaterSupplyTemp": {
        "value": 85.3,
        "unit": "F"
      },
      "condenserWaterReturnTemp": {
        "value": 95.2,
        "unit": "F"
      },
      "evaporatorPressure": {
        "value": 68.5,
        "unit": "PSI"
      },
      "condenserPressure": {
        "value": 180.2,
        "unit": "PSI"
      },
      "compressorStatus": {
        "value": "running",
        "unit": ""
      },
      "refrigerantLevel": {
        "value": 95,
        "unit": "%"
      },
      "oilPressure": {
        "value": 42.3,
        "unit": "PSI"
      },
      "oilTemperature": {
        "value": 120.5,
        "unit": "F"
      }
    }
  }
}
```

Valid operation modes for Chiller:

- `auto`: Automatic mode selection
- `cool`: Cooling mode
- `ice`: Ice-making mode
- `heat`: Heat pump mode (if applicable)
- `standby`: Standby mode


#### Boiler

```json
{
  "equipmentId": "boiler-1",
  "data": {
    "controls": {
      "unitEnable": true,
      "operationMode": "auto",
      "hotWaterSetpoint": 180,
      "demandLimit": 100
    },
    "readings": {
      "currentCapacity": {
        "value": 75,
        "unit": "%"
      },
      "hotWaterSupplyTemp": {
        "value": 178.5,
        "unit": "F"
      },
      "hotWaterReturnTemp": {
        "value": 160.2,
        "unit": "F"
      },
      "flueTemperature": {
        "value": 350.5,
        "unit": "F"
      },
      "burnerStatus": {
        "value": "running",
        "unit": ""
      },
      "flameSignal": {
        "value": 8.5,
        "unit": "μA"
      },
      "gasValvePosition": {
        "value": 80,
        "unit": "%"
      },
      "gasFlowRate": {
        "value": 125.3,
        "unit": "CFH"
      },
      "waterPressure": {
        "value": 12.5,
        "unit": "PSI"
      },
      "o2Level": {
        "value": 4.2,
        "unit": "%"
      }
    }
  }
}
```

Valid operation modes for Boiler:

- `auto`: Automatic mode selection
- `heat`: Heating mode
- `standby`: Standby mode


#### Pump

```json
{
  "equipmentId": "pump-1",
  "data": {
    "controls": {
      "pumpEnable": true,
      "speed": 85,
      "autoSpeed": true,
      "pressureSetpoint": 45
    },
    "readings": {
      "flowRate": {
        "value": 120.5,
        "unit": "GPM"
      },
      "inletPressure": {
        "value": 10.2,
        "unit": "PSI"
      },
      "outletPressure": {
        "value": 45.8,
        "unit": "PSI"
      },
      "differentialPressure": {
        "value": 35.6,
        "unit": "PSI"
      },
      "motorCurrent": {
        "value": 12.3,
        "unit": "A"
      },
      "motorTemperature": {
        "value": 140.5,
        "unit": "F"
      },
      "vibration": {
        "value": 0.15,
        "unit": "in/s"
      },
      "status": {
        "value": "running",
        "unit": ""
      },
      "runHours": {
        "value": 1250.5,
        "unit": "h"
      }
    }
  }
}
```

#### Greenhouse

```json
{
  "equipmentId": "greenhouse-1",
  "data": {
    "controls": {
      "temperatureSetpoint": 75,
      "humiditySetpoint": 60,
      "climateControlMode": "Auto",
      "exhaustFan1Enable": true,
      "exhaustFan2Enable": false,
      "supplyFanEnable": true,
      "ridgeVentEnable": true,
      "ridgeVentPosition": 30,
      "sideVentEnable": true,
      "sideVentPosition": 25,
      "hangingHeater1Enable": false,
      "hangingHeater2Enable": false,
      "hangingHeater3Enable": false,
      "hangingHeater4Enable": false,
      "floorHeater1Enable": true,
      "floorHeater2Enable": false
    },
    "readings": {
      "temperature": {
        "value": 76.2,
        "unit": "F"
      },
      "humidity": {
        "value": 58.5,
        "unit": "%"
      },
      "co2Level": {
        "value": 450,
        "unit": "PPM"
      },
      "soilMoisture": {
        "value": 65,
        "unit": "%"
      },
      "soilTemperature": {
        "value": 72.3,
        "unit": "F"
      },
      "lightLevel": {
        "value": 850,
        "unit": "lux"
      },
      "uvIndex": {
        "value": 5.2,
        "unit": ""
      }
    }
  }
}
```

Valid climate control modes for Greenhouse:

- `Auto`: Automatic mode selection
- `Heating`: Heating mode
- `Cooling`: Cooling mode
- `Ventilation`: Ventilation mode


#### Steam Bundle

```json
{
  "equipmentId": "steam-bundle-1",
  "data": {
    "controls": {
      "systemEnable": true,
      "operationMode": "Auto",
      "temperatureSetpoint": 180,
      "pressureSetpoint": 30,
      "differentialPressureSetpoint": 5,
      "pump1Status": "running",
      "pump1Speed": 85,
      "pump1IsLead": true,
      "pump2Status": "stopped",
      "pump2Speed": 0,
      "leadLagAutoChangeover": true,
      "autoFailover": true,
      "changeoverTime": 24,
      "valve13Enable": true,
      "valve13Position": 65,
      "valve23Enable": true,
      "valve23Position": 35,
      "valveControlStrategy": "Sequential",
      "valveResponseTime": 15
    },
    "readings": {
      "temperature": {
        "value": 178.5,
        "unit": "F"
      },
      "pressure": {
        "value": 29.8,
        "unit": "PSI"
      },
      "differentialPressure": {
        "value": 4.8,
        "unit": "PSI"
      },
      "flowRate": {
        "value": 120.5,
        "unit": "GPM"
      }
    }
  }
}
```

Valid operation modes for Steam Bundle:

- `Auto`: Automatic mode selection
- `Manual`: Manual mode


### Alarm Payloads

To create or update an alarm:

```json
{
  "equipmentId": "equipment-unique-id",
  "data": {
    "alarm": {
      "name": "High Temperature Alarm",
      "severity": "critical",
      "message": "Temperature exceeds critical threshold",
      "active": true,
      "timestamp": "2023-03-25T12:34:56Z"
    }
  }
}
```

Valid severity levels:

- `info`: Informational alert
- `warning`: Warning alert
- `critical`: Critical alert


To resolve an alarm:

```json
{
  "equipmentId": "equipment-unique-id",
  "data": {
    "alarm": {
      "id": "alarm-unique-id",
      "active": false,
      "resolved": true,
      "resolvedTimestamp": "2023-03-25T13:45:12Z"
    }
  }
}
```

## Authentication System

### User Authentication

The application uses a simple username/password authentication system. In a production environment, this should be replaced with a more secure authentication method.

```typescript
const authenticateUser = async (username, password) => {
  try {
    // Get user document
    const userSnapshot = await db.collection("users")
      .where("username", "==", username)
      .limit(1)
      .get();
    
    if (userSnapshot.empty) {
      return { success: false, message: "Invalid username or password" };
    }
    
    const userDoc = userSnapshot.docs[0];
    const userData = userDoc.data();
    
    // Verify password (in production, use proper password hashing)
    if (userData.passwordHash !== hashPassword(password)) {
      return { success: false, message: "Invalid username or password" };
    }
    
    // Update last login timestamp
    await db.collection("users").doc(userDoc.id).update({
      lastLogin: new Date()
    });
    
    // Return user data (excluding password hash)
    const { passwordHash, ...userInfo } = userData;
    return {
      success: true,
      user: {
        id: userDoc.id,
        ...userInfo
      }
    };
  } catch (error) {
    console.error("Authentication error:", error);
    return { success: false, message: "Authentication failed" };
  }
};
```

### Role-Based Access Control

The application supports the following roles:

- **Admin**: Full access to all features and settings

```typescript
const isAdmin = (user) => user && user.role === "admin";
```


- **Technician**: Additional access to modify equipment settings

```typescript
const isTechnician = (user) => user && (user.role === "technician" || user.role === "admin");
```


- **Operator**: Basic access to view data and control equipment

```typescript
const isOperator = (user) => user && (user.role === "operator" || user.role === "technician" || user.role === "admin");
```


- **Viewer**: Read-only access

```typescript
const isViewer = (user) => user && (user.role === "viewer" || user.role === "operator" || user.role === "technician" || user.role === "admin");
```




### Authentication for Critical Controls

Critical control operations require re-authentication, even for logged-in users:

```typescript
const authenticateForCriticalControl = async (username, password, controlType) => {
  // First, authenticate the user
  const authResult = await authenticateUser(username, password);
  
  if (!authResult.success) {
    return authResult;
  }
  
  // Check if user has permission for this control type
  const hasPermission = checkControlPermission(authResult.user, controlType);
  
  if (!hasPermission) {
    return { success: false, message: "You do not have permission to perform this action" };
  }
  
  // Log the control attempt
  await logControlAttempt(authResult.user.id, controlType, true);
  
  return { success: true, user: authResult.user };
};
```

## Alarm System

### Alarm Generation

Alarms can be generated in two ways:

1. **Automatic**: Based on threshold configurations

```typescript
const checkForAlarms = (equipmentId, readings) => {
  // Get equipment document
  const equipmentDoc = await db.collection("equipment").doc(equipmentId).get();
  
  if (!equipmentDoc.exists) {
    return;
  }
  
  const equipment = equipmentDoc.data();
  const alarmConfig = equipment.alarmConfig || {};
  
  // Check each reading against alarm thresholds
  Object.entries(readings).forEach(([key, reading]) => {
    const config = alarmConfig[key];
    
    if (!config || !config.enabled) {
      return;
    }
    
    const value = reading.value;
    
    // Check high threshold
    if (config.highThreshold !== undefined && value > config.highThreshold) {
      createAlarm({
        name: `High ${config.label}`,
        equipmentId,
        locationId: equipment.locationId,
        severity: config.severity,
        message: `${config.label} value ${value} exceeds high threshold of ${config.highThreshold}`,
        active: true,
        timestamp: new Date()
      });
    }
    
    // Check low threshold
    if (config.lowThreshold !== undefined && value < config.lowThreshold) {
      createAlarm({
        name: `Low ${config.label}`,
        equipmentId,
        locationId: equipment.locationId,
        severity: config.severity,
        message: `${config.label} value ${value} is below low threshold of ${config.lowThreshold}`,
        active: true,
        timestamp: new Date()
      });
    }
  });
};
```


2. **Manual**: Through message payloads

```typescript
const processAlarmMessage = (equipmentId, alarmData) => {
  if (alarmData.id) {
    // Update existing alarm
    updateAlarm(alarmData.id, alarmData);
  } else {
    // Create new alarm
    createAlarm({
      equipmentId,
      ...alarmData
    });
  }
};
```




### Alarm States

Alarms have the following states:

- **Active**: The alarm condition is currently present
- **Acknowledged**: A user has acknowledged the alarm but it's still active
- **Resolved**: The alarm condition has been resolved


```typescript
const acknowledgeAlarm = async (alarmId, userId) => {
  await db.collection("alarms").doc(alarmId).update({
    acknowledged: true,
    acknowledgedBy: userId,
    acknowledgedTimestamp: new Date()
  });
};

const resolveAlarm = async (alarmId, userId) => {
  await db.collection("alarms").doc(alarmId).update({
    active: false,
    resolved: true,
    resolvedBy: userId,
    resolvedTimestamp: new Date()
  });
};
```

### Alarm Severity Levels

- **Info**: Informational alerts that don't require immediate action
- **Warning**: Alerts that may require attention but aren't critical
- **Critical**: Alerts that require immediate attention


```typescript
const getAlarmColor = (severity) => {
  switch (severity) {
    case "critical":
      return "red";
    case "warning":
      return "yellow";
    case "info":
      return "blue";
    default:
      return "gray";
  }
};
```

## Analytics System

### Data Collection

The application collects data from equipment through Socket.IO messages and stores it in Firebase:

```typescript
const storeAnalyticsData = async (equipmentId, readings) => {
  // Get equipment document to get locationId
  const equipmentDoc = await db.collection("equipment").doc(equipmentId).get();
  
  if (!equipmentDoc.exists) {
    return;
  }
  
  const equipment = equipmentDoc.data();
  
  // Store analytics data
  await db.collection("analytics").add({
    equipmentId,
    locationId: equipment.locationId,
    timestamp: new Date(),
    readings
  });
};
```

### Data Aggregation

For efficient querying, the application aggregates data at different time intervals:

```typescript
const aggregateHourlyData = async () => {
  // Get analytics data from the last hour
  const hourAgo = new Date();
  hourAgo.setHours(hourAgo.getHours() - 1);
  
  const snapshot = await db.collection("analytics")
    .where("timestamp", ">=", hourAgo)
    .get();
  
  // Group data by equipmentId
  const groupedData = {};
  
  snapshot.docs.forEach(doc => {
    const data = doc.data();
    const equipmentId = data.equipmentId;
    
    if (!groupedData[equipmentId]) {
      groupedData[equipmentId] = [];
    }
    
    groupedData[equipmentId].push(data);
  });
  
  // Calculate averages for each equipment
  Object.entries(groupedData).forEach(([equipmentId, dataPoints]) => {
    const averages = calculateAverages(dataPoints);
    
    // Store hourly aggregate
    db.collection("analytics_hourly").add({
      equipmentId,
      timestamp: new Date(),
      averages
    });
  });
};
```

### Data Visualization

The application uses Recharts to visualize data with the following chart types:

- Line Charts

```javascriptreact
<LineChart width={600} height={300} data={data}>
  <XAxis dataKey="timestamp" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Line type="monotone" dataKey="temperature" stroke="#8884d8" />
  <Line type="monotone" dataKey="humidity" stroke="#82ca9d" />
</LineChart>
```


- Area Charts

```javascriptreact
<AreaChart width={600} height={300} data={data}>
  <XAxis dataKey="timestamp" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Area type="monotone" dataKey="energy" stroke="#8884d8" fill="#8884d8" />
</AreaChart>
```


- Bar Charts

```javascriptreact
<BarChart width={600} height={300} data={data}>
  <XAxis dataKey="hour" />
  <YAxis />
  <Tooltip />
  <Legend />
  <Bar dataKey="energy" fill="#8884d8" />
</BarChart>
```




### Time Ranges

Data can be viewed in the following time ranges:

```typescript
const getTimeRangeData = async (equipmentId, timeRange) => {
  let startTime = new Date();
  let collectionName = "analytics";
  
  switch (timeRange) {
    case "24h":
      startTime.setHours(startTime.getHours() - 24);
      break;
    case "7d":
      startTime.setDate(startTime.getDate() - 7);
      collectionName = "analytics_hourly";
      break;
    case "30d":
      startTime.setDate(startTime.getDate() - 30);
      collectionName = "analytics_daily";
      break;
    case "1y":
      startTime.setFullYear(startTime.getFullYear() - 1);
      collectionName = "analytics_monthly";
      break;
    default:
      startTime.setHours(startTime.getHours() - 24);
  }
  
  const snapshot = await db.collection(collectionName)
    .where("equipmentId", "==", equipmentId)
    .where("timestamp", ">=", startTime)
    .orderBy("timestamp")
    .get();
  
  return snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
};
```

## Control System

### Control Flow

1. User adjusts settings in the UI
2. Application sends control message via Socket.IO
3. Socket.IO server forwards message to the appropriate control system
4. Control system applies changes to the physical equipment
5. Equipment sends status updates back through the same channel


```typescript
const sendControlCommand = (equipmentId, controls) => {
  // Send control command via Socket.IO
  socket.emit("control", {
    equipmentId,
    controls
  });
  
  // Optionally, update the database
  db.collection("equipment").doc(equipmentId).update({
    controls,
    updatedAt: new Date()
  });
};
```

### Control Authentication

Critical control operations require authentication:

```typescript
const handleCriticalControl = async (equipmentId, controls, credentials) => {
  // Authenticate user
  const authResult = await authenticateForCriticalControl(
    credentials.username,
    credentials.password,
    "equipment_control"
  );
  
  if (!authResult.success) {
    return { success: false, message: authResult.message };
  }
  
  // Send control command
  sendControlCommand(equipmentId, controls);
  
  // Log the control action
  await logControlAction(
    authResult.user.id,
    equipmentId,
    controls
  );
  
  return { success: true };
};
```

### Control Persistence

Control settings can be:

- **Applied**: Sent to the equipment but not saved in the database

```typescript
const applyControls = (equipmentId, controls) => {
  // Send control command via Socket.IO
  socket.emit("control", {
    equipmentId,
    controls
  });
};
```


- **Saved & Applied**: Sent to the equipment and saved in the database

```typescript
const saveAndApplyControls = async (equipmentId, controls) => {
  // Send control command via Socket.IO
  socket.emit("control", {
    equipmentId,
    controls
  });
  
  // Update the database
  await db.collection("equipment").doc(equipmentId).update({
    controls,
    updatedAt: new Date()
  });
};
```




## Integration Examples

### MQTT Integration

For systems using MQTT, the Socket.IO server should bridge to an MQTT broker:

```javascript
// In the Socket.IO server
const mqtt = require('mqtt');
const client = mqtt.connect('mqtt://broker-address');

io.on('connection', (socket) => {
  socket.on('control', (data) => {
    // Convert to MQTT format
    const topic = `equipment/${data.equipmentId}/control`;
    const message = JSON.stringify(data.controls);
    
    // Publish to MQTT broker
    client.publish(topic, message);
  });
});

// Subscribe to equipment status updates
client.subscribe('equipment/+/status');

// Forward MQTT messages to Socket.IO clients
client.on('message', (topic, message) => {
  const equipmentId = topic.split('/')[1];
  const data = JSON.parse(message);
  
  io.emit('mqtt_message', {
    equipmentId,
    data
  });
});
```

### BACnet Integration

For BACnet systems, use a BACnet-to-MQTT bridge or direct BACnet integration:

```javascript
// Using bacstack library
const bacnet = require('bacstack');
const client = new bacnet();

io.on('connection', (socket) => {
  socket.on('control', (data) => {
    // Map control data to BACnet points
    const deviceId = mapEquipmentToBacnetDevice(data.equipmentId);
    
    // Write values to BACnet device
    Object.entries(data.controls).forEach(([key, value]) => {
      const objectType = getBacnetObjectType(key);
      const objectInstance = getBacnetObjectInstance(key);
      const propertyId = getBacnetPropertyId(key);
      
      client.writeProperty(deviceId, objectType, objectInstance, propertyId, [
        { type: bacnet.enum.BacnetApplicationTags.BACNET_APPLICATION_TAG_REAL, value: value }
      ]);
    });
  });
});

// Poll BACnet devices for updates
function pollBacnetDevices() {
  // For each device
  devices.forEach(device => {
    client.readPropertyMultiple(
      device.id,
      device.points.map(point => ({
        objectId: { type: point.objectType, instance: point.objectInstance },
        properties: [{ id: point.propertyId }]
      })),
      (err, value) => {
        if (err) {
          console.error('Error reading BACnet device:', err);
          return;
        }
        
        // Process and forward to Socket.IO clients
        const data = processBacnetResponse(device.equipmentId, value);
        io.emit('mqtt_message', {
          equipmentId: device.equipmentId,
          data
        });
      }
    );
  });
}

setInterval(pollBacnetDevices, 10000); // Poll every 10 seconds
```

### Modbus Integration

For Modbus systems:

```javascript
// Using modbus-serial library
const ModbusRTU = require('modbus-serial');
const client = new ModbusRTU();

// Connect to Modbus TCP
client.connectTCP('192.168.1.100', { port: 502 });

io.on('connection', (socket) => {
  socket.on('control', (data) => {
    // Map control data to Modbus registers
    const registers = mapControlsToRegisters(data.equipmentId, data.controls);
    
    // Write to Modbus registers
    registers.forEach(reg => {
      client.setID(reg.unitId);
      if (reg.type === 'coil') {
        client.writeCoil(reg.address, reg.value);
      } else if (reg.type === 'holding') {
        client.writeRegister(reg.address, reg.value);
      }
    });
  });
});

// Poll Modbus devices for updates
function pollModbusDevices() {
  // For each device configuration
  modbusDevices.forEach(device => {
    client.setID(device.unitId);
    
    // Read holding registers
    client.readHoldingRegisters(device.startRegister, device.length)
      .then(data => {
        const values = processModbusData(device.equipmentId, data.data);
        io.emit('mqtt_message', {
          equipmentId: device.equipmentId,
          data: values
        });
      })
      .catch(err => {
        console.error('Error reading Modbus device:', err);
      });
  });
}

setInterval(pollModbusDevices, 5000); // Poll every 5 seconds
```

## API Reference

### Socket.IO Events

#### Incoming Events

- `mqtt_message`: Receives updates from equipment

- Parameters:

- `equipmentId` (string): Unique identifier for the equipment
- `data` (object): Equipment data






- `alarm`: Receives alarm notifications

- Parameters:

- `equipmentId` (string): Unique identifier for the equipment
- `alarm` (object): Alarm data








#### Outgoing Events

- `control`: Sends control commands to equipment

- Parameters:

- `equipmentId` (string): Unique identifier for the equipment
- `controls` (object): Control settings






- `subscribe`: Subscribes to equipment updates

- Parameters:

- `equipmentId` (string): Unique identifier for the equipment






- `unsubscribe`: Unsubscribes from equipment updates

- Parameters:

- `equipmentId` (string): Unique identifier for the equipment








### Firebase Collections

#### locations

- `id` (string): Unique identifier
- `name` (string): Display name
- `address` (string, optional): Street address
- `city` (string, optional): City
- `state` (string, optional): State/province
- `zipCode` (string, optional): Postal code
- `country` (string, optional): Country
- `timezone` (string, optional): IANA timezone
- `weatherApiKey` (string, optional): API key for weather data
- `weatherLocation` (string, optional): Location ID for weather API
- `displayItems` (array, optional): Equipment IDs to display on dashboard
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp


#### equipment

- `  (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp


#### equipment

- `id` (string): Unique identifier
- `name` (string): Display name
- `type` (string): Equipment type (e.g., "air handler", "chiller")
- `model` (string, optional): Model number
- `manufacturer` (string, optional): Manufacturer name
- `serialNumber` (string, optional): Serial number
- `locationId` (string): Reference to parent location
- `parentId` (string, optional): Reference to parent equipment
- `status` (string, optional): Current status
- `controls` (object, optional): Current control values
- `readings` (object, optional): Current sensor readings
- `alarmConfig` (object, optional): Alarm configuration
- `schedules` (array, optional): Operating schedules
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp


#### alarms

- `id` (string): Unique identifier
- `name` (string): Display name
- `equipmentId` (string): Reference to equipment
- `locationId` (string): Reference to location
- `severity` (string): Alarm severity ("info", "warning", "critical")
- `message` (string): Descriptive message
- `active` (boolean): Whether alarm is currently active
- `acknowledged` (boolean): Whether alarm has been acknowledged
- `resolved` (boolean): Whether alarm has been resolved
- `timestamp` (timestamp): When alarm was triggered
- `acknowledgedTimestamp` (timestamp, optional): When alarm was acknowledged
- `resolvedTimestamp` (timestamp, optional): When alarm was resolved
- `acknowledgedBy` (string, optional): User who acknowledged the alarm
- `resolvedBy` (string, optional): User who resolved the alarm


#### users

- `id` (string): Unique identifier
- `username` (string): Login username
- `passwordHash` (string): Hashed password
- `name` (string, optional): Display name
- `email` (string, optional): Email address
- `phone` (string, optional): Phone number
- `role` (string): User role ("admin", "technician", "operator", "viewer")
- `preferences` (object, optional): User preferences
- `lastLogin` (timestamp, optional): Last login timestamp
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp


#### schedules

- `id` (string): Unique identifier
- `name` (string): Display name
- `equipmentId` (string): Reference to equipment
- `active` (boolean): Whether schedule is active
- `days` (array): Days of week (0-6, where 0 is Sunday)
- `periods` (array): Time periods
- `createdAt` (timestamp): Creation timestamp
- `updatedAt` (timestamp): Last update timestamp


#### analytics

- `id` (string): Unique identifier
- `equipmentId` (string): Reference to equipment
- `locationId` (string): Reference to location
- `timestamp` (timestamp): When data was recorded
- `readings` (object): Sensor readings


## Troubleshooting

### Common Issues and Solutions

#### Socket.IO Connection Issues

- **Symptom**: Equipment status not updating in real-time
- **Possible Causes**:

- Socket.IO server not running
- Network connectivity issues
- CORS configuration issues



- **Solutions**:

- Verify the Socket.IO server is running on port 3001
- Check network connectivity between client and server
- Ensure CORS is properly configured in the Socket.IO server
- Check browser console for connection errors





#### Firebase Connection Issues

- **Symptom**: Data not loading or saving
- **Possible Causes**:

- Invalid Firebase credentials
- Network connectivity issues
- Firebase security rules blocking access



- **Solutions**:

- Verify Firebase credentials in Settings > Firebase Configuration
- Check network connectivity
- Ensure Firebase security rules allow read/write access
- Check browser console for Firebase errors





#### Equipment Control Issues

- **Symptom**: Equipment not responding to control commands
- **Possible Causes**:

- Socket.IO connection issues
- Integration issues with building automation system
- Equipment offline or in fault state



- **Solutions**:

- Verify Socket.IO connection status
- Check integration with building automation system
- Verify equipment is online and operational
- Check control server logs for errors





#### Data Visualization Issues

- **Symptom**: Charts not displaying or showing incorrect data
- **Possible Causes**:

- No data available for selected time range
- Data format issues
- Browser compatibility issues



- **Solutions**:

- Try a different time range
- Check data format in Firebase
- Clear browser cache
- Try a different browser





### Debugging Tools

- **Browser Developer Tools**: For frontend issues

- Console: Check for JavaScript errors
- Network: Monitor API requests and responses
- Application: Inspect localStorage and sessionStorage



- **Socket.IO Server Logs**: For communication issues

- Check for connection events
- Monitor message flow
- Look for error messages



- **Firebase Console**: For database issues

- Verify data structure
- Check security rules
- Monitor read/write operations





### Logging

The application logs important events to help with troubleshooting:

```typescript
// Log levels
const LogLevel = {
  DEBUG: 0,
  INFO: 1,
  WARN: 2,
  ERROR: 3
};

// Current log level (can be changed in settings)
let currentLogLevel = LogLevel.INFO;

// Logging function
const log = (level, message, data) => {
  if (level >= currentLogLevel) {
    const timestamp = new Date().toISOString();
    const levelString = Object.keys(LogLevel).find(key => LogLevel[key] === level);
    
    console.log(`[${timestamp}] [${levelString}] ${message}`);
    
    if (data) {
      console.log(data);
    }
    
    // In production, send logs to a logging service
    if (process.env.NODE_ENV === "production" && level >= LogLevel.WARN) {
      sendToLoggingService(timestamp, levelString, message, data);
    }
  }
};

// Usage examples
log(LogLevel.INFO, "Application started");
log(LogLevel.WARN, "Connection attempt failed, retrying", { attempt: 3 });
log(LogLevel.ERROR, "Failed to authenticate user", { username: "user123" });
```

In a production environment, logs should be captured and stored for later analysis.

### Performance Considerations

#### Data Caching

The application implements caching for frequently accessed data:

```typescript
const fetchCachedData = async (cacheKey, fetchFn, expirationMinutes) => {
  const cached = localStorage.getItem(cacheKey);
  
  if (cached) {
    const { data, timestamp } = JSON.parse(cached);
    const expirationTime = new Date(timestamp);
    expirationTime.setMinutes(expirationTime.getMinutes() + expirationMinutes);
    
    if (new Date() < expirationTime) {
      return data;
    }
  }
  
  const data = await fetchFn();
  
  localStorage.setItem(cacheKey, JSON.stringify({
    data,
    timestamp: new Date().toISOString()
  }));
  
  return data;
};
```

#### Pagination

For large datasets, the application supports pagination:

```typescript
const fetchPaginatedData = async (collection, query, pageSize, startAfter) => {
  let ref = db.collection(collection);
  
  // Apply query constraints
  if (query) {
    Object.entries(query).forEach(([field, value]) => {
      ref = ref.where(field, "==", value);
    });
  }
  
  // Apply pagination
  ref = ref.orderBy("createdAt", "desc").limit(pageSize);
  
  if (startAfter) {
    const startAfterDoc = await db.collection(collection).doc(startAfter).get();
    ref = ref.startAfter(startAfterDoc);
  }
  
  // Execute query
  const snapshot = await ref.get();
  
  // Process results
  const data = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Check if there are more results
  const hasMore = data.length === pageSize;
  
  return {
    data,
    hasMore,
    lastDoc: data.length > 0 ? data[data.length - 1].id : null
  };
};
```

#### Real-time Updates

To minimize network traffic, consider:

- Sending delta updates instead of full state
- Implementing a throttling mechanism for high-frequency updates
- Using a message queue for reliable delivery


```typescript
// Throttle function to limit update frequency
const throttle = (func, limit) => {
  let inThrottle;
  let lastArgs;
  
  return function() {
    const args = arguments;
    
    if (!inThrottle) {
      func.apply(this, args);
      inThrottle = true;
      setTimeout(() => {
        inThrottle = false;
        if (lastArgs) {
          const _lastArgs = lastArgs;
          lastArgs = null;
          func.apply(this, _lastArgs);
        }
      }, limit);
    } else {
      lastArgs = args;
    }
  };
};

// Throttled update function
const updateEquipmentData = throttle((equipmentId, data) => {
  // Process update
  processEquipmentUpdate(equipmentId, data);
  
  // Update UI
  updateUI(equipmentId, data);
}, 1000); // Limit to one update per second
```

### Security Considerations

#### Data Security

- All sensitive data should be stored in Firebase with appropriate security rules
- Control credentials should be encrypted
- API keys should be stored securely and not exposed in client-side code


#### Authentication

- Implement proper authentication for all users
- Use role-based access control
- Require re-authentication for critical operations


#### Network Security

- Use HTTPS for all communications
- Implement proper CORS policies
- Secure Socket.IO connections with authentication tokens


```javascript
// Socket.IO server with authentication
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error("Authentication error"));
  }
  
  // Verify token
  verifyToken(token)
    .then(user => {
      socket.user = user;
      next();
    })
    .catch(err => {
      next(new Error("Authentication error"));
    });
});
```

### Conclusion

This technical documentation provides a comprehensive overview of the Automata Controls App architecture, data models, and integration patterns. By following the message payload formats and integration examples, you can successfully connect your equipment to the application and leverage its monitoring, control, and analytics capabilities.

For additional support or custom integrations, please contact the development team at [support@automatacontrols.com](mailto:support@automatacontrols.com).