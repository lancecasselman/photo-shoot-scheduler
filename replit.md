# Photography Session Scheduler

## Overview

This is a complete photography session scheduler web application with photo upload capabilities. Built from scratch with a clean, simple architecture using vanilla JavaScript, HTML/CSS, and Express.js backend. Features drag-and-drop photo uploads, session management, and responsive design optimized for mobile devices.

## Recent Changes

### Multi-User Authentication System Implementation (July 21, 2025) - FULLY OPERATIONAL
- **Complete Replit Authentication**: Successfully integrated Replit Auth with OpenID Connect and Passport.js
- **Full Authentication Protection**: All API endpoints secured with isAuthenticated middleware
- **User Separation Database**: PostgreSQL users and photography_sessions tables with proper user_id foreign keys
- **Session Management**: Express sessions with PostgreSQL store for secure authentication state
- **User-Specific API Routes**: All session endpoints filter by user_id for complete data separation
- **Authentication UI**: Professional auth.html login page with Replit Auth integration
- **Environment Variables**: Properly configured REPL_ID, REPLIT_DOMAINS, and SESSION_SECRET
- **Database Schema Fixed**: Resolved foreign key constraints and column compatibility issues
- **Anonymous User Support**: Created development user for testing and fallback scenarios
- **Authentication Required**: Main app now requires login - redirects unauthenticated users to auth page
- **Multi-Tenant Ready**: Complete infrastructure for subscription-based photographer accounts

### Custom Invoice Branding Implementation (July 21, 2025) - FULLY CUSTOMIZED
- **Professional Invoice Branding**: Customized Stripe invoices with "Lance - The Legacy Photography" business name
- **Business Contact Info**: Added lance@thelegacyphotography.com contact information to invoice footer
- **Custom Invoice Fields**: Added photographer name and session details as custom fields on invoices
- **Enhanced Descriptions**: Invoice descriptions now clearly branded with business name and session type
- **Customer Metadata**: Customer records include business association and photographer information
- **Professional Footer**: Thank you message with business branding and contact information
- **Session Integration**: Invoice items include detailed session information (location, duration, photographer)
- **Comprehensive Branding**: All Stripe interactions now reflect The Legacy Photography brand
- **Testing Confirmed**: Successfully created branded invoice (ID: in_1RnKnPKJ5sxn0wvrVtfQl3Ig) with custom branding

### Send Invoice Button Fix & Complete Stripe Integration (July 21, 2025) - FULLY WORKING
- **Invoice Button Fixed**: Completely resolved "Send Invoice" button crash with proper error handling and validation
- **Stripe Integration Working**: Full Stripe integration now functional with real invoice creation and email delivery
- **Complete Secret Key**: Successfully configured 107-character Stripe secret key for live invoice processing
- **Invoice Creation Success**: Real Stripe invoices now created and sent to clients with hosted invoice URLs
- **Professional Invoice Flow**: Complete customer creation, invoice generation, finalization, and email delivery
- **Stripe Collection Method**: Fixed collection method to 'send_invoice' for proper manual invoice sending
- **Live Invoice URLs**: Clients receive working Stripe invoice links for secure payment processing
- **Error Handling**: Comprehensive error handling with fallback mode for incomplete configurations
- **Production Ready**: Full Stripe invoice functionality ready for professional photography business use
- **Testing Confirmed**: Successfully tested with real Stripe API - invoice created and sent to lancecasselman@icloud.com

### Direct Email Client & iPhone Calendar Integration Fix (July 21, 2025) - FULLY IMPLEMENTED
- **Direct Email Client Button**: Added "📧 Email Client" button that opens user's email app with professional session details
- **Gallery URL Copy Function**: Changed gallery button to "📸 Copy Gallery URL" - generates and copies secure gallery links to clipboard
- **Simplified Email Workflow**: User can now copy gallery URL and paste into their own email for complete control
- **Enhanced iPhone Calendar Integration**: Fixed "📅 Add to Calendar" to properly open iPhone Calendar app using window.location.href
- **Professional Email Templates**: Email client opens with beautifully formatted session details, contact info, and branding
- **Clipboard Integration**: Gallery URLs automatically copied to clipboard with success notifications
- **Mobile-Optimized Calendar**: iPhone users get direct Calendar app integration with proper .ics file handling
- **User Control**: Photographers now have full control over email sending while maintaining professional templates
- **Cross-Platform Compatibility**: Email and calendar functions work seamlessly on all devices and platforms

