'use client';

import { initializeApp, getApps } from 'firebase/app';
import { getDatabase } from 'firebase/database';

let secondaryApp;
let secondaryDb;

// Use environment variables for configuration
const secondaryConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

try {
  // Initialize secondary Firebase app if not already initialized
  if (!getApps().find(app => app.name === 'secondary')) {
    console.log("[secondary-firebase] Initializing secondary Firebase app");
    secondaryApp = initializeApp(secondaryConfig, 'secondary');
    
    // Initialize Realtime Database
    secondaryDb = getDatabase(secondaryApp);
    console.log("[secondary-firebase] Secondary RTDB initialized successfully");
  } else {
    console.log("[secondary-firebase] Secondary Firebase app already initialized");
    secondaryApp = getApps().find(app => app.name === 'secondary');
    secondaryDb = getDatabase(secondaryApp);
  }
} catch (error) {
  console.error("[secondary-firebase] Error initializing secondary Firebase:", error);
}

export { secondaryApp, secondaryDb };
