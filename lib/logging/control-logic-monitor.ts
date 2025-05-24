// lib/logging/control-logic-monitor.ts
import { equipmentQueue, pidStateStorage, controlValuesCache } from '../control-logic';

// Singleton metrics collector class
class ControlLogicMonitor {
  private static instance: ControlLogicMonitor;
  
  // Equipment processing metrics
  equipmentMetrics: Map<string, {
    processingTimes: number[],
    lastRun: number,
    avgProcessingTime: number,
    status: 'idle' | 'processing' | 'error',
    errorCount: number,
    lastError?: string,
    type: string,
    locationId: string
  }> = new Map();
  
  // Queue metrics history
  queueMetrics: {
    history: { timestamp: number, length: number }[],
    waitTimes: Map<string, { enqueued: number, started?: number, completed?: number }>
  } = {
    history: [],
    waitTimes: new Map()
  };
  
  // Memory usage history
  memoryMetrics: {
    timestamp: number,
    pidStateSize: number,
    cacheSize: number,
    estimatedMemoryKB: number
  }[] = [];
  
  // Database performance
  dbMetrics: {
    influx: { operation: string, duration: number, timestamp: number }[],
    firebase: { operation: string, duration: number, timestamp: number }[]
  } = {
    influx: [],
    firebase: []
  };
  
  // Maximum history entries to keep
  private readonly MAX_HISTORY = 1000;
  
  private constructor() {
    // Start periodic monitoring
    this.startPeriodicMonitoring();
  }
  
  // Get singleton instance
  static getInstance(): ControlLogicMonitor {
    if (!ControlLogicMonitor.instance) {
      ControlLogicMonitor.instance = new ControlLogicMonitor();
    }
    return ControlLogicMonitor.instance;
  }
  
  // Track equipment processing start
  recordProcessingStart(equipmentId: string, equipmentType: string, locationId: string): number {
    const startTime = Date.now();
    
    // Initialize equipment metrics if not exists
    if (!this.equipmentMetrics.has(equipmentId)) {
      this.equipmentMetrics.set(equipmentId, {
        processingTimes: [],
        lastRun: startTime,
        avgProcessingTime: 0,
        status: 'processing',
        errorCount: 0,
        type: equipmentType,
        locationId: locationId
      });
    } else {
      const metrics = this.equipmentMetrics.get(equipmentId)!;
      metrics.status = 'processing';
      metrics.lastRun = startTime;
      metrics.type = equipmentType;
      metrics.locationId = locationId;
    }
    
    // Record queue wait time (when processing starts)
    const waitTimeData = this.queueMetrics.waitTimes.get(equipmentId);
    if (waitTimeData) {
      waitTimeData.started = startTime;
    }
    
    return startTime;
  }
  
  // Track equipment processing end
  recordProcessingEnd(equipmentId: string, startTime: number, success: boolean, error?: string): void {
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    // Update equipment metrics
    if (this.equipmentMetrics.has(equipmentId)) {
      const metrics = this.equipmentMetrics.get(equipmentId)!;
      metrics.status = success ? 'idle' : 'error';
      metrics.processingTimes.push(duration);
      
      // Keep reasonable history size
      if (metrics.processingTimes.length > 100) {
        metrics.processingTimes.shift();
      }
      
      // Update average
      metrics.avgProcessingTime = metrics.processingTimes.reduce((sum, time) => sum + time, 0) / 
                                   metrics.processingTimes.length;
      
      // Track errors
      if (!success) {
        metrics.errorCount++;
        metrics.lastError = error;
      }
    }
    
    // Record queue wait time completion
    const waitTimeData = this.queueMetrics.waitTimes.get(equipmentId);
    if (waitTimeData) {
      waitTimeData.completed = endTime;
    }
    
    console.log(`Equipment ${equipmentId} processed in ${duration}ms, success: ${success}`);
  }
  
  // Track when equipment is added to queue
  recordQueueAdd(equipmentId: string): void {
    const timestamp = Date.now();
    this.queueMetrics.waitTimes.set(equipmentId, { enqueued: timestamp });
  }
  
  // Track database operations
  recordDbOperation(type: 'influx' | 'firebase', operation: string, duration: number): void {
    const timestamp = Date.now();
    
    if (type === 'influx') {
      this.dbMetrics.influx.push({ operation, duration, timestamp });
      if (this.dbMetrics.influx.length > this.MAX_HISTORY) {
        this.dbMetrics.influx.shift();
      }
    } else {
      this.dbMetrics.firebase.push({ operation, duration, timestamp });
      if (this.dbMetrics.firebase.length > this.MAX_HISTORY) {
        this.dbMetrics.firebase.shift();
      }
    }
  }
  
  // Start periodic monitoring tasks
  private startPeriodicMonitoring(): void {
    setInterval(() => {
      this.captureQueueMetrics();
      this.captureMemoryMetrics();
    }, 30000); // Every 30 seconds
  }
  
