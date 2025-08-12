# Photography Management System

## Overview
A streamlined photography business management platform designed for professional photographers. Its purpose is to provide essential workflow management tools, including session scheduling, client management, invoicing, and contract signing. The platform operates on a freemium model, offering basic features for all users and premium features via subscription ($39/month Professional with 100GB storage included, additional storage at $25/month per TB). The business vision is to empower photographers with tools to efficiently manage their operations, enhancing productivity and client satisfaction. Features a commercial landing page with Stripe payment integration for subscription management.

## User Preferences
Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
The system uses a static HTML/CSS/JavaScript multi-page application approach with vanilla JavaScript for core functionality. It employs a responsive, mobile-first design using CSS Grid and Flexbox, and incorporates PWA capabilities via a service worker for offline functionality. The UI is component-based with a tabbed navigation system.

### Backend Architecture
The backend is built on a Node.js/Express server handling API routes and business logic.

### Authentication & Authorization
Firebase Authentication is the primary system, supporting email/password and Google OAuth. It features a dual-mode system for development/production and implements role-based access for administrative functions and subscriber management. Premium features are gate-kept with specific middleware.

### Database Architecture
The primary database is PostgreSQL, utilizing Drizzle ORM for type-safe operations. Firebase Firestore is used for real-time data synchronization, creating a hybrid storage strategy where session data resides in PostgreSQL and real-time features in Firestore.

### File Storage Strategy
Cloudflare R2 serves as the primary cloud storage with session-aware file paths, including a comprehensive RAW file backup system. Firebase Storage is used as secondary storage for website assets and profile images. The system supports full-resolution downloads and on-the-fly thumbnail generation using Sharp with smart caching. Original filenames are preserved, and unified storage tracking provides real-time statistics. Gallery and Raw Storage folders open in dedicated windows with comprehensive file management capabilities.

### Mobile & Responsive Features
Capacitor integration enables native mobile app capabilities for iOS deployment, including direct photo uploads from mobile devices. Core features support offline functionality through local storage and synchronization.

### Photography Community Platform
A comprehensive social platform for photographers to connect, learn, and grow together. Features include:
- **Feed System**: Multi-tab interface with customizable post types (photos, videos, help requests, tips, marketplace listings, before/after comparisons)
- **Image Processing**: Advanced image optimization with automatic thumbnail, feed, and full-resolution versions using Sharp library
- **Smart Storage**: Cloudflare R2 integration with automatic size optimization (200KB thumbnails, 2MB feed images, 10MB full versions)
- **Social Features**: Like, comment, save, and share functionality with real-time updates
- **User Profiles**: Reputation points, skill badges, portfolio links, mentor designation
- **Community Tools**: Weekly challenges, trending topics, top contributors leaderboard
- **Messaging System**: Direct messaging between photographers with read receipts
- **Camera Settings**: Automatic EXIF extraction and display for photography education
- **Database**: PostgreSQL-based with optimized indexes for performance
- **API**: RESTful endpoints at `/api/community` for all platform features

### Golden Hour Times Calculator
A professional photography planning tool that calculates optimal lighting times for any location and date. Features include location search, current location detection, accurate sunrise/sunset and golden/blue hour calculations, responsive design, and photography tips.

### Feature Specifications
The system supports chronological session sorting by appointment date (dateTime field), displaying sessions from oldest to newest appointment date rather than creation date. This ensures sessions appear in logical chronological order based on when they're scheduled to occur. A deposit system is fully integrated, tracking deposit amounts in the database, applying them to invoices, and displaying remaining balances. A professional contract management system generates three contract types per session (Photo Print Release, Service Agreement, Model Release) with automatic date insertion and integrates a signature system for client signatures, providing a professional viewing modal, print functionality, and PDF download options.

### Storage Quota and Billing System
A comprehensive storage quota and billing system provides freemium storage management with 5GB free storage and paid packages. The system includes real-time quota tracking, pre-upload validation, a visual storage dashboard with usage analytics, and automatic subscription management. The StorageQuotaManager service handles all quota calculations and billing operations with proper authentication middleware.

### Unified File Deletion System
A robust unified deletion system ensures complete file cleanup with no orphaned records. It includes database lookup for exact folder type detection, enhanced logging, comprehensive verification checks, and pattern matching to catch all database entries. The service coordinates between cloud storage and database cleanup, preventing phantom file records. Delete buttons on thumbnails provide instant file removal with confirmation dialogs, progress feedback, and automatic file list refresh. The system features fallback mechanisms and comprehensive error handling to ensure reliable file deletion across all interfaces.

## Recent Changes (August 12, 2025)
- **CRITICAL**: Session sorting by appointment date is COMPLETE and WORKING - do not modify
- **NEW**: Complete In-App Contract System v2.0 with device-based sharing
  - Seeds 5 editable templates (portrait, wedding, event, commercial, model release)
  - Auto-fills merge fields from session/client data
  - Device-based sharing (no server-side email/SMS) - uses mailto:, sms:, Web Share API
  - Supports in-browser e-signature with touch/mouse
  - Generates flattened PDF and uploads to Cloudflare R2
  - Tracks status (Draft, Sent, Viewed, Signed) with timeline
  - Frontend at /app/contracts.html and /app/sign.html (to be completed)
  - Backend routes at /api/contracts/* fully implemented
- **Removed**: Old contract system UI elements that were causing errors

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore database, Storage, Hosting, and Functions.
- **PostgreSQL**: Primary relational database via Neon serverless.
- **Stripe**: Payment processing and subscription management.
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