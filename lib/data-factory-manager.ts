/**
 * ===============================================================================
 * Data Factory Manager - Location-Specific Worker Coordinator
 * ===============================================================================
 * 
 * PURPOSE:
 * Manages and coordinates location-specific data factory workers. Routes data
 * processing requests to appropriate location workers, handles worker lifecycle,
 * and aggregates results from multiple locations for unified dashboard display.
 * 
 * WORKER ARCHITECTURE:
 * - Huntington Data Factory (Location 4) - Heritage Pointe equipment
 * - FirstChurch Data Factory (Location 1) - Church HVAC systems  
 * - NERealty Data Factory (Location 10) - Commercial building systems
 * - Additional location factories as needed
 * 
 * FEATURES:
 * - Dynamic worker spawning based on active locations
 * - Load balancing across location workers
 * - Error handling and worker recovery
 * - Performance monitoring and optimization
 * - Memory management and cleanup
 * 
 * AUTHOR: Juelz NeuralBms DevOps
 * LAST UPDATED: June 3, 2025
 * ===============================================================================
 */

// lib/data-factory-manager.ts

interface LocationWorker {
  worker: Worker
  locationId: string
  locationName: string
  isActive: boolean
  lastProcessingTime: number
  errorCount: number
  createdAt: number
}

interface ProcessingJob {
  id: string
  locationId: string
  type: string
  data: any
  timestamp: number
  resolve: (value: any) => void
  reject: (reason: any) => void
}

class DataFactoryManager {
  private workers: Map<string, LocationWorker> = new Map()
  private pendingJobs: Map<string, ProcessingJob> = new Map()
  private isInitialized: boolean = false
  private maxRetries: number = 3
  private workerTimeout: number = 30000 // 30 seconds

  // Location-specific worker configurations
  private readonly LOCATION_WORKERS = {
    '4': { 
      name: 'Heritage Pointe of Huntington', 
      workerPath: '/dist/workers/data-factories/huntington-data-factory.js',
      priority: 1 
    },
    '1': { 
      name: 'First Church of God', 
      workerPath: '/dist/workers/data-factories/firstchurch-data-factory.js',
      priority: 2 
    },
    '10': { 
      name: 'NE Realty Group', 
      workerPath: '/dist/workers/data-factories/nerealty-data-factory.js',
      priority: 3 
    },
    '5': { 
      name: 'Location 5', 
      workerPath: '/dist/workers/data-factories/location5-data-factory.js',
      priority: 4 
    },
    '6': { 
      name: 'Location 6', 
      workerPath: '/dist/workers/data-factories/location6-data-factory.js',
      priority: 5 
    }
  }

  constructor() {
    console.log('🏭 Data Factory Manager: Initializing...')
    this.initialize()
  }

  private async initialize(): Promise<void> {
    try {
      console.log('🏭 Data Factory Manager: Setting up location workers...')
      
      // Initialize workers for active locations
      await this.initializeLocationWorkers()
      
      this.isInitialized = true
      console.log(`🏭 Data Factory Manager: Initialized with ${this.workers.size} location workers`)
      
    } catch (error) {
      console.error('🏭 Data Factory Manager: Initialization failed:', error)
      throw error
    }
  }

  private async initializeLocationWorkers(): Promise<void> {
    const initPromises = Object.entries(this.LOCATION_WORKERS).map(
      ([locationId, config]) => this.createLocationWorker(locationId, config)
    )
    
    await Promise.allSettled(initPromises)
  }

  private async createLocationWorker(
    locationId: string, 
    config: { name: string, workerPath: string, priority: number }
  ): Promise<void> {
    try {
      console.log(`🏭 Creating worker for ${config.name} (Location ${locationId})...`)
      
      // Create worker instance
      const worker = new Worker(config.workerPath)
      
      // Set up worker message handling
      worker.onmessage = (e) => this.handleWorkerMessage(locationId, e)
      worker.onerror = (error) => this.handleWorkerError(locationId, error)
      
      // Store worker reference
      const locationWorker: LocationWorker = {
        worker,
        locationId,
        locationName: config.name,
        isActive: true,
        lastProcessingTime: 0,
        errorCount: 0,
        createdAt: Date.now()
      }
      
      this.workers.set(locationId, locationWorker)
      console.log(`✅ Worker created for ${config.name}`)
      
    } catch (error) {
      console.error(`❌ Failed to create worker for Location ${locationId}:`, error)
    }
  }

