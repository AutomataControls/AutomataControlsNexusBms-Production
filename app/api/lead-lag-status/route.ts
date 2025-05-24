// app/api/lead-lag-status/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { checkAndHandleFailovers, performScheduledChangeovers, findEquipmentGroups } from '@/lib/lead-lag-manager';

// Firebase Admin initialization
let admin: any = null;
let firestoreInitialized = false;

function initializeFirebaseAdmin() {
  if (firestoreInitialized) return;

  try {
    admin = require('firebase-admin');

    // Check if app is already initialized
    try {
      admin.app();
      firestoreInitialized = true;
      return;
    } catch (error) {
      // App not initialized yet, continue below
    }

    // Initialize with service account if available
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      try {
        const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        if (serviceAccount.private_key) {
          serviceAccount.private_key = serviceAccount.private_key
            .replace(/\\n/g, '\n')
            .replace(/\\\\/g, '\\');
        }

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount),
          databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
        });

        firestoreInitialized = true;
      } catch (parseError) {
        console.error("Error parsing service account JSON:", parseError);
      }
    }
  } catch (error) {
    console.error("Error initializing Firebase Admin:", error);
  }
}

export async function GET(request: NextRequest) {
  try {
    initializeFirebaseAdmin();

    if (!firestoreInitialized || !admin) {
      return NextResponse.json({
        success: false,
        error: "Firebase not initialized"
      }, { status: 500 });
    }

    // Get all equipment groups
    const groupsSnapshot = await admin.firestore().collection('equipmentGroups').get();
    
    if (groupsSnapshot.empty) {
      return NextResponse.json({
        success: true,
        message: "No equipment groups found",
        groups: []
      });
    }

    const groups = [];
    const now = Date.now();

    for (const doc of groupsSnapshot.docs) {
      const data = doc.data();
      
      // Handle field names with potential spaces
      const equipmentIds = data['equipmentIds'] || data['equipmentIds '] || [];
      const leadEquipmentId = data['leadEquipmentId'] || data['leadEquipmentId '] || '';
      const useLeadLag = data['useLeadLag'] !== undefined ? data['useLeadLag'] : 
                        (data['useLeadLag '] !== undefined ? data['useLeadLag '] : true);
      const autoFailover = data['autoFailover'] !== undefined ? data['autoFailover'] :
                          (data['autoFailover '] !== undefined ? data['autoFailover '] : true);
      const changeoverIntervalDays = data['changeoverIntervalDays'] || data['changeoverIntervalDays '] || 7;

      // Get timestamps
      let lastChangeoverTime = 0;
      if (data['lastChangeoverTime']) {
        lastChangeoverTime = typeof data['lastChangeoverTime'] === 'number'
          ? data['lastChangeoverTime']
          : data['lastChangeoverTime']._seconds * 1000;
      } else if (data['lastChangeoverTime ']) {
        lastChangeoverTime = typeof data['lastChangeoverTime '] === 'number'
          ? data['lastChangeoverTime ']
          : data['lastChangeoverTime ']._seconds * 1000;
      }

      let lastFailoverTime = 0;
      if (data['lastFailoverTime']) {
        lastFailoverTime = typeof data['lastFailoverTime'] === 'number'
          ? data['lastFailoverTime']
          : data['lastFailoverTime']._seconds * 1000;
      } else if (data['lastFailoverTime ']) {
        lastFailoverTime = typeof data['lastFailoverTime '] === 'number'
          ? data['lastFailoverTime ']
          : data['lastFailoverTime ']._seconds * 1000;
      }

      // Calculate next changeover time
      const intervalMs = changeoverIntervalDays * 24 * 60 * 60 * 1000;
      const nextChangeoverTime = lastChangeoverTime + intervalMs;
      const timeUntilNextChangeover = Math.max(0, nextChangeoverTime - now);
      const hoursUntilChangeover = Math.round(timeUntilNextChangeover / (60 * 60 * 1000) * 10) / 10;

      // Create equipment status array
      const equipmentStatus = [];
      for (const eqId of equipmentIds) {
        equipmentStatus.push({
          equipmentId: eqId,
          isLead: eqId === leadEquipmentId,
          status: eqId === leadEquipmentId ? "ACTIVE (Lead)" : "STANDBY (Lag)"
        });
      }

      groups.push({
        id: doc.id,
        name: data.name || doc.id,
        type: data.type || 'boiler',
        locationId: data.locationId || '',
        equipment: equipmentStatus,
        leadEquipmentId: leadEquipmentId,
        rotationEnabled: useLeadLag,
        rotationIntervalDays: changeoverIntervalDays,
        failoverEnabled: autoFailover,
        lastChangeoverTime: lastChangeoverTime ? new Date(lastChangeoverTime).toISOString() : null,
        lastFailoverTime: lastFailoverTime ? new Date(lastFailoverTime).toISOString() : null,
        nextChangeoverTime: nextChangeoverTime ? new Date(nextChangeoverTime).toISOString() : null,
        hoursUntilNextChangeover: hoursUntilChangeover
      });
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      groups: groups
    });

  } catch (error) {
    console.error("Error getting lead-lag status:", error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action } = await request.json();

    if (action === 'check-failovers') {
      const result = await checkAndHandleFailovers();
      return NextResponse.json(result);
    } else if (action === 'perform-changeovers') {
      const result = await performScheduledChangeovers();
      return NextResponse.json(result);
    } else {
      return NextResponse.json({
        success: false,
        error: "Invalid action. Use 'check-failovers' or 'perform-changeovers'"
      }, { status: 400 });
    }

  } catch (error) {
    console.error("Error performing lead-lag action:", error);
    return NextResponse.json({
      success: false,
      error: String(error)
    }, { status: 500 });
  }
}
