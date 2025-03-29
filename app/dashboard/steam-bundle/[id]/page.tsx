import { Suspense } from "react"
import { SteamBundleOverview } from "@/components/steam-bundle/steam-bundle-overview"
import { SteamBundleSkeleton } from "@/components/skeletons/steam-bundle-skeleton"

export default function SteamBundlePage({
  params,
}: {
  params: { id: string }
}) {
  return (
    <Suspense fallback={<SteamBundleSkeleton />}>
      <SteamBundleOverview id={params.id} />
    </Suspense>
  )
}

