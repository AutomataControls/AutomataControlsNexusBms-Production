// hooks/use-realtime-metrics.tsx
import { useState, useEffect, useCallback, useRef } from "react";
import { useFirebase } from "@/lib/firebase-context";
import io from "socket.io-client";

// Define proper types for the data structure
interface MetricsData {
  metrics?: Record<string, any>;
  dateTime?: string;
  datetime?: string;
  alerts?: string[];
  [key: string]: any; // Allow for dynamic properties
}

interface SystemData {
  locationKey: string;
  systemKey: string;
  systemData: MetricsData;
}

export function useRealtimeMetrics(locationId?: string, systemId?: string, refreshInterval = 30000) {
  const [data, setData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const { socket: contextSocket } = useFirebase();
  const [socket, setSocket] = useState<any>(null);
  const [connectionAttempts, setConnectionAttempts] = useState(0);
  const dataReceived = useRef(false);

  // Connect to socket
  useEffect(() => {
    console.log("[useRealtimeMetrics] Initializing with:", {
      locationId,
      systemId,
      contextSocketExists: !!contextSocket
    });

    if (contextSocket) {
      console.log("[useRealtimeMetrics] Using socket from context");
      setSocket(contextSocket);
      return;
    }

    console.log("[useRealtimeMetrics] Creating direct socket connection");
    const newSocket = io("https://neuralbms.automatacontrols.com", {
      path: "/socket.io",
      transports: ["polling", "websocket"],
      reconnectionAttempts: 5, 
      reconnectionDelay: 1000,
      timeout: 60000
    });

    newSocket.on("connect", () => {
      console.log("[useRealtimeMetrics] Direct socket connection established with ID:", newSocket.id);
      setSocket(newSocket);
      setConnectionAttempts(prev => prev + 1);
    });

    newSocket.on("connect_error", (err) => {
      console.error("[useRealtimeMetrics] Socket connection error:", err);
      setError(new Error(`Socket connection error: ${err.message}`));
    });

    // Debug event for disconnections
    newSocket.on("disconnect", (reason) => {
      console.warn("[useRealtimeMetrics] Socket disconnected:", reason);
      if (reason === "io server disconnect") {
        // The server has forcefully disconnected the socket
        console.log("[useRealtimeMetrics] Attempting to reconnect...");
        newSocket.connect();
      }
    });

    return () => {
      if (newSocket) {
        console.log("[useRealtimeMetrics] Closing direct socket connection");
        newSocket.disconnect();
      }
    };
  }, [contextSocket]);

  // Helper to process metrics response
  const handleMetricsResponse = useCallback((response: any) => {
    // Log raw response to see its structure
    console.log("[useRealtimeMetrics] Raw response type:", typeof response);
    if (typeof response === 'object') {
      console.log(
        "[useRealtimeMetrics] Raw response keys:", 
        Object.keys(response),
        "Response sample:", 
        JSON.stringify(response).slice(0, 200) + "..."
      );
    }
    
    // Check if response is an object
    if (!response || typeof response !== 'object') {
      console.error("[useRealtimeMetrics] Invalid response format:", typeof response);
      setError(new Error("Invalid response format from server"));
      setIsLoading(false);
      return;
    }
    
    // Extract data from response (handling different possible structures)
    let metricsData = response;
    
    // Based on your Firebase Realtime DB structure, look for data node
    if (response.data) {
      metricsData = response.data;
      console.log("[useRealtimeMetrics] Using response.data structure");
    } else if (response.metrics) {
      metricsData = response.metrics;
      console.log("[useRealtimeMetrics] Using response.metrics structure");
    } else if (response.result && response.result.data) {
      metricsData = response.result.data;
      console.log("[useRealtimeMetrics] Using response.result.data structure");
    }
    
    // Check for RT database format - empty response might just be the container
    if (Object.keys(metricsData).length === 0 && response) {
      // If response is empty but valid, create a container that looks like our RT DB
      console.log("[useRealtimeMetrics] Creating fallback data structure");
      metricsData = { 
        data: {
          // Use the locationId as a key if provided
          [locationId || "unknown"]: {
            // Use systemId as a key with sample metrics
            [systemId || "system"]: {
              metrics: {
                status: "Waiting for data",
                lastCheck: new Date().toISOString()
              }
            }
          }
        }
      };
    }
    
    // Log the data structure to help troubleshoot
    console.log("[useRealtimeMetrics] Data keys:", 
      Object.keys(metricsData).length > 0 
        ? Object.keys(metricsData) 
        : "Empty data object"
    );
    
    // Check if we have any data at all
    const hasData = Object.keys(metricsData).length > 0;
    
    if (!hasData) {
      console.warn("[useRealtimeMetrics] No data received in the response");
      
      // Even with empty data, we should update state to show we received something
      setData({});
      setIsLoading(false);
      setLastUpdated(new Date());
      dataReceived.current = true;
      return;
    }
    
    // Process successful response
    setData(metricsData);
    setIsLoading(false);
    setLastUpdated(new Date());
    setError(null); // Clear any previous errors on successful fetch
    dataReceived.current = true;
  }, [locationId, systemId]);

  // Fetch metrics data function
  const fetchMetricsData = useCallback(() => {
    if (!socket || !socket.connected) {
      console.warn("[useRealtimeMetrics] Socket not connected, cannot fetch metrics");
      return;
    }

    console.log("[useRealtimeMetrics] Requesting metrics data with timestamp:", Date.now());
    setIsLoading(true);
    
    // Set a timeout to detect if callback is never called
    const timeoutId = setTimeout(() => {
      console.warn("[useRealtimeMetrics] No response received after 5 seconds, trying alternatives");
      
      // Try with a different event name as fallback
      console.log("[useRealtimeMetrics] Trying with alternate event name: getMetrics");
      socket.emit("getMetrics", { timestamp: Date.now() }, (response: any) => {
        if (response) {
          console.log("[useRealtimeMetrics] getMetrics response received");
          handleMetricsResponse(response);
        }
      });
      
      // Also try direct Firebase RT Database path
      console.log("[useRealtimeMetrics] Trying direct RT DB request: getRTData");
      socket.emit("getRTData", { path: "/data" }, (response: any) => {
        if (response) {
          console.log("[useRealtimeMetrics] getRTData response received");
          handleMetricsResponse({ data: response });
        }
      });
      
      // Try requesting just for this location if provided
      if (locationId) {
        console.log(`[useRealtimeMetrics] Trying location-specific request for: ${locationId}`);
        socket.emit("getLocationData", { locationId }, (response: any) => {
          if (response) {
            console.log("[useRealtimeMetrics] getLocationData response received");
            // Wrap in a structure that matches our expected format
            const wrappedResponse = {
              data: {
                [locationId]: response
              }
            };
            handleMetricsResponse(wrappedResponse);
          }
        });
      }
    }, 5000);
    
    // First try with the get_metrics event
    socket.emit("get_metrics", { timestamp: Date.now() }, (response: any) => {
      clearTimeout(timeoutId); // Clear the timeout since we got a response
      console.log("[useRealtimeMetrics] get_metrics response received");
      
      if (!response) {
        console.warn("[useRealtimeMetrics] Received empty response from get_metrics, trying alternate event");
        
        // Try with metrics_request as a fallback
        socket.emit("metrics_request", { timestamp: Date.now() }, (altResponse: any) => {
          console.log("[useRealtimeMetrics] metrics_request response received");
          
          if (!altResponse) {
            console.error("[useRealtimeMetrics] Both metrics requests failed");
            
            // Try one more approach - listen for events instead of callback
            console.log("[useRealtimeMetrics] Setting up one-time metrics listener");
            const onceHandler = (eventData: any) => {
              console.log("[useRealtimeMetrics] Received metrics via event listener");
              handleMetricsResponse(eventData);
              socket.off("metrics", onceHandler);
            };
            
            socket.once("metrics", onceHandler);
            
            // Make a request that might trigger the metrics event
            socket.emit("requestMetrics", { locationId, systemId });
            
            // After a timeout, if we still haven't received data, show an error
            setTimeout(() => {
              socket.off("metrics", onceHandler);
              if (isLoading) {
                setError(new Error("Failed to receive metrics data from server"));
                setIsLoading(false);
              }
            }, 5000);
            
            return;
          }
          
          // Process the alternative response
          handleMetricsResponse(altResponse);
        });
        return;
      }
      
      // Process the normal response
      handleMetricsResponse(response);
    });
  }, [socket, handleMetricsResponse, locationId, systemId, isLoading]);

  // Setup event listeners and initial fetch
  useEffect(() => {
    if (!socket) {
      console.log("[useRealtimeMetrics] Waiting for socket connection...");
      return;
    }

    console.log("[useRealtimeMetrics] Setting up data listeners for socket:", socket.id);
    
    // Listen for metrics updates
    const handleMetricsUpdate = (newData: any) => {
      console.log("[useRealtimeMetrics] Metrics update received");
      if (!newData) {
        console.warn("[useRealtimeMetrics] Received empty update");
        return;
      }
      
      handleMetricsResponse(newData);
    };

    socket.on("metrics_update", handleMetricsUpdate);
    socket.on("metrics", handleMetricsUpdate);
    
    // Additional events to listen for
    socket.on("system_data", handleMetricsUpdate);
    socket.on("equipment_data", handleMetricsUpdate);

    // Initial fetch
    fetchMetricsData();

    return () => {
      console.log("[useRealtimeMetrics] Cleaning up metrics listeners");
      socket.off("metrics_update", handleMetricsUpdate);
      socket.off("metrics", handleMetricsUpdate);
      socket.off("system_data", handleMetricsUpdate);
      socket.off("equipment_data", handleMetricsUpdate);
    };
  }, [socket, fetchMetricsData, handleMetricsResponse]);

  // Auto-refresh on interval
  useEffect(() => {
    if (!socket || !refreshInterval) return;
    
    console.log(`[useRealtimeMetrics] Setting up ${refreshInterval/1000}s refresh interval`);
    
    const interval = setInterval(fetchMetricsData, refreshInterval);
    
    return () => {
      console.log("[useRealtimeMetrics] Clearing refresh interval");
      clearInterval(interval);
    };
  }, [refreshInterval, socket, fetchMetricsData]);

  // Fallback for when no data is received within a timeout period
  useEffect(() => {
    if (dataReceived.current) return;
    
    const timeout = setTimeout(() => {
      if (!dataReceived.current && isLoading) {
        console.log("[useRealtimeMetrics] No data received within timeout, trying direct structure");
        
        // Create a simple data structure for testing
        setData({
          test: {
            system1: {
              metrics: {
                status: "Waiting for data",
                lastCheck: new Date().toISOString()
              }
            }
          }
        });
        setIsLoading(false);
      }
    }, 10000); // 10 second timeout
    
    return () => clearTimeout(timeout);
  }, [isLoading]);

  // Function to get the specific system data for the requested system
  const getRequestedSystemData = useCallback((): SystemData | null => {
    if (!data) {
      console.warn("[useRealtimeMetrics] Missing data");
      return null;
    }

    try {
      // Dump the first 500 chars of data for debugging
      const dataStr = JSON.stringify(data).slice(0, 500);
      console.log("[useRealtimeMetrics] Data sample:", dataStr + "...");
      
      // Special case - if the object is empty, return null
      if (Object.keys(data).length === 0) {
        console.warn("[useRealtimeMetrics] Empty data object");
        return null;
      }
      
      // SPECIFIC CHECK FOR FIREBASE REALTIME DB STRUCTURE
      // Check for /data node which is the root in Firebase RT DB
      if (data.data && typeof data.data === 'object') {
        console.log("[useRealtimeMetrics] Found data node, checking for location");
        
        const rtData = data.data;
        
        // Check if the location exists in the RT database
        if (locationId && rtData[locationId] && typeof rtData[locationId] === 'object') {
          console.log(`[useRealtimeMetrics] Found exact location match in RT DB: ${locationId}`);
          const locationData = rtData[locationId];
          
          // Check if system exists in this location
          if (systemId && locationData[systemId] && typeof locationData[systemId] === 'object') {
            console.log(`[useRealtimeMetrics] Found exact system match: ${systemId}`);
            return {
              locationKey: locationId,
              systemKey: systemId,
              systemData: locationData[systemId] as MetricsData
            };
          }
          
          // Try a fuzzy match for system
          for (const key of Object.keys(locationData)) {
            if (systemId && (key.includes(systemId) || systemId.includes(key))) {
              console.log(`[useRealtimeMetrics] Found fuzzy system match: ${key}`);
              return {
                locationKey: locationId,
                systemKey: key,
                systemData: locationData[key] as MetricsData
              };
            }
          }
          
          // Return first system in location
          const firstSystem = Object.keys(locationData)[0];
          if (firstSystem) {
            console.log(`[useRealtimeMetrics] Using first system in location: ${firstSystem}`);
            return {
              locationKey: locationId,
              systemKey: firstSystem,
              systemData: locationData[firstSystem] as MetricsData
            };
          }
        }
        
        // If location not found, try to find a fuzzy match
        for (const locKey of Object.keys(rtData)) {
          if (locationId && (
              locKey.toLowerCase().includes(locationId.toLowerCase()) || 
              locationId.toLowerCase().includes(locKey.toLowerCase())
          )) {
            console.log(`[useRealtimeMetrics] Found fuzzy location match: ${locKey}`);
            const locationData = rtData[locKey];
            
            // Check for system
            if (systemId && locationData[systemId] && typeof locationData[systemId] === 'object') {
              return {
                locationKey: locKey,
                systemKey: systemId,
                systemData: locationData[systemId] as MetricsData
              };
            }
            
            // First system in location
            const firstSystem = Object.keys(locationData)[0];
            if (firstSystem) {
              return {
                locationKey: locKey,
                systemKey: firstSystem,
                systemData: locationData[firstSystem] as MetricsData
              };
            }
          }
        }
        
        // If still not found, use the first location and system
        const firstLocation = Object.keys(rtData)[0];
        if (firstLocation && typeof rtData[firstLocation] === 'object') {
          console.log(`[useRealtimeMetrics] Using first location: ${firstLocation}`);
          const locationData = rtData[firstLocation];
          
          const firstSystem = Object.keys(locationData)[0];
          if (firstSystem) {
            console.log(`[useRealtimeMetrics] Using first system: ${firstSystem}`);
            return {
              locationKey: firstLocation,
              systemKey: firstSystem,
              systemData: locationData[firstSystem] as MetricsData
            };
          }
        }
      }
      
      // FALLBACK TO GENERAL STRUCTURE HANDLING
      
      // Check if this is a direct metrics object
      if (data.metrics && typeof data.metrics === 'object') {
        console.log("[useRealtimeMetrics] Found direct metrics object");
        return {
          locationKey: locationId || "unknown",
          systemKey: systemId || "system",
          systemData: data as MetricsData
        };
      }
      
      // Try to find a match for the system directly in the root data
      if (systemId && data[systemId] && typeof data[systemId] === 'object') {
        console.log(`[useRealtimeMetrics] Found direct system match in root: ${systemId}`);
        return {
          locationKey: locationId || "unknown",
          systemKey: systemId,
          systemData: data[systemId] as MetricsData
        };
      }
      
      // Try to find a match for the location
      if (locationId && data[locationId] && typeof data[locationId] === 'object') {
        const locationData = data[locationId];
        console.log(`[useRealtimeMetrics] Found location match: ${locationId}`);
        
        // Check if the location directly contains metrics
        if (locationData.metrics && typeof locationData.metrics === 'object') {
          return {
            locationKey: locationId,
            systemKey: "system",
            systemData: locationData as MetricsData
          };
        }
        
        // Check if the location contains the system
        if (systemId && locationData[systemId] && typeof locationData[systemId] === 'object') {
          return {
            locationKey: locationId,
            systemKey: systemId,
            systemData: locationData[systemId] as MetricsData
          };
        }
        
        // Return the first system in the location
        const firstSystem = Object.keys(locationData)[0];
        if (firstSystem) {
          return {
            locationKey: locationId,
            systemKey: firstSystem,
            systemData: locationData[firstSystem] as MetricsData
          };
        }
      }
      
      // Try the first location if one exists
      const firstLocation = Object.keys(data)[0];
      if (firstLocation && typeof data[firstLocation] === 'object') {
        const locationData = data[firstLocation];
        console.log(`[useRealtimeMetrics] Using first location: ${firstLocation}`);
        
        // Check if location is actually a system
        if (locationData.metrics && typeof locationData.metrics === 'object') {
          return {
            locationKey: "unknown",
            systemKey: firstLocation,
            systemData: locationData as MetricsData
          };
        }
        
        // Return first system in location
        const firstSystem = Object.keys(locationData)[0];
        if (firstSystem && typeof locationData[firstSystem] === 'object') {
          return {
            locationKey: firstLocation,
            systemKey: firstSystem,
            systemData: locationData[firstSystem] as MetricsData
          };
        }
      }
      
      // Check for any key that might contain metrics
      for (const key of Object.keys(data)) {
        if (data[key] && typeof data[key] === 'object') {
          if (data[key].metrics && typeof data[key].metrics === 'object') {
            console.log(`[useRealtimeMetrics] Found metrics in key: ${key}`);
            return {
              locationKey: "unknown",
              systemKey: key,
              systemData: data[key] as MetricsData
            };
          }
          
          // One level deeper
          for (const subKey of Object.keys(data[key])) {
            if (data[key][subKey] && typeof data[key][subKey] === 'object' && 
                data[key][subKey].metrics && typeof data[key][subKey].metrics === 'object') {
              console.log(`[useRealtimeMetrics] Found metrics in nested key: ${key}.${subKey}`);
              return {
                locationKey: key,
                systemKey: subKey,
                systemData: data[key][subKey] as MetricsData
              };
            }
          }
        }
      }
      
      console.warn("[useRealtimeMetrics] Could not find suitable metrics data in the response");
      return null;
    } catch (err) {
      console.error("[useRealtimeMetrics] Error getting system data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, [data, locationId, systemId]);

  // Utility function to get a specific metric value
  const getMetricValue = useCallback((metricKey: string): any => {
    const systemInfo = getRequestedSystemData();
    if (!systemInfo) return null;

    return systemInfo.systemData?.metrics?.[metricKey] ?? null;
  }, [getRequestedSystemData]);

  // Debug function to analyze data structure
  const debugDataStructure = useCallback((): string => {
    if (!data) return "No data received";
    
    let debugInfo = `Data object type: ${typeof data}\n`;
    
    if (typeof data !== 'object') {
      return debugInfo + `Non-object data: ${String(data).substring(0, 100)}`;
    }
    
    debugInfo += `Top-level keys: ${Object.keys(data).join(', ') || "none"}\n`;
    
    // Check if metrics exist directly
    if (data.metrics) {
      debugInfo += `Direct metrics found with ${Object.keys(data.metrics).length} properties\n`;
      debugInfo += `Sample metrics: ${Object.keys(data.metrics).slice(0, 5).join(', ')}\n`;
    }
    
    // Check for nested structures
    for (const key of Object.keys(data)) {
      if (typeof data[key] === 'object' && data[key] !== null) {
        debugInfo += `\nStructure for "${key}":\n`;
        
        if (data[key].metrics) {
          debugInfo += `  - Contains metrics with ${Object.keys(data[key].metrics).length} properties\n`;
          debugInfo += `  - Sample: ${Object.keys(data[key].metrics).slice(0, 3).join(', ')}\n`;
        } else {
          const subKeys = Object.keys(data[key]);
          debugInfo += `  - Contains ${subKeys.length} properties: ${subKeys.slice(0, 5).join(', ')}\n`;
          
          // Look one level deeper
          for (const subKey of subKeys.slice(0, 3)) {
            if (typeof data[key][subKey] === 'object' && data[key][subKey] !== null) {
              debugInfo += `    - "${subKey}" contains: ${Object.keys(data[key][subKey]).slice(0, 3).join(', ')}\n`;
            }
          }
        }
      }
    }
    
    return debugInfo;
  }, [data]);

  // Force a manual refresh
  const refresh = useCallback(() => {
    console.log("[useRealtimeMetrics] Manual refresh triggered");
    fetchMetricsData();
  }, [fetchMetricsData]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    socket,
    getMetricValue,
    getRequestedSystemData,
    refresh,
    debugDataStructure,
    connectionAttempts
  };
}

export default useRealtimeMetrics;
