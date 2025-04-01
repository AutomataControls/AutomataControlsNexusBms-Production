"use client"
import { Suspense, use } from "react"
import { ZoneDetails } from "@/components/zone-details"
interface ZonePageProps {
    params: {
        id: string
    }
}

export default function ZonePage({ params }: ZonePageProps) {
    // Use next.js recommended approach with React.use()
    const resolvedParams = use(params)

    return (
        <Suspense fallback={<div>Loading zone details...</div>}>
            <ZoneDetails id={resolvedParams.id} />
        </Suspense>
    )
}

