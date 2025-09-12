# Google Cloud Deployment Guide

## Prerequisites
- Google Cloud Project with billing enabled
- Docker installed locally (for testing)
- gcloud CLI installed and authenticated
- Container Registry API enabled
- Cloud Run API enabled

## Quick Start Deployment

### Option 1: Docker Build + Cloud Run
```bash
# Build and tag the image
docker build -t us-central1-docker.pkg.dev/YOUR_PROJECT_ID/photo-management-system/photo-management-system:latest .

# Push to Google Container Registry
docker push us-central1-docker.pkg.dev/YOUR_PROJECT_ID/photo-management-system/photo-management-system:latest

# Deploy to Cloud Run
gcloud run deploy photo-management-system \
  --image us-central1-docker.pkg.dev/YOUR_PROJECT_ID/photo-management-system/photo-management-system:latest \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000
```

### Option 2: Cloud Build (Automated)
```bash
# Submit build to Cloud Build
gcloud builds submit --config cloudbuild.yaml .
```

## Required Environment Variables

Set these in Cloud Run environment variables:

### Database
```
DATABASE_URL=postgresql://user:password@host:port/database
```

### Firebase
```
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"your-project",...}
```

### Cloudflare R2
```
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
```

### Stripe
```
STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
STRIPE_PUBLIC_KEY=pk_live_your_stripe_public_key
```

### SendGrid
```
SENDGRID_API_KEY=SG.your_sendgrid_api_key
```

### WHCC Print Service (CRITICAL FOR PRODUCTION SECURITY)
```
# WHCC API Credentials
OAS_CONSUMER_KEY=your_whcc_consumer_key
OAS_CONSUMER_SECRET=your_whcc_consumer_secret
EDITOR_API_KEY_ID=your_whcc_editor_key_id
EDITOR_API_KEY_SECRET=your_whcc_editor_key_secret

# PRODUCTION SECURITY: Webhook Signature Verification
WHCC_WEBHOOK_SECRET=your_whcc_webhook_secret_from_dashboard

# Environment Mode (MANDATORY for security)
WHCC_ENV=production  # Use 'sandbox' only for testing
OAS_API_URL=https://apps.whcc.com  # Production URL (default)
```

**⚠️ CRITICAL SECURITY WARNING:**
- WHCC_WEBHOOK_SECRET is MANDATORY for production deployment
- Missing webhook secret allows forged webhook callbacks
- Server will refuse to start in production without this secret
- Use WHCC_ENV=sandbox only for development/testing

### Application Config
```
NODE_ENV=production
PORT=3000
SESSION_SECRET=your_secure_session_secret
```

## Deployment Files Created

✅ **Dockerfile** - Simple Node.js container configuration
✅ **.dockerignore** - Excludes unnecessary files from container
✅ **.env.example** - Template for environment variables
✅ **app.yaml** - App Engine configuration (alternative deployment)
✅ **cloudbuild.yaml** - Automated Cloud Build pipeline
✅ **DEPLOYMENT.md** - This deployment guide

## Health Check

The application includes a health check endpoint:
```
GET /health
Response: {"status":"healthy","timestamp":"2025-01-09T18:00:00.000Z","version":"1.0.0"}
```

## Port Configuration

- **Development**: Port 5000 (current Replit setup)
- **Production**: Port 3000 (Google Cloud standard)
- **Environment Variable**: Uses `PORT` env var if set

## Database Setup

Ensure your PostgreSQL database is accessible from Google Cloud:
1. Use Google Cloud SQL or external PostgreSQL
2. Configure connection string in DATABASE_URL
3. Ensure firewall allows connections from Cloud Run

## Troubleshooting

### Build Fails
- Check Dockerfile syntax
- Verify all dependencies in package.json
- Ensure .dockerignore excludes node_modules

### Container Won't Start
- Verify PORT environment variable is set to 3000
- Check that all required environment variables are configured
- Review Cloud Run logs for startup errors

### Database Connection Issues
- Verify DATABASE_URL format
- Check database firewall settings
- Ensure database accepts connections from Cloud Run IPs

### Health Check Fails
- Verify application starts on correct port
- Check /health endpoint responds
- Review application logs for errors

## Security Considerations

- All environment variables should use production values
- Enable HTTPS (Cloud Run does this automatically)
- Set secure session cookies in production
- Use strong SESSION_SECRET value
- Restrict database access to Cloud Run IPs only

## Scaling Configuration

Cloud Run will automatically scale based on traffic:
- Minimum instances: 1
- Maximum instances: 10
- CPU utilization target: 60%
- Memory: 2GB per instance
- CPU: 1 vCPU per instance