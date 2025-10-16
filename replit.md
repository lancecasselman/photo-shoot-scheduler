# Photography Management System

## Overview
A subscription-based photography business management platform designed for professional photographers. It offers comprehensive workflow tools including session scheduling, client management, invoicing, contract signing, and a CapCut-style website builder. The platform aims to boost photographer productivity and client satisfaction, operating on a subscription model with tiered storage options.

## User Preferences
Preferred communication style: Simple, everyday language.
Website Builder Interface: CapCut-style with full-screen preview and bottom toolbar with horizontal scrolling tools.

## System Architecture

### Frontend Architecture
A static HTML/CSS/JavaScript multi-page application built with vanilla JavaScript, featuring a responsive, mobile-first design and PWA capabilities. It utilizes a component-based UI with tabbed navigation. The CapCut-style Website Builder includes a full-screen preview, drag-and-drop functionality, and editable components with 21 professional fonts, focusing on a web-app only strategy. The UI color scheme uses `#10b981` (teal) for primary actions and `#dc2626` (red) for danger actions, ensuring accessibility and consistent branding.

### Backend Architecture
Powered by a Node.js/Express server handling API routes and business logic. Authentication and subscription verification are managed server-side. The system employs a unified Firebase configuration for consistent authentication across frontend and backend components. Critical authentication flows and browser caching issues have been addressed to ensure robust user access and deployment stability.

### Database Architecture
Primary database is PostgreSQL, accessed via Drizzle ORM. Firebase Firestore provides real-time synchronization capabilities. The system utilizes a shared PostgreSQL connection pool architecture to manage database connections efficiently, ensuring stability and preventing connection errors. Database schema is meticulously defined to prevent deployment conflicts.

### File Storage Strategy
Cloudflare R2 serves as the primary cloud storage solution, supporting human-readable file organization and dual-path compatibility. Firebase Storage is used for website assets and user profile images. The system supports full-resolution downloads and on-the-fly thumbnail generation.

### Core Features & System Design
The platform integrates several key features:
- **Photography Delivery System:** Comprehensive download system with flexible pricing, customizable watermarking, and Stripe Connect integration.
- **Photography Community Platform:** A social platform with multi-tab feeds, customizable posts, advanced image optimization, user profiles, direct messaging, and EXIF extraction.
- **AI-Powered Blog Generator:** Integrates OpenAI for customizable blog post generation within the website builder, including SEO optimization and metadata generation.
- **Website Publishing System:** Allows photographers to publish websites to subdomains with real-time availability checks and one-click publishing.
- **Onboarding System:** A 5-step wizard for new users covering business information and subscription integration.
- **Unified Subscription Management System:** Manages multiple billing models (Professional Plan, storage add-ons) using Stripe, including webhooks and automatic storage quota management.
- **Subscription Cancellation & Access Control:** Provides full cancellation functionality and enforces subscription requirements via authentication middleware.
- **Production Deployment Infrastructure:** Features production-ready configuration with security hardening, health monitoring, and robust error handling on a Reserved VM.
- **Platform Analytics & Business Intelligence:** A dashboard for monitoring SaaS performance, user engagement, and platform health.
- **Data Export & GDPR Compliance System:** Offers enterprise-grade data portability, GDPR Article 20 compliance, and Right to be Forgotten functionality.
- **Automated Backup & Disaster Recovery:** Production-grade system with daily database backups, weekly full system backups, and encrypted cloud storage in Cloudflare R2.
- **Advanced User Management System:** Admin dashboard for managing photographer accounts, usage analytics, and bulk operations.
- **Enterprise Support System:** Professional client support infrastructure with automatic issue resolution, multi-channel support, and ticket management.

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore, Storage.
- **PostgreSQL**: Primary relational database.
- **Stripe**: Payment processing, subscription management, Stripe Connect.
- **SendGrid**: Email delivery.
- **Cloudflare R2**: Primary cloud storage.
- **WHCC**: Print fulfillment.
- **OpenAI**: AI-powered blog generation.

### Development & Deployment
- **Drizzle ORM**: Type-safe database operations.
- **Express.js**: Web application framework.
- **Multer**: File upload handling.
- **Archiver**: ZIP file generation.
- **Sharp**: Image processing.
- **AWS SDK**: S3-compatible interface for R2 storage.

### APIs
- **Google Distance Matrix API**: Mileage tracking.
- **OpenWeatherMap Geocoding API**: Location-based services.
- **Sunrise-Sunset API**: Astronomical calculations.