export default function LoginLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen w-full bg-zinc-900">
      <div className="w-full max-w-2xl px-4">
        <div className="w-full bg-gray-800 border-gray-700 rounded-lg border p-6 shadow-sm">
          <div className="space-y-4">
            {/* Logo and title area */}
            <div className="flex items-center justify-center mb-6">
              <div className="h-[150px] w-[150px] bg-gray-700 animate-pulse rounded-full mr-6"></div>
              <div className="space-y-2">
                <div className="h-10 w-64 bg-gray-700 animate-pulse rounded"></div>
                <div className="h-8 w-48 bg-gray-700 animate-pulse rounded"></div>
              </div>
            </div>
            
            {/* Title and description */}
            <div className="h-8 w-32 mx-auto bg-gray-700 animate-pulse rounded"></div>
            <div className="h-6 w-72 mx-auto bg-gray-700 animate-pulse rounded"></div>
            
            {/* Tabs */}
            <div className="grid w-full grid-cols-2 h-10 mb-4 bg-gray-700 rounded">
              <div className="rounded-l-md bg-gray-600 h-full"></div>
              <div className="rounded-r-md h-full"></div>
            </div>
            
            {/* Form fields */}
            <div className="space-y-6 pt-6">
              <div className="space-y-3">
                <div className="h-6 w-20 bg-gray-700 animate-pulse rounded"></div>
                <div className="h-12 w-full bg-gray-700 animate-pulse rounded"></div>
              </div>
              
              <div className="space-y-3">
                <div className="h-6 w-20 bg-gray-700 animate-pulse rounded"></div>
                <div className="h-12 w-full bg-gray-700 animate-pulse rounded"></div>
              </div>
            </div>
            
            {/* Buttons */}
            <div className="pt-6 space-y-6">
              <div className="flex justify-between w-full gap-4">
                <div className="flex-1 h-12 bg-teal-600/50 animate-pulse rounded"></div>
                <div className="h-12 w-24 bg-gray-700 animate-pulse rounded"></div>
              </div>
              
              {/* Divider */}
              <div className="relative py-4">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-gray-600"></span>
                </div>
                <div className="relative flex justify-center">
                  <div className="bg-gray-800 px-2 h-4 w-32 bg-gray-700 animate-pulse rounded"></div>
                </div>
              </div>
              
              {/* Google button */}
              <div className="flex justify-center">
                <div className="h-12 w-64 bg-gray-700 animate-pulse rounded"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
