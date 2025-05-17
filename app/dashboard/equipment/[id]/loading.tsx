// app/dashboard/equipment/[id]/loading.tsx
export default function EquipmentLoading() {
  return (
    <div className="space-y-6">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="h-10 w-10 rounded-md bg-gray-200 animate-pulse mr-2"></div>
          <div className="h-8 w-64 bg-gray-200 animate-pulse rounded"></div>
        </div>
        <div className="flex space-x-2">
          <div className="h-10 w-32 bg-gray-200 animate-pulse rounded"></div>
          <div className="h-10 w-32 bg-gray-200 animate-pulse rounded"></div>
        </div>
      </div>

      {/* Equipment Overview Card Skeleton */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 flex flex-col space-y-4">
          <div className="space-y-2">
            <div className="h-6 w-48 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-4 w-64 bg-gray-200 animate-pulse rounded"></div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-start space-x-2">
                <div className="h-4 w-4 bg-gray-200 animate-pulse rounded-full mt-1"></div>
                <div className="space-y-2">
                  <div className="h-5 w-32 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-4 w-48 bg-gray-200 animate-pulse rounded"></div>
                  <div className="h-4 w-40 bg-gray-200 animate-pulse rounded"></div>
                </div>
              </div>
            ))}
          </div>

          {/* Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-2">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="rounded-md border bg-card shadow-sm p-4">
                <div className="flex items-center justify-between">
                  <div className="h-4 w-4 bg-gray-200 animate-pulse rounded-full"></div>
                  <div className="h-8 w-8 bg-gray-200 animate-pulse rounded"></div>
                </div>
                <div className="h-4 w-24 bg-gray-200 animate-pulse rounded mt-2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Equipment Data Card Skeleton */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 flex flex-col space-y-4">
          <div className="space-y-2">
            <div className="h-6 w-32 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-4 w-48 bg-gray-200 animate-pulse rounded"></div>
          </div>

          {/* Equipment Metrics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="rounded-lg border bg-card shadow-sm hover:bg-muted/50 cursor-pointer transition-colors">
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-5 w-40 bg-gray-200 animate-pulse rounded mb-2"></div>
                      <div className="h-4 w-20 bg-gray-200 animate-pulse rounded mb-2"></div>
                    </div>
                    <div className="h-6 w-16 bg-gray-200 animate-pulse rounded-full"></div>
                  </div>
                  
                  {/* Metrics */}
                  <div className="mt-4 space-y-2">
                    {[1, 2, 3].map((j) => (
                      <div key={j} className="flex items-center space-x-2">
                        <div className="h-4 w-4 bg-gray-200 animate-pulse rounded-full"></div>
                        <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                      </div>
                    ))}
                  </div>

                  {/* Last Updated */}
                  <div className="mt-2 flex items-center space-x-2">
                    <div className="h-3 w-3 bg-gray-200 animate-pulse rounded-full"></div>
                    <div className="h-3 w-32 bg-gray-200 animate-pulse rounded"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Zones Section Skeleton */}
      <div className="rounded-lg border bg-card shadow-sm">
        <div className="p-6 flex flex-col space-y-4">
          <div className="space-y-2">
            <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
            <div className="h-4 w-40 bg-gray-200 animate-pulse rounded"></div>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            {[1, 2].map((i) => (
              <div key={i} className="rounded-lg border bg-card shadow-sm p-4">
                <div className="h-5 w-32 bg-gray-200 animate-pulse rounded mb-3"></div>
                <div className="space-y-2">
                  {[1, 2, 3].map((j) => (
                    <div key={j} className="flex items-center space-x-2">
                      <div className="h-4 w-4 bg-gray-200 animate-pulse rounded-full"></div>
                      <div className="h-4 w-full bg-gray-200 animate-pulse rounded"></div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
