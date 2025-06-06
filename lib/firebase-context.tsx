// @ts-nocheck
// lib/firebase-context.tsx
"use client"

import React, { createContext, useContext, useState, useEffect, useMemo, type ReactNode } from "react"
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

const LOG_PREFIX = "[FirebaseProvider]"

interface FirebaseConfig {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
  measurementId?: string;
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
  isInitialized: boolean; 
  isLoadingConfig: boolean; 
  updateConfig: (newConfig: Partial<FirebaseConfig>) => Promise<void>
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

interface CacheItem {
  data: any
  timestamp: number
}

const cache = new Map<string, CacheItem>()

const FirebaseContext = createContext<FirebaseContextType | null>(null)

export function FirebaseProvider({ children }: { children: ReactNode }) {
  // console.log(LOG_PREFIX, "FirebaseProvider component rendering/re-rendering");

  const [app, setApp] = useState<FirebaseApp | null>(null)
  const [db, setDb] = useState<Firestore | null>(null)
  const [config, setConfig] = useState<FirebaseConfig | null>(null)
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoadingConfig, setIsLoadingConfig] = useState(true);
  const [isBrowser, setIsBrowser] = useState(false)

  useEffect(() => {
    // console.log(LOG_PREFIX, "Setting isBrowser to true");
    setIsBrowser(true)
  }, [])

  // Effect for initializing Firebase app and core config
  useEffect(() => {
    if (!isBrowser) {
      // console.log(LOG_PREFIX, "Not in browser, skipping core Firebase initialization effect.");
      return;
    }
    console.log(LOG_PREFIX, "Core Firebase initialization effect running (isBrowser = true).");

    const envConfigValues: FirebaseConfig = {
      apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
      authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN!,
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET!,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID!,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID!,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };

    if (!envConfigValues.projectId) {
        console.error(LOG_PREFIX, "CRITICAL: NEXT_PUBLIC_FIREBASE_PROJECT_ID is not defined. Firebase cannot be initialized.");
        setIsLoadingConfig(false); 
        setIsInitialized(false); 
        return;
    }
    
    console.log(LOG_PREFIX, "Setting core Firebase config from env vars for project:", envConfigValues.projectId);
    setConfig(prevConfig => ({ ...(prevConfig || {} as FirebaseConfig), ...envConfigValues })); // Corrected setConfig

    let firebaseAppInstance: FirebaseApp;
    let firestoreInstance: Firestore;

    try {
        const apps = getApps();
        if (apps.length > 0) {
            firebaseAppInstance = getApp(); 
            // console.log(LOG_PREFIX, "Using existing Firebase app instance.");
        } else {
            // console.log(LOG_PREFIX, "No existing Firebase app, initializing new one with envConfigValues.");
            firebaseAppInstance = initializeApp(envConfigValues);
        }
        firestoreInstance = getFirestore(firebaseAppInstance);

        setApp(firebaseAppInstance);
        setDb(firestoreInstance);
        setIsInitialized(true); 
        console.log(LOG_PREFIX, "Core Firebase app and Firestore DB initialized and set in state.");
    } catch (error) {
        console.error(LOG_PREFIX, "Error initializing core Firebase app/db:", error);
        setIsInitialized(false); 
        setIsLoadingConfig(false); 
    }
  }, [isBrowser]); 


