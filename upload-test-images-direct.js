const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

async function uploadDirectly() {
    const sessionId = '6fc2ee67-9455-4115-bd43-1102569080e6';
    const userId = 'dev-test-user-001';
    
    const s3Client = new S3Client({
        region: 'auto',
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
            accessKeyId: process.env.R2_ACCESS_KEY_ID,
            secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
        },
    });

    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    
    const imageFiles = [
        'attached_assets/stock_images/professional_wedding_c4029288.jpg',
        'attached_assets/stock_images/professional_wedding_b175dc7d.jpg',
        'attached_assets/stock_images/professional_wedding_be65ae5c.jpg'
    ];

    console.log('Uploading test wedding photos directly to R2 and database...');
    
    for (const imagePath of imageFiles) {
        try {
            const fileBuffer = fs.readFileSync(imagePath);
            const fileName = path.basename(imagePath);
            const fileSize = fileBuffer.length;
            const fileSizeMB = (fileSize / (1024 * 1024)).toFixed(2);
            
            const r2Key = `${userId}/${sessionId}/gallery/${fileName}`;
            const fileId = uuidv4();

            console.log(`Uploading ${fileName} to R2...`);
            
            const putCommand = new PutObjectCommand({
                Bucket: process.env.R2_BUCKET_NAME || 'photoappr2token',
                Key: r2Key,
                Body: fileBuffer,
                ContentType: 'image/jpeg',
            });

            await s3Client.send(putCommand);
            console.log(`✅ Uploaded to R2: ${r2Key}`);

            const insertQuery = `
                INSERT INTO r2_files (
                    id, session_id, user_id, filename, original_filename,
                    file_type, file_extension, file_size_bytes, file_size_mb,
                    r2_key, upload_status, upload_completed_at, created_at, updated_at
                ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW(), NOW(), NOW())
            `;
            
            await pool.query(insertQuery, [
                fileId,
                sessionId,
                userId,
                fileName,
                fileName,
                'gallery',
                '.jpg',
                fileSize.toString(),
                fileSizeMB,
                r2Key,
                'completed'
            ]);
            
            console.log(`✅ Added to database: ${fileName}`);
            
        } catch (error) {
            console.error(`Error uploading ${imagePath}:`, error.message);
        }
    }
    
    await pool.end();
    console.log('\n✅ Upload complete! Images should now be available in the gallery manager.');
}

uploadDirectly().catch(console.error);