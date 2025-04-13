"use client";

import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ref, onValue } from "firebase/database";
import { secondaryDb } from "@/lib/secondary-firebase";

interface MetricsDisplayProps {
  // Use the location name or numeric id (as a string) directly.
  locationId?: string;
  // Use the system name directly.
  systemId?: string;
  className?: string;
  refreshInterval?: number;
}

export function MetricsDisplay({
  locationId,
  systemId,
  className = "",
  refreshInterval = 30000,
}: MetricsDisplayProps) {
  const [data, setData] = useState<any>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const rtdbRef = useRef<any>(null);

  // Initialize RTDB connection using the secondary DB
  useEffect(() => {
    try {
      console.log("MetricsDisplay - Initializing RTDB (secondary) connection");
      rtdbRef.current = secondaryDb;
      console.log("MetricsDisplay - RTDB (secondary) initialized successfully");
    } catch (err: any) {
      console.error("MetricsDisplay - Error initializing RTDB:", err);
      setError(new Error(`Failed to initialize database connection: ${err.message}`));
    }
  }, []);

  // Set up realtime data listener
  useEffect(() => {
    if (!rtdbRef.current) {
      console.log("MetricsDisplay - Waiting for RTDB initialization");
      return;
    }
    setIsLoading(true);
    try {
      // Query the /locations node in RTDB
      const dataRef = ref(rtdbRef.current, "/locations");
      const unsubscribe = onValue(
        dataRef,
        (snapshot) => {
          const dbData = snapshot.val();
          console.log("MetricsDisplay - Data updated from RTDB", dbData);
          setData(dbData || {});
          setIsLoading(false);
          setLastUpdated(new Date());
        },
        (err) => {
          console.error("MetricsDisplay - RTDB error:", err);
          setError(new Error(`Database error: ${err.message}`));
          setIsLoading(false);
        }
      );
      return () => {
        console.log("MetricsDisplay - Cleaning up RTDB listener");
        unsubscribe();
      };
    } catch (err: any) {
      console.error("MetricsDisplay - Error setting up RTDB listener:", err);
      setError(new Error(`Failed to set up data listener: ${err.message}`));
      setIsLoading(false);
    }
  }, []);

  // getSystemData now uses locationId and systemId directly
  const getSystemData = () => {
    if (!data || !locationId) return null;
    try {
      const locationsData = data;
      console.log("MetricsDisplay - Available locations in database:", Object.keys(locationsData));

      if (!locationsData[locationId]) {
        console.log(`MetricsDisplay - No matching location found for: ${locationId}`);
        return null;
      }
      console.log(`MetricsDisplay - Found matching location: ${locationId}`);
      const locationData = locationsData[locationId];

      if (!locationData.systems) {
        console.log(`MetricsDisplay - No systems found for location: ${locationId}`);
        return null;
      }
      const systems = Object.keys(locationData.systems);
      console.log("MetricsDisplay - Available systems:", systems);

      if (!systemId) {
        console.log("MetricsDisplay - No systemId provided, using first available system");
        const firstKey = systems[0];
        return {
          locationKey: locationId,
          systemKey: firstKey,
          systemData: locationData.systems[firstKey],
        };
      }

      if (locationData.systems[systemId]) {
        return {
          locationKey: locationId,
          systemKey: systemId,
          systemData: locationData.systems[systemId],
        };
      } else {
        console.log(`MetricsDisplay - System ${systemId} not found, using first available system`);
        const firstKey = systems[0];
        return {
          locationKey: locationId,
          systemKey: firstKey,
          systemData: locationData.systems[firstKey],
        };
      }
    } catch (err: any) {
      console.error("MetricsDisplay - Error getting system data:", err);
      return null;
    }
  };

  if (isLoading && Object.keys(data).length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Realtime Metrics</CardTitle>
          <CardDescription>Loading metrics data...</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6">Loading metrics...</div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Realtime Metrics</CardTitle>
          <CardDescription>Error loading metrics</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center text-red-500 p-6">{error.message}</div>
        </CardContent>
      </Card>
    );
  }

  const systemInfo = getSystemData();
  if (!systemInfo) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle>Realtime Metrics</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center p-6">
            No metrics data available for {systemId} at {locationId}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle>{systemInfo.systemKey} Metrics</CardTitle>
        <CardDescription>
          {systemInfo.locationKey} - Last updated: {lastUpdated.toLocaleString()}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(systemInfo.systemData.metrics).map(([key, value]) => (
            <div key={key} className="bg-muted/10 p-3 rounded-lg border">
              <div className="text-sm font-medium text-muted-foreground">{key}</div>
              <div className="text-xl font-bold">{value?.toString()}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
