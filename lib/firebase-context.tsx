"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useMemo, ReactNode } from "react"
import { initializeApp, deleteApp, type FirebaseApp, getApps, getApp } from "firebase/app"
import {
  getFirestore,
  type Firestore,
  collection,
  doc,
  getDoc,
  query,
  limit,
  startAfter,
  orderBy,
  getDocs,
  QueryDocumentSnapshot,
  DocumentData,
  setDoc,
} from "firebase/firestore"
import { db } from './firebase'

interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  weatherApiKey?: string
  weatherLocation?: string
  controlServerIp?: string
  controlServerPort?: string
  controlServerUsername?: string
  controlServerPassword?: string
  controlProtocol?: string
}

interface FirebaseContextType {
  app: FirebaseApp | null
  db: Firestore | null
  config: FirebaseConfig | null
  updateConfig: (newConfig: FirebaseConfig) => Promise<void>
  testConnection: (config: FirebaseConfig) => Promise<boolean>
  fetchPaginatedData: (
    collectionName: string,
    pageSize: number,
    lastDoc: QueryDocumentSnapshot<DocumentData> | null,
    orderByField?: string
  ) => Promise<{
    data: any[];
    lastDoc: QueryDocumentSnapshot<DocumentData> | null;
  }>
  fetchCachedData: (
    key: string,
    fetchFn: () => Promise<any>,
    expirationMinutes: number
  ) => Promise<any>
}

// Cache for data
interface CacheItem {
  data: any
  timestamp: number
}

const cache = new Map<string, CacheItem>()

const FirebaseContext = createContext<FirebaseContextType | null>(null)

export function FirebaseProvider({ children }: { children: ReactNode }) {
  const [app, setApp] = useState<FirebaseApp | null>(null)
  const [db, setDb] = useState<Firestore | null>(null)
  const [config, setConfig] = useState<FirebaseConfig | null>(null)

  useEffect(() => {
    const loadConfig = async () => {
      try {
        // Use environment variables for Firebase configuration
        const envConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
          measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
        };
        
        setConfig(envConfig);
        initializeFirebase(envConfig);
        
        // After initialization is complete, try to load additional configuration from Firestore
        setTimeout(async () => {
          if (db) {
            try {
              const configRef = doc(collection(db, "system_config"), "app_config");
              const configDoc = await getDoc(configRef);
              
              if (configDoc.exists()) {
                const firestoreConfig = configDoc.data();
                // Only update additional configuration fields, not core Firebase config
                setConfig(prevConfig => ({ 
                  ...prevConfig, 
                  weatherApiKey: firestoreConfig.weatherApiKey || prevConfig?.weatherApiKey,
                  weatherLocation: firestoreConfig.weatherLocation || prevConfig?.weatherLocation,
                  controlServerIp: firestoreConfig.controlServerIp || prevConfig?.controlServerIp,
                  controlServerPort: firestoreConfig.controlServerPort || prevConfig?.controlServerPort,
                  controlServerUsername: firestoreConfig.controlServerUsername || prevConfig?.controlServerUsername,
                  controlServerPassword: firestoreConfig.controlServerPassword || prevConfig?.controlServerPassword,
                  controlProtocol: firestoreConfig.controlProtocol || prevConfig?.controlProtocol,
                }));
              }
            } catch (error) {
              console.error("Error loading additional config from Firestore:", error);
            }
          }
        }, 1000); // Small delay to ensure db is initialized
      } catch (error) {
        console.error("Error loading Firebase config:", error);
      }
    };

    loadConfig();
  }, [db]);

  const initializeFirebase = (config: FirebaseConfig) => {
    try {
      // Check if Firebase is already initialized
      const apps = getApps()
      let firebaseApp: FirebaseApp

      if (apps.length === 0) {
        firebaseApp = initializeApp(config)
      } else {
        firebaseApp = getApp()
      }

      setApp(firebaseApp)
      setDb(getFirestore(firebaseApp))
    } catch (error) {
      console.error("Error initializing Firebase:", error)
    }
  }

  const updateConfig = async (newConfig: FirebaseConfig) => {
    try {
      // Save to localStorage as a backup
      localStorage.setItem("firebaseConfig", JSON.stringify(newConfig))
      setConfig(newConfig)

      // Save to Firestore
      if (db) {
        const configRef = doc(collection(db, "system_config"), "app_config")
        await setDoc(configRef, {
          ...newConfig,
          updatedAt: new Date(),
        })
      }

      // Re-initialize Firebase with new config if needed
      const apps = getApps()
      if (apps.length > 0) {
        await deleteApp(getApp())
      }

      initializeFirebase(newConfig)
    } catch (error) {
      console.error("Error updating config:", error)
      throw error
    }
  }

  const testConnection = async (config: FirebaseConfig) => {
    try {
      // Initialize a temporary Firebase instance
      const tempApp = initializeApp(config, "temp-app")
      const tempDb = getFirestore(tempApp)

      // Try to get a document to test the connection
      await getDoc(doc(collection(tempDb, "test"), "test"))

      // Clean up
      await deleteApp(tempApp)

      return true
    } catch (error) {
      console.error("Firebase connection test failed:", error)
      return false
    }
  }

  // Function to fetch paginated data
  const fetchPaginatedData = async (
    collectionName: string,
    pageSize: number,
    lastDoc: QueryDocumentSnapshot<DocumentData> | null,
    orderByField?: string
  ) => {
    let q = collection(db, collectionName)
    
    if (orderByField) {
      if (lastDoc) {
        q = query(collection(db, collectionName), orderBy(orderByField), startAfter(lastDoc), limit(pageSize))
      } else {
        q = query(collection(db, collectionName), orderBy(orderByField), limit(pageSize))
      }
    } else {
      if (lastDoc) {
        q = query(collection(db, collectionName), startAfter(lastDoc), limit(pageSize))
      } else {
        q = query(collection(db, collectionName), limit(pageSize))
      }
    }

    const snapshot = await getDocs(q)
    const data = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }))

    return {
      data,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null
    }
  }

  // Function to fetch and cache data
  const fetchCachedData = async (
    key: string,
    fetchFn: () => Promise<any>,
    expirationMinutes: number
  ) => {
    const now = Date.now()
    const cached = cache.get(key)

    if (cached && (now - cached.timestamp) < expirationMinutes * 60 * 1000) {
      return cached.data
    }

    const data = await fetchFn()
    cache.set(key, { data, timestamp: now })
    return data
  }

  const contextValue = useMemo(
    () => ({
      app,
      db,
      config,
      updateConfig,
      testConnection,
      fetchPaginatedData,
      fetchCachedData,
    }),
    [app, db, config],
  )

  return <FirebaseContext.Provider value={contextValue}>{children}</FirebaseContext.Provider>
}

export function useFirebase() {
  const context = useContext(FirebaseContext)
  if (!context) {
    throw new Error("useFirebase must be used within a FirebaseProvider")
  }
  return context
}
