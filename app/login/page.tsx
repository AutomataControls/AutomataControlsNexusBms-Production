"use client"

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
import { createUserWithEmailAndPassword, sendEmailVerification } from "firebase/auth"
import { auth } from "@/lib/firebase"
import { doc, setDoc, getFirestore } from "firebase/firestore"

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
  })
  const [isSigningUp, setIsSigningUp] = useState(false)
  const { user, loginWithEmail, loginWithUsername, loginWithGoogle } = useAuth()
  const router = useRouter()
  const { toast } = useToast()

  // Modified user check to prevent redirect loops
  useEffect(() => {
    // Add a console log to see what's happening
    console.log("Login page - User state:", !!user);

    // Only redirect if we have a valid user with an ID
    if (user && user.id) {
      console.log("Login page - Redirecting to dashboard with valid user");
      router.push("/dashboard");
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
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
    }
  }

  const handleGoogleLogin = async () => {
    try {
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
      const db = getFirestore()

      // Create user in Firebase Auth
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        signUpData.email,
        signUpData.password
      )
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
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      toast({
        title: "Success",
        description: "Please check your email to verify your account",
      })
      setIsSignUpOpen(false)
      setSignUpData({
        email: "",
        username: "",
        password: "",
        confirmPassword: "",
        name: "",
      })
    } catch (error: any) {
      console.error("Sign up error:", error)
      toast({
        title: "Error",
        description: error?.message || "Failed to create account",
        variant: "destructive",
      })
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
              <Image src="/neural-loader.png" alt="Automata Controls Logo" width={150} height={150} className="mr-6" />
              <div>
                <h1 className="font-cinzel text-4xl text-orange-300">Automata Controls</h1>
                <h2 className="text-2xl text-teal-200">Building Management System</h2>
              </div>
            </div>
            <CardTitle className="text-3xl text-amber-200/70 text-center">Login</CardTitle>
            <CardDescription className="text-lg text-teal-200/80 text-center">Enter your credentials to access the system</CardDescription>
          </CardHeader>
          <Tabs value={loginMethod} onValueChange={(value) => setLoginMethod(value as "email" | "username")} className="w-full">
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
                    className="flex-1 h-12 text-lg text-white font-medium bg-gradient-to-r from-teal-500/80 to-teal-100/80 hover:from-teal-500 hover:to-teal-100"
                  >
                    Login
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
                            {isSigningUp ? "Creating Account..." : "Sign Up"}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
                {/* Google sign-in section - temporarily disabled 
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
                      className="h-12 text-lg bg-gray-700 text-white hover:bg-gray-600"
                      onClick={handleGoogleLogin}
                    >
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
