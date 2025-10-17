# Photography Management System

## Overview
A platform for professional photographers, offering tools for workflow management, including session scheduling, client management, invoicing, and contract signing. It operates on a subscription model, aiming to boost photographer productivity and client satisfaction. The platform includes a CapCut-style website builder, a photography delivery system with flexible download pricing, and an AI-powered blog generator.

## User Preferences
Preferred communication style: Simple, everyday language.
Website Builder Interface: CapCut-style with full-screen preview and bottom toolbar with horizontal scrolling tools.

## Recent Changes

### Community Photo Expiration Removed (Oct 17, 2025)
**Problem:** Community photos were expiring after 7 days, causing images to become inaccessible even though the files remained in storage. Users saw "expired" photos in the community feed.

**Root Cause:** The `CommunityImageProcessor.uploadToR2()` function was generating presigned R2 URLs with a 7-day expiration (604800 seconds) instead of permanent public URLs.

**Solution:** Changed community photo storage to use permanent public URLs:
- Removed presigned URL generation with expiration
- Now returns permanent public R2 URLs: `${publicUrl}/${key}`
- Community photos are publicly accessible and never expire

**Impact:**
- All new community photos have permanent URLs
- Old photos with expired URLs would need to be re-uploaded (cannot regenerate expired URLs)
- Photos remain visible forever regardless of post age

**Location:** `community/community-image-processor.js` (uploadToR2 function)

### Session Creation Form Cleanup (Oct 17, 2025)
**Change:** Removed download control fields from session creation form to simplify the initial session setup.

**Fields Removed:**
- Free Download Limit input
- Price Per Photo input

**Rationale:** Download pricing settings are better configured in the gallery manager after photos are uploaded, not during initial session creation. This keeps the session form focused on essential booking details (client, date, location, price, etc.).

**Location:** Download settings remain fully functional in the gallery manager (`public/gallery-manager.html`) where photographers can set them when preparing to share galleries.

### Automatic Gallery Token Generation (Oct 17, 2025)
**Problem:** When photographers tried to share a gallery link (via email, SMS, or copy), they received "gallery access token not found" error. The backend endpoint to create tokens existed but was never called from the UI.

**Solution:** Added automatic gallery token generation:
- Created `ensureGalleryToken()` helper function that checks for token and creates it if missing
- Updated all share functions (shareViaEmail, shareViaSMS, copyGalleryLink) to auto-generate tokens
- Gallery links now display immediately after token is created
- Seamless UX - photographers never see the error, token is created automatically when needed

**Technical Details:**
- Calls `/api/sessions/:sessionId/create-gallery` API endpoint
- Caches token in sessionData for reuse
- Updates UI to show gallery link after generation

### Gallery Share Auto-Population Fix (Oct 17, 2025)
**Problem:** The "Share Gallery with Client" section in gallery manager showed placeholder values (client@example.com, (555) 123-4567) instead of auto-populating with the session's actual contact information.

**Root Cause:** The loadSession() function was using incorrect field names:
- Looking for: `session.clientEmail` and `session.clientPhone`
- Actual fields: `session.email` and `session.phoneNumber`/`session.phone_number`

**Solution:** Updated `public/gallery-manager.html` to correctly map session data:
- Changed to use `session.email` for email field
- Changed to use `session.phoneNumber || session.phone_number` for phone field (handles both camelCase and snake_case)
- Photographer can now share galleries immediately without manual data entry

### Storage Manager Dashboard (Oct 17, 2025)
**Feature:** Created comprehensive storage dashboard (`public/storage-dashboard.html`) that was previously missing from the navigation menu.

**Implementation:**
- Real-time storage visualization with color-coded progress bars (green < 75%, yellow < 90%, red >= 90%)
- Usage breakdown by file type (gallery photos vs raw files)
- Storage plan display (100GB base + add-on packages at $25/TB/month)
- Purchase interface for 1-5TB storage packages
- Active subscription management with cancellation
- Admin unlimited storage handling
- Responsive mobile-friendly design
- Protected by authentication middleware

### Session Deletion Foreign Key Constraint Fix (Oct 17, 2025)
**Problem:** Session deletion failed with FK constraint error: "update or delete on table \"photography_sessions\" violates foreign key constraint \"gallery_downloads_session_id_fkey\" on table \"gallery_downloads\"". The system had TWO deletion endpoints, and the simple one wasn't cleaning up gallery_downloads.

**Solution:** Fixed BOTH session deletion endpoints:
1. **Simple DELETE** (line 2673-2680): Delete gallery_downloads FIRST before session_files and session
2. **Comprehensive DELETE** (lines 6530-6646): Applied SAVEPOINT pattern with gallery_downloads deletion first
3. **Result:** Session deletion works correctly from both endpoints without FK constraint violations

