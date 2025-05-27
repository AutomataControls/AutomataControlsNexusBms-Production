// components/navigation-progress.tsx
"use client"

import { Suspense } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

// Separate the component that uses useSearchParams
function NavigationProgressContent() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isNavigating, setIsNavigating] = useState(false)

  useEffect(() => {
    // Start progress
    setIsNavigating(true)
    // Complete after delay
    const timer = setTimeout(() => {
      setIsNavigating(false)
    }, 500)
    return () => clearTimeout(timer)
  }, [pathname, searchParams])

  if (!isNavigating) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50">
      <div className="h-1 bg-gradient-to-r from-orange-100/20 via-teal-400 to-emerald-400 animate-[loading_2s_ease-in-out_infinite] shadow-sm"></div>
      <style jsx>{`
        @keyframes loading {
          0% { 
            width: 0%; 
            background: linear-gradient(90deg, rgba(255, 237, 213, 0.3), rgba(45, 212, 191, 0.8), rgba(52, 211, 153, 0.8));
          }
          20% { 
            width: 20%; 
            background: linear-gradient(90deg, rgba(255, 237, 213, 0.4), rgba(45, 212, 191, 0.9), rgba(52, 211, 153, 0.9));
          }
          50% { 
            width: 60%; 
            background: linear-gradient(90deg, rgba(255, 237, 213, 0.5), rgba(45, 212, 191, 1), rgba(52, 211, 153, 1));
          }
          80% { 
            width: 90%; 
            background: linear-gradient(90deg, rgba(255, 237, 213, 0.6), rgba(20, 184, 166, 1), rgba(16, 185, 129, 1));
          }
          100% { 
            width: 100%; 
            background: linear-gradient(90deg, rgba(255, 237, 213, 0.7), rgba(13, 148, 136, 1), rgba(5, 150, 105, 1));
          }
        }
      `}</style>
    </div>
  )
}

// Loading fallback component
function NavigationProgressFallback() {
  return null // Return nothing during loading to avoid flash
}

// Main export with Suspense wrapper
export function NavigationProgress() {
  return (
    <Suspense fallback={<NavigationProgressFallback />}>
      <NavigationProgressContent />
    </Suspense>
  )
}
