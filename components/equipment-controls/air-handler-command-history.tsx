"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { AirHandlerCommandHistoryProps } from "./types"

export function AirHandlerCommandHistory({
  controlHistory,
  onDeleteCommand,
  renderStatusIcon,
  getCommandDescription,
}: AirHandlerCommandHistoryProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Command History</CardTitle>
        <CardDescription>Recent control commands for this equipment</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Time</TableHead>
                <TableHead>Command</TableHead>
                <TableHead>Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {controlHistory.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-4 text-muted-foreground">
                    No command history available
                  </TableCell>
                </TableRow>
              ) : (
                controlHistory.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap">
                      {entry.formattedTimestamp || new Date(entry.timestamp).toLocaleString()}
                    </TableCell>
                    <TableCell>{getCommandDescription(entry.command || entry.commandType || "")}</TableCell>
                    <TableCell>
                      {typeof entry.value === "object"
                        ? JSON.stringify(entry.value).substring(0, 30) + "..."
                        : String(entry.value)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center space-x-1">
                        {renderStatusIcon(entry.status)}
                        <span>{entry.status}</span>
                      </div>
                    </TableCell>
                    <TableCell>{entry.source}</TableCell>
                    <TableCell>{entry.userName}</TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteCommand(entry.id, entry.commandType || "", entry.sequentialId || "")}
                        className="h-8 px-2 text-red-600 hover:text-red-700"
                      >
                        Delete
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
