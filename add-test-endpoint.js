const fs = require('fs');

// Read the server.js file
const serverContent = fs.readFileSync('server.js', 'utf8');

// Find the line with the duplicate endpoint comment
const insertPosition = serverContent.indexOf('// DUPLICATE ENDPOINT - Commented out');

if (insertPosition === -1) {
    console.error('Could not find insertion point');
    process.exit(1);
}

// Create the test endpoint code
const testEndpoint = `
// TEMPORARY TEST ENDPOINT - FOR TESTING ONLY - REMOVE IN PRODUCTION
app.get('/api/test/sessions/:sessionId/photos', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const { folder } = req.query; // 'gallery' or 'raw'
        
        console.log('🧪 TEST ENDPOINT: Loading photos for session', sessionId, 'folder:', folder);
        
        // Get session info from database
        const sessionResult = await pool.query(
            'SELECT id, client_name, user_id FROM photography_sessions WHERE id = $1',
            [sessionId]
        );
        
        if (sessionResult.rows.length === 0) {
            return res.status(404).json({ error: 'Session not found' });
        }
        
        const userId = sessionResult.rows[0].user_id;
        console.log('🧪 TEST: Found session for user', userId);
        
        // Get files from r2_files table
        let filesQuery = \`
            SELECT filename, original_filename, file_type, file_extension,
                   file_size_bytes, file_size_mb, r2_key, upload_status,
                   created_at
            FROM r2_files 
            WHERE session_id = $1\`;
        
        const queryParams = [sessionId];
        
        if (folder) {
            filesQuery += ' AND file_type = $2';
            queryParams.push(folder);
        }
        
        filesQuery += ' ORDER BY created_at DESC';
        
        const filesResult = await pool.query(filesQuery, queryParams);
        console.log('🧪 TEST: Found', filesResult.rows.length, 'files in database');
        
        // Get R2 file manager
        const R2FileManager = require('./server/r2-file-manager');
        const r2Manager = new R2FileManager(null, pool);
        
        // Process files and generate URLs
        const filesWithUrls = [];
        
        for (const file of filesResult.rows) {
            try {
                // Get presigned URL for the main file
                const url = await r2Manager.getSignedUrl(file.r2_key, 3600);
                
                // Try to get thumbnail URLs
                let thumbnails = {};
                if (r2Manager.isImageFile(file.filename)) {
                    // Get the directory path and filename parts
                    const parts = file.r2_key.split('/');
                    const filename = parts.pop();
                    const dirPath = parts.join('/');
                    const nameWithoutExt = filename.substring(0, filename.lastIndexOf('.'));
                    const ext = filename.substring(filename.lastIndexOf('.'));
                    
                    // Try different thumbnail paths
                    const thumbnailPaths = [
                        // Path 1: in thumbnails subdirectory
                        \`\${dirPath}/thumbnails/\${nameWithoutExt}_sm\${ext}\`,
                        \`\${dirPath}/thumbnails/\${nameWithoutExt}_md\${ext}\`,
                        \`\${dirPath}/thumbnails/\${nameWithoutExt}_lg\${ext}\`,
                        // Path 2: same directory with suffix
                        \`\${dirPath}/\${nameWithoutExt}_sm\${ext}\`,
                        \`\${dirPath}/\${nameWithoutExt}_md\${ext}\`,
                        \`\${dirPath}/\${nameWithoutExt}_lg\${ext}\`
                    ];
                    
                    // Try to get URLs for each thumbnail
                    for (const thumbPath of thumbnailPaths) {
                        try {
                            const thumbUrl = await r2Manager.getSignedUrl(thumbPath, 3600);
                            if (thumbUrl) {
                                if (thumbPath.includes('_sm')) thumbnails.sm = thumbUrl;
                                if (thumbPath.includes('_md')) thumbnails.md = thumbUrl;
                                if (thumbPath.includes('_lg')) thumbnails.lg = thumbUrl;
                            }
                        } catch (err) {
                            // Thumbnail doesn't exist, skip
                        }
                    }
                }
                
                filesWithUrls.push({
                    fileName: file.filename,
                    originalName: file.original_filename || file.filename,
                    url: url,
                    thumbnails: thumbnails,
                    thumbnailUrl: thumbnails.md || thumbnails.sm || url,
                    fileSize: (file.file_size_mb || 0) + 'MB',
                    fileSizeBytes: file.file_size_bytes || 0,
                    uploadDate: file.created_at,
                    fileType: file.file_type,
                    r2Key: file.r2_key
                });
                
            } catch (error) {
                console.error('🧪 TEST: Error processing file', file.filename, error.message);
                // Still include the file even if URL generation fails
                filesWithUrls.push({
                    fileName: file.filename,
                    originalName: file.original_filename || file.filename,
                    url: null,
                    thumbnails: {},
                    error: error.message,
                    fileSize: (file.file_size_mb || 0) + 'MB',
                    fileSizeBytes: file.file_size_bytes || 0,
                    uploadDate: file.created_at,
                    fileType: file.file_type,
                    r2Key: file.r2_key
                });
            }
        }
        
        console.log('🧪 TEST: Processed', filesWithUrls.length, 'files with URLs');
        console.log('🧪 TEST: Files with thumbnails:', filesWithUrls.filter(f => f.thumbnails && Object.keys(f.thumbnails).length > 0).length);
        
        // Return the response in the expected format
        res.json(filesWithUrls);
        
    } catch (error) {
        console.error('🧪 TEST ENDPOINT ERROR:', error);
        res.status(500).json({ 
            error: 'Failed to fetch photos', 
            message: error.message,
            stack: error.stack
        });
    }
});

`;

// Insert the test endpoint before the duplicate endpoint comment
const newServerContent = serverContent.slice(0, insertPosition) + testEndpoint + serverContent.slice(insertPosition);

// Write the updated file
fs.writeFileSync('server.js', newServerContent);

console.log('✅ Test endpoint added to server.js');
console.log('🔗 Test endpoint URL: /api/test/sessions/:sessionId/photos');
console.log('⚠️ Remember to remove this endpoint before deploying to production!');