"use client"
import { useRouter } from "next/navigation"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Settings } from "lucide-react"

export default function AlarmsContent() {
  const router = useRouter()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Alarms</h1>
        <Button variant="outline" onClick={() => router.push("/dashboard/settings")} className="hover:bg-[#e6f3f1]">
          <Settings className="mr-2 h-4 w-4" />
          Settings
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Alarm Management</CardTitle>
          <CardDescription>View and manage system alarms.</CardDescription>
        </CardHeader>
        <CardContent>
          <p>Alarm data and controls will be displayed here.</p>
        </CardContent>
      </Card>
    </div>
  )
}

