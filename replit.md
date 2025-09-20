# Photography Management System

## Overview
A streamlined photography business management platform designed for professional photographers. Its purpose is to provide essential workflow management tools, including session scheduling, client management, invoicing, and contract signing. The platform operates on a subscription model, offering a Professional plan with 100GB storage, and additional 1TB storage add-ons backed up to Cloudflare R2. The business vision is to empower photographers with tools to efficiently manage their operations, enhancing productivity and client satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.
Website Builder Interface: CapCut-style with full-screen preview and bottom toolbar with horizontal scrolling tools.

## System Architecture

### Frontend Architecture
The system utilizes a static HTML/CSS/JavaScript multi-page application with vanilla JavaScript, employing a responsive, mobile-first design using CSS Grid and Flexbox. It incorporates PWA capabilities via a service worker for offline functionality and a component-based UI with tabbed navigation. The CapCut-style Website Builder features full-screen preview, drag-and-drop functionality, editable components (formatting, alignment, fonts, colors, spacing), and includes 21 professional fonts categorized into Serif, Sans-Serif, Display, and Script. The bottom toolbar is resizable with saved preferences.

### Backend Architecture
The backend is built on a Node.js/Express server handling API routes and business logic. Authentication and subscription verification are handled exclusively at the server level through secure routes.

### Authentication & Authorization
Firebase Authentication (Project: photoshcheduleapp) supports email/password and Google OAuth, implementing role-based access for administrative functions and subscriber management. All session management routes require proper Firebase authentication with no development mode exceptions. 

**Known Mobile Limitation**: Google OAuth does not work on mobile browsers in Replit's development environment due to Firebase/Replit security restrictions. Mobile users must use email/password authentication during development. This is automatically resolved in production deployment with proper domain configuration.

**Firebase Project Configuration:**
- Project ID: `photoshcheduleapp`
- Auth Domain: `photoshcheduleapp.firebaseapp.com`
- Storage Bucket: `photoshcheduleapp.appspot.com`
- App ID: `1:1080892259604:web:8198de9d7da81c684c1601`
- Messaging Sender ID: `1080892259604`

### Database Architecture
The primary database is PostgreSQL, utilizing Drizzle ORM. Firebase Firestore is used for real-time data synchronization, creating a hybrid storage strategy. Published websites data, metadata, and themes are stored in PostgreSQL.

### File Storage Strategy
Cloudflare R2 serves as the primary cloud storage with session-aware file paths and RAW file backup. Firebase Storage is used as secondary storage for website assets and profile images. The system supports full-resolution downloads, on-the-fly thumbnail generation with smart caching, and preserves original filenames.

### Mobile & Responsive Features
**Strategic Decision (August 2025): Web-App Only Approach**
Transitioned from native mobile app development to a web-app only strategy for simplified maintenance and faster development cycles. The platform now focuses entirely on delivering an exceptional mobile-responsive web experience that works seamlessly across all devices and browsers.

**Mobile Website Builder Enhancements (August 2025):**
- Added comprehensive touch event support for toolbar resizing
- Enhanced mobile responsiveness with larger touch targets (20px vs 10px)
- Fixed component drag functionality for mobile devices with touchstart/touchmove/touchend events
- Improved visual feedback for touch interactions with active states
- Added mobile-specific CSS optimizations for better usability

**Benefits of Web-App Only:**
- Single codebase for all platforms (web, mobile, tablet)
- Instant deployment of updates without app store approval processes
- No app store fees or complex mobile build processes
- Progressive Web App (PWA) capabilities for app-like experience
- Superior visual control and immediate feedback for UI adjustments
- Streamlined authentication flow without mobile-specific complexities
- Camera access and file uploads work natively in modern mobile browsers
- Users can install web app to home screen for native app feel

### Photography Delivery System
A comprehensive download-based delivery system with flexible pricing models (free, paid, freemium), customizable watermarking, and Stripe Connect integration for payment processing. Features include:
- Download policies configurable per session (enable/disable, pricing model, limits)
- Watermark system supporting text and logo overlays with positioning and opacity controls
- Download tracking with enforcement of quotas and maximum limits
- Direct gallery links via secure gallery_access_tokens (industry standard approach)
- Proper HTTP status codes (403/429) for limit enforcement
- Downloadable originals with optional watermarking based on pricing model

**Known Limitations**: 
- Concurrent download requests may occasionally bypass limits due to non-atomic token redemption (will be addressed in future update with transactional guarantees)
- Download type tracking (free vs paid) requires further refinement for complex freemium scenarios

### Photography Community Platform
A social platform featuring a multi-tab feed system with customizable post types, advanced image optimization, social features (like, comment, save, share), user profiles with reputation points, community tools, a comprehensive direct messaging system, and automatic EXIF extraction. User interactions are enhanced with full username display, clickable user profiles, and complete user-to-user messaging infrastructure.

