// app/dashboard/equipment/[id]/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useFirebase } from "@/lib/firebase-context";
import { doc, getDoc } from "firebase/firestore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MetricsDisplay } from "@/components/metrics-display";
import { ArrowLeft, Settings, Info, Calendar, AlertCircle } from "lucide-react"; // Changed Alert to AlertCircle
import { useRouter } from "next/navigation";
import React from "react";

export default function EquipmentDetailsPage({ params }: { params: { id: string } }) {
  const [equipment, setEquipment] = useState<any>(null);
  const [location, setLocation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const { db } = useFirebase();
  const router = useRouter();
  
  // Use React.use to unwrap the params
  const resolvedParams = React.use(params);
  const id = resolvedParams.id;

  useEffect(() => {
    const fetchData = async () => {
      if (!db || !id) return;

      try {
        // Fetch equipment details
        const equipmentDoc = await getDoc(doc(db, "equipment", id));

        if (equipmentDoc.exists()) {
          const equipmentData = { id: equipmentDoc.id, ...equipmentDoc.data() };
          setEquipment(equipmentData);

          // Fetch location if there's a locationId
          if (equipmentData.locationId) {
            const locationDoc = await getDoc(doc(db, "locations", equipmentData.locationId));
            if (locationDoc.exists()) {
              setLocation({ id: locationDoc.id, ...locationDoc.data() });
            }
          }
        } else {
          console.error("Equipment not found");
        }
      } catch (error) {
        console.error("Error fetching equipment data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, id]);

  if (loading) {
    return <div className="p-6">Loading equipment details...</div>;
  }

  if (!equipment) {
    return (
      <Card className="m-6">
        <CardHeader>
          <CardTitle>Equipment Not Found</CardTitle>
          <CardDescription>The requested equipment could not be found.</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={() => router.back()}>Go Back</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="mr-2">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-3xl font-bold">{equipment.name}</h1>
        </div>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            onClick={() => router.push(`/dashboard/location/${equipment.locationId}`)}
          >
            <Info className="mr-2 h-4 w-4" />
            View Location
          </Button>
          <Button variant="outline" onClick={() => router.push("/dashboard/settings")}>
            <Settings className="mr-2 h-4 w-4" />
            Settings
          </Button>
        </div>
      </div>

      {/* Overview */}
      <Card>
        <CardHeader>
          <CardTitle>{equipment.name}</CardTitle>
          <CardDescription>
            Type: {equipment.type} | Location: {location?.name || "Unknown"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Status</h3>
              <Badge
                className="mt-1"
                variant={
                  equipment.status === "Fault" ? "destructive" :
                  equipment.status === "Offline" ? "secondary" :
                  "default"
                }
              >
                {equipment.status || "Unknown"}
              </Badge>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Model</h3>
              <p>{equipment.model || "N/A"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Serial Number</h3>
              <p>{equipment.serialNumber || "N/A"}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Last Maintained</h3>
              <p>{equipment.lastMaintenance || "N/A"}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="metrics">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="metrics">Real-time Metrics</TabsTrigger>
          <TabsTrigger value="controls">Controls</TabsTrigger>
          <TabsTrigger value="maintenance">Maintenance</TabsTrigger>
          <TabsTrigger value="alarms">Alarms</TabsTrigger>
        </TabsList>

        <TabsContent value="metrics" className="pt-4">
          {/* Real-time metrics tab */}
          <MetricsDisplay
            locationId={location?.name}
            systemId={equipment.type === "AHU" ? `AHU${equipment.number}` : equipment.id}
            refreshInterval={30000}
          />
        </TabsContent>

        <TabsContent value="controls" className="pt-4">
          {/* Controls tab */}
          <Card>
            <CardHeader>
              <CardTitle>Equipment Controls</CardTitle>
              <CardDescription>Controls for {equipment.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                <p>Controls for this equipment type are not yet implemented.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="maintenance" className="pt-4">
          {/* Maintenance tab */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Calendar className="mr-2 h-5 w-5" />
                Maintenance History
              </CardTitle>
              <CardDescription>Maintenance records for {equipment.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                <p>No maintenance records available.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="alarms" className="pt-4">
          {/* Alarms tab */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <AlertCircle className="mr-2 h-5 w-5" /> {/* Changed Alert to AlertCircle */}
                Alarm History
              </CardTitle>
              <CardDescription>Recent alarms for {equipment.name}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-6 text-muted-foreground">
                <p>No recent alarms.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
