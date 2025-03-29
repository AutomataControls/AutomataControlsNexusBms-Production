"use client"

import type React from "react"
import { createContext, useContext, useState, useEffect } from "react"
import { auth } from "./firebase"
import {
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  getRedirectResult,
  signInWithRedirect,
  signInWithEmailAndPassword as signInWithEmail
} from "firebase/auth"
import { doc, getDoc, getFirestore, collection, query, where, getDocs, setDoc } from "firebase/firestore"


interface User {
  id: string
  username: string
  name: string
  email: string
  roles: string[]
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

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const db = getFirestore()

  useEffect(() => {
    const handleRedirectResult = async () => {
      try {
        // Check for redirect result when the component mounts
        const result = await getRedirectResult(auth)
        if (result) {
          const firebaseUser = result.user
          // Get additional user data from Firestore
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))
          if (!userDoc.exists()) {
            // Create new user document for Google sign-in
            await setDoc(doc(db, "users", firebaseUser.uid), {
              username: firebaseUser.email,
              name: firebaseUser.displayName || "",
              email: firebaseUser.email,
              roles: ["user"],
              createdAt: new Date(),
              updatedAt: new Date(),
            })
          }

          const userData = userDoc.exists() ? userDoc.data() : {
            username: firebaseUser.email,
            name: firebaseUser.displayName || "",
            roles: ["user"]
          }

          setUser({
            id: firebaseUser.uid,
            username: userData.username || firebaseUser.email || "",
            name: userData.name || firebaseUser.displayName || "",
            email: firebaseUser.email || "",
            roles: userData.roles || ["user"],
          })
        }
      } catch (error) {
        console.error("Google redirect result error:", error)
      }
    }

    handleRedirectResult()

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Get additional user data from Firestore
          const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))
          if (userDoc.exists()) {
            const userData = userDoc.data()
            setUser({
              id: firebaseUser.uid,
              username: userData.username || firebaseUser.email || "",
              name: userData.name || "",
              email: firebaseUser.email || "",
              roles: userData.roles || ["user"],
            })
          } else {
            // Create a new user document if it doesn't exist
            const username = firebaseUser.email.split('@')[0] // Use part before @ as username
            await setDoc(doc(db, "users", firebaseUser.uid), {
              username: username,
              name: firebaseUser.displayName || "",
              email: firebaseUser.email,
              roles: ["user"],
              createdAt: new Date(),
              updatedAt: new Date(),
            })
            setUser({
              id: firebaseUser.uid,
              username: username,
              name: firebaseUser.displayName || "",
              email: firebaseUser.email || "",
              roles: ["user"],
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
    try {
      const userCredential = await signInWithEmail(auth, email, password)
      const firebaseUser = userCredential.user

      // Get additional user data from Firestore
      const userDoc = await getDoc(doc(db, "users", firebaseUser.uid))
      if (userDoc.exists()) {
        const userData = userDoc.data()
        setUser({
          id: firebaseUser.uid,
          username: userData.username || firebaseUser.email || "",
          name: userData.name || "",
          email: firebaseUser.email || "",
          roles: userData.roles || ["user"],
        })
      } else {
        // Create a new user document if it doesn't exist
        const username = email.split('@')[0] // Use part before @ as username
        await setDoc(doc(db, "users", firebaseUser.uid), {
          username: username,
          name: firebaseUser.displayName || "",
          email: firebaseUser.email,
          roles: ["user"],
          createdAt: new Date(),
          updatedAt: new Date(),
        })
        setUser({
          id: firebaseUser.uid,
          username: username,
          name: firebaseUser.displayName || "",
          email: firebaseUser.email || "",
          roles: ["user"],
        })
      }
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  const loginWithUsername = async (username: string, password: string) => {
    try {
      // First, find the user by username in Firestore
      const usersRef = collection(db, "users")
      const q = query(usersRef, where("username", "==", username))
      const querySnapshot = await getDocs(q)

      if (querySnapshot.empty) {
        throw new Error("User not found")
      }

      const userData = querySnapshot.docs[0].data()

      // Now login with the associated email
      return loginWithEmail(userData.email, password)
    } catch (error) {
      console.error("Login error:", error)
      throw error
    }
  }

  const loginWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      
      // Use the current domain for redirect
      const redirectUri = typeof window !== 'undefined' 
        ? `${window.location.protocol}//${window.location.host}/__/auth/handler` 
        : 'https://neuralbms.automatacontrols.com/__/auth/handler';
      
      console.log("Google Auth redirect URI:", redirectUri);
      
      // Configure Firebase auth settings
      auth.useDeviceLanguage();
      
      // Add parameters to the auth provider
      provider.setCustomParameters({
        prompt: 'select_account',
        redirect_uri: redirectUri
      });
      
      // Use redirect for the auth flow
      console.log("Starting Google sign-in redirect...");
      await signInWithRedirect(auth, provider);
      
      return null;
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
        logout
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
