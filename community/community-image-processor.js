// Community Platform Image Processing System
const sharp = require('sharp');
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const path = require('path');
const fs = require('fs').promises;

class CommunityImageProcessor {
    constructor(r2Config) {
        this.r2Client = new S3Client({
            endpoint: r2Config.endpoint,
            region: 'auto',
            credentials: {
                accessKeyId: r2Config.accessKeyId,
                secretAccessKey: r2Config.secretAccessKey
            }
        });
        this.bucketName = r2Config.bucketName;
    }

    async processImage(imageBuffer, filename, userId) {
        try {
            const timestamp = Date.now();
            const baseKey = `community/${userId}/${timestamp}`;
            
            // Get image metadata
            const metadata = await sharp(imageBuffer).metadata();
            console.log(`Processing image: ${filename}, Size: ${imageBuffer.length} bytes`);

            // Process and store different versions
            const versions = await Promise.all([
                this.createThumbnail(imageBuffer, metadata, `${baseKey}_thumb`),
                this.createFeedVersion(imageBuffer, metadata, `${baseKey}_feed`),
                this.createFullVersion(imageBuffer, metadata, `${baseKey}_full`),
                this.storeOriginal(imageBuffer, `${baseKey}_original`, filename)
            ]);

            return {
                thumbnail: versions[0],
                feed: versions[1],
                full: versions[2],
                original: versions[3],
                metadata: {
                    width: metadata.width,
                    height: metadata.height,
                    format: metadata.format,
                    size: imageBuffer.length
                }
            };
        } catch (error) {
            console.error('Error processing image:', error);
            throw error;
        }
    }

