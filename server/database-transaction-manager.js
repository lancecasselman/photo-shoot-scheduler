/**
 * Database Transaction Manager for Download Service
 * 
 * Provides comprehensive database operation safety with:
 * - Atomic transaction handling with proper rollback
 * - Connection pool exhaustion handling
 * - Deadlock detection and retry logic
 * - Timeout handling for long-running queries
 * - Foreign key constraint violation handling
 * - Connection leak prevention
 */

const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');
const crypto = require('crypto');

// Error codes and patterns for database-specific error handling
const DB_ERROR_PATTERNS = {
  CONNECTION_POOL_EXHAUSTED: /connection pool exhausted|too many connections/i,
  DEADLOCK_DETECTED: /deadlock detected|could not serialize access/i,
  TIMEOUT_ERROR: /timeout|statement timeout|lock timeout/i,
  FOREIGN_KEY_VIOLATION: /foreign key constraint|violates foreign key/i,
  UNIQUE_CONSTRAINT_VIOLATION: /unique constraint|duplicate key/i,
  CHECK_CONSTRAINT_VIOLATION: /check constraint|violates check/i,
  CONNECTION_ERROR: /connection refused|connection reset|connection terminated/i,
  SERIALIZATION_FAILURE: /could not serialize access|serialization failure/i,
  LOCK_NOT_AVAILABLE: /lock not available|could not obtain lock/i
};

class DatabaseTransactionManager {
  constructor(pool) {
    if (!pool) {
      throw new Error('DatabaseTransactionManager requires a shared database pool parameter');
    }
    
    this.pool = pool;
    this.db = drizzle(this.pool);
    
    // Transaction configuration
    this.config = {
      maxRetries: 3,
      baseRetryDelay: 1000, // 1 second
      maxRetryDelay: 30000, // 30 seconds
      transactionTimeout: 30000, // 30 seconds
      lockTimeout: 10000, // 10 seconds
      deadlockRetries: 5,
      connectionRetries: 3
    };
    
    // Active transaction tracking
    this.activeTransactions = new Set();
    this.transactionStats = {
      totalTransactions: 0,
      successfulTransactions: 0,
      failedTransactions: 0,
      retriedTransactions: 0,
      deadlockRetries: 0,
      connectionErrors: 0
    };
    
    // Health monitoring
    this.healthMetrics = {
      poolSize: 0,
      idleConnections: 0,
      waitingClients: 0,
      lastHealthCheck: Date.now()
    };
    
    console.log('✅ Database Transaction Manager initialized with production safety features');
  }

