// File: pages/react-email-dashboard.js
// A UI to test and preview React Email templates

import { useState, useEffect } from "react"
import Head from "next/head"

export default function ReactEmailDashboard() {
  const [email, setEmail] = useState("")
  const [severity, setSeverity] = useState("info")
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [resendStatus, setResendStatus] = useState(null)

  // Check Resend API status on load
  useEffect(() => {
    async function checkResendStatus() {
      try {
        const response = await fetch('/api/check-resend-status')
        if (response.ok) {
          const data = await response.json()
          setResendStatus(data)
        } else {
          setResendStatus({ error: "Failed to check Resend API status" })
        }
      } catch (err) {
        console.error("Error checking Resend status:", err)
        setResendStatus({ error: err.message })
      }
    }

    checkResendStatus()
  }, [])

  const handleSendTest = async (e) => {
    e.preventDefault()
    if (!email) {
      setError("Email address is required")
      return
    }

    setSending(true)
    setResult(null)
    setError(null)

    try {
      const response = await fetch(`/api/test-react-email?email=${encodeURIComponent(email)}&severity=${severity}`)
      
      const data = await response.json()
      
      if (!response.ok) {
        setError(data.error || "Failed to send email")
      } else {
        setResult(data)
      }
    } catch (err) {
      setError(err.message || "An error occurred")
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Head>
        <title>React Email Test Dashboard</title>
      </Head>

      <div className="min-h-screen bg-gray-100 py-12">
        <div className="max-w-3xl mx-auto px-4">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">React Email Test Dashboard</h1>
            <p className="text-gray-600">Test your React Email templates with Resend</p>
          </div>

          {/* Status Card */}
          <div className="bg-white rounded-lg shadow mb-6 p-6">
            <h2 className="text-xl font-semibold mb-4">Resend API Status</h2>
            
            {!resendStatus ? (
              <div className="flex items-center text-gray-500">
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Checking API status...</span>
              </div>
            ) : resendStatus.error ? (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                <div className="font-medium">API Status Check Failed</div>
                <div className="text-sm">{resendStatus.error}</div>
              </div>
            ) : (
              <div className="p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
                <div className="font-medium">API Status: {resendStatus.status || "Ready"}</div>
                {resendStatus.domain && (
                  <div className="text-sm mt-1">Sending Domain: {resendStatus.domain}</div>
                )}
              </div>
            )}
          </div>

          {/* Email Test Form */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">Send Test Email</h2>
            
            <form onSubmit={handleSendTest} className="space-y-4">
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                  Recipient Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email address"
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              
              <div>
                <label htmlFor="severity" className="block text-sm font-medium text-gray-700 mb-1">
                  Alarm Severity
                </label>
                <select
                  id="severity"
                  value={severity}
                  onChange={(e) => setSeverity(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="info">Information</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              
              <button
                type="submit"
                disabled={sending || !email}
                className={`w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white ${
                  sending || !email ? 'bg-blue-300' : 'bg-blue-600 hover:bg-blue-700'
                } focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500`}
              >
                {sending ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending...
                  </>
                ) : (
                  'Send Test Email'
                )}
              </button>
            </form>

            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
                <div className="font-medium">Error</div>
                <div className="text-sm">{error}</div>
              </div>
            )}

            {result && (
              <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-md text-green-700">
                <div className="font-medium">Email Sent Successfully!</div>
                <div className="text-sm mt-1">Message ID: {result.messageId}</div>
                <div className="text-sm mt-1">Recipient: {result.details?.to}</div>
                <div className="text-sm mt-1">Sent at: {result.details?.timestamp}</div>
              </div>
            )}
          </div>

          {/* Documentation */}
          <div className="mt-6 bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-4">How It Works</h2>
            <div className="prose prose-blue">
              <p>
                This dashboard uses <a href="https://react.email/" target="_blank" rel="noopener noreferrer">React Email</a> with <a href="https://resend.com" target="_blank" rel="noopener noreferrer">Resend</a> to send beautiful, responsive emails.
              </p>
              <p>
                Your email template is defined in <code>/emails/alarm-notification.jsx</code> and uses React components to ensure compatibility across email clients.
              </p>
              <p>
                To use in production:
              </p>
              <ol>
                <li>Make sure your <code>RESEND_API_KEY</code> is set in your environment variables</li>
                <li>Configure your sending domain in the Resend dashboard</li>
                <li>Update your primary alarm notification system to use this approach</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
