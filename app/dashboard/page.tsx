"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Suspense } from "react"
import DashboardContent from "@/components/dashboard-content"
import { DashboardSkeleton } from "@/components/skeletons/dashboard-skeleton"
import { useAuth } from "@/lib/auth-context"
import { AdminGuard } from "@/components/admin-guard"

export default function DashboardPage() {
  const { user, loading } = useAuth()
  const router = useRouter()
  
  useEffect(() => {
    if (!loading && !user) {
      router.push("/login")
    }
  }, [user, loading, router])
  
  // Don't render the dashboard until authentication is confirmed
  if (loading) {
    return <DashboardSkeleton />
  }
  
  if (!user) {
    return null // Return nothing while redirecting
  }
  
  return (
    <AdminGuard>
      <Suspense fallback={<DashboardSkeleton />}>
        <DashboardContent />
      </Suspense>
    </AdminGuard>
  )
}
