// /server/monitoring-service.js
const { initializeApp } = require('firebase/app');
const { 
  getFirestore, 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  query, 
  where, 
  limit 
} = require('firebase/firestore');
const { getDatabase, ref, onValue, get } = require('firebase/database');

console.log('🔄 Initializing monitoring service...');

// Debug environment variables
console.log('Checking environment variables:');
console.log('- NEXT_PUBLIC_FIREBASE_DATABASE_URL:', process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL ? 'Set' : 'Not set');
console.log('- NEXT_PUBLIC_FIREBASE_PROJECT_ID:', process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ? 'Set' : 'Not set');

// Initialize primary Firebase (for Firestore)
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID
};

// Initialize secondary Firebase for RTDB
// IMPORTANT: We need to hardcode the databaseURL if the environment variable is not available
const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || 
                   `https://${process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID}-default-rtdb.firebaseio.com`;

console.log('Using database URL:', databaseURL);

const secondaryFirebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: databaseURL // Explicitly set the database URL
};

// Initialize Firebase instances
let firebaseApp;
let secondaryFirebaseApp;
let db;
let rtdb;

try {
  // Initialize primary Firebase app
  firebaseApp = initializeApp(firebaseConfig);
  // Get Firestore instance using the modular API
  db = getFirestore(firebaseApp);
  console.log('✅ Primary Firebase initialized successfully');
  
  // Initialize secondary Firebase app for RTDB
  secondaryFirebaseApp = initializeApp(secondaryFirebaseConfig, 'secondary');
  console.log('Secondary Firebase app initialized with config:', {
    projectId: secondaryFirebaseConfig.projectId,
    databaseURL: secondaryFirebaseConfig.databaseURL
  });
  
  // Get RTDB instance using the modular API
  rtdb = getDatabase(secondaryFirebaseApp);
  console.log('✅ Secondary Firebase initialized successfully');
} catch (error) {
  console.error('❌ Firebase initialization error:', error);
  process.exit(1);
}

// Rest of the code remains the same...
