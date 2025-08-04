#!/bin/bash

# Google Cloud Deployment Setup Script
# Run this script in Google Cloud Shell or with gcloud CLI installed

echo "🚀 Setting up Google Cloud for Photography Management System Auto-Deploy"
echo "============================================================================"

# Set your project ID
PROJECT_ID="photoshcheduleapp"
SERVICE_ACCOUNT_NAME="github-actions-deploy"
SERVICE_ACCOUNT_EMAIL="${SERVICE_ACCOUNT_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
REGION="us-central1"
REPOSITORY_NAME="photo-management-system"

echo "Project ID: $PROJECT_ID"
echo "Service Account: $SERVICE_ACCOUNT_EMAIL"
echo "Region: $REGION"
echo ""

# Step 1: Set the project
echo "📋 Step 1: Setting active project..."
gcloud config set project $PROJECT_ID

# Step 2: Enable required APIs
echo "🔧 Step 2: Enabling required APIs..."
gcloud services enable run.googleapis.com
gcloud services enable artifactregistry.googleapis.com  
gcloud services enable cloudbuild.googleapis.com
gcloud services enable iam.googleapis.com

echo "✅ APIs enabled successfully!"

# Step 3: Create Artifact Registry repository
echo "📦 Step 3: Creating Artifact Registry repository..."
gcloud artifacts repositories create $REPOSITORY_NAME \
    --repository-format=docker \
    --location=$REGION \
    --description="Photography management system Docker images"

echo "✅ Artifact Registry repository created!"

# Step 4: Create service account
echo "👤 Step 4: Creating service account..."
gcloud iam service-accounts create $SERVICE_ACCOUNT_NAME \
    --display-name="GitHub Actions Deploy" \
    --description="Service account for automated deployments from GitHub Actions"

echo "✅ Service account created!"

# Step 5: Grant required roles
echo "🔐 Step 5: Granting required roles..."
gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/run.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/artifactregistry.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/iam.serviceAccountUser"

gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/storage.admin"

echo "✅ Roles granted successfully!"

# Step 6: Create and download JSON key
echo "🔑 Step 6: Creating service account JSON key..."
gcloud iam service-accounts keys create ./github-actions-key.json \
    --iam-account=$SERVICE_ACCOUNT_EMAIL

echo "✅ JSON key created: github-actions-key.json"

echo ""
echo "🎉 Google Cloud setup complete!"
echo ""
echo "📋 NEXT STEPS:"
echo "1. Copy the contents of 'github-actions-key.json' file"
echo "2. Go to GitHub repo: https://github.com/lancecasselman/photo-shoot-scheduler"
echo "3. Settings → Secrets and variables → Actions"
echo "4. Add these secrets:"
echo "   - GCP_PROJECT_ID: $PROJECT_ID"
echo "   - GCP_SA_KEY: (paste entire JSON content)"
echo ""
echo "⚡ After adding secrets, push to main branch to trigger auto-deployment!"

# Display the JSON key content for easy copying
echo ""
echo "📄 JSON Key Content (copy this for GCP_SA_KEY secret):"
echo "======================================================="
cat ./github-actions-key.json
echo ""
echo "======================================================="