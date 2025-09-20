import {
  pgTable,
  text,
  varchar,
  timestamp,
  jsonb,
  index,
  boolean,
  integer,
  decimal,
  serial,
  foreignKey,
  unique,
  check,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  username: varchar("username").unique(),
  displayName: varchar("display_name"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  businessName: varchar("business_name"),
  businessType: varchar("business_type"),
  phoneNumber: varchar("phone_number"),
  streetAddress: varchar("street_address"),
  city: varchar("city"),
  state: varchar("state"),
  zipCode: varchar("zip_code"),
  onboardingCompleted: boolean("onboarding_completed").default(false),
  onboardingDate: timestamp("onboarding_date"),
  subscriptionStatus: varchar("subscription_status").default("trial"),
  subscriptionPlan: varchar("subscription_plan").default("basic"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  // 3-Day Trial System Fields
  trialStartDate: timestamp("trial_start_date"),
  trialEndDate: timestamp("trial_end_date"),
  trialUsed: boolean("trial_used").default(false),
  trialExpiredNotificationSent: boolean("trial_expired_notification_sent").default(false),
  accessRestricted: boolean("access_restricted").default(false),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  stripeConnectAccountId: varchar("stripe_connect_account_id"),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete").default(false),
  platformFeePercentage: decimal("platform_fee_percentage", { precision: 5, scale: 2 }).default("0.00"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
  subdomain: varchar("subdomain").unique(),
});

// Published websites table for hosting photographer sites
export const publishedWebsites = pgTable("published_websites", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  subdomain: varchar("subdomain").notNull().unique(),
  customDomain: varchar("custom_domain").unique(),
  websiteData: jsonb("website_data").notNull(), // Stores HTML, components, settings
  pages: jsonb("pages").default({}), // Stores multiple pages
  metadata: jsonb("metadata").default({}), // SEO, title, etc
  theme: jsonb("theme").default({}), // Colors, fonts, etc
  isPublished: boolean("is_published").default(true),
  publishedAt: timestamp("published_at").defaultNow(),
  lastUpdated: timestamp("last_updated").defaultNow(),
  analytics: jsonb("analytics").default({}), // View counts, etc
  sslEnabled: boolean("ssl_enabled").default(true),
  customDomainVerified: boolean("custom_domain_verified").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

// Photography sessions table with user ownership
export const photographySessions = pgTable("photography_sessions", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  clientName: varchar("client_name").notNull(),
  sessionType: varchar("session_type").notNull(),
  dateTime: timestamp("date_time").notNull(),
  location: varchar("location").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  email: varchar("email").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
  depositAmount: decimal("deposit_amount", { precision: 10, scale: 2 }).default("0.00"),
  duration: integer("duration").notNull(),
  notes: text("notes").default(""),
  contractSigned: boolean("contract_signed").default(false),
  paid: boolean("paid").default(false),
  edited: boolean("edited").default(false),
  delivered: boolean("delivered").default(false),
  sendReminder: boolean("send_reminder").default(false),
  notifyGalleryReady: boolean("notify_gallery_ready").default(false),
  photos: jsonb("photos").default([]),
  galleryAccessToken: varchar("gallery_access_token"),
  galleryCreatedAt: timestamp("gallery_created_at"),
  galleryExpiresAt: timestamp("gallery_expires_at"),
  galleryReadyNotified: boolean("gallery_ready_notified").default(false),
  lastGalleryNotification: jsonb("last_gallery_notification"),
  stripeInvoice: jsonb("stripe_invoice"),
  // Payment plan fields
  hasPaymentPlan: boolean("has_payment_plan").default(false),
  paymentPlanId: varchar("payment_plan_id"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }),
  paymentPlanStartDate: timestamp("payment_plan_start_date"),
  paymentPlanEndDate: timestamp("payment_plan_end_date"),
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }),
  paymentsRemaining: integer("payments_remaining").default(0),
  nextPaymentDate: timestamp("next_payment_date"),
  // Download controls and watermarking
  downloadEnabled: boolean("download_enabled").default(true),
  downloadMax: integer("download_max"), // null = unlimited downloads
  pricingModel: varchar("pricing_model").default("free").$type<'free' | 'paid' | 'freemium'>(),
  freeDownloads: integer("free_downloads").default(0),
  pricePerDownload: decimal("price_per_download", { precision: 10, scale: 2 }).default("0.00"),
  watermarkEnabled: boolean("watermark_enabled").default(false),
  watermarkType: varchar("watermark_type").default("text").$type<'logo' | 'text'>(),
  watermarkLogoUrl: varchar("watermark_logo_url"),
  watermarkText: varchar("watermark_text").default("© Photography"),
  watermarkOpacity: integer("watermark_opacity").default(60), // 0-100
  watermarkPosition: varchar("watermark_position").default("bottom-right"), // 'top-left', 'top-right', 'bottom-left', 'bottom-right', 'center'
  watermarkScale: integer("watermark_scale").default(20), // 1-100 percentage of image width for logo
  watermarkUpdatedAt: timestamp("watermark_updated_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  // Index for composite foreign key references from gallery_downloads
  userIdIdx: index("idx_photography_sessions_user_id").on(table.userId, table.id),
  // Unique constraint for composite FK references
  userIdUnique: unique("photography_sessions_user_id_id_key").on(table.userId, table.id),
}));