  /**
   * Execute operation within a managed transaction with comprehensive error handling
   */
  async executeTransaction(operation, options = {}) {
    const transactionId = crypto.randomUUID();
    const startTime = Date.now();
    
    const {
      isolationLevel = 'READ COMMITTED',
      timeout = this.config.transactionTimeout,
      maxRetries = this.config.maxRetries,
      retryableErrors = ['DEADLOCK_DETECTED', 'SERIALIZATION_FAILURE', 'CONNECTION_ERROR'],
      context = {}
    } = options;

    let client = null;
    let attempt = 0;
    
    this.activeTransactions.add(transactionId);
    this.transactionStats.totalTransactions++;

    try {
      while (attempt <= maxRetries) {
        attempt++;
        
        try {
          // Get connection with timeout protection
          client = await this.acquireConnection(transactionId, timeout);
          
          // Begin transaction with isolation level and timeouts
          await this.beginTransaction(client, isolationLevel, timeout);
          
          console.log(`🚀 [${transactionId}] Transaction started (attempt ${attempt}/${maxRetries + 1})`);
          
          // Execute the operation within transaction
          const result = await Promise.race([
            operation(client, this.db, transactionId),
            this.createTimeoutPromise(timeout, `Transaction timeout after ${timeout}ms`)
          ]);
          
          // Commit transaction
          await client.query('COMMIT');
          
          const duration = Date.now() - startTime;
          console.log(`✅ [${transactionId}] Transaction committed successfully in ${duration}ms`);
          
          this.transactionStats.successfulTransactions++;
          if (attempt > 1) {
            this.transactionStats.retriedTransactions++;
          }
          
          return {
            success: true,
            result,
            transactionId,
            duration,
            attempts: attempt
          };
          
        } catch (error) {
          // Always rollback on error
          if (client) {
            try {
              await client.query('ROLLBACK');
              console.log(`🔄 [${transactionId}] Transaction rolled back due to error`);
            } catch (rollbackError) {
              console.error(`❌ [${transactionId}] Rollback failed:`, rollbackError);
            }
          }
          
          const errorType = this.classifyError(error);
          const shouldRetry = attempt <= maxRetries && 
                             retryableErrors.includes(errorType) && 
                             this.isRetryableError(error);
          
          console.error(`❌ [${transactionId}] Transaction error (attempt ${attempt}):`, {
            errorType,
            message: error.message,
            shouldRetry,
            context
          });
          
          if (shouldRetry) {
            // Update retry stats
            if (errorType === 'DEADLOCK_DETECTED') {
              this.transactionStats.deadlockRetries++;
            } else if (errorType === 'CONNECTION_ERROR') {
              this.transactionStats.connectionErrors++;
            }
            
            // Calculate retry delay with exponential backoff
            const retryDelay = Math.min(
              this.config.baseRetryDelay * Math.pow(2, attempt - 1),
              this.config.maxRetryDelay
            );
            
            console.warn(`🔄 [${transactionId}] Retrying in ${retryDelay}ms (${errorType})`);
            await this.delay(retryDelay);
            
            // Release connection if acquired
            if (client) {
              client.release();
              client = null;
            }
            
            continue; // Try again
          } else {
            // Non-retryable error or max retries reached
            throw this.enhanceError(error, transactionId, attempt, context);
          }
        }
      }
    } finally {
      // Clean up resources
      if (client) {
        client.release();
      }
      this.activeTransactions.delete(transactionId);
    }
    
    // This should not be reached, but handle the case
    this.transactionStats.failedTransactions++;
    throw new Error(`Transaction failed after ${maxRetries + 1} attempts`);
  }

  /**
   * Acquire database connection with timeout and pool exhaustion handling
   */
  async acquireConnection(transactionId, timeout) {
    const acquireStartTime = Date.now();
    
    try {
      // Check pool health first
      await this.checkPoolHealth();
      
      const client = await Promise.race([
        this.pool.connect(),
        this.createTimeoutPromise(
          this.config.connectionTimeout || 10000,
          'Connection acquisition timeout'
        )
      ]);
      
      // Set connection-level timeouts to prevent idle-in-transaction
      await client.query(`SET idle_in_transaction_session_timeout = '20s'`);
      await client.query(`SET statement_timeout = '30s'`);
      
      const acquireTime = Date.now() - acquireStartTime;
      console.log(`🔌 [${transactionId}] Connection acquired in ${acquireTime}ms with timeouts set`);
      
      return client;
      
    } catch (error) {
      const acquireTime = Date.now() - acquireStartTime;
      
      if (this.isConnectionPoolExhausted(error)) {
        console.error(`❌ [${transactionId}] Connection pool exhausted after ${acquireTime}ms`);
        throw new Error('Connection pool exhausted. System is under heavy load.');
      }
      
      console.error(`❌ [${transactionId}] Failed to acquire connection after ${acquireTime}ms:`, error);
      throw error;
    }
  }

  /**
   * Begin transaction with proper isolation level and timeouts
   */
  async beginTransaction(client, isolationLevel, timeout) {
    try {
      // Set transaction isolation level
      await client.query(`BEGIN ISOLATION LEVEL ${isolationLevel}`);
      
      // Set transaction-level timeouts
      await client.query(`SET LOCAL statement_timeout = '${timeout}ms'`);
      await client.query(`SET LOCAL lock_timeout = '${this.config.lockTimeout}ms'`);
      await client.query(`SET LOCAL idle_in_transaction_session_timeout = '${timeout}ms'`);
      
    } catch (error) {
      console.error('❌ Failed to configure transaction:', error);
      throw error;
    }
  }

