import { Suspense } from "react"
import { ControlsSkeleton } from "@/components/skeletons/controls-skeleton"
import ControlsContent from "@/components/controls-content"

export default function ControlsPage() {
  return (
    <Suspense fallback={<ControlsSkeleton />}>
      <ControlsContent />
    </Suspense>
  )
}

