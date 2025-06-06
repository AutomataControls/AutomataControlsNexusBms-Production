// @ts-nocheck
//lib/hooks/use-locations.ts
import { useState, useEffect } from 'react'
import { collection, query, orderBy, getDocs, onSnapshot } from 'firebase/firestore'
import { useFirebase } from '@/lib/firebase-context'

export interface Location {
  id: string
  numericId: string
  name: string
  address: string
  city: string
  state: string
  country: string
  contactName?: string
  contactEmail?: string
  contactPhone?: string
  createdAt?: any
  updatedAt?: any
  equipmentCount?: number
}

export function useLocations() {
  const [locations, setLocations] = useState<Location[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { db } = useFirebase()

  useEffect(() => {
    if (!db) {
      setLoading(false)
      setError('Database not available')
      return
    }

    let unsubscribe: (() => void) | undefined

    const fetchLocations = async () => {
      try {
        setLoading(true)
        setError(null)

        // Query locations ordered by name
        const locationsRef = collection(db, 'locations')
        const q = query(locationsRef, orderBy('name'))

        // Use real-time listener for live updates
        unsubscribe = onSnapshot(q,
          (snapshot) => {
            const locationsList: Location[] = []
            snapshot.forEach((doc) => {
              const data = doc.data()
              locationsList.push({
                id: doc.id,
                numericId: data.id || data.Id || doc.id,
                name: data.name || 'Unnamed Location',
                address: data.address || '',
                city: data.city || '',
                state: data.state || '',
                country: data.country || 'US',
                contactName: data.contactName,
                contactEmail: data.contactEmail,
                contactPhone: data.contactPhone,
                createdAt: data.createdAt,
                updatedAt: data.updatedAt,
                equipmentCount: 0 // We'll add this later from equipment collection
              })
            })
            console.log(`✅ Loaded ${locationsList.length} locations from Firestore`)
            setLocations(locationsList)
            setLoading(false)
          },
          (err) => {
            console.error('❌ Error fetching locations:', err)
            setError(err.message)
            setLoading(false)
          }
        )
      } catch (err: any) {
        console.error('❌ Error setting up locations listener:', err)
        setError(err.message)
        setLoading(false)
      }
    }

    fetchLocations()

    // Cleanup listener on unmount
    return () => {
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [db])

  return { locations, loading, error }
}