  /**
   * Execute read-only operation with connection pooling optimization
   */
  async executeReadOnly(operation, options = {}) {
    const {
      timeout = 30000,
      useReplicationRead = false, // Future: could route to read replica
      context = {}
    } = options;

    const operationId = crypto.randomUUID();
    const startTime = Date.now();
    
    try {
      console.log(`📖 [${operationId}] Executing read-only operation`);
      
      const result = await Promise.race([
        operation(this.db, operationId),
        this.createTimeoutPromise(timeout, `Read operation timeout after ${timeout}ms`)
      ]);
      
      const duration = Date.now() - startTime;
      console.log(`✅ [${operationId}] Read-only operation completed in ${duration}ms`);
      
      return {
        success: true,
        result,
        operationId,
        duration
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [${operationId}] Read-only operation failed after ${duration}ms:`, error);
      
      throw this.enhanceError(error, operationId, 1, {
        ...context,
        operationType: 'read-only',
        duration
      });
    }
  }

  /**
   * Execute bulk operation with batch processing and transaction chunking
   */
  async executeBulkOperation(items, operation, options = {}) {
    const {
      batchSize = 100,
      maxConcurrent = 5,
      continueOnError = false,
      timeout = 60000,
      context = {}
    } = options;

    const bulkId = crypto.randomUUID();
    const startTime = Date.now();
    
    console.log(`📦 [${bulkId}] Starting bulk operation: ${items.length} items, batch size: ${batchSize}`);
    
    const results = [];
    const errors = [];
    
    try {
      // Process items in batches
      for (let i = 0; i < items.length; i += batchSize) {
        const batch = items.slice(i, i + batchSize);
        const batchId = `${bulkId}-batch-${Math.floor(i / batchSize) + 1}`;
        
        try {
          const batchResult = await this.executeTransaction(
            async (client, db, transactionId) => {
              console.log(`🔄 [${batchId}] Processing batch of ${batch.length} items`);
              return await operation(batch, client, db, transactionId);
            },
            {
              timeout,
              context: { ...context, bulkId, batchId, batchIndex: Math.floor(i / batchSize) }
            }
          );
          
          results.push(batchResult.result);
          
        } catch (error) {
          errors.push({
            batchIndex: Math.floor(i / batchSize),
            batchItems: batch,
            error: error.message
          });
          
          if (!continueOnError) {
            throw error;
          }
          
          console.warn(`⚠️ [${batchId}] Batch failed but continuing: ${error.message}`);
        }
      }
      
      const duration = Date.now() - startTime;
      const successCount = results.length * batchSize;
      const errorCount = errors.length * batchSize;
      
      console.log(`✅ [${bulkId}] Bulk operation completed in ${duration}ms: ${successCount} success, ${errorCount} errors`);
      
      return {
        success: true,
        results,
        errors,
        bulkId,
        duration,
        stats: {
          totalItems: items.length,
          successfulBatches: results.length,
          failedBatches: errors.length,
          batchSize
        }
      };
      
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [${bulkId}] Bulk operation failed after ${duration}ms:`, error);
      
      throw this.enhanceError(error, bulkId, 1, {
        ...context,
        operationType: 'bulk',
        duration,
        totalItems: items.length,
        completedBatches: results.length,
        failedBatches: errors.length
      });
    }
  }

