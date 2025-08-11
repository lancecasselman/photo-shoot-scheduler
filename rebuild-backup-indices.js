#!/usr/bin/env node

/**
 * Rebuild backup indices for existing R2 files
 * This script scans R2 storage and recreates backup indices for sessions
 */

const { S3Client, ListObjectsV2Command, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');

class BackupIndexRebuilder {
    constructor() {
        this.pool = new Pool({
            connectionString: process.env.DATABASE_URL
        });
        
        this.s3Client = new S3Client({
            region: 'auto',
            endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
            credentials: {
                accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
                secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
            },
            forcePathStyle: true,
        });
        
        this.bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;
    }

    async rebuildIndices() {
        console.log('🔧 REBUILDING BACKUP INDICES');
        console.log('=============================\n');

        try {
            // 1. Scan all R2 objects
            const allObjects = await this.scanAllR2Objects();
            
            // 2. Group by session
            const sessionMap = await this.groupObjectsBySession(allObjects);
            
            // 3. Rebuild backup indices
            await this.createBackupIndices(sessionMap);
            
        } catch (error) {
            console.error('❌ Index rebuild failed:', error);
        } finally {
            await this.pool.end();
        }
    }

    async scanAllR2Objects() {
        console.log('1. 🔍 Scanning R2 storage...');
        
        const allObjects = [];
        let continuationToken = null;
        
        do {
            const listCommand = new ListObjectsV2Command({
                Bucket: this.bucketName,
                MaxKeys: 1000,
                ContinuationToken: continuationToken
            });
            
            const response = await this.s3Client.send(listCommand);
            
            if (response.Contents) {
                allObjects.push(...response.Contents);
            }
            
            continuationToken = response.NextContinuationToken;
            
        } while (continuationToken);
        
        console.log(`   Found ${allObjects.length} objects in R2`);
        
        // Filter out non-session files
        const sessionFiles = allObjects.filter(obj => 
            obj.Key.startsWith('photographer-') && 
            obj.Key.includes('/session-') &&
            !obj.Key.endsWith('/backup-index.json')
        );
        
        console.log(`   Found ${sessionFiles.length} session files`);
        return sessionFiles;
    }

    async groupObjectsBySession(objects) {
        console.log('2. 📁 Grouping files by session...');
        
        const sessionMap = new Map();
        
        for (const obj of objects) {
            // Parse the key: photographer-{userId}/session-{sessionId}/...
            const keyParts = obj.Key.split('/');
            
            if (keyParts.length >= 3 && keyParts[1].startsWith('session-')) {
                const userId = keyParts[0].replace('photographer-', '');
                const sessionId = keyParts[1].replace('session-', '');
                const sessionKey = `${userId}/${sessionId}`;
                
                if (!sessionMap.has(sessionKey)) {
                    sessionMap.set(sessionKey, {
                        userId,
                        sessionId,
                        files: []
                    });
                }
                
                // Determine file type and folder
                const isInThumbnails = obj.Key.includes('/thumbnails/');
                const isInRaw = obj.Key.includes('/raw/');
                const isInGallery = obj.Key.includes('/gallery/');
                
                if (!isInThumbnails) { // Skip thumbnails for main file list
                    const filename = keyParts[keyParts.length - 1];
                    const fileType = isInRaw ? 'raw' : isInGallery ? 'gallery' : 'other';
                    
                    sessionMap.get(sessionKey).files.push({
                        filename,
                        r2Key: obj.Key,
                        fileType,
                        fileSizeBytes: obj.Size || 0,
                        fileSizeMB: ((obj.Size || 0) / (1024 * 1024)).toFixed(2),
                        lastModified: obj.LastModified,
                        contentType: this.guessContentType(filename),
                        originalFormat: filename.split('.').pop()?.toLowerCase()
                    });
                }
            }
        }
        
        console.log(`   Grouped into ${sessionMap.size} sessions`);
        return sessionMap;
    }

    async createBackupIndices(sessionMap) {
        console.log('3. 📝 Creating backup indices...');
        
        let created = 0;
        
        for (const [sessionKey, sessionData] of sessionMap) {
            try {
                const { userId, sessionId, files } = sessionData;
                
                // Create backup index object
                const backupIndex = {
                    sessionId,
                    userId,
                    totalFiles: files.length,
                    totalSizeBytes: files.reduce((sum, f) => sum + f.fileSizeBytes, 0),
                    totalSizeMB: files.reduce((sum, f) => sum + parseFloat(f.fileSizeMB), 0).toFixed(2),
                    lastUpdated: new Date().toISOString(),
                    files: files
                };
                
                // Upload backup index to R2
                const indexKey = `photographer-${userId}/session-${sessionId}/backup-index.json`;
                
                const putCommand = new PutObjectCommand({
                    Bucket: this.bucketName,
                    Key: indexKey,
                    Body: JSON.stringify(backupIndex, null, 2),
                    ContentType: 'application/json'
                });
                
                await this.s3Client.send(putCommand);
                
                console.log(`   ✅ Created index for session ${sessionId} (${files.length} files, ${backupIndex.totalSizeMB}MB)`);
                created++;
                
            } catch (error) {
                console.error(`   ❌ Failed to create index for ${sessionKey}:`, error.message);
            }
        }
        
        console.log(`\n✅ Successfully created ${created} backup indices`);
    }

    guessContentType(filename) {
        const ext = filename.toLowerCase().split('.').pop();
        const typeMap = {
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'tif': 'image/tiff',
            'tiff': 'image/tiff',
            'bmp': 'image/bmp',
            'webp': 'image/webp',
            'nef': 'image/x-nikon-nef',
            'cr2': 'image/x-canon-cr2',
            'arw': 'image/x-sony-arw',
            'dng': 'image/x-adobe-dng',
            'mp4': 'video/mp4',
            'mov': 'video/quicktime',
            'pdf': 'application/pdf'
        };
        
        return typeMap[ext] || 'application/octet-stream';
    }
}

// Run the rebuilder
const rebuilder = new BackupIndexRebuilder();
rebuilder.rebuildIndices().then(() => {
    console.log('🎯 BACKUP INDEX REBUILD COMPLETE');
    process.exit(0);
}).catch(error => {
    console.error('❌ Rebuild failed:', error);
    process.exit(1);
});