# Photography Session Scheduler

## Overview

This is a client-side web application for managing photography sessions. It's a simple, single-page application that allows photographers to schedule, track, and manage their photography sessions with clients. The application uses vanilla JavaScript, HTML, and CSS without any external frameworks or backend services.

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

### Backend-Focused Deployment (July 19, 2025)
- **Simplified Environment**: Temporarily removed iOS Build workflow to focus on backend deployment
- **Production Backend**: Photography Scheduler running solely on backend infrastructure
- **Clean Deployment**: Single workflow approach eliminates port conflicts and resource competition
- **Backend API Focus**: Complete photo management system with all endpoints operational
- **Future Mobile**: iOS capabilities preserved in project files for future reactivation when needed
- **Streamlined Development**: Simplified workflow for backend-first deployment strategy

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

## System Architecture

### Frontend Architecture
- **Technology Stack**: Vanilla HTML5, CSS3, and JavaScript (ES6+)
- **Architecture Pattern**: Single-page application (SPA) with client-side state management
- **Data Storage**: In-memory storage using JavaScript arrays and objects
- **UI Framework**: Custom CSS with modern styling approaches (CSS Grid, Flexbox, CSS variables)

### Key Design Decisions
- **Cloud Database**: PostgreSQL database for persistent, shared data storage
- **Multi-user Authentication**: Firebase Authentication with automatic user management
- **Shared Business Data**: All users can view and manage the same photography business sessions
- **API-First Architecture**: RESTful API design with proper CRUD operations
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

### 4. Data Persistence
- **In-Memory Storage**: Sessions stored in JavaScript arrays during the session
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