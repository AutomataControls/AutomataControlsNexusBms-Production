// app/page.tsx - Absolutely Centered Landing Page
"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useAuth } from "@/lib/auth-context"
import Image from "next/image"
import { AppFooter } from "@/components/app-footer"

export default function HomePage() {
  const { user, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && user) {
      // If logged in, redirect to dashboard after brief delay
      const timer = setTimeout(() => {
        router.replace("/dashboard")
      }, 1500)
      return () => clearTimeout(timer)
    }
  }, [user, loading, router])

  // Show loading state - ABSOLUTELY CENTERED
  if (loading) {
    return (
      <div 
        className="min-h-screen bg-white"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Image 
              src="/neural-loader.png" 
              alt="Automata Controls Logo" 
              width={120} 
              height={120} 
              priority 
              style={{ 
                margin: '0 auto', 
                display: 'block',
                animation: 'pulse 2s infinite'
              }}
            />
          </div>
          <div 
            style={{
              width: '32px',
              height: '32px',
              border: '2px solid #14b8a6',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              margin: '0 auto',
              animation: 'spin 1s linear infinite'
            }}
          ></div>
          <p style={{ color: '#14b8a6', marginTop: '1rem', fontSize: '16px' }}>
            Loading...
          </p>
        </div>
      </div>
    )
  }

  // If user is logged in, show brief message before redirect - ABSOLUTELY CENTERED
  if (user) {
    return (
      <div 
        className="min-h-screen bg-white"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <div style={{ marginBottom: '2rem' }}>
            <Image 
              src="/neural-loader.png" 
              alt="Automata Controls Logo" 
              width={120} 
              height={120} 
              priority 
              style={{ margin: '0 auto', display: 'block' }}
            />
          </div>
          <h2 
            style={{ 
              fontSize: '2rem', 
              fontWeight: 'bold', 
              color: '#14b8a6', 
              marginBottom: '1rem',
              fontFamily: "var(--font-cinzel), serif"
            }}
          >
            Welcome back!
          </h2>
          <p style={{ color: '#fb923c', fontSize: '16px', marginBottom: '1rem' }}>
            Redirecting to dashboard...
          </p>
          <div 
            style={{
              width: '24px',
              height: '24px',
              border: '2px solid #14b8a6',
              borderTop: '2px solid transparent',
              borderRadius: '50%',
              margin: '0 auto',
              animation: 'spin 1s linear infinite'
            }}
          ></div>
        </div>
      </div>
    )
  }

  // Landing page for non-authenticated users - ABSOLUTELY CENTERED
  return (
    <>
      <style jsx>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
      
      <div className="min-h-screen bg-white" style={{ display: 'flex', flexDirection: 'column' }}>
        {/* Main Content - ABSOLUTELY CENTERED */}
        <div 
          style={{
            flex: '1',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '2rem'
          }}
        >
          <div style={{ textAlign: 'center', width: '100%', maxWidth: '1200px' }}>
            {/* Logo */}
            <div style={{ marginBottom: '3rem' }}>
              <div 
                style={{
                  width: '128px',
                  height: '128px',
                  margin: '0 auto',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <Image 
                  src="/neural-loader.png" 
                  alt="Automata Controls Logo" 
                  width={180} 
                  height={180} 
                  priority 
                  style={{
                    objectFit: 'contain',
                    transition: 'transform 0.3s ease',
                    cursor: 'pointer'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                />
              </div>
            </div>

            {/* Main Title */}
            <div style={{ marginBottom: '2rem' }}>
              <h1 
                style={{
                  fontSize: 'clamp(1.5rem, 4vw, 2.5rem)',
                  fontWeight: 'bold',
                  color: '#14b8a6',
                  letterSpacing: '0.05em',
                  lineHeight: '1.2',
                  marginBottom: '0.5rem',
                  fontFamily: "var(--font-cinzel), serif"
                }}
              >
                AUTOMATA CONTROLS BMS
              </h1>
              <p 
                style={{
                  color: '#fb923c',
                  fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                  margin: '0'
                }}
              >
                Building Management System
              </p>
            </div>

            {/* CTA Button */}
            <div style={{ marginBottom: '3rem' }}>
              <a
                href="/login"
                style={{
                  display: 'inline-block',
                  backgroundColor: '#14b8a6',
                  color: 'white',
                  padding: '12px 32px',
                  borderRadius: '8px',
                  fontWeight: '500',
                  fontSize: '18px',
                  textDecoration: 'none',
                  boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                  transition: 'all 0.2s ease',
                  cursor: 'pointer'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = '#0f766e'
                  e.currentTarget.style.transform = 'scale(1.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = '#14b8a6'
                  e.currentTarget.style.transform = 'scale(1)'
                }}
              >
                Access Dashboard
              </a>
            </div>

            {/* Tagline */}
            <div style={{ marginBottom: '4rem' }}>
              <p 
                style={{
                  fontSize: 'clamp(1rem, 2vw, 1.25rem)',
                  fontWeight: '300',
                  lineHeight: '1.6',
                  maxWidth: '600px',
                  margin: '0 auto'
                }}
              >
                <span style={{ fontSize: 'clamp(2rem, 4vw, 3rem)', fontWeight: '600', color: 'black' }}>I</span>
                <span style={{ color: 'black' }}>ntelligent </span>
                <span style={{ color: '#fb923c' }}>Building </span>
                <span style={{ color: 'black' }}>Management </span>
                <span style={{ color: '#fb923c' }}>for </span>
                <span style={{ color: 'black' }}>the </span>
                <span style={{ color: '#fb923c' }}>Modern </span>
                <span style={{ color: 'black' }}>World</span>
              </p>
            </div>

            {/* Feature highlights */}
            <div 
              style={{ 
                display: 'grid', 
                gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', 
                gap: '2rem',
                maxWidth: '1000px',
                margin: '0 auto'
              }}
            >
              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div 
                  style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#f0fdfa',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto'
                  }}
                >
                  <svg width="32" height="32" fill="none" stroke="#14b8a6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'black', marginBottom: '0.5rem' }}>
                  Real-Time Monitoring
                </h3>
                <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
                  Monitor your building systems in real-time with advanced analytics
                </p>
              </div>

              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div 
                  style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#fff7ed',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto'
                  }}
                >
                  <svg width="32" height="32" fill="none" stroke="#fb923c" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 100 4m0-4v2m0-6V4" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'black', marginBottom: '0.5rem' }}>
                  Smart Controls
                </h3>
                <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
                  Intelligent automation and control for optimal efficiency
                </p>
              </div>

              <div style={{ padding: '1.5rem', textAlign: 'center' }}>
                <div 
                  style={{
                    width: '64px',
                    height: '64px',
                    backgroundColor: '#f0fdfa',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1rem auto'
                  }}
                >
                  <svg width="32" height="32" fill="none" stroke="#14b8a6" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h3 style={{ fontSize: '18px', fontWeight: '600', color: 'black', marginBottom: '0.5rem' }}>
                  Energy Optimization
                </h3>
                <p style={{ color: '#6b7280', fontSize: '14px', lineHeight: '1.5' }}>
                  Reduce costs and environmental impact with smart energy management
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ padding: '1rem 2rem' }}>
          <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
            <AppFooter />
          </div>
        </div>
      </div>
    </>
  )
}
