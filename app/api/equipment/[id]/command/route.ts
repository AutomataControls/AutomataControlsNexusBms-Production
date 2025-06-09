// @ts-nocheck
// app/api/equipment/[id]/command/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { Queue } from 'bullmq'
import Redis from 'ioredis'

// Initialize Redis connection for BullMQ (local server)
const connection = new Redis({
  host: 'localhost',
  port: 6379,
  maxRetriesPerRequest: null,
})

// Initialize equipment control queue (SINGLE DECLARATION)
const equipmentQueue = new Queue('equipment-controls', {
  connection,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: { age: 24 * 3600, count: 10 },
    removeOnFail: { age: 24 * 3600, count: 5 },
  }
})

// Helper function to write UICommands to both databases (8181 and 8182)
async function writeUICommandsToBothDatabases(
  equipmentId: string, 
  command: string, 
  settings: any, 
  userId: string, 
  userName: string,
  locationId: string,
  equipmentType: string
) {
  // Check if this is a setpoint command that should be written to UICommands
  const setpointCommands = [
    'supplyTempSetpoint',
    'temperatureSetpoint', 
    'mixedAirSetpoint',
    'setpointAdjustment',
    'targetTemperature',
    'APPLY_CONTROL_SETTINGS' // This seems to be your main command type
  ];

  const isSetpointCommand = setpointCommands.some(cmd => 
    command.includes(cmd) || 
    (settings && Object.keys(settings).some(key => 
      key.includes('Setpoint') || key.includes('setpoint') || key.includes('Temp')
    ))
  );

  if (!isSetpointCommand) {
    console.log(`Command ${command} is not a setpoint command, skipping UICommands write`);
    return;
  }

  const timestamp = Date.now() * 1000000; // Convert to nanoseconds for InfluxDB
  
  // Prepare line protocol data for UICommands
  const lineProtocolData = `UICommands,equipmentId=${equipmentId},locationId=${locationId},userId=${userId},command=${command},equipmentType=${equipmentType} userName="${userName}",priority="normal",${Object.entries(settings).map(([key, value]) => {
    if (typeof value === 'string') {
      return `${key}="${value}"`;
    } else {
      return `${key}=${value}`;
    }
  }).join(',')} ${timestamp}`;

  const writePromises = [];

  // Write to main database (8181) - UICommands
  const write8181Promise = fetch('http://localhost:8181/api/v3/write_lp?db=UICommands&precision=nanosecond', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: lineProtocolData
  }).then(response => {
    if (!response.ok) {
      throw new Error(`Failed to write to 8181 UICommands: ${response.statusText}`);
    }
    console.log(`Successfully wrote UICommands to 8181 for equipment ${equipmentId}`);
  }).catch(error => {
    console.error('Error writing to 8181 UICommands:', error);
  });

  // Write to Processing Engine database (8182) - UICommands  
  const write8182Promise = fetch('http://localhost:8182/api/v3/write_lp?db=UICommands&precision=nanosecond', {
    method: 'POST',
    headers: {
      'Content-Type': 'text/plain',
    },
    body: lineProtocolData
  }).then(response => {
    if (!response.ok) {
      throw new Error(`Failed to write to 8182 UICommands: ${response.statusText}`);
    }
    console.log(`Successfully wrote UICommands to 8182 for equipment ${equipmentId}`);
  }).catch(error => {
    console.error('Error writing to 8182 UICommands:', error);
  });

  writePromises.push(write8181Promise, write8182Promise);

  // Execute both writes concurrently
  try {
    await Promise.allSettled(writePromises);
    console.log(`UICommands dual write completed for equipment ${equipmentId} - Processing Engine has immediate access to user setpoints`);
  } catch (error) {
    console.error('Error in dual UICommands write:', error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const equipmentId = id
    const body = await request.json()

    // Validate required fields
    if (!body.command) {
      return NextResponse.json(
        { error: 'Command is required' },
        { status: 400 }
      )
    }

    // Write setpoint commands to UICommands on both databases (8181 and 8182)
    // THIS IS IMMEDIATE - NOT QUEUED - Processing Engine needs real-time access
    if (body.settings && (body.locationId || body.equipmentType)) {
      await writeUICommandsToBothDatabases(
        equipmentId,
        body.command,
        body.settings,
        body.userId || 'unknown',
        body.userName || 'Unknown User',
        body.locationId || 'unknown',
        body.equipmentType || 'unknown'
      );
    }

    // Prepare job data for BullMQ (SEPARATE from UICommands write)
    const jobData = {
      equipmentId,
      equipmentName: body.equipmentName,
      equipmentType: body.equipmentType,
      locationId: body.locationId,
      locationName: body.locationName,
      command: body.command,
      settings: body.settings,
      userId: body.userId,
      userName: body.userName,
      timestamp: new Date().toISOString(),
      priority: body.priority || 'normal'
    }

    // Set job priority
    const priority = body.priority === 'high' ? 1 :
                    body.command === 'EMERGENCY_SHUTDOWN' ? 1
