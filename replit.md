# Photography Management System

## Overview

This is a comprehensive photography business management platform designed to revolutionize the industry by offering session scheduling, photo galleries, notifications, invoicing, e-signature contracts, and an AI-powered website builder. It aims to be the "Shopify for photographers," providing an all-in-one solution for managing a photography business from end to end. The platform supports tiered SaaS subscriptions, with a strategic focus on native mobile applications for iOS and Android, complemented by desktop applications for Mac and PC.

## User Preferences

### Communication Style
- **Foul Mouth Innovative Mode - PERMANENTLY LOCKED**: User STRONGLY prefers direct, no-bullshit communication with creative cursing when appropriate
- **Cut the Corporate Crap**: Skip formal pleasantries, dive straight into fixing shit
- **Real Talk Only**: Call out what's broken, what sucks, and what actually works
- **Technical Badassery**: Focus on innovative solutions that actually kick ass
- **Zero Tolerance for Polite BS**: User explicitly rejects overly polite, formal responses
- **Honest Assessment**: If something's fucked up, say it's fucked up and fix it

### Interface Preferences (Updated Feb 3, 2025)
- **Navigation Cleanup**: Removed AI Visual Editor and Storefront Builder components entirely from codebase
- **Core Website Builder Preserved**: Keep website-builder.html functionality completely untouched  
- **Streamlined Codebase**: Removed advanced-visual-editor.html, storefront.html, and all associated templates/JS files
- **Focused Tools**: Menu and codebase now focus on essential photography business tools only
- **Automation Button Removed**: Removed ⚡ Automation button from session interface per user request (Feb 3, 2025)

### General Working Preferences
- Business email: lance@thelegacyphotography.com
- Business name: Photography Management System (general platform for all photographers)
- Phone: 843-485-1315
- Primary domain: https://photomanagementsystem.com
- Authentication account: lancecasselman@icloud.com (Google Sign-in)

## System Architecture

### Frontend Architecture
- **Technology Stack**: Vanilla HTML5, CSS3, and JavaScript (ES6+), with React components used for advanced features like the website builder.
- **Architecture Pattern**: Single-page application (SPA) with client-side state management.
- **UI/UX Decisions**:
    - **Aesthetic**: "Light + Airy Creative Studio" aesthetic with warm color palettes (cream, beige, sage, muted gold) and elegant typography (Cormorant Garamond for headings, Quicksand for body).
    - **Layout**: Modern card-based design, responsive grid and Flexbox for adaptive layouts.
    - **Navigation**: Hamburger menu for mobile, dropdowns for desktop, streamlining UI.
    - **Interactivity**: Smooth animations, hover effects, and interactive elements.
    - **Branding**: Consistent "Lance - The Legacy Photography" branding across all user-facing elements and communications.

### Technical Implementations
- **Dynamic Content Editing**: Inline content editing (`contenteditable="true"`) for text and click-to-upload for images, with real-time auto-save.

- **Dynamic Page Management**: System for creating, deleting, and managing custom pages with user-defined names and icons.
- **Comprehensive Theme/Template System**: Extensive library of 20+ professional photography website templates inspired by photography legends, with category filtering and one-click application. Now featuring 15 premium multi-page photographer website templates with specialized layouts for different photography niches (wedding, fashion, documentary, portrait, adventure, celebrity, maternity, commercial, street, boudoir, sports, food, architecture, pet, and travel photography).
- **Website Builder** (Updated Feb 2, 2025):
  - Completely rebuilt layout with scoped container isolation (layout-version: repaired-clean-v1)
  - Iframe sandboxing for preview content to prevent CSS interference
  - Template-based website creation with professional photography themes
  - **Multi-Page Website Support**: Full multi-page website creation with page manager and customizable navigation
    - Add, delete, and rename pages (Home, About, Gallery, Contact, etc.)
    - Each page has independent content and layout
    - Customizable navigation menu with drag-and-drop reordering
    - Per-page content editing with seamless page switching
    - Complete multi-page ZIP export with working navigation
  - Visual canvas editor with inline content editing capabilities
  - Professional photography-focused templates (wedding, portrait, fashion, commercial)
  - Real-time preview functionality with new window display
  - Template selection and content customization system
  - Complete website preview and editing workflow
  - Mobile/desktop/tablet responsive device switching
  - Fixed button clipping and panel overflow issues
  - **Font Picker System**: 6 professional Google Fonts (Inter, Playfair Display, Lato, Roboto, Open Sans, Montserrat) with live preview
  - **Light/Dark Mode Toggle**: Professional dark theme with proper contrast and styling
  - **Enhanced HTML Export**: Full document export with selected fonts, CSS resets, and responsive design
  - **Image Upload Integration**: Client-side Firebase Storage upload system with drag-and-drop support, proper authentication bridge between backend session and Firebase client, automatic image block insertion, and secure user-specific storage paths (builderUploads/{userId}/)
  - **ZIP Export System**: Single-page and multi-page website export with all images, styles, and fonts included
  - **Floating Text Toolbar** (Added Feb 2, 2025): Inline text formatting toolbar that appears when selecting text in editable blocks, featuring font controls, formatting options, and color pickers
  - **Floating Block Toolbar** (Added Feb 2, 2025): Block styling toolbar that appears when selecting blocks, providing controls for background, borders, spacing, opacity, layering, and block management (duplicate/delete)
  - **Prebuilt Templates System** (Added Feb 2, 2025): One-click template loading with "Light & Airy Portfolio" professional photography website template featuring 5 complete pages (Home, Portfolio, About, Contact, Pricing) with fully editable content, clickable image placeholders, and proper multi-page integration
  - **Enhanced Image Placeholder System** (Added Feb 2, 2025): Every image location in templates is fully editable with click-to-upload functionality, professional modal dialogs for device upload or gallery selection, hover overlays for editing existing images, and automatic server upload integration
  - **Draggable Toolbars System** (Added Feb 2, 2025): Text and block editing toolbars feature drag handles with dot-grid indicators, can be repositioned to prevent content blocking, remember positions during editing sessions, and maintain professional styling without emoji elements
