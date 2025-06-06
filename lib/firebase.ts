// @ts-nocheck
"use client"
import { initializeApp, getApps, getApp } from "firebase/app"
import { getAnalytics } from "firebase/analytics"
import { getFirestore, collection, getDocs } from "firebase/firestore"
import { getAuth } from "firebase/auth"
import { getStorage } from "firebase/storage"
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}
// Initialize Firebase immediately, not conditionally
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp()
// Initialize Firebase services
const db = getFirestore(app)
const auth = getAuth(app)
const storage = getStorage(app)
// Only initialize analytics in the browser
let analytics = null
if (typeof window !== "undefined") {
  try {
    analytics = getAnalytics(app)
  } catch (error) {
    console.error("Error initializing Firebase Analytics:", error)
  }
}
export { app, db, auth, storage, analytics, collection, getDocs }
