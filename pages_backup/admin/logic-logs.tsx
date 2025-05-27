// pages/admin/logic-logs.tsx
"use client"

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';

// Standalone monitoring dashboard
export default function LogicLogsAdmin() {
  const router = useRouter();
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('overview');
  const [locations, setLocations] = useState<string[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<string>('');
  const [logEntries, setLogEntries] = useState<any[]>([]);
  const [metrics, setMetrics] = useState({
    timestamp: Date.now(),
    queue: {
      length: 0,
      history: [] as { timestamp: number, length: number }[]
    },
    memory: {
      pidStateCount: 0,
      cacheCount: 0,
      history: [] as { timestamp: number, pidStateCount: number, cacheCount: number }[]
    }
  });
  
  // Check authentication
  useEffect(() => {
    const apiKey = router.query.key as string;
    const validKey = process.env.NEXT_PUBLIC_LOG_VIEWER_KEY;
    
    if (apiKey && apiKey === validKey) {
      setIsAuthorized(true);
    } else {
      setError('Unauthorized. Valid API key required.');
    }
  }, [router.query.key]);
  
  // Simulate metrics and fetch sample locations
  useEffect(() => {
    if (!isAuthorized) return;
    
    // Simulated locations (replace with real data when available)
    setLocations(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14']);
    
    // Normally we would fetch this from the server, but for demo:
    const updateMetrics = () => {
      setMetrics(prev => {
        // Current values (simulated)
        const queueLength = Math.floor(Math.random() * 5); // 0-4 items
        const pidStateCount = 10 + Math.floor(Math.random() * 5);
        const cacheCount = 20 + Math.floor(Math.random() * 10);
        
        // Update histories
        const newQueueHistory = [
          ...prev.queue.history,
          { timestamp: Date.now(), length: queueLength }
        ].slice(-50); // Keep last 50 entries
        
        const newMemoryHistory = [
          ...prev.memory.history,
          { timestamp: Date.now(), pidStateCount, cacheCount }
        ].slice(-50);
        
        return {
          timestamp: Date.now(),
          queue: {
            length: queueLength,
            history: newQueueHistory
          },
          memory: {
            pidStateCount,
            cacheCount,
            history: newMemoryHistory
          }
        };
      });
    };
    
    // Initial update
    updateMetrics();
    
    // Update every 5 seconds
    const intervalId = setInterval(updateMetrics, 5000);
    
    return () => clearInterval(intervalId);
  }, [isAuthorized]);
  
  // Fetch log entries when location is selected
  useEffect(() => {
    if (!selectedLocation) return;
    
    // Generate sample log entries for this location
    // In a real implementation, you would fetch these from your server
    const generateSampleLogs = () => {
      const logTypes = ['info', 'warning', 'error', 'success'];
      const equipmentTypes = ['fan-coil', 'boiler', 'pump', 'air-handler', 'steam-bundle'];
      const messages = [
        'Running control logic',
        'Temperature setpoint updated',
        'Fan speed adjusted',
        'Valve position updated',
        'PID controller tuned',
        'Outdoor air reset applied',
        'Error fetching metrics',
        'Communication timeout',
        'Sensor reading out of range'
      ];
      
      // Generate 20 sample log entries
      const logs = Array(20).fill(0).map((_, i) => {
        const logType = logTypes[Math.floor(Math.random() * logTypes.length)];
        const equipmentType = equipmentTypes[Math.floor(Math.random() * equipmentTypes.length)];
        const equipmentId = `${selectedLocation}_equip_${Math.floor(Math.random() * 10)}`;
        const message = messages[Math.floor(Math.random() * messages.length)];
        const timestamp = Date.now() - (i * 60000); // Increasingly older timestamps
        
        return {
          id: `log_${i}`,
          timestamp,
          formattedTime: new Date(timestamp).toLocaleString(),
          locationId: selectedLocation,
          equipmentId,
          equipmentType,
          type: logType,
          message,
          details: logType === 'error' ? { errorCode: Math.floor(Math.random() * 100) } : null
        };
      });
      
      setLogEntries(logs);
    };
    
    generateSampleLogs();
    
  }, [selectedLocation]);
  
  // If not authorized, show login prompt
  if (!isAuthorized) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full">
          <h2 className="text-2xl font-bold mb-4">Control Logic Admin</h2>
          <div className="mb-4">
            <p className="text-red-600 mb-4">{error}</p>
            <p className="text-gray-600 mb-4">
              Please add your API key to the URL as <code>?key=YOUR_KEY</code>
            </p>
            <p className="text-gray-500 text-sm">
              The key should match the <code>NEXT_PUBLIC_LOG_VIEWER_KEY</code> environment variable.
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // Format timestamp to readable time
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString();
  };
  
  // Render dashboard based on active tab
  const renderDashboard = () => {
    switch (activeTab) {
      case 'overview':
        return renderOverview();
      case 'queue':
        return renderQueue();
      case 'memory':
        return renderMemory();
      case 'logs':
        return renderLogs();
      default:
        return renderOverview();
    }
  };
  
  // Render overview tab
  const renderOverview = () => {
    // Prepare chart data
    const queueHistory = metrics.queue.history.map(entry => ({
      time: formatTime(entry.timestamp),
      length: entry.length
    }));
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">System Overview</h2>
        
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Queue Length</h3>
            <div className="text-2xl font-bold">
              {metrics.queue.length}
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-gray-500 text-sm">Total Items in Memory</h3>
            <div className="text-2xl font-bold">
              {metrics.memory.pidStateCount + metrics.memory.cacheCount}
            </div>
          </div>
        </div>
        
        {/* Queue history chart */}
        {queueHistory.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Queue History</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={queueHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="length" 
                    stroke="#3B82F6" 
                    name="Queue Length" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Last updated */}
        <div className="text-sm text-gray-500">
          Last updated: {new Date(metrics.timestamp).toLocaleString()}
        </div>
      </div>
    );
  };
  
  // Render queue tab
  const renderQueue = () => {
    const queueHistory = metrics.queue.history.map(entry => ({
      time: formatTime(entry.timestamp),
      length: entry.length
    }));
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Queue Monitoring</h2>
        
        {/* Summary */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Current Queue Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <span className="text-gray-500 text-sm">Queue Length</span>
              <div className="text-2xl font-bold">
                {metrics.queue.length}
              </div>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Status</span>
              <div className="text-xl font-medium">
                {metrics.queue.length > 0 ? "Processing" : "Idle"}
              </div>
            </div>
          </div>
        </div>
        
        {/* Queue history chart */}
        {queueHistory.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Queue History</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={queueHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="length" 
                    stroke="#3B82F6" 
                    name="Queue Length" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Pending queue items */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <h3 className="text-lg font-semibold p-4 border-b">Queue Items</h3>
          {metrics.queue.length > 0 ? (
            <div className="p-4">
              <div className="flex items-center space-x-2">
                <div className="h-3 w-3 bg-blue-500 rounded-full"></div>
                <p className="text-sm text-gray-700">
                  {metrics.queue.length} items in queue, currently processing
                </p>
              </div>
              <div className="mt-4 text-sm text-gray-600">
                * In this demo version, individual queue item details are not available. 
                In a production implementation, you would see equipment IDs and timestamps.
              </div>
            </div>
          ) : (
            <div className="p-6 text-center text-gray-500">
              Queue is currently empty
            </div>
          )}
        </div>
      </div>
    );
  };
  
  // Render memory tab
  const renderMemory = () => {
    const memoryHistory = metrics.memory.history.map(entry => ({
      time: formatTime(entry.timestamp),
      pid: entry.pidStateCount,
      cache: entry.cacheCount,
      total: entry.pidStateCount + entry.cacheCount
    }));
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Memory Usage</h2>
        
        {/* Memory summary */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-2">Memory Stats</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-gray-500 text-sm">PID States</span>
              <div className="text-xl font-medium">
                {metrics.memory.pidStateCount} items
              </div>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Cache</span>
              <div className="text-xl font-medium">
                {metrics.memory.cacheCount} items
              </div>
            </div>
            <div>
              <span className="text-gray-500 text-sm">Total</span>
              <div className="text-xl font-medium">
                {metrics.memory.pidStateCount + metrics.memory.cacheCount} items
              </div>
            </div>
          </div>
        </div>
        
        {/* Memory history chart */}
        {memoryHistory.length > 0 && (
          <div className="bg-white p-4 rounded-lg shadow">
            <h3 className="text-lg font-semibold mb-2">Memory Usage History</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={memoryHistory}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="total" 
                    stroke="#3B82F6" 
                    name="Total Items" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="pid" 
                    stroke="#10B981" 
                    name="PID States" 
                  />
                  <Line 
                    type="monotone" 
                    dataKey="cache" 
                    stroke="#F59E0B" 
                    name="Cache Items" 
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        
        {/* Memory consumption details */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Memory Consumption</h3>
          <div className="space-y-4">
            <div>
              <h4 className="font-medium text-gray-700">PID State Storage</h4>
              <div className="bg-gray-100 h-6 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-green-500 h-full rounded-full" 
                  style={{ width: `${(metrics.memory.pidStateCount / (metrics.memory.pidStateCount + metrics.memory.cacheCount) * 100) || 0}%` }}
                ></div>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {metrics.memory.pidStateCount} items ({((metrics.memory.pidStateCount / (metrics.memory.pidStateCount + metrics.memory.cacheCount) * 100) || 0).toFixed(1)}% of total)
              </div>
            </div>
            
            <div>
              <h4 className="font-medium text-gray-700">Cache Storage</h4>
              <div className="bg-gray-100 h-6 rounded-full overflow-hidden mt-2">
                <div 
                  className="bg-yellow-500 h-full rounded-full" 
                  style={{ width: `${(metrics.memory.cacheCount / (metrics.memory.pidStateCount + metrics.memory.cacheCount) * 100) || 0}%` }}
                ></div>
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {metrics.memory.cacheCount} items ({((metrics.memory.cacheCount / (metrics.memory.pidStateCount + metrics.memory.cacheCount) * 100) || 0).toFixed(1)}% of total)
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };
  
  // Render logs tab - NEW
  const renderLogs = () => {
    // Get a type-specific CSS class
    const getTypeClass = (type: string) => {
      switch (type) {
        case 'info': return 'bg-blue-50 text-blue-800';
        case 'warning': return 'bg-yellow-50 text-yellow-800';
        case 'error': return 'bg-red-50 text-red-800';
        case 'success': return 'bg-green-50 text-green-800';
        default: return 'bg-gray-50 text-gray-800';
      }
    };
    
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Location Logs</h2>
        
        {/* Location selector */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h3 className="text-lg font-semibold mb-4">Select Location</h3>
          <div className="grid grid-cols-4 md:grid-cols-7 gap-2">
            {locations.map(location => (
              <button
                key={location}
                className={`px-3 py-2 text-sm rounded-md ${
                  selectedLocation === location 
                    ? 'bg-blue-500 text-white' 
                    : 'bg-gray-100 hover:bg-gray-200 text-gray-800'
                }`}
                onClick={() => setSelectedLocation(location)}
              >
                Location {location}
              </button>
            ))}
          </div>
        </div>
        
        {/* Log entries */}
        {selectedLocation ? (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <h3 className="text-lg font-semibold p-4 border-b">
              Logs for Location {selectedLocation}
            </h3>
            
            {logEntries.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Equipment
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Type
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Message
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {logEntries.map(entry => (
                      <tr key={entry.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {entry.formattedTime}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <div className="font-medium text-gray-900">{entry.equipmentId}</div>
                          <div className="text-xs text-gray-500">{entry.equipmentType}</div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getTypeClass(entry.type)}`}>
                            {entry.type}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-500">
                          {entry.message}
                          {entry.details && (
                            <div className="text-xs text-gray-400 mt-1">
                              Details: {JSON.stringify(entry.details)}
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="p-6 text-center text-gray-500">
                No log entries found for this location
              </div>
            )}
          </div>
        ) : (
          <div className="bg-yellow-50 p-4 rounded-lg text-yellow-700">
            Please select a location to view logs
          </div>
        )}
      </div>
    );
  };
  
  return (
    <div className="p-6">
      <h1 className="text-3xl font-bold mb-6">Control Logic Monitoring</h1>
      
      {/* Navigation tabs */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg overflow-x-auto">
        <button 
          className={`px-4 py-2 rounded ${activeTab === 'overview' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
          onClick={() => setActiveTab('overview')}
        >
          Overview
        </button>
        <button 
          className={`px-4 py-2 rounded ${activeTab === 'queue' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
          onClick={() => setActiveTab('queue')}
        >
          Queue
        </button>
        <button 
          className={`px-4 py-2 rounded ${activeTab === 'memory' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
          onClick={() => setActiveTab('memory')}
        >
          Memory
        </button>
        <button 
          className={`px-4 py-2 rounded ${activeTab === 'logs' ? 'bg-white shadow' : 'hover:bg-gray-200'}`}
          onClick={() => setActiveTab('logs')}
        >
          Location Logs
        </button>
      </div>
      
      {/* Dashboard content */}
      {renderDashboard()}
    </div>
  );
}