  private handleWorkerMessage(locationId: string, e: MessageEvent): void {
    const { type, data, processingTime, error } = e.data
    
    // Update worker performance metrics
    const worker = this.workers.get(locationId)
    if (worker) {
      worker.lastProcessingTime = processingTime || 0
      if (type.includes('ERROR')) {
        worker.errorCount++
      }
    }

    // Handle different message types
    switch (type) {
      case 'HUNTINGTON_DATA_PROCESSED':
      case 'FIRSTCHURCH_DATA_PROCESSED':
      case 'NEREALTY_DATA_PROCESSED':
        this.handleProcessingComplete(locationId, data, processingTime)
        break
        
      case 'HUNTINGTON_PROCESSING_ERROR':
      case 'FIRSTCHURCH_PROCESSING_ERROR':
      case 'NEREALTY_PROCESSING_ERROR':
        this.handleProcessingError(locationId, error)
        break
        
      case 'NEURAL_COMMANDS_OPTIMIZED':
      case 'SYSTEM_EFFICIENCY_CALCULATED':
      case 'PERFORMANCE_TRENDS_ANALYZED':
        this.handleSpecializedProcessing(locationId, type, data)
        break
        
      default:
        console.warn(`🏭 Unknown message type from Location ${locationId}:`, type)
    }
  }

  private handleWorkerError(locationId: string, error: ErrorEvent): void {
    console.error(`🏭 Worker error from Location ${locationId}:`, error)
    
    const worker = this.workers.get(locationId)
    if (worker) {
      worker.errorCount++
      worker.isActive = false
      
      // Attempt to recover worker if error count is below threshold
      if (worker.errorCount < this.maxRetries) {
        setTimeout(() => this.recoverWorker(locationId), 5000)
      } else {
        console.error(`🏭 Worker for Location ${locationId} exceeded max retries, marking as failed`)
      }
    }
  }

  private async recoverWorker(locationId: string): Promise<void> {
    console.log(`🔄 Attempting to recover worker for Location ${locationId}...`)
    
    const config = this.LOCATION_WORKERS[locationId]
    if (config) {
      // Terminate existing worker
      const existingWorker = this.workers.get(locationId)
      if (existingWorker) {
        existingWorker.worker.terminate()
        this.workers.delete(locationId)
      }
      
      // Create new worker
      await this.createLocationWorker(locationId, config)
    }
  }

  private handleProcessingComplete(locationId: string, data: any, processingTime: number): void {
    console.log(`✅ Location ${locationId} processing completed in ${processingTime}ms`)
    
    // Find and resolve pending jobs for this location
    const jobsToResolve = Array.from(this.pendingJobs.values())
      .filter(job => job.locationId === locationId)
    
    jobsToResolve.forEach(job => {
      job.resolve(data)
      this.pendingJobs.delete(job.id)
    })
    
    // Emit processed data event for dashboard
    this.emitLocationDataUpdate(locationId, data)
  }

  private handleProcessingError(locationId: string, error: string): void {
    console.error(`❌ Location ${locationId} processing error:`, error)
    
    // Reject pending jobs for this location
    const jobsToReject = Array.from(this.pendingJobs.values())
      .filter(job => job.locationId === locationId)
    
    jobsToReject.forEach(job => {
      job.reject(new Error(error))
      this.pendingJobs.delete(job.id)
    })
  }

  private handleSpecializedProcessing(locationId: string, type: string, data: any): void {
    console.log(`🔧 Location ${locationId} specialized processing: ${type}`)
    
    // Handle specialized processing results
    this.emitSpecializedUpdate(locationId, type, data)
  }

