import { useRouter } from "next/router"
import { useEffect, useState } from "react"
import Image from "next/image"
import { useAuth } from "@/lib/auth-context"

export default function RejectionError() {
  const router = useRouter()
  const { error } = router.query
  const { user } = useAuth()
  const [redirectPath, setRedirectPath] = useState('/login')

  useEffect(() => {
    // Determine the correct redirect path based on user's assigned locations
    if (user) {
      if (user.assignedLocations && user.assignedLocations.length > 0) {
        // Redirect to the user's assigned location dashboard
        setRedirectPath(`/dashboard/location/${user.assignedLocations[0]}`)
      } else {
        // If no assigned locations, redirect to login
        setRedirectPath('/login')
      }
    }

    // Redirect after 5 seconds
    const timer = setTimeout(() => {
      router.push(redirectPath)
    }, 5000)

    return () => clearTimeout(timer)
  }, [router, user, redirectPath])

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <div className="mb-6">
          <Image
            src="/images/error.svg"
            alt="Error"
            width={120}
            height={120}
            className="mx-auto"
          />
        </div>
        
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Account Access Denied
        </h1>
        
        <p className="text-gray-600 mb-6">
          {error || "Your account is pending approval. Please wait for an administrator to approve your account."}
        </p>

        <button
          onClick={() => router.push(redirectPath)}
          className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition-colors"
        >
          Return to {user?.assignedLocations?.length > 0 ? 'Dashboard' : 'Login'}
        </button>
      </div>
    </div>
  )
} 
