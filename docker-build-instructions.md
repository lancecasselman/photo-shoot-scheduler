# Docker Build Instructions

## Building the Photography Management System

Since Docker isn't available in Replit, you'll need to build the container in a Docker-enabled environment.

### Prerequisites
- Docker installed on your local machine or CI/CD system
- Access to Google Cloud Registry (or your preferred container registry)

### Build Commands

```bash
# Build the Docker image
docker build -t photo-management-system .

# Tag for Google Cloud Registry
docker tag photo-management-system us-central1-docker.pkg.dev/YOUR_PROJECT/photo-management-system/photo-management-system:latest

# Push to registry (requires authentication)
docker push us-central1-docker.pkg.dev/YOUR_PROJECT/photo-management-system/photo-management-system:latest
```

### For your specific build:
```bash
docker build -t "us-central1-docker.pkg.dev/***/photo-management-system/photo-management-system:b9299f275ad1c298b843ef048865fb25a315292d" ./
```

### Environment Variables Required
Make sure these are set in your deployment environment:
```env
DATABASE_URL=postgresql://user:password@host:port/database
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name
STRIPE_SECRET_KEY=sk_test_or_live_key
SENDGRID_API_KEY=SG.your_api_key
NODE_ENV=production
PORT=5000
```

### Health Check
The container includes a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2025-01-09T17:30:00.000Z",
  "version": "1.0.0"
}
```

### Development with Docker Compose
For local development:
```bash
docker-compose up -d
```

This will start:
- Photography Management app on port 5000
- PostgreSQL database on port 5432

### Production Deployment
The Dockerfile is optimized for production with:
- Multi-stage build (if needed)
- Non-root user execution
- Health checks
- Proper caching layers
- Security best practices

### Troubleshooting
1. **Build fails**: Check that all required files are present and .dockerignore is configured
2. **Container won't start**: Verify environment variables are set correctly
3. **Health check fails**: Ensure port 5000 is accessible and /health endpoint responds
4. **Database connection issues**: Verify DATABASE_URL format and network connectivity