    async createThumbnail(buffer, metadata, key) {
        try {
            // Target: 200KB max, 400px width
            const processed = await sharp(buffer)
                .resize(400, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .webp({ quality: 80 })
                .toBuffer();

            // If still too large, reduce quality
            let finalBuffer = processed;
            let quality = 70;
            while (finalBuffer.length > 200 * 1024 && quality > 30) {
                finalBuffer = await sharp(buffer)
                    .resize(400, null, {
                        withoutEnlargement: true,
                        fit: 'inside'
                    })
                    .webp({ quality })
                    .toBuffer();
                quality -= 10;
            }

            const url = await this.uploadToR2(finalBuffer, `${key}.webp`, 'image/webp');
            console.log(`Thumbnail created: ${finalBuffer.length} bytes`);
            return url;
        } catch (error) {
            console.error('Error creating thumbnail:', error);
            throw error;
        }
    }

    async createFeedVersion(buffer, metadata, key) {
        try {
            // Target: 2MB max, 1200px width
            const processed = await sharp(buffer)
                .resize(1200, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .webp({ quality: 85 })
                .toBuffer();

            // If still too large, reduce quality
            let finalBuffer = processed;
            let quality = 75;
            while (finalBuffer.length > 2 * 1024 * 1024 && quality > 40) {
                finalBuffer = await sharp(buffer)
                    .resize(1200, null, {
                        withoutEnlargement: true,
                        fit: 'inside'
                    })
                    .webp({ quality })
                    .toBuffer();
                quality -= 10;
            }

            const url = await this.uploadToR2(finalBuffer, `${key}.webp`, 'image/webp');
            console.log(`Feed version created: ${finalBuffer.length} bytes`);
            return url;
        } catch (error) {
            console.error('Error creating feed version:', error);
            throw error;
        }
    }

    async createFullVersion(buffer, metadata, key) {
        try {
            // Target: 10MB max, 2400px width
            const processed = await sharp(buffer)
                .resize(2400, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .webp({ quality: 90 })
                .toBuffer();

            // If still too large, reduce quality
            let finalBuffer = processed;
            let quality = 80;
            while (finalBuffer.length > 10 * 1024 * 1024 && quality > 50) {
                finalBuffer = await sharp(buffer)
                    .resize(2400, null, {
                        withoutEnlargement: true,
                        fit: 'inside'
                    })
                    .webp({ quality })
                    .toBuffer();
                quality -= 10;
            }

            const url = await this.uploadToR2(finalBuffer, `${key}.webp`, 'image/webp');
            console.log(`Full version created: ${finalBuffer.length} bytes`);
            return url;
        } catch (error) {
            console.error('Error creating full version:', error);
            throw error;
        }
    }

    async storeOriginal(buffer, key, filename) {
        try {
            const ext = path.extname(filename).toLowerCase();
            const mimeType = this.getMimeType(ext);
            const url = await this.uploadToR2(buffer, `${key}${ext}`, mimeType);
            console.log(`Original stored: ${buffer.length} bytes`);
            return url;
        } catch (error) {
            console.error('Error storing original:', error);
            throw error;
        }
    }

    async uploadToR2(buffer, key, contentType) {
        try {
            const command = new PutObjectCommand({
                Bucket: this.bucketName,
                Key: key,
                Body: buffer,
                ContentType: contentType,
                Metadata: {
                    'uploaded-by': 'community-platform'
                }
            });

            await this.r2Client.send(command);
            
            // Return the public URL
            return `https://${this.bucketName}.r2.cloudflarestorage.com/${key}`;
        } catch (error) {
            console.error('Error uploading to R2:', error);
            throw error;
        }
    }

    getMimeType(extension) {
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp',
            '.bmp': 'image/bmp',
            '.tiff': 'image/tiff',
            '.svg': 'image/svg+xml'
        };
        return mimeTypes[extension] || 'image/jpeg';
    }

    async extractCameraSettings(buffer) {
        try {
            const metadata = await sharp(buffer).metadata();
            
            // Extract EXIF data if available
            if (metadata.exif) {
                const exif = metadata.exif;
                return {
                    camera: exif.Make && exif.Model ? `${exif.Make} ${exif.Model}` : null,
                    lens: exif.LensModel || null,
                    focalLength: exif.FocalLength || null,
                    aperture: exif.FNumber || null,
                    shutterSpeed: exif.ExposureTime || null,
                    iso: exif.ISO || null,
                    dateTaken: exif.DateTimeOriginal || null
                };
            }
            
            return null;
        } catch (error) {
            console.error('Error extracting camera settings:', error);
            return null;
        }
    }

    async createBeforeAfterComparison(beforeBuffer, afterBuffer, userId) {
        try {
            const timestamp = Date.now();
            const baseKey = `community/${userId}/${timestamp}_comparison`;
            
            // Process both images
            const beforeMetadata = await sharp(beforeBuffer).metadata();
            const afterMetadata = await sharp(afterBuffer).metadata();
            
            // Create consistent sized versions for comparison
            const targetWidth = Math.min(1200, Math.max(beforeMetadata.width, afterMetadata.width));
            
            const beforeProcessed = await sharp(beforeBuffer)
                .resize(targetWidth, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .webp({ quality: 85 })
                .toBuffer();
                
            const afterProcessed = await sharp(afterBuffer)
                .resize(targetWidth, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .webp({ quality: 85 })
                .toBuffer();
            
            const beforeUrl = await this.uploadToR2(beforeProcessed, `${baseKey}_before.webp`, 'image/webp');
            const afterUrl = await this.uploadToR2(afterProcessed, `${baseKey}_after.webp`, 'image/webp');
            
            // Also create a side-by-side preview
            const sideBySide = await this.createSideBySidePreview(beforeBuffer, afterBuffer, targetWidth);
            const previewUrl = await this.uploadToR2(sideBySide, `${baseKey}_preview.webp`, 'image/webp');
            
            return {
                before: beforeUrl,
                after: afterUrl,
                preview: previewUrl
            };
        } catch (error) {
            console.error('Error creating before/after comparison:', error);
            throw error;
        }
    }

    async createSideBySidePreview(beforeBuffer, afterBuffer, targetWidth) {
        try {
            const halfWidth = Math.floor(targetWidth / 2);
            
            // Resize both images to half width
            const beforeHalf = await sharp(beforeBuffer)
                .resize(halfWidth, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .toBuffer();
                
            const afterHalf = await sharp(afterBuffer)
                .resize(halfWidth, null, {
                    withoutEnlargement: true,
                    fit: 'inside'
                })
                .toBuffer();
            
            // Get dimensions
            const beforeMeta = await sharp(beforeHalf).metadata();
            const afterMeta = await sharp(afterHalf).metadata();
            
            const height = Math.max(beforeMeta.height, afterMeta.height);
            
            // Create composite image
            const composite = await sharp({
                create: {
                    width: targetWidth,
                    height: height,
                    channels: 4,
                    background: { r: 0, g: 0, b: 0, alpha: 0 }
                }
            })
            .composite([
                { input: beforeHalf, left: 0, top: 0 },
                { input: afterHalf, left: halfWidth, top: 0 }
            ])
            .webp({ quality: 85 })
            .toBuffer();
            
            return composite;
        } catch (error) {
            console.error('Error creating side-by-side preview:', error);
            throw error;
        }
    }
}

module.exports = CommunityImageProcessor;