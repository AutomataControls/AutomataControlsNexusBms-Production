// /pages/admin/email-logs.js
import React, { useState, useEffect } from 'react';
import Head from 'next/head';

// Simple authentication check
const AUTH_KEY = process.env.NEXT_PUBLIC_LOG_VIEWER_KEY || 'devmode';

export default function EmailLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [key, setKey] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [filter, setFilter] = useState('');
  const [levelFilter, setLevelFilter] = useState('all');
  const [lines, setLines] = useState(200);
  const [autoRefresh, setAutoRefresh] = useState(false);
  
  const fetchLogs = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/logs/email?key=${key}&lines=${lines}`);
      
      if (!response.ok) {
        throw new Error(`Error: ${response.status} ${response.statusText}`);
      }
      
      const data = await response.json();
      setLogs(data.logs || []);
      setError(null);
      setIsAuthed(true);
    } catch (err) {
      setError(err.message);
      setIsAuthed(false);
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    // Check for saved auth key in localStorage
    const savedKey = localStorage.getItem('emailLogViewerKey');
    if (savedKey) {
      setKey(savedKey);
      // Auto-authenticate if we have a saved key
      (async () => {
        try {
          const response = await fetch(`/api/logs/email?key=${savedKey}&lines=1`);
          if (response.ok) {
            setIsAuthed(true);
            fetchLogs();
          }
        } catch (e) {
          // Silent fail
        }
      })();
    }
  }, []);
  
  useEffect(() => {
    // Set up auto-refresh
    let interval = null;
    if (autoRefresh && isAuthed) {
      interval = setInterval(fetchLogs, 10000); // Refresh every 10 seconds
    }
    return () => clearInterval(interval);
  }, [autoRefresh, isAuthed]);
  
  const handleAuth = (e) => {
    e.preventDefault();
    localStorage.setItem('emailLogViewerKey', key);
    fetchLogs();
  };
  
  const handleLogout = () => {
    localStorage.removeItem('emailLogViewerKey');
    setIsAuthed(false);
    setKey('');
  };
  
  const filteredLogs = logs.filter(log => {
    if (filter && !log.raw.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }
    if (levelFilter !== 'all' && log.level !== levelFilter) {
      return false;
    }
    return true;
  });
  
  const getLogColor = (level) => {
    switch (level) {
      case 'ERROR': return 'bg-red-50 border-red-200';
      case 'WARN': return 'bg-yellow-50 border-yellow-200';
      case 'DEBUG': return 'bg-gray-50 border-gray-200';
      default: return 'bg-white border-gray-100';
    }
  };
  
  const getTextColor = (level) => {
    switch (level) {
      case 'ERROR': return 'text-red-800';
      case 'WARN': return 'text-yellow-800';
      case 'DEBUG': return 'text-gray-800';
      default: return 'text-gray-900';
    }
  };
  
  return (
    <div className="min-h-screen bg-gray-100">
      <Head>
        <title>Email Logs | NeuralBMS</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link href="https://cdn.jsdelivr.net/npm/tailwindcss@2.2.19/dist/tailwind.min.css" rel="stylesheet" />
      </Head>
      
      <div className="container mx-auto px-4 py-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Email Service Logs</h1>
          {isAuthed && (
            <button 
              onClick={handleLogout}
              className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300"
            >
              Logout
            </button>
          )}
        </div>
        
        {!isAuthed ? (
          <div className="bg-white p-6 rounded-lg shadow">
            <form onSubmit={handleAuth}>
              <label className="block mb-4">
                <span className="text-gray-700">Authentication Key:</span>
                <input 
                  type="password" 
                  value={key} 
                  onChange={(e) => setKey(e.target.value)}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  placeholder="Enter auth key"
                  required
                />
              </label>
              <button 
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Authenticate
              </button>
            </form>
          </div>
        ) : (
          <>
            <div className="bg-white p-4 rounded-lg shadow mb-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Filter Text</label>
                  <input
                    type="text"
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                    placeholder="Filter logs..."
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Log Level</label>
                  <select
                    value={levelFilter}
                    onChange={(e) => setLevelFilter(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  >
                    <option value="all">All Levels</option>
                    <option value="INFO">Info</option>
                    <option value="WARN">Warning</option>
                    <option value="ERROR">Error</option>
                    <option value="DEBUG">Debug</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Lines to Show</label>
                  <select
                    value={lines}
                    onChange={(e) => setLines(e.target.value)}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 border"
                  >
                    <option value="50">50 lines</option>
                    <option value="100">100 lines</option>
                    <option value="200">200 lines</option>
                    <option value="500">500 lines</option>
                    <option value="1000">1000 lines</option>
                  </select>
                </div>
                <div className="flex items-end space-x-2">
                  <button
                    onClick={fetchLogs}
                    className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                    disabled={loading}
                  >
                    {loading ? 'Loading...' : 'Refresh Logs'}
                  </button>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={autoRefresh}
                      onChange={() => setAutoRefresh(!autoRefresh)}
                      className="h-4 w-4 text-blue-600"
                    />
                    <span className="ml-2 text-sm text-gray-600">Auto-refresh</span>
                  </label>
                </div>
              </div>
            </div>
            
            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                Error: {error}
              </div>
            )}
            
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="p-4 bg-gray-50 border-b border-gray-200">
                <div className="text-sm font-medium text-gray-500">
                  Showing {filteredLogs.length} of {logs.length} log entries
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <div className="min-w-full">
                  {filteredLogs.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      {loading ? 'Loading logs...' : 'No log entries found'}
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {filteredLogs.map((log, index) => (
                        <LogEntry key={index} log={log} />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Log Entry Component with collapsible details
function LogEntry({ log }) {
  const [expanded, setExpanded] = useState(false);
  
  const hasData = log.data && Object.keys(log.data).length > 0;
  
  // Format timestamp
  const timestamp = new Date(log.timestamp).toLocaleString();
  
  // Determine colors based on log level
  const bgColor = 
    log.level === 'ERROR' ? 'bg-red-50' :
    log.level === 'WARN' ? 'bg-yellow-50' :
    log.level === 'DEBUG' ? 'bg-gray-50' :
    'bg-white';
    
  const borderColor = 
    log.level === 'ERROR' ? 'border-red-100' :
    log.level === 'WARN' ? 'border-yellow-100' :
    log.level === 'DEBUG' ? 'border-gray-100' :
    'border-gray-50';
    
  const textColor = 
    log.level === 'ERROR' ? 'text-red-800' :
    log.level === 'WARN' ? 'text-yellow-800' :
    log.level === 'DEBUG' ? 'text-gray-700' :
    'text-gray-900';
  
  const levelBadgeColor = 
    log.level === 'ERROR' ? 'bg-red-100 text-red-800' :
    log.level === 'WARN' ? 'bg-yellow-100 text-yellow-800' :
    log.level === 'DEBUG' ? 'bg-gray-100 text-gray-800' :
    'bg-blue-100 text-blue-800';
  
  return (
    <div className={`p-4 ${bgColor} border-l-4 ${borderColor} hover:bg-gray-50`}>
      <div className="flex items-start justify-between">
        <div className="flex flex-col flex-1">
          <div className="flex items-center mb-1">
            <span className="text-xs text-gray-500 font-mono">{timestamp}</span>
            <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-medium ${levelBadgeColor}`}>
              {log.level}
            </span>
          </div>
          <div className={`${textColor} font-medium`}>
            {log.message}
          </div>
        </div>
        
        {hasData && (
          <button
            onClick={() => setExpanded(!expanded)}
            className={`ml-4 p-1 rounded hover:bg-gray-200 transition-colors ${expanded ? 'bg-gray-200' : ''}`}
          >
            <svg className="h-5 w-5 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              {expanded ? (
                <path fillRule="evenodd" d="M5 10a1 1 0 011-1h8a1 1 0 110 2H6a1 1 0 01-1-1z" clipRule="evenodd" />
              ) : (
                <path fillRule="evenodd" d="M10 5a1 1 0 011 1v3h3a1 1 0 110 2h-3v3a1 1 0 11-2 0v-3H6a1 1 0 110-2h3V6a1 1 0 011-1z" clipRule="evenodd" />
              )}
            </svg>
          </button>
        )}
      </div>
      
      {expanded && hasData && (
        <div className="mt-2 pt-2 border-t border-gray-200">
          <pre className="text-xs bg-gray-800 text-white p-3 rounded overflow-auto">
            {JSON.stringify(log.data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
