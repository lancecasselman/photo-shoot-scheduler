# Photography Session Scheduler

## Overview

This is a client-side web application for managing photography sessions. It's a simple, single-page application that allows photographers to schedule, track, and manage their photography sessions with clients. The application uses vanilla JavaScript, HTML, and CSS without any external frameworks or backend services.

## Recent Changes

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

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Technology Stack**: Vanilla HTML5, CSS3, and JavaScript (ES6+)
- **Architecture Pattern**: Single-page application (SPA) with client-side state management
- **Data Storage**: In-memory storage using JavaScript arrays and objects
- **UI Framework**: Custom CSS with modern styling approaches (CSS Grid, Flexbox, CSS variables)

### Key Design Decisions
- **No Backend**: The application runs entirely in the browser to keep it simple and eliminate server dependencies
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