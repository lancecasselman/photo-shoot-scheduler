# Photography Management System

## Overview
A streamlined photography business management platform designed for professional photographers. Its purpose is to provide essential workflow management tools, including session scheduling, client management, invoicing, and contract signing. The platform operates on a subscription model, offering a Professional plan with 100GB storage, and additional 1TB storage add-ons backed up to Cloudflare R2. The business vision is to empower photographers with tools to efficiently manage their operations, enhancing productivity and client satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.
Website Builder Interface: CapCut-style with full-screen preview and bottom toolbar with horizontal scrolling tools.

## System Architecture

### Frontend Architecture
The system utilizes a static HTML/CSS/JavaScript multi-page application with vanilla JavaScript, employing a responsive, mobile-first design. It incorporates PWA capabilities via a service worker for offline functionality and a component-based UI with tabbed navigation. The CapCut-style Website Builder features full-screen preview, drag-and-drop functionality, editable components, and includes 21 professional fonts. The platform focuses on a web-app only strategy for all devices.

### Backend Architecture
The backend is built on a Node.js/Express server handling API routes and business logic. Authentication and subscription verification are handled exclusively at the server level.

### Authentication & Authorization
Firebase Authentication (Project: photoshcheduleapp) supports email/password and Google OAuth, implementing role-based access. All session management routes require proper Firebase authentication.

### Database Architecture
The primary database is PostgreSQL, utilizing Drizzle ORM. Firebase Firestore is used for real-time data synchronization, creating a hybrid storage strategy.

### File Storage Strategy
Cloudflare R2 serves as the primary cloud storage with human-readable file organization including photographer and session names for easier tracking in the R2 dashboard. The system uses dual-path support with automatic fallback to legacy UUID-based paths for backward compatibility. Firebase Storage is used as secondary storage for website assets and profile images. The system supports full-resolution downloads and on-the-fly thumbnail generation with performance-optimized caching and single-download operations.

### Photography Delivery System
A comprehensive download-based delivery system with flexible pricing models (FREE, PAID, FREEMIUM), customizable watermarking, and Stripe Connect integration for payment processing.

**Simple Credit System (October 2025):**
The system has been rebuilt with a streamlined credit-based approach for maximum reliability and simplicity:

**Database Schema:**
- `free_downloads_remaining` - Tracks remaining free download credits per session
- `unlimited_access` - Boolean flag indicating client has purchased unlimited access
- `unlimited_access_price` - Price for one-time unlimited access purchase (defaults to 20x per-photo price, min $10)
- `unlimited_access_purchased_at` - Timestamp of unlimited access purchase

**Download Flow:**
- Clients with `unlimited_access = true` can download all photos without limits
- Clients with `free_downloads_remaining > 0` can download photos, decrementing credits atomically with each download
- When credits exhausted, clients see "Unlock All Photos" button for one-time unlimited access purchase
- Simple API endpoints at `/api/downloads/simple/*` handle all credit checking and downloads

**Pricing Models:**
1. **FREE**: unlimited_access = true, free_downloads_remaining = null (all downloads free)
2. **PAID**: unlimited_access = false, free_downloads_remaining = 0 (purchase required immediately)
3. **FREEMIUM**: unlimited_access = false, free_downloads_remaining = X (photographer configured), unlock price auto-calculated

**Payment Integration:**
- Direct Stripe checkout for unlimited access purchase (no cart complexity)
- Webhook automatically sets `unlimited_access = true` on successful payment
- Clean success/cancel redirect flow back to gallery
- No reservation system, no expiring tokens - just simple credit tracking

### Photography Community Platform
A social platform featuring a multi-tab feed system with customizable post types, advanced image optimization, social features, user profiles with reputation points, community tools, a comprehensive direct messaging system, and automatic EXIF extraction.

### Core Features & System Design
The system supports chronological session sorting, an integrated deposit system, a comprehensive storage quota and billing system, and a robust unified file deletion system. It includes prebuilt customizable pages, advanced subpage functionality, a full booking agreement system with e-signature capabilities, and Stripe Connect Express for multi-photographer payment routing.

### AI-Powered Blog Generator
Integrated OpenAI-powered blog post generation into the website builder, featuring customizable blog creation with topic, style, tone, and length options, SEO keyword optimization, and automatic metadata generation.

### Website Publishing System
Allows photographers to publish their created websites to subdomains with real-time availability checking, one-click publishing, a cost-efficient architecture, published websites database, live preview, and update capability. This is a professional plan feature.

### Onboarding System
A 5-step wizard guides new users through setup, including username selection, business information, photography specialty, and subscription integration.

### Unified Subscription Management System
A comprehensive system supporting multiple platforms and billing models, including a Professional Plan and storage add-ons. It integrates Stripe for web payments, handles webhooks for payment events, and provides multi-platform customer tracking and automatic storage quota management.

### Subscription Cancellation & Access Control
Provides complete cancellation functionality with platform-specific handling and enforces subscription requirements through subscription-aware authentication middleware, frontend guards, automatic redirection to checkout, and grace period access.

### Production Deployment Infrastructure
Includes production-ready configuration with security hardening (Helmet.js, CORS, rate limiting, secure session management), comprehensive health monitoring, structured JSON logging, database optimization, performance enhancements, and robust error handling.

### Platform Analytics & Business Intelligence
A comprehensive analytics dashboard for monitoring SaaS platform performance, covering revenue analytics, user engagement, platform health, support analytics, and business metrics.

### Data Export & GDPR Compliance System
Enterprise-grade data portability and privacy compliance with complete data export in multiple formats, GDPR Article 20 compliance for data portability, Right to be Forgotten functionality, export management, and audit logging.

### Automated Backup & Disaster Recovery
A production-grade backup system with automated daily database backups, weekly full system backups, integrity checking, encrypted cloud storage in Cloudflare R2, point-in-time recovery, and monitoring.

### Advanced User Management System
Comprehensive photographer account management for platform administrators, offering a dashboard with filtering, search, bulk operations, account controls, usage analytics, and export tools.

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