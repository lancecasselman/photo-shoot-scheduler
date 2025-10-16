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
- Session action buttons (Booking Agreement, Download Controls, Send Deposit) unified with teal theme for visual consistency
- Removed all white-on-white and low-contrast button states for accessibility compliance

### Backend Architecture
Built on a Node.js/Express server for API routes and business logic. Authentication and subscription verification are handled server-side.

### Authentication & Authorization
Firebase Authentication supports email/password and Google OAuth with role-based access. Server-side session management incorporates critical safety checks to prevent crashes and dynamic CORS configuration for secure session cookie handling in production. Session consolidation unifies user accounts, particularly for administrators, ensuring consistent access across platforms.

**Firebase Integration (October 2025):**
Unified Firebase configuration across all frontend and backend components:
- **Project:** photoshcheduleapp
- **Auth Domain:** photoshcheduleapp.firebaseapp.com
- **Backend:** Firebase Admin SDK with service account authentication
- **Frontend:** Firebase SDK v10.7.1 (modular) and v9.0.0 (compat)
- **Centralized Config:** `public/firebase-config.js` for consistency

**Critical Authentication Bug Fixes (October 2025):**
Fixed fundamental authentication flow issues causing 401 errors and preventing user access:

1. **Duplicate Script.js File:** Root-level `script.js` (outdated) was being served instead of `public/script.js`
   - Fixed: Removed duplicate, configured static file serving to prioritize `public/` directory
   - Fixed: Updated redirect code to properly send users to `/secure-login.html` when not authenticated

2. **Inconsistent Firebase Configs:** Some files used wrong Firebase project (photoappstorage)
   - Fixed: Updated all files to use correct project (photoshcheduleapp)
   - Fixed: Created centralized `firebase-config.js` for future consistency

3. **Missing Login Redirect:** When authentication failed, users saw blank page with 401 errors
   - Fixed: Added `window.location.href = '/secure-login.html'` redirect when checkAuth() fails
   - Fixed: Removed outdated script.js that had `return;` instead of redirect

4. **Session Persistence Issues:** Iframe environment blocking session cookies
   - Verified: Session middleware configured with `secure: true`, `sameSite: 'none'`, dynamic CORS origin callback
   - Verified: All fetch calls include `credentials: 'include'`

**Authentication Flow (Corrected):**
1. User accesses /secure-app.html
2. window.load event fires → initializePage() runs
3. checkAuth() verifies session with /api/auth/user
4. If not authenticated → redirect to /secure-login.html
5. User logs in with Google → Firebase token sent to /api/auth/login
6. Backend verifies token with Firebase Admin SDK
7. Backend creates session with normalized user data (all Lance emails → uid 44735007)
8. Backend stores session in PostgreSQL
9. User redirected to /secure-app.html
10. checkAuth() succeeds → loadSessions() loads all sessions ✅

**Browser Caching Fix (October 2025):**
Fixed critical production issue where published app showed old code due to browser caching:
- **Problem:** Static files had no cache-control headers, browsers cached old JavaScript for days
- **Impact:** Published app appeared broken while preview worked (both same server, different cache state)
- **Solution:** Added `Cache-Control: no-cache, no-store, must-revalidate, max-age=0` headers to all HTML/JS/CSS files
- **Result:** Browsers always fetch latest code, no more stale file issues
- **Implementation:** `setHeaders` callback in `express.static()` middleware (server.js lines 16964-16986)

**Admin Access:** requireActiveSubscription middleware has built-in bypass for admin emails

### Database Architecture
Primary database is PostgreSQL via Drizzle ORM, complemented by Firebase Firestore for real-time synchronization.

**Critical Database Connection Fixes (October 2025 - FINAL):**
Fixed database connection chaos causing "Control plane request failed" and "Too many connection attempts" errors by implementing **true shared pool architecture**:

1. **Hardcoded Database URLs Removed:**
   - `server.js` line 255: Was using hardcoded postgresql URL instead of `process.env.DATABASE_URL`
   - `server/db.ts` line 16: Was using same hardcoded URL instead of `process.env.DATABASE_URL`
   - Fixed: Both now use `process.env.DATABASE_URL` from Replit secrets with validation
   - Result: Session store and app now connect to SAME database

