# Manual Google Cloud Setup Steps

If you prefer to set up through the Google Cloud Console instead of using the script:

## 1. Enable APIs
Go to Google Cloud Console → APIs & Services → Library

Enable these APIs:
- **Cloud Run API**
- **Artifact Registry API** 
- **Cloud Build API**

## 2. Create Artifact Registry Repository
1. Go to **Artifact Registry** in Google Cloud Console
2. Click **Create Repository**
3. Settings:
   - Name: `photo-management-system`
   - Format: `Docker`
   - Location: `us-central1`
   - Description: `Photography management system Docker images`

## 3. Create Service Account
1. Go to **IAM & Admin** → **Service Accounts**
2. Click **Create Service Account**
3. Settings:
   - Name: `github-actions-deploy`
   - Description: `Service account for automated deployments from GitHub Actions`

## 4. Grant Roles to Service Account
Select the service account and add these roles:
- **Cloud Run Admin** (`roles/run.admin`)
- **Artifact Registry Admin** (`roles/artifactregistry.admin`)
- **Service Account User** (`roles/iam.serviceAccountUser`)
- **Storage Admin** (`roles/storage.admin`)

## 5. Create JSON Key
1. Click on the service account
2. Go to **Keys** tab
3. Click **Add Key** → **Create new key**
4. Choose **JSON** format
5. Download the JSON file

## 6. Add GitHub Secrets
1. Go to GitHub repository: `lancecasselman/photo-shoot-scheduler`
2. Settings → Secrets and variables → Actions
3. Add secrets:
   - `GCP_PROJECT_ID`: `photoshcheduleapp`
   - `GCP_SA_KEY`: Contents of the JSON file

## Testing the Setup
After completing all steps:
1. Make a small change to your code
2. Push to the main branch
3. Check GitHub Actions tab for deployment progress
4. Your app will be automatically deployed to Cloud Run

The deployment URL will be shown in the GitHub Actions logs once complete.