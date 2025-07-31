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
- **Block-Based Visual Editor**: Advanced drag-and-drop system for building websites using predefined blocks (Hero, About, Image Grid, Text, CTA, Testimonial, Pricing, Blog, etc.).
- **Dynamic Page Management**: System for creating, deleting, and managing custom pages with user-defined names and icons.
- **Comprehensive Theme/Template System**: Extensive library of 20+ professional photography website templates inspired by photography legends, with category filtering and one-click application. Now featuring 15 premium multi-page photographer website templates with specialized layouts for different photography niches (wedding, fashion, documentary, portrait, adventure, celebrity, maternity, commercial, street, boudoir, sports, food, architecture, pet, and travel photography).
- **Photo Management**: Unlimited photo upload system (any file size/quantity) with sequential processing, real-time progress tracking, individual photo deletion, and lightbox viewing.
- **Session Management**: CRUD operations for client sessions, including detailed information, workflow status tracking (contract signed, paid, edited, delivered) with real-time database updates.
- **Payment Processing**: Integration with Stripe for deposit invoices, full invoicing, and an optional tipping system.
- **Notification System**: Professional email (SendGrid) and SMS (Twilio) notifications for subscriber management, welcome messages, billing notices, and feature updates.
- **Calendar Integration**: iPhone Calendar integration for session scheduling, and a Sunrise/Sunset Photography Calendar for optimal shoot planning.
- **Authentication**: Multi-user authentication system using Firebase Authentication (v8 legacy SDK) with Google Sign-in and Email/Password options, integrated with PostgreSQL for user management.
- **Onboarding Wizard**: A 6-step professional onboarding process for new users covering business info, branding, Stripe setup, and session types.
- **Core Features**: Session scheduling, client information tracking, workflow management, pricing, and notes system.

### System Design Choices
- **Cloud Database**: PostgreSQL as the primary persistent data storage, with Firebase Firestore as an alternative/fallback for certain data.
- **API-First Architecture**: RESTful API design for all core functionalities, with secure endpoints protected by authentication middleware.
- **Firebase Storage**: Utilized for cloud photo storage, organized by session ID.
- **Performance Optimization**: Focus on zero page reloads for real-time updates, optimized large file uploads, and robust error handling.
- **Security**: Measures include secure DOM manipulation (preventing XSS), authentication for all features, and secure token-based access for galleries.
- **Development Mode**: Toggleable `DEV_MODE` for easy testing without authentication barriers.

## External Dependencies

- **PostgreSQL**: Primary database for persistent data storage.
- **Firebase (v8 Legacy SDK)**: Used for user authentication (Authentication), real-time data storage (Firestore), and cloud file storage (Storage).
- **Stripe**: For payment processing, including invoicing, deposits, and optional tipping.
- **SendGrid**: For professional email notifications and communications.
- **Twilio**: For SMS notifications and alerts.
- **JSZip**: For bulk ZIP downloads of photo galleries.
- **SunriseSunset.io API**: For fetching golden hour, blue hour, and solar timing data.
- **OpenStreetMap Nominatim**: For geocoding and location search suggestions in the Sunrise/Sunset calendar.
- **Google Fonts**: For professional typography in the UI.
- **Capacitor**: Planned for building native iOS/Android mobile applications.
- **Electron**: Planned for building desktop applications.