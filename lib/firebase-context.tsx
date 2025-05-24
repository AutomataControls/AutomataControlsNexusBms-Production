"use client"

import { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react"
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
  type QueryDocumentSnapshot,
  type DocumentData,
  setDoc,
} from "firebase/firestore"
import { app as firebaseApp, db as firebaseDb, initializeFirebase } from "./firebase" // Import from firebase.ts

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
  sessionConfig?: {
    enableTimeout: boolean
    timeoutMinutes: number
    warnBeforeTimeout: boolean
    warningSeconds: number
  }
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
    orderByField?: string,
  ) => Promise<{
    data: any[]
    lastDoc: QueryDocumentSnapshot<DocumentData> | null
  }>
  fetchCachedData: (key: string, fetchFn: () => Promise<any>, expirationMinutes: number) => Promise<any>
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
  // Add a state to track if we're in the browser
  const [isBrowser, setIsBrowser] = useState(false)

  // First, detect if we're in the browser
  useEffect(() => {
    setIsBrowser(true)
  }, [])

  useEffect(() => {
    // Skip initialization if not in browser
    if (!isBrowser) return;
    
    const loadConfig = async () => {
      try {
        // Try to load from localStorage first
        let localConfig = null
        try {
          const savedConfig = localStorage.getItem("firebaseConfig")
          if (savedConfig) {
            localConfig = JSON.parse(savedConfig)
          }
        } catch (e) {
          console.error("Error parsing saved config:", e)
        }

        // Use environment variables for Firebase configuration
        const envConfig = {
          apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || localConfig?.apiKey,
          authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || localConfig?.authDomain,
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || localConfig?.projectId,
          storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || localConfig?.storageBucket,
          messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || localConfig?.messagingSenderId,
          appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || localConfig?.appId,
          measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || localConfig?.measurementId,
          // Include any additional config from localStorage
          weatherApiKey: localConfig?.weatherApiKey,
          weatherLocation: localConfig?.weatherLocation,
          controlServerIp: localConfig?.controlServerIp,
          controlServerPort: localConfig?.controlServerPort,
          controlServerUsername: localConfig?.controlServerUsername,
          controlServerPassword: localConfig?.controlServerPassword,
          controlProtocol: localConfig?.controlProtocol,
          sessionConfig: localConfig?.sessionConfig,
        }

        setConfig(envConfig)
        
        // Use the shared Firebase instance if available, otherwise initialize
        if (firebaseApp && firebaseDb) {
          setApp(firebaseApp);
          setDb(firebaseDb);
        } else {
          // Fallback to our own initialization
          initializeFirebase(envConfig);
        }

        // After initialization is complete, try to load additional configuration from Firestore
        setTimeout(async () => {
          if (db) {
            try {
              const configRef = doc(collection(db, "system_config"), "app_config")
              const configDoc = await getDoc(configRef)

              if (configDoc.exists()) {
                const firestoreConfig = configDoc.data()
                // Only update additional configuration fields, not core Firebase config
                setConfig((prevConfig) => ({
                  ...prevConfig,
                  weatherApiKey: firestoreConfig.weatherApiKey || prevConfig?.weatherApiKey,
                  weatherLocation: firestoreConfig.weatherLocation || prevConfig?.weatherLocation,
                  controlServerIp: firestoreConfig.controlServerIp || prevConfig?.controlServerIp,
                  controlServerPort: firestoreConfig.controlServerPort || prevConfig?.controlServerPort,
                  controlServerUsername: firestoreConfig.controlServerUsername || prevConfig?.controlServerUsername,
                  controlServerPassword: firestoreConfig.controlServerPassword || prevConfig?.controlServerPassword,
                  controlProtocol: firestoreConfig.controlProtocol || prevConfig?.controlProtocol,
                  sessionConfig: firestoreConfig.sessionConfig || prevConfig?.sessionConfig,
                }))
              }
            } catch (error) {
              console.error("Error loading additional config from Firestore:", error)
            }
          }
        }, 1000) // Small delay to ensure db is initialized
      } catch (error) {
        console.error("Error loading Firebase config:", error)
      }
    }

    loadConfig()
  }, [isBrowser, db]) // Only run when isBrowser changes to true

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
      // Update state immediately for UI responsiveness
      setConfig((prevConfig) => ({
        ...prevConfig,
        ...newConfig,
      }))

      // Save to localStorage as a backup
      localStorage.setItem(
        "firebaseConfig",
        JSON.stringify({
          ...config,
          ...newConfig,
        }),
      )

      // Save to Firestore
      if (db) {
        const configRef = doc(collection(db, "system_config"), "app_config")
        await setDoc(
          configRef,
          {
            ...newConfig,
            updatedAt: new Date(),
          },
          { merge: true },
        ) // Use merge: true to only update specified fields
      }

      // Only re-initialize Firebase if core Firebase config has changed
      const coreConfigChanged = [
        "apiKey",
        "authDomain",
        "projectId",
        "storageBucket",
        "messagingSenderId",
        "appId",
      ].some((key) => newConfig[key] !== config?.[key])

      if (coreConfigChanged) {
        const apps = getApps()
        if (apps.length > 0) {
          await deleteApp(getApp())
        }
        initializeFirebase(newConfig)
      }

      return true
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
    orderByField?: string,
  ) => {
    if (!db) return { data: [], lastDoc: null };
    
    let q;
    
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
    const data = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }))

    return {
      data,
      lastDoc: snapshot.docs[snapshot.docs.length - 1] || null,
    }
  }

  // Function to fetch and cache data
  const fetchCachedData = async (key: string, fetchFn: () => Promise<any>, expirationMinutes: number) => {
    const now = Date.now()
    const cached = cache.get(key)

    if (cached && now - cached.timestamp < expirationMinutes * 60 * 1000) {
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
