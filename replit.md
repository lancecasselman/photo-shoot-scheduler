# Photography Management System

## Overview
A streamlined photography business management platform designed for professional photographers. Its purpose is to provide essential workflow management tools, including session scheduling, client management, invoicing, and contract signing. The platform operates on a subscription model with $39/month recurring billing for the Professional plan including 100GB storage, with additional 1TB storage add-ons available for $25/month each. All storage add-ons are backed up to Cloudflare R2. The business vision is to empower photographers with tools to efficiently manage their operations, enhancing productivity and client satisfaction. It features a commercial landing page with Stripe payment integration for subscription management and a comprehensive social platform for photographers to connect and grow.

## User Preferences
Preferred communication style: Simple, everyday language.
Website Builder Interface: CapCut-style with full-screen preview and bottom toolbar with horizontal scrolling tools.

## System Architecture

### Frontend Architecture
The system uses a static HTML/CSS/JavaScript multi-page application approach with vanilla JavaScript. It employs a responsive, mobile-first design using CSS Grid and Flexbox, and incorporates PWA capabilities via a service worker for offline functionality. The UI is component-based with a tabbed navigation system.

### Backend Architecture
The backend is built on a Node.js/Express server handling API routes and business logic.

### Authentication & Authorization
Firebase Authentication is the primary system, supporting email/password and Google OAuth. It features a dual-mode system for development/production and implements role-based access for administrative functions and subscriber management, with premium features gate-kept by specific middleware.

### Database Architecture
The primary database is PostgreSQL, utilizing Drizzle ORM for type-safe operations. Firebase Firestore is used for real-time data synchronization, creating a hybrid storage strategy where session data resides in PostgreSQL and real-time features in Firestore.

### File Storage Strategy
Cloudflare R2 serves as the primary cloud storage with session-aware file paths, including a comprehensive RAW file backup system. Firebase Storage is used as secondary storage for website assets and profile images. The system supports full-resolution downloads and on-the-fly thumbnail generation using Sharp with smart caching. Original filenames are preserved, and unified storage tracking provides real-time statistics. Gallery and Raw Storage folders open in dedicated windows with comprehensive file management capabilities.

### Mobile & Responsive Features
Capacitor integration enables native mobile app capabilities for iOS deployment, including direct photo uploads from mobile devices. Core features support offline functionality through local storage and synchronization. **Xcode deployment ready** with bundle identifier `com.thelegacyphotography.photomanager`, complete Firebase configuration, proper permissions (Camera, Photo Library, Location), and production-ready iOS project structure. All iOS-specific configuration files updated and synchronized.

### Photography Community Platform
A comprehensive social platform for photographers to connect, learn, and and grow. Features include a multi-tab feed system with customizable post types (photos, videos, help requests, tips, marketplace listings, before/after comparisons), advanced image optimization with automatic thumbnail, feed, and full-resolution versions using Sharp library, Cloudflare R2 integration with automatic size optimization, social features (like, comment, save, share), user profiles with reputation points and skill badges, community tools (weekly challenges, trending topics), direct messaging, and automatic EXIF extraction.

### Golden Hour Times Calculator
A professional photography planning tool that calculates optimal lighting times for any location and date. Features include location search, current location detection, accurate sunrise/sunset and golden/blue hour calculations, responsive design, and photography tips.

