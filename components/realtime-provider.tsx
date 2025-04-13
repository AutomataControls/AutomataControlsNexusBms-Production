// components/realtime-provider.tsx
import React, { useEffect } from 'react';
import { useRealtimeDBConnector } from '@/lib/realtime-db-connector-refined';
import { useToast } from '@/components/ui/use-toast';

interface RealtimeProviderProps {
  children: React.ReactNode;
}

/**
 * This provider component connects to the Firebase Realtime Database
 * and makes the data available through the existing socket.io infrastructure
 * This should be added near the root of your app, ideally within the SocketProvider
 */
export function RealtimeProvider({ children }: RealtimeProviderProps) {
  const { isConnected, error } = useRealtimeDBConnector();
  const { toast } = useToast();

  // Show connection status updates
  useEffect(() => {
    if (isConnected) {
      console.log('Connected to Firebase Realtime Database');
    }
    
    if (error) {
      console.error('Firebase Realtime Database error:', error);
      toast({
        title: 'Connection Error',
        description: `Failed to connect to metrics database: ${error}`,
        variant: 'destructive',
      });
    }
  }, [isConnected, error, toast]);

  return <>{children}</>;
}
