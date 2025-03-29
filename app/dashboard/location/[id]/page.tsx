"use client"
import { Suspense, use } from "react"
import { LocationDetails } from "@/components/location-details"

interface LocationPageProps {
  params: {
    id: string
  }
}

export default function LocationPage({ params }: LocationPageProps) {
  // Use next.js recommended approach with React.use()
  const resolvedParams = use(params)
  
  return (
    <Suspense fallback={<div>Loading location details...</div>}>
      <LocationDetails id={resolvedParams.id} />
    </Suspense>
  )
}
