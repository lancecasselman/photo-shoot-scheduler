import React, { useState } from "react";
import Uppy from "@uppy/core";
import type { UppyFile, UploadResult } from "@uppy/core";
import { DashboardModal } from "@uppy/react";
import "@uppy/core/dist/style.min.css";
import "@uppy/dashboard/dist/style.min.css";
import AwsS3 from "@uppy/aws-s3";
import type { AwsS3Options } from "@uppy/aws-s3";
// Image compression utilities
import { smartCompressImage, shouldCompressFile } from '../utils/imageCompression.js';
// Upload optimization feature flags
const FEATURES = {
  MULTIPART_UPLOAD: true,
  IMAGE_COMPRESSION: true,
  WEB_WORKER_PROCESSING: true,
  FALLBACK_MODE: true
};

interface ObjectUploaderProps {
  maxNumberOfFiles?: number;
  maxFileSize?: number;
  onGetUploadParameters: (fileName: string) => Promise<{
    method: "PUT";
    url: string;
  }>;
  onComplete?: (
    result: UploadResult<Record<string, unknown>, Record<string, unknown>>
  ) => void;
  buttonClassName?: string;
  children: React.ReactNode;
  // Enhanced upload options
  enableCompression?: boolean;
  enableMultipart?: boolean;
  sessionId?: string;
  folderType?: string;
}

/**
 * A file upload component that renders as a button and provides a modal interface for
 * file management.
 * 
 * Features:
 * - Renders as a customizable button that opens a file upload modal
 * - Provides a modal interface for:
 *   - File selection
 *   - File preview
 *   - Upload progress tracking
 *   - Upload status display
 * 
 * The component uses Uppy under the hood to handle all file upload functionality.
 * All file management features are automatically handled by the Uppy dashboard modal.
 * 
 * @param props - Component props
 * @param props.maxNumberOfFiles - Maximum number of files allowed to be uploaded
 *   (default: 2 for processing limitations)
 * @param props.maxFileSize - Maximum file size in bytes (default: unlimited)
 * @param props.onGetUploadParameters - Function to get upload parameters (method and URL).
 *   Typically used to fetch a presigned URL from the backend server for direct-to-S3
 *   uploads.
 * @param props.onComplete - Callback function called when upload is complete. Typically
 *   used to make post-upload API calls to update server state.
 * @param props.buttonClassName - Optional CSS class name for the button
 * @param props.children - Content to be rendered inside the button
 */
