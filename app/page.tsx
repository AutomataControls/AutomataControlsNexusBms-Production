export const dynamic = "force-dynamic"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"

export default function Home() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="text-center p-8 max-w-md">
        <div className="flex justify-center mb-6">
          <div className="rounded-full overflow-hidden w-16 h-16 flex items-center justify-center">
            <Image src="/neural-loader.png" alt="Automata Controls Logo" width={64} height={64} priority />
          </div>
        </div>

        <h1 className="text-3xl font-bold text-teal-500 mb-2 font-cinzel">Automata Controls BMS</h1>
        <p className="text-orange-300 mb-8">Building Management System</p>

        <Button asChild className="bg-teal-400 hover:bg-teal-500 text-white px-8 py-2 rounded-md transition-colors">
          <Link href="/login">Go to Login</Link>
        </Button>
      </div>
    </div>
  )
}

