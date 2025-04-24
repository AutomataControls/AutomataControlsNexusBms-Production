"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useAuth } from "@/lib/auth-context"
import { useToast } from "@/components/ui/use-toast"
import Image from "next/image"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { createUserWithEmailAndPassword, sendEmailVerification, fetchSignInMethodsForEmail } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { doc, setDoc, getFirestore } from "firebase/firestore"
import { collection, getDocs } from "firebase/firestore"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [loginMethod, setLoginMethod] = useState<"email" | "username">("email")
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [signUpData, setSignUpData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
    location: "",
  })
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false)
  const { user, loginWithEmail, loginWithUsername, loginWithGoogle } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [locations, setLocations] = useState<any[]>([])
  const db = getFirestore()
  const [hasAdminAccess, setHasAdminAccess] = useState<((roles: string[]) => boolean) | null>(null)

  useEffect(() => {
    const loadHasAdminAccess = async () => {
      try {
        const { hasEquipmentControlAccess } = await import("@/lib/role-utils")
        setHasAdminAccess(() => hasEquipmentControlAccess)
      } catch (error) {
        console.error("Failed to load hasAdminAccess:", error)
        toast({
          title: "Error",
          description: "Failed to load admin access function.",
          variant: "destructive",
        })
      }
    }

    loadHasAdminAccess()
  }, [toast])

  // Modified user check to redirect based on role, verification status, and assigned locations
  useEffect(() => {
    // Only proceed if we have loaded the hasAdminAccess function
    if (!hasAdminAccess) return

    if (user && user.id) {
      console.log("User check - User found:", user.email)
      console.log("User details:", {
        emailVerified: user.emailVerified,
        pending: user.pending,
        roles: user.roles,
        assignedLocations: user.assignedLocations,
      })

      // If the user's email is verified and they're not pending, proceed with role-based redirects
      if (user.emailVerified === true && user.pending === false) {
        console.log("User is verified and not pending, checking roles and locations")

        // If user has roles and permissions, proceed with role-based redirects
        if (Array.isArray(user.roles) && hasAdminAccess(user.roles)) {
          console.log("User check - User has admin access, redirecting to /dashboard")
          router.push("/dashboard")
        } else if (user.assignedLocations && user.assignedLocations.length > 0) {
          const locationId = user.assignedLocations[0]
          console.log(`User check - User has assigned locations, redirecting to /dashboard/location/${locationId}`)
          router.push(`/dashboard/location/${locationId}`)
        } else {
          console.log("User check - User has no admin access or assigned locations")
          // Users without admin access or assigned locations should not access the dashboard
          toast({
            title: "Access Restricted",
            description:
              "Your account doesn't have any assigned locations or sufficient permissions. Please contact your administrator.",
            variant: "destructive",
            duration: 6000,
          })
          // Sign the user out
          auth.signOut()
          return
        }
      } else {
        console.log("User's email is not verified or account is pending approval")
        toast({
          title: "Account Verification Required",
          description: user.emailVerified
            ? "Your account is pending approval. Please contact your administrator."
            : "Please verify your email before logging in. Check your inbox for a verification link.",
          variant: "destructive",
          duration: 6000,
        })
        // Sign the user out
        auth.signOut()
        return
      }
    }
  }, [user, router, hasAdminAccess, toast])

  useEffect(() => {
    const fetchLocations = async () => {
      if (!db) return

      try {
        const locationsRef = collection(db, "locations")
        const snapshot = await getDocs(locationsRef)
        const locationData = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }))
        setLocations(locationData)
      } catch (error) {
        console.error("Error fetching locations:", error)
      }
    }

    fetchLocations()
  }, [db])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoggingIn(true)

    try {
      if (loginMethod === "email") {
        await loginWithEmail(email, password)
      } else {
        await loginWithUsername(username, password)
      }
      // The useEffect will handle the redirect once user is set in auth context
    } catch (error: any) {
      console.error("Login error:", error)
      toast({
        title: "Authentication Error",
        description: error?.message || "Invalid credentials",
        variant: "destructive",
      })
    } finally {
      setIsLoggingIn(false)
    }
  }

  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoggingIn(true)
      // This will redirect to Google authentication
      await loginWithGoogle()
      // The redirect will happen, code after this won't execute immediately
    } catch (error: any) {
      console.error("Google login error:", error)
      toast({
        title: "Authentication Error",
        description: error?.message || "Failed to login with Google",
        variant: "destructive",
      })
      setIsGoogleLoggingIn(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (signUpData.password !== signUpData.confirmPassword) {
      toast({
        title: "Error",
        description: "Passwords do not match",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSigningUp(true)

      // First check if the email is already in use
      try {
        const methods = await fetchSignInMethodsForEmail(auth, signUpData.email)

        // If methods array has any entries, the email exists in Firebase Auth
        if (methods && methods.length > 0) {
          // Email exists but you can't see it in console - inform the user
          toast({
            title: "Email Issue Detected",
            description:
              "There appears to be an issue with this email address. Please try a different email or contact support.",
            variant: "destructive",
            duration: 8000,
          })
          return
        }
      } catch (checkError) {
        console.error("Error checking email:", checkError)
        // Continue with signup attempt even if check fails
      }

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(auth, signUpData.email, signUpData.password)
      const user = userCredential.user

      // Send email verification
      await sendEmailVerification(user)

      // Create user document in Firestore
      await setDoc(doc(db, "users", user.uid), {
        email: signUpData.email,
        username: signUpData.username,
        name: signUpData.name,
        roles: ["user"],
        emailVerified: false,
        pending: true, // Add this flag to mark the user as pending verification
        assignedLocations: signUpData.location ? [signUpData.location] : [],
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      // Send welcome email
      try {
        const locationObj = locations.find((loc) => loc.id === signUpData.location)
        const locationName = locationObj ? locationObj.name : undefined

        await fetch("/api/send-signup-email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: signUpData.name,
            email: signUpData.email,
            username: signUpData.username,
            location: signUpData.location,
            locationName: locationName,
          }),
        })
      } catch (emailError) {
        console.error("Error sending welcome email:", emailError)
        // Don't fail the signup if email fails
      }

      // Sign out the user immediately after signup to prevent auto-login
      await auth.signOut()

      toast({
        title: "Account Created Successfully",
        description: "Please check your email to verify your account before logging in.",
        duration: 6000, // Show this message longer
      })
      setIsSignUpOpen(false)
      setSignUpData({
        email: "",
        username: "",
        password: "",
        confirmPassword: "",
        name: "",
        location: "",
      })
    } catch (error: any) {
      console.error("Sign up error:", error)

      // Provide specific message for email-already-in-use error
      if (error.code === "auth/email-already-in-use") {
        toast({
          title: "Email Registration Issue",
          description:
            "There appears to be an issue with this email address. Please try a different email or contact support.",
          variant: "destructive",
          duration: 8000,
        })
      } else {
        // Handle other errors
        toast({
          title: "Error",
          description: error?.message || "Failed to create account",
          variant: "destructive",
        })
      }
    } finally {
      setIsSigningUp(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-zinc-900">
      <div className="w-full max-w-2xl px-4">
        <Card className="w-full bg-gray-800 border-gray-700">
          <CardHeader className="space-y-4">
            <div className="flex items-center justify-center mb-6">
              <Image
                src="/neural-loader.png"
                alt="Automata Controls Logo"
                width={150}
                height={150}
                className="mr-6"
                priority
              />
              <div>
                <h1 className="font-cinzel text-4xl text-orange-300">Automata Controls</h1>
                <h2 className="text-2xl text-teal-200">Building Management System</h2>
              </div>
            </div>
            <CardTitle className="text-3xl text-amber-200/70 text-center">Login</CardTitle>
            <CardDescription className="text-lg text-teal-200/80 text-center">
              Enter your credentials to access the system
            </CardDescription>
          </CardHeader>
          <Tabs
            value={loginMethod}
            onValueChange={(value) => {
              setLoginMethod(value as "email" | "username")
            }}
            className="w-full"
          >
            <TabsList className="grid w-full grid-cols-2 h-10 mb-4 bg-gray-700">
              <TabsTrigger
                value="email"
                className="text-base data-[state=active]:bg-teal-500/10 data-[state=active]:text-teal-200 data-[state=active]:border-b-2 data-[state=active]:border-teal-500/50"
              >
                Email
              </TabsTrigger>
              <TabsTrigger
                value="username"
                className="text-base data-[state=active]:bg-teal-500/10 data-[state=active]:text-teal-200 data-[state=active]:border-b-2 data-[state=active]:border-teal-500/50"
              >
                Username
              </TabsTrigger>
            </TabsList>
            <form onSubmit={handleLogin}>
              <CardContent className="space-y-6 pt-6">
                <TabsContent value="email">
                  <div className="space-y-3">
                    <Label htmlFor="email" className="text-lg text-amber-200/60">
                      Email
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-12 text-lg bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                    />
                  </div>
                </TabsContent>
                <TabsContent value="username">
                  <div className="space-y-3">
                    <Label htmlFor="username" className="text-lg text-amber-200/60">
                      Username
                    </Label>
                    <Input
                      id="username"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="h-12 text-lg bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                    />
                  </div>
                </TabsContent>
                <div className="space-y-3">
                  <Label htmlFor="password" className="text-lg text-amber-200/60">
                    Password
                  </Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="h-12 text-lg bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col space-y-6 pt-6">
                <div className="flex justify-between w-full gap-4">
                  <Button
                    type="submit"
                    disabled={isLoggingIn}
                    className="flex-1 h-12 text-lg text-white font-medium bg-gradient-to-r from-teal-500/80 to-teal-100/80 hover:from-teal-500 hover:to-teal-100"
                  >
                    {isLoggingIn ? (
                      <div className="flex items-center">
                        <svg
                          className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                          xmlns="http://www.w3.org/2000/svg"
                          fill="none"
                          viewBox="0 0 24 24"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          ></circle>
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                          ></path>
                        </svg>
                        Logging in...
                      </div>
                    ) : (
                      "Login"
                    )}
                  </Button>
                  <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 text-lg bg-gray-700 text-white hover:bg-gray-600"
                      >
                        Sign Up
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-gray-800 border-gray-700 max-w-2xl">
                      <DialogHeader>
                        <DialogTitle className="text-2xl text-amber-200/70">Create Account</DialogTitle>
                        <DialogDescription className="text-lg text-teal-200/80">
                          Fill in your details to create a new account
                        </DialogDescription>
                      </DialogHeader>
                      <form onSubmit={handleSignUp} className="space-y-6">
                        <div className="space-y-3">
                          <Label htmlFor="signup-name" className="text-lg text-amber-200/60">
                            Full Name
                          </Label>
                          <Input
                            id="signup-name"
                            value={signUpData.name}
                            onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                            required
                            className="h-12 text-lg bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                          />
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="signup-username" className="text-lg text-amber-200/60">
                            Username
                          </Label>
                          <Input
                            id="signup-username"
                            value={signUpData.username}
                            onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
                            required
                            className="h-12 text-lg bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                          />
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="signup-location" className="text-lg text-amber-200/60">
                            Location
                          </Label>
                          <select
                            id="signup-location"
                            value={signUpData.location}
                            onChange={(e) => setSignUpData({ ...signUpData, location: e.target.value })}
                            className="h-12 text-lg bg-gray-700 border-gray-600 text-white w-full rounded-md px-3"
                          >
                            <option value="">Select a location</option>
                            {locations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="signup-email" className="text-lg text-amber-200/60">
                            Email
                          </Label>
                          <Input
                            id="signup-email"
                            type="email"
                            value={signUpData.email}
                            onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                            required
                            className="h-12 text-lg bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                          />
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="signup-password" className="text-lg text-amber-200/60">
                            Password
                          </Label>
                          <Input
                            id="signup-password"
                            type="password"
                            value={signUpData.password}
                            onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                            required
                            className="h-12 text-lg bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                          />
                        </div>
                        <div className="space-y-3">
                          <Label htmlFor="signup-confirm-password" className="text-lg text-amber-200/60">
                            Confirm Password
                          </Label>
                          <Input
                            id="signup-confirm-password"
                            type="password"
                            value={signUpData.confirmPassword}
                            onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                            required
                            className="h-12 text-lg bg-gray-700 border-gray-600 text-white placeholder:text-gray-400"
                          />
                        </div>
                        <DialogFooter>
                          <Button
                            type="submit"
                            disabled={isSigningUp}
                            className="w-full h-12 text-lg text-white font-medium bg-gradient-to-r from-teal-500/80 to-teal-100/80 hover:from-teal-500 hover:to-teal-100"
                          >
                            {isSigningUp ? (
                              <div className="flex items-center justify-center">
                                <svg
                                  className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                                  xmlns="http://www.w3.org/2000/svg"
                                  fill="none"
                                  viewBox="0 0 24 24"
                                >
                                  <circle
                                    className="opacity-25"
                                    cx="12"
                                    cy="12"
                                    r="10"
                                    stroke="currentColor"
                                    strokeWidth="4"
                                  ></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                Creating Account...
                              </div>
                            ) : (
                              "Sign Up"
                            )}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="w-full space-y-4">
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-gray-600"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-gray-800 px-2 text-gray-400">Or continue with</span>
                    </div>
                  </div>
                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isGoogleLoggingIn}
                      className="h-12 text-lg bg-gray-700 text-white hover:bg-gray-600"
                      onClick={handleGoogleLogin}
                    >
                      {isGoogleLoggingIn ? (
                        <div className="flex items-center">
                          <svg
                            className="animate-spin -ml-1 mr-3 h-5 w-5 text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                          Connecting to Google...
                        </div>
                      ) : (
                        <>
                          <svg className="mr-2 h-5 w-5" viewBox="0 0 24 24">
                            <path
                              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                              fill="#4285F4"
                            />
                            <path
                              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                              fill="#34A853"
                            />
                            <path
                              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                              fill="#FBBC05"
                            />
                            <path
                              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                              fill="#EA4335"
                            />
                          </svg>
                          Continue with Google
                        </>
                      )}
                    </Button>
                  </div>
                </div>
              </CardFooter>
            </form>
          </Tabs>
        </Card>
      </div>
    </div>
  )
}
