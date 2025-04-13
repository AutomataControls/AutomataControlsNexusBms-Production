import { useState, useEffect, useCallback } from "react";
import { ref, onValue } from "firebase/database";
import { secondaryDb } from "@/lib/secondary-firebase";

interface MetricsData {
  metrics?: Record<string, any>;
  dateTime?: string;
  datetime?: string;
  alerts?: string[];
  [key: string]: any;
}

interface SystemData {
  locationKey: string;
  systemKey: string;
  systemData: MetricsData;
}

export function useFirebaseMetrics(locationId?: string, systemId?: string, refreshInterval = 30000) {
  const [data, setData] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  // Fetch metrics data from the secondary RTDB
  const fetchMetricsData = useCallback(async () => {
    if (!secondaryDb) {
      console.error("[useFirebaseMetrics] Secondary database instance not available");
      setError(new Error("Secondary database instance not available"));
      setIsLoading(false);
      return;
    }
    try {
      console.log("[useFirebaseMetrics] Fetching data from Realtime Database");
      setIsLoading(true);
      const locationsRef = ref(secondaryDb, "/locations");
      // Use locationId directly; if none provided, fetch all locations.
      const metricsRef = locationId
        ? ref(secondaryDb, `/locations/${locationId}/systems`)
        : locationsRef;
      const snapshot = await new Promise<any>((resolve, reject) => {
        onValue(metricsRef, resolve, reject, { onlyOnce: true });
      });
      const metricsData = snapshot.val();
      console.log("[useFirebaseMetrics] Data received:",
        metricsData ? Object.keys(metricsData).length : "No data");
      if (!metricsData) {
        console.warn("[useFirebaseMetrics] No data found at path");
        const oldPathRef = ref(secondaryDb, "/data");
        const oldSnapshot = await new Promise<any>((resolve, reject) => {
          onValue(oldPathRef, resolve, reject, { onlyOnce: true });
        });
        const oldData = oldSnapshot.val();
        if (oldData) {
          console.log("[useFirebaseMetrics] Found data in legacy path");
          setData({ data: oldData });
        } else {
          setData({});
        }
      } else {
        if (locationId) {
          setData({
            locations: {
              [locationId]: {
                systems: metricsData
              }
            }
          });
        } else {
          setData({
            locations: metricsData
          });
        }
      }
      setIsLoading(false);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error("[useFirebaseMetrics] Error fetching data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsLoading(false);
    }
  }, [locationId]);

  useEffect(() => {
    fetchMetricsData();
  }, [fetchMetricsData]);

  useEffect(() => {
    if (!refreshInterval) return;
    console.log(`[useFirebaseMetrics] Setting up ${refreshInterval / 1000}s refresh interval`);
    const interval = setInterval(fetchMetricsData, refreshInterval);
    return () => {
      console.log("[useFirebaseMetrics] Clearing refresh interval");
      clearInterval(interval);
    };
  }, [refreshInterval, fetchMetricsData]);

  const getRequestedSystemData = useCallback((): SystemData | null => {
    if (!data || Object.keys(data).length === 0) {
      console.warn("[useFirebaseMetrics] No data available");
      return null;
    }
    try {
      if (data.locations) {
        console.log("[useFirebaseMetrics] Processing data from new structure");
        const locationsData = data.locations;
        let matchedLocation = locationId && locationsData[locationId]
          ? locationId
          : Object.keys(locationsData)[0];
        console.log(`[useFirebaseMetrics] Using location: ${matchedLocation}`);
        const locationData = locationsData[matchedLocation];
        if (!locationData || !locationData.systems) {
          console.warn(`[useFirebaseMetrics] No systems found for location: ${matchedLocation}`);
          return null;
        }
        const systemsData = locationData.systems;
        console.log("[useFirebaseMetrics] Available systems:", Object.keys(systemsData));
        let matchedSystem = systemId && systemsData[systemId]
          ? systemId
          : Object.keys(systemsData)[0];
        console.log(`[useFirebaseMetrics] Using system: ${matchedSystem}`);
        return {
          locationKey: matchedLocation,
          systemKey: matchedSystem,
          systemData: systemsData[matchedSystem]
        };
      } else if (data.data) {
        console.log("[useFirebaseMetrics] Processing data from legacy structure");
        const dataRoot = data.data;
        if (!dataRoot || Object.keys(dataRoot).length === 0) {
          console.warn("[useFirebaseMetrics] No locations found in legacy data");
          return null;
        }
        console.log("[useFirebaseMetrics] Available locations in legacy data:", Object.keys(dataRoot));
        let matchedLocation = locationId && dataRoot[locationId]
          ? locationId
          : Object.keys(dataRoot)[0];
        console.log(`[useFirebaseMetrics] Using legacy location: ${matchedLocation}`);
        const locationData = dataRoot[matchedLocation];
        if (!locationData || Object.keys(locationData).length === 0) {
          console.warn(`[useFirebaseMetrics] No systems found for legacy location: ${matchedLocation}`);
          return null;
        }
        console.log("[useFirebaseMetrics] Available legacy systems:", Object.keys(locationData));
        let matchedSystem = systemId && locationData[systemId]
          ? systemId
          : Object.keys(locationData)[0];
        console.log(`[useFirebaseMetrics] Using legacy system: ${matchedSystem}`);
        return {
          locationKey: matchedLocation,
          systemKey: matchedSystem,
          systemData: locationData[matchedSystem]
        };
      }
      console.warn("[useFirebaseMetrics] Unknown data structure");
      return null;
    } catch (err) {
      console.error("[useFirebaseMetrics] Error getting system data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    }
  }, [data, locationId, systemId]);

  const getMetricValue = useCallback((metricKey: string): any => {
    const systemInfo = getRequestedSystemData();
    if (!systemInfo) return null;
    return systemInfo.systemData?.metrics?.[metricKey] ?? null;
  }, [getRequestedSystemData]);

  const debugDataStructure = useCallback((): string => {
    if (!data) return "No data received";
    let debugInfo = `Data object type: ${typeof data}\n`;
    if (typeof data !== 'object') {
      return debugInfo + `Non-object data: ${String(data).substring(0, 100)}`;
    }
    debugInfo += `Top-level keys: ${Object.keys(data).join(', ') || "none"}\n`;
    if (data.locations) {
      debugInfo += "Using new database structure (/locations)\n";
      const locations = data.locations;
      debugInfo += `Available locations (${Object.keys(locations).length}): ${Object.keys(locations).join(', ')}\n`;
      const firstLocation = Object.keys(locations)[0];
      if (firstLocation) {
        debugInfo += `Systems for ${firstLocation}: ${Object.keys(locations[firstLocation].systems || {}).join(', ')}\n`;
        const firstSystem = Object.keys(locations[firstLocation].systems || {})[0];
        if (firstSystem) {
          const systemData = locations[firstLocation].systems[firstSystem];
          debugInfo += `Data fields in ${firstSystem}: ${Object.keys(systemData).join(', ')}\n`;
          if (systemData.metrics) {
            debugInfo += `Available metrics (${Object.keys(systemData.metrics).length}): ${Object.keys(systemData.metrics).slice(0, 5).join(', ')}...\n`;
          }
        }
      }
    } else if (data.data) {
      debugInfo += "Using legacy database structure (/data)\n";
      const legacyData = data.data;
      debugInfo += `Available locations (${Object.keys(legacyData).length}): ${Object.keys(legacyData).join(', ')}\n`;
      const firstLocation = Object.keys(legacyData)[0];
      if (firstLocation) {
        debugInfo += `Systems for ${firstLocation}: ${Object.keys(legacyData[firstLocation]).join(', ')}\n`;
        const firstSystem = Object.keys(legacyData[firstLocation])[0];
        if (firstSystem) {
          const systemData = legacyData[firstLocation][firstSystem];
          debugInfo += `Data fields in ${firstSystem}: ${Object.keys(systemData).join(', ')}\n`;
          if (systemData.metrics) {
            debugInfo += `Available metrics (${Object.keys(systemData.metrics).length}): ${Object.keys(systemData.metrics).slice(0, 5).join(', ')}...\n`;
          }
        }
      }
    }
    return debugInfo;
  }, [data]);

  const refresh = useCallback(() => {
    console.log("[useFirebaseMetrics] Manual refresh triggered");
    fetchMetricsData();
  }, [fetchMetricsData]);

  return {
    data,
    isLoading,
    error,
    lastUpdated,
    getMetricValue,
    getRequestedSystemData,
    refresh,
    debugDataStructure
  };
}

export default useFirebaseMetrics;
