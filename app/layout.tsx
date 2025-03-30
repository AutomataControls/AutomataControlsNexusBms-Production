export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className="w-full h-full">
      <head />
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased w-full",
          fontSans.variable,
          fontCinzel.variable,
        )}
      >
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <AuthProvider>
            <FirebaseProvider>
              <SocketProvider>
                <SidebarProvider>
                  {children}
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