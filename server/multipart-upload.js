const {
  CreateMultipartUploadCommand,
  UploadPartCommand,
  CompleteMultipartUploadCommand,
  AbortMultipartUploadCommand
} = require('@aws-sdk/client-s3');

/**
 * FAST Multipart Upload for Large Files
 * Optimal for photography files (20-100MB)
 */
class MultipartUploader {
  constructor(s3Client, bucketName) {
    this.s3Client = s3Client;
    this.bucketName = bucketName;
    this.CHUNK_SIZE = 10 * 1024 * 1024; // 10MB chunks for optimal speed with photos
    this.MAX_CONCURRENT_PARTS = 8; // Increased from 6 to 8 for better performance
    this.ADAPTIVE_CONCURRENT_PARTS = true; // Enable adaptive concurrency based on file size
  }

  /**
   * Calculate optimal chunk size based on file size and network conditions
   */
  calculateOptimalChunkSize(fileSize) {
    const minChunkSize = 5 * 1024 * 1024; // 5MB minimum
    const maxChunkSize = 50 * 1024 * 1024; // 50MB for very large files
    const maxParts = 10000; // S3/R2 limit
    
    // Dynamic chunk sizing based on file size:
    if (fileSize < 50 * 1024 * 1024) { // < 50MB - use smaller chunks for faster initial feedback
      return 5 * 1024 * 1024; // 5MB chunks
    } else if (fileSize < 500 * 1024 * 1024) { // 50-500MB - standard photo files
      return 10 * 1024 * 1024; // 10MB chunks
    } else { // > 500MB - large video/RAW files
      return 25 * 1024 * 1024; // 25MB chunks for efficiency
    }
  }

  /**
   * Calculate optimal concurrency based on file size and system capacity
   */
  calculateOptimalConcurrency(fileSize, totalParts) {
    if (!this.ADAPTIVE_CONCURRENT_PARTS) {
      return this.MAX_CONCURRENT_PARTS;
    }

    // Adaptive concurrency logic
    if (fileSize < 50 * 1024 * 1024) { // Small files
      return Math.min(4, totalParts); // Conservative for small files
    } else if (fileSize < 500 * 1024 * 1024) { // Medium files
      return Math.min(this.MAX_CONCURRENT_PARTS, totalParts);
    } else { // Large files - maximize throughput
      return Math.min(10, totalParts); // Up to 10 for very large files
    }
  }

  /**
   * Upload file using multipart upload for maximum speed
   */
  async uploadLargeFile(fileBuffer, key, contentType, metadata = {}) {
    const fileSize = fileBuffer.length;
    const chunkSize = this.calculateOptimalChunkSize(fileSize);
    const totalParts = Math.ceil(fileSize / chunkSize);
    const optimalConcurrency = this.calculateOptimalConcurrency(fileSize, totalParts);
    
    console.log(`⚡ ENHANCED Multipart upload: ${(fileSize / (1024*1024)).toFixed(2)}MB in ${totalParts} parts of ${(chunkSize / (1024*1024)).toFixed(2)}MB (${optimalConcurrency} concurrent)`);
    
    let uploadId;
    
    try {
      // 1. Initiate multipart upload
      const createResponse = await this.s3Client.send(
        new CreateMultipartUploadCommand({
          Bucket: this.bucketName,
          Key: key,
          ContentType: contentType,
          Metadata: metadata
        })
      );
      
      uploadId = createResponse.UploadId;
      console.log(`📤 Multipart upload initiated: ${uploadId}`);
      
      const parts = [];
      const uploadedParts = [];
      
      // 2. Upload parts with adaptive concurrency
      for (let i = 0; i < totalParts; i += optimalConcurrency) {
        const batch = [];
        
        for (let j = i; j < Math.min(i + optimalConcurrency, totalParts); j++) {
          const start = j * chunkSize;
          const end = Math.min(start + chunkSize, fileSize);
          const chunk = fileBuffer.slice(start, end);
          const partNumber = j + 1;
          
          batch.push({
            partNumber,
            uploadPromise: this.uploadPart(key, uploadId, chunk, partNumber)
          });
        }
        
        // Upload batch concurrently
        const batchResults = await Promise.all(
          batch.map(async ({ partNumber, uploadPromise }) => {
            const etag = await uploadPromise;
            console.log(`✅ Part ${partNumber}/${totalParts} uploaded`);
            return { PartNumber: partNumber, ETag: etag };
          })
        );
        
        uploadedParts.push(...batchResults);
      }
      
      // 3. Complete multipart upload
      console.log(`🔄 Completing multipart upload...`);
      const completeResponse = await this.s3Client.send(
        new CompleteMultipartUploadCommand({
          Bucket: this.bucketName,
          Key: key,
          UploadId: uploadId,
          MultipartUpload: {
            Parts: uploadedParts.sort((a, b) => a.PartNumber - b.PartNumber)
          }
        })
      );
      
      console.log(`✅ FAST multipart upload completed: ${key}`);
      return {
        success: true,
        key,
        location: completeResponse.Location,
        etag: completeResponse.ETag
      };
      
    } catch (error) {
      console.error('❌ Multipart upload failed:', error);
      
      // Abort upload on error
      if (uploadId) {
        try {
          await this.s3Client.send(
            new AbortMultipartUploadCommand({
              Bucket: this.bucketName,
              Key: key,
              UploadId: uploadId
            })
          );
          console.log('🗑️ Aborted failed multipart upload');
        } catch (abortError) {
          console.error('Failed to abort multipart upload:', abortError);
        }
      }
      
      throw error;
    }
  }

  /**
   * Upload a single part with retry logic
   */
  async uploadPart(key, uploadId, chunk, partNumber, retries = 3) {
    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await this.s3Client.send(
          new UploadPartCommand({
            Bucket: this.bucketName,
            Key: key,
            UploadId: uploadId,
            PartNumber: partNumber,
            Body: chunk
          })
        );
        
        return response.ETag;
      } catch (error) {
        if (attempt === retries) {
          throw error;
        }
        
        // Exponential backoff
        const delay = Math.pow(2, attempt) * 1000;
        console.log(`⚠️ Part ${partNumber} upload failed, retrying in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  /**
   * Decide whether to use multipart or simple upload
   */
  async smartUpload(fileBuffer, key, contentType, metadata = {}) {
    const fileSize = fileBuffer.length;
    const MULTIPART_THRESHOLD = 10 * 1024 * 1024; // Use multipart for files > 10MB
    
    if (fileSize > MULTIPART_THRESHOLD) {
      // Use fast multipart upload for large files
      return await this.uploadLargeFile(fileBuffer, key, contentType, metadata);
    } else {
      // Use simple upload for small files
      const { PutObjectCommand } = require('@aws-sdk/client-s3');
      await this.s3Client.send(
        new PutObjectCommand({
          Bucket: this.bucketName,
          Key: key,
          Body: fileBuffer,
          ContentType: contentType,
          Metadata: metadata
        })
      );
      
      console.log(`✅ Simple upload completed: ${key}`);
      return {
        success: true,
        key
      };
    }
  }
}

module.exports = MultipartUploader;