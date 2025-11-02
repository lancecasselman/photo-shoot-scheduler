# Photography Management System

## Overview
A subscription-based platform designed for professional photographers to streamline workflow management. Key features include session scheduling, client management, invoicing, contract signing, a CapCut-style website builder, a photography delivery system with flexible download pricing, and an AI-powered blog generator. The platform aims to enhance photographer productivity and client satisfaction through comprehensive tools and automation.

## User Preferences
Preferred communication style: Simple, everyday language.
Website Builder Interface: CapCut-style with full-screen preview and bottom toolbar with horizontal scrolling tools.

## System Architecture

### Frontend
A static HTML/CSS/JavaScript multi-page application utilizing vanilla JavaScript, designed to be responsive and mobile-first with PWA capabilities. It employs a component-based UI with tabbed navigation. The CapCut-style Website Builder offers drag-and-drop functionality and editable components. A consistent teal/green theme (#10b981) is used for primary actions, and red (#dc2626) for danger actions, ensuring accessibility and brand consistency.

### Backend
Powered by a Node.js/Express server that handles API routes, business logic, server-side authentication, and subscription verification. It includes dynamic CORS configuration for secure session management.

### Authentication & Authorization
Uses Firebase Authentication for email/password and Google OAuth, providing role-based access. Robust server-side session management ensures secure user access and persistence, with admin access bypassing subscription requirements.

### Database
PostgreSQL is the primary database, managed with Drizzle ORM, supplemented by Firebase Firestore for real-time synchronization needs.

### File Storage
Cloudflare R2 serves as the primary cloud storage solution, featuring human-readable file organization and dual-path compatibility. Firebase Storage is used for website assets and profile images. The system supports full-resolution downloads, on-the-fly thumbnail generation, and optimized file deletion processes for R2.

### Photography Delivery System
Implements a per-session download pricing model, allowing photographers to set free download limits and per-photo costs. It includes a streamlined client gallery with **server-side download tracking** that's compatible with Safari's Intelligent Tracking Prevention and all modern browsers, integration with Stripe Connect, and customizable watermarking. Download tracking uses server-authoritative PostgreSQL storage with localStorage as an optional performance cache, ensuring clients can view their download history even when browser storage is blocked. The system features **purchased photo tracking** that persists photography session IDs through the Stripe checkout flow, enabling galleries to display which photos have been purchased and provide immediate download access via secure tokens. Gallery visitors can view purchased photos with dedicated download buttons using dual authentication (gallery token or photographer credentials). The `/api/gallery/:sessionId/download-history` endpoint provides cross-browser download history access using gallery token authentication.

### Photography Community Platform
A social platform featuring a multi-tab feed, customizable post types, advanced image optimization, social features, user profiles with reputation points, direct messaging, and EXIF extraction.

### Core Features & System Design
The system incorporates chronological session sorting, an integrated deposit system, storage quota management with billing, unified file deletion, customizable pages, booking agreements with e-signatures, and Stripe Connect Express for multi-photographer payments.

### Custom Contract Template System
A comprehensive template management solution allowing photographers to create and manage their own contract templates beyond the built-in system templates. Features include a dedicated template management interface at /contract-templates.html with rich text editing, template preview functionality, and visual distinction between system templates (wedding, portrait, commercial, event, mini, newborn) and photographer-created custom templates. The system implements secure multi-tenant authorization, ensuring photographers can only edit and delete their own templates. Templates are integrated into the booking agreement workflow with grouped template selectors that clearly separate system and custom options. The database schema uses user_id columns to differentiate between shared system templates (user_id IS NULL) and private photographer templates, with proper indexing for performance at scale.

### Payment Plan System
A dual-mode payment plan system supporting both manual invoicing and automated billing through Stripe Subscription Schedules. **Manual Plans** use PostgreSQL to store payment schedules with flexible frequencies (weekly, bi-weekly, monthly), precise rounding logic ensuring all payments sum to exact totals, intelligent month-end date handling, and manual invoice generation via Stripe Connect. **Automated Plans** use Firestore + Stripe Connect to create subscription schedules that automatically charge customers on payment dates, support both date-range and number-of-payments configurations, and provide secure client checkout links for payment method setup. The **Unified Payment Plan Viewer** displays both plan types with visual distinction (automated vs manual), shows payment schedules with real-time status tracking, provides links to Stripe Dashboard for automated plans, and offers email/SMS schedule sharing for manual plans. Sessions automatically flag `has_payment_plan` when either plan type is created, enabling photographers to track and manage all payment arrangements from a single interface.

### Payment Schedule Notification System
A flexible notification system that enables photographers to view and send payment schedules to clients via email or SMS without requiring third-party services. The system features three core capabilities: (1) comprehensive payment schedule retrieval with detailed plan information, session details, photographer business info, and individual payment breakdowns; (2) email delivery using nodemailer with SMTP configuration (supports Gmail, Outlook, custom SMTP) with automatic fallback to mailto: URLs when SMTP is not configured; (3) SMS notification via sms: URL scheme that opens the device's default SMS app with pre-filled payment schedule text. Configure SMTP via environment variables (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, SMTP_SECURE) to enable server-side email sending, or use the mailto: fallback for client-side email composition. The system provides formatted plain-text schedules showing total amounts, payment breakdowns, due dates, status indicators, and photographer contact information.

### Real-Time Notification System
An in-app notification system that alerts photographers of critical business events. Features a header bell icon with live unread count badge, dropdown panel displaying recent notifications, and automatic polling for updates every 30 seconds. Notifications are triggered when payment plan payments are received and when clients sign contracts, storing notification data with metadata (session ID, amount, client name) for contextual alerts. The system supports marking individual notifications as read, marking all as read, and maintaining persistent notification history in PostgreSQL.

### AI-Powered Blog Generator
Integrates OpenAI to provide customizable blog post generation within the website builder, offering options for topic, style, tone, length, SEO keyword optimization, and automatic metadata generation.

### Website Publishing System
Enables photographers to publish websites to subdomains, offering real-time availability checks, one-click publishing, and live preview functionalities.

### Onboarding System
A 5-step wizard guides new users through setup, covering username selection, business information, photography specialty, and subscription integration.

### Unified Subscription Management System
Manages various platforms and billing models (Professional Plan, storage add-ons) via Stripe for web payments, webhooks, multi-platform customer tracking, automatic storage quota management, comprehensive cancellation, and access control enforcement.

### Production Deployment Infrastructure
Configured for production with security hardening, health monitoring, structured logging, database optimization, and robust error handling, deployed on a Reserved VM.

### Platform Analytics & Business Intelligence
A dashboard provides insights into SaaS performance, including revenue, user engagement, platform health, support, and business metrics.

### Data Export & GDPR Compliance System
Offers enterprise-grade data portability and privacy compliance features such as data export options, GDPR Article 20 compliance, Right to be Forgotten functionality, and audit logging.

### Automated Backup & Disaster Recovery
A production-grade backup system ensures daily database backups, weekly full system backups, integrity checking, encrypted cloud storage in Cloudflare R2, and point-in-time recovery.

### Advanced User Management System
A comprehensive admin dashboard for managing photographer accounts, offering filtering, search, bulk operations, account controls, usage analytics, and export tools.

### Enterprise Support System
Provides professional-grade client support infrastructure with automatic issue resolution, multi-channel support, a help center, ticket management, support analytics, and client communication.

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore, Storage.
- **PostgreSQL**: Primary relational database (via Neon serverless).
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
- **JSZip**: Client-side ZIP file creation.
- **Uppy**: Advanced file upload interface.

### APIs
- **Google Distance Matrix API**: Mileage tracking.
- **OpenWeatherMap Geocoding API**: Location-based services.
- **Sunrise-Sunset API**: Astronomical calculations.