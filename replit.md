# Photography Management System

## Overview
A streamlined photography business management platform for professional photographers, offering workflow management tools such as session scheduling, client management, invoicing, and contract signing. The platform operates on a subscription model with a Professional plan including 100GB storage and additional 1TB storage add-ons. The vision is to enhance photographer productivity and client satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.
Website Builder Interface: CapCut-style with full-screen preview and bottom toolbar with horizontal scrolling tools.

## System Architecture

### Frontend Architecture
A static HTML/CSS/JavaScript multi-page application with vanilla JavaScript, utilizing a responsive, mobile-first design and PWA capabilities. It features a component-based UI with tabbed navigation. The CapCut-style Website Builder includes full-screen preview, drag-and-drop functionality, editable components, and 21 professional fonts, focusing on a web-app only strategy.

**UI Color Scheme (October 2025):**
Standardized teal/green theme for consistent button visibility and brand identity:
- Primary accent: #10b981 (teal) with white text for all primary action buttons
- Danger actions: #dc2626 (red) with white text for destructive operations
- Session action buttons (Booking Agreement, Create Agreement, Send Deposit) unified with teal theme for visual consistency
- Removed all white-on-white and low-contrast button states for accessibility compliance
- Download Controls button removed from session cards (October 2025)

### Backend Architecture
Built on a Node.js/Express server for API routes and business logic. Authentication and subscription verification are handled server-side.

### Authentication & Authorization
Firebase Authentication supports email/password and Google OAuth with role-based access. Server-side session management incorporates critical safety checks to prevent crashes and dynamic CORS configuration for secure session cookie handling in production. Session consolidation unifies user accounts, particularly for administrators, ensuring consistent access across platforms.

**Critical Authentication Bug Fixes (October 2025):**
Fixed fundamental authentication flow issues causing 401 errors and preventing user access:

1. **Wrong Login Endpoint:** All login flows (secure-login.html, secure-app.html, native-auth.js) were calling `/auth/session` but backend expected `/api/auth/login`
   - Fixed: Updated all Firebase auth handlers to POST to `/api/auth/login` with credentials: 'include'

2. **Premature Session Loading:** DOMContentLoaded handler in script.js (line 1861) was calling `loadSessions()` before authentication completed
   - Fixed: Removed unconditional loadSessions() call, now only called after successful authentication in initializePage()

3. **Duplicate Auth Logic:** secure-app.html had its own DOMContentLoaded auth check that raced with script.js's initializePage()
   - Fixed: Removed duplicate auth system, unified all auth through initializePage() on window.load event

4. **Missing Login Redirect:** When authentication failed, users saw blank page instead of login screen
   - Fixed: Added `window.location.href = '/secure-login.html'` redirect when checkAuth() fails (script.js line 3884)

5. **Session Persistence Issues:** Iframe environment blocking session cookies
   - Verified: Session middleware configured with `secure: true`, `sameSite: 'none'`, dynamic CORS origin callback
   - Verified: All fetch calls include `credentials: 'include'`

**Authentication Flow (Corrected):**
1. User accesses /secure-app.html
2. window.load event fires → initializePage() runs
3. checkAuth() verifies session with /api/auth/user
4. If not authenticated → redirect to /secure-login.html
5. User logs in with Google → Firebase token sent to /api/auth/login
6. Backend creates session with normalized user data (all Lance emails → uid 44735007)
7. User redirected to /secure-app.html
8. checkAuth() succeeds → loadSessions() loads all sessions

**Admin Access:** requireActiveSubscription middleware has built-in bypass for admin emails (line 169-179 in subscription-auth-middleware.js)

### Database Architecture
Primary database is PostgreSQL via Drizzle ORM, complemented by Firebase Firestore for real-time synchronization.

### File Storage Strategy
Cloudflare R2 is the primary cloud storage, using human-readable file organization and supporting dual-path for backward compatibility. Firebase Storage is used for website assets and profile images. The system supports full-resolution downloads and on-the-fly thumbnail generation.

