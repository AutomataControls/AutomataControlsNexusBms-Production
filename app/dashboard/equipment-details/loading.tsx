// app/dashboard/equipment-details/loading.tsx
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"

export default function EquipmentDetailsLoading() {
  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex items-center mb-6">
        <Skeleton className="h-10 w-[100px] mr-4" />
        <div>
          <Skeleton className="h-8 w-[300px] mb-2" />
          <Skeleton className="h-5 w-[250px]" />
        </div>
      </div>

      <div className="grid w-full grid-cols-4 h-10 mb-4 bg-gray-100 rounded-lg">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-full mx-1 rounded-md" />
        ))}
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <Skeleton className="h-6 w-[180px] mb-2" />
              <Skeleton className="h-4 w-[230px]" />
            </div>
            <Skeleton className="h-9 w-[100px]" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array(12).fill(0).map((_, i) => (
              <div key={i} className="bg-muted/10 p-3 rounded-lg border">
                <Skeleton className="h-4 w-[100px] mb-2" />
                <Skeleton className="h-6 w-[120px]" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[180px] mb-2" />
            <Skeleton className="h-4 w-[220px]" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Skeleton className="h-5 w-[150px] mb-2" />
                <div className="space-y-2">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <Skeleton key={i} className="h-4 w-full" />
                  ))}
                </div>
              </div>
              
              <div>
                <Skeleton className="h-5 w-[100px] mb-2" />
                <div className="flex items-center">
                  <Skeleton className="h-4 w-4 mr-2" />
                  <Skeleton className="h-4 w-[180px]" />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-[120px] mb-2" />
            <Skeleton className="h-4 w-[180px]" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[120px] w-full" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-[150px] mb-2" />
          <Skeleton className="h-4 w-[220px]" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {[1, 2, 3].map((group) => (
              <div key={group}>
                <Skeleton className="h-6 w-[120px] mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {Array(6).fill(0).map((_, i) => (
                    <div key={i} className="flex justify-between items-center border-b pb-2">
                      <Skeleton className="h-4 w-[140px]" />
                      <div className="flex items-center">
                        <Skeleton className="h-4 w-[80px] mr-2" />
                        <Skeleton className="h-2 w-2 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

