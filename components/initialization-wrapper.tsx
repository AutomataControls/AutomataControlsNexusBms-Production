// components/initialization-wrapper.tsx
"use client";

import React, { useEffect, useState, useRef, type ReactNode } from "react";
import ErrorBoundary from "./error-boundary";
import { useFirebase } from "@/lib/firebase-context"; // Import the hook

const LOG_PREFIX = "[InitializationWrapper]";

export default function InitializationWrapper({ children }: { children: React.ReactNode }) {
  // Get Firebase state from context
  const firebaseContext = useFirebase();
  const { 
    isInitialized: firebaseCoreInitialized = false, 
    isLoadingConfig: firebaseIsLoadingConfig = true 
  } = firebaseContext || {};

  // Wrapper's own state to decide if it should render children or loading UI
  const [isWrapperInitializing, setIsWrapperInitializing] = useState(true); 

  // States for your enhanced loading UI
  const [initAttempt, setInitAttempt] = useState(0);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStage, setLoadingStage] = useState("Connecting...");
  const [showDetails, setShowDetails] = useState(false);
  
  const firebaseFixApplied = useRef(false);

  function reportError(error: any, context: string) {
    console.error(`${LOG_PREFIX} [ERROR] ${context}:`, error);
    try {
      const errorData = {
        message: error?.message || "Unknown error",
        stack: error?.stack || "No stack trace",
        context,
        timestamp: new Date().toISOString(),
        url: typeof window !== 'undefined' ? window.location.href : '',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : '',
        initStats: typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem("app_init_stats") || "{}") : '{}',
      };
      // Your fetch to /api/log-error (if you implement it)
      /*
      fetch('/api/log-error', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(errorData),
        keepalive: true
      }).catch(() => {});
      */
    } catch (e) {
      console.error(`${LOG_PREFIX} Error while reporting error:`, e);
    }
  }

  function handleFirebaseError() {
    if (firebaseFixApplied.current) return false;
    firebaseFixApplied.current = true;
    console.log(LOG_PREFIX, "Applying Firebase-specific error fix...");
    try {
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem("use_firebase_workaround", "true");

      if (typeof window !== 'undefined' && window.location.pathname.includes("/login")) {
        console.log(LOG_PREFIX, "Detected login route with Firebase error, redirecting...");
        const isAuthenticated = typeof localStorage !== 'undefined' ? localStorage.getItem("firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]") : null;
        if (isAuthenticated) { window.location.href = "/dashboard"; } 
        else { window.location.href = "/"; }
        return true;
      }
      
      if (typeof document !== 'undefined' && typeof window !== 'undefined') {
        const currentUrl = new URL(window.location.href);
        currentUrl.searchParams.set("layoutfix", Date.now().toString());

        if (document.querySelector('script[src*="layout.js"]')) {
          const scripts = document.querySelectorAll('script[src*="layout.js"]');
          scripts.forEach((script) => {
            const src = script.getAttribute("src");
            if (src) {
              const newSrc = src.includes("?") ? `${src}&v=${Date.now()}` : `${src}?v=${Date.now()}`;
              const newScript = document.createElement("script");
              newScript.src = newSrc;
              script.parentNode?.replaceChild(newScript, script);
            }
          });
          console.log(LOG_PREFIX, "Applied targeted script fix for layout.js");
          return true;
        }
      }
      return false;
    } catch (err) {
      console.error(LOG_PREFIX, "Error in Firebase error handler:", err);
      return false;
    }
  }

  useEffect(() => {
    const initStats = JSON.parse(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem("app_init_stats") || '{"attempts": 0, "refreshes": 0}') : '{"attempts": 0, "refreshes": 0}');
    const isFirstLoadForSession = initStats.attempts === 0;
    initStats.attempts += 1;
    setInitAttempt(initStats.attempts -1 );
    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem("app_init_stats", JSON.stringify(initStats));
    console.log(`${LOG_PREFIX} App initialization: Attempt #${initStats.attempts}, Refreshes: ${initStats.refreshes}, Session First Load: ${isFirstLoadForSession}`);

    const stages = ["Connecting...", "Authenticating...", "Loading Services...", "Fetching Config...", "Finalizing...", "Almost Ready..."];
    let currentStageIdx = 0;
    if(isWrapperInitializing) setLoadingStage(stages[currentStageIdx]); // Set initial stage only if loading

    let progressInterval: NodeJS.Timeout | undefined;

    if (isWrapperInitializing) {
        progressInterval = setInterval(() => {
            setLoadingProgress(prev => {
                if (prev >= 100 && (firebaseCoreInitialized && !firebaseIsLoadingConfig)) { 
                    clearInterval(progressInterval as NodeJS.Timeout);
                    return 100;
                }
                const isFirebaseReady = firebaseCoreInitialized && !firebaseIsLoadingConfig;
                const increment = isFirebaseReady ? 25 : (Math.random() * 8 + 2); 
                const nextProgress = Math.min(prev + increment, isFirebaseReady ? 99 : 95); 
                
                const stageThreshold = 100 / stages.length;
                if (nextProgress > (currentStageIdx + 1) * stageThreshold && currentStageIdx < stages.length - 1) {
                    currentStageIdx++;
                    setLoadingStage(stages[currentStageIdx]);
                }
                return nextProgress;
            });
        }, 300); 
    } else {
        setLoadingProgress(100);
        setLoadingStage("Ready!");
        if(progressInterval) clearInterval(progressInterval);
    }

    const handleError = (event: ErrorEvent | Event) => { // Make event type broader
      const errorEvent = event as ErrorEvent;
      reportError(errorEvent, 'Uncaught error');
      
      if (
        (errorEvent.filename?.includes("layout.js") && errorEvent.message?.includes("unexpected token")) ||
        errorEvent.message?.includes("AbstractUserDataWriter") ||
        (errorEvent.message?.includes("ChunkLoadError") && errorEvent.filename?.includes("layout.js")) ||
        errorEvent.message?.includes("ChunkLoadError") ||
        errorEvent.message?.includes("Unexpected end of JSON") ||
        errorEvent.message?.includes("end of JSON input") ||
        (typeof document !== 'undefined' && document.body.textContent?.includes("500") && document.body.textContent?.includes("Internal Server Error"))
      ) {
        if (
            (errorEvent.filename?.includes('layout.js') && errorEvent.message?.includes('unexpected token')) ||
            (errorEvent.message?.includes('AbstractUserDataWriter')) ||
            (errorEvent.message?.includes('ChunkLoadError') && errorEvent.filename?.includes('layout.js'))
        ) {
            console.log(LOG_PREFIX, 'Detected Firebase-related webpack error, applying targeted fix...');
            if (handleFirebaseError()) {
                event.preventDefault();
                return;
            }
        }
        
        if (typeof window !== 'undefined' && window.location.pathname.includes("/login")) {
            console.log(LOG_PREFIX, 'Detected error on login page. Attempting dashboard redirect...');
            const isAuthenticated = typeof localStorage !== 'undefined' ? localStorage.getItem("firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]") : null;
            if (isAuthenticated) { window.location.href = "/dashboard"; return; } 
            else { window.location.href = "/"; return; }
        }

        console.log(LOG_PREFIX, 'Detected application error during initialization. Attempting auto-recovery...');
        const currentStats = JSON.parse(typeof sessionStorage !== 'undefined' ? (sessionStorage.getItem("app_init_stats") || '{"attempts": 1, "refreshes": 0}') : '{"attempts": 1, "refreshes": 0}');
        currentStats.refreshes += 1;
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem("app_init_stats", JSON.stringify(currentStats));

        if (currentStats.refreshes <= 5) {
          const recoveryStrategy = currentStats.refreshes;
          setTimeout(() => {
            switch (recoveryStrategy) {
              case 1: console.log(LOG_PREFIX, "Recovery: Simple reload"); window.location.reload(); break;
              case 2: console.log(LOG_PREFIX, "Recovery: Hard reload"); window.location.reload(true); break;
              case 3:
                console.log(LOG_PREFIX, "Recovery: Attempting direct dashboard access");
                const isAuth = typeof localStorage !== 'undefined' ? localStorage.getItem("firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]") : null;
                if (isAuth) { window.location.href = "/dashboard"; } 
                else {
                  if (typeof caches !== 'undefined') { caches.keys().then(names => names.forEach(name => caches.delete(name))); }
                  window.location.reload(true);
                }
                break;
              case 4:
                console.log(LOG_PREFIX, "Recovery: Navigate away and back");
                if (typeof sessionStorage !== 'undefined') sessionStorage.setItem("return_to", typeof window !== 'undefined' ? (window.location.pathname === "/login" ? "/dashboard" : window.location.pathname) : '/dashboard');
                if (typeof window !== 'undefined') window.location.href = "/";
                break;
              case 5:
                console.log(LOG_PREFIX, "Recovery: Full reset to login page");
                if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
                if (typeof window !== 'undefined') window.location.href = "/?reset=1";
                break;
            }
          }, 500);
        } else {
          console.log(LOG_PREFIX, "Maximum refresh attempts reached. ErrorBoundary will take over.");
          throw new Error("Application failed to initialize after multiple attempts");
        }
      }
    };

    const handleRejection = (event: PromiseRejectionEvent) => {
      reportError(event.reason, 'Unhandled promise rejection');
      if (event.reason && event.reason.message && (event.reason.message.includes("chunk") || event.reason.message.includes("loading") || event.reason.message.includes("network") || event.reason.message.includes("failed to fetch") || event.reason.message.includes("JSON"))) {
        handleError({ filename: "promiseRejection", message: "AsyncError: " + event.reason.message } as any); // Cast to any to fit ErrorEvent structure
      }
    };

    if (typeof window !== 'undefined') {
        window.addEventListener("error", handleError);
        window.addEventListener("unhandledrejection", handleRejection);
    }
    
    const checkForServerErrors = setInterval(() => { 
        if (typeof document !== 'undefined' && document.body.textContent?.includes('500') && document.body.textContent?.includes("Internal Server Error")) {
            console.log(LOG_PREFIX, "Detected 500 error in page content.");
            handleError({filename: "server", message: "500 Internal Server Error"} as ErrorEvent);
            clearInterval(checkForServerErrors);
        }
    }, 100);

    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener("error", handleError);
        window.removeEventListener("unhandledrejection", handleRejection);
      }
      if (progressInterval) clearInterval(progressInterval);
      clearInterval(checkForServerErrors);
    };
  }, [isWrapperInitializing, firebaseCoreInitialized, firebaseIsLoadingConfig]);

  useEffect(() => {
    console.log(`${LOG_PREFIX} Firebase context state update: coreInitialized=${firebaseCoreInitialized}, isLoadingConfig=${firebaseIsLoadingConfig}`);
    if (firebaseCoreInitialized && !firebaseIsLoadingConfig) {
      console.log(LOG_PREFIX, "FirebaseProvider is fully initialized and config loaded. Preparing to show application.");
      setLoadingProgress(100); 
      setLoadingStage("Ready!");
      const finalShowTimer = setTimeout(() => {
        setIsWrapperInitializing(false); 
        console.log(LOG_PREFIX, "Application shown based on Firebase readiness.");
      }, 200); 
      return () => clearTimeout(finalShowTimer);
    } else {
      if (!isWrapperInitializing && (firebaseIsLoadingConfig || !firebaseCoreInitialized)) {
          console.log(LOG_PREFIX, "FirebaseProvider state indicates not fully ready. Re-showing spinner.");
          setIsWrapperInitializing(true);
          setLoadingProgress(10); 
          setLoadingStage("Re-initializing...");
      }
    }
  }, [firebaseCoreInitialized, firebaseIsLoadingConfig, isWrapperInitializing]);

  useEffect(() => {
    if (isWrapperInitializing) return; 
    console.log(LOG_PREFIX, "Wrapper initialization complete. Running post-init logic (redirects, etc.).");
    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem("use_firebase_workaround") === "true") { /* ... */ }
    const returnTo = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("return_to") : null;
    if (returnTo) { /* ... */ }
    const isAuthenticated = typeof localStorage !== 'undefined' ? localStorage.getItem("firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]") : null;
    if (isAuthenticated && typeof window !== 'undefined') {
        if (window.location.pathname.includes("/login")) { window.location.href = "/dashboard"; }
        else if (window.location.pathname === "/" || window.location.pathname === "") { window.location.href = "/dashboard"; }
    }
  }, [isWrapperInitializing]);

  if (isWrapperInitializing) {
    return (
      <div className="fixed inset-0 bg-gradient-to-br from-slate-900 via-teal-900 to-emerald-900 z-50 overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-teal-400/15 rounded-full blur-3xl animate-pulse shadow-2xl"></div>
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-mint-200/20 rounded-full blur-3xl animate-pulse delay-1000 shadow-2xl"></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-teal-300/15 rounded-full blur-2xl animate-pulse delay-500 shadow-xl"></div>
        </div>
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:50px_50px]"></div>
        <div className="relative z-10 flex items-center justify-center min-h-screen p-8"> {/* Added z-10 here */}
          <div className="text-center max-w-md w-full">
            <div className="mb-12">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-teal-400 via-emerald-400 to-mint-300 rounded-2xl mb-6 shadow-2xl drop-shadow-2xl">
                <div className="w-10 h-10 bg-white/30 rounded-lg backdrop-blur-sm flex items-center justify-center shadow-inner">
                  <img 
                    src="/neural-loader.png" 
                    alt="Automata Controls Logo" 
                    className="w-6 h-6 object-contain drop-shadow-sm"
                  />
                </div>
              </div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-white via-mint-100 to-teal-200 bg-clip-text text-transparent mb-2 drop-shadow-lg">
                Automata Controls
              </h1>
              <p className="text-teal-100/90 text-lg font-medium drop-shadow-md">Building Management System</p>
            </div>
            <div className="relative mb-8">
              <div className="w-24 h-24 mx-auto relative">
                <div className="absolute inset-0 rounded-full border-4 border-teal-400/30 shadow-lg"></div>
                <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-teal-300 border-r-mint-300 animate-spin drop-shadow-lg"></div>
                <div className="absolute inset-6 rounded-full bg-gradient-to-br from-teal-300 via-emerald-300 to-mint-200 animate-pulse shadow-xl drop-shadow-xl"></div>
                <div className="absolute inset-8 rounded-full bg-white/95 shadow-inner drop-shadow-sm"></div>
              </div>
            </div>
            <div className="mb-6">
              <div className="flex justify-between items-center mb-2">
                <span className="text-teal-100/90 text-sm font-medium drop-shadow-sm">{loadingStage}</span>
                <span className="text-mint-200 text-sm font-bold drop-shadow-sm">{Math.round(loadingProgress)}%</span>
              </div>
              <div className="w-full bg-teal-900/40 rounded-full h-2 backdrop-blur-sm border border-teal-400/30 shadow-inner">
                <div
                  className="bg-gradient-to-r from-teal-300 via-emerald-300 to-mint-200 h-2 rounded-full transition-all duration-300 ease-out shadow-lg drop-shadow-lg"
                  style={{ width: `${loadingProgress}%` }}
                >
                  <div className="h-full bg-white/30 rounded-full animate-pulse"></div>
                </div>
              </div>
            </div>
            <div className="space-y-3 mb-8">
              <div className="flex items-center justify-center space-x-2 text-teal-200/80 text-sm">
                <div className={`w-2 h-2 rounded-full animate-pulse shadow-sm ${firebaseCoreInitialized && !firebaseIsLoadingConfig ? 'bg-mint-300 shadow-mint-300/50' : 'bg-yellow-300 shadow-yellow-300/50'}`}></div>
                <span className="drop-shadow-sm">System Status: {firebaseCoreInitialized && !firebaseIsLoadingConfig ? "Online" : loadingStage}</span>
              </div>
              <div className="flex items-center justify-center space-x-2 text-teal-200/80 text-sm">
                <div className="w-2 h-2 bg-yellow-300 rounded-full animate-pulse delay-300 shadow-sm shadow-yellow-300/50"></div>
                <span className="drop-shadow-sm">Attempt #{initAttempt + 1}</span>
              </div>
            </div>
            <button
              onClick={() => setShowDetails(!showDetails)}
              className="text-teal-200/90 hover:text-mint-200 text-sm underline transition-colors duration-200 drop-shadow-sm"
            >
              {showDetails ? "Hide" : "Show"} technical details
            </button>
            {showDetails && (
              <div className="mt-4 p-4 bg-black/30 rounded-lg backdrop-blur-sm border border-teal-400/30 text-left shadow-xl drop-shadow-xl">
                <div className="text-xs text-teal-200/70 space-y-1 font-mono">
                  <div>Environment: {process.env.NODE_ENV || "production"}</div>
                  <div>User Agent: {typeof navigator !== 'undefined' ? navigator.userAgent.substring(0,40) : 'N/A'}...</div>
                  <div>Timestamp: {new Date().toLocaleTimeString()}</div>
                  <div>Session: {typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("app_init_stats") : "N/A"}</div>
                </div>
              </div>
            )}
            <div className="absolute -bottom-4 left-1/2 transform -translate-x-1/2">
              <div className="flex space-x-1">
                {[...Array(3)].map((_, i) => (
                  <div
                    key={i}
                    className="w-2 h-2 bg-teal-300/80 rounded-full animate-bounce shadow-sm shadow-teal-300/50 drop-shadow-sm"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  ></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-8 max-w-lg w-full border border-red-100">
            <div className="flex justify-center mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-red-500 to-orange-500 rounded-full flex items-center justify-center shadow-lg">
                <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
            </div>
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-3">System Error Detected</h2>
              <p className="text-gray-600 leading-relaxed">
                The Automata Controls BMS encountered an unexpected error during initialization. Our recovery systems are ready to help restore normal operation.
              </p>
            </div>
            <div className="space-y-3">
              <button onClick={() => window.location.reload()} className="w-full py-3 px-6 bg-gradient-to-r from-teal-600 to-blue-600 hover:from-teal-700 hover:to-blue-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-center space-x-2">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                  <span>Reload Application</span>
                </div>
              </button>
              <button onClick={() => {
                  const isAuth = typeof localStorage !== 'undefined' ? localStorage.getItem("firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]") : null;
                  if (isAuth) { window.location.href = "/dashboard"; } 
                  else { window.location.href = "/"; }
                }} className="w-full py-3 px-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl">
                 <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>
                    <span>{typeof localStorage !== 'undefined' && localStorage.getItem("firebase:authUser:AIzaSyC8CwewEPJIgz5txh9MpvhBqssyCFZ0LDM:[DEFAULT]") ? "Go to Dashboard" : "Return to Home"}</span>
                 </div>
              </button>
              <button onClick={() => {
                  if (typeof caches !== 'undefined') {
                    caches.keys().then((cacheNames) => Promise.all(cacheNames.map((cacheName) => caches.delete(cacheName))))
                      .then(() => {
                        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem("app_init_stats", JSON.stringify({ attempts: 0, refreshes: 0 }));
                        window.location.reload(true);
                      });
                  } else {
                    if (typeof sessionStorage !== 'undefined') sessionStorage.setItem("app_init_stats", JSON.stringify({ attempts: 0, refreshes: 0 }));
                    window.location.reload(true);
                  }
                }} className="w-full py-3 px-6 bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-700 hover:to-gray-800 text-white font-semibold rounded-xl transition-all duration-200 transform hover:scale-[1.02] shadow-lg hover:shadow-xl">
                <div className="flex items-center justify-center space-x-2">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                    <span>Clear Cache & Reload</span>
                </div>
              </button>
            </div>
            <div className="mt-6 pt-6 border-t border-gray-200">
              <details className="text-sm text-gray-500">
                <summary className="cursor-pointer hover:text-gray-700 font-medium">Technical Information</summary>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg font-mono text-xs">
                  <div>Timestamp: {new Date().toISOString()}</div>
                  <div>Session: {typeof sessionStorage !== 'undefined' ? sessionStorage.getItem("app_init_stats") : "N/A"}</div>
                  <div>Path: {typeof window !== 'undefined' ? window.location.pathname : 'N/A'}</div>
                </div>
              </details>
            </div>
          </div>
        </div>
      }
    >
      {children}
    </ErrorBoundary>
  );
}
