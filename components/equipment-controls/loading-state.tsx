import { Loader2 } from "lucide-react"

export function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] w-full">
      <Loader2 className="h-12 w-12 animate-spin text-teal-500" />
      <p className="mt-4 text-teal-600 font-medium">Initializing controls...</p>
      <p className="text-sm text-gray-500 mt-2">Please wait while the system connects to the database</p>
    </div>
  )
}
