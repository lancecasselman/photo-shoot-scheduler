# Download Orchestrator API Documentation

## Overview

The Download Orchestrator is a unified download system that replaces the legacy multi-service architecture. It provides a clean, explicit pipeline for handling photo downloads across all pricing models (FREE, FREEMIUM, PAID).

## Architecture

The orchestrator uses a 5-stage pipeline:
1. **Authenticate** → Validate access tokens and session ownership
2. **Policy Resolve** → Determine pricing model and constraints  
3. **Entitlement** → Verify download permissions and quotas
4. **File Lookup** → Locate file in sessionFiles table
5. **Delivery** → Stream file with appropriate processing

## API Endpoints

### Base URL: `/api/downloads/orchestrator`

### 1. Download Photo by Filename (Gallery Token Access)
```
GET /api/downloads/orchestrator/session/{sessionId}/file/{filename}?token={gallery_token}
```

**Parameters:**
- `sessionId` (path): Photography session ID
- `filename` (path): Photo filename
- `token` (query): Gallery access token

**Example:**
```javascript
fetch('/api/downloads/orchestrator/session/abc123/file/photo1.jpg?token=gallery_xyz')
```

### 2. Download Photo by ID (Gallery Token Access)
```
GET /api/downloads/orchestrator/session/{sessionId}/photo/{photoId}?token={gallery_token}
```

**Parameters:**
- `sessionId` (path): Photography session ID
- `photoId` (path): Photo ID
- `token` (query): Gallery access token

**Example:**
```javascript
fetch('/api/downloads/orchestrator/session/abc123/photo/photo1.jpg?token=gallery_xyz')
```

### 3. Download Photo (Authenticated User Access)
```
GET /api/downloads/orchestrator/auth/session/{sessionId}/file/{filename}
```

**Authentication:** Requires user authentication middleware (session owner)

**Parameters:**
- `sessionId` (path): Photography session ID
- `filename` (path): Photo filename

**Example:**
```javascript
fetch('/api/downloads/orchestrator/auth/session/abc123/file/photo1.jpg', {
  credentials: 'include'  // Include session cookies
})
```

### 4. Generic Process Endpoint
```
POST /api/downloads/orchestrator/process
```

**Request Body:**
```json
{
  "sessionId": "abc123",
  "photoId": "photo1.jpg",
  "filename": "photo1.jpg",
  "token": "gallery_xyz",  // For gallery access
  "userId": "user123"      // For owner access
}
```

**Example:**
```javascript
fetch('/api/downloads/orchestrator/process', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sessionId: 'abc123',
    photoId: 'photo1.jpg',
    token: 'gallery_xyz'
  })
})
```

### 5. Health Check
```
GET /api/downloads/orchestrator/health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "download-orchestrator",
  "timestamp": "2025-01-01T12:00:00.000Z",
  "version": "1.0.0"
}
```

## Response Format