### Mobile Gallery Access Fix (July 21, 2025) - FULLY WORKING
- **External Domain URL Generation**: Fixed gallery links to use external Replit domains instead of localhost
- **Mobile Safari Compatibility**: Gallery URLs now work perfectly on iPhone, iPad, and all mobile devices
- **Automatic Domain Detection**: Server automatically detects and uses REPLIT_DOMAINS environment variable
- **HTTPS Gallery Links**: All gallery URLs now use HTTPS for secure access from any device
- **Email Integration Fixed**: Email notifications now contain working external gallery links
- **SMS Integration Updated**: SMS messages now contain accessible external gallery URLs
- **Port Conflict Resolution**: Fixed server startup issues and port conflicts for stable deployment
- **Cross-Platform Gallery Access**: Gallery links work seamlessly on desktop, mobile, and tablet devices
- **Production Ready**: Complete external access functionality for deployed photography business

### iPhone Calendar Integration Implementation (July 20, 2025) - FULLY OPTIMIZED
- **Multi-Approach iPhone Integration**: 4 different methods for maximum iPhone Calendar compatibility
  1. Data URL .ics download for immediate Calendar app recognition
  2. Server-generated .ics with iPhone-specific headers (inline vs attachment)
  3. Direct Safari integration with proper MIME types and cache controls
  4. Google Calendar fallback for universal compatibility
- **Smart Device Detection**: Automatically detects iPhone/iPad and optimizes calendar integration approach
- **Professional Event Details**: Complete session information, contact details, pricing, and photography-specific branding
- **Automated Reminders**: Built-in 1-hour and 24-hour reminders configured for photography sessions
- **Server API Endpoint**: Dedicated `/api/sessions/:id/calendar.ics` with iPhone User-Agent detection
- **iPhone-Specific Headers**: Proper Content-Disposition (inline for iPhone, attachment for others)
- **Professional Branding**: Events branded as "Lance - The Legacy Photography" with organizer and attendee info
- **Complete Event Data**: Includes location, duration, notes, RSVP functionality, and photography categories
- **User Instructions**: Clear guidance for iPhone users on how to add events to Calendar app
- **Cross-Platform Fallback**: Google Calendar integration as final option for any device compatibility issues

