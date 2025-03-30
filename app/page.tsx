export const dynamic = "force-dynamic"
import Image from "next/image"

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center">
        {/* Logo Image */}
        <div className="flex justify-center mb-6">
          <div className="rounded-full overflow-hidden w-16 h-16 flex items-center justify-center">
            <Image src="/neural-loader.png" alt="Automata Controls Logo" width={64} height={64} priority />
          </div>
        </div>

        {/* Title with Cinzel font */}
        <h1 className="font-cinzel text-teal-400 text-3xl font-bold mb-2">
          AUTOMATA CONTROLS BMS
        </h1>

        {/* Subtitle */}
        <p className="text-orange-300 mb-8">
          Building Management System
        </p>

        {/* Login Button */}
        <a
          href="/login"
          className="bg-teal-400 text-white px-4 py-2 rounded-md font-medium hover:bg-teal-500 transition-colors"
        >
          Go to Login
        </a>
      </div>
    </div>
  )
}