### Success Response
```json
{
  "success": true,
  "data": {
    // File stream or download URL
  },
  "correlationId": "abc-123-def",
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "code": "PHOTO_NOT_FOUND",
    "message": "The requested photo was not found in this session",
    "userFriendlyMessage": "This photo is not available for download",
    "correlationId": "abc-123-def",
    "timestamp": "2025-01-01T12:00:00.000Z",
    "context": {
      "sessionId": "abc123",
      "photoId": "photo1.jpg"
    },
    "recoverySuggestions": [
      "Verify the photo exists in the gallery",
      "Check if the gallery link has expired"
    ]
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `SESSION_NOT_FOUND` | 404 | Photography session not found |
| `INVALID_TOKEN` | 401 | Gallery access token is invalid |
| `EXPIRED_ACCESS` | 401 | Gallery access has expired |
| `UNAUTHORIZED` | 403 | User does not own this session |
| `PHOTO_NOT_FOUND` | 404 | Photo not found in session |
| `FILE_NOT_FOUND` | 404 | Physical file not found in storage |
| `PAYMENT_REQUIRED` | 402 | Payment required for download |
| `QUOTA_EXCEEDED` | 429 | Download quota exceeded |
| `PROCESSING_ERROR` | 500 | Internal processing error |

## Pricing Model Behavior

### FREE Model
- Unlimited downloads
- No payment required
- Optional watermarking

### FREEMIUM Model
- Limited free downloads per client
- Payment required after quota exceeded
- Watermarked previews until payment

### PAID Model
- Payment required for all downloads
- No free downloads
- High-quality files after payment

## Rate Limiting

- **Download requests**: 100 requests per 15 minutes per IP
- **File downloads**: 50 downloads per hour per IP per session

## Migration from Legacy System

### Old Endpoints (DEPRECATED)
```javascript
// OLD - Do not use
fetch('/api/downloads/session/abc123/photo/photo1.jpg?token=xyz')
```

### New Endpoints (RECOMMENDED)
```javascript
// NEW - Use this
fetch('/api/downloads/orchestrator/session/abc123/photo/photo1.jpg?token=xyz')
```

### Key Changes
1. **URL Path**: Add `/orchestrator` to the path
2. **Error Format**: Structured error responses with correlation IDs
3. **Rate Limiting**: Enhanced rate limiting with proper headers
4. **Logging**: Structured logging with correlation tracking

## Client Integration Examples

### React Hook Example
```javascript
import { useState, useCallback } from 'react';

function usePhotoDownload() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const downloadPhoto = useCallback(async (sessionId, photoId, token) => {
    setLoading(true);
    setError(null);
    
    try {
      const response = await fetch(
        `/api/downloads/orchestrator/session/${sessionId}/photo/${photoId}?token=${token}`
      );
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error.userFriendlyMessage);
      }
      
      // Handle file download
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = photoId;
      a.click();
      window.URL.revokeObjectURL(url);
      
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  return { downloadPhoto, loading, error };
}
```

### Error Handling Best Practices
```javascript
async function handleDownload(sessionId, photoId, token) {
  try {
    const response = await fetch(
      `/api/downloads/orchestrator/session/${sessionId}/photo/${photoId}?token=${token}`
    );
    
    if (!response.ok) {
      const errorData = await response.json();
      
      switch (errorData.error.code) {
        case 'PAYMENT_REQUIRED':
          // Redirect to payment flow
          showPaymentModal(errorData.error.context);
          break;
        case 'QUOTA_EXCEEDED':
          // Show upgrade prompt
          showUpgradePrompt();
          break;
        case 'EXPIRED_ACCESS':
          // Request new gallery link
          requestNewGalleryLink();
          break;
        default:
          // Show generic error
          showError(errorData.error.userFriendlyMessage);
      }
      return;
    }
    
    // Handle successful download...
    
  } catch (error) {
    console.error('Download failed:', error);
    showError('Download failed. Please try again.');
  }
}
```

## Testing

### Health Check
```bash
curl -X GET "http://localhost:5000/api/downloads/orchestrator/health"
```

### Download Test
```bash
curl -X GET "http://localhost:5000/api/downloads/orchestrator/session/test-session/file/test.jpg?token=test-token" \
  -H "Accept: application/json"
```

## Monitoring

The orchestrator provides structured logging with correlation IDs for tracing requests across the entire pipeline. Monitor these log fields:

- `correlationId`: Unique request identifier
- `stage`: Pipeline stage (authenticate, policyResolve, entitlement, fileLookup, delivery)
- `sessionId`: Photography session
- `photoId`: Photo identifier
- `userId`: User ID (for authenticated requests)
- `error.code`: Error classification
- `processingTime`: Stage execution time

## Support

For issues or questions:
1. Check the correlation ID in error responses
2. Search logs using the correlation ID
3. Review error recovery suggestions
4. Escalate with full context and correlation ID

## Version History

- **v1.0.0**: Initial orchestrator implementation
- Replaces legacy multi-service architecture
- Unified pipeline with explicit stages
- Enhanced error handling and monitoring