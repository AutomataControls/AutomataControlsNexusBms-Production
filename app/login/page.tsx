"use client"

// Add this at the very top of your login page.tsx file
export const dynamic = 'force-dynamic'

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
import { Progress } from "@/components/ui/progress"
import { Alert, AlertDescription } from "@/components/ui/alert"
import {
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  MapPin,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
  Building,
  Shield,
  Zap,
} from "lucide-react"
import { createUserWithEmailAndPassword, sendEmailVerification, fetchSignInMethodsForEmail, sendPasswordResetEmail } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { doc, setDoc, getFirestore } from "firebase/firestore"
import { collection, getDocs } from "firebase/firestore"

interface PasswordStrength {
  score: number
  feedback: string[]
  color: string
}

export default function EnhancedLoginPage() {
  const [email, setEmail] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loginMethod, setLoginMethod] = useState<"email" | "username">("email")
  const [isSignUpOpen, setIsSignUpOpen] = useState(false)
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false)
  const [forgotPasswordEmail, setForgotPasswordEmail] = useState("")
  const [signUpData, setSignUpData] = useState({
    email: "",
    username: "",
    password: "",
    confirmPassword: "",
    name: "",
    location: "",
  })
  const [showSignUpPassword, setShowSignUpPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [isSigningUp, setIsSigningUp] = useState(false)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [isGoogleLoggingIn, setIsGoogleLoggingIn] = useState(false)
  const [isSendingReset, setIsSendingReset] = useState(false)
  const [formErrors, setFormErrors] = useState<Record<string, string>>({})
  const { user, loginWithEmail, loginWithUsername, loginWithGoogle } = useAuth()
  const router = useRouter()
  const { toast } = useToast()
  const [locations, setLocations] = useState<any[]>([])
  const db = getFirestore()
  const [hasAdminAccess, setHasAdminAccess] = useState<((roles: string[]) => boolean) | null>(null)
  const [isMounted, setIsMounted] = useState(false)

  // Add mounted state to prevent hydration mismatches
  useEffect(() => {
    setIsMounted(true)
  }, [])

  useEffect(() => {
    const loadHasAdminAccess = async () => {
      try {
        const { hasEquipmentControlAccess } = await import("@/lib/role-utils")
        setHasAdminAccess(() => hasEquipmentControlAccess)
      } catch (error) {
        console.error("Failed to load hasAdminAccess:", error)
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to load admin access function.",
            variant: "destructive",
          })
        }
      }
    }

    if (isMounted) {
      loadHasAdminAccess()
    }
  }, [toast, isMounted])

  // Modified user check to redirect based on role, verification status, and assigned locations
  useEffect(() => {
    // Only proceed if we have loaded the hasAdminAccess function and component is mounted
    if (!hasAdminAccess || !isMounted) return

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
          toast({
            title: "Login Successful",
            description: "Welcome back! Redirecting to dashboard...",
          })
          router.push("/dashboard")
        } else if (user.assignedLocations && user.assignedLocations.length > 0) {
          const locationId = user.assignedLocations[0]
          console.log(`User check - User has assigned locations, redirecting to /dashboard/location/${locationId}`)
          toast({
            title: "Login Successful",
            description: `Welcome back! Redirecting to location...`,
          })
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
  }, [user, router, hasAdminAccess, toast, isMounted])

  useEffect(() => {
    const fetchLocations = async () => {
      if (!db || !isMounted) return

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

    if (isMounted) {
      fetchLocations()
    }
  }, [db, isMounted])

  // Password strength checker
  const checkPasswordStrength = (password: string): PasswordStrength => {
    let score = 0
    const feedback: string[] = []

    if (password.length >= 8) score += 1
    else feedback.push("At least 8 characters")

    if (/[a-z]/.test(password)) score += 1
    else feedback.push("Lowercase letter")

    if (/[A-Z]/.test(password)) score += 1
    else feedback.push("Uppercase letter")

    if (/\d/.test(password)) score += 1
    else feedback.push("Number")

    if (/[^a-zA-Z\d]/.test(password)) score += 1
    else feedback.push("Special character")

    const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-blue-500", "bg-green-500"]
    return {
      score,
      feedback,
      color: colors[score] || "bg-gray-500",
    }
  }

  const passwordStrength = checkPasswordStrength(signUpData.password)

  // Form validation
  const validateForm = (data: typeof signUpData): Record<string, string> => {
    const errors: Record<string, string> = {}

    if (!data.name.trim()) errors.name = "Full name is required"
    if (!data.username.trim()) errors.username = "Username is required"
    if (data.username.length < 3) errors.username = "Username must be at least 3 characters"
    if (!data.email.trim()) errors.email = "Email is required"
    if (!/\S+@\S+\.\S+/.test(data.email)) errors.email = "Email is invalid"
    if (!data.password) errors.password = "Password is required"
    if (passwordStrength.score < 3) errors.password = "Password is too weak"
    if (data.password !== data.confirmPassword) errors.confirmPassword = "Passwords do not match"
    if (!data.location) errors.location = "Location is required"

    return errors
  }

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

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!forgotPasswordEmail) {
      toast({
        title: "Error",
        description: "Please enter your email address",
        variant: "destructive",
      })
      return
    }

    try {
      setIsSendingReset(true)
      await sendPasswordResetEmail(auth, forgotPasswordEmail)
      toast({
        title: "Password Reset Email Sent",
        description: "Check your email for password reset instructions.",
        duration: 6000,
      })
      setIsForgotPasswordOpen(false)
      setForgotPasswordEmail("")
    } catch (error: any) {
      console.error("Password reset error:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to send password reset email",
        variant: "destructive",
      })
    } finally {
      setIsSendingReset(false)
    }
  }

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault()

    const errors = validateForm(signUpData)
    setFormErrors(errors)

    if (Object.keys(errors).length > 0) {
      toast({
        title: "Validation Error",
        description: "Please fix the errors in the form",
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
      setFormErrors({})
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

  // Show loading state until component is mounted
  if (!isMounted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="w-full max-w-3xl">
          <Card className="bg-white border shadow-2xl overflow-hidden">
            <CardHeader className="space-y-6 pb-8">
              <div className="flex items-center justify-center mb-8">
                <div className="w-[120px] h-[120px] bg-gray-200 animate-pulse rounded-full mr-8"></div>
                <div>
                  <div className="h-10 bg-gray-200 animate-pulse rounded mb-2 w-80"></div>
                  <div className="h-6 bg-gray-200 animate-pulse rounded w-64"></div>
                </div>
              </div>
              <div className="text-center space-y-4">
                <div className="h-10 bg-gray-200 animate-pulse rounded w-48 mx-auto"></div>
                <div className="h-6 bg-gray-200 animate-pulse rounded w-64 mx-auto"></div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="h-12 bg-gray-200 animate-pulse rounded"></div>
              <div className="h-12 bg-gray-200 animate-pulse rounded"></div>
              <div className="h-12 bg-gray-200 animate-pulse rounded"></div>
            </CardContent>
            <CardFooter className="space-y-4">
              <div className="flex gap-4 w-full">
                <div className="h-12 bg-gray-200 animate-pulse rounded flex-1"></div>
                <div className="h-12 bg-gray-200 animate-pulse rounded w-32"></div>
              </div>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        <Card className="bg-white border shadow-2xl">
          <CardHeader className="space-y-6 pb-8">
            {/* Logo Section */}
            <div className="flex items-center justify-center mb-8">
              <div className="relative">
                <div className="bg-white rounded-full p-4 shadow-md animate-float">
                  <Image
                    src="/neural-loader.png"
                    alt="Automata Controls Neural Network"
                    width={120}
                    height={120}
                    className="drop-shadow-sm"
                    priority
                  />
                </div>
              </div>
              <div className="ml-8">
                <h1 className="font-cinzel text-4xl font-bold text-[#14b8a6] drop-shadow-md">AUTOMATA CONTROLS</h1>
                <p className="text-xl text-[#fb923c] font-light tracking-wide drop-shadow-sm">
                  Building Management System
                </p>
              </div>
            </div>

            {/* Welcome Back Section */}
            <div className="text-center space-y-4 relative">
              <div className="relative inline-block">
                <CardTitle className="text-4xl font-cinzel font-bold text-slate-800 relative z-10">
                  Welcome Back
                </CardTitle>
                <div className="absolute inset-0 bg-gradient-to-r from-[#14b8a6]/20 via-transparent to-[#fb923c]/20 blur-xl transform scale-110"></div>
              </div>
              <div className="max-w-md mx-auto">
                <CardDescription className="text-lg text-slate-600 leading-relaxed font-medium">
                  Access your intelligent building management dashboard
                </CardDescription>
                <div className="mt-3 flex items-center justify-center gap-2">
                  <div className="h-px bg-gradient-to-r from-transparent via-[#14b8a6]/50 to-transparent flex-1"></div>
                  <div className="w-2 h-2 rounded-full bg-[#14b8a6]/30"></div>
                  <div className="h-px bg-gradient-to-r from-transparent via-[#fb923c]/50 to-transparent flex-1"></div>
                </div>
              </div>
            </div>

            {/* Feature Pills */}
            <div className="flex justify-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 bg-[#14b8a6]/10 text-[#14b8a6] px-3 py-1 rounded-full text-sm font-medium">
                <Building className="w-4 h-4" />
                Smart Controls
              </div>
              <div className="flex items-center gap-2 bg-[#fb923c]/10 text-[#fb923c] px-3 py-1 rounded-full text-sm font-medium">
                <Zap className="w-4 h-4" />
                Real-time Monitoring
              </div>
              <div className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1 rounded-full text-sm font-medium">
                <Shield className="w-4 h-4" />
                Secure Access
              </div>
            </div>
          </CardHeader>

          <Tabs
            value={loginMethod}
            onValueChange={(value) => {
              setLoginMethod(value as "email" | "username")
            }}
            className="w-full px-0"
          >
            <TabsList className="grid w-full grid-cols-2 h-8 mb-4 bg-slate-100 mx-8 max-w-none">
              <TabsTrigger
                value="email"
                className="text-xs px-2 data-[state=active]:bg-white data-[state=active]:text-[#14b8a6] data-[state=active]:shadow-sm transition-all duration-200"
              >
                <Mail className="w-3 h-3 mr-1" />
                Email
              </TabsTrigger>
              <TabsTrigger
                value="username"
                className="text-xs px-2 data-[state=active]:bg-white data-[state=active]:text-[#14b8a6] data-[state=active]:shadow-sm transition-all duration-200"
              >
                <User className="w-3 h-3 mr-1" />
                Username
              </TabsTrigger>
            </TabsList>

            <form onSubmit={handleLogin}>
              <CardContent className="space-y-4 px-6 pb-0">
                <TabsContent value="email" className="mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="email" className="text-sm font-medium text-slate-700 flex items-center">
                      <Mail className="w-3 h-3 mr-1 text-[#14b8a6]" />
                      Email Address
                    </Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="Enter your email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      className="h-10 text-sm border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]/20 transition-colors"
                    />
                  </div>
                </TabsContent>

                <TabsContent value="username" className="mt-0">
                  <div className="space-y-2">
                    <Label htmlFor="username" className="text-sm font-medium text-slate-700 flex items-center">
                      <User className="w-3 h-3 mr-1 text-[#14b8a6]" />
                      Username
                    </Label>
                    <Input
                      id="username"
                      placeholder="Enter your username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      className="h-10 text-sm border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]/20 transition-colors"
                    />
                  </div>
                </TabsContent>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="password" className="text-sm font-medium text-slate-700 flex items-center">
                      <Lock className="w-3 h-3 mr-1 text-[#14b8a6]" />
                      Password
                    </Label>
                    <Button
                      type="button"
                      variant="link"
                      className="text-[#fb923c] hover:text-[#fb923c]/80 p-0 h-auto text-xs font-medium"
                      onClick={() => setIsForgotPasswordOpen(true)}
                    >
                      Forgot password?
                    </Button>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      placeholder="Enter your password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      className="h-10 text-sm border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]/20 transition-colors pr-10"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 p-0 hover:bg-slate-100"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-3 w-3 text-slate-500" />
                      ) : (
                        <Eye className="h-3 w-3 text-slate-500" />
                      )}
                      <span className="sr-only">Toggle password visibility</span>
                    </Button>
                  </div>
                </div>
              </CardContent>

              <CardFooter className="flex flex-col space-y-4 px-6 pb-6 pt-4">
                <div className="flex justify-between w-full gap-4">
                  <Button
                    type="submit"
                    disabled={isLoggingIn}
                    className="flex-1 h-10 text-sm font-medium bg-[#14b8a6]/80 hover:bg-[#14b8a6] text-white shadow-md transition-all duration-200"
                  >
                    {isLoggingIn ? (
                      <div className="flex items-center">
                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                        Signing in...
                      </div>
                    ) : (
                      "Sign In"
                    )}
                  </Button>

                  <Dialog open={isSignUpOpen} onOpenChange={setIsSignUpOpen}>
                    <DialogTrigger asChild>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-10 text-sm border-[#fb923c] text-[#fb923c] hover:bg-[#fb923c]/10 hover:text-black transition-all duration-200"
                      >
                        Create Account
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="bg-white border shadow-xl max-w-3xl max-h-[90vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-cinzel font-semibold text-slate-800">
                          Create New Account
                        </DialogTitle>
                        <DialogDescription className="text-base text-slate-600">
                          Join the Automata Controls Building Management System
                        </DialogDescription>
                      </DialogHeader>

                      <form onSubmit={handleSignUp} className="space-y-6">
                        <div className="space-y-3">
                          <Label
                            htmlFor="signup-name"
                            className="text-base font-medium text-slate-700 flex items-center"
                          >
                            <User className="w-4 h-4 mr-2 text-[#14b8a6]" />
                            Full Name *
                          </Label>
                          <Input
                            id="signup-name"
                            value={signUpData.name}
                            onChange={(e) => setSignUpData({ ...signUpData, name: e.target.value })}
                            required
                            className="h-12 text-base border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]/20 transition-colors"
                          />
                          {formErrors.name && (
                            <p className="text-red-500 text-sm flex items-center">
                              <XCircle className="w-4 h-4 mr-1" />
                              {formErrors.name}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label
                            htmlFor="signup-username"
                            className="text-base font-medium text-slate-700 flex items-center"
                          >
                            <User className="w-4 h-4 mr-2 text-[#14b8a6]" />
                            Username *
                          </Label>
                          <Input
                            id="signup-username"
                            value={signUpData.username}
                            onChange={(e) => setSignUpData({ ...signUpData, username: e.target.value })}
                            required
                            className="h-12 text-base border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]/20 transition-colors"
                          />
                          {formErrors.username && (
                            <p className="text-red-500 text-sm flex items-center">
                              <XCircle className="w-4 h-4 mr-1" />
                              {formErrors.username}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label
                            htmlFor="signup-email"
                            className="text-base font-medium text-slate-700 flex items-center"
                          >
                            <Mail className="w-4 h-4 mr-2 text-[#14b8a6]" />
                            Email Address *
                          </Label>
                          <Input
                            id="signup-email"
                            type="email"
                            value={signUpData.email}
                            onChange={(e) => setSignUpData({ ...signUpData, email: e.target.value })}
                            required
                            className="h-12 text-base border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]/20 transition-colors"
                          />
                          {formErrors.email && (
                            <p className="text-red-500 text-sm flex items-center">
                              <XCircle className="w-4 h-4 mr-1" />
                              {formErrors.email}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label
                            htmlFor="signup-location"
                            className="text-base font-medium text-slate-700 flex items-center"
                          >
                            <MapPin className="w-4 h-4 mr-2 text-[#14b8a6]" />
                            Location *
                          </Label>
                          <select
                            id="signup-location"
                            value={signUpData.location}
                            onChange={(e) => setSignUpData({ ...signUpData, location: e.target.value })}
                            className="h-12 text-base border border-slate-200 rounded-md px-3 w-full focus:border-[#14b8a6] focus:ring-2 focus:ring-[#14b8a6]/20 transition-colors"
                          >
                            <option value="">Select a location</option>
                            {locations.map((location) => (
                              <option key={location.id} value={location.id}>
                                {location.name}
                              </option>
                            ))}
                          </select>
                          {formErrors.location && (
                            <p className="text-red-500 text-sm flex items-center">
                              <XCircle className="w-4 h-4 mr-1" />
                              {formErrors.location}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label
                            htmlFor="signup-password"
                            className="text-base font-medium text-slate-700 flex items-center"
                          >
                            <Lock className="w-4 h-4 mr-2 text-[#14b8a6]" />
                            Password *
                          </Label>
                          <div className="relative">
                            <Input
                              id="signup-password"
                              type={showSignUpPassword ? "text" : "password"}
                              value={signUpData.password}
                              onChange={(e) => setSignUpData({ ...signUpData, password: e.target.value })}
                              required
                              className="h-12 text-base border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]/20 transition-colors pr-12"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-100"
                              onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                            >
                              {showSignUpPassword ? (
                                <EyeOff className="h-4 w-4 text-slate-500" />
                              ) : (
                                <Eye className="h-4 w-4 text-slate-500" />
                              )}
                            </Button>
                          </div>

                          {signUpData.password && (
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-slate-600">Password strength:</span>
                                <span
                                  className={`font-medium ${
                                    passwordStrength.score < 2
                                      ? "text-red-500"
                                      : passwordStrength.score < 4
                                        ? "text-yellow-500"
                                        : "text-green-500"
                                  }`}
                                >
                                  {passwordStrength.score < 2
                                    ? "Weak"
                                    : passwordStrength.score < 4
                                      ? "Medium"
                                      : "Strong"}
                                </span>
                              </div>
                              <Progress value={(passwordStrength.score / 5) * 100} className="h-2" />
                              {passwordStrength.feedback.length > 0 && (
                                <div className="text-sm text-slate-500">
                                  Missing: {passwordStrength.feedback.join(", ")}
                                </div>
                              )}
                            </div>
                          )}

                          {formErrors.password && (
                            <p className="text-red-500 text-sm flex items-center">
                              <XCircle className="w-4 h-4 mr-1" />
                              {formErrors.password}
                            </p>
                          )}
                        </div>

                        <div className="space-y-3">
                          <Label
                            htmlFor="signup-confirm-password"
                            className="text-base font-medium text-slate-700 flex items-center"
                          >
                            <Lock className="w-4 h-4 mr-2 text-[#14b8a6]" />
                            Confirm Password *
                          </Label>
                          <div className="relative">
                            <Input
                              id="signup-confirm-password"
                              type={showConfirmPassword ? "text" : "password"}
                              value={signUpData.confirmPassword}
                              onChange={(e) => setSignUpData({ ...signUpData, confirmPassword: e.target.value })}
                              required
                              className="h-12 text-base border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]/20 transition-colors pr-12"
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 p-0 hover:bg-slate-100"
                              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                            >
                              {showConfirmPassword ? (
                                <EyeOff className="h-4 w-4 text-slate-500" />
                              ) : (
                                <Eye className="h-4 w-4 text-slate-500" />
                              )}
                            </Button>
                          </div>

                          {signUpData.confirmPassword && signUpData.password !== signUpData.confirmPassword && (
                            <p className="text-red-500 text-sm flex items-center">
                              <XCircle className="w-4 h-4 mr-1" />
                              Passwords do not match
                            </p>
                          )}

                          {signUpData.confirmPassword && signUpData.password === signUpData.confirmPassword && (
                            <p className="text-green-500 text-sm flex items-center">
                              <CheckCircle className="w-4 h-4 mr-1" />
                              Passwords match
                            </p>
                          )}

                          {formErrors.confirmPassword && (
                            <p className="text-red-500 text-sm flex items-center">
                              <XCircle className="w-4 h-4 mr-1" />
                              {formErrors.confirmPassword}
                            </p>
                          )}
                        </div>

                        <Alert className="bg-blue-50 border-blue-200">
                          <AlertCircle className="h-4 w-4 text-blue-600" />
                          <AlertDescription className="text-blue-800">
                            Your account will require email verification and administrator approval before you can
                            access the system.
                          </AlertDescription>
                        </Alert>

                        <DialogFooter>
                          <Button
                            type="submit"
                            disabled={isSigningUp || Object.keys(validateForm(signUpData)).length > 0}
                            className="w-full h-12 text-base font-medium bg-[#fb923c]/80 hover:bg-[#fb923c] text-white shadow-md transition-all duration-200"
                          >
                            {isSigningUp ? (
                              <div className="flex items-center justify-center">
                                <Loader2 className="animate-spin -ml-1 mr-3 h-5 w-5" />
                                Creating Account...
                              </div>
                            ) : (
                              "Create Account"
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
                      <span className="w-full border-t border-slate-200"></span>
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-white px-2 text-slate-500 font-medium">Or continue with</span>
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={isGoogleLoggingIn}
                      className="h-10 text-sm border-slate-200 hover:bg-slate-50 transition-all duration-200 shadow-sm"
                      onClick={handleGoogleLogin}
                    >
                      {isGoogleLoggingIn ? (
                        <div className="flex items-center">
                          <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                          Connecting...
                        </div>
                      ) : (
                        <>
                          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
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

      {/* Forgot Password Dialog */}
      <Dialog open={isForgotPasswordOpen} onOpenChange={setIsForgotPasswordOpen}>
        <DialogContent className="bg-white border shadow-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl font-cinzel font-semibold text-slate-800">Reset Password</DialogTitle>
            <DialogDescription className="text-base text-slate-600">
              Enter your email address and we'll send you a password reset link.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleForgotPassword} className="space-y-6">
            <div className="space-y-3">
              <Label htmlFor="forgot-email" className="text-base font-medium text-slate-700 flex items-center">
                <Mail className="w-4 h-4 mr-2 text-[#14b8a6]" />
                Email Address
              </Label>
              <Input
                id="forgot-email"
                type="email"
                placeholder="Enter your email"
                value={forgotPasswordEmail}
                onChange={(e) => setForgotPasswordEmail(e.target.value)}
                required
                className="h-12 text-base border-slate-200 focus:border-[#14b8a6] focus:ring-[#14b8a6]/20 transition-colors"
              />
            </div>

            <DialogFooter className="flex gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsForgotPasswordOpen(false)}
                className="border-slate-200 hover:bg-slate-50"
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSendingReset} className="bg-[#14b8a6] hover:bg-[#14b8a6]/90 text-white">
                {isSendingReset ? (
                  <div className="flex items-center">
                    <Loader2 className="animate-spin -ml-1 mr-3 h-4 w-4" />
                    Sending...
                  </div>
                ) : (
                  "Send Reset Link"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