### Thumbnail Deletion Optimization (Oct 17, 2025)
**Optimization:** Reduced thumbnail deletion from 36 to 9 API calls per photo (75% reduction, 4x faster) by targeting only 3 specific path patterns instead of brute-force checking all 36 variations. Uses deleteFileByKey() with correct R2 key parameter instead of deleteFile().

## System Architecture

### Frontend
A static HTML/CSS/JavaScript multi-page application using vanilla JavaScript, with a responsive, mobile-first design and PWA capabilities. It features a component-based UI with tabbed navigation and a CapCut-style Website Builder offering drag-and-drop functionality and editable components. The UI uses a standardized teal/green theme (#10b981) for primary actions and red (#dc2626) for danger actions, ensuring accessibility and consistent branding.

### Backend
Built on a Node.js/Express server for API routes and business logic. Server-side authentication and subscription verification are handled, with dynamic CORS configuration for secure session management.

### Authentication & Authorization
Firebase Authentication supports email/password and Google OAuth, providing role-based access. The system includes robust server-side session management and critical fixes for authentication flows, ensuring secure user access and session persistence. Admin access bypasses subscription requirements.

### Database
PostgreSQL is the primary database, managed via Drizzle ORM, complemented by Firebase Firestore for real-time synchronization.

### File Storage
Cloudflare R2 is the primary cloud storage, utilizing human-readable file organization and supporting dual-path compatibility. Firebase Storage is used for website assets and profile images. The system supports full-resolution downloads, on-the-fly thumbnail generation, and optimized file deletion processes for R2.

### Photography Delivery System
A simplified per-session download pricing model allows photographers to set free download limits and per-photo costs. It features a streamlined client gallery with localStorage-based download tracking, integration with Stripe Connect, and customizable watermarking.

### Photography Community Platform
A social platform offering a multi-tab feed, customizable post types, advanced image optimization, social features, user profiles with reputation points, direct messaging, and EXIF extraction.

### Core Features & System Design
Includes chronological session sorting, an integrated deposit system, storage quota and billing, unified file deletion, customizable pages, booking agreements with e-signatures, and Stripe Connect Express for multi-photographer payments.

### AI-Powered Blog Generator
Integrates OpenAI for customizable blog post generation within the website builder, offering options for topic, style, tone, length, SEO keyword optimization, and automatic metadata generation.

### Website Publishing System
Enables photographers to publish websites to subdomains with real-time availability checks, one-click publishing, and live preview.

### Onboarding System
A 5-step wizard for new users covering username selection, business information, photography specialty, and subscription integration.

### Unified Subscription Management System
Manages multiple platforms and billing models (Professional Plan, storage add-ons) using Stripe for web payments, webhooks, multi-platform customer tracking, and automatic storage quota management. It also includes comprehensive cancellation functionality and access control enforcement.

### Production Deployment Infrastructure
Features production-ready configuration with security hardening, health monitoring, structured logging, database optimization, and robust error handling, deployed on a Reserved VM.

### Platform Analytics & Business Intelligence
A dashboard for monitoring SaaS performance, including revenue, user engagement, platform health, support, and business metrics.

### Data Export & GDPR Compliance System
Provides enterprise-grade data portability and privacy compliance with data export options, GDPR Article 20 compliance, Right to be Forgotten functionality, and audit logging.

### Automated Backup & Disaster Recovery
A production-grade backup system with automated daily database backups, weekly full system backups, integrity checking, encrypted cloud storage in Cloudflare R2, and point-in-time recovery.

### Advanced User Management System
A comprehensive dashboard for platform administrators to manage photographer accounts, offering filtering, search, bulk operations, account controls, usage analytics, and export tools.

### Enterprise Support System
Professional-grade client support infrastructure with automatic issue resolution, multi-channel support, a help center, ticket management, support analytics, and client communication.

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore, Storage, Hosting.
- **PostgreSQL**: Primary relational database (via Neon serverless).
- **Stripe**: Payment processing, subscription management, Stripe Connect.
- **SendGrid**: Email delivery service.
- **Cloudflare R2**: Primary cloud storage.
- **WHCC**: Print fulfillment service.
- **OpenAI**: AI-powered blog generation.

### Development & Deployment
- **Drizzle ORM**: Type-safe database operations.
- **Express.js**: Web application framework.
- **Multer**: File upload handling.
- **Archiver**: ZIP file generation.
- **Sharp**: Image processing.
- **AWS SDK**: S3-compatible interface for R2 storage.
- **JSZip**: Client-side ZIP file creation.
- **Uppy**: Advanced file upload interface.

### APIs
- **Google Distance Matrix API**: For mileage tracking.
- **OpenWeatherMap Geocoding API**: For location-based services.
- **Sunrise-Sunset API**: For astronomical calculations.