2. **Shared Pool Architecture Implemented:**
   - **ONE shared pool** in `server.js` with max: 3, min: 0 (respects Replit's ~5 connection limit)
   - **ALL services now REQUIRE pool parameter** (no fallback creation)
   - Removed duplicate pool creation from 10+ files:
     - `database-transaction-manager.js`: Removed singleton, requires pool
     - `enhanced-quota-manager.js`: Requires pool, no fallback
     - `quota-monitoring-system.js`: Requires pool, no fallback
     - `r2-api-routes.js`: Accepts pool parameter, removed creation
     - `download-commerce.js`: Requires pool, no fallback
     - `download-service.js`: Requires pool, no fallback
     - `download-routes.js`: Accepts pool parameter, removed creation
     - `enhanced-webhook-handler.js`: Requires pool, no fallback

3. **Critical Fixes:**
   - Removed `dbTransactionManager` singleton that was creating pool without parameter
   - Updated all service constructors to throw error if pool not provided
   - Updated all route factories to accept pool as first parameter
   - Set min: 0 on shared pool so idle services don't reserve connections

4. **DATABASE_URL Validation:**
   - Added startup check: `if (!process.env.DATABASE_URL)` throw error
   - Prevents silent failures from missing configuration

**Database Configuration:**
- Architecture: ONE shared pool, injected to all services
- Connection Pool: max: 3, min: 0 (no idle connection reservation)
- Environment: Uses `DATABASE_URL` from Replit secrets (validated at startup)
- SSL: Enabled in production with `rejectUnauthorized: false`
- Timeouts: Statement: 30s, Query: 25s, Idle-in-transaction: 20s
- Status: Server running successfully, no connection errors

**Remaining Pool Cleanup Tasks:**

**CRITICAL (Will break at runtime when methods are called):**
- `server/objectStorage.js` line 192: `deleteSessionFile()` imports pool from db.ts (will throw)
- `server/r2-file-manager.js`: Imports pool from db.ts (will throw when used)
- `server/paymentScheduler.js` line 87: FIXED - now uses `this.paymentManager.db`

**Non-Critical (Not actively used or properly close pools):**
The following files still create Pool instances but are not breaking the server because they either:
1. Create pools in methods that aren't actively called during startup, OR
2. Properly close pools after use (pool.end())

Files requiring refactoring to use shared pool:
- `server/gallery-print-routes.js`: Module-level pool creation
- `server/download-webhook-handler.js`: Module-level pool creation  
- `server/preview-generation.js`: Creates pool in constructor
- `server/preview-api-routes.js`: Module-level pool creation
- `server/sync-gallery-photos.js`: Creates pool in constructor
- `server/production-monitoring.js`: Has pool fallback in constructor
- `server/comprehensive-error-handler.js`: Has pool fallback in constructor
- `server/enhanced-cart-manager.js`: Has pool fallback in constructor
- `server/quota-system-validation.js`: Creates pool in constructor
- `server/controllers/download-orchestrator.js`: Has pool fallback
- `server/unified-file-deletion.js`: Creates pool in constructor
- `server/payment-notifications.js`: Creates pool in constructor
- `server/paymentPlans.js`: Lines 539 & 555 (methods create temporary pools)

Refactoring pattern for each file:
1. Update constructor to require pool parameter (no fallback)
2. Store as `this.pool` or create `this.db = drizzle(pool)`
3. Update server.js to pass shared pool when instantiating
4. Remove `const { Pool } = require('pg')` import if no longer needed

### File Storage Strategy
Cloudflare R2 is the primary cloud storage, using human-readable file organization and supporting dual-path for backward compatibility. Firebase Storage is used for website assets and profile images. The system supports full-resolution downloads and on-the-fly thumbnail generation.

### Photography Delivery System
A comprehensive download-based delivery system with flexible pricing (FREE, PAID, FREEMIUM), customizable watermarking, and Stripe Connect integration. It uses a streamlined credit-based system for downloads, with a clear path for clients to purchase unlimited access.

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
