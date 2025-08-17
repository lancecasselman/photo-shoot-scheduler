#!/usr/bin/env node
const { S3Client, ListObjectsV2Command } = require('@aws-sdk/client-s3');

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.CLOUDFLARE_R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.CLOUDFLARE_R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
  },
  forcePathStyle: true,
});

async function listR2Contents() {
  try {
    console.log(' Scanning R2 bucket contents...');
    
    const listCommand = new ListObjectsV2Command({
      Bucket: process.env.CLOUDFLARE_R2_BUCKET_NAME,
      MaxKeys: 100
    });
    
    const response = await s3Client.send(listCommand);
    
    if (response.Contents && response.Contents.length > 0) {
      console.log(` Found ${response.Contents.length} objects in R2:`);
      console.log('\n📂 Directory Structure:');
      
      const paths = new Set();
      
      response.Contents.forEach((object, index) => {
        console.log(`${index + 1}. ${object.Key} (${object.Size} bytes)`);
        
        // Extract directory structure
        const pathParts = object.Key.split('/');
        for (let i = 1; i <= pathParts.length; i++) {
          const partialPath = pathParts.slice(0, i).join('/');
          if (partialPath) paths.add(partialPath);
        }
      });
      
      console.log('\n🗂️ Unique Path Patterns:');
      Array.from(paths).sort().forEach(path => {
        console.log(`   ${path}`);
      });
      
    } else {
      console.log('❌ No objects found in R2 bucket');
    }
    
  } catch (error) {
    console.error('❌ Error listing R2 contents:', error.message);
  }
}

listR2Contents();