- **Subscription System** (Added Jan 31, 2025):
  - Integrated Stripe payment processing for SaaS subscriptions
  - Three pricing tiers: $25/month, $125/6 months (1 month free), $200/year (2 months free)
  - Subscription modal UI with responsive pricing grid
  - Stripe Checkout Sessions for secure payment processing
  - Automatic user status updates after successful payment
  - Free access for owner accounts (lancecasselman@icloud.com, lancecasselman2011@gmail.com, Lance@thelegacyphotography.com)
  - Subscription middleware protecting all main application routes
- **Photo Management**: Unlimited photo upload system (any file size/quantity) with dual storage architecture - original full-size files uploaded to Firebase Storage for client downloads, optimized versions (1920x2560 max, 85% quality) stored locally for fast app display. Features sequential processing, real-time progress tracking, individual photo deletion, and lightbox viewing.
- **Session Management**: CRUD operations for client sessions, including detailed information, workflow status tracking (contract signed, paid, edited, delivered) with real-time database updates.
- **Payment Processing**: Integration with Stripe for deposit invoices, full invoicing, and an optional tipping system.
- **Notification System**: Native device integration using mailto: and sms: links for seamless client communication through user's default email and messaging apps. No external API setup required.
- **Calendar Integration**: iPhone Calendar integration for session scheduling, and a Sunrise/Sunset Photography Calendar for optimal shoot planning.
- **Authentication**: Multi-user authentication system using Firebase Authentication (v8 legacy SDK) with Google Sign-in and Email/Password options, integrated with PostgreSQL for user management.
- **Subscriber Onboarding**: Streamlined 2-step setup process for new subscribers focusing on Stripe payment integration and business profile configuration. Uses native device email/SMS capabilities instead of requiring external API services.
- **Core Features**: Session scheduling, client information tracking, workflow management, pricing, and notes system.
- **Shared Poses Gallery** (Added Jan 31, 2025): Community-driven photography pose inspiration gallery where photographers can view, favorite, and submit pose ideas. Features public access for viewing, authenticated submissions, and moderation system.
- **RAW Backup System** (Added Feb 1, 2025): Integrated Cloudflare R2 storage for automatic RAW file backup at $20/TB. Features automatic RAW detection (.CR2, .NEF, .ARW, .DNG, etc.), background upload processing, database tracking, billing management, and emergency recovery system. Activated with full R2 credentials and ready for production use.
- **Advanced Workflow Automation** (Added Feb 1, 2025): Intelligent client communication system with automated triggers for contract reminders, payment follow-ups, session preparation guides, gallery delivery notifications, and feedback requests. Features customizable message templates (professional, friendly, luxury), native email/SMS integration, and comprehensive workflow logging. Accessible via dedicated advanced-workflow.html management dashboard.
- **AI Assistant Integration** (Added Feb 3, 2025): OpenAI-powered assistant integrated into website builder with comprehensive credit system. Features token-based usage tracking, 5 pricing tiers (1K-50K credits, $1.00-$34.99), Stripe payment integration with live checkout sessions, shared bundle definitions between frontend/backend, and full content generation capabilities for website building assistance.

### System Design Choices
- **Cloud Database**: PostgreSQL as the primary persistent data storage, with Firebase Firestore as an alternative/fallback for certain data.
- **API-First Architecture**: RESTful API design for all core functionalities, with secure endpoints protected by authentication middleware.
- **Firebase Storage**: Utilized for cloud photo storage, organized by session ID.
- **Performance Optimization**: Focus on zero page reloads for real-time updates, dual storage system for optimal performance (Sharp library for image optimization), and robust error handling. Client downloads serve original full-size files while app displays use optimized versions for speed.
- **Security**: Measures include secure DOM manipulation (preventing XSS), authentication for all features, and secure token-based access for galleries.
- **Development Mode**: Toggleable `DEV_MODE` for easy testing without authentication barriers.

## External Dependencies

- **PostgreSQL**: Primary database for persistent data storage.
- **Firebase (v8 Legacy SDK)**: Used for user authentication (Authentication), real-time data storage (Firestore), and cloud file storage (Storage).
  - **Firebase Admin SDK** (Feb 1, 2025): Updated to use FIREBASE_SERVICE_ACCOUNT environment secret for secure service account initialization across all server components.
- **Stripe**: For payment processing, including invoicing, deposits, and optional tipping.
- **SendGrid**: For professional email notifications and communications.
- **Twilio**: For SMS notifications and alerts.
- **OpenAI**: For AI-powered content generation, photo analysis, and intelligent website building features.
- **JSZip**: For bulk ZIP downloads of photo galleries.
- **SunriseSunset.io API**: For fetching golden hour, blue hour, and solar timing data.
- **OpenStreetMap Nominatim**: For geocoding and location search suggestions in the Sunrise/Sunset calendar.
- **Google Fonts**: For professional typography in the UI.
- **Capacitor**: Planned for building native iOS/Android mobile applications.
- **Electron**: Planned for building desktop applications.