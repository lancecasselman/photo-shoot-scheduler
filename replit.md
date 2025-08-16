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
Capacitor integration enables native mobile app capabilities for iOS deployment, including direct photo uploads from mobile devices. Core features support offline functionality through local storage and synchronization.

### Photography Community Platform
A comprehensive social platform for photographers to connect, learn, and and grow. Features include a multi-tab feed system with customizable post types (photos, videos, help requests, tips, marketplace listings, before/after comparisons), advanced image optimization with automatic thumbnail, feed, and full-resolution versions using Sharp library, Cloudflare R2 integration with automatic size optimization, social features (like, comment, save, share), user profiles with reputation points and skill badges, community tools (weekly challenges, trending topics), direct messaging, and automatic EXIF extraction.

### Golden Hour Times Calculator
A professional photography planning tool that calculates optimal lighting times for any location and date. Features include location search, current location detection, accurate sunrise/sunset and golden/blue hour calculations, responsive design, and photography tips.

### Feature Specifications
The system supports chronological session sorting by appointment date (dateTime field) and includes a fully integrated deposit system that tracks deposit amounts, applies them to invoices, and displays remaining balances. A comprehensive storage quota and billing system manages subscription-based storage, including real-time quota tracking, pre-upload validation, a visual storage dashboard, and automatic subscription management. A robust unified file deletion system ensures complete file cleanup across cloud storage and databases. The system also includes a professional CapCut-style Website Builder with full-screen preview editing, bottom toolbar with horizontal scrolling tools, and drag-and-drop functionality for creating photography websites. All components added from the components list receive consistent editable aspects including: floating toolbar with bold/italic/underline formatting, text alignment controls, font family selection (6 professional fonts), font size adjustment, text color picker, letter spacing control, image editing capabilities, and drag-and-drop reordering. Button elements feature advanced page linking functionality with dropdown page selection, custom URL options, and automatic navigation integration. Default component buttons are pre-linked to appropriate pages (View Portfolio → Portfolio, Learn More → Contact). A full booking agreement system with e-signature capabilities is integrated. Stripe Connect Express is integrated for multi-photographer payment routing.

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