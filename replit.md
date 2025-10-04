# Photography Management System

## Overview
A comprehensive Photography Management System that enables photographers to upload, manage, and share photos with clients. The system uses Cloudflare R2 for storage, supports large file uploads (up to 5GB per file), and generates optimized previews/thumbnails for efficient gallery viewing.

## Recent Changes (October 4, 2025)

### Fixed JavaScript Syntax Errors Preventing Session Display
**Problem**: Sessions were not displaying in the UI due to JavaScript "SyntaxError: Invalid or unexpected token" errors.

**Root Cause**: Emoji characters (📄, 📝, 🚨, 🔧, ✅, ❌, ✓, etc.) in JavaScript template literals and innerHTML assignments were causing syntax parsing errors.

**Resolution**: Systematically removed all emoji characters from:
- `public/secure-app.html` - Removed emojis from template literals, innerHTML assignments, and UI elements
- `public/booking-agreements-modal.js` - Cleaned up emojis in console.log statements and template strings
- `public/script.js` - Fixed emojis in payment status badges and console messages

**Additional Fixes**:
- Fixed server routing to properly serve HTML files from the `public` directory
- Added route for `/dev-auth.html` to enable development authentication
- Corrected path for `/secure-app.html` to serve from `public` folder

## Current Status
- ✅ Authentication system working correctly with dev user (dev@phototest.local)
- ✅ Backend API endpoints functioning properly
- ✅ Sessions being fetched from database successfully  
- ✅ All JavaScript syntax errors resolved
- ⚠️ Browser caching may require hard refresh to load updated JavaScript files

## Test Infrastructure
- **Development User**: dev@phototest.local (password: devtest123)
- **Test Session**: ID `6fc2ee67-9455-4115-bd43-1102569080e6` with sample client data
- **Authentication Flow**: `/dev-auth.html` → `/api/dev-auth/exchange` → `/secure-app.html`

## Project Architecture

### Frontend
- **Landing Page**: `/index.html` - Public-facing website
- **Secure App**: `/secure-app.html` - Authenticated photography management interface
- **Dev Auth**: `/dev-auth.html` - Development authentication page for testing

### Backend
- **Server**: Node.js with Express (`server.js`)
- **Database**: PostgreSQL with Drizzle ORM
- **Storage**: Cloudflare R2 for photo storage
- **Authentication**: Session-based with PostgreSQL session store

### Key Components
1. **Session Management**: Create, view, edit photography sessions
2. **File Upload**: Direct R2 uploads with progress tracking
3. **Gallery Manager**: Modal-based photo management interface
4. **Payment Processing**: Stripe integration for deposits and invoices
5. **Booking Agreements**: Contract management system

## User Preferences
- Clean, modern UI with dark theme
- Modal-based interactions for gallery management
- Session cards with "Upload Files" buttons for direct access
- No emoji characters in JavaScript code to prevent syntax errors

## Known Issues & Solutions
1. **Browser Cache**: If old JavaScript with emojis is cached, perform a hard refresh (Ctrl+Shift+R / Cmd+Shift+R)
2. **404 for native-auth.js**: Expected - this file is for mobile app integration only

## Development Workflow
1. Start server: `node server.js`
2. Navigate to `/dev-auth.html`
3. Click "Authenticate as Test User"
4. System redirects to `/secure-app.html` with active session
5. Sessions should display in the UI

## Next Steps
- Consider adding cache-busting query parameters to JavaScript files
- Implement automated testing to catch syntax errors early
- Add ESLint rule to prevent emoji usage in JavaScript strings