  private emitLocationDataUpdate(locationId: string, data: any): void {
    // Emit custom event for dashboard consumption
    const event = new CustomEvent('locationDataUpdate', {
      detail: {
        locationId,
        data,
        timestamp: Date.now()
      }
    })
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event)
    }
  }

  private emitSpecializedUpdate(locationId: string, type: string, data: any): void {
    const event = new CustomEvent('specializedProcessingUpdate', {
      detail: {
        locationId,
        type,
        data,
        timestamp: Date.now()
      }
    })
    
    if (typeof window !== 'undefined') {
      window.dispatchEvent(event)
    }
  }

  // Public API methods
  public async processLocationData(locationId: string, data: any): Promise<any> {
    if (!this.isInitialized) {
      throw new Error('Data Factory Manager not initialized')
    }

    const worker = this.workers.get(locationId)
    if (!worker || !worker.isActive) {
      throw new Error(`No active worker available for Location ${locationId}`)
    }

    return new Promise((resolve, reject) => {
      const jobId = `${locationId}-${Date.now()}-${Math.random()}`
      
      // Create processing job
      const job: ProcessingJob = {
        id: jobId,
        locationId,
        type: 'PROCESS_LOCATION_DATA',
        data,
        timestamp: Date.now(),
        resolve,
        reject
      }
      
      this.pendingJobs.set(jobId, job)
      
      // Set timeout for job
      setTimeout(() => {
        if (this.pendingJobs.has(jobId)) {
          this.pendingJobs.delete(jobId)
          reject(new Error(`Processing timeout for Location ${locationId}`))
        }
      }, this.workerTimeout)
      
      // Send data to worker based on location
      const messageType = this.getLocationMessageType(locationId)
      worker.worker.postMessage({
        type: messageType,
        data,
        timestamp: Date.now()
      })
    })
  }

  private getLocationMessageType(locationId: string): string {
    switch (locationId) {
      case '4': return 'PROCESS_HUNTINGTON_DATA'
      case '1': return 'PROCESS_FIRSTCHURCH_DATA'
      case '10': return 'PROCESS_NEREALTY_DATA'
      default: return 'PROCESS_LOCATION_DATA'
    }
  }

  public async processAllLocations(dataByLocation: Record<string, any>): Promise<Record<string, any>> {
    const processingPromises = Object.entries(dataByLocation).map(
      async ([locationId, data]) => {
        try {
          const result = await this.processLocationData(locationId, data)
          return [locationId, result]
        } catch (error) {
          console.error(`Failed to process Location ${locationId}:`, error)
          return [locationId, null]
        }
      }
    )

    const results = await Promise.allSettled(processingPromises)
    
    // Convert results back to object
    const processedData: Record<string, any> = {}
    results.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const [locationId, data] = result.value
        if (data) {
          processedData[locationId] = data
        }
      }
    })

    return processedData
  }

  public getWorkerStatus(): Record<string, any> {
    const status: Record<string, any> = {}
    
    this.workers.forEach((worker, locationId) => {
      status[locationId] = {
        locationName: worker.locationName,
        isActive: worker.isActive,
        lastProcessingTime: worker.lastProcessingTime,
        errorCount: worker.errorCount,
        uptime: Date.now() - worker.createdAt
      }
    })
    
    return status
  }

  public async shutdown(): Promise<void> {
    console.log('🏭 Data Factory Manager: Shutting down...')
    
    // Terminate all workers
    this.workers.forEach((worker) => {
      worker.worker.terminate()
    })
    
    // Clear maps
    this.workers.clear()
    this.pendingJobs.clear()
    
    this.isInitialized = false
    console.log('🏭 Data Factory Manager: Shutdown complete')
  }
}

// Export singleton instance
export const dataFactoryManager = new DataFactoryManager()

// Type exports for TypeScript
export type { LocationWorker, ProcessingJob }
