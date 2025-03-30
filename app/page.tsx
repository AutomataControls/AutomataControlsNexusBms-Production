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
        <h1
          style={{
            fontFamily: "var(--font-cinzel)",
            color: "#2dd4bf",
            fontSize: "1.875rem",
            fontWeight: "bold",
            marginBottom: "0.5rem",
          }}
        >
          Automata Controls BMS
        </h1>

        {/* Subtitle */}
        <p
          style={{
            color: "#fdba74",
            marginBottom: "2rem",
          }}
        >
          Building Management System
        </p>

        {/* Login Button */}
        <a
          href="/login"
          style={{
            backgroundColor: "#2dd4bf",
            color: "white",
            padding: "0.5rem 1rem",
            borderRadius: "0.375rem",
            textDecoration: "none",
            fontWeight: "500",
          }}
        >
          Go to Login
        </a>
      </div>
    </div>
  )
}

