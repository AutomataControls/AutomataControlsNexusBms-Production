import { Suspense } from "react"
import { GreenhouseOverview } from "@/components/greenhouse/greenhouse-overview"
import { GreenhouseSkeleton } from "@/components/skeletons/greenhouse-skeleton"

export default function GreenhousePage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <Suspense fallback={<GreenhouseSkeleton />}>
      <GreenhouseOverview id={params.id} />
    </Suspense>
  )
}

