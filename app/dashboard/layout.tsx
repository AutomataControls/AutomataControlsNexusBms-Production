// app/dashboard/layout.tsx - Clean New Foundation

"use client"

import React from "react"
import { AppHeader } from "@/components/app-header"
import { AppFooter } from "@/components/app-footer"
import { SessionTimeout } from "@/lib/session-timeout"
import { Suspense } from "react"
import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"
import { useAuth } from "@/lib/auth-context"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const { user } = useAuth()
  
  return (
    <SidebarProvider>
      <div className="flex min-h-screen flex-col w-full">
        <AppHeader />
        <div className="flex flex-1 flex-col md:flex-row w-full">
          <div className="md:w-64 md:flex-shrink-0 border-r">
            {user ? (
              <AppSidebar />
            ) : (
              <div className="md:w-64 md:flex-shrink-0 border-r bg-[#f8fcfa]"></div>
            )}
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
    </SidebarProvider>
  )
}
