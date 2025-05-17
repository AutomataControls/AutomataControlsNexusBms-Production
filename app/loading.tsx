// app/loading.tsx
import Image from "next/image"

export default function RootLoading() {
  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="container mx-auto max-w-6xl px-4 flex-1 flex flex-col items-center" style={{ paddingLeft: "950px" }}>
        <div className="flex-1 flex items-center justify-center -mt-24">
          <div className="text-center">
            <div className="mb-12 flex justify-center">
              <div className="overflow-hidden w-32 h-32 flex items-center justify-center bg-white">
                <div className="animate-spin h-24 w-24 rounded-full border-t-4 border-b-4 border-teal-400"></div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="h-10 w-80 mx-auto bg-teal-100 animate-pulse rounded-md"></div>
              <div className="h-6 w-48 mx-auto bg-orange-100 animate-pulse rounded-md mb-8"></div>
            </div>
            <div className="mt-6">
              <div className="inline-block bg-teal-100 animate-pulse h-12 w-32 rounded-lg"></div>
            </div>
            <div className="mt-12 text-xl tracking-wide">
              <div className="h-8 w-full mx-auto bg-gray-100 animate-pulse rounded-md"></div>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto max-w-6xl px-4 bg-transparent relative z-10" style={{ paddingLeft: "1050px" }}>
        <div className="h-12 w-full mx-auto bg-gray-50 animate-pulse rounded-md mt-6"></div>
      </div>
    </div>
  )
}