### Feature Specifications
The system supports chronological session sorting by appointment date (dateTime field) and includes a fully integrated deposit system that tracks deposit amounts, applies them to invoices, and displays remaining balances. A comprehensive storage quota and billing system manages subscription-based storage, including real-time quota tracking, pre-upload validation, a visual storage dashboard, and automatic subscription management. A robust unified file deletion system ensures complete file cleanup across cloud storage and databases. The system also includes a professional CapCut-style Website Builder with full-screen preview editing, bottom toolbar with horizontal scrolling tools, and drag-and-drop functionality for creating photography websites. An admin-only Website Builder integration provides secure access through the landing page navigation, restricted to specific admin email addresses (lancecasselman2011@gmail.com, lancecasselman@icloud.com, lance@thelegacyphotography.com) with Firebase authentication, allowing private website building capabilities without exposing admin tools to regular visitors. All components added from the components list receive consistent editable aspects including: floating toolbar with bold/italic/underline formatting, text alignment controls, font family selection (6 professional fonts), font size adjustment, text color picker, letter spacing control, individual photo editing capabilities with always-visible camera buttons, and drag-and-drop reordering. The photo editing system features individual camera buttons on every image (always visible, no hover required) for photo uploads, while images themselves are drag-repositionable within containers using grab cursor functionality. Button elements feature advanced page linking functionality with dropdown page selection, custom URL options, and automatic navigation integration. Default component buttons are pre-linked to appropriate pages (View Portfolio → Portfolio, Learn More → Contact). The website builder includes prebuilt pages with professional content - Portfolio page features gallery components with photography samples, About page includes photographer bio and services sections, and Contact page has contact forms and information, all fully customizable with the editing system. Advanced subpage functionality enables nested page structures like Portfolio > Wedding Gallery with hierarchical navigation support in both horizontal and dropdown menu styles. A full booking agreement system with e-signature capabilities is integrated. Stripe Connect Express is integrated for multi-photographer payment routing.

### Enhanced Onboarding System
A comprehensive 5-step wizard that guides new users through platform setup including username selection for community identification, business information collection, photography specialty selection, and integration with subscription access control. Features include real-time username availability checking, business type customization for tailored experience, modern wizard-style interface with progress tracking, and seamless integration with the subscription management system. The onboarding process ensures users have complete profiles with usernames for community features before accessing the main platform.

### Unified Subscription Management System
A comprehensive subscription management system supporting multiple platforms and billing models. Core features include $39/month Professional Plan with 100GB storage, $25/TB/month storage add-ons with Cloudflare R2 backup, Stripe integration for web payments, future iOS App Store and Google Play billing support for native mobile apps, complete PostgreSQL database schema with subscription tracking and user summaries, webhook handling for payment events and status updates, multi-platform customer tracking (web users, mobile app users), automatic storage quota management and enforcement, subscription analytics and reporting capabilities, and seamless platform migration support. The system provides unified APIs for subscription status across all platforms, ensuring consistent user experience whether accessing via web browser or mobile app. Database architecture supports complex subscription scenarios including multiple storage add-ons per user, platform-specific commission tracking (0% for Stripe, 15-30% for app stores), subscription pause/resume functionality, and comprehensive audit logging. All subscription data integrates with existing storage billing system to provide real-time quota enforcement and overage protection.

### Subscription Cancellation System
Complete subscription cancellation functionality with platform-specific handling. Features include user-initiated cancellation through dedicated settings page, automatic Stripe subscription cancellation with prorated refunds, proper handling of Apple IAP and Google Play subscriptions (marked for cancellation, user completes in respective app stores), cancellation of all user subscriptions (Professional Plan + Storage add-ons) with single action, detailed cancellation logging and event tracking, optional cancellation reason collection for business insights, immediate database status updates while maintaining access until period end, and comprehensive cancellation confirmation system. The cancellation system ensures proper payment cessation across all platforms while maintaining data integrity and user access rights during transition periods.

### Subscription Access Control System
Comprehensive access control that enforces subscription requirements throughout the platform. Users with cancelled or expired subscriptions cannot access core app functionality. Features include subscription-aware authentication middleware that blocks API access for inactive users, frontend subscription guard with user-friendly modals explaining subscription requirements, automatic redirection to subscription checkout for non-subscribers, grace period access until subscription period officially ends, admin email whitelist bypass for platform administrators, and real-time subscription status checking. The system provides clear messaging about subscription status and required actions, ensuring users understand exactly what they need to do to regain access while maintaining a professional user experience.

### Replit Development Environment Compatibility
The system includes specific handling for Replit's development environment constraints. Session persistence issues in Safari with multiple emails are resolved through optimized cookie settings (secure: false, sameSite: 'lax'). Iframe detection automatically identifies when the app is running in Replit's preview pane where session cookies may not function properly, providing users with a clear notification and option to open in a new tab for full functionality. Authentication flow works correctly but may require opening in new tab for proper session persistence in development environment.

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore database, Storage, Hosting, and Functions.
- **PostgreSQL**: Primary relational database via Neon serverless.
- **Stripe**: Payment processing, subscription management, and Stripe Connect.
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