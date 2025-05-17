// File: pages/email-test.js
// Description: Simple UI for testing email notifications

import { useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Loader2, Mail, AlertTriangle, CheckCircle2, Info } from "lucide-react"
import { useRouter } from "next/navigation"

export default function EmailTest() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [additionalEmails, setAdditionalEmails] = useState("")
  const [severity, setSeverity] = useState("info")
  const [locationId, setLocationId] = useState("1")
  const [equipmentName, setEquipmentName] = useState("Test Equipment")
  const [includeDetails, setIncludeDetails] = useState(true)
  const [testName, setTestName] = useState("Email Notification Test")
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)

  // Map of location IDs to names
  const locations = {
    "1": "HeritageWarren",
    "2": "StJudeCatholicSchool",
    "3": "ByrnaAmmunition",
    "4": "HeritageHuntington",
    "5": "HopbridgeAutismCenter",
    "6": "AkronCarnegiePublicLibrary",
    "7": "TaylorUniversity",
    "8": "ElementLabs",
    "9": "FirstChurchOfGod",
    "10": "NERealtyGroup",
    "11": "StJohnCatholicSchool",
    "12": "Residential"
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setResult(null)
    setError(null)

    try {
      // Combine primary email with additional emails
      const allEmails = [email]
      
      if (additionalEmails) {
        const additionalEmailList = additionalEmails
          .split(',')
          .map(e => e.trim())
          .filter(e => e)
        
        allEmails.push(...additionalEmailList)
      }

      // Call the test-notifier API
      const response = await fetch('/api/test-notifier', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: allEmails,
          severity,
          locationId,
          equipmentName,
          includeDetails,
          testName
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        setError(data)
      } else {
        setResult(data)
      }
    } catch (err) {
      setError({ error: "Failed to send request", details: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="container mx-auto p-4 max-w-2xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Mail className="mr-2 h-6 w-6 text-amber-400" />
            Email Notification Test
          </CardTitle>
          <CardDescription>
            Test the alarm email notification system by sending a test email
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Primary Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter recipient email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalEmails">Additional Emails (comma-separated)</Label>
              <Input
                id="additionalEmails"
                type="text"
                placeholder="email1@example.com, email2@example.com"
                value={additionalEmails}
                onChange={(e) => setAdditionalEmails(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="severity">Severity</Label>
                <Select
                  value={severity}
                  onValueChange={setSeverity}
                >
                  <SelectTrigger id="severity">
                    <SelectValue placeholder="Select severity" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">Info</SelectItem>
                    <SelectItem value="warning">Warning</SelectItem>
                    <SelectItem value="critical">Critical</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="locationId">Location</Label>
                <Select
                  value={locationId}
                  onValueChange={setLocationId}
                >
                  <SelectTrigger id="locationId">
                    <SelectValue placeholder="Select location" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(locations).map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="equipmentName">Equipment Name</Label>
              <Input
                id="equipmentName"
                type="text"
                placeholder="Enter equipment name"
                value={equipmentName}
                onChange={(e) => setEquipmentName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="testName">Test Name</Label>
              <Input
                id="testName"
                type="text"
                placeholder="Enter test name"
                value={testName}
                onChange={(e) => setTestName(e.target.value)}
              />
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="includeDetails"
                checked={includeDetails}
                onCheckedChange={setIncludeDetails}
              />
              <Label htmlFor="includeDetails" className="cursor-pointer">
                Include detailed test information in email
              </Label>
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                'Send Test Email'
              )}
            </Button>
          </form>
        </CardContent>

        {(result || error) && (
          <CardFooter className="flex flex-col border-t bg-gray-50 p-4">
            {result && (
              <div className="flex items-start text-green-600 p-3 border rounded bg-green-50 border-green-200 mb-2 w-full">
                <CheckCircle2 className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Email sent successfully!</p>
                  <p className="text-sm mt-1">Sent to: {result.message}</p>
                  <p className="text-sm mt-1">Message ID: {result.result?.messageId}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="flex items-start text-red-600 p-3 border rounded bg-red-50 border-red-200 mb-2 w-full">
                <AlertTriangle className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">Failed to send email</p>
                  <p className="text-sm mt-1">{error.error || "Unknown error"}</p>
                  {error.details && (
                    <p className="text-sm mt-1">Details: {error.details}</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex items-start text-blue-600 p-3 border rounded bg-blue-50 border-blue-200 w-full mt-2">
              <Info className="h-5 w-5 mr-2 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Troubleshooting</p>
                <p className="text-sm mt-1">
                  If the email is not received, check the server logs for details.
                  The system will attempt to send via multiple methods if the primary method fails.
                </p>
              </div>
            </div>

            <Button
              variant="outline"
              onClick={() => router.push('/dashboard')}
              className="mt-4 self-end"
            >
              Return to Dashboard
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  )
}
