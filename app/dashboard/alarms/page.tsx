import { Suspense } from "react"
import { AlarmsSkeleton } from "@/components/skeletons/alarms-skeleton"
import AlarmsContent from "@/components/alarms-content"

export default function AlarmsPage() {
  return (
    <Suspense fallback={<AlarmsSkeleton />}>
      <AlarmsContent />
    </Suspense>
  )
}

