# Photography Management System

## Overview
A platform for professional photographers, offering tools for workflow management, including session scheduling, client management, invoicing, and contract signing. It operates on a subscription model, aiming to boost photographer productivity and client satisfaction. The platform includes a CapCut-style website builder, a photography delivery system with flexible download pricing, and an AI-powered blog generator.

## User Preferences
Preferred communication style: Simple, everyday language.
Website Builder Interface: CapCut-style with full-screen preview and bottom toolbar with horizontal scrolling tools.

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