### Watermark System
A professional watermarking feature allows photographers to add customizable text watermarks to their images automatically, with adjustable positioning, opacity, font size, and color selection, applied during image processing.

### Golden Hour Times Calculator
A professional photography planning tool that calculates optimal lighting times for any location and date, featuring location search, current location detection, accurate calculations, responsive design, and photography tips.

### Core Features & System Design
The system supports chronological session sorting, an integrated deposit system, a comprehensive storage quota and billing system with real-time tracking, and a robust unified file deletion system. It includes prebuilt customizable pages (Portfolio, About, Contact) and advanced subpage functionality for nested structures. A full booking agreement system with e-signature capabilities and Stripe Connect Express for multi-photographer payment routing are integrated.

### AI-Powered Blog Generator
Integrated OpenAI-powered blog post generation directly into the website builder, featuring customizable blog creation with topic, style, tone, and length options, SEO keyword optimization, automatic metadata generation, and blog idea suggestions.

### Website Publishing System
Allows photographers to publish their created websites to subdomains (photographer.photomanagementsystem.com) with real-time availability checking, one-click publishing, a cost-efficient architecture, published websites database, live preview, and update capability. This is a professional plan feature.

### Onboarding System
A 5-step wizard guides new users through setup, including username selection, business information, photography specialty, and subscription integration.

### Unified Subscription Management System
A comprehensive system supporting multiple platforms and billing models, including a Professional Plan and storage add-ons. It integrates Stripe for web payments, handles webhooks for payment events, and provides multi-platform customer tracking and automatic storage quota management.

### Subscription Cancellation & Access Control
Provides complete cancellation functionality with platform-specific handling and enforces subscription requirements through subscription-aware authentication middleware, frontend guards, automatic redirection to checkout, and grace period access.

### Production Deployment Infrastructure
Includes production-ready configuration with security hardening (Helmet.js, CORS, rate limiting, secure session management), comprehensive health monitoring, structured JSON logging, database optimization (SSL, connection pooling, retry logic), performance enhancements (gzip, caching, memory management), and robust error handling.

### Platform Analytics & Business Intelligence
A comprehensive analytics dashboard for monitoring SaaS platform performance, covering revenue analytics, user engagement, platform health, support analytics, and business metrics.

### Data Export & GDPR Compliance System
Enterprise-grade data portability and privacy compliance with complete data export in multiple formats, GDPR Article 20 compliance for data portability, Right to be Forgotten functionality, export management, and audit logging.

### Automated Backup & Disaster Recovery
A production-grade backup system with automated daily database backups, weekly full system backups, integrity checking, encrypted cloud storage in Cloudflare R2, point-in-time recovery, and monitoring.

### Advanced User Management System
Comprehensive photographer account management for platform administrators, offering a dashboard with filtering, search, bulk operations, account controls (suspend, reactivate, plan modifications, billing management), usage analytics, and export tools.

### Enterprise Support System
Professional-grade client support infrastructure with automatic issue resolution, multi-channel support, a help center, ticket management, support analytics, and client communication.

## Contact Form Configuration

The home page features a contact form that forwards submissions to the administrator's email. To configure the recipient email:

1. Set the `CONTACT_FORM_EMAIL` environment variable to your email address
2. Alternatively, it will use the `SENDGRID_FROM_EMAIL` if configured
3. As a fallback, it sends to `admin@photomanagementsystem.com`

The contact form uses the existing SendGrid integration to send formatted emails containing:
- Contact name and email
- Phone number (if provided)
- Interest area (Demo, Pricing, Features, Support, Other)
- Full message text

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore, Storage, Hosting, Functions.
- **PostgreSQL**: Primary relational database (via Neon serverless).
- **Stripe**: Payment processing, subscription management, Stripe Connect.
- **SendGrid**: Email delivery service.
- **Cloudflare R2**: Primary cloud storage.
- **WHCC**: Print fulfillment service (Customer #443225) - provides complete product catalog including albums, books, metal prints, canvas prints, and cards.

### Development & Deployment
- **Drizzle ORM**: Type-safe database operations.
- **Express.js**: Web application framework.
- **Multer**: File upload handling.
- **Archiver**: ZIP file generation.
- **Sharp**: Image processing for thumbnail generation.
- **AWS SDK**: S3-compatible interface for R2 storage operations.

### Frontend Libraries
- **JSZip**: Client-side ZIP file creation.
- **Uppy**: Advanced file upload interface.
- **Google Fonts**: Typography system.



### APIs
- **Google Distance Matrix API**: For mileage tracking.
- **OpenWeatherMap Geocoding API**: For location-based services.
- **Sunrise-Sunset API**: For astronomical calculations.