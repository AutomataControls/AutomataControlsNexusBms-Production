"use client"
import type React from "react"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { SessionTimeout } from "@/lib/session-timeout"
import dynamic from "next/dynamic"
import { Suspense } from "react"

const DynamicAppSidebar = dynamic(
  () => import("@/components/app-sidebar").then((mod) => mod.AppSidebar),
  {
    ssr: false,
    loading: () => <div className="md:w-64 md:flex-shrink-0 border-r bg-[#f8fcfa]"></div>,
  }
)

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col w-full">
      <AppHeader />
      <div className="flex flex-1 flex-col md:flex-row w-full">
        <div className="md:w-64 md:flex-shrink-0 border-r">
          <Suspense fallback={<div className="md:w-64 md:flex-shrink-0 border-r bg-[#f8fcfa]"></div>}>
            <DynamicAppSidebar />
          </Suspense>
        </div>
        <main className="flex-1 p-4 md:p-6 bg-[#f8fcfa]">
          <Suspense fallback={<div>Loading content...</div>}>
            {children}
          </Suspense>
        </main>
      </div>
      <AppFooter />
      <SessionTimeout />
    </div>
  )
}
