import { Suspense } from "react"
import { ControlsSkeleton } from "@/components/skeletons/controls-skeleton"
import EquipmentTypeControls from "@/components/equipment-type-controls"

interface PageProps {
  params: {
    type: string
    id: string
  }
}

export default async function EquipmentControlsPage({ params }: PageProps) {
  return (
    <Suspense fallback={<ControlsSkeleton />}>
      <EquipmentTypeControls type={params.type} id={params.id} />
    </Suspense>
  )
}

