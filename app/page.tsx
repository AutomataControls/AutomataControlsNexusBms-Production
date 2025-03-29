// app/page.tsx
export const dynamic = "force-dynamic";
import { redirect } from "next/navigation";

export default function Home() {
  // Temporarily disable the automatic redirect
  // redirect("/login");
  
  // Instead, render a simple page
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h1 className="text-3xl font-bold">Welcome to Automata Controls BMS</h1>
        <p className="mt-4">
          <a href="/login" className="text-blue-500 hover:text-blue-700">
            Go to Login
          </a>
        </p>
      </div>
    </div>
  );
}
