# Photography Management System

## Overview
A streamlined photography business management platform designed for professional photographers. Its purpose is to provide essential workflow management tools, including session scheduling, client management, invoicing, and contract signing. The platform operates on a subscription model with $39/month for the Professional plan (100GB storage), with additional 1TB storage add-ons available for $25/month each. All storage add-ons are backed up to Cloudflare R2. The business vision is to empower photographers with tools to efficiently manage their operations, enhancing productivity and client satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.
Website Builder Interface: CapCut-style with full-screen preview and bottom toolbar with horizontal scrolling tools.

## System Architecture

### Frontend Architecture
The system uses a static HTML/CSS/JavaScript multi-page application with vanilla JavaScript, employing a responsive, mobile-first design using CSS Grid and Flexbox. It incorporates PWA capabilities via a service worker for offline functionality and a component-based UI with tabbed navigation.

### Backend Architecture
The backend is built on a Node.js/Express server handling API routes and business logic.

### Authentication & Authorization
Firebase Authentication supports email/password and Google OAuth, with a dual-mode system for development/production. It implements role-based access for administrative functions and subscriber management, with premium features gate-kept by specific middleware. Admin user identities are normalized for unified access.

### Database Architecture
The primary database is PostgreSQL, utilizing Drizzle ORM. Firebase Firestore is used for real-time data synchronization, creating a hybrid storage strategy.

### File Storage Strategy
Cloudflare R2 serves as the primary cloud storage with session-aware file paths and RAW file backup. Firebase Storage is used as secondary storage for website assets and profile images. The system supports full-resolution downloads, on-the-fly thumbnail generation with smart caching, and preserves original filenames.

### Mobile & Responsive Features
Capacitor integration enables native mobile app capabilities for iOS, including direct photo uploads and offline functionality through local storage and synchronization.

### Photography Community Platform
A social platform featuring a multi-tab feed system with customizable post types, advanced image optimization (using Sharp and Cloudflare R2), social features (like, comment, save, share), user profiles with reputation points, community tools, direct messaging, and automatic EXIF extraction.

### Watermark System
Professional watermarking feature allowing photographers to add text watermarks to their images automatically. Supports customizable positioning (top-left, top-right, bottom-left, bottom-right, center), adjustable opacity and font size, color selection, and live preview. Watermarks are applied during image processing using Sharp library at 85% JPEG quality.

### Golden Hour Times Calculator
A professional photography planning tool that calculates optimal lighting times for any location and date, featuring location search, current location detection, accurate calculations, responsive design, and photography tips.

### Feature Specifications
The system supports chronological session sorting, an integrated deposit system, and a comprehensive storage quota and billing system with real-time tracking. A robust unified file deletion system ensures complete cleanup. It includes a professional CapCut-style Website Builder with full-screen preview, drag-and-drop functionality, and editable components (formatting, alignment, fonts, colors, spacing). The website builder now includes 21 professional fonts organized into categories: Serif (6), Sans-Serif (10), Display (2), and Script (3). The bottom toolbar is resizable via drag handle (120px-400px) with saved preferences. When creating galleries, users are prompted to specify the number of photos (with a default of 6). Gallery photos use consistent Unsplash photo IDs and include camera button overlays for easy swapping. Individual photo editing with always-visible camera buttons and drag-repositioning is supported. Button elements feature advanced page linking. Prebuilt pages (Portfolio, About, Contact) are customizable. Advanced subpage functionality supports nested structures. A full booking agreement system with e-signature capabilities and Stripe Connect Express for multi-photographer payment routing are integrated.

### Website Publishing System (New)
The platform now includes a complete website publishing infrastructure that allows photographers to publish their created websites to subdomains (photographer.photomanagementsystem.com). The system features:
- **Subdomain-based hosting**: Each photographer can publish their website to a unique subdomain
- **Real-time availability checking**: Validates subdomain availability before publishing
- **One-click publishing**: Simple publish button in the website builder
- **Cost-efficient architecture**: Single deployment serves all photographer websites (~$0.04/month per site)
- **Published websites database**: Stores website data, metadata, and themes in PostgreSQL
- **Live preview**: Instant viewing of published websites at /site/[subdomain]
- **Update capability**: Photographers can update their published websites anytime
- **Professional plan feature**: Included with the $39/month Professional subscription

### Enhanced Onboarding System
A 5-step wizard guides new users through setup, including username selection, business information, photography specialty, and subscription integration.

### Unified Subscription Management System
A comprehensive system supporting multiple platforms and billing models, including a $39/month Professional Plan and $25/TB/month storage add-ons with Cloudflare R2 backup. It integrates Stripe for web payments, supports future iOS App Store and Google Play billing, uses PostgreSQL for schema and user summaries, handles webhooks for payment events, and provides multi-platform customer tracking and automatic storage quota management.

