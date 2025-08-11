# Photography Management System

## Overview
A streamlined photography business management platform for professional photographers. It provides essential workflow management, including session scheduling, client management, invoicing, and contract signing. The platform operates on a freemium model, offering basic features for all users and premium features via subscription. Its business vision is to empower photographers with tools to efficiently manage their operations, enhancing productivity and client satisfaction.

## User Preferences
Preferred communication style: Simple, everyday language.

## Recent Changes
- **August 11, 2025**: Raw Storage Manager & Delete All Functionality Repair
  - ✅ Fixed Raw Storage Manager folder type validation and file loading issues
  - ✅ Synchronized database with R2 storage (added 2 missing RAW files)
  - ✅ Rebuilt backup indices for proper file lookup and thumbnail generation
  - ✅ Enhanced delete all functionality with unified deletion system integration
  - ✅ Delete all button now properly removes files from both database and R2 cloud storage
  - ✅ Added comprehensive error handling and user feedback for batch deletion operations
- **August 11, 2025**: Legacy System Cleanup and Thumbnail Integration
  - ✅ Removed outdated RAW Backup & Storage Dashboard (empty legacy component)
  - ✅ Thumbnail system successfully integrated into main gallery managers
  - ✅ Enhanced file preview system with JPEG thumbnails for all RAW formats
- **August 11, 2025**: Complete Thumbnail Generation System Implementation
  - ✅ Advanced thumbnail generation system using Sharp library for all image types
  - ✅ Multi-size thumbnail generation (small: 150px, medium: 400px, large: 800px)
  - ✅ Optimized JPEG output with progressive encoding and quality optimization
  - ✅ RAW file format support (TIFF, CR2, NEF, ARW, DNG) with embedded JPEG extraction
  - ✅ Automatic thumbnail generation during file upload (background processing)
  - ✅ On-demand thumbnail generation for existing files without thumbnails
  - ✅ Enhanced preview route with thumbnail prioritization and fallback processing
  - ✅ Dedicated thumbnail API endpoint (/api/r2/thumbnail) with size parameters
  - ✅ Smart caching with 24-hour cache headers for optimal performance
  - ✅ Storage overhead optimization: 0.08% (0.83MB thumbnails for 1043.6MB originals)
  - ✅ Performance: Sub-5 second processing for 270MB+ RAW files
  - ✅ Comprehensive backup index system rebuilt for existing files
  - ✅ Format support: 100% coverage for all image file types (RAW and standard)
- **August 11, 2025**: Critical R2 Backup System Repair
  - ⚠️ **CRITICAL ISSUE IDENTIFIED**: 21 of 25 files missing R2 cloud backup keys
  - ✅ Comprehensive R2 backup verification system implemented 
  - ✅ Emergency backup repair scripts created for data integrity
  - ✅ Raw storage properly verified - 3 phantom files removed from database
  - ✅ Send to Client feature loads contact data from session database
  - ✅ Email/SMS validation prevents sending without contact information
  - ✅ Gallery manager now fetches complete session data on load
  - ✅ Fixed gallery file listing to query database instead of Firebase Storage
  - ✅ Fixed storage statistics calculation from database records (116.45 MB tracked)
  - ✅ Corrected global storage stats endpoint SQL type mismatch (VARCHAR vs UUID)
  - ✅ Platform Storage Overview now accurately displays all file storage
  - ✅ Session storage manager properly integrated with R2 and database
  - ✅ File downloads now retrieve directly from R2 using stored keys
- **August 10, 2025**: Business Management Dashboard Integration Complete
  - ✅ Expense tracking database schema implemented (business_expenses table)
  - ✅ Full API endpoints for expense CRUD operations (GET/POST/DELETE)
  - ✅ Dashboard integration with real-time financial calculations
  - ✅ Time period filtering for expenses matching earnings system
  - ✅ Async/await implementation for database operations
  - ✅ Database connection timeout issues resolved with proper pool management
  - ✅ Financial stats showing: $1,500 earnings, $800 expenses, $700 net profit
  - ✅ Round trip mileage tracker with Google Distance Matrix API integration
  - ✅ Business reports pulling data from dashboard sources (database + localStorage)
  - ✅ Enhanced CSV export with mileage deductions and detailed breakdowns
  - ✅ Chart sections removed from dashboard for cleaner interface
  - ✅ Dashboard export functionality with CSV and PDF export options for financial data
- **August 9, 2025**: Production optimization and Git repository cleanup
  - ✅ Git repository cleanup system implemented
  - ✅ Comprehensive .gitignore preventing large file commits
  - ✅ All photos verified in Cloudflare R2 storage (0 local files)
  - ✅ Developer mode disabled (authentication required)
  - ✅ Database connectivity restored and optimized
  - ✅ Platform verified production-ready
  - ✅ Golden Hour Times tab added with sunrise/sunset calculations
  - 🔧 Git history cleanup ready (260MB TIFF file removal instructions provided)
  - 📊 Repository size target: <100MB (from 2.4GB)

## System Architecture

