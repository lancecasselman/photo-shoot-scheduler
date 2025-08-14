# Photography Management System

## Overview
A streamlined photography business management platform designed for professional photographers. Its purpose is to provide essential workflow management tools, including session scheduling, client management, invoicing, and contract signing. The platform operates on a subscription model with $39/month recurring billing for the Professional plan including 100GB storage. When photographers reach the storage limit, they must delete files or purchase 1TB storage add-ons at $25/month each, with unlimited add-ons available. All storage add-ons are backed up to Cloudflare R2. The business vision is to empower photographers with tools to efficiently manage their operations, enhancing productivity and client satisfaction. Features a commercial landing page with Stripe payment integration for subscription management.

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
The system supports chronological session sorting by appointment date (dateTime field), displaying sessions from oldest to newest appointment date rather than creation date. This ensures sessions appear in logical chronological order based on when they're scheduled to occur. A deposit system is fully integrated, tracking deposit amounts in the database, applying them to invoices, and displaying remaining balances.

### Storage Quota and Billing System
A comprehensive storage quota and billing system provides subscription-based storage management with 100GB base storage included in the $39/month Professional plan. When users exceed their quota, they can purchase unlimited 1TB storage add-ons at $25/month each, all backed up to Cloudflare R2. The system includes real-time quota tracking, pre-upload validation, a visual storage dashboard with usage analytics, and automatic subscription management. The StorageQuotaManager service handles all quota calculations and billing operations with proper authentication middleware.

### Unified File Deletion System
A robust unified deletion system ensures complete file cleanup with no orphaned records. It includes database lookup for exact folder type detection, enhanced logging, comprehensive verification checks, and pattern matching to catch all database entries. The service coordinates between cloud storage and database cleanup, preventing phantom file records. Delete buttons on thumbnails provide instant file removal with confirmation dialogs, progress feedback, and automatic file list refresh. The system features fallback mechanisms and comprehensive error handling to ensure reliable file deletion across all interfaces.

## Recent Changes (August 14, 2025)
- **CRITICAL**: Session sorting by appointment date is COMPLETE and WORKING - do not modify
- **COMPLETED**: Stripe Connect Express Integration for Multi-Photographer Platform
  - Added stripe_connect_account_id and stripe_onboarding_complete fields to users table
  - Created comprehensive Stripe Connect API endpoints (/api/stripe-connect/onboard, /status, /refresh)
  - Implemented StripeConnectManager service for Express account creation and management
  - Added Payment Settings tab to main navigation with full Stripe Connect UI
  - Enhanced payment intent creation to automatically route payments to connected photographer accounts
  - Created success/refresh pages for Stripe Connect OAuth flow completion
  - Payment system now supports direct payments to individual photographer bank accounts
  - Platform operates with 0% transaction fees - photographers keep 100% minus Stripe's 2.9% + 30¢
  - System designed to scale to thousands of photographers, each with individual Stripe merchant accounts
- **COMPLETED**: Deposit Payment Notification System 
  - Fixed Stripe webhook handler to process checkout sessions for deposit payments
  - Added checkout.session.completed event handling for photography session notifications
  - Enhanced metadata inclusion in checkout sessions for proper payment tracking
  - Created dedicated deposit_payments table for proper payment record storage
  - Fixed database schema mismatch that was preventing webhook processing
  - Photographer now receives email notifications when clients complete deposit payments
  - System extracts session information from payment IDs and triggers notification workflow
  - Verified with $5.00 test deposit payment - system now fully operational
- **COMPLETED**: Fixed Deposit Payment Button Visibility Issue
  - Moved deposit button outside tip section to prevent hiding when tip section is hidden
  - Added prominent green styling and larger button size for better visibility
  - Button now always visible for deposit invoices regardless of authentication status
  - Photographers see both payment button and additional send options
  - Clients see only the payment button for streamlined experience
- **COMPLETED**: Enhanced Deposit Invoice System with Authentication-Based UI
  - Smart authentication detection distinguishes photographers from clients
  - Photographers (authenticated): See send options to share deposit links via SMS/Email
  - Clients (anonymous): Only see streamlined "Pay Deposit Now" button
  - Added `/api/check-auth` endpoint for real-time authentication status
  - Complete separation of creator vs payer experiences
- **COMPLETED**: Full Stripe Payment Processing Integration
  - Complete Stripe Payment Intent system for session payments and deposits
  - Secure payment forms with Stripe Elements integration on invoice pages
  - Automatic payment notifications via webhook system with session metadata
  - Payment validation and error handling with loading states
  - Real-time payment confirmation and database recording
  - Both deposits and invoices process through unified Stripe system
  - Test suite at `/test-payment-system.html` for verification
- **COMPLETED**: Enhanced Deposit System with Customizable Amounts and Sending Features
  - Orange "💳 Send Deposit" button prompts for custom amount with helpful context (session total, existing deposits, suggested 50%)
  - Deposit invoices automatically hide tip section via type=deposit parameter detection
  - Deposit-specific send buttons (SMS/Email/Copy) with client contact information pre-filled
  - Send messages include session details (date, type, location) and professional formatting
  - Deposit invoices show "Deposit Payment Details" and "Deposit Amount" labels instead of regular payment terms
  - Complete separation: deposits have no tip options, regular invoices retain full tipping functionality
- **Client-Fillable Tip System**: Complete integration for Stripe invoices
  - Added `tip_amount` column to `payment_records` table
  - Public invoice page at `/invoice.html` (no authentication required)
  - Clients can add 15%, 20%, 25% tips or custom amounts before payment
  - Real-time invoice total calculation with tip display
  - Mobile-responsive tip selection interface
- **Completed**: Full booking agreement system with e-signature capabilities
  - 6 professional templates (Wedding, Portrait, Commercial, Event, Mini Session, Newborn)
  - Purple "📄 Booking Agreement" button on each session card
  - Modal interface with template selector, editor, and signature workflow
  - Database tracking for agreement status (draft, sent, signed)
  - API endpoints for creating, sending, and managing agreements
- **Removed**: Contract buttons and "Contract Signed" status from session cards per user request
- **Fixed**: Template literal errors in contract system that were causing server crashes
- **Added**: Photography Community Platform with full social features
- **Integrated**: Community routes into main server at `/api/community`
- **Created**: Advanced image processing system with automatic optimization
- **Database**: Community tables and booking agreement tables added with proper indexes

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