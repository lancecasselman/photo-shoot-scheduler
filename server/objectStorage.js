const { Storage } = require("@google-cloud/storage");
const { randomUUID } = require("crypto");

const REPLIT_SIDECAR_ENDPOINT = "http://127.0.0.1:1106";

// The object storage client is used to interact with the object storage service.
const objectStorageClient = new Storage({
  credentials: {
    audience: "replit",
    subject_token_type: "access_token",
    token_url: `${REPLIT_SIDECAR_ENDPOINT}/token`,
    type: "external_account",
    credential_source: {
      url: `${REPLIT_SIDECAR_ENDPOINT}/credential`,
      format: {
        type: "json",
        subject_token_field_name: "access_token",
      },
    },
    universe_domain: "googleapis.com",
  },
  projectId: "",
});

class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// The object storage service is used to interact with the object storage service.
class ObjectStorageService {
  constructor() {}

  // Gets the public object search paths.
  getPublicObjectSearchPaths() {
    const pathsStr = process.env.PUBLIC_OBJECT_SEARCH_PATHS || "";
    const paths = Array.from(
      new Set(
        pathsStr
          .split(",")
          .map((path) => path.trim())
          .filter((path) => path.length > 0)
      )
    );
    if (paths.length === 0) {
      throw new Error(
        "PUBLIC_OBJECT_SEARCH_PATHS not set. Create a bucket in 'Object Storage' " +
          "tool and set PUBLIC_OBJECT_SEARCH_PATHS env var (comma-separated paths)."
      );
    }
    return paths;
  }

  // Gets the private object directory.
  getPrivateObjectDir() {
    const dir = process.env.PRIVATE_OBJECT_DIR || "";
    if (!dir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }
    return dir;
  }

  // Search for a public object from the search paths.
  async searchPublicObject(filePath) {
    for (const searchPath of this.getPublicObjectSearchPaths()) {
      const fullPath = `${searchPath}/${filePath}`;

      // Full path format: /<bucket_name>/<object_name>
      const { bucketName, objectName } = parseObjectPath(fullPath);
      const bucket = objectStorageClient.bucket(bucketName);
      const file = bucket.file(objectName);

      // Check if file exists
      const [exists] = await file.exists();
      if (exists) {
        return file;
      }
    }

    return null;
  }

  // Downloads an object to the response.
  async downloadObject(file, res, cacheTtlSec = 3600) {
    try {
      // Get file metadata
      const [metadata] = await file.getMetadata();
      
      // Set appropriate headers
      res.set({
        "Content-Type": metadata.contentType || "application/octet-stream",
        "Content-Length": metadata.size,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
      });

      // Stream the file to the response
      const stream = file.createReadStream();

      stream.on("error", (err) => {
        console.error("Stream error:", err);
        if (!res.headersSent) {
          res.status(500).json({ error: "Error streaming file" });
        }
      });

      stream.pipe(res);
    } catch (error) {
      console.error("Error downloading file:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Error downloading file" });
      }
    }
  }

  // Gets the upload URL for a session file
  async getSessionFileUploadURL(sessionId, folderType, originalFileName = null) {
    const privateObjectDir = this.getPrivateObjectDir();
    if (!privateObjectDir) {
      throw new Error(
        "PRIVATE_OBJECT_DIR not set. Create a bucket in 'Object Storage' " +
          "tool and set PRIVATE_OBJECT_DIR env var."
      );
    }

    // Use original filename if provided, otherwise generate UUID
    const fileName = originalFileName || randomUUID();
    console.log(`ObjectStorage: Creating upload URL - originalFileName: ${originalFileName}, using fileName: ${fileName}`);
    const fullPath = `${privateObjectDir}/sessions/${sessionId}/${folderType}/${fileName}`;
    console.log(`ObjectStorage: Full path will be: ${fullPath}`);

    const { bucketName, objectName } = parseObjectPath(fullPath);

    // Sign URL for PUT method with TTL
    return signObjectURL({
      bucketName,
      objectName,
      method: "PUT",
      ttlSec: 900,
    });
  }

  // Gets session files
  async getSessionFiles(sessionId, folderType) {
    const privateObjectDir = this.getPrivateObjectDir();
    
    // Extract the bucket name and object path separately
    const { bucketName, objectName } = parseObjectPath(privateObjectDir);
    const prefix = `${objectName}/sessions/${sessionId}/${folderType}/`;
    
    const bucket = objectStorageClient.bucket(bucketName);
    const [files] = await bucket.getFiles({ prefix });
    
    return files;
  }

  // Delete a session file
  async deleteSessionFile(sessionId, folderType, fileName) {
    const privateObjectDir = this.getPrivateObjectDir();
    
    // Extract the bucket name and object path separately
    const { bucketName, objectName } = parseObjectPath(privateObjectDir);
    const objectPath = `${objectName}/sessions/${sessionId}/${folderType}/${fileName}`;
    
    const bucket = objectStorageClient.bucket(bucketName);
    const file = bucket.file(objectPath);
    
    await file.delete();
    
    // CRITICAL: Also remove from session_files database table for accurate storage calculations
    try {
      const { pool } = require('./db');
      
      // Delete both possible filename formats (full path and just filename)
      const deleteResult1 = await pool.query(
        'DELETE FROM session_files WHERE session_id = $1 AND filename = $2 AND folder_type = $3',
        [sessionId, fileName, folderType]
      );
      
      const deleteResult2 = await pool.query(
        'DELETE FROM session_files WHERE session_id = $1 AND filename LIKE $2 AND folder_type = $3',
        [sessionId, `%.private/sessions/${sessionId}/${folderType}/${fileName}`, folderType]
      );
      
      const totalDeleted = deleteResult1.rowCount + deleteResult2.rowCount;
      console.log(`🗑️ Removed ${totalDeleted} entries from database for file: ${fileName} (${folderType})`);
      
    } catch (dbError) {
      console.error(' Failed to remove file from database (storage calculation may be incorrect):', dbError.message);
      // Continue with success since Object Storage deletion worked
    }
  }
}

function parseObjectPath(path) {
  if (!path.startsWith("/")) {
    path = `/${path}`;
  }
  const pathParts = path.split("/");
  if (pathParts.length < 3) {
    throw new Error("Invalid path: must contain at least a bucket name");
  }

  const bucketName = pathParts[1];
  const objectName = pathParts.slice(2).join("/");

  return {
    bucketName,
    objectName,
  };
}

async function signObjectURL({
  bucketName,
  objectName,
  method,
  ttlSec,
}) {
  const request = {
    bucket_name: bucketName,
    object_name: objectName,
    method,
    expires_at: new Date(Date.now() + ttlSec * 1000).toISOString(),
  };
  const response = await fetch(
    `${REPLIT_SIDECAR_ENDPOINT}/object-storage/signed-object-url`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Failed to sign object URL, errorcode: ${response.status}, ` +
        `make sure you're running on Replit`
    );
  }

  const { signed_url: signedURL } = await response.json();
  return signedURL;
}

// Export for CommonJS
module.exports = {
  ObjectStorageService,
  ObjectNotFoundError,
  objectStorageClient
};