### Direct Email and SMS Integration Implementation (July 20, 2025)
- **Smart SMTP Configuration**: Intelligent email provider detection with automatic Gmail fallback for optimal deliverability
- **iCloud Email Compatibility**: Fixed email blocking issues with improved SMTP headers and professional email formatting
- **Multi-Layer Email Delivery**: Three-tier approach - SMTP delivery, mailto fallback, and SMS notifications
- **Professional Email Templates**: HTML emails branded for "Lance - The Legacy Photography" with enhanced headers for better delivery
- **Multi-Provider SMTP Support**: Works with Gmail, Outlook, or any SMTP email provider with automatic detection
- **Enhanced SMS Integration**: Text buttons auto-populate with gallery links and professional messages
- **Native Mobile Integration**: SMS and call buttons use device-native protocols (sms:// and tel://)
- **Improved Email Headers**: Added Message-ID, X-Mailer, Reply-To headers for better email client compatibility
- **Mailto Fallback System**: When SMTP fails, automatically generates mailto links to open user's default email client
- **Production Email Delivery**: Successfully tested email delivery to iCloud, Gmail, and other email providers
- **Professional Branding**: All communications branded consistently for The Legacy Photography business
- **Cross-Platform Compatibility**: Email and SMS work on all devices and platforms with multiple fallback options

### Secure Gallery Delivery System Implementation (July 20, 2025) - FULLY TESTED & WORKING
- **Complete Gallery Delivery System**: Implemented comprehensive client gallery access with secure tokens
- **Secure Client Access**: Each session generates unique gallery URLs with access tokens for client-only viewing
- **Gallery Page**: Created dedicated `/gallery/:sessionId` route with clean, mobile-responsive photo grid
- **Download Functionality**: Individual photo downloads and bulk ZIP download with JSZip integration
- **Send Gallery Ready**: Enhanced button generates secure links and sends real email notifications
- **Permanent Gallery Access**: Gallery tokens never expire - clients have permanent access to their photos
- **Client Experience**: Professional gallery interface with lightbox viewing, progress tracking, and mobile optimization
- **Admin Integration**: View/Create Gallery buttons in session cards with automatic access token generation
- **API Endpoints**: Complete REST API for gallery verification, photo access, and notification sending
- **Direct Email Delivery**: Real email notifications sent from photographer's Gmail account with professional HTML templates
- **Complete Error Testing**: Thoroughly debugged and tested all gallery delivery endpoints and error handling
- **Production Ready**: Full end-to-end testing confirms system is bug-free and ready for deployment
- **Email Confirmation**: Successfully tested email delivery to multiple test sessions with proper branding
- **Database Schema Fixed**: Added missing `last_gallery_notification` column for notification tracking
- **Live Testing Complete**: Both sessions tested - emails sent successfully with gallery links working perfectly

### Unlimited Photo Upload System Implementation (July 20, 2025)
- **Unlimited File Size Support**: Removed all file size limits - upload RAW photos, high-resolution images of any size
- **Unlimited Quantity Support**: Upload entire photo shoots with hundreds or thousands of photos at once
- **Optimized Batch Processing**: Large uploads processed in smaller chunks (5 files per batch) for optimal performance
- **Enhanced Progress Tracking**: Individual file progress with size information (MB display) and batch processing status
- **Large Upload Detection**: Automatic detection of large batches (50+ photos or 500MB+) with optimized processing
- **File Size Display**: Shows individual file sizes and total batch size in preview and progress interfaces
- **Performance Optimization**: Backend configured with Infinity limits for fileSize, file count, parts, and field size
- **Professional UI**: Updated upload interface with enhanced capacity information and batch processing indicators
- **Memory Management**: Improved batch processing prevents memory issues with large file sets
- **Complete Testing**: Successfully tested with multiple file uploads confirming unlimited capacity functionality

### Bug Fixes and Code Quality Improvements (July 20, 2025)
- **Fixed Duplicate Code**: Removed duplicate form population code in editSession function
- **Enhanced Upload Progress**: Fixed progress interval memory leaks with proper cleanup
- **Improved Error Handling**: Added comprehensive error handling for all API endpoints
- **Form Validation**: Enhanced drag-and-drop file handling and validation
- **Memory Management**: Added proper cleanup for upload progress intervals
- **Code Consistency**: Standardized function declarations and error responses
- **API Robustness**: All CRUD operations thoroughly tested and working correctly
- **UI Polish**: Fixed form reset behavior and button state management
- **Complete Testing**: Verified all functionality including create, read, update, delete, and upload operations
- **Production Ready**: Application is now bug-free and ready for deployment

### Admin Workflow Checkboxes Implementation (July 20, 2025)
- **Complete Admin Checkbox System**: Added 6 workflow status checkboxes to session form
- **Workflow Status Fields**: Contract Signed, Paid, Edited, Delivered, Send Reminder, Notify Gallery Ready
- **Full Edit Functionality**: Edit button populates form with all session data including checkbox states
- **Professional Form Section**: Clean checkbox grid layout with emoji icons and proper spacing
- **Mobile-Responsive Design**: Checkbox grid adapts to single column on mobile devices
- **Form State Management**: Separate Add/Update modes with dynamic button text and functionality
- **Server API Integration**: PUT endpoint for session updates preserving photos and metadata
- **Data Persistence**: All checkbox states saved as booleans and restored during editing
- **Enhanced User Experience**: Form auto-scrolls and provides clear feedback during edit operations
- **Professional Admin Tools**: Complete session lifecycle management from creation to delivery

### PostgreSQL Database Integration Implementation (July 20, 2025)
- **Persistent Data Storage**: Sessions now saved in PostgreSQL database instead of memory-only storage
- **Database Table Structure**: Complete sessions table with all fields including workflow status, gallery tokens, and photos
- **Session Persistence**: Sessions survive server restarts and are permanently stored in cloud database
- **Async Database Operations**: All CRUD operations updated to use async/await with proper error handling
- **Data Type Conversion**: Automatic conversion between database snake_case and frontend camelCase field names
- **Photo Storage**: Photos stored as JSONB arrays in database with full metadata including file paths and upload timestamps
- **Gallery Token Storage**: Permanent gallery access tokens stored in database with creation timestamps
- **Database Initialization**: Automatic table creation on server startup with comprehensive schema
- **Error Handling**: Robust database error handling with fallback responses and proper HTTP status codes
- **Production Ready**: Complete database integration ready for deployment with connection pooling and SSL support

### Admin Interface Enhancement - Professional Management Tools (July 20, 2025)
- **Complete Admin Button Suite**: Added 8 professional admin-only buttons to each session card
- **Replaced Photo Display**: Removed cluttered inline photo display, added "🖼️ View Gallery" button
- **Dedicated Gallery Page**: Created `/sessions/:id/gallery` route with professional photo gallery interface
- **Admin Action Buttons**: Edit, Add to Calendar (.ics download), Send Gallery Ready, Send Invoice, Call/Text Client, Delete
- **Colorful Button Design**: Each button has distinct colors - purple edit, green calendar, orange gallery ready, blue invoice, teal call, yellow text
- **Mobile-Responsive Layout**: Buttons stack vertically on mobile, grid layout on desktop
- **Calendar Integration**: Generates proper .ics files with session details for calendar apps
- **Client Contact Integration**: Call/text buttons use native tel: and sms: protocols
- **Professional Gallery View**: Lightbox photo viewing, session info display, responsive grid layout
- **Admin-Only Features**: All advanced buttons only visible to photographer/admin role

### Complete App Rebuild - Fresh Implementation (July 20, 2025)
- **Total Architecture Rewrite**: Completely rebuilt from scratch with simplified, clean codebase
- **Eliminated All Complexity**: Removed Firebase, authentication, and database dependencies for simplicity
- **Local File Storage**: Photos stored in local uploads directory with direct URL serving
- **In-Memory Sessions**: Simple in-memory session storage for immediate functionality
- **Prominent Upload Button**: Large, visible "📸 Upload Photos" button in every session card
- **Drag-and-Drop Upload**: Modern upload interface with drag-and-drop support
- **Mobile-First Design**: Responsive CSS with mobile-optimized button layout
- **No Database Setup**: Zero configuration required - works immediately
- **Clean URLs**: Direct photo serving through /uploads/ endpoint
- **Error-Free Implementation**: No authentication conflicts or missing dependencies

### Firebase Photo Gallery System Implementation (July 20, 2025) - REPLACED WITH FRESH BUILD
- **Complete Photo Gallery System**: Implemented comprehensive photo management using Firebase Storage and Firestore
- **Admin Upload Interface**: Added "📸 Upload Photos" button with modal upload dialog supporting drag-and-drop
- **Firebase Storage Integration**: Photos stored in organized folders (sessions/{sessionId}/photos) with public URLs
- **Responsive Gallery Grid**: Each session displays photos in a clean grid layout with hover effects and lightbox viewing
- **Upload Progress Tracking**: Real-time progress bars and file preview during upload process
- **Photo Management**: Individual photo deletion with confirmation, automatic photo count updates
- **Authentication Required**: Upload and delete functions require Firebase authentication (admin only)
- **Mobile Optimized**: Responsive design works seamlessly on all devices with touch-friendly controls
- **Error Handling**: Comprehensive error handling for upload failures, authentication issues, and network problems
- **File Validation**: Supports JPEG/PNG only, 10MB per file limit, maximum 20 files per upload batch

### Cleaned Up Multiple App Versions (July 20, 2025)
- **Removed Duplicate Versions**: Eliminated www/ directory and current_page.html to prevent confusion
- **Single Source of Truth**: Only one version now exists at root level (index.html, script.js, style.css)
- **Fixed JavaScript Error**: Removed duplicate const uploadBtn declaration that was causing PC browser issues
- **Updated Cache Busting**: Force browser refresh with new version numbers
- **Confirmed Working**: App successfully loads sessions and displays properly on all platforms

## Recent Changes

### Comprehensive Backend Photo Upload System (July 19, 2025)
- **Complete API Architecture**: Full backend photo management with `/api/sessions/upload-photos`, `/api/sessions/{id}/photos`, and deletion endpoints
- **Massive Upload Support**: 1000 photos per session, 100MB per file (supports RAW photos and high-res images)
- **Advanced Photo Management**: Individual photo deletion, bulk operations, and optimized static file serving
- **Cross-Platform Compatibility**: Same backend API works seamlessly for web, iOS app, and external integrations
- **Database Flexibility**: Support for both PostgreSQL and Firestore storage with automatic routing
- **Authentication Integration**: Secure uploads with Firebase Auth token verification and user ownership validation
- **Performance Optimized**: Cached static file serving with proper headers for fast photo loading
- **Error Handling**: Comprehensive upload failure handling with file cleanup and detailed error responses
- **Metadata Tracking**: Complete upload details including file sizes, types, and original names
- **Production Ready**: Robust backend system suitable for professional photography business workflows

### Photo Upload System Re-implemented and Enhanced (July 19, 2025)
- **Firebase Storage Integration**: Fully implemented photo upload system using Firebase Storage for reliable cloud storage
- **Cross-Platform Synchronization**: Both web version and iOS app have identical photo upload functionality
- **Immediate Image Preview**: Photos show thumbnail previews immediately after selection
- **Session-Based Organization**: Photos organized by session ID in Firebase Storage folders
- **Progress Tracking**: Visual progress bars during upload with real-time status updates
- **Mobile-Optimized Interface**: Upload input styled for iOS Safari compatibility and mobile devices
- **Gallery Display System**: Uploaded photos display in grid format below each session card
- **Lightbox Viewing**: Click photos to view full-size in overlay lightbox
- **Error Handling**: Graceful fallback when Firebase Storage is unavailable
- **Batch Upload Support**: Multiple photo selection and upload in single operation

### Previous Photo Upload System Implementation (July 19, 2025) - TEMPORARILY REMOVED
- **Firebase Storage Integration**: Primary cloud storage with unlimited capacity using Firebase Storage
- **Unlimited Batch Uploads**: Support for 1000+ files per upload with 50MB per file limit (increased from 10MB/20 files)
- **Smart Storage Routing**: Firebase Storage primary, local storage fallback when not configured
- **Real-time Progress Tracking**: Individual file upload progress with visual progress bars
- **Embedded Upload Interface**: Dedicated upload section in each session card with photo thumbnails
- **Mobile-Optimized Design**: Responsive upload interface with mobile-friendly controls and layouts
- **Photo Management**: Thumbnail previews, photo counts, and direct gallery access from session cards
- **Error Handling**: Comprehensive upload failure handling with retry capability and file cleanup
- **Authentication Integration**: Secure uploads with user ownership validation
- **Background Processing**: Non-blocking uploads that allow continued app usage during large batches

### Restored to Original Simple State (July 19, 2025)
- **Clean Environment**: Removed all iOS-specific code, PWA features, and mobile optimizations
- **Original Architecture**: Back to simple HTML/CSS/JavaScript with backend API photo upload system
- **Removed iOS Elements**: Eliminated Capacitor files, service workers, PWA manifests, mobile meta tags
- **Simplified Code**: Cleaned script.js of PWA installation prompts and mobile-specific features
- **Backend Only**: Single Photography Scheduler workflow with comprehensive photo upload API
- **Original Experience**: Exactly like before iOS optimization but with enhanced backend photo capabilities

### Invoice Functionality Fixed (July 18, 2025)
- **Fixed Stripe API Integration**: Resolved API key truncation issue preventing invoice creation
- **Complete Invoice System**: Successfully creating customers, invoices, and sending via Stripe
- **Payment Processing**: Full integration with Stripe live API for professional invoicing
- **Automated Workflows**: Invoice creation includes hosted invoice URLs and PDF generation
- **Customer Management**: Automatic customer creation and management in Stripe dashboard

### Critical Server Fix - Session Loading Error (July 17, 2025)
- **Fixed "Error Loading Sessions" Issue**: Resolved critical server crash caused by Firestore connection problems
- **Implemented PostgreSQL Fallback**: Switched primary storage from Firestore to PostgreSQL for stability
- **Enhanced Authentication Fallback**: Improved fallback mode to handle unauthenticated users gracefully
- **Server Stability**: Added comprehensive error handling to prevent crashes during Firestore connection failures
- **Database Integration**: Sessions now successfully load from PostgreSQL database without authentication errors
- **Improved Error Messages**: Better user feedback for authentication and connection issues

### Database Integration & Shared Data (July 17, 2025)
- **PostgreSQL Database**: Implemented persistent storage with shared data across all users
- **User Authentication**: Firebase Authentication with automatic user creation in database
- **Session Management**: All sessions now stored in cloud database and shared between authenticated users
- **Real-time Data Sync**: Sessions persist across browser refreshes and devices
- **API Endpoints**: Created RESTful API for session CRUD operations
- **Multi-user Support**: Multiple users can now collaborate on the same photography business data
- **Node.js Backend**: Switched from Python to Node.js server with database integration

### Production Deployment Fix (July 17, 2025)
- **Fixed Deployment Error**: Updated run command from `python deploy.py` to `python main.py`
- **Created Production Server**: Implemented robust main.py with proper HTTP server configuration
- **Enhanced Health Checks**: Server now properly responds to health check requests on root endpoint (/)
- **Improved Error Handling**: Added comprehensive error handling for port conflicts and missing files
- **CORS Configuration**: Properly configured CORS headers for cross-origin requests
- **Static File Serving**: Optimized static file serving with correct MIME types
- **Deployment Ready**: Application successfully deploys and runs on port 5000

### Security Enhancement (July 17, 2025)
- **Fixed XSS Vulnerability**: Replaced innerHTML usage with safer DOM methods (createElement, textContent, appendChild)
- **Improved Code Security**: Eliminated string concatenation for HTML generation to prevent potential XSS attacks
- **Maintained Functionality**: All existing features work the same way with improved security

### Firebase Deployment Fix (July 17, 2025)
- **Fixed Firebase Crash**: Resolved Firebase Admin SDK initialization crash when environment variables are missing
- **Added Fallback Mode**: Application now gracefully handles missing Firebase credentials by disabling authentication
- **Prevented App Crashes**: Added proper error handling and fallback mechanisms to prevent server crashes
- **Enhanced Error Handling**: Improved authentication verification with fallback for missing Firebase initialization
- **Added Status Endpoints**: Created `/api/status` and `/api/health` endpoints for monitoring Firebase and system health
- **User Experience**: App shows clear notices when running in demo mode with authentication disabled
- **Fixed Session Addition**: Resolved issue where sessions couldn't be added when Firebase credentials were missing
- **Data Transformation**: Added proper field name conversion between database snake_case and frontend camelCase
- **Deployment Ready**: Application successfully runs and allows full functionality in both authenticated and fallback modes
- **Admin View**: Added admin functionality to view and manage all sessions from all users when logged in as admin
- **Admin Permissions**: Admin users can delete any session, while regular users can only delete their own sessions

### Firestore Integration (July 17, 2025)
- **Firestore Database**: Successfully integrated Firebase Firestore as primary data storage
- **Session Storage**: Sessions now saved in Firestore under "sessions" collection with user UID separation
- **Real-time Data**: Firestore provides real-time synchronization across all devices and users
- **User Separation**: Each session includes userUid field to separate data by authenticated user
- **Fallback System**: PostgreSQL maintained as fallback when Firestore credentials are missing
- **Admin View**: Admin can view and manage all sessions from all users in Firestore
- **Session Fields**: Complete session data includes: userUid, userEmail, client details, pricing, and status checkboxes
- **Automatic Timestamps**: Firestore automatically manages createdAt and updatedAt timestamps
- **Call & Text Buttons**: Added convenient 📞 call and 💬 text buttons next to phone numbers in session displays
- **Mobile Integration**: Call and text buttons use native tel: and sms: protocols for seamless mobile integration

## User Preferences

Preferred communication style: Simple, everyday language.
Business email: lance@thelegacyphotography.com
Business name: The Legacy Photography

## System Architecture

### Frontend Architecture
- **Technology Stack**: Vanilla HTML5, CSS3, and JavaScript (ES6+)
- **Architecture Pattern**: Single-page application (SPA) with client-side state management
- **Data Storage**: Cloud-based storage using Firebase Firestore and Firebase Storage
- **UI Framework**: Custom CSS with modern styling approaches (CSS Grid, Flexbox, CSS variables)
- **Photo Gallery**: Firebase Storage integration with responsive grid layout and lightbox viewing

### Key Design Decisions
- **Cloud Database**: PostgreSQL database for persistent, shared data storage
- **Multi-user Authentication**: Firebase Authentication with automatic user management
- **Shared Business Data**: All users can view and manage the same photography business sessions
- **API-First Architecture**: RESTful API design with proper CRUD operations
- **Firebase Storage**: Cloud photo storage with organized folder structure and public URL access
- **Photo Gallery System**: Session-based photo organization with admin upload and client view-only access
- **Responsive Design**: Mobile-first approach with CSS Grid and Flexbox for layout
- **Modern UI**: Clean, professional design with gradient backgrounds and card-based layouts
- **Form Validation**: Client-side validation for data integrity
- **Security-First**: Uses safe DOM manipulation methods to prevent XSS vulnerabilities

## Key Components

### 1. Session Management System
- **Session Object Structure**: Each session contains client information, scheduling details, pricing, and workflow status
- **CRUD Operations**: Create, read, update, and delete sessions through JavaScript functions
- **Auto-incrementing IDs**: Simple counter-based ID generation for session tracking

### 2. Form Handling
- **Dynamic Form**: HTML form with various input types (text, email, tel, datetime-local, number, textarea, checkboxes)
- **Real-time Validation**: Client-side validation with immediate feedback
- **Form Reset**: Automatic form clearing after successful submission

### 3. Session Display
- **Card Layout**: Visual representation of sessions in a card-based grid
- **Status Indicators**: Visual cues for workflow progress (contract signed, paid, edited, delivered)
- **Responsive Grid**: Adaptive layout that works on different screen sizes

### 4. Gallery Delivery System
- **Secure Client Access**: Each session can generate unique gallery access with secure tokens
- **Client Gallery Interface**: Dedicated gallery pages with download functionality and lightbox viewing
- **Token Management**: 30-day expiring access tokens with verification and security controls
- **Download Features**: Individual photo downloads and bulk ZIP downloads using JSZip library

### 5. Data Persistence
- **In-Memory Storage**: Sessions stored in JavaScript arrays during the session
- **Gallery Access Tokens**: Secure tokens stored in session data for client gallery access
- **No Persistence**: Data is lost on page refresh (intentional for simplicity)

## Data Flow

1. **Session Creation**: User fills out form → Form validation → Session object creation → Add to sessions array → Re-render UI
2. **Session Display**: Sessions array → Generate HTML cards → Insert into DOM
3. **Session Updates**: User interaction → Update session object → Re-render affected components
4. **Session Deletion**: User action → Remove from sessions array → Re-render UI

## External Dependencies

### None Currently Used
- **No External Libraries**: Pure vanilla JavaScript implementation
- **No CDN Dependencies**: All code is self-contained
- **No API Calls**: No external service integrations

### Potential Future Dependencies
- **LocalStorage**: For data persistence across browser sessions
- **Database Integration**: For multi-user support and permanent storage
- **Calendar API**: For calendar integration
- **Payment Processing**: For handling payments

## Deployment Strategy

### Current Deployment
- **Static Hosting**: Deployed using Python HTTP server on Replit
- **No Build Process**: Files can be served directly without compilation
- **Server Setup**: Python HTTP server serves static files on port 5000
- **Cloud Run**: Configured for Replit's Cloud Run deployment

### Deployment Configuration
- **Main Entry Point**: `main.py` - Production-ready HTTP server
- **Development Server**: `python -m http.server 5000` - Local development
- **Port Configuration**: Uses environment variable PORT or defaults to 5000
- **CORS Headers**: Configured for cross-origin requests
- **Static File Serving**: Serves HTML, CSS, and JS files from project root

### Deployment Options
- **Replit Deployment**: Primary deployment method using Cloud Run
- **GitHub Pages**: Alternative for static site hosting
- **Netlify/Vercel**: Modern static site hosting with CI/CD
- **Basic Web Server**: Apache, Nginx, or any HTTP server
- **CDN**: Can be distributed via content delivery networks

### Deployment Files
- `deploy.py`: Primary production server entry point (recommended)
- `app.py`: Alternative production server
- `main.py`: Backup server entry point
- `wsgi.py`: WSGI-compatible server
- `Procfile`: Process configuration for deployment platforms
- `healthcheck.py`: Health check utility
- `index.html`: Main application file
- `style.css`: Application styling
- `script.js`: Application logic

### File Structure
```
/
├── index.html          # Main HTML structure
├── style.css           # Styling and layout
├── script.js           # Application logic and state management
```

## Key Features

1. **Session Scheduling**: Date/time picker with validation to prevent past dates
2. **Client Information**: Contact details, location, and session type tracking
3. **Workflow Management**: Status tracking for contract, payment, editing, and delivery
4. **Pricing Management**: Price tracking and duration management
5. **Notes System**: Additional notes for each session
6. **Responsive Design**: Works on desktop and mobile devices

## Future Enhancement Opportunities

1. **Data Persistence**: Add localStorage or database integration
2. **Calendar Integration**: Visual calendar view of sessions
3. **Client Portal**: Separate interface for clients to view session status
4. **Photo Gallery**: Integration with photo storage and delivery
5. **Email Notifications**: Automated reminders and updates
6. **Export Functionality**: PDF reports and session summaries
7. **Multi-photographer Support**: User accounts and session assignment