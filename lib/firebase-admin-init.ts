// lib/firebase-admin-init.ts
import * as admin from 'firebase-admin';
import { logCommand } from './logging/command-logger';

let adminAppInstance: admin.app.App | null = null;
let firestoreDbInstance: admin.firestore.Firestore | null = null;
let realtimeDbInstance: admin.database.Database | null = null;
let firebaseAdminInitialized = false;

if (admin.apps.length === 0) {
  console.log('[INIT_DEBUG] GLOBAL Firebase Admin SDK: No existing apps found, attempting initialization...');

  const serviceAccountEnv = process.env.FIREBASE_SERVICE_ACCOUNT;
  const databaseURLEnv = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;

  if (!databaseURLEnv) {
    console.error('[INIT_DEBUG] GLOBAL Firebase Admin SDK: CRITICAL - NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set!');
  } else if (serviceAccountEnv && serviceAccountEnv.trim() !== "") {
    console.log('[INIT_DEBUG] GLOBAL Firebase Admin SDK: Found FIREBASE_SERVICE_ACCOUNT environment variable.');
    
    try {
      // Attempt to parse the environment variable string directly
      const serviceAccountConfig = JSON.parse(serviceAccountEnv);

      // NOW, specifically fix the private_key field if it exists and is a string
      if (serviceAccountConfig.private_key && typeof serviceAccountConfig.private_key === 'string') {
        serviceAccountConfig.private_key = serviceAccountConfig.private_key.replace(/\\n/g, '\n');
        logCommand('GLOBAL Firebase Admin SDK: Corrected newlines in parsed private_key.', 'info');
      } else {
        logCommand('GLOBAL Firebase Admin SDK: private_key field not found or not a string in parsed service account.', 'warn');
      }
      
      logCommand('GLOBAL Firebase Admin SDK: Successfully parsed initial FIREBASE_SERVICE_ACCOUNT JSON.', 'info', {
        projectId: serviceAccountConfig.project_id,
        clientEmail: serviceAccountConfig.client_email,
      });
      
      if (!serviceAccountConfig.project_id || !serviceAccountConfig.client_email || !serviceAccountConfig.private_key) {
        logCommand('GLOBAL Firebase Admin SDK: Parsed service account is missing essential properties.', 'error');
        throw new Error("Parsed service account missing essential properties.");
      }

      adminAppInstance = admin.initializeApp({
        credential: admin.credential.cert(serviceAccountConfig), // Use the modified config
        databaseURL: databaseURLEnv,
      });
      logCommand('GLOBAL Firebase Admin SDK: Initialized successfully using FIREBASE_SERVICE_ACCOUNT.', 'info');

    } catch (e: any) {
      console.error(`[INIT_DEBUG] Error during SA init: ${e.message}`, e);
      logCommand(`GLOBAL Firebase Admin SDK: Error initializing with FIREBASE_SERVICE_ACCOUNT: ${e.message}. Falling back.`, 'error');
      try {
          adminAppInstance = admin.initializeApp({ databaseURL: databaseURLEnv });
          logCommand('GLOBAL Firebase Admin SDK: Initialized with default credentials (fallback after SA failure).', 'info');
      } catch (defaultInitError: any) {
          logCommand(`GLOBAL Firebase Admin SDK: Default initialization also failed: ${defaultInitError.message}`, 'error');
      }
    }
  } else {
      // ... (fallback logic) ...
      if (databaseURLEnv) {
        logCommand('GLOBAL Firebase Admin SDK: FIREBASE_SERVICE_ACCOUNT env var not found/empty. Attempting default init.', 'warn');
        try {
            adminAppInstance = admin.initializeApp({ databaseURL: databaseURLEnv });
            logCommand('GLOBAL Firebase Admin SDK: Initialized with default credentials.', 'info');
        } catch (defaultInitError: any) {
            logCommand(`GLOBAL Firebase Admin SDK: Default init failed: ${defaultInitError.message}`, 'error');
        }
      } else {
        logCommand('GLOBAL Firebase Admin SDK: NEXT_PUBLIC_FIREBASE_DATABASE_URL is not set, cannot attempt default init.', 'error');
      }
  }
} else {
  adminAppInstance = admin.app();
}

if (adminAppInstance) {
  firestoreDbInstance = admin.firestore(adminAppInstance);
  realtimeDbInstance = admin.database(adminAppInstance);
} else {
  logCommand('GLOBAL Firebase Admin SDK: Admin App instance is null after all attempts.', 'critical');
}
firebaseAdminInitialized = true;

export const adminSdk = admin;
export const adminApp = adminAppInstance;
export const firestoreAdmin = firestoreDbInstance;
export const rtdbAdmin = realtimeDbInstance;
