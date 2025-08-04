# Automated GitHub Actions Deployment Setup

## Overview
Your photography management system now has automated deployment to Google Cloud Run via GitHub Actions. Every push to the `main` branch triggers a new deployment.

## Required GitHub Secrets

Add these secrets in your GitHub repository settings (Settings → Secrets and variables → Actions):

### 1. GCP_PROJECT_ID
Your Google Cloud Project ID (e.g., `photoshcheduleapp`)

### 2. GCP_SA_KEY
Service Account JSON key with the following permissions:
- Cloud Run Admin
- Artifact Registry Admin
- Service Account User

## Creating the Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Navigate to IAM & Admin → Service Accounts
3. Create New Service Account:
   - Name: `github-actions-deploy`
   - Description: `Service account for GitHub Actions deployments`

4. Grant these roles:
   - Cloud Run Admin
   - Artifact Registry Admin
   - Service Account User
   - Storage Admin (for Firebase Storage)

5. Create JSON key:
   - Click on the service account
   - Keys tab → Add Key → Create new key → JSON
   - Download the JSON file
   - Copy the entire JSON content as `GCP_SA_KEY` secret

## Setup Steps

### 1. Enable Required APIs
```bash
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com
gcloud services enable cloudbuild.googleapis.com
```

### 2. Create Artifact Registry Repository
```bash
gcloud artifacts repositories create photo-management-system \
    --repository-format=docker \
    --location=us-central1 \
    --description="Photography management system containers"
```

### 3. Add GitHub Secrets
- Repository Settings → Secrets and variables → Actions
- Add `GCP_PROJECT_ID` and `GCP_SA_KEY`

## Environment Variables

The deployment automatically handles these production environment variables:
- `NODE_ENV=production`
- All secrets from Replit are configured in Cloud Run service

## Deployment Process

1. **Trigger**: Push to main branch
2. **Build**: Docker container with Node.js app
3. **Push**: Container to Google Artifact Registry
4. **Deploy**: New revision to Cloud Run
5. **URL**: Deployment URL shown in Actions log

## Monitoring

- **GitHub Actions**: Monitor deployment status in repository Actions tab
- **Cloud Run**: View service status in Google Cloud Console
- **Logs**: View application logs in Cloud Run service

## Custom Domain (Optional)

To use your custom domain:
1. Cloud Run → Service → Manage Custom Domains
2. Add `photomanagementsystem.com`
3. Verify domain ownership
4. Update DNS records as instructed

## Rollback

If a deployment fails:
1. Cloud Run automatically keeps previous revision running
2. Manual rollback: Cloud Run → Revisions → Route traffic to previous revision
3. Or push a fix to main branch to trigger new deployment

Your photography platform is now production-ready with automated CI/CD!