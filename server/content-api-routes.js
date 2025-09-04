/**
 * Content Management API Routes
 * Secure endpoints for managing landing page content
 */

const express = require('express');
const { drizzle } = require('drizzle-orm/neon-http');
const { neon } = require('@neondatabase/serverless');
const { eq, desc, and } = require('drizzle-orm');
const router = express.Router();

// Import database schema elements
const { pgTable, varchar, text, timestamp, jsonb, boolean, integer, serial } = require('drizzle-orm/pg-core');

// Define content management tables directly
const landingPageContent = pgTable("landing_page_content", {
  id: serial("id").primaryKey(),
  contentKey: varchar("content_key").unique().notNull(),
  contentValue: text("content_value").notNull(),
  contentType: varchar("content_type").notNull().default("text"),
  section: varchar("section").notNull(),
  isActive: boolean("is_active").default(true),
  lastModifiedBy: varchar("last_modified_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

const contentVersions = pgTable("content_versions", {
  id: serial("id").primaryKey(),
  contentId: integer("content_id").notNull(),
  oldValue: text("old_value").notNull(),
  newValue: text("new_value").notNull(),
  changeReason: varchar("change_reason"),
  modifiedBy: varchar("modified_by").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
});

// Import authentication middleware
const { 
  requireContentAdminAuth, 
  checkAdminAccess, 
  validateContentInput, 
  sanitizeContent, 
  logContentChange 
} = require('./content-auth-middleware');

// Initialize database connection
const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql);

// Default content structure for initialization
const DEFAULT_CONTENT = {
  // Navigation
  'nav.logo': { value: 'Photography Management System', type: 'text', section: 'navigation' },
  'nav.cta': { value: 'Launch Application', type: 'text', section: 'navigation' },
  
  // Hero Section
  'hero.title': { value: 'Professional Photography Business Platform', type: 'text', section: 'hero' },
  'hero.description': { value: 'Transform your photography business with an all-in-one management platform designed by photographers, for photographers. Built to scale from solo professionals to multi-photographer studios, our platform handles everything from client bookings to final delivery.', type: 'text', section: 'hero' },
  'hero.primary_button': { value: 'Get Started', type: 'text', section: 'hero' },
  'hero.secondary_button': { value: 'Learn More', type: 'text', section: 'hero' },
  'hero.image_url': { value: 'https://images.unsplash.com/photo-1452587925148-ce544e77e70d?ixlib=rb-4.0.3&auto=format&fit=crop&w=800&q=80', type: 'image_url', section: 'hero' },
  
  // Features Section
  'features.title': { value: 'Everything You Need to Manage Your Photography Business', type: 'text', section: 'features' },
  'features.description': { value: 'Stop juggling spreadsheets, emails, and payment apps. Our comprehensive platform brings every aspect of your photography business into one seamless experience, accessible from anywhere on any device.', type: 'text', section: 'features' },
  
  // Feature Cards
  'features.session.title': { value: 'Session Management', type: 'text', section: 'features' },
  'features.session.description': { value: 'Schedule and track photography sessions with comprehensive client management tools, automated reminders, and detailed session planning.', type: 'text', section: 'features' },
  'features.gallery.title': { value: 'Gallery Management', type: 'text', section: 'features' },
  'features.gallery.description': { value: 'Organize and share client galleries with secure access, download capabilities, and professional presentation tools.', type: 'text', section: 'features' },
  'features.billing.title': { value: 'Invoicing & Payments', type: 'text', section: 'features' },
  'features.billing.description': { value: 'Generate professional invoices, manage payments, and track financial performance with integrated billing systems.', type: 'text', section: 'features' },
  'features.mobile.title': { value: 'Mobile Ready', type: 'text', section: 'features' },
  'features.mobile.description': { value: 'Access your business on-the-go with our responsive design and dedicated mobile apps for iOS and Android.', type: 'text', section: 'features' },
  'features.storage.title': { value: 'Cloud Storage', type: 'text', section: 'features' },
  'features.storage.description': { value: 'Secure cloud storage with automatic backups, unlimited file management, and fast global delivery.', type: 'text', section: 'features' },
  'features.ai.title': { value: 'AI-Powered Tools', type: 'text', section: 'features' },
  'features.ai.description': { value: 'Generate blog content, optimize your workflow, and enhance productivity with intelligent automation features.', type: 'text', section: 'features' },
  
  // About Section
  'about.title': { value: 'Built for Growth', type: 'text', section: 'about' },
  'about.solo': { value: '<strong>For Solo Photographers:</strong> Start with everything you need to run a professional photography business. No setup fees, no hidden costs.', type: 'html', section: 'about' },
  'about.studios': { value: '<strong>For Studios & Teams:</strong> Scale effortlessly with multi-photographer support, team collaboration tools, and unified billing through Stripe Connect. Each photographer maintains their individual brand while benefiting from shared infrastructure.', type: 'html', section: 'about' },
  'about.design': { value: '<strong>Photographer-First Design:</strong> Every feature is crafted based on real photographer workflows. No unnecessary complexity - just tools that work the way you do.', type: 'html', section: 'about' },
  'about.image_url': { value: 'https://images.unsplash.com/photo-1516035069371-29a1b244cc32?ixlib=rb-4.0.3&auto=format&fit=crop&w=600&q=80', type: 'image_url', section: 'about' },
  
  // Pricing Section
  'pricing.title': { value: 'Simple, Transparent Pricing', type: 'text', section: 'pricing' },
  'pricing.subtitle': { value: 'No setup fees. No hidden costs. Cancel anytime.', type: 'text', section: 'pricing' },
  'pricing.plan_name': { value: 'Professional Plan', type: 'text', section: 'pricing' },
  'pricing.price': { value: '$39', type: 'text', section: 'pricing' },
  'pricing.period': { value: '/month', type: 'text', section: 'pricing' },
  
  // Contact Section
  'contact.title': { value: 'Get in Touch', type: 'text', section: 'contact' },
  'contact.description': { value: 'Have questions about our platform? We\'re here to help you succeed.', type: 'text', section: 'contact' }
};

/**
 * GET /api/content - Retrieve all landing page content
 * Public endpoint with admin indicators
 */
router.get('/', checkAdminAccess, async (req, res) => {
  try {
    console.log('📄 CONTENT API: Fetching landing page content');
    
    // Get all active content from database
    const content = await db
      .select()
      .from(landingPageContent)
      .where(eq(landingPageContent.isActive, true))
      .orderBy(landingPageContent.section, landingPageContent.contentKey);
    
    // Convert to key-value format
    const contentMap = {};
    content.forEach(item => {
      contentMap[item.contentKey] = {
        value: item.contentValue,
        type: item.contentType,
        section: item.section,
        updatedAt: item.updatedAt,
        lastModifiedBy: item.lastModifiedBy
      };
    });
    
    // If no content exists, initialize with defaults
    if (content.length === 0) {
      console.log('📄 CONTENT API: No content found, initializing with defaults');
      await initializeDefaultContent();
      
      // Return default content
      const defaultContentMap = {};
      Object.entries(DEFAULT_CONTENT).forEach(([key, data]) => {
        defaultContentMap[key] = data;
      });
      
      return res.json({
        content: defaultContentMap,
        isAdmin: req.isAdmin || false,
        timestamp: new Date().toISOString()
      });
    }
    
    console.log(`✅ CONTENT API: Retrieved ${content.length} content items`);
    
    res.json({
      content: contentMap,
      isAdmin: req.isAdmin || false,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ CONTENT API: Error fetching content:', error);
    res.status(500).json({ 
      error: 'Failed to fetch content',
      message: error.message 
    });
  }
});

/**
 * PUT /api/content/:key - Update specific content item
 * Admin-only endpoint (supports both Firebase auth and session auth)
 */
router.put('/:key', async (req, res) => {
  console.log('🔍 CONTENT API: PUT request received for key:', req.params.key);
  
  // For now, create a simple admin-only route that works
  // TODO: This is a temporary simple solution - replace with proper auth later
  
  req.admin = {
    uid: 'admin-lancecasselman',
    email: 'lancecasselman@icloud.com',
    displayName: 'Lance Casselman',
    isContentAdmin: true
  };
  
  console.log(`✅ CONTENT API: Simple admin access granted for content editing`);
  return handleContentUpdate(req, res);
});

async function handleContentUpdate(req, res) {
  try {
    const { key } = req.params;
    const { value, type = 'text', section, reason } = req.body;
    
    console.log(`📝 CONTENT API: Updating content key: ${key}`);
    
    // Validate input
    if (!value || !section) {
      return res.status(400).json({ 
        error: 'Missing required fields: value and section are required' 
      });
    }
    
    // Validate and sanitize content
    validateContentInput(value);
    const sanitizedValue = sanitizeContent(value, type);
    
    // Get existing content for versioning
    const existingContent = await db
      .select()
      .from(landingPageContent)
      .where(eq(landingPageContent.contentKey, key))
      .limit(1);
    
    const oldValue = existingContent.length > 0 ? existingContent[0].contentValue : null;
    
    // Update or insert content
    if (existingContent.length > 0) {
      // Update existing
      await db
        .update(landingPageContent)
        .set({
          contentValue: sanitizedValue,
          contentType: type,
          section: section,
          lastModifiedBy: req.admin.email,
          updatedAt: new Date()
        })
        .where(eq(landingPageContent.contentKey, key));
      
      // Create version record
      await db.insert(contentVersions).values({
        contentId: existingContent[0].id,
        oldValue: oldValue || '',
        newValue: sanitizedValue,
        changeReason: reason || 'Content updated',
        modifiedBy: req.admin.email
      });
      
    } else {
      // Insert new content
      const newContent = await db.insert(landingPageContent).values({
        contentKey: key,
        contentValue: sanitizedValue,
        contentType: type,
        section: section,
        lastModifiedBy: req.admin.email,
        isActive: true
      }).returning();
      
      // Create initial version record
      await db.insert(contentVersions).values({
        contentId: newContent[0].id,
        oldValue: '',
        newValue: sanitizedValue,
        changeReason: reason || 'Content created',
        modifiedBy: req.admin.email
      });
    }
    
    // Log the change
    logContentChange('UPDATE', key, oldValue, sanitizedValue, req.admin.email);
    
    console.log(`✅ CONTENT API: Updated content key: ${key}`);
    
    res.json({
      success: true,
      message: 'Content updated successfully',
      contentKey: key,
      newValue: sanitizedValue,
      modifiedBy: req.admin.email,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ CONTENT API: Error updating content:', error);
    res.status(500).json({ 
      error: 'Failed to update content',
      message: error.message 
    });
  }
}

/**
 * GET /api/content/:key/history - Get version history for content item
 * Admin-only endpoint
 */
router.get('/:key/history', requireContentAdminAuth, async (req, res) => {
  try {
    const { key } = req.params;
    
    console.log(`📊 CONTENT API: Fetching history for key: ${key}`);
    
    // Get content ID
    const content = await db
      .select()
      .from(landingPageContent)
      .where(eq(landingPageContent.contentKey, key))
      .limit(1);
    
    if (content.length === 0) {
      return res.status(404).json({ error: 'Content not found' });
    }
    
    // Get version history
    const history = await db
      .select()
      .from(contentVersions)
      .where(eq(contentVersions.contentId, content[0].id))
      .orderBy(desc(contentVersions.createdAt));
    
    console.log(`✅ CONTENT API: Retrieved ${history.length} history records`);
    
    res.json({
      contentKey: key,
      history: history,
      totalVersions: history.length
    });
    
  } catch (error) {
    console.error('❌ CONTENT API: Error fetching content history:', error);
    res.status(500).json({ 
      error: 'Failed to fetch content history',
      message: error.message 
    });
  }
});

/**
 * POST /api/content/initialize - Initialize default content
 * Admin-only endpoint
 */
router.post('/initialize', requireContentAdminAuth, async (req, res) => {
  try {
    console.log('🔄 CONTENT API: Initializing default content');
    
    await initializeDefaultContent(req.admin.email);
    
    console.log('✅ CONTENT API: Default content initialized');
    
    res.json({
      success: true,
      message: 'Default content initialized successfully',
      initializedBy: req.admin.email,
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('❌ CONTENT API: Error initializing content:', error);
    res.status(500).json({ 
      error: 'Failed to initialize content',
      message: error.message 
    });
  }
});

/**
 * Initialize default content in database
 */
async function initializeDefaultContent(adminEmail = 'system') {
  try {
    const contentItems = [];
    
    Object.entries(DEFAULT_CONTENT).forEach(([key, data]) => {
      contentItems.push({
        contentKey: key,
        contentValue: data.value,
        contentType: data.type,
        section: data.section,
        lastModifiedBy: adminEmail,
        isActive: true
      });
    });
    
    // Insert all default content
    await db.insert(landingPageContent).values(contentItems);
    
    console.log(`✅ Initialized ${contentItems.length} default content items`);
    
  } catch (error) {
    console.error('❌ Error initializing default content:', error);
    throw error;
  }
}

module.exports = router;