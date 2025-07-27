# Firebase Cloud Functions Deployment Guide

## Overview
This guide explains how to deploy the advanced website builder with Firebase Cloud Functions for professional static site publishing.

## Prerequisites
1. Firebase CLI installed: `npm install -g firebase-tools`
2. Firebase project created at: https://console.firebase.google.com
3. Project ID: `photoshcheduleapp`

## Deployment Steps

### 1. Initialize Firebase Project
```bash
firebase login
firebase init
```

Select:
- Functions (Cloud Functions)
- Firestore (Database)
- Hosting (Static hosting)
- Storage (File storage)

### 1.5. Enhanced Frontend Integration
The system now includes enhanced Firebase publishing hooks:
- **firebase-publish.js**: Modern v9+ API integration with hybrid publishing
- **Hosting rewrites**: Automatic `/site/**` routing to Cloud Functions
- **CDN caching**: Optimized headers for static site performance
- **Analytics tracking**: Built-in Google Analytics integration

### 2. Configure Firebase Project
```bash
firebase use photoshcheduleapp
```

### 3. Install Function Dependencies
```bash
cd functions
npm install
cd ..
```

### 4. Deploy Security Rules
```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### 5. Deploy Cloud Functions
```bash
firebase deploy --only functions
```

### 6. Deploy Hosting (Optional)
```bash
firebase deploy --only hosting
```

## Cloud Functions Features

### generateStaticSite Function
- **URL**: `https://us-central1-photoshcheduleapp.cloudfunctions.net/generateStaticSite`
- **Purpose**: Generates professional static HTML from website builder blocks
- **Input**: `{ username, blocks, theme, brandColor, settings }`
- **Output**: `{ success, url, storageUrl, publishedAt }`

### serveStaticSite Function
- **URL**: `https://us-central1-photoshcheduleapp.cloudfunctions.net/serveStaticSite/site/{username}`
- **Purpose**: Serves published static sites from Firebase Storage
- **Features**: CDN caching, custom 404 pages, analytics tracking

## Firestore Database Structure

```
/users/{userId}/siteConfig/main
├── blocks: Array<Block>
├── username: string
├── brandColor: string
├── theme: string
├── settings: {
│   ├── seoTitle: string
│   ├── seoDescription: string
│   └── analytics: boolean
├── lastModified: timestamp
└── version: string

/published_sites/{username}
├── username: string
├── theme: string
├── brandColor: string
├── settings: object
├── publishedAt: timestamp
├── blockCount: number
└── version: string
```

## Firebase Storage Structure

```
/sites/{username}/
└── index.html (Generated static site)
```

## Security Rules

### Firestore Rules
- Users can only read/write their own site configurations
- Published sites metadata is publicly readable
- Site publishing requires authentication

### Storage Rules
- Published sites are publicly readable
- Site creation/updates require authentication
- Automatic cleanup of unused files

## Integration with Replit

The system uses a hybrid approach:
1. **Primary**: Firebase Cloud Functions (when available)
2. **Fallback**: Local Replit API (for development/backup)

## Benefits

1. **Scalability**: Firebase handles CDN, caching, and global distribution
2. **Security**: Proper authentication and authorization rules
3. **Performance**: Static sites served from Firebase CDN
4. **Reliability**: Automatic fallback to local publishing
5. **Analytics**: Built-in Firebase Analytics support
6. **SEO**: Professional meta tags and Open Graph support

## Testing

Test the enhanced integration:
```javascript
// Enhanced publisher test (recommended)
const testPublish = async () => {
  const result = await window.publishSite({
    username: 'test-user',
    blocks: [{ type: 'heading', content: 'Test Site' }],
    theme: 'classic',
    userEmail: 'test@example.com',
    settings: {
      analytics: true,
      seoTitle: 'Test Photography Site'
    }
  });
  console.log('Published via:', result.method);
  console.log('URL:', window.FirebasePublisher.getPublishingUrl(result));
};
testPublish();

// Or test directly with FirebasePublisher
const directTest = async () => {
  const result = await window.FirebasePublisher.hybridPublish({
    username: 'direct-test',
    blocks: [{ type: 'paragraph', content: 'Direct publishing test' }],
    theme: 'modern'
  });
  console.log('Direct publish result:', result);
};
directTest();
```

## Monitoring

View function logs:
```bash
firebase functions:log --only generateStaticSite
firebase functions:log --only serveStaticSite
```

## Costs

Firebase pricing (free tier):
- **Functions**: 2M invocations/month
- **Storage**: 1GB stored, 1GB downloads/day
- **Firestore**: 50K reads, 20K writes/day
- **Hosting**: 10GB storage, 360MB/day transfer

Perfect for small to medium photography businesses.