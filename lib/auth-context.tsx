"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { auth } from "./firebase"
import {
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  signInWithRedirect,
  signInWithEmailAndPassword as signInWithEmail,
} from "firebase/auth"
import { doc, getDoc, getFirestore, collection, query, where, getDocs, setDoc, updateDoc } from "firebase/firestore"

interface User {
  id: string
  username: string
  name: string
  email: string
  roles: string[]
  assignedLocations?: string[] // This can be a string array or single string in Firestore
  emailVerified?: boolean // Added this field
  pending?: boolean // Added this field
}

interface AuthContextType {
  user: User | null
  loading: boolean
  loginWithEmail: (email: string, password: string) => Promise<void>
  loginWithUsername: (username: string, password: string) => Promise<void>
  loginWithGoogle: () => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | null>(null)

// Helper function to ensure assignedLocations is always an array
const convertToArray = (value: any): string[] => {
  if (value === undefined || value === null) {
    return []
  }

  if (Array.isArray(value)) {
    return value.map(String)
  }

  // If it's a single value (string, number, etc.), wrap it in an array
  return [String(value)]
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const db = getFirestore()

  // Helper function to sync Firebase Auth emailVerified with Firestore
  const syncEmailVerificationStatus = async (firebaseUser, userDocRef) => {
    console.log("Syncing email verification status:", firebaseUser.emailVerified)

    try {
      // Get the current user document
      const userDoc = await getDoc(userDocRef)

      // If Firebase Auth says email is verified but Firestore doesn't, update Firestore
      if (
        firebaseUser.emailVerified &&
        userDoc.exists() &&
        (userDoc.data().emailVerified === false || userDoc.data().pending === true)
      ) {
        console.log("Email is verified in Firebase Auth but not in Firestore. Updating Firestore...")

        await updateDoc(userDocRef, {
          emailVerified: true,
          pending: false, // IMPORTANT: Also set pending to false when email is verified
          updatedAt: new Date(),
        })

        console.log("Firestore updated with verified status and pending=false")
        return true // Email was verified and synced
      }

      return userDoc.exists() ? userDoc.data().emailVerified : false
    } catch (error) {
      console.error("Error syncing email verification status:", error)
      return firebaseUser.emailVerified // Fall back to Firebase Auth status
    }
  }

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        // Check for redirect result when the component mounts
        console.log("Checking for Google redirect result")
        const result = await getRedirectResult(auth)
        if (result) {
          console.log("Google redirect result found:", result)
          const firebaseUser = result.user
          // Get additional user data from Firestore
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))

          // Sync email verification status
          const emailVerified = await syncEmailVerificationStatus(firebaseUser, doc(db, "users", firebaseUser.uid))

