"use client"
export const dynamic = "force-dynamic"
import Image from "next/image"
import { useEffect } from "react"
import { AppFooter } from "@/components/app-footer"

export default function Home() {
  useEffect(() => {
    console.log("Page component mounted");

    // Check if CSS variables are defined
    const rootStyles = getComputedStyle(document.documentElement);
    console.log("CSS Variables:", {
      fontCinzel: rootStyles.getPropertyValue('--font-cinzel'),
      fontSans: rootStyles.getPropertyValue('--font-sans')
    });

    // Log computed styles to check font application
    const title = document.querySelector('h1');
    if (title) {
      const styles = window.getComputedStyle(title);
      console.log('Title styles:', {
        fontFamily: styles.fontFamily,
        fontSize: styles.fontSize,
        fontWeight: styles.fontWeight
      });
    } else {
      console.log("Title element not found");
    }
  }, []);

  console.log("Rendering Home component");

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="container mx-auto max-w-6xl px-4 flex-1 flex flex-col items-center ml-[1100px]">
        <div className="flex-1 flex items-center justify-center -mt-24">
          <div className="text-center">
            <div className="mb-12 flex justify-center">
              <div className="overflow-hidden w-32 h-32 flex items-center justify-center bg-white">
                <Image 
                  src="/neural-loader.png" 
                  alt="Automata Controls Logo" 
                  width={180} 
                  height={180} 
                  priority 
                  className="object-contain" 
                />
              </div>
            </div>

            <div className="space-y-2">
              <h1 
                className="text-[2.5rem] font-bold text-teal-400 tracking-wide leading-tight whitespace-nowrap"
                style={{ fontFamily: "var(--font-cinzel), serif" }}
              >
                AUTOMATA CONTROLS BMS
              </h1>

              <p className="text-orange-300 text-lg mb-8">
                Building Management System
              </p>
            </div>

            <div className="mt-6">
              <a
                href="/login"
                className="inline-block bg-teal-400 text-white px-8 py-2.5 rounded-lg font-medium hover:bg-teal-500 transition-colors text-lg"
              >
                Go to Login
              </a>
            </div>

            <div className="mt-12 text-xl tracking-wide">
              <p className="font-light">
                <span className="text-4xl font-semibold leading-none mr-1 text-black">I</span>
                <span className="text-black">ntelligent</span>{" "}
                <span className="text-orange-400">Building</span>{" "}
                <span className="text-black">Management</span>{" "}
                <span className="text-orange-400">for</span>{" "}
                <span className="text-black">the</span>{" "}
                <span className="text-orange-400">Modern</span>{" "}
                <span className="text-black">World</span>
              </p>
            </div>
          </div>
        </div>
      </div>
      <div className="container mx-auto max-w-6xl px-4 ml-[1150px] bg-transparent relative z-10">
        <div className="bg-transparent [&>footer]:bg-transparent [&>footer]:border-0 [&_span.text-amber-200\/90]:text-gray-300">
          <AppFooter />
        </div>
      </div>
    </div>
  )
}
