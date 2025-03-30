export const dynamic = "force-dynamic"
import Link from "next/link"
import Image from "next/image"

export default function Home() {
  return (
    <div style={{
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      minHeight: "100vh",
      background: "linear-gradient(to bottom, #eff6ff, #ffffff)"
    }}>
      <div style={{
        textAlign: "center",
        padding: "2rem",
        maxWidth: "28rem"
      }}>
        {/* Logo Image */}
        <div style={{
          display: "flex",
          justifyContent: "center",
          marginBottom: "1.5rem"
        }}>
          <div style={{
            borderRadius: "9999px",
            overflow: "hidden",
            width: "4rem",
            height: "4rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <Image 
              src="/neural-loader.png" 
              alt="Automata Controls Logo" 
              width={64} 
              height={64} 
              priority 
              onError={() => console.error('Image failed to load')}
            />
          </div>
        </div>

        {/* Title with Cinzel font */}
        <h1 style={{
          fontFamily: "var(--font-cinzel), serif",
          color: "#14b8a6", // teal-500
          fontSize: "1.875rem",
          lineHeight: "2.25rem",
          fontWeight: "bold",
          marginBottom: "0.5rem"
        }}>
          Automata Controls BMS
        </h1>

        {/* Subtitle */}
        <p style={{
          color: "#fdba74", // orange-300
          marginBottom: "2rem"
        }}>
          Building Management System
        </p>

        {/* Login Button */}
        <Link href="/login" style={{
          display: "inline-block",
          backgroundColor: "#2dd4bf", // teal-400
          color: "white",
          padding: "0.5rem 2rem",
          borderRadius: "0.375rem",
          textDecoration: "none",
          fontWeight: "500",
          transition: "background-color 0.2s ease-in-out"
        }} 
        onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#14b8a6"} // teal-500 on hover
        onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#2dd4bf"} // back to teal-400
        >
          Go to Login
        </Link>
      </div>
    </div>
  )
}