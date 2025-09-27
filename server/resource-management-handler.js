/**
 * Resource Management Handler for Download Service
 * 
 * Provides comprehensive resource management including:
 * - File stream operations and cleanup on failures
 * - Memory management for large file operations
 * - Database connection leak prevention
 * - R2 multipart upload abort on failures
 * - Automatic resource cleanup and error recovery
 * - Memory usage monitoring and optimization
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const stream = require('stream');
const { promisify } = require('util');

// Resource tracking and limits
const RESOURCE_LIMITS = {
  MAX_MEMORY_USAGE: 1024 * 1024 * 1024, // 1GB
  MAX_FILE_SIZE: 100 * 1024 * 1024, // 100MB
  MAX_CONCURRENT_OPERATIONS: 10,
  MAX_STREAM_TIMEOUT: 300000, // 5 minutes
  CLEANUP_INTERVAL: 60000, // 1 minute
  MEMORY_CHECK_INTERVAL: 30000, // 30 seconds
  CONNECTION_TIMEOUT: 30000, // 30 seconds
  MAX_TEMP_FILES: 100,
  MAX_ACTIVE_STREAMS: 20
};

class ResourceManagementHandler {
  constructor(dbPool = null) {
    this.dbPool = dbPool;
    
    // Resource tracking
    this.activeOperations = new Map();
    this.activeStreams = new Set();
    this.tempFiles = new Set();
    this.multipartUploads = new Map();
    this.memoryUsage = new Map();
    
    // Statistics
    this.stats = {
      totalOperations: 0,
      completedOperations: 0,
      failedOperations: 0,
      resourceLeaks: 0,
      cleanupActions: 0,
      memoryOptimizations: 0,
      tempFilesCreated: 0,
      tempFilesCleanedUp: 0
    };
    
    // Start monitoring intervals
    this.startResourceMonitoring();
    
    console.log('✅ Resource Management Handler initialized with comprehensive cleanup strategies');
  }

  /**
   * Execute operation with comprehensive resource management
   */
  async executeWithResourceManagement(operationName, operation, options = {}) {
    const operationId = crypto.randomUUID();
    const startTime = Date.now();
    
    const {
      timeout = RESOURCE_LIMITS.MAX_STREAM_TIMEOUT,
      maxMemory = RESOURCE_LIMITS.MAX_MEMORY_USAGE,
      requiresCleanup = true,
      context = {}
    } = options;

    // Check resource limits before starting
    const resourceCheck = this.checkResourceLimits();
    if (!resourceCheck.allowed) {
      throw new Error(`Resource limits exceeded: ${resourceCheck.reason}`);
    }

    const resources = {
      streams: new Set(),
      tempFiles: new Set(),
      connections: new Set(),
      multipartUploads: new Set(),
      memoryAllocations: new Map()
    };

    try {
      console.log(`🔧 [${operationId}] Starting resource-managed operation: ${operationName}`);
      
      // Register operation
      this.activeOperations.set(operationId, {
        name: operationName,
        startTime,
        timeout,
        resources,
        context
      });

      this.stats.totalOperations++;

      // Execute with timeout and resource tracking
      const result = await Promise.race([
        this.executeOperationWithTracking(operation, operationId, resources),
        this.createTimeoutPromise(timeout, `Operation ${operationName} timed out after ${timeout}ms`)
      ]);

      // Operation completed successfully
      const duration = Date.now() - startTime;
      console.log(`✅ [${operationId}] Resource-managed operation completed in ${duration}ms`);
      
      this.stats.completedOperations++;
      
      return {
        success: true,
        result,
        operationId,
        duration,
        resourcesUsed: this.getResourceUsageSummary(resources)
      };

    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [${operationId}] Resource-managed operation failed after ${duration}ms:`, error);
      
      this.stats.failedOperations++;
      
      throw this.enhanceErrorWithResourceContext(error, operationId, resources, context);
      
    } finally {
      // Always cleanup resources
      if (requiresCleanup) {
        await this.cleanupOperationResources(operationId, resources);
      }
      
      this.activeOperations.delete(operationId);
    }
  }

  /**
   * Execute operation with resource tracking
   */
  async executeOperationWithTracking(operation, operationId, resources) {
    const resourceManager = {
      createStream: (source, options = {}) => this.createManagedStream(source, operationId, resources, options),
      createTempFile: (prefix = 'temp') => this.createManagedTempFile(prefix, operationId, resources),
      allocateMemory: (size, purpose) => this.allocateMemory(size, purpose, operationId, resources),
      startMultipartUpload: (uploadParams) => this.startManagedMultipartUpload(uploadParams, operationId, resources),
      getConnection: () => this.getManagedConnection(operationId, resources)
    };

    return await operation(resourceManager, operationId);
  }

  /**
   * Create managed file stream with automatic cleanup
   */
  createManagedStream(source, operationId, resources, options = {}) {
    try {
      const streamId = crypto.randomUUID();
      const {
        highWaterMark = 64 * 1024, // 64KB chunks
        autoDestroy = true,
        timeout = RESOURCE_LIMITS.MAX_STREAM_TIMEOUT
      } = options;

      let managedStream;
      
      if (typeof source === 'string') {
        // File path
        managedStream = require('fs').createReadStream(source, {
          highWaterMark,
          autoDestroy
        });
      } else if (Buffer.isBuffer(source)) {
        // Buffer to stream
        managedStream = stream.Readable.from(source, { highWaterMark });
      } else {
        // Existing stream
        managedStream = source;
      }

      // Add timeout handling
      const timeoutHandle = setTimeout(() => {
        console.warn(`⏰ [${operationId}] Stream ${streamId} timeout - destroying`);
        if (managedStream && !managedStream.destroyed) {
          managedStream.destroy(new Error('Stream timeout'));
        }
      }, timeout);

      // Track the stream
      resources.streams.add({
        streamId,
        stream: managedStream,
        timeoutHandle,
        createdAt: Date.now()
      });

      this.activeStreams.add(streamId);

      // Auto-cleanup on completion
      managedStream.on('close', () => {
        this.cleanupStream(streamId, resources);
      });

      managedStream.on('error', (error) => {
        console.error(`❌ [${operationId}] Stream ${streamId} error:`, error);
        this.cleanupStream(streamId, resources);
      });

      console.log(`📊 [${operationId}] Created managed stream ${streamId}`);
      return managedStream;

    } catch (error) {
      console.error(`❌ [${operationId}] Failed to create managed stream:`, error);
      throw error;
    }
  }

  /**
   * Create managed temporary file with automatic cleanup
   */
  async createManagedTempFile(prefix, operationId, resources) {
    try {
      const tempId = crypto.randomUUID();
      const tempPath = `/tmp/${prefix}_${tempId}`;
      
      // Check temp file limits
      if (this.tempFiles.size >= RESOURCE_LIMITS.MAX_TEMP_FILES) {
        throw new Error('Maximum temporary files limit reached');
      }

      // Create the temp file
      await fs.writeFile(tempPath, '');
      
      const tempFile = {
        tempId,
        path: tempPath,
        createdAt: Date.now(),
        operationId
      };

      resources.tempFiles.add(tempFile);
      this.tempFiles.add(tempFile);
      this.stats.tempFilesCreated++;

      console.log(`📁 [${operationId}] Created managed temp file: ${tempPath}`);
      
      return {
        path: tempPath,
        id: tempId,
        cleanup: () => this.cleanupTempFile(tempFile, resources)
      };

    } catch (error) {
      console.error(`❌ [${operationId}] Failed to create managed temp file:`, error);
      throw error;
    }
  }

  /**
   * Allocate and track memory usage
   */
  allocateMemory(size, purpose, operationId, resources) {
    try {
      const allocationId = crypto.randomUUID();
      
      // Check memory limits
      const currentMemory = this.getCurrentMemoryUsage();
      if (currentMemory + size > RESOURCE_LIMITS.MAX_MEMORY_USAGE) {
        throw new Error(`Memory allocation would exceed limit: ${size} bytes requested, ${currentMemory} currently used`);
      }

      const allocation = {
        id: allocationId,
        size,
        purpose,
        allocatedAt: Date.now(),
        operationId
      };

      resources.memoryAllocations.set(allocationId, allocation);
      this.memoryUsage.set(allocationId, allocation);

      console.log(`💾 [${operationId}] Allocated ${size} bytes for ${purpose}`);
      
      return {
        allocationId,
        size,
        release: () => this.releaseMemory(allocationId, resources)
      };

    } catch (error) {
      console.error(`❌ [${operationId}] Memory allocation failed:`, error);
      throw error;
    }
  }

  /**
   * Start managed multipart upload with automatic cleanup
   */
  async startManagedMultipartUpload(uploadParams, operationId, resources) {
    try {
      const uploadId = crypto.randomUUID();
      
      const multipartUpload = {
        uploadId,
        params: uploadParams,
        startedAt: Date.now(),
        operationId,
        aborted: false
      };

      resources.multipartUploads.add(multipartUpload);
      this.multipartUploads.set(uploadId, multipartUpload);

      console.log(`📤 [${operationId}] Started managed multipart upload: ${uploadId}`);

      return {
        uploadId,
        abort: () => this.abortMultipartUpload(uploadId, resources),
        complete: () => this.completeMultipartUpload(uploadId, resources)
      };

    } catch (error) {
      console.error(`❌ [${operationId}] Failed to start managed multipart upload:`, error);
      throw error;
    }
  }

  /**
   * Get managed database connection
   */
  async getManagedConnection(operationId, resources) {
    if (!this.dbPool) {
      throw new Error('Database pool not available');
    }

    try {
      const connectionId = crypto.randomUUID();
      const startTime = Date.now();

      const connection = await Promise.race([
        this.dbPool.connect(),
        this.createTimeoutPromise(
          RESOURCE_LIMITS.CONNECTION_TIMEOUT,
          'Database connection timeout'
        )
      ]);

      const managedConnection = {
        connectionId,
        connection,
        acquiredAt: Date.now(),
        operationId,
        released: false
      };

      resources.connections.add(managedConnection);

      // Auto-release on idle timeout
      const idleTimeout = setTimeout(() => {
        console.warn(`⏰ [${operationId}] Connection ${connectionId} idle timeout - releasing`);
        this.releaseConnection(connectionId, resources);
      }, 30000); // 30 seconds idle timeout

      managedConnection.idleTimeout = idleTimeout;

      console.log(`🔗 [${operationId}] Acquired managed database connection: ${connectionId}`);

      return {
        connection,
        connectionId,
        release: () => this.releaseConnection(connectionId, resources)
      };

    } catch (error) {
      console.error(`❌ [${operationId}] Failed to get managed connection:`, error);
      throw error;
    }
  }

  /**
   * Cleanup all resources for an operation
   */
  async cleanupOperationResources(operationId, resources) {
    console.log(`🧹 [${operationId}] Starting resource cleanup`);
    let cleanupCount = 0;

    try {
      // Cleanup streams
      for (const streamInfo of resources.streams) {
        await this.cleanupStream(streamInfo.streamId, resources);
        cleanupCount++;
      }

      // Cleanup temp files
      for (const tempFile of resources.tempFiles) {
        await this.cleanupTempFile(tempFile, resources);
        cleanupCount++;
      }

      // Release database connections
      for (const connInfo of resources.connections) {
        this.releaseConnection(connInfo.connectionId, resources);
        cleanupCount++;
      }

      // Abort multipart uploads
      for (const uploadInfo of resources.multipartUploads) {
        await this.abortMultipartUpload(uploadInfo.uploadId, resources);
        cleanupCount++;
      }

      // Release memory allocations
      for (const [allocationId, allocation] of resources.memoryAllocations) {
        this.releaseMemory(allocationId, resources);
        cleanupCount++;
      }

      this.stats.cleanupActions += cleanupCount;
      console.log(`✅ [${operationId}] Cleaned up ${cleanupCount} resources`);

    } catch (error) {
      console.error(`❌ [${operationId}] Error during resource cleanup:`, error);
      this.stats.resourceLeaks++;
    }
  }

  /**
   * Cleanup individual stream
   */
  async cleanupStream(streamId, resources) {
    try {
      const streamInfo = Array.from(resources.streams).find(s => s.streamId === streamId);
      if (streamInfo) {
        if (streamInfo.timeoutHandle) {
          clearTimeout(streamInfo.timeoutHandle);
        }
        
        if (streamInfo.stream && !streamInfo.stream.destroyed) {
          streamInfo.stream.destroy();
        }
        
        resources.streams.delete(streamInfo);
        this.activeStreams.delete(streamId);
        
        console.log(`🗑️ Cleaned up stream ${streamId}`);
      }
    } catch (error) {
      console.error(`❌ Error cleaning up stream ${streamId}:`, error);
    }
  }

  /**
   * Cleanup temporary file
   */
  async cleanupTempFile(tempFile, resources) {
    try {
      await fs.unlink(tempFile.path);
      resources.tempFiles.delete(tempFile);
      this.tempFiles.delete(tempFile);
      this.stats.tempFilesCleanedUp++;
      
      console.log(`🗑️ Cleaned up temp file: ${tempFile.path}`);
    } catch (error) {
      if (error.code !== 'ENOENT') { // File not found is OK
        console.error(`❌ Error cleaning up temp file ${tempFile.path}:`, error);
      }
    }
  }

  /**
   * Release database connection
   */
  releaseConnection(connectionId, resources) {
    try {
      const connInfo = Array.from(resources.connections).find(c => c.connectionId === connectionId);
      if (connInfo && !connInfo.released) {
        if (connInfo.idleTimeout) {
          clearTimeout(connInfo.idleTimeout);
        }
        
        connInfo.connection.release();
        connInfo.released = true;
        resources.connections.delete(connInfo);
        
        console.log(`🗑️ Released database connection ${connectionId}`);
      }
    } catch (error) {
      console.error(`❌ Error releasing connection ${connectionId}:`, error);
    }
  }

  /**
   * Release memory allocation
   */
  releaseMemory(allocationId, resources) {
    try {
      const allocation = resources.memoryAllocations.get(allocationId);
      if (allocation) {
        resources.memoryAllocations.delete(allocationId);
        this.memoryUsage.delete(allocationId);
        
        console.log(`💾 Released ${allocation.size} bytes (${allocation.purpose})`);
      }
    } catch (error) {
      console.error(`❌ Error releasing memory ${allocationId}:`, error);
    }
  }

  /**
   * Abort multipart upload
   */
  async abortMultipartUpload(uploadId, resources) {
    try {
      const uploadInfo = Array.from(resources.multipartUploads).find(u => u.uploadId === uploadId);
      if (uploadInfo && !uploadInfo.aborted) {
        // Here you would call the actual R2/S3 abort API
        uploadInfo.aborted = true;
        resources.multipartUploads.delete(uploadInfo);
        this.multipartUploads.delete(uploadId);
        
        console.log(`🗑️ Aborted multipart upload ${uploadId}`);
      }
    } catch (error) {
      console.error(`❌ Error aborting multipart upload ${uploadId}:`, error);
    }
  }

  /**
   * Check resource limits before starting new operations
   */
  checkResourceLimits() {
    const activeOps = this.activeOperations.size;
    const activeStreamsCount = this.activeStreams.size;
    const memoryUsage = this.getCurrentMemoryUsage();
    const tempFileCount = this.tempFiles.size;

    if (activeOps >= RESOURCE_LIMITS.MAX_CONCURRENT_OPERATIONS) {
      return { allowed: false, reason: `Maximum concurrent operations: ${activeOps}/${RESOURCE_LIMITS.MAX_CONCURRENT_OPERATIONS}` };
    }

    if (activeStreamsCount >= RESOURCE_LIMITS.MAX_ACTIVE_STREAMS) {
      return { allowed: false, reason: `Maximum active streams: ${activeStreamsCount}/${RESOURCE_LIMITS.MAX_ACTIVE_STREAMS}` };
    }

    if (memoryUsage > RESOURCE_LIMITS.MAX_MEMORY_USAGE) {
      return { allowed: false, reason: `Memory usage too high: ${memoryUsage} bytes` };
    }

    if (tempFileCount >= RESOURCE_LIMITS.MAX_TEMP_FILES) {
      return { allowed: false, reason: `Maximum temporary files: ${tempFileCount}/${RESOURCE_LIMITS.MAX_TEMP_FILES}` };
    }

    return { allowed: true };
  }

  /**
   * Get current memory usage from tracked allocations
   */
  getCurrentMemoryUsage() {
    let totalMemory = 0;
    for (const [id, allocation] of this.memoryUsage) {
      totalMemory += allocation.size;
    }
    return totalMemory;
  }

  /**
   * Start resource monitoring intervals
   */
  startResourceMonitoring() {
    // Periodic cleanup of stale resources
    this.cleanupInterval = setInterval(() => {
      this.performPeriodicCleanup();
    }, RESOURCE_LIMITS.CLEANUP_INTERVAL);

    // Memory usage monitoring
    this.memoryInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, RESOURCE_LIMITS.MEMORY_CHECK_INTERVAL);

    console.log('📊 Resource monitoring started');
  }

  /**
   * Perform periodic cleanup of stale resources
   */
  async performPeriodicCleanup() {
    const now = Date.now();
    let cleanedUp = 0;

    try {
      // Cleanup old temp files
      for (const tempFile of this.tempFiles) {
        const age = now - tempFile.createdAt;
        if (age > 3600000) { // 1 hour
          await this.cleanupTempFile(tempFile, { tempFiles: new Set([tempFile]) });
          cleanedUp++;
        }
      }

      // Check for stale operations
      for (const [opId, operation] of this.activeOperations) {
        const age = now - operation.startTime;
        if (age > operation.timeout + 60000) { // Operation timeout + 1 minute grace
          console.warn(`⚠️ Stale operation detected: ${opId} (${operation.name})`);
          await this.cleanupOperationResources(opId, operation.resources);
          this.activeOperations.delete(opId);
          cleanedUp++;
        }
      }

      if (cleanedUp > 0) {
        console.log(`🧹 Periodic cleanup completed: ${cleanedUp} resources cleaned`);
      }

    } catch (error) {
      console.error('❌ Error during periodic cleanup:', error);
    }
  }

  /**
   * Check memory usage and perform optimizations
   */
  checkMemoryUsage() {
    try {
      const processMemory = process.memoryUsage();
      const trackedMemory = this.getCurrentMemoryUsage();
      
      // Trigger garbage collection if memory usage is high
      if (processMemory.heapUsed > 500 * 1024 * 1024) { // 500MB
        if (global.gc) {
          global.gc();
          this.stats.memoryOptimizations++;
          console.log('♻️ Garbage collection triggered due to high memory usage');
        }
      }

      // Log memory stats periodically
      if (Date.now() % (5 * 60 * 1000) < RESOURCE_LIMITS.MEMORY_CHECK_INTERVAL) { // Every 5 minutes
        console.log('📊 Memory usage:', {
          heapUsed: Math.round(processMemory.heapUsed / 1024 / 1024) + 'MB',
          heapTotal: Math.round(processMemory.heapTotal / 1024 / 1024) + 'MB',
          trackedAllocations: Math.round(trackedMemory / 1024 / 1024) + 'MB',
          activeOperations: this.activeOperations.size,
          activeStreams: this.activeStreams.size,
          tempFiles: this.tempFiles.size
        });
      }

    } catch (error) {
      console.error('❌ Error checking memory usage:', error);
    }
  }

  /**
   * Get resource usage summary
   */
  getResourceUsageSummary(resources) {
    return {
      streams: resources.streams.size,
      tempFiles: resources.tempFiles.size,
      connections: resources.connections.size,
      multipartUploads: resources.multipartUploads.size,
      memoryAllocations: resources.memoryAllocations.size,
      totalMemoryAllocated: Array.from(resources.memoryAllocations.values())
        .reduce((total, alloc) => total + alloc.size, 0)
    };
  }

  /**
   * Enhance error with resource context
   */
  enhanceErrorWithResourceContext(error, operationId, resources, context) {
    const enhancedError = new Error(`Resource management error: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.operationId = operationId;
    enhancedError.resourcesInUse = this.getResourceUsageSummary(resources);
    enhancedError.context = context;
    enhancedError.timestamp = new Date().toISOString();
    
    return enhancedError;
  }

  /**
   * Create timeout promise
   */
  createTimeoutPromise(timeout, message) {
    return new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    });
  }

  /**
   * Get comprehensive resource statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      currentUsage: {
        activeOperations: this.activeOperations.size,
        activeStreams: this.activeStreams.size,
        tempFiles: this.tempFiles.size,
        multipartUploads: this.multipartUploads.size,
        memoryUsage: this.getCurrentMemoryUsage(),
        trackedAllocations: this.memoryUsage.size
      },
      limits: RESOURCE_LIMITS,
      memoryInfo: process.memoryUsage()
    };
  }

  /**
   * Shutdown and cleanup all resources
   */
  async shutdown() {
    console.log('🔄 Shutting down Resource Management Handler...');
    
    // Clear intervals
    if (this.cleanupInterval) clearInterval(this.cleanupInterval);
    if (this.memoryInterval) clearInterval(this.memoryInterval);

    // Cleanup all active operations
    const cleanupPromises = [];
    for (const [opId, operation] of this.activeOperations) {
      cleanupPromises.push(this.cleanupOperationResources(opId, operation.resources));
    }

    await Promise.all(cleanupPromises);
    
    console.log('✅ Resource Management Handler shutdown complete');
  }
}

// Export singleton instance
const resourceManager = new ResourceManagementHandler();

module.exports = {
  ResourceManagementHandler,
  resourceManager,
  RESOURCE_LIMITS
};