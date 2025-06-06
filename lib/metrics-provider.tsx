// @ts-nocheck
// lib/metrics-provider.tsx
"use client"

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { secondaryDb, ref, onValue, off } from './secondary-firebase';

// Define types for the metrics data
export interface MetricValue {
  [key: string]: string | number | boolean;
}

export interface SystemData {
  datetime: string;
  location: string;
  metrics: {
    [key: string]: string | number | boolean;
  };
  source: string;
  system: string;
  timestamp: number;
}

export interface LocationData {
  [systemId: string]: SystemData;
}

export interface MetricsData {
  [location: string]: LocationData;
}

// Context to provide metrics data throughout the app
interface MetricsContextType {
  metricsData: MetricsData;
  isLoading: boolean;
  error: string | null;
  getMetricsForLocation: (locationId: string) => LocationData;
  getMetricsForSystem: (locationId: string, systemId: string) => SystemData | null;
  getMetricValue: (locationId: string, systemId: string, metricKey: string) => string | number | boolean | null;
}

const MetricsContext = createContext<MetricsContextType>({
  metricsData: {},
  isLoading: true,
  error: null,
  getMetricsForLocation: () => ({}),
  getMetricsForSystem: () => null,
  getMetricValue: () => null,
});

// Hook to use metrics data
export const useMetrics = () => useContext(MetricsContext);

interface MetricsProviderProps {
  children: ReactNode;
}

export const MetricsProvider: React.FC<MetricsProviderProps> = ({ children }) => {
  const [metricsData, setMetricsData] = useState<MetricsData>({});
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Reference to the data node in the realtime database
    const dataRef = ref(secondaryDb, '/data');
    
    const handleMetricsUpdate = (snapshot: any) => {
      try {
        const data = snapshot.val();
        if (!data) {
          setMetricsData({});
          setIsLoading(false);
          return;
        }
        
        setMetricsData(data);
        setIsLoading(false);
      } catch (err) {
        console.error('Error processing metrics data:', err);
        setError('Failed to process metrics data');
        setIsLoading(false);
      }
    };

    onValue(dataRef, handleMetricsUpdate, (err) => {
      console.error('Realtime database error:', err);
      setError('Failed to connect to realtime database');
      setIsLoading(false);
    });

    // Cleanup subscription when component unmounts
    return () => {
      off(dataRef);
    };
  }, []);

  // Helper function to get metrics for a specific location
  const getMetricsForLocation = (locationId: string): LocationData => {
    const normalizedLocationId = locationId.toLowerCase();
    
    // Find the location with case-insensitive match
    const locationKey = Object.keys(metricsData).find(
      key => key.toLowerCase() === normalizedLocationId
    );
    
    return locationKey ? metricsData[locationKey] : {};
  };

  // Helper function to get metrics for a specific system
  const getMetricsForSystem = (locationId: string, systemId: string): SystemData | null => {
    const locationData = getMetricsForLocation(locationId);
    if (!locationData) return null;
    
    const normalizedSystemId = systemId.toLowerCase();
    
    // Find the system with case-insensitive match
    const systemKey = Object.keys(locationData).find(
      key => key.toLowerCase() === normalizedSystemId
    );
    
    return systemKey ? locationData[systemKey] : null;
  };

  // Helper function to get a specific metric value
  const getMetricValue = (
    locationId: string, 
    systemId: string, 
    metricKey: string
  ): string | number | boolean | null => {
    const systemData = getMetricsForSystem(locationId, systemId);
    if (!systemData || !systemData.metrics) return null;
    
    const normalizedMetricKey = metricKey.toLowerCase();
    
    // Find the metric with case-insensitive match
    const foundKey = Object.keys(systemData.metrics).find(
      key => key.toLowerCase() === normalizedMetricKey
    );
    
    return foundKey ? systemData.metrics[foundKey] : null;
  };

  return (
    <MetricsContext.Provider 
      value={{ 
        metricsData, 
        isLoading, 
        error,
        getMetricsForLocation,
        getMetricsForSystem,
        getMetricValue
      }}
    >
      {children}
    </MetricsContext.Provider>
  );
};
