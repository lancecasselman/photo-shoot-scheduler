const { Pool } = require('pg');

/**
 * Comprehensive Gallery Photo Sync System
 * Ensures photos column in photography_sessions stays synced with session_files
 */
class GalleryPhotoSync {
  constructor() {
    this.pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  }

  /**
   * Sync photos for a specific session
   */
  async syncSession(sessionId) {
    const client = await this.pool.connect();
    try {
      console.log(`🔄 Syncing photos for session: ${sessionId}`);
      
      const result = await client.query(`
        UPDATE photography_sessions 
        SET photos = (
          SELECT COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'url', '/r2/file/' || sf.r2_key,
                'filename', sf.filename,
                'originalName', sf.original_name,
                'fileSize', sf.file_size_bytes,
                'uploadedAt', sf.uploaded_at
              ) ORDER BY sf.uploaded_at ASC
            ), 
            '[]'::jsonb
          )
          FROM session_files sf 
          WHERE sf.session_id = $1 AND sf.folder_type = 'gallery'
        )
        WHERE id = $1
        RETURNING client_name, jsonb_array_length(photos) as photo_count
      `, [sessionId]);
      
      if (result.rows.length > 0) {
        const { client_name, photo_count } = result.rows[0];
        console.log(`✅ Synced ${photo_count || 0} photos for "${client_name}" (${sessionId})`);
        return { success: true, photoCount: photo_count || 0, clientName: client_name };
      } else {
        console.log(`⚠️ Session not found: ${sessionId}`);
        return { success: false, error: 'Session not found' };
      }
    } catch (error) {
      console.error(`❌ Error syncing session ${sessionId}:`, error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Sync all sessions that have uploaded files
   */
  async syncAllSessions() {
    const client = await this.pool.connect();
    try {
      console.log('🔄 Starting comprehensive photo sync for all sessions...');
      
      // Find all sessions that have gallery files
      const sessionsWithFiles = await client.query(`
        SELECT DISTINCT ps.id, ps.client_name, ps.gallery_access_token
        FROM photography_sessions ps
        INNER JOIN session_files sf ON ps.id = sf.session_id 
        WHERE sf.folder_type = 'gallery'
        ORDER BY ps.created_at DESC
      `);
      
      console.log(`📊 Found ${sessionsWithFiles.rows.length} sessions with gallery files`);
      
      let syncedCount = 0;
      let errorCount = 0;
      
      for (const session of sessionsWithFiles.rows) {
        const result = await this.syncSession(session.id);
        if (result.success) {
          syncedCount++;
        } else {
          errorCount++;
        }
      }
      
      console.log(`✅ Sync complete: ${syncedCount} synced, ${errorCount} errors`);
      return { 
        success: true, 
        totalSessions: sessionsWithFiles.rows.length,
        syncedCount, 
        errorCount 
      };
      
    } catch (error) {
      console.error('❌ Error during comprehensive sync:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Check sync status for all gallery-enabled sessions
   */
  async checkSyncStatus() {
    const client = await this.pool.connect();
    try {
      console.log('🔍 Checking sync status for all gallery-enabled sessions...');
      
      const result = await client.query(`
        SELECT 
          ps.id,
          ps.client_name,
          ps.gallery_access_token,
          COALESCE(jsonb_array_length(ps.photos), 0) as photos_in_session,
          COUNT(sf.id) as gallery_files_uploaded,
          CASE WHEN ps.gallery_access_token IS NOT NULL THEN 'ENABLED' ELSE 'DISABLED' END as gallery_status
        FROM photography_sessions ps
        LEFT JOIN session_files sf ON ps.id = sf.session_id AND sf.folder_type = 'gallery'
        WHERE ps.gallery_access_token IS NOT NULL
        GROUP BY ps.id, ps.client_name, ps.gallery_access_token, ps.photos
        ORDER BY ps.created_at DESC
      `);
      
      console.log('\n📊 SYNC STATUS REPORT:');
      console.log('=' .repeat(80));
      
      let syncedSessions = 0;
      let outOfSyncSessions = 0;
      
      result.rows.forEach(session => {
        const photosCount = parseInt(session.photos_in_session) || 0;
        const filesCount = parseInt(session.gallery_files_uploaded) || 0;
        const issynced = photosCount === filesCount;
        const status = issynced ? '✅ SYNCED' : '❌ OUT OF SYNC';
        
        console.log(`${status} | ${session.client_name} | Photos: ${photosCount}, Files: ${filesCount}, Gallery: ${session.gallery_status}`);
        
        if (issynced) {
          syncedSessions++;
        } else {
          outOfSyncSessions++;
        }
      });
      
      console.log('=' .repeat(80));
      console.log(`📈 SUMMARY: ${syncedSessions} synced, ${outOfSyncSessions} out of sync`);
      
      return {
        success: true,
        totalSessions: result.rows.length,
        syncedSessions,
        outOfSyncSessions,
        sessions: result.rows
      };
      
    } catch (error) {
      console.error('❌ Error checking sync status:', error);
      return { success: false, error: error.message };
    } finally {
      client.release();
    }
  }

  /**
   * Auto-sync after file upload (to be called from upload endpoints)
   */
  async autoSyncAfterUpload(sessionId, uploadedFiles = []) {
    console.log(`🔄 Auto-syncing photos for session ${sessionId} after upload of ${uploadedFiles.length} files`);
    
    const result = await this.syncSession(sessionId);
    
    if (result.success) {
      console.log(`✅ Auto-sync complete: ${result.photoCount} photos now available in gallery`);
    } else {
      console.error(`❌ Auto-sync failed for session ${sessionId}:`, result.error);
    }
    
    return result;
  }
}

module.exports = GalleryPhotoSync;

// Allow direct execution for manual sync operations
if (require.main === module) {
  const sync = new GalleryPhotoSync();
  
  const command = process.argv[2];
  
  switch (command) {
    case 'check':
      sync.checkSyncStatus().then(() => process.exit(0));
      break;
    case 'sync-all':
      sync.syncAllSessions().then(() => process.exit(0));
      break;
    case 'sync-session':
      const sessionId = process.argv[3];
      if (!sessionId) {
        console.error('Usage: node sync-gallery-photos.js sync-session <sessionId>');
        process.exit(1);
      }
      sync.syncSession(sessionId).then(() => process.exit(0));
      break;
    default:
      console.log('Available commands:');
      console.log('  check        - Check sync status for all sessions');
      console.log('  sync-all     - Sync all sessions');
      console.log('  sync-session - Sync specific session (requires sessionId)');
      process.exit(0);
  }
}