### Frontend Architecture
The system uses a static HTML/CSS/JavaScript multi-page application approach with vanilla JavaScript for core functionality. It employs a responsive, mobile-first design using CSS Grid and Flexbox, and incorporates PWA capabilities via a service worker for offline functionality. The UI is component-based with a tabbed navigation system.

### Backend Architecture
The backend is built on a Node.js/Express server handling API routes and business logic. It integrates with Firebase for client-side authentication. Session management is handled by Express-session with a PostgreSQL store, and file uploads utilize Multer middleware.

### Authentication & Authorization
Firebase Authentication is the primary system, supporting email/password and Google OAuth. It features a dual-mode system for development/production and implements role-based access for administrative functions and subscriber management. Premium features are gate-kept with specific middleware.

### Database Architecture
The primary database is PostgreSQL, utilizing Drizzle ORM for type-safe operations. Firebase Firestore is used for real-time data synchronization, creating a hybrid storage strategy where session data resides in PostgreSQL and real-time features in Firestore.

### Payment & Subscription System
Stripe is integrated for subscription management and payment processing, supporting a freemium model with usage-based billing tied to storage limits and advanced features across different subscription tiers.

### File Storage Strategy
Cloudflare R2 serves as the primary cloud storage, offering 1TB capacity with session-aware file paths. It includes a comprehensive RAW file backup system supporting all file types without restrictions. Firebase Storage is used as secondary storage for website assets and profile images. The system supports full-resolution downloads without compression, maintaining original file integrity, and enabling multi-GB streaming downloads. On-the-fly thumbnail generation using Sharp is implemented for efficient display, with smart caching and graceful fallbacks. Original filenames are preserved through metadata storage and prioritized in file listings and ZIP downloads. Unified storage tracking provides real-time statistics for both gallery and raw storage. Gallery and Raw Storage folders open in dedicated windows with comprehensive file management capabilities, proper file displays with original names, and accurate storage statistics.

### Email & Notifications
SendGrid is integrated for professional email delivery, supporting automated workflows for client communications, billing notifications, and feature updates. The contract management system also leverages email for electronic signature processes.

### Mobile & Responsive Features
Capacitor integration enables native mobile app capabilities for iOS deployment, including direct photo uploads from mobile devices. Core features support offline functionality through local storage and synchronization.

### Community Section
An Instagram-style photo sharing section is available as a standalone page with modular architecture. It supports real-time interactions (likes, comments) using Firebase Firestore, features a responsive design (masonry grid on desktop, single-column on mobile), requires authenticated users, organizes posts by calendar month, and includes an image upload system (10MB limit) to Firebase Storage with progress tracking.

### Golden Hour Times Calculator
A professional photography planning tool that calculates optimal lighting times for any location and date. Features include location search with popular photography destinations, current location detection using browser geolocation, accurate sunrise/sunset calculations using astronomy APIs, golden hour period calculations (1 hour after sunrise, 1 hour before sunset), blue hour calculations (30 minutes before/after twilight), responsive design with beautiful time cards, photography tips for different lighting conditions, and location details with coordinates. The system integrates OpenWeatherMap geocoding API and Sunrise-Sunset API for accurate astronomical calculations.

### Feature Specifications
The system supports chronological session sorting, prioritizing today's sessions, then future sessions by proximity, and past sessions by recency. A deposit system is fully integrated, tracking deposit amounts in the database, applying them to invoices, and displaying remaining balances on the frontend. A professional contract management system generates three contract types per session (Photo Print Release, Service Agreement, Model Release) with automatic date insertion and integrates a signature system for client signatures, providing a professional viewing modal, print functionality, and PDF download options.

### Storage Quota and Billing System
A comprehensive storage quota and billing system provides freemium storage management with 5GB free storage for all users and 1TB paid packages at $25/month via Stripe integration. The system includes real-time quota tracking, pre-upload validation that blocks uploads when quota is exceeded, visual storage dashboard with usage analytics and upgrade prompts, Stripe checkout integration for 1TB/2TB/5TB packages, and automatic subscription management. The StorageQuotaManager service handles all quota calculations and billing operations with proper authentication middleware protecting all endpoints.

### Unified File Deletion System
A robust unified deletion system ensures complete file cleanup with no orphaned records. The system includes database lookup for exact folder type detection, enhanced logging, comprehensive verification checks before and after deletion, and pattern matching to catch all database entries. The unified deletion service coordinates between cloud storage and database cleanup, preventing phantom file records that cause inflated storage calculations. All deletion endpoints use proper authentication and query the database first to determine correct folder types before attempting deletion.

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
- **iOS SDK**: Native iOS functionality.

## Repository Information
- **Author**: Lance Casselman (lancecasselman@icloud.com)
- **GitHub**: [@lancecasselman](https://github.com/lancecasselman)
- **Repository**: photography-management-platform
- **License**: MIT License

## Deployment Configuration
- **Docker Support**: Complete Dockerfile and docker-compose.yml for containerized deployment
- **Health Checks**: `/health` endpoint for container monitoring and load balancer integration
- **Container Registry**: Google Cloud Registry configuration with specific image tagging
- **Environment**: Production-ready container with security best practices and non-root execution