// components/navigation-progress.tsx
"use client"

import { usePathname, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

export function NavigationProgress() {
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
      <div className="h-1 bg-teal-500 animate-[loading_2s_ease-in-out_infinite]"></div>
      <style jsx>{`
        @keyframes loading {
          0% { width: 0%; }
          20% { width: 20%; }
          50% { width: 60%; }
          80% { width: 90%; }
          100% { width: 100%; }
        }
      `}</style>
    </div>
  )
}