  /**
   * Health check for database connection pool
   */
  async checkPoolHealth() {
    try {
      this.healthMetrics.poolSize = this.pool.totalCount;
      this.healthMetrics.idleConnections = this.pool.idleCount;
      this.healthMetrics.waitingClients = this.pool.waitingCount;
      this.healthMetrics.lastHealthCheck = Date.now();
      
      // Check for pool exhaustion warning
      const utilizationPercentage = (this.pool.totalCount / (this.pool.options.max || 20)) * 100;
      
      if (utilizationPercentage > 80) {
        console.warn(`⚠️ Database pool utilization high: ${utilizationPercentage.toFixed(1)}% (${this.pool.totalCount}/${this.pool.options.max})`);
      }
      
      // Check for waiting clients
      if (this.pool.waitingCount > 5) {
        console.warn(`⚠️ Database pool has ${this.pool.waitingCount} waiting clients`);
      }
      
      return {
        healthy: true,
        metrics: this.healthMetrics,
        utilizationPercentage
      };
      
    } catch (error) {
      console.error('❌ Database pool health check failed:', error);
      return {
        healthy: false,
        error: error.message,
        metrics: this.healthMetrics
      };
    }
  }

  /**
   * Get comprehensive database statistics
   */
  getStatistics() {
    const activeTransactionCount = this.activeTransactions.size;
    const totalTransactions = this.transactionStats.totalTransactions;
    const successRate = totalTransactions > 0 ? 
      (this.transactionStats.successfulTransactions / totalTransactions * 100) : 100;
    
    return {
      transactions: {
        ...this.transactionStats,
        activeTransactions: activeTransactionCount,
        successRate: Math.round(successRate * 100) / 100
      },
      pool: {
        ...this.healthMetrics,
        configuration: {
          max: this.pool.options.max,
          min: this.pool.options.min,
          idleTimeout: this.pool.options.idleTimeoutMillis,
          connectionTimeout: this.pool.options.connectionTimeoutMillis
        }
      },
      config: this.config
    };
  }

  /**
   * Error classification for retry logic
   */
  classifyError(error) {
    const message = error.message || error.toString();
    
    for (const [errorType, pattern] of Object.entries(DB_ERROR_PATTERNS)) {
      if (pattern.test(message)) {
        return errorType;
      }
    }
    
    return 'UNKNOWN_ERROR';
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const errorType = this.classifyError(error);
    
    const retryableTypes = [
      'DEADLOCK_DETECTED',
      'SERIALIZATION_FAILURE',
      'CONNECTION_ERROR',
      'TIMEOUT_ERROR',
      'LOCK_NOT_AVAILABLE',
      'CONNECTION_POOL_EXHAUSTED'
    ];
    
    return retryableTypes.includes(errorType);
  }

  /**
   * Check if error is connection pool exhaustion
   */
  isConnectionPoolExhausted(error) {
    const errorType = this.classifyError(error);
    return errorType === 'CONNECTION_POOL_EXHAUSTED';
  }

  /**
   * Enhance error with transaction context
   */
  enhanceError(error, transactionId, attempt, context = {}) {
    const errorType = this.classifyError(error);
    
    const enhancedError = new Error(`Database operation failed: ${error.message}`);
    enhancedError.originalError = error;
    enhancedError.transactionId = transactionId;
    enhancedError.errorType = errorType;
    enhancedError.attempt = attempt;
    enhancedError.context = context;
    enhancedError.timestamp = new Date().toISOString();
    enhancedError.retryable = this.isRetryableError(error);
    
    return enhancedError;
  }

  /**
   * Create timeout promise for race conditions
   */
  createTimeoutPromise(timeout, message) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(message));
      }, timeout);
    });
  }

  /**
   * Delay utility for retry logic
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown - wait for active transactions to complete
   */
  async shutdown(timeout = 30000) {
    console.log('🔄 Shutting down Database Transaction Manager...');
    
    const startTime = Date.now();
    
    // Wait for active transactions to complete
    while (this.activeTransactions.size > 0 && (Date.now() - startTime) < timeout) {
      console.log(`⏳ Waiting for ${this.activeTransactions.size} active transactions to complete...`);
      await this.delay(1000);
    }
    
    // Force close pool
    try {
      await this.pool.end();
      console.log('✅ Database Transaction Manager shutdown complete');
    } catch (error) {
      console.error('❌ Error during database shutdown:', error);
    }
  }
}

// Export class only (no singleton - pool must be passed explicitly)
module.exports = {
  DatabaseTransactionManager,
  DB_ERROR_PATTERNS
};