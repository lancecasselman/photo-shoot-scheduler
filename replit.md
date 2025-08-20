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

### Golden Hour Times Calculator
A professional photography planning tool that calculates optimal lighting times for any location and date, featuring location search, current location detection, accurate calculations, responsive design, and photography tips.

### Feature Specifications
The system supports chronological session sorting, an integrated deposit system, and a comprehensive storage quota and billing system with real-time tracking. A robust unified file deletion system ensures complete cleanup. It includes a professional CapCut-style Website Builder with full-screen preview, drag-and-drop functionality, and editable components (formatting, alignment, fonts, colors, spacing). The website builder now includes 21 professional fonts organized into categories: Serif (6), Sans-Serif (10), Display (2), and Script (3). When creating galleries, users are prompted to specify the number of photos (with a default of 6). Gallery photos use consistent Unsplash photo IDs and include camera button overlays for easy swapping. Individual photo editing with always-visible camera buttons and drag-repositioning is supported. Button elements feature advanced page linking. Prebuilt pages (Portfolio, About, Contact) are customizable. Advanced subpage functionality supports nested structures. A full booking agreement system with e-signature capabilities and Stripe Connect Express for multi-photographer payment routing are integrated.

### Website Publishing System (New)
The platform now includes a complete website publishing infrastructure that allows photographers to publish their created websites to subdomains (photographer.yourplatform.com). The system features:
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