  // Capture current queue state
  private captureQueueMetrics(): void {
    const timestamp = Date.now();
    const queueLength = equipmentQueue.length;
    
    // Add to history
    this.queueMetrics.history.push({ timestamp, length: queueLength });
    
    // Keep history size reasonable
    if (this.queueMetrics.history.length > this.MAX_HISTORY) {
      this.queueMetrics.history.shift();
    }
    
    // Clean up old wait times entries (completed over an hour ago)
    const hourAgo = timestamp - 3600000;
    for (const [id, data] of this.queueMetrics.waitTimes.entries()) {
      if (data.completed && data.completed < hourAgo) {
        this.queueMetrics.waitTimes.delete(id);
      }
    }
  }
  
  // Capture memory usage
  private captureMemoryMetrics(): void {
    const timestamp = Date.now();
    const pidStateSize = pidStateStorage.size;
    const cacheSize = controlValuesCache.size;
    
    // Estimate memory usage
    const estimatedMemoryKB = this.estimateMemoryUsage(pidStateStorage, controlValuesCache);
    
    // Add to history
    this.memoryMetrics.push({
      timestamp,
      pidStateSize,
      cacheSize,
      estimatedMemoryKB
    });
    
    // Keep history size reasonable
    if (this.memoryMetrics.length > this.MAX_HISTORY) {
      this.memoryMetrics.shift();
    }
  }
  
  // Estimate memory usage of maps (rough approximation)
  private estimateMemoryUsage(pidMap: Map<any, any>, cacheMap: Map<any, any>): number {
    try {
      let estimatedSize = 0;
      
      // Sample based estimation for PID state
      if (pidMap.size > 0) {
        const sampleSize = Math.min(5, pidMap.size);
        let sampleTotal = 0;
        
        const entries = Array.from(pidMap.entries()).slice(0, sampleSize);
        for (const [key, value] of entries) {
          sampleTotal += JSON.stringify({ key, value }).length;
        }
        
        estimatedSize += (sampleTotal / sampleSize) * pidMap.size;
      }
      
      // Sample based estimation for cache
      if (cacheMap.size > 0) {
        const sampleSize = Math.min(5, cacheMap.size);
        let sampleTotal = 0;
        
        const entries = Array.from(cacheMap.entries()).slice(0, sampleSize);
        for (const [key, value] of entries) {
          sampleTotal += JSON.stringify({ key, value }).length;
        }
        
        estimatedSize += (sampleTotal / sampleSize) * cacheMap.size;
      }
      
      // Convert to KB
      return Math.round(estimatedSize / 1024);
    } catch (error) {
      console.error("Error estimating memory usage:", error);
      return 0;
    }
  }
  
  // Get all metrics for API access
  getAllMetrics() {
    return {
      equipment: Array.from(this.equipmentMetrics.entries()).map(([id, metrics]) => ({
        id,
        ...metrics,
        processingTimesCount: metrics.processingTimes.length,
        // Include last few processing times only to keep response size reasonable
        recentProcessingTimes: metrics.processingTimes.slice(-10)
      })),
      queue: {
        current: this.queueMetrics.history.length > 0 ? 
                 this.queueMetrics.history[this.queueMetrics.history.length - 1].length : 0,
        history: this.queueMetrics.history,
        waitTimes: Array.from(this.queueMetrics.waitTimes.entries())
          .map(([id, data]) => ({
            id,
            ...data,
            waitDuration: data.started ? data.started - data.enqueued : null,
            processingDuration: (data.started && data.completed) ? data.completed - data.started : null,
            totalDuration: data.completed ? data.completed - data.enqueued : null
          }))
      },
      memory: {
        current: this.memoryMetrics.length > 0 ? 
                this.memoryMetrics[this.memoryMetrics.length - 1] : null,
        history: this.memoryMetrics
      },
      database: {
        influx: {
          operations: this.dbMetrics.influx.length,
          avgDuration: this.calculateAverage(this.dbMetrics.influx.map(m => m.duration)),
          history: this.dbMetrics.influx.slice(-50) // Last 50 operations
        },
        firebase: {
          operations: this.dbMetrics.firebase.length,
          avgDuration: this.calculateAverage(this.dbMetrics.firebase.map(m => m.duration)),
          history: this.dbMetrics.firebase.slice(-50) // Last 50 operations
        }
      }
    };
  }
  
  // Helper to calculate average
  private calculateAverage(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }
}

// Export monitoring functions
export const getMonitor = () => ControlLogicMonitor.getInstance();

export function recordProcessingStart(equipmentId: string, equipmentType: string, locationId: string): number {
  return getMonitor().recordProcessingStart(equipmentId, equipmentType, locationId);
}

export function recordProcessingEnd(equipmentId: string, startTime: number, success: boolean, error?: string): void {
  getMonitor().recordProcessingEnd(equipmentId, startTime, success, error);
}

export function recordQueueAdd(equipmentId: string): void {
  getMonitor().recordQueueAdd(equipmentId);
}

export function recordDbOperation(type: 'influx' | 'firebase', operation: string, duration: number): void {
  getMonitor().recordDbOperation(type, operation, duration);
}

export function getAllMetrics() {
  return getMonitor().getAllMetrics();
}
