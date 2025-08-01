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

### Interface Preferences (Updated Feb 1, 2025)
- **Navigation Cleanup**: Removed AI Visual Editor and Storefront Builder from main navigation menu
- **Core Website Builder Preserved**: Keep website-builder.html functionality completely untouched
- **Streamlined Menu**: Focus on essential photography business tools only

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
- **Block-Based Visual Editor**: Advanced drag-and-drop system for building websites using predefined blocks (Hero, About, Image Grid, Text, CTA, Testimonial, Pricing, Blog, etc.) with integrated AI assistant for intelligent content generation and design optimization.
- **Dynamic Page Management**: System for creating, deleting, and managing custom pages with user-defined names and icons.
- **Comprehensive Theme/Template System**: Extensive library of 20+ professional photography website templates inspired by photography legends, with category filtering and one-click application. Now featuring 15 premium multi-page photographer website templates with specialized layouts for different photography niches (wedding, fashion, documentary, portrait, adventure, celebrity, maternity, commercial, street, boudoir, sports, food, architecture, pet, and travel photography).
- **Website Builder** (Current system as of Feb 1, 2025):
  - Template-based website creation with professional photography themes
  - Multi-page support (Home, About, Portfolio, Contact) with page switching
  - Visual canvas editor with inline content editing capabilities
  - Professional photography-focused templates (wedding, portrait, fashion, commercial)
  - Real-time preview functionality with new window display
  - Template selection and content customization system
  - Complete website preview and editing workflow
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
- **Advanced Workflow Automation** (Added Feb 1, 2025): Intelligent client communication system with automated triggers for contract reminders, payment follow-ups, session preparation guides, gallery delivery notifications, and feedback requests. Features customizable message templates (professional, friendly, luxury), native email/SMS integration, and comprehensive workflow logging. Accessible via ⚡ Automation button in session interface and dedicated advanced-workflow.html management dashboard.
- **AI-Powered Website Builder** (Added Feb 1, 2025): OpenAI integration for intelligent content generation, photo analysis, and smart design suggestions. Features include automated copywriting based on photography style and business info, AI photo tagging and categorization, intelligent layout recommendations, SEO-optimized content generation, testimonial creation, and conversion-focused pricing copy. Accessible through 🤖 AI Assistant panel in the advanced visual editor, providing subscribers with professional-grade AI features for rapid website development. Now includes mobile-friendly CapCut-style full-screen preview mode and integrated navigation access from the main hamburger menu (🎨 Website Builder).

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