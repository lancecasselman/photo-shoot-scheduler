# GitHub Secrets Setup Guide

## Adding Secrets to Your Repository

1. **Go to your GitHub repository:**
   https://github.com/lancecasselman/photo-shoot-scheduler

2. **Navigate to Settings:**
   Repository → Settings → Secrets and variables → Actions

3. **Add the following secrets:**

### Secret 1: GCP_PROJECT_ID
- **Name:** `GCP_PROJECT_ID`
- **Value:** `photoshcheduleapp`

### Secret 2: GCP_SA_KEY
- **Name:** `GCP_SA_KEY`  
- **Value:** The entire JSON content from the service account key file

## JSON Key Format
The GCP_SA_KEY should be the complete JSON object like this:
```json
{
  "type": "service_account",
  "project_id": "photoshcheduleapp",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n",
  "client_email": "github-actions-deploy@photoshcheduleapp.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "..."
}
```

## Verification
After adding both secrets:
1. Push any change to the main branch
2. Check the Actions tab in your GitHub repository
3. You should see the deployment workflow running
4. Once complete, you'll get a Cloud Run URL for your deployed app

## Security Notes
- Never commit the JSON key to your repository
- The secrets are encrypted and only accessible to GitHub Actions
- Each deployment creates a new container image with a unique tag
- Cloud Run automatically handles traffic routing and zero-downtime deployments