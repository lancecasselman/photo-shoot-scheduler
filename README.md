# Photography Management Platform

A comprehensive AI-powered photography business management platform designed to streamline session tracking, client interactions, and advanced file management workflows for professional photographers.

## 🚀 Features

### Core Management
- **Session Tracking**: Chronological session management with smart sorting
- **Client Portal**: Secure client access to galleries and contracts
- **File Management**: Advanced photo organization with R2 cloud storage
- **Contract System**: Digital contract generation and e-signature integration
- **Payment Processing**: Stripe integration for deposits and invoicing

### Storage & Backup
- **Cloudflare R2 Integration**: Primary cloud storage with 1TB capacity
- **RAW File Support**: Complete RAW file backup system
- **Storage Analytics**: Real-time storage tracking and quota management
- **Unified Deletion**: Complete file cleanup with zero orphaned records

### Business Features
- **Subscription Management**: Freemium model with Stripe billing
- **Email Automation**: SendGrid integration for client communications
- **Mobile Support**: Capacitor-enabled mobile app capabilities
- **Analytics Dashboard**: Comprehensive storage and usage insights

## 🛠️ Technology Stack

### Frontend
- **HTML/CSS/JavaScript**: Responsive multi-page application
- **PWA Capabilities**: Service worker for offline functionality
- **Mobile-First Design**: CSS Grid and Flexbox layouts

### Backend
- **Node.js/Express**: RESTful API server
- **PostgreSQL**: Primary database with Drizzle ORM
- **Firebase**: Authentication and real-time features
- **Cloudflare R2**: Primary cloud storage solution

### External Services
- **Stripe**: Payment processing and subscriptions
- **SendGrid**: Professional email delivery
- **Firebase**: Authentication and Firestore
- **Neon**: Serverless PostgreSQL hosting

## 📦 Installation

### Prerequisites
- Node.js 18+ 
- PostgreSQL database
- Firebase project
- Cloudflare R2 bucket
- Stripe account

### Environment Setup
```bash
# Clone the repository
git clone https://github.com/lancecasselman/photography-management-platform.git
cd photography-management-platform

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Configure your API keys and database URLs in .env

# Initialize database
npm run db:push

# Start the server
npm start
```

### Required Environment Variables
```env
# Database
DATABASE_URL=your_postgresql_connection_string

# Firebase
FIREBASE_SERVICE_ACCOUNT=your_firebase_credentials_json

# Cloudflare R2
R2_ACCOUNT_ID=your_cloudflare_account_id
R2_ACCESS_KEY=your_r2_access_key
R2_SECRET_KEY=your_r2_secret_key
R2_BUCKET_NAME=your_bucket_name

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLIC_KEY=your_stripe_public_key

# SendGrid
SENDGRID_API_KEY=your_sendgrid_api_key

# OpenAI (optional)
OPENAI_API_KEY=your_openai_api_key
```

## 🚀 Deployment

### Replit Deployment
This application is optimized for Replit deployment with:
- Automated database initialization
- Environment variable management
- Zero-config deployment process

### Production Considerations
- Configure proper SSL certificates
- Set up monitoring and logging
- Implement backup strategies
- Configure CDN for static assets

## 📊 Architecture Overview

### Database Schema
- **Sessions**: Photography session management
- **Session Files**: File metadata and tracking
- **Storage Quotas**: User storage limits and billing
- **Contracts**: Digital contract management

### File Storage Strategy
- **Local Uploads**: Immediate file access
- **R2 Backup**: Long-term cloud storage
- **Metadata Tracking**: Original filename preservation
- **Smart Cleanup**: Unified deletion system

### Security Features
- **Firebase Authentication**: Secure user management
- **Session-based Authorization**: Protected API endpoints
- **File Access Control**: User-scoped file permissions
- **Input Validation**: Comprehensive request sanitization

## 🔧 API Documentation

### Core Endpoints
- `GET /api/sessions` - List user sessions
- `POST /api/sessions` - Create new session
- `GET /api/sessions/:id/files` - List session files
- `DELETE /api/sessions/:id/files/:type/:filename` - Delete file

### Storage Management
- `GET /api/global-storage-stats` - Platform storage overview
- `GET /api/storage/summary` - User storage summary
- `POST /api/storage/purchase` - Purchase storage upgrade

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👤 Author

**Lance Casselman**
- Email: lancecasselman@icloud.com
- GitHub: [@lancecasselman](https://github.com/lancecasselman)

## 🙏 Acknowledgments

- Built with Replit for rapid development and deployment
- Powered by modern web technologies and cloud services
- Designed for professional photographers and creative businesses

## 📈 Project Status

- ✅ Core session management
- ✅ File storage with R2 integration
- ✅ Payment processing with Stripe
- ✅ Contract management system
- ✅ Storage quota and billing
- ✅ Unified deletion system
- 🔄 Mobile app development
- 🔄 Advanced analytics features

---

*This platform is actively maintained and continuously improved based on user feedback and business requirements.*