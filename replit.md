# Photography Management System

## Overview

A comprehensive photography business management platform designed for professional photographers. The system provides end-to-end workflow management including session scheduling, client management, photo galleries, invoicing, contract signing, and a premium website builder. The platform operates on a freemium model with basic features available to all users and premium features requiring subscription.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Static HTML/CSS/JavaScript**: Multi-page application with vanilla JavaScript for core functionality
- **Responsive Design**: Mobile-first approach using CSS Grid and Flexbox
- **Progressive Web App (PWA)**: Service worker implementation for offline capabilities and app-like experience
- **Component-Based UI**: Modular interface with tabbed navigation system for different business functions

### Backend Architecture
- **Node.js/Express Server**: Main application server handling API routes and business logic
- **Firebase Integration**: Client-side Firebase SDK for real-time authentication and storage
- **Session Management**: Express-session with PostgreSQL store for user sessions
- **File Upload System**: Multer middleware for handling photo uploads with Firebase Storage backend

### Authentication & Authorization
- **Firebase Authentication**: Primary authentication system with email/password and Google OAuth
- **Dual-Mode System**: Toggleable authentication guard for development vs production environments
- **Role-Based Access**: Admin panel with subscriber management capabilities
- **Premium Feature Gates**: Middleware to restrict access to premium features based on subscription status

### Database Architecture
- **PostgreSQL Primary Database**: Drizzle ORM for type-safe database operations and migrations
- **Firebase Firestore**: Real-time data synchronization for website builder configurations
- **Hybrid Storage Strategy**: Session data in PostgreSQL, real-time features in Firestore

### Website Builder System
- **Template-Based Architecture**: 20+ pre-built website templates with customizable themes
- **Multi-Page Support**: Home, About, Gallery, Contact pages with individual block management
- **Live Preview Engine**: Real-time iframe-based preview with responsive device simulation
- **Static Site Generation**: Premium feature for publishing static websites at `/site/:username`

### Payment & Subscription System
- **Stripe Integration**: Subscription management and payment processing
- **Freemium Model**: Basic features free, premium features behind paywall
- **Usage-Based Billing**: Storage limits and advanced features tied to subscription tiers

### File Storage Strategy
- **Firebase Storage**: Primary storage for photos, profile images, and website assets
- **AWS S3/R2 Integration**: Backup storage system with comprehensive file management
- **Image Upload Pipeline**: Multi-stage upload process with progress tracking and error handling

### Email & Notifications
- **SendGrid Integration**: Professional email delivery for client communications
- **Automated Workflows**: Welcome emails, billing notifications, and feature updates
- **Contract Management**: Electronic signature system with email notifications

### Mobile & Responsive Features
- **Capacitor Integration**: Native mobile app capabilities for iOS deployment
- **Camera Integration**: Direct photo upload from mobile devices
- **Offline Functionality**: Local storage and sync capabilities for core features

## External Dependencies

### Core Services
- **Firebase**: Authentication, Firestore database, Storage, Hosting, and Functions
- **PostgreSQL**: Primary relational database via Neon serverless
- **Stripe**: Payment processing and subscription management
- **SendGrid**: Email delivery service for client communications

### Development & Deployment
- **Drizzle ORM**: Type-safe database operations and schema management
- **Express.js**: Web application framework
- **Multer**: File upload handling middleware
- **Archiver**: ZIP file generation for photo delivery

### Frontend Libraries
- **JSZip**: Client-side ZIP file creation for gallery downloads
- **Uppy**: Advanced file upload interface with drag-and-drop
- **Google Fonts**: Typography system (Cormorant Garamond, Quicksand)

### Mobile Development
- **Capacitor**: Cross-platform mobile app development
- **iOS SDK**: Native iOS functionality integration

### Cloud Storage
- **AWS SDK**: S3 storage integration for backup and redundancy
- **Cloudflare R2**: Alternative storage solution with billing integration

### AI & Automation (Optional)
- **Google Cloud AI**: Potential AI services integration for photo analysis
- **Custom AI Services**: Modular AI service architecture for future enhancements