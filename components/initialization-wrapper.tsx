// components/initialization-wrapper.tsx
'use client';

import { useEffect, useState, useRef } from "react";
import ErrorBoundary from "./error-boundary";

export default function InitializationWrapper({
  children
}: {
  children: React.ReactNode
}) {
  const [isInitializing, setIsInitializing] = useState(true);
  const [initAttempt, setInitAttempt] = useState(0);
  // Track if we've already applied specific Firebase error workarounds
  const firebaseFixApplied = useRef(false);

  // Report errors to console and optionally to a server endpoint
  function reportError(error: any, context: string) {
    // Log to console
    console.error(`[ERROR] ${context}:`, error);

    // Log to server if you have an endpoint
    try {
      const errorData = {
        message: error?.message || 'Unknown error',
        stack: error?.stack || 'No stack trace',
        context,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        initStats: sessionStorage.getItem('app_init_stats') || '{}',
      };

      // Send to your error logging endpoint if you have one
      // Uncomment if you have an error logging API
      /*
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
        keepalive: true // Ensure the request completes even if page is unloading
      }).catch(() => {
        // Silently fail if this doesn't work
      });
      */
    } catch (e) {
      // Don't let error reporting break the app
      console.error('Error while reporting error:', e);
    }
  }

  // Specific handler for Firebase-related errors
  function handleFirebaseError() {
    // Only apply this fix once per session
    if (firebaseFixApplied.current) return;
    firebaseFixApplied.current = true;
    
    console.log('Applying Firebase-specific error fix...');
    
    try {
      // Create a marker in sessionStorage to signal that we need to use the Firebase workaround
      sessionStorage.setItem('use_firebase_workaround', 'true');
      
      // Check if we're on the problematic login route
      if (window.location.pathname.includes('/login')) {
        console.log('Detected login route with Firebase error, redirecting to dashboard...');
        
        // Check authentication state
        const isAuthenticated = localStorage.getItem('firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]');
        
        if (isAuthenticated) {
          // If authenticated, go to dashboard 
          window.location.href = '/dashboard';
        } else {
          // If not authenticated, go to home page which might have a working login button
          window.location.href = '/';
        }
        return true; // Signal that we handled the error
      }
      
      // For the specific webpack AbstractUserDataWriter error, try a specific fix
      // Add a cache-busting parameter specifically for layout.js
      const currentUrl = new URL(window.location.href);
      currentUrl.searchParams.set('layoutfix', Date.now().toString());
      
      if (document.querySelector('script[src*="layout.js"]')) {
        // Find all layout.js script tags and modify them
        const scripts = document.querySelectorAll('script[src*="layout.js"]');
        scripts.forEach(script => {
          const src = script.getAttribute('src');
          if (src) {
            // Add cache-busting parameter
            const newSrc = src.includes('?') 
              ? `${src}&v=${Date.now()}` 
              : `${src}?v=${Date.now()}`;
            
            // Remove and recreate the script element to force reload
            const newScript = document.createElement('script');
            newScript.src = newSrc;
            script.parentNode?.replaceChild(newScript, script);
          }
        });
        
        console.log('Applied targeted script fix for layout.js');
        return true;
      }
      
      return false; // Didn't handle the error with specific fix
    } catch (err) {
      console.error('Error in Firebase error handler:', err);
      return false;
    }
  }

  // Enhanced recovery script for auto-refreshing on specific errors
  useEffect(() => {
    // Get initialization statistics from sessionStorage
    const initStats = JSON.parse(sessionStorage.getItem('app_init_stats') || '{"attempts": 0, "refreshes": 0}');
    const isFirstLoad = initStats.attempts === 0;

    // Update stats
    initStats.attempts += 1;
    sessionStorage.setItem('app_init_stats', JSON.stringify(initStats));

    console.log(`App initialization: Attempt #${initStats.attempts}, Refreshes: ${initStats.refreshes}`);

    // Add a variable delay based on whether this is the first load of a new tab
    const initDelay = isFirstLoad ? 800 : 300;

    // For the very first load in a new tab, add a longer delay to ensure all resources load
    console.log(`Initializing with ${initDelay}ms delay - ${isFirstLoad ? 'first load' : 'subsequent load'}`);

    // Check for previous Firebase workarounds
    if (sessionStorage.getItem('use_firebase_workaround') === 'true') {
      console.log('Firebase workaround active - using alternative loading strategy');
      
      // Using the workaround - dynamically import Firebase only when needed
      const script = document.createElement('script');
      script.textContent = `
        // Intercept webpack module loading for Firebase
        (function() {
          const originalRequire = window.__webpack_require__;
          if (originalRequire) {
            window.__webpack_require__ = function(moduleId) {
              try {
                // Attempt normal require
                return originalRequire(moduleId);
              } catch (e) {
                // If it's the AbstractUserDataWriter error, return an empty mock
                if (e.message && e.message.includes('unexpected token') && 
                    moduleId && moduleId.toString().includes('firebase')) {
                  console.warn('Bypassing problematic Firebase module:', moduleId);
                  // Return a mock object that won't break the app
                  return {
                    AbstractUserDataWriter: function() {},
                    // Add other Firebase exports as needed
                  };
                }
                // For other errors, rethrow
                throw e;
              }
            };
            // Copy properties from original require
            Object.keys(originalRequire).forEach(key => {
              window.__webpack_require__[key] = originalRequire[key];
            });
          }
        })();
      `;
      document.head.appendChild(script);
    }

    // Check if we need to navigate back after a recovery strategy
    const returnTo = sessionStorage.getItem('return_to');
    if (returnTo) {
      console.log(`Returning to ${returnTo} after recovery`);
      sessionStorage.removeItem('return_to');

      // Small delay before redirect to ensure everything is loaded
      setTimeout(() => {
        window.location.href = returnTo;
      }, 1000);
    }

    // Detect if we're on the login page and already authenticated
    if (window.location.pathname.includes('/login')) {
      // Check for Firebase auth (adjust this check based on your auth structure)
      const isAuthenticated = localStorage.getItem('firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]');

      if (isAuthenticated) {
        console.log('User already authenticated on login page. Redirecting to dashboard...');
        // Redirect to dashboard
        window.location.href = '/dashboard';
        return; // Exit early from this effect
      }
    }

    // Similar check for the root path
    if (window.location.pathname === '/' || window.location.pathname === '') {
      // Check for Firebase auth
      const isAuthenticated = localStorage.getItem('firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]');

      if (isAuthenticated) {
        console.log('User already authenticated on root page. Redirecting to dashboard...');
        // Short delay to ensure Firebase is fully initialized
        setTimeout(() => {
          window.location.href = '/dashboard';
        }, 100);
        return; // Exit early
      }
    }

    // Enhanced error handler for specific layout.js and server errors
    const handleError = (event: ErrorEvent) => {
      // First try Firebase-specific fixes for webpack issues
      if (
        (event.filename?.includes('layout.js') && event.message?.includes('unexpected token')) ||
        (event.message?.includes('AbstractUserDataWriter')) ||
        (event.message?.includes('ChunkLoadError') && event.message?.includes('layout.js'))
      ) {
        console.log('Detected Firebase-related webpack error, applying targeted fix...');
        if (handleFirebaseError()) {
          // If the specific handler dealt with it, prevent default and skip generic handling
          event.preventDefault();
          return;
        }
      }

      // Special handling for login page errors
      if (window.location.pathname.includes('/login')) {
        console.log('Detected error on login page. Attempting dashboard redirect...');

        // Check if we're authenticated
        const isAuthenticated = localStorage.getItem('firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]');

        if (isAuthenticated) {
          // Redirect to dashboard
          window.location.href = '/dashboard';
          return; // Skip other error handling
        } else {
          // Go to the root page which might have a functioning login button
          window.location.href = '/';
          return; // Skip other error handling
        }
      }

      // If we detect any of these common errors
      if (
        (event.filename?.includes('layout.js') && event.message?.includes('unexpected token')) ||
        (event.message?.includes('ChunkLoadError')) ||
        (event.message?.includes('Unexpected end of JSON')) ||
        (event.message?.includes('end of JSON input')) ||
        (document.body.textContent?.includes('500') && document.body.textContent?.includes('Internal Server Error'))
      ) {
        console.log('Detected application error during initialization. Auto-recovering...');

        // Update refresh stats
        const currentStats = JSON.parse(sessionStorage.getItem('app_init_stats') || '{"attempts": 1, "refreshes": 0}');
        currentStats.refreshes += 1;
        sessionStorage.setItem('app_init_stats', JSON.stringify(currentStats));

        // Prevent infinite refresh loops - max 5 auto-refreshes
        if (currentStats.refreshes <= 5) {
          // Different recovery strategies based on error count
          const recoveryStrategy = currentStats.refreshes;

          setTimeout(() => {
            switch (recoveryStrategy) {
              case 1:
                // First attempt: Simple reload
                console.log('Recovery strategy 1: Simple reload');
                window.location.reload();
                break;
              case 2:
                // Second attempt: Hard reload (bypass cache)
                console.log('Recovery strategy 2: Hard reload');
                window.location.reload(true);
                break;
              case 3:
                // Third attempt: Try direct dashboard access for authenticated users
                console.log('Recovery strategy 3: Attempting direct dashboard access');

                // Check if we're authenticated
                const isAuth = localStorage.getItem('firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]');
                if (isAuth) {
                  window.location.href = '/dashboard';
                } else {
                  // If not authenticated, clear cache and retry
                  if ('caches' in window) {
                    caches.keys().then(cacheNames => {
                      cacheNames.forEach(cacheName => {
                        caches.delete(cacheName);
                      });
                    });
                  }

                  // Reload with cache bypass
                  window.location.reload(true);
                }
                break;
              case 4:
                // Fourth attempt: Navigate away and back
                console.log('Recovery strategy 4: Navigate away and back');
                // Store that we want to return to dashboard
                sessionStorage.setItem('return_to', window.location.pathname === '/login' ? '/dashboard' : window.location.pathname);
                // Navigate to home page
                window.location.href = '/';
                break;
              case 5:
                // Fifth attempt: Full reset - go to login page
                console.log('Recovery strategy 5: Full reset to login page');
                // Navigate to home/login and clear stats
                sessionStorage.clear();
                window.location.href = '/?reset=1';
                break;
            }
          }, 500);
        } else {
          console.log('Maximum refresh attempts reached. Showing error UI.');
          // Let the error boundary handle it after max refreshes
          throw new Error('Application failed to initialize after multiple attempts');
        }
      }
    };

    // Monitor unhandled promise rejections as well
    const handleRejection = (event: PromiseRejectionEvent) => {
      console.log('Unhandled promise rejection:', event.reason);
      reportError(event.reason, 'Unhandled promise rejection');

      // If it seems like a resource loading or initialization error
      if (
        (event.reason && event.reason.message &&
         (event.reason.message.includes('chunk') ||
          event.reason.message.includes('loading') ||
          event.reason.message.includes('network') ||
          event.reason.message.includes('failed to fetch') ||
          event.reason.message.includes('JSON')))
      ) {
        handleError({
          filename: 'unknown',
          message: 'ChunkLoadError: ' + event.reason.message
        } as ErrorEvent);
      }
    };

    // Add error event listeners
    window.addEventListener('error', (event) => {
      reportError(event, 'Uncaught error');
      handleError(event);
    });

    window.addEventListener('unhandledrejection', handleRejection);

    // Check for 500 errors periodically during initialization
    const checkForServerErrors = setInterval(() => {
      if (document.body.textContent?.includes('500') &&
          document.body.textContent?.includes('Internal Server Error')) {
        console.log('Detected 500 error in page content');
        handleError({
          filename: 'server',
          message: '500 Internal Server Error'
        } as ErrorEvent);
        clearInterval(checkForServerErrors);
      }
    }, 100);

    // Allow a longer delay for the first load, shorter for subsequent loads
    const timer = setTimeout(() => {
      clearInterval(checkForServerErrors);
      console.log('Initialization delay complete, showing application');
      setIsInitializing(false);
      setInitAttempt(prev => prev + 1);
    }, initDelay);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleRejection);
      clearTimeout(timer);
      clearInterval(checkForServerErrors);
    };
  }, []);

  // Display loading spinner during initialization
  if (isInitializing) {
    return (
      <div className="fixed inset-0 flex items-center justify-center bg-white bg-opacity-80 z-50">
        <div className="flex flex-col items-center">
          <div className="h-12 w-12 rounded-full border-t-4 border-b-4 border-teal-500 animate-spin"></div>
          <p className="mt-4 text-lg font-medium text-teal-700">Initializing application...</p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary fallback={
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Application Error</h2>
          <p className="text-gray-700 mb-4">
            The Automata Controls BMS encountered an error during initialization.
          </p>
          <div className="flex flex-col space-y-2">
            <button
              onClick={() => window.location.reload()}
              className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white font-semibold rounded-md transition-colors"
            >
              Reload Application
            </button>
            <button
              onClick={() => {
                // Check if we're authenticated
                const isAuth = localStorage.getItem('firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]');
                if (isAuth) {
                  // Go directly to dashboard
                  window.location.href = '/dashboard';
                } else {
                  // Go to home page
                  window.location.href = '/';
                }
              }}
              className="w-full py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-md transition-colors"
            >
              {localStorage.getItem('firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]')
                ? 'Go to Dashboard'
                : 'Return to Home'}
            </button>
            <button
              onClick={() => {
                if ('caches' in window) {
                  caches.keys().then(cacheNames => {
                    return Promise.all(
                      cacheNames.map(cacheName => caches.delete(cacheName))
                    );
                  }).then(() => {
                    // Reset stats and reload
                    sessionStorage.setItem('app_init_stats', JSON.stringify({attempts: 0, refreshes: 0}));
                    window.location.reload(true);
                  });
                } else {
                  sessionStorage.setItem('app_init_stats', JSON.stringify({attempts: 0, refreshes: 0}));
                  window.location.reload(true);
                }
              }}
              className="w-full py-2 px-4 bg-gray-600 hover:bg-gray-700 text-white font-semibold rounded-md transition-colors"
            >
              Clear Cache & Reload
            </button>
          </div>
        </div>
      </div>
    }>
      {children}
    </ErrorBoundary>
  );
}