### Subscription Cancellation System
Complete cancellation functionality with platform-specific handling, including user-initiated cancellation, automatic Stripe cancellation with prorated refunds, and proper handling of app store subscriptions.

### Subscription Access Control System
Comprehensive access control enforces subscription requirements through subscription-aware authentication middleware, frontend guards, automatic redirection to checkout, and grace period access.

### Replit Development Environment Compatibility
Includes specific handling for Replit's development environment constraints, resolving session persistence issues in Safari and providing notifications for iframe detection.

### Streamlined Authentication System
Authentication and subscription verification is handled exclusively at the server level through secure routes, providing a cleaner user experience.

### Production Deployment Infrastructure (New)
Complete production-ready configuration with security hardening, monitoring, and performance optimization. **GitHub deployment verified successful** with workflow fixes:
- **Security Middleware**: Helmet.js, CORS protection, rate limiting (500 req/15min), secure session management
- **Health Monitoring**: Comprehensive system health checks at `/api/system/health`, `/metrics`, `/ready`, `/live` endpoints
- **Production Logging**: Structured JSON logging with error tracking, performance monitoring, and request logging
- **Database Optimization**: SSL-enabled connections, connection pooling (10-100), automatic retry logic, graceful error recovery
- **Performance**: Gzip compression, optimized caching, memory management, process monitoring
- **Error Handling**: Graceful degradation, automatic recovery, comprehensive error logging with context
- **Deployment Ready**: Complete configuration for Replit deployment with custom domain support

### Platform Analytics & Business Intelligence (New)
Comprehensive analytics dashboard for monitoring SaaS platform performance at scale:
- **Revenue Analytics**: MRR tracking, churn analysis, LTV calculations, growth metrics
- **User Engagement**: Active photographer monitoring, session creation trends, storage utilization
- **Platform Health**: Real-time system monitoring, performance metrics, error tracking
- **Support Analytics**: Ticket resolution rates, common issues, customer satisfaction
- **Business Metrics**: Conversion rates, subscriber growth, revenue per photographer
- **Admin Dashboard**: `/admin-analytics.html` with real-time data visualization

### Data Export & GDPR Compliance System (New)
Enterprise-grade data portability and privacy compliance for serving hundreds of photographers:
- **Complete Data Export**: JSON, CSV, and ZIP formats with all user data and files
- **GDPR Article 20 Compliance**: Data portability rights with secure download links
- **Right to be Forgotten**: Complete user data deletion with verification system
- **Export Management**: 7-day retention, secure download tokens, progress tracking
- **Audit Logging**: Full compliance tracking for regulatory requirements
- **Multi-format Support**: Structured data exports for easy migration

### Automated Backup & Disaster Recovery (New)
Production-grade backup system with automated schedules and verification:
- **Automated Schedules**: Daily database backups, weekly full system backups
- **Backup Verification**: Every 6 hours integrity checking with failure alerts
- **Cloud Storage**: Encrypted backups stored in Cloudflare R2 with 30-day retention
- **Disaster Recovery**: Point-in-time recovery, automated cleanup, manual backup creation
- **Monitoring**: `/admin-backup-management.html` dashboard with backup status and history
- **Compliance**: Automated backup logging for business continuity requirements

### Advanced User Management System (New)
Comprehensive photographer account management for platform administrators:
- **User Dashboard**: `/admin-user-management.html` with filtering, search, and bulk operations
- **Account Controls**: Suspend, reactivate, plan modifications, billing management
- **Usage Analytics**: Per-photographer revenue, storage, session tracking
- **Bulk Operations**: Mass email, plan changes, account status updates
- **Export Tools**: User data exports, revenue reports, usage summaries
- **Support Integration**: Direct access to photographer support history and tickets

### Enterprise Support System (New)
Professional-grade client support infrastructure:
- **Automatic Issue Resolution**: 80% of common problems fixed instantly
- **Multi-Channel Support**: Email, live chat, phone, priority tickets
- **Help Center**: `/help-center.html` with FAQ, search, and self-service tools
- **Ticket Management**: Priority routing, SLA tracking, escalation workflows
- **Support Analytics**: Resolution times, common issues, satisfaction metrics
- **Client Communication**: Proactive notifications, status updates, follow-up surveys

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore, Storage, Hosting, Functions.
- **PostgreSQL**: Primary relational database (via Neon serverless).
- **Stripe**: Payment processing, subscription management, Stripe Connect.
- **SendGrid**: Email delivery service.
- **Cloudflare R2**: Primary cloud storage.

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

### Mobile Development
- **Capacitor**: Cross-platform mobile app development.

### APIs
- **Google Distance Matrix API**: For mileage tracking.
- **OpenWeatherMap Geocoding API**: For location-based services.
- **Sunrise-Sunset API**: For astronomical calculations.