// Payment plans table
export const paymentPlans = pgTable("payment_plans", {
  id: varchar("id").primaryKey().notNull(),
  sessionId: varchar("session_id").notNull().references(() => photographySessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  monthlyPayment: decimal("monthly_payment", { precision: 10, scale: 2 }).notNull(),
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  totalPayments: integer("total_payments").notNull(),
  paymentsCompleted: integer("payments_completed").default(0),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }).default("0.00"),
  remainingBalance: decimal("remaining_balance", { precision: 10, scale: 2 }).notNull(),
  status: varchar("status").notNull().default("active"), // active, completed, cancelled, overdue
  nextPaymentDate: timestamp("next_payment_date").notNull(),
  autoSendInvoices: boolean("auto_send_invoices").default(true),
  reminderDaysBefore: integer("reminder_days_before").default(3),
  paymentFrequency: varchar("payment_frequency").notNull().default("monthly"), // weekly, bi-weekly, monthly
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual payment records
export const paymentRecords = pgTable("payment_records", {
  id: varchar("id").primaryKey().notNull(),
  planId: varchar("plan_id").notNull().references(() => paymentPlans.id),
  sessionId: varchar("session_id").notNull().references(() => photographySessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  paymentNumber: integer("payment_number").notNull(),
  dueDate: timestamp("due_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  tipAmount: decimal("tip_amount", { precision: 10, scale: 2 }).default("0.00"),
  status: varchar("status").notNull().default("pending"), // pending, paid, overdue, cancelled
  paidDate: timestamp("paid_date"),
  stripeInvoiceId: varchar("stripe_invoice_id"),
  stripeInvoiceUrl: varchar("stripe_invoice_url"),
  paymentMethod: varchar("payment_method"), // stripe, check, cash, etc.
  notes: text("notes").default(""),
  reminderSent: boolean("reminder_sent").default(false),
  reminderSentAt: timestamp("reminder_sent_at"),
  invoiceSent: boolean("invoice_sent").default(false),
  invoiceSentAt: timestamp("invoice_sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Subscribers table for marketing notifications
export const subscribers = pgTable("subscribers", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique().notNull(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  subscriptionPlan: varchar("subscription_plan").default("free"), // free, basic, pro, premium
  status: varchar("status").default("active"), // active, inactive, unsubscribed
  welcomeEmailSent: boolean("welcome_email_sent").default(false),
  lastBillingNotification: timestamp("last_billing_notification"),
  lastFeatureUpdate: timestamp("last_feature_update"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Files stored in R2 (RAW files and gallery images)
export const r2Files = pgTable("r2_files", {
  id: varchar("id").primaryKey().notNull(),
  sessionId: varchar("session_id").notNull().references(() => photographySessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  filename: varchar("filename").notNull(),
  originalFilename: varchar("original_filename").notNull(),
  fileType: varchar("file_type").notNull(), // 'raw', 'gallery', 'document', 'video', etc.
  fileExtension: varchar("file_extension").notNull(), // .NEF, .CR2, .JPG, .MP4, etc.
  fileSizeBytes: varchar("file_size_bytes").notNull(), // Using varchar for large numbers
  fileSizeMB: decimal("file_size_mb", { precision: 12, scale: 2 }).notNull(),
  r2Key: varchar("r2_key").notNull(), // Full path in R2 bucket
  r2Url: varchar("r2_url"), // Public URL if available
  uploadStatus: varchar("upload_status").notNull().default("pending"), // pending, uploading, completed, failed
  uploadStartedAt: timestamp("upload_started_at"),
  uploadCompletedAt: timestamp("upload_completed_at"),
  lastAccessedAt: timestamp("last_accessed_at"),
  downloadCount: integer("download_count").notNull().default(0),
  isPublic: boolean("is_public").default(false), // For gallery sharing
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Storage quota tracking per user (100GB free + 1TB packages at $25/month each)
export const userStorageQuotas = pgTable("user_storage_quotas", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  freeStorageGB: decimal("free_storage_gb", { precision: 10, scale: 3 }).notNull().default("100.000"), // 100GB free
  usedStorageBytes: varchar("used_storage_bytes").notNull().default("0"), // Current usage in bytes
  usedStorageGB: decimal("used_storage_gb", { precision: 12, scale: 3 }).notNull().default("0"), // Current usage in GB
  totalQuotaGB: decimal("total_quota_gb", { precision: 12, scale: 3 }).notNull().default("100.000"), // Free + purchased
  purchasedPackages: integer("purchased_packages").notNull().default(0), // Number of 1TB packages purchased
  monthlyStorageCost: decimal("monthly_storage_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  quotaStatus: varchar("quota_status").notNull().default("active"), // active, warning, overlimit, suspended
  lastWarningAt: timestamp("last_warning_at"), // When user was last warned about approaching limit
  lastUpdated: timestamp("last_updated").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Storage subscription packages (1TB at $25/month each)
export const storageSubscriptions = pgTable("storage_subscriptions", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  stripeSubscriptionId: varchar("stripe_subscription_id").notNull().unique(),
  stripePriceId: varchar("stripe_price_id").notNull(), // Stripe price ID for 1TB package
  packageCount: integer("package_count").notNull().default(1), // Number of 1TB packages
  storageAmountTB: integer("storage_amount_tb").notNull().default(1), // Total TB purchased
  monthlyPrice: decimal("monthly_price", { precision: 10, scale: 2 }).notNull().default("25.00"),
  status: varchar("status").notNull().default("active"), // active, cancelled, past_due, unpaid
  currentPeriodStart: timestamp("current_period_start").notNull(),
  currentPeriodEnd: timestamp("current_period_end").notNull(),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false),
  cancelledAt: timestamp("cancelled_at"),
  trialStart: timestamp("trial_start"),
  trialEnd: timestamp("trial_end"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Storage billing history and invoices
export const storageBillingHistory = pgTable("storage_billing_history", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  subscriptionId: varchar("subscription_id").notNull().references(() => storageSubscriptions.id),
  stripeInvoiceId: varchar("stripe_invoice_id").notNull().unique(),
  billingPeriodStart: timestamp("billing_period_start").notNull(),
  billingPeriodEnd: timestamp("billing_period_end").notNull(),
  packageCount: integer("package_count").notNull(), // Number of 1TB packages billed
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).notNull(),
  amountPaid: decimal("amount_paid", { precision: 10, scale: 2 }),
  status: varchar("status").notNull(), // paid, open, void, uncollectible
  invoiceUrl: varchar("invoice_url"), // Stripe hosted invoice URL
  paidAt: timestamp("paid_at"),
  dueDate: timestamp("due_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// R2 storage usage tracking per user for billing and limits
export const r2StorageUsage = pgTable("r2_storage_usage", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  totalFiles: integer("total_files").notNull().default(0),
  totalSizeBytes: varchar("total_size_bytes").notNull().default("0"), // Using varchar for large numbers
  totalSizeGB: decimal("total_size_gb", { precision: 12, scale: 3 }).notNull().default("0"),
  totalSizeTB: decimal("total_size_tb", { precision: 10, scale: 6 }).notNull().default("0"),
  baseStorageTB: decimal("base_storage_tb", { precision: 10, scale: 2 }).notNull().default("1.00"), // Base 1TB included
  additionalStorageTB: integer("additional_storage_tb").notNull().default(0), // Additional 1TB tiers purchased
  maxAllowedTB: decimal("max_allowed_tb", { precision: 10, scale: 2 }).notNull().default("1.00"),
  storageStatus: varchar("storage_status").notNull().default("active"), // active, overlimit, suspended
  monthlyStorageCost: decimal("monthly_storage_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
  stripeStorageSubscriptionId: varchar("stripe_storage_subscription_id"),
  lastUsageUpdate: timestamp("last_usage_update").defaultNow(),
  nextBillingDate: timestamp("next_billing_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// R2 storage billing history and tracking per photographer  
export const r2StorageBilling = pgTable("r2_storage_billing", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  billingMonth: varchar("billing_month").notNull(), // YYYY-MM format
  totalStorageTB: decimal("total_storage_tb", { precision: 10, scale: 6 }).notNull().default("0"),
  additionalTiersPurchased: integer("additional_tiers_purchased").notNull().default(0),
  monthlyCharge: decimal("monthly_charge", { precision: 10, scale: 2 }).notNull().default("0"),
  sessionCount: integer("session_count").notNull().default(0),
  fileCount: integer("file_count").notNull().default(0),
  billingStatus: varchar("billing_status").notNull().default("pending"), // pending, invoiced, paid
  stripeInvoiceId: varchar("stripe_invoice_id"),
  invoicedAt: timestamp("invoiced_at"),
  paidAt: timestamp("paid_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type InsertPhotographySession = typeof photographySessions.$inferInsert;
export type PhotographySession = typeof photographySessions.$inferSelect;
export type InsertPaymentPlan = typeof paymentPlans.$inferInsert;
export type PaymentPlan = typeof paymentPlans.$inferSelect;
export type InsertPaymentRecord = typeof paymentRecords.$inferInsert;
export type PaymentRecord = typeof paymentRecords.$inferSelect;
export type InsertSubscriber = typeof subscribers.$inferInsert;
export type Subscriber = typeof subscribers.$inferSelect;
export type InsertR2File = typeof r2Files.$inferInsert;
export type R2File = typeof r2Files.$inferSelect;
export type InsertUserStorageQuota = typeof userStorageQuotas.$inferInsert;
export type UserStorageQuota = typeof userStorageQuotas.$inferSelect;
export type InsertStorageSubscription = typeof storageSubscriptions.$inferInsert;
export type StorageSubscription = typeof storageSubscriptions.$inferSelect;
export type InsertStorageBillingHistory = typeof storageBillingHistory.$inferInsert;
export type StorageBillingHistory = typeof storageBillingHistory.$inferSelect;
export type InsertR2StorageUsage = typeof r2StorageUsage.$inferInsert;
export type R2StorageUsage = typeof r2StorageUsage.$inferSelect;
export type InsertR2StorageBilling = typeof r2StorageBilling.$inferInsert;
export type R2StorageBilling = typeof r2StorageBilling.$inferSelect;


// AI Credits usage tracking
export const aiCreditUsage = pgTable("ai_credit_usage", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  requestType: varchar("request_type").notNull(), // page_generation, content_suggestion, etc.
  creditsUsed: integer("credits_used").notNull().default(1),
  prompt: text("prompt"),
  success: boolean("success").default(true),
  usedAt: timestamp("used_at").defaultNow(),
});

// Business expenses tracking
export const businessExpenses = pgTable("business_expenses", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  date: timestamp("date").notNull(),
  category: varchar("category").notNull(), // software, equipment, travel, marketing, misc
  description: text("description").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  recurring: boolean("recurring").default(false),
  receiptUrl: varchar("receipt_url"), // Optional receipt attachment
  taxDeductible: boolean("tax_deductible").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


export type InsertAiCreditUsage = typeof aiCreditUsage.$inferInsert;
export type AiCreditUsage = typeof aiCreditUsage.$inferSelect;
export type InsertBusinessExpense = typeof businessExpenses.$inferInsert;
export type BusinessExpense = typeof businessExpenses.$inferSelect;

// Digital download tokens for secure downloads
export const downloadTokens = pgTable("download_tokens", {
  id: varchar("id").primaryKey().notNull(),
  token: varchar("token").notNull().unique(),
  photoUrl: varchar("photo_url").notNull(),
  filename: varchar("filename").notNull(),
  sessionId: varchar("session_id").notNull().references(() => photographySessions.id, { onDelete: "cascade" }),
  expiresAt: timestamp("expires_at").notNull(),
  isUsed: boolean("is_used").default(false),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  sessionIdx: index("idx_download_tokens_session").on(table.sessionId),
  tokenIdx: index("idx_download_tokens_token").on(table.token),
  expiresIdx: index("idx_download_tokens_expires").on(table.expiresAt),
  // Composite unique constraint for token-session binding
  tokenSessionUnique: unique("download_tokens_token_session_key").on(table.token, table.sessionId),
}));

// Digital transaction records
export const digitalTransactions = pgTable("digital_transactions", {
  id: varchar("id").primaryKey().notNull(),
  sessionId: varchar("session_id").notNull().references(() => photographySessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id), // photographer
  photoId: varchar("photo_id").notNull(), // ID or filename of purchased photo
  stripePaymentIntentId: varchar("stripe_payment_intent_id").notNull(), // Stripe Payment Intent ID
  amount: integer("amount").notNull(), // Amount in cents
  downloadToken: varchar("download_token").notNull().unique().references(() => downloadTokens.token, { onDelete: "restrict" }),
  status: varchar("status").notNull().default("pending").$type<'pending' | 'completed' | 'failed' | 'refunded'>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  sessionDateIdx: index("idx_digital_transactions_session_date").on(table.sessionId, table.createdAt),
  // Composite FK to ensure token belongs to same session
  tokenSessionFk: foreignKey({
    columns: [table.downloadToken, table.sessionId],
    foreignColumns: [downloadTokens.token, downloadTokens.sessionId],
    name: "digital_transactions_token_session_fkey"
  }).onDelete("restrict"),
}));

// Gallery download usage tracking per session/client
export const galleryDownloads = pgTable("gallery_downloads", {
  id: varchar("id").primaryKey().notNull(),
  sessionId: varchar("session_id").notNull().references(() => photographySessions.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id), // photographer
  clientKey: varchar("client_key").notNull(), // unique identifier for client (email/access token)
  clientEmail: varchar("client_email"),
  clientName: varchar("client_name"),
  photoId: varchar("photo_id").notNull(), // ID or filename of downloaded photo
  photoUrl: varchar("photo_url").notNull(),
  filename: varchar("filename").notNull(),
  downloadType: varchar("download_type").notNull().default("free").$type<'free' | 'paid'>(),
  amountPaid: integer("amount_paid").default(0), // amount in cents
  stripePaymentId: varchar("stripe_payment_id"), // Stripe payment intent ID
  digitalTransactionId: varchar("digital_transaction_id").unique().references(() => digitalTransactions.id, { onDelete: "set null" }),
  downloadToken: varchar("download_token").notNull().unique().references(() => downloadTokens.token), // one-time use token with FK
  isWatermarked: boolean("is_watermarked").default(false),
  watermarkConfig: jsonb("watermark_config").default({}), // snapshot of watermark settings at time of download
  ipAddress: varchar("ip_address"),
  userAgent: text("user_agent"),
  status: varchar("status").notNull().default("completed").$type<'completed' | 'failed' | 'refunded'>(),
  createdAt: timestamp("created_at").defaultNow(),
}, (table) => ({
  // Business rule enforcement CHECK constraint
  downloadTypeConsistencyCheck: check("download_type_consistency_check", sql`
    (download_type = 'free' AND amount_paid = 0 AND digital_transaction_id IS NULL) OR
    (download_type = 'paid' AND amount_paid > 0 AND digital_transaction_id IS NOT NULL)
  `),
  sessionClientIdx: index("idx_gallery_downloads_session_client").on(table.sessionId, table.clientKey, table.status),
  sessionDateIdx: index("idx_gallery_downloads_session_date").on(table.sessionId, table.createdAt),
  // Cross-tenant isolation constraint - user_id must match session owner
  userSessionFk: foreignKey({
    columns: [table.userId, table.sessionId],
    foreignColumns: [photographySessions.userId, photographySessions.id],
    name: "gallery_downloads_user_session_fkey"
  }).onDelete("cascade"),
  // Composite FK to ensure token belongs to same session
  tokenSessionFk: foreignKey({
    columns: [table.downloadToken, table.sessionId],
    foreignColumns: [downloadTokens.token, downloadTokens.sessionId],
    name: "gallery_downloads_token_session_fkey"
  }).onDelete("restrict"),
}));

export type InsertDownloadToken = typeof downloadTokens.$inferInsert;
export type DownloadToken = typeof downloadTokens.$inferSelect;
export type InsertDigitalTransaction = typeof digitalTransactions.$inferInsert;
export type DigitalTransaction = typeof digitalTransactions.$inferSelect;
export type InsertGalleryDownload = typeof galleryDownloads.$inferInsert;
export type GalleryDownload = typeof galleryDownloads.$inferSelect;

// Community Platform Tables
export const communityProfiles = pgTable("community_profiles", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().unique().references(() => users.id),
  displayName: varchar("display_name").notNull(),
  bio: text("bio").default(""),
  avatarUrl: varchar("avatar_url"),
  specialty: varchar("specialty"), // portrait, landscape, wedding, etc.
  location: varchar("location"),
  experienceLevel: varchar("experience_level").default("beginner"), // beginner, intermediate, professional
  reputationPoints: integer("reputation_points").default(0),
  followersCount: integer("followers_count").default(0),
  followingCount: integer("following_count").default(0),
  postsCount: integer("posts_count").default(0),
  isVerified: boolean("is_verified").default(false),
  websiteUrl: varchar("website_url"),
  socialLinks: jsonb("social_links").default({}),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const communityPosts = pgTable("community_posts", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  userName: varchar("user_name").notNull(),
  userAvatar: varchar("user_avatar"),
  type: varchar("type").notNull().default("photo"), // photo, story, tip, question, showcase, sale
  title: varchar("title"),
  content: text("content"),
  imageUrls: jsonb("image_urls").default({}), // Array of image URLs
  videoUrl: varchar("video_url"),
  cameraSettings: jsonb("camera_settings").default({}), // EXIF data, camera, lens, etc.
  location: varchar("location"),
  price: decimal("price", { precision: 10, scale: 2 }), // For sale posts
  tags: jsonb("tags").default([]), // Photography tags/categories
  likesCount: integer("likes_count").default(0),
  commentsCount: integer("comments_count").default(0),
  sharesCount: integer("shares_count").default(0),
  savesCount: integer("saves_count").default(0),
  viewsCount: integer("views_count").default(0),
  isPublic: boolean("is_public").default(true),
  isFeatured: boolean("is_featured").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const communityLikes = pgTable("community_likes", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  postId: varchar("post_id").notNull().references(() => communityPosts.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityComments = pgTable("community_comments", {
  id: varchar("id").primaryKey().notNull(),
  postId: varchar("post_id").notNull().references(() => communityPosts.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  userName: varchar("user_name").notNull(),
  userAvatar: varchar("user_avatar"),
  parentCommentId: varchar("parent_comment_id").references(() => communityComments.id),
  content: text("content").notNull(),
  likesCount: integer("likes_count").default(0),
  isEdited: boolean("is_edited").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const communitySaves = pgTable("community_saves", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  postId: varchar("post_id").notNull().references(() => communityPosts.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityFollows = pgTable("community_follows", {
  id: varchar("id").primaryKey().notNull(),
  followerId: varchar("follower_id").notNull().references(() => users.id),
  followingId: varchar("following_id").notNull().references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityMessages = pgTable("community_messages", {
  id: varchar("id").primaryKey().notNull(),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  senderName: varchar("sender_name").notNull(),
  receiverId: varchar("receiver_id").notNull().references(() => users.id),
  receiverName: varchar("receiver_name").notNull(),
  message: text("message").notNull(),
  isRead: boolean("is_read").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const communityChallenges = pgTable("community_challenges", {
  id: varchar("id").primaryKey().notNull(),
  title: varchar("title").notNull(),
  description: text("description").notNull(),
  theme: varchar("theme").notNull(), // weekly theme, technique focus, etc.
  startDate: timestamp("start_date").notNull(),
  endDate: timestamp("end_date").notNull(),
  participantsCount: integer("participants_count").default(0),
  submissionsCount: integer("submissions_count").default(0),
  prizeDescription: text("prize_description"),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
});

// Photographer clients database
export const photographerClients = pgTable("photographer_clients", {
  id: varchar("id").primaryKey().notNull(),
  photographerId: varchar("photographer_id").notNull().references(() => users.id),
  clientName: varchar("client_name").notNull(),
  email: varchar("email"),
  phoneNumber: varchar("phone_number"),
  notes: text("notes"),
  tags: jsonb("tags").default([]), // Array of tags like ["VIP", "Wedding", "Corporate"]
  totalSessions: integer("total_sessions").default(0),
  totalRevenue: decimal("total_revenue", { precision: 10, scale: 2 }).default("0.00"),
  lastSessionDate: timestamp("last_session_date"),
  lastContactDate: timestamp("last_contact_date"),
  source: varchar("source"), // How they found the photographer
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Print orders table for gallery print purchases
export const printOrders = pgTable("print_orders", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").references(() => users.id), // User ID for photographer orders
  sessionId: varchar("session_id").references(() => photographySessions.id), // Session ID for gallery orders
  photographerId: varchar("photographer_id").references(() => users.id),
  clientEmail: varchar("client_email"),
  clientName: varchar("client_name"),
  orderStatus: varchar("order_status").default("pending"), // pending, processing, shipped, delivered, cancelled
  oasOrderId: varchar("oas_order_id"), // Order ID from OAS API (legacy)
  editorProjectId: varchar("editor_project_id"), // Project ID from Editor API
  items: jsonb("items").default([]), // Array of order items with product details
  customerInfo: jsonb("customer_info"), // Customer details object
  shippingInfo: jsonb("shipping_info"), // Shipping details object
  subtotal: decimal("subtotal", { precision: 10, scale: 2 }).default("0.00"),
  shippingCost: decimal("shipping_cost", { precision: 10, scale: 2 }).default("0.00"),
  tax: decimal("tax", { precision: 10, scale: 2 }).default("0.00"),
  total: decimal("total", { precision: 10, scale: 2 }).default("0.00"),
  totalAmount: decimal("total_amount", { precision: 10, scale: 2 }).default("0.00"),
  shippingAddress: jsonb("shipping_address"), // Address object
  billingAddress: jsonb("billing_address"), // Address object
  paymentStatus: varchar("payment_status").default("pending"), // pending, paid, failed, refunded
  paymentIntentId: varchar("payment_intent_id"), // Stripe payment intent
  stripePaymentIntentId: varchar("stripe_payment_intent_id"), // Legacy field
  photographerProfit: decimal("photographer_profit", { precision: 10, scale: 2 }).default("0.00"),
  platformFee: decimal("platform_fee", { precision: 10, scale: 2 }).default("0.00"),
  trackingNumber: varchar("tracking_number"),
  productionDate: timestamp("production_date"), // When order goes to production
  shipDate: timestamp("ship_date"), // When order was shipped
  shippedAt: timestamp("shipped_at"), // Legacy field
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Print products catalog (cached from API)
export const printProducts = pgTable("print_products", {
  id: varchar("id").primaryKey().notNull(),
  oasProductId: varchar("oas_product_id").unique().notNull(),
  categoryId: varchar("category_id"),
  categoryName: varchar("category_name"),
  productName: varchar("product_name").notNull(),
  productDescription: text("product_description"),
  basePrice: decimal("base_price", { precision: 10, scale: 2 }).notNull(),
  photographerPrice: decimal("photographer_price", { precision: 10, scale: 2 }), // Custom pricing
  sizes: jsonb("sizes").default([]), // Available sizes with pricing
  options: jsonb("options").default([]), // Product options (paper type, finish, etc)
  thumbnail: varchar("thumbnail"),
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  metadata: jsonb("metadata").default({}), // Additional product info from API
  lastSyncedAt: timestamp("last_synced_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Shopping cart for print orders
export const printCarts = pgTable("print_carts", {
  id: varchar("id").primaryKey().notNull(),
  sessionId: varchar("session_id").notNull(),
  clientEmail: varchar("client_email"),
  items: jsonb("items").default([]), // Cart items
  expiresAt: timestamp("expires_at"), // Cart expiration
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


// Photographer Clients type exports
export type InsertPhotographerClient = typeof photographerClients.$inferInsert;
export type PhotographerClient = typeof photographerClients.$inferSelect;

// Print Service type exports
export type InsertPrintOrder = typeof printOrders.$inferInsert;
export type PrintOrder = typeof printOrders.$inferSelect;
export type InsertPrintProduct = typeof printProducts.$inferInsert;
export type PrintProduct = typeof printProducts.$inferSelect;
export type InsertPrintCart = typeof printCarts.$inferInsert;
export type PrintCart = typeof printCarts.$inferSelect;

// Community type exports
export type InsertCommunityProfile = typeof communityProfiles.$inferInsert;
export type CommunityProfile = typeof communityProfiles.$inferSelect;
export type InsertCommunityPost = typeof communityPosts.$inferInsert;
export type CommunityPost = typeof communityPosts.$inferSelect;
export type InsertCommunityLike = typeof communityLikes.$inferInsert;
export type CommunityLike = typeof communityLikes.$inferSelect;
export type InsertCommunityComment = typeof communityComments.$inferInsert;
export type CommunityComment = typeof communityComments.$inferSelect;
export type InsertCommunitySave = typeof communitySaves.$inferInsert;
export type CommunitySave = typeof communitySaves.$inferSelect;
export type InsertCommunityFollow = typeof communityFollows.$inferInsert;
export type CommunityFollow = typeof communityFollows.$inferSelect;
export type InsertCommunityMessage = typeof communityMessages.$inferInsert;
export type CommunityMessage = typeof communityMessages.$inferSelect;
export type InsertCommunityChallenge = typeof communityChallenges.$inferInsert;
export type CommunityChallenge = typeof communityChallenges.$inferSelect;

// Admin Content Edits table for inline editor
export const adminContentEdits = pgTable("admin_content_edits", {
  id: serial("id").primaryKey(),
  page: varchar("page", { length: 255 }).notNull(),
  selector: text("selector").notNull(),
  content: text("content").notNull(),
  contentType: varchar("content_type", { length: 50 }).default("text"),
  editedBy: varchar("edited_by", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
}, (table) => ({
  uniquePageSelector: index("unique_page_selector").on(table.page, table.selector),
}));

// Photo For Sale Settings table for admin-configured pricing
export const photoForSaleSettings = pgTable("photo_for_sale_settings", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  pageId: varchar("page_id").notNull(), // Which page/gallery this applies to
  photoSelector: text("photo_selector").notNull(), // CSS selector or photo identifier
  photoUrl: varchar("photo_url").notNull(),
  photoFilename: varchar("photo_filename").notNull(),
  isForSale: boolean("is_for_sale").default(true),
  allowPrints: boolean("allow_prints").default(true),
  allowDigital: boolean("allow_digital").default(true),
  digitalPrice: decimal("digital_price", { precision: 10, scale: 2 }).notNull(),
  printMarkupPercentage: decimal("print_markup_percentage", { precision: 5, scale: 2 }).default("25.00"),
  minPrintPrice: decimal("min_print_price", { precision: 10, scale: 2 }).default("5.00"), // Minimum print price floor
  featuredProducts: jsonb("featured_products").default([]),
  customPricing: jsonb("custom_pricing").default({}), // Custom per-product pricing overrides
  saleDescription: text("sale_description"), // Optional description for this sale item
  tags: jsonb("tags").default([]), // Tags for organization
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});


export type InsertAdminContentEdit = typeof adminContentEdits.$inferInsert;
export type AdminContentEdit = typeof adminContentEdits.$inferSelect;
export type InsertPhotoForSaleSetting = typeof photoForSaleSettings.$inferInsert;
export type PhotoForSaleSetting = typeof photoForSaleSettings.$inferSelect;
