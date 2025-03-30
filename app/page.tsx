export const dynamic = "force-dynamic"
import Image from "next/image"

export default function Home() {
  return (
    <main className="flex items-center justify-center min-h-screen bg-white">
      <div className="text-center space-y-6">
        <div className="flex justify-center">
          <div className="rounded-full overflow-hidden w-24 h-24 flex items-center justify-center bg-white shadow-lg">
            <Image src="/neural-loader.png" alt="Automata Controls Logo" width={80} height={80} priority className="object-contain" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="font-cinzel text-[2.5rem] font-bold text-teal-400 tracking-wide">
            AUTOMATA CONTROLS BMS
          </h1>

          <p className="text-orange-300 text-lg">
            Building Management System
          </p>
        </div>

        <div>
          <a
            href="/login"
            className="inline-block bg-teal-400 text-white px-6 py-3 rounded-lg font-medium hover:bg-teal-500 transition-colors text-lg"
          >
            Go to Login
          </a>
        </div>
      </div>
    </main>
  )
}