export function ObjectUploader({
  maxNumberOfFiles = 2, // Process 2 files at a time as requested
  maxFileSize, // No size limit as requested
  onGetUploadParameters,
  onComplete,
  buttonClassName,
  children,
  enableCompression = FEATURES.IMAGE_COMPRESSION,
  enableMultipart = FEATURES.MULTIPART_UPLOAD,
  sessionId,
  folderType,
}: ObjectUploaderProps) {
  const [showModal, setShowModal] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('');
  const [compressionStats, setCompressionStats] = useState({} as {[key: string]: any});
  
  const [uppy] = useState(() => {
    const uppyInstance = new Uppy({
      restrictions: {
        maxNumberOfFiles,
        maxFileSize: maxFileSize,
      },
      autoProceed: false,
    });

    // Add image compression hook if enabled
    if (enableCompression) {
      uppyInstance.on('file-added', async (file) => {
        try {
          if (shouldCompressFile(file.data as File)) {
            setProcessingStatus(`Compressing ${file.name}...`);
            const originalSize = file.size ?? 0;
            console.log(`🗜️ Compressing ${file.name} (${(originalSize / 1024 / 1024).toFixed(2)}MB)`);
            
            const compressedFile = await smartCompressImage(file.data as File);
            const reduction = originalSize > 0 ? ((originalSize - compressedFile.size) / originalSize * 100).toFixed(1) : '0';
            
            setCompressionStats(prev => ({
              ...prev,
              [file.id]: {
                originalSize: originalSize,
                compressedSize: compressedFile.size,
                reduction: reduction + '%'
              }
            }));
            
            // Update the file with compressed version
            uppyInstance.setFileState(file.id, {
              data: compressedFile,
              size: compressedFile.size
            });
            
            console.log(`✅ ${file.name} compressed by ${reduction}% (${(originalSize / 1024 / 1024).toFixed(2)}MB → ${(compressedFile.size / 1024 / 1024).toFixed(2)}MB)`);
            setProcessingStatus('');
          }
        } catch (error) {
          console.warn(`⚠️ Compression failed for ${file.name}, using original:`, error);
          setProcessingStatus('');
        }
      });
    }

    // Configure AWS S3 plugin with enhanced multipart support
    const awsS3Config: any = {
      shouldUseMultipart: enableMultipart ? (file: UppyFile<any, any>) => {
        const fileSize = file.size ?? 0;
        return fileSize > 50 * 1024 * 1024; // 50MB threshold
      } : false,
      // Enhanced multipart configuration for large files
      limit: enableMultipart ? 4 : 1, // 4 concurrent parts for multipart
      getUploadParameters: async (file: UppyFile<any, any>) => {
        try {
          // For multipart uploads, we need different endpoints
          const fileSize = file.size ?? 0;
          if (enableMultipart && fileSize > 50 * 1024 * 1024) { // 50MB threshold
            // Use multipart upload endpoint
            const response = await fetch('/api/r2/multipart/create', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({
                fileName: file.name || 'unnamed',
                fileSize: fileSize,
                contentType: file.type || 'application/octet-stream',
                sessionId,
                folderType
              })
            });
            
            if (!response.ok) {
              throw new Error(`Multipart upload setup failed: ${response.statusText}`);
            }
            
            return await response.json();
          } else {
            // Use simple upload for smaller files
            return await onGetUploadParameters(file.name || '');
          }
        } catch (error) {
          console.warn('Upload parameter fetch failed, falling back to simple upload:', error);
          return await onGetUploadParameters(file.name || '');
        }
      },
    };

    uppyInstance.use(AwsS3, awsS3Config);

    // Enhanced progress tracking
    uppyInstance.on('upload-progress', (file, progress) => {
      const percent = Math.round(progress.percentage || 0);
      setProcessingStatus(`Uploading ${file?.name}: ${percent}%`);
    });

    // Completion handler with compression stats
    uppyInstance.on('complete', (result) => {
      setProcessingStatus('Upload complete!');
      setTimeout(() => setProcessingStatus(''), 2000);
      
      // Log compression statistics
      const totalCompression = Object.values(compressionStats)
        .reduce((total: number, stats: any) => {
          const originalMB = stats.originalSize / (1024 * 1024);
          const compressedMB = stats.compressedSize / (1024 * 1024);
          return total + (originalMB - compressedMB);
        }, 0);
      
      if (totalCompression > 0) {
        console.log(`📊 Total bandwidth saved: ${totalCompression.toFixed(2)}MB`);
      }
      
      onComplete?.(result);
    });

    return uppyInstance;
  });

  return (
    <div>
      <button onClick={() => setShowModal(true)} className={buttonClassName}>
        {children}
      </button>
      
      {/* Processing status indicator */}
      {processingStatus && (
        <div className="upload-status" style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          background: '#007cba',
          color: 'white',
          padding: '10px 15px',
          borderRadius: '5px',
          zIndex: 9999,
          fontSize: '14px'
        }}>
          <div>{processingStatus}</div>
          {Object.keys(compressionStats).length > 0 && (
            <div style={{ fontSize: '12px', marginTop: '5px', opacity: 0.8 }}>
              {Object.keys(compressionStats).length} files compressed
            </div>
          )}
        </div>
      )}

      {/* @ts-ignore - Uppy React type compatibility */}
      <DashboardModal
        uppy={uppy}
        open={showModal}
        onRequestClose={() => setShowModal(false)}
        proudlyDisplayPoweredByUppy={false}
      />
    </div>
  );
}