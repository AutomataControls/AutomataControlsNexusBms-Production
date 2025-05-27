// /opt/productionapp/app/api/test-firestore-query.js
const path = require('path');

try {
  const envPath = path.resolve(__dirname, '../../.env.local');
  console.log(`Attempting to load .env file from: ${envPath}`);
  const dotenvResult = require('dotenv').config({ path: envPath });
  if (dotenvResult.error) {
    console.warn(`dotenv error: ${dotenvResult.error.message}`);
  } else {
    console.log(".env file loaded successfully by dotenv.");
  }
} catch (e) {
    console.warn(`dotenv package itself failed: ${e.message}`);
}

const admin = require('firebase-admin');
let initialized = false;

console.log("Initial process.env.FIREBASE_SERVICE_ACCOUNT (exists):", !!process.env.FIREBASE_SERVICE_ACCOUNT);
console.log("Initial process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID:", process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID);
console.log("Initial process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL:", process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL);

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
  console.log("Attempting Firebase Admin initialization with Service Account from ENV...");
  try {
    const serviceAccountJsonString = process.env.FIREBASE_SERVICE_ACCOUNT;
    const serviceAccount = JSON.parse(serviceAccountJsonString);

    // *** THIS IS THE CRUCIAL FIX for the private key ***
    if (serviceAccount.private_key) {
      serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      console.log("Private key formatted (replaced \\n with actual newlines).");
    } else {
      console.warn("Service account JSON does not contain a private_key field.");
    }

    if (admin.apps.length === 0) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
        });
        console.log("Firebase Admin initialized successfully with Service Account for test script.");
    } else {
        console.log("Firebase Admin default app already exists (Service Account method check).");
    }
    initialized = true;
  } catch (e) {
    console.error("Failed to initialize with Service Account for test script:", e);
  }
}

if (!initialized && process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID) {
    console.log("Attempting Firebase Admin initialization with Project ID from ENV (fallback)...");
    try {
        if (admin.apps.length === 0) {
            admin.initializeApp({
                projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
                databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL
            });
            console.log("Firebase Admin initialized successfully with Project ID for test script (fallback).");
        } else {
            console.log("Firebase Admin default app already exists (Project ID method check).");
        }
        initialized = true;
    } catch(e) {
        console.error("Failed to initialize with Project ID for test script (fallback):", e);
    }
}

if (admin.apps.length === 0) {
  console.error("Firebase Admin SDK NOT INITIALIZED after all attempts.");
  process.exit(1);
}

const db = admin.firestore();
console.log("Firestore instance obtained successfully.");

async function testQuery() {
  // --- Test Case 1: The failing boiler ID ---
  const failingEquipmentId = "ZLYR6YveSmCEMqtBSy3e";
  console.log(`\n--- Querying for FAILING equipmentId: '${failingEquipmentId}' ---`);
  try {
    const groupsSnapshotFail = await db.collection('equipmentGroups')
                                   .where('equipmentIds', 'array-contains', failingEquipmentId)
                                   .get();
    console.log(`Query for '${failingEquipmentId}' executed. Snapshot empty: ${groupsSnapshotFail.empty}, Size: ${groupsSnapshotFail.size}`);
    if (!groupsSnapshotFail.empty) {
      groupsSnapshotFail.forEach(doc => {
        console.log(`  Found document ID: ${doc.id}`);
        const data = doc.data();
        console.log("  Document data:", JSON.stringify(data, null, 2).substring(0, 500) + "...");
        if (data.equipmentIds && Array.isArray(data.equipmentIds)) {
            console.log("  EquipmentIDs from found doc:", data.equipmentIds);
            data.equipmentIds.forEach((id, index) => {
                console.log(`    Item ${index}: '${id}' (type: ${typeof id}), matches target: ${id === failingEquipmentId}`);
            });
        }
      });
    } else {
      console.log(`  No documents found with equipmentId '${failingEquipmentId}' in 'equipmentIds' array.`);
    }
  } catch (error) {
    console.error(`  Error during Firestore query for '${failingEquipmentId}':`, error);
  }

  // --- Test Case 2: A known working equipment ID (from your previous successful logs) ---
  const workingEquipmentId = "GUI1SxcedsLEhqbD0G2p";
  console.log(`\n--- Querying for WORKING equipmentId: '${workingEquipmentId}' ---`);
  try {
    const groupsSnapshotWork = await db.collection('equipmentGroups')
                                   .where('equipmentIds', 'array-contains', workingEquipmentId)
                                   .get();
    console.log(`Query for '${workingEquipmentId}' executed. Snapshot empty: ${groupsSnapshotWork.empty}, Size: ${groupsSnapshotWork.size}`);
    if (!groupsSnapshotWork.empty) {
      groupsSnapshotWork.forEach(doc => {
        console.log(`  Found document ID: ${doc.id}`);
        const data = doc.data();
        console.log("  Document data:", JSON.stringify(data, null, 2).substring(0, 500) + "...");
         if (data.equipmentIds && Array.isArray(data.equipmentIds)) {
            console.log("  EquipmentIDs from found doc:", data.equipmentIds);
            data.equipmentIds.forEach((id, index) => {
                console.log(`    Item ${index}: '${id}' (type: ${typeof id}), matches target: ${id === workingEquipmentId}`);
            });
        }
      });
    } else {
      console.log(`  No documents found with equipmentId '${workingEquipmentId}' in 'equipmentIds' array.`);
    }
  } catch (error) {
    console.error(`  Error during Firestore query for '${workingEquipmentId}':`, error);
  }
}

if (admin.apps.length > 0 && initialized) { // Ensure we actually initialized an app successfully
    testQuery().catch(e => console.error("Unhandled error in testQuery:", e));
} else {
    console.error("Skipping testQuery as Firebase Admin was not effectively initialized.");
}
