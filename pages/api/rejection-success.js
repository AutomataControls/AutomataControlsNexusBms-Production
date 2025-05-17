import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { useAuth } from '@/lib/auth-context'

export default function RejectionSuccess() {
  const router = useRouter()
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
            src="/images/success.svg"
            alt="Success"
            width={120}
            height={120}
            className="mx-auto"
          />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-4">
          Account Rejected
        </h1>
        <p className="text-gray-600 mb-6">
          Your account has been rejected. Please contact the administrator for more information.
        </p>
        <p className="text-sm text-gray-500">
          You will be redirected in 5 seconds...
        </p>
      </div>
    </div>
  )
}
