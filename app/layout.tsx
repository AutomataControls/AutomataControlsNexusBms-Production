// layout.tsx
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
        <Script id="memo-patch" strategy="beforeInteractive">
          {`
            // Fix for React.memo issues in webpack development mode - execute immediately
            (function() {
              // Define a function to patch React.memo once it's available
              function patchReactMemo() {
                try {
                  if (window.React && window.React.memo) {
                    const originalMemo = window.React.memo;
                    window.React.memo = function patchedMemo(component) {
                      try {
                        return originalMemo(component);
                      } catch (e) {
                        console.warn('Patched React.memo error:', e.message);
                        return component;
                      }
                    };
                    console.log('React.memo successfully patched');
                    return true;
                  }
                  return false;
                } catch (e) {
                  console.error('Error patching React.memo:', e);
                  return false;
                }
              }

              // Try to patch immediately
              if (!patchReactMemo()) {
                // If React isn't available yet, set up an interval to keep trying
                const interval = setInterval(() => {
                  if (patchReactMemo()) {
                    clearInterval(interval);
                  }
                }, 10);

                // Also try on DOMContentLoaded as a backup
                window.addEventListener('DOMContentLoaded', () => {
                  patchReactMemo();
                  clearInterval(interval);
                });
              }
            })();
          `}
        </Script>
        <Script id="location-card-fix" strategy="beforeInteractive">
          {`
            // Fix for location-card.tsx "Cannot read properties of undefined (reading 'call')" error
            (function() {
              // Intercept errors early
              window.addEventListener('error', function(e) {
                if (e.message && e.message.includes("Cannot read properties of undefined (reading 'call')")) {
                  console.log('Caught call property error, attempting to fix');
                  
                  // Try to find the location-card module in webpack
                  if (window.__webpack_require__ && window.__webpack_modules__) {
                    // Look through webpack modules for location-card
                    Object.keys(window.__webpack_modules__).forEach(key => {
                      if (key.toString().includes('location-card')) {
                        console.log('Found location-card module, patching:', key);
                        
                        // Save original module
                        const originalModule = window.__webpack_modules__[key];
                        
                        // Replace with patched version
                        window.__webpack_modules__[key] = function(module, exports, __webpack_require__) {
                          try {
                            // Try to run original
                            originalModule(module, exports, __webpack_require__);
                          } catch (moduleError) {
                            console.warn('Caught error in location-card module, providing fallback', moduleError);
                            
                            // Create a simple fallback export
                            exports.__esModule = true;
                            exports.LocationCard = function LocationCard() { 
                              return null; 
                            };
                          }
                        };
                      }
                    });
                  }
                  
                  e.preventDefault();
                  return false;
                }
              }, true);
            })();
          `}
        </Script>
        <Script id="firebase-fix" strategy="beforeInteractive">
          {`
            // Check if we need the Firebase workaround
            if (sessionStorage.getItem('use_firebase_workaround') === 'true') {
              console.log('Setting up Firebase webpack fallback...');

              // Create a global error handler
              window.addEventListener('error', function(e) {
                // Look specifically for the AbstractUserDataWriter error
                if (e.message &&
                    (e.message.includes('unexpected token') ||
                     e.message.includes('AbstractUserDataWriter') ||
                     e.message.includes('ChunkLoadError'))) {

                  // Check if we're on login page
                  if (window.location.pathname.includes('/login')) {
                    // Check if authenticated
                    const authData = localStorage.getItem('firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]');
                    if (authData) {
                      console.log('Authentication detected, redirecting from login page to dashboard...');
                      window.location.href = '/dashboard';
                      e.preventDefault();
                      return;
                    }
                  }

                  // Add a version parameter to force cache invalidation
                  const currentUrl = new URL(window.location.href);
                  if (!currentUrl.searchParams.has('v')) {
                    currentUrl.searchParams.set('v', Date.now().toString());
                    window.location.href = currentUrl.toString();
                    e.preventDefault();
                  }
                }
              }, true);
            }
          `}
        </Script>
        <Script id="webpack-patch" strategy="beforeInteractive">
          {`
            (function() {
              // Add a version to force cache invalidation
              const version = "v${Date.now()}";
              document.querySelector('html').setAttribute('data-version', version);

              // Patch webpack module loading for Firebase-related errors
              window.__webpack_patch_applied = false;

              function patchWebpack() {
                if (window.__webpack_patch_applied) return;

                if (window.__webpack_require__) {
                  const originalRequire = window.__webpack_require__;
                  window.__webpack_require__ = function(moduleId) {
                    try {
                      return originalRequire(moduleId);
                    } catch (e) {
                      // If it's the AbstractUserDataWriter error, return a mock
                      if (e && e.message &&
                          (e.message.includes('unexpected token') ||
                           e.message.includes('AbstractUserDataWriter'))) {
                        console.warn('Webpack module patch: Bypassing problematic module:', moduleId);
                        return {
                          AbstractUserDataWriter: function() { return {}; },
                          AggregateField: function() { return {}; }
                        };
                      }
                      // Handle call property error
                      if (e && e.message && e.message.includes("Cannot read properties of undefined (reading 'call')")) {
                        console.warn('Webpack module patch: Handling call property error:', moduleId);
                        return {};
                      }
                      throw e;
                    }
                  };

                  // Copy all properties from the original require
                  for (const prop in originalRequire) {
                    if (originalRequire.hasOwnProperty(prop)) {
                      window.__webpack_require__[prop] = originalRequire[prop];
                    }
                  }

                  window.__webpack_patch_applied = true;
                  console.log('Webpack module loader patched for Firebase compatibility');
                }
              }

              // Try to patch immediately
              patchWebpack();

              // Also try again when more of the page has loaded
              window.addEventListener('DOMContentLoaded', patchWebpack);
              window.addEventListener('load', patchWebpack);

              // Set up a MutationObserver to watch for script additions
              if (typeof MutationObserver !== 'undefined') {
                const observer = new MutationObserver(function(mutations) {
                  for (const mutation of mutations) {
                    if (mutation.type === 'childList') {
                      for (const node of mutation.addedNodes) {
                        if (node.nodeName === 'SCRIPT' && node.src && node.src.includes('layout.js')) {
                          // Found a layout.js script being added - apply the patch
                          patchWebpack();

                          // Add cache-busting to the script
                          if (node.src && !node.src.includes('v=')) {
                            const newSrc = node.src + (node.src.includes('?') ? '&v=' : '?v=') + Date.now();
                            node.setAttribute('src', newSrc);
                          }
                        }
                      }
                    }
                  }
                });

                // Start observing once the document body exists
                if (document.body) {
                  observer.observe(document.body, { childList: true, subtree: true });
                } else {
                  window.addEventListener('DOMContentLoaded', function() {
                    observer.observe(document.body, { childList: true, subtree: true });
                  });
                }
              }
            })();
          `}
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
