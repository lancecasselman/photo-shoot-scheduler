/**
 * Web Worker for Background File Processing and Upload Operations
 * Handles compression, chunking, and progress tracking off the main thread
 * Maintains compatibility with existing R2 upload system
 */

// Import compression utilities (for worker context)
importScripts('/utils/imageCompression.js');

// Worker state
let uploadState = {
  isProcessing: false,
  currentBatch: null,
  progressCallback: null
};

// Handle messages from main thread
self.onmessage = async function(e) {
  const { type, payload, id } = e.data;

  try {
    switch (type) {
      case 'COMPRESS_BATCH':
        await handleBatchCompression(payload, id);
        break;
      
      case 'CHUNK_FILE':
        await handleFileChunking(payload, id);
        break;
      
      case 'CALCULATE_UPLOAD_PLAN':
        await handleUploadPlan(payload, id);
        break;
      
      case 'CANCEL_PROCESSING':
        handleCancelProcessing(payload, id);
        break;
      
      default:
        postMessage({
          id,
          type: 'ERROR',
          error: `Unknown message type: ${type}`
        });
    }
  } catch (error) {
    postMessage({
      id,
      type: 'ERROR',
      error: error.message,
      stack: error.stack
    });
  }
};

/**
 * Handle batch image compression
 */
async function handleBatchCompression(payload, messageId) {
  const { files, options = {} } = payload;
  uploadState.isProcessing = true;

  try {
    const results = [];
    const totalFiles = files.length;

    for (let i = 0; i < files.length; i++) {
      if (!uploadState.isProcessing) {
        // Cancelled
        postMessage({
          id: messageId,
          type: 'CANCELLED'
        });
        return;
      }

      const file = files[i];
      let processedFile;

      // Smart compression based on file type and size
      if (shouldCompressFile(file)) {
        try {
          processedFile = await smartCompressImage(file);
        } catch (compressionError) {
          console.warn(`Compression failed for ${file.name}, using original`);
          processedFile = file;
        }
      } else {
        processedFile = file;
      }

      results.push({
        original: {
          name: file.name,
          size: file.size,
          type: file.type
        },
        processed: processedFile,
        compressed: processedFile.size < file.size,
        reduction: processedFile.size < file.size ? 
          ((file.size - processedFile.size) / file.size * 100).toFixed(1) + '%' : '0%'
      });

      // Send progress update
      postMessage({
        id: messageId,
        type: 'PROGRESS',
        progress: {
          completed: i + 1,
          total: totalFiles,
          percentage: Math.round(((i + 1) / totalFiles) * 100),
          currentFile: file.name
        }
      });
    }

    postMessage({
      id: messageId,
      type: 'COMPRESSION_COMPLETE',
      results
    });

  } catch (error) {
    postMessage({
      id: messageId,
      type: 'ERROR',
      error: error.message
    });
  } finally {
    uploadState.isProcessing = false;
  }
}

/**
 * Handle file chunking for multipart uploads
 */
async function handleFileChunking(payload, messageId) {
  const { file, chunkSize = 10 * 1024 * 1024 } = payload; // Default 10MB chunks

  try {
    const fileSize = file.size;
    const chunks = [];
    const totalChunks = Math.ceil(fileSize / chunkSize);

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, fileSize);
      
      chunks.push({
        index: i,
        start,
        end,
        size: end - start,
        partNumber: i + 1
      });
    }

    postMessage({
      id: messageId,
      type: 'CHUNKING_COMPLETE',
      chunks,
      totalChunks,
      fileSize,
      optimalChunkSize: chunkSize
    });

  } catch (error) {
    postMessage({
      id: messageId,
      type: 'ERROR',
      error: error.message
    });
  }
}

/**
 * Calculate optimal upload strategy
 */
async function handleUploadPlan(payload, messageId) {
  const { files } = payload;

  try {
    const uploadPlan = {
      totalFiles: files.length,
      totalSize: 0,
      estimatedTime: 0,
      recommendations: [],
      fileAnalysis: []
    };

    for (const file of files) {
      const fileSizeMB = file.size / (1024 * 1024);
      const analysis = {
        name: file.name,
        size: file.size,
        sizeMB: fileSizeMB,
        type: file.type,
        shouldCompress: shouldCompressFile(file),
        estimatedUploadTime: estimateUploadTime(file.size),
        recommendedChunkSize: calculateOptimalChunkSize(file.size),
        priority: calculateUploadPriority(file)
      };

      uploadPlan.fileAnalysis.push(analysis);
      uploadPlan.totalSize += file.size;
    }

    // Sort by priority (smaller files first for instant feedback)
    uploadPlan.fileAnalysis.sort((a, b) => a.priority - b.priority);
    
    // Calculate total estimated time
    uploadPlan.estimatedTime = uploadPlan.fileAnalysis.reduce(
      (total, file) => total + file.estimatedUploadTime, 0
    );

    // Generate recommendations
    uploadPlan.recommendations = generateUploadRecommendations(uploadPlan);

    postMessage({
      id: messageId,
      type: 'UPLOAD_PLAN_COMPLETE',
      plan: uploadPlan
    });

  } catch (error) {
    postMessage({
      id: messageId,
      type: 'ERROR',
      error: error.message
    });
  }
}

/**
 * Handle cancellation of processing
 */
function handleCancelProcessing(payload, messageId) {
  uploadState.isProcessing = false;
  uploadState.currentBatch = null;

  postMessage({
    id: messageId,
    type: 'CANCELLED'
  });
}

// Helper functions
function shouldCompressFile(file) {
  // Only compress images, not RAW files, and not already small files
  if (!file.type.startsWith('image/')) return false;
  if (file.size < 500 * 1024) return false; // Don't compress files < 500KB
  
  const extension = file.name.toLowerCase().split('.').pop();
  const rawFormats = ['nef', 'cr2', 'arw', 'dng', 'raf', 'orf', 'rw2', '3fr'];
  return !rawFormats.includes(extension);
}

function calculateOptimalChunkSize(fileSize) {
  if (fileSize < 50 * 1024 * 1024) return 5 * 1024 * 1024; // 5MB for small files
  if (fileSize < 500 * 1024 * 1024) return 10 * 1024 * 1024; // 10MB for medium files
  return 25 * 1024 * 1024; // 25MB for large files
}

function estimateUploadTime(fileSize, uploadSpeedMbps = 10) {
  const fileSizeMb = (fileSize * 8) / (1024 * 1024); // Convert to megabits
  return Math.round(fileSizeMb / uploadSpeedMbps); // Seconds
}

function calculateUploadPriority(file) {
  // Smaller files get higher priority (lower number = higher priority)
  const sizePriority = Math.floor(file.size / (1024 * 1024)); // MB as priority
  
  // Images get slight priority over other files
  const typePriority = file.type.startsWith('image/') ? 0 : 10;
  
  return sizePriority + typePriority;
}

function generateUploadRecommendations(plan) {
  const recommendations = [];
  const totalSizeMB = plan.totalSize / (1024 * 1024);

  if (totalSizeMB > 1000) { // > 1GB
    recommendations.push('Large batch detected - consider uploading in smaller batches for better reliability');
  }

  const compressibleFiles = plan.fileAnalysis.filter(f => f.shouldCompress).length;
  if (compressibleFiles > 0) {
    recommendations.push(`${compressibleFiles} files can be compressed to reduce upload time by ~40%`);
  }

  const estimatedMinutes = Math.round(plan.estimatedTime / 60);
  if (estimatedMinutes > 30) {
    recommendations.push('Large upload detected - ensure stable internet connection and consider enabling resume capability');
  }

  return recommendations;
}