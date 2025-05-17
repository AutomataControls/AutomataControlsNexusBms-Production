"use client"

import { Button } from "@/components/ui/button"
import { RefreshCw } from "lucide-react"

interface HeaderWithApplyButtonProps {
  equipmentName: string
  hasUnsavedChanges: boolean
  isSubmitting: boolean
  onApplyChanges: () => Promise<void>
}

export function HeaderWithApplyButton({
  equipmentName,
  hasUnsavedChanges,
  isSubmitting,
  onApplyChanges,
}: HeaderWithApplyButtonProps) {
  return (
    <div className="flex justify-between items-center mb-4">
      <h2 className="text-2xl font-bold">{equipmentName} Controls</h2>
      <Button
        onClick={onApplyChanges}
        className={`${
          hasUnsavedChanges ? "bg-green-600 hover:bg-green-700" : "bg-blue-500 hover:bg-blue-600"
        } text-white`}
        disabled={isSubmitting}
      >
        {isSubmitting ? (
          <span className="flex items-center">
            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
            Saving...
          </span>
        ) : (
          <span>Apply Controls</span>
        )}
      </Button>
    </div>
  )
}