          if (!userDoc.exists()) {
            console.log("Creating new user document for Google sign-in")
            // Create new user document for Google sign-in
            await setDoc(doc(db, "users", firebaseUser.uid), {
              username: firebaseUser.email,
              name: firebaseUser.displayName || "",
              email: firebaseUser.email,
              roles: ["user"],
              assignedLocations: [], // Initialize with empty array
              emailVerified: firebaseUser.emailVerified, // Include email verification status
              pending: false, // Google users are not pending by default
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }

          const userData = userDoc.exists()
            ? userDoc.data()
            : {
                username: firebaseUser.email,
                name: firebaseUser.displayName || "",
                roles: ["user"],
                assignedLocations: [], // Initialize with empty array
              }

          console.log("Setting user state after Google sign-in")
          setUser({
            id: firebaseUser.uid,
            username: userData.username || firebaseUser.email || "",
            name: userData.name || firebaseUser.displayName || "",
            email: firebaseUser.email || "",
            roles: userData.roles || ["user"],
            assignedLocations: convertToArray(userData.assignedLocations), // Convert to array regardless of original format
            emailVerified: emailVerified, // Include email verification status
            pending: userData.pending !== undefined ? userData.pending : false, // Include pending status
          })
        } else {
          console.log("No Google redirect result found")
        }
      } catch (error) {
        console.error("Google redirect result error:", error)
      }
    }

    handleRedirectResult()

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      console.log("Auth state changed:", firebaseUser ? "User logged in" : "No user")
      if (firebaseUser) {
        try {
          // Create a reference to the user document
          const userDocRef = doc(db, "users", firebaseUser.uid)

          // Get additional user data from Firestore
          const userDoc = await getDoc(userDocRef)

          // Sync email verification status - pass the document reference
          const emailVerified = await syncEmailVerificationStatus(firebaseUser, userDocRef)

          if (userDoc.exists()) {
            const userData = userDoc.data()
            console.log("User document found in Firestore")
            console.log("Raw assignedLocations from Firestore:", userData.assignedLocations)
            console.log("Converted assignedLocations:", convertToArray(userData.assignedLocations))
            setUser({
              id: firebaseUser.uid,
              username: userData.username || firebaseUser.email || "",
              name: userData.name || "",
              email: firebaseUser.email || "",
              roles: userData.roles || ["user"],
              assignedLocations: convertToArray(userData.assignedLocations),
              emailVerified: emailVerified, // Use the synced value
              pending: userData.pending !== undefined ? userData.pending : false,
            })
          } else {
            console.log("Creating new user document")
            // Create a new user document if it doesn't exist
            const username = firebaseUser.email.split("@")[0] // Use part before @ as username
            await setDoc(doc(db, "users", firebaseUser.uid), {
              username: username,
              name: firebaseUser.displayName || "",
              email: firebaseUser.email,
              roles: ["user"],
              assignedLocations: [], // Initialize with empty array
              emailVerified: firebaseUser.emailVerified, // Include email verification status
              pending: true, // New users are pending by default
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            setUser({
              id: firebaseUser.uid,
              username: username,
              name: firebaseUser.displayName || "",
              email: firebaseUser.email || "",
              roles: ["user"],
              assignedLocations: [], // Include empty assignedLocations
              emailVerified: firebaseUser.emailVerified, // Include email verification status
              pending: true, // New users are pending by default
            })
          }
        } catch (error) {
          console.error("Error fetching user data:", error)
        }
      } else {
        setUser(null)
      }
      setLoading(false)
    })

    return () => unsubscribe()
  }, [db])

  const loginWithEmail = async (email: string, password: string) => {
    console.log("Attempting email login with:", email)
    try {
      const userCredential = await signInWithEmail(auth, email, password)
      const firebaseUser = userCredential.user
      console.log("Email login successful for:", firebaseUser.email)

      // Create a reference to the user document
      const userDocRef = doc(db, "users", firebaseUser.uid)

      // Get additional user data from Firestore
      const userDoc = await getDoc(userDocRef)

      // Sync email verification status - pass the document reference
      const emailVerified = await syncEmailVerificationStatus(firebaseUser, userDocRef)

      if (userDoc.exists()) {
        const userData = userDoc.data()
        setUser({
          id: firebaseUser.uid,
          username: userData.username || firebaseUser.email || "",
          name: userData.name || "",
          email: firebaseUser.email || "",
          roles: userData.roles || ["user"],
          assignedLocations: convertToArray(userData.assignedLocations),
          emailVerified: emailVerified, // Use the synced value
          pending: userData.pending !== undefined ? userData.pending : false,
        })
      } else {
        // Create a new user document if it doesn't exist
        const username = email.split("@")[0] // Use part before @ as username
        await setDoc(userDocRef, {
          username: username,
          name: firebaseUser.displayName || "",
          email: firebaseUser.email,
          roles: ["user"],
          assignedLocations: [],
          emailVerified: firebaseUser.emailVerified,
          pending: false, // Set to false for new users
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        setUser({
          id: firebaseUser.uid,
          username: username,
          name: firebaseUser.displayName || "",
          email: firebaseUser.email || "",
          roles: ["user"],
          assignedLocations: [],
          emailVerified: firebaseUser.emailVerified,
          pending: false, // Set to false for new users
        })
      }
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  const loginWithUsername = async (username: string, password: string) => {
    console.log("Attempting username login with:", username)
    try {
      // First, find the user by username in Firestore
      const usersRef = collection(db, "users")
      const q = query(usersRef, where("username", "==", username))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        console.error("Username login failed: User not found")
        throw new Error("User not found")
      }

      const userData = querySnapshot.docs[0].data()
      console.log("Username found, proceeding with email login using:", userData.email)

      // Now login with the associated email
      return loginWithEmail(userData.email, password)
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider()

      // Use the login page as the redirect URL
      const redirectUri =
        typeof window !== "undefined"
          ? `${window.location.protocol}//${window.location.host}/login`
          : "https://neuralbms.automatacontrols.com/login"

      console.log("Google Auth redirect URI:", redirectUri)
      console.log("Google Auth provider:", provider)

      // Configure Firebase auth settings
      auth.useDeviceLanguage()

      // Add parameters to the auth provider
      provider.setCustomParameters({
        prompt: "select_account",
        // The redirect_uri is handled by Firebase automatically,
        // specifying it manually can cause issues
      })

      // Try sign-in with popup first as it's more reliable
      try {
        console.log("Attempting Google sign-in with popup...")
        const result = await signInWithPopup(auth, provider)
        console.log("Google sign-in with popup successful")
        return result
      } catch (popupError) {
        console.warn("Popup sign-in failed, falling back to redirect:", popupError)
        // Fall back to redirect if popup fails
        console.log("Starting Google sign-in redirect...")
        await signInWithRedirect(auth, provider)
      }

      return null
    } catch (error) {
      console.error("Google login error:", error)
      if (error.code) {
        console.error(`Error code: ${error.code}`)
      }
      throw error
    }
  }

  const logout = async () => {
    try {
      console.log("Logging out user")
      await signOut(auth)
      setUser(null)
    } catch (error) {
      console.error("Logout error:", error)
      throw error
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        loginWithEmail,
        loginWithUsername,
        loginWithGoogle,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider")
  }
  return context
}
