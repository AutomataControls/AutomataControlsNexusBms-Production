import { initializeApp, cert, type App } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';

export function initializeFirebase(): { app: App, db: Firestore } {
  try {
    // Check required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(
        'Missing required Firebase credentials. Please check your .env file for:\n' +
        '- FIREBASE_PROJECT_ID\n' +
        '- FIREBASE_CLIENT_EMAIL\n' +
        '- FIREBASE_PRIVATE_KEY'
      );
    }

    // Initialize Firebase Admin
    const app = initializeApp({
      credential: cert({
        projectId,
        clientEmail,
        privateKey: privateKey.replace(/\\n/g, '\n'),
      }),
    });

    // Initialize Firestore
    const db = getFirestore(app);
    console.log('Firebase Admin initialized successfully with project:', projectId);
    return { app, db };
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error);
    throw error;
  }
} 