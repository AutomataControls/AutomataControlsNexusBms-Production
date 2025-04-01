import { Github, Gitlab } from "lucide-react"
import Link from "next/link"

export function AppFooter() {
  return (
    <footer className="w-full border-t py-4 bg-gray-800 border-gray-700 mt-auto">
      <div className="flex justify-center items-center space-x-4 w-full">
        <Link 
          href="https://automatacontrols.com" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center"
        >
          <span className="text-orange-300 font-ultralight mr-1">©</span>
          <span className="text-amber-200/90 font-medium hover:text-amber-200 transition-colors">AutomataControls</span>
        </Link>

        <Link 
          href="https://gitlab.com/automata-ui/neuralbms" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center"
        >
          <Gitlab className="h-5 w-5 text-teal-200/80 hover:text-teal-200 transition-colors" />
          <span className="sr-only">GitLab</span>
        </Link>

        <Link 
          href="https://github.com/AutomataControls" 
          target="_blank" 
          rel="noopener noreferrer" 
          className="flex items-center"
        >
          <Github className="h-5 w-5 text-orange-300/80 hover:text-orange-300 transition-colors" />
          <span className="sr-only">GitHub</span>
        </Link>
      </div>
    </footer>
  )
}