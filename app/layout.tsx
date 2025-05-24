// Modified layout.tsx
import type React from "react"
import { Mona_Sans as FontSans } from "next/font/google"
import { Cinzel_Decorative } from "next/font/google"
import { ThemeProvider } from "@/components/theme-provider"
import { SidebarProvider } from "@/components/ui/sidebar"
import { Toaster } from "@/components/ui/toaster"
import { AuthProvider } from "@/lib/auth-context"
import { FirebaseProvider } from "@/lib/firebase-context"
import { SocketProvider } from "@/lib/socket-context"
import { cn } from "@/lib/utils"
import InitializationWrapper from "@/components/initialization-wrapper"
import { NavigationProgress } from "@/components/navigation-progress"
import { patchScripts } from "@/lib/patches" // Import the consolidated scripts
import "@/app/globals.css"
import Script from "next/script"

const fontSans = FontSans({
  subsets: ["latin"],
  variable: "--font-sans",
})
const fontCinzel = Cinzel_Decorative({
  weight: ["400", "700", "900"],
  subsets: ["latin"],
  variable: "--font-cinzel",
})
export const metadata = {
  title: "Automata Controls Building Management System",
  description: "Building management system for equipment monitoring and control",
  generator: "v0.dev",
}
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="w-full h-full">
      <head>
        <Script id="consolidated-patches" strategy="beforeInteractive">
          {patchScripts}
        </Script>
      </head>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased w-full",
          fontSans.variable,
          fontCinzel.variable,
        )}
      >
        <NavigationProgress />
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            <FirebaseProvider>
              <SocketProvider>
                <SidebarProvider>
                  <InitializationWrapper>
                    {children}
                  </InitializationWrapper>
                  <Toaster />
                </SidebarProvider>
              </SocketProvider>
            </FirebaseProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