  // Effect for loading additional configuration (from localStorage and then Firestore)
  useEffect(() => {
    if (!isBrowser || !isInitialized || !db) { 
      // console.log(LOG_PREFIX, `Skipping additional config load: isBrowser=${isBrowser}, isInitialized=${isInitialized}, db=${!!db}`);
      // if (isBrowser && isInitialized && !db) console.warn(LOG_PREFIX, "db instance is null, cannot load Firestore config yet.");
      return;
    }
    // console.log(LOG_PREFIX, "Additional config loading effect running (localStorage & Firestore).");
    // setIsLoadingConfig(true); // This might cause a loop if db changes trigger this effect, and this effect changes isLoadingConfig

    const loadAdditionalConfig = async () => {
      let localConfigStore: Partial<FirebaseConfig> = {};
      try {
        const savedConfig = localStorage.getItem("firebaseConfig");
        if (savedConfig) {
          localConfigStore = JSON.parse(savedConfig);
          // console.log(LOG_PREFIX, "Loaded additional config fields from localStorage:", localConfigStore);
        }
      } catch (e) {
        console.error(LOG_PREFIX, "Error parsing saved config from localStorage:", e);
      }

      setConfig(prev => ({
        ...(prev || {} as FirebaseConfig), // Ensure prev is not null
        weatherApiKey: localConfigStore.weatherApiKey || prev?.weatherApiKey,
        weatherLocation: localConfigStore.weatherLocation || prev?.weatherLocation,
        controlServerIp: localConfigStore.controlServerIp || prev?.controlServerIp,
        controlServerPort: localConfigStore.controlServerPort || prev?.controlServerPort,
        controlServerUsername: localConfigStore.controlServerUsername || prev?.controlServerUsername,
        controlServerPassword: localConfigStore.controlServerPassword || prev?.controlServerPassword,
        controlProtocol: localConfigStore.controlProtocol || prev?.controlProtocol,
        sessionConfig: localConfigStore.sessionConfig || prev?.sessionConfig,
      }));
      
      // console.log(LOG_PREFIX, "Attempting to load additional config from Firestore...");
      try {
        const configRef = doc(db, "system_config", "app_config");
        const configDoc = await getDoc(configRef);

        if (configDoc.exists()) {
          const firestoreConfigData = configDoc.data() as Partial<FirebaseConfig>;
          console.log(LOG_PREFIX, "Loaded additional config from Firestore:", Object.keys(firestoreConfigData));
          setConfig((prevConfig) => ({
            ...(prevConfig || {} as FirebaseConfig),
            weatherApiKey: firestoreConfigData.weatherApiKey || prevConfig?.weatherApiKey,
            weatherLocation: firestoreConfigData.weatherLocation || prevConfig?.weatherLocation,
            controlServerIp: firestoreConfigData.controlServerIp || prevConfig?.controlServerIp,
            controlServerPort: firestoreConfigData.controlServerPort || prevConfig?.controlServerPort,
            controlServerUsername: firestoreConfigData.controlServerUsername || prevConfig?.controlServerUsername,
            controlServerPassword: firestoreConfigData.controlServerPassword || prevConfig?.controlServerPassword,
            controlProtocol: firestoreConfigData.controlProtocol || prevConfig?.controlProtocol,
            sessionConfig: firestoreConfigData.sessionConfig || prevConfig?.sessionConfig,
          }));
        } else {
          // console.log(LOG_PREFIX, "No additional config document found in Firestore (system_config/app_config).");
        }
      } catch (error) {
        console.error(LOG_PREFIX, "Error loading additional config from Firestore:", error);
      } finally {
        setIsLoadingConfig(false); // All config loading is now complete
        console.log(LOG_PREFIX, "Finished loading all configurations (isLoadingConfig: false).");
      }
    };

    // Only set isLoadingConfig to true if we are actually going to load
    if (isInitialized && db) {
        setIsLoadingConfig(true);
        loadAdditionalConfig();
    }
  }, [isBrowser, isInitialized, db]); 

  const localInitializeFirebase = (configToUse: FirebaseConfig) => { /* ... as before ... */ };
  const updateConfig = async (newConfig: Partial<FirebaseConfig>) => { /* ... as before ... */ };
  const testConnection = async (configToTest: FirebaseConfig) => { /* ... as before ... */ return true; };
  const fetchPaginatedData = async (/* ... */) => { /* ... as before ... */ return { data: [], lastDoc: null }; };
  const fetchCachedData = async (key: string, fetchFn: () => Promise<any>, expirationMinutes: number) => { /* ... as before ... */ return fetchFn(); };

  const contextValue = useMemo(
    () => ({
      app, db, config, isInitialized, isLoadingConfig,
      updateConfig, testConnection, fetchPaginatedData, fetchCachedData,
    }),
    [app, db, config, isInitialized, isLoadingConfig],
  );

  // console.log(LOG_PREFIX, "Context value created/updated:", { isInitialized, isLoadingConfig, app: !!app, db: !!db, configProjectId: config?.projectId });

  return <FirebaseContext.Provider value={contextValue}>{children}</FirebaseContext.Provider>
}

export function useFirebase() {
  const context = useContext(FirebaseContext)
  if (!context) {
    throw new Error("useFirebase must be used within a FirebaseProvider")
  }
  return context
}