**R2 Download Path Fix (October 2025):**
Fixed critical issue where photo downloads failed due to R2 path mismatch:
- **Problem**: Download system was regenerating R2 paths instead of using stored `r2_key` from database, causing "specified key does not exist" errors
- **Root Cause**: Files stored at human-readable paths like `photographer-lance_casselman/session-lance/gallery/` were being looked up at incorrect regenerated paths like `photographer-44735007/session-{uuid}/gallery/`
- **Solution**: 
  - Updated thumbnail endpoint (server.js line 4736) to use `downloadFileBuffer(r2_key)` directly from session_files table
  - Fixed download endpoint for re-downloads (server.js line 9196-9222) to query r2_key from session_files instead of reconstructing paths
  - Fixed download endpoint for free downloads (server.js line 9281-9300) to query r2_key from session_files instead of reconstructing paths
- **Fallback**: R2FileManager.downloadFile() includes database-lookup fallback for files with stored r2_keys
- **Result**: Gallery downloads now working correctly for files with proper R2 keys (verified with 28-38MB photo downloads)
- **Payment Logic**: All payment checks preserved - re-downloads are free, first-time downloads check free limit, paid downloads redirect to Stripe

**R2 Key Field Name Fix (October 2025):**
Fixed field name mismatch between backend and frontend for R2 presigned URL responses:
- **Problem**: R2FileManager returned `key` field but frontend expected `r2Key`, causing NULL r2_keys for newly uploaded photos
- **Root Cause**: Frontend (gallery-manager.html) expected `r2Key` property when recording uploads to session_files table
- **Solution**: Changed server/r2-file-manager.js line 1911 from `key: result.key` to `r2Key: result.key`
- **Backfill**: Updated 3 existing photos (DSC_2342.jpg, DSC_2308.jpg, DSC_2310.jpg) with correct R2 paths
- **Result**: All new uploads now store correct r2_keys, thumbnails load successfully

**Photo Deletion System Fix (October 2025):**
Fixed critical bug causing photo deletions to fail and rollback:
- **Problem**: Photo deletion failed with error "column 'filename' does not exist" during download cleanup
- **Root Cause**: download_history table only has photo_id column, but deletion query tried to use both photo_id and filename
- **Solution**: Updated server/unified-file-deletion.js line 174-177 to use only photo_id in WHERE clause
- **Impact**: Deletion transactions now complete successfully without rollback
- **Schema Verified**: download_history only contains: id, session_id, client_key, photo_id, token_id, order_id, ip_address, user_agent, status, failure_reason, created_at

### Photography Delivery System
**Simplified Download System (October 2025):**
A clean, per-session download pricing model where photographers set:
- **Free Download Limit**: Number of free downloads per session (e.g., 5 free photos)
- **Price Per Photo**: Cost for downloads after free limit (e.g., $3 per photo)

Implementation:
- Client gallery (client-gallery.html) rebuilt from 4,894 to 763 lines (84% reduction)
- Removed all complex cart/policy/credit systems
- Simple localStorage-based download tracking per session+client
- Downloads tracked in galleryDownloads table with digital_transactions for paid downloads
- Stripe Connect integration via /api/gallery/:sessionId/download endpoint
- Client gallery shows ONE clear download counter with remaining free downloads
- Dynamic download buttons: "Download Free" / "Download - $X" / "Re-download Free"
- Re-downloads are always free once a photo is downloaded
- Customizable watermarking support retained

### Photography Community Platform
A social platform with a multi-tab feed system, customizable post types, advanced image optimization, social features, user profiles with reputation points, direct messaging, and EXIF extraction.

### Core Features & System Design
Includes chronological session sorting, an integrated deposit system, storage quota and billing, unified file deletion, customizable pages, booking agreements with e-signatures, and Stripe Connect Express for multi-photographer payments.

### AI-Powered Blog Generator
Integrates OpenAI for customizable blog post generation within the website builder, offering topic, style, tone, length options, SEO keyword optimization, and automatic metadata generation.

### Website Publishing System
Allows photographers to publish websites to subdomains with real-time availability checks, one-click publishing, and live preview capabilities, available for professional plans.

### Onboarding System
A 5-step wizard for new users covering username selection, business information, photography specialty, and subscription integration.

### Unified Subscription Management System
Manages multiple platforms and billing models (Professional Plan, storage add-ons) using Stripe for web payments, webhooks, multi-platform customer tracking, and automatic storage quota management.

### Subscription Cancellation & Access Control
Provides full cancellation functionality and enforces subscription requirements through authentication middleware, frontend guards, and automatic redirection.

### Production Deployment Infrastructure
Features production-ready configuration with security hardening, health monitoring, structured logging, database optimization, and robust error handling. Deployed on a Reserved VM for 24/7 reliability and consistent background job execution.

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
