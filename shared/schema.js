"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.communityChallenges = exports.communityMessages = exports.communityFollows = exports.communitySaves = exports.communityComments = exports.communityLikes = exports.communityPosts = exports.communityProfiles = exports.businessExpenses = exports.aiCreditUsage = exports.r2StorageBilling = exports.r2StorageUsage = exports.storageBillingHistory = exports.storageSubscriptions = exports.userStorageQuotas = exports.r2Files = exports.subscribers = exports.contracts = exports.paymentRecords = exports.paymentPlans = exports.photographySessions = exports.publishedWebsites = exports.users = exports.sessions = void 0;
const pg_core_1 = require("drizzle-orm/pg-core");
// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
exports.sessions = (0, pg_core_1.pgTable)("sessions", {
    sid: (0, pg_core_1.varchar)("sid").primaryKey(),
    sess: (0, pg_core_1.jsonb)("sess").notNull(),
    expire: (0, pg_core_1.timestamp)("expire").notNull(),
}, (table) => [(0, pg_core_1.index)("IDX_session_expire").on(table.expire)]);
// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
exports.users = (0, pg_core_1.pgTable)("users", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    email: (0, pg_core_1.varchar)("email").unique(),
    username: (0, pg_core_1.varchar)("username").unique(),
    displayName: (0, pg_core_1.varchar)("display_name"),
    firstName: (0, pg_core_1.varchar)("first_name"),
    lastName: (0, pg_core_1.varchar)("last_name"),
    profileImageUrl: (0, pg_core_1.varchar)("profile_image_url"),
    businessName: (0, pg_core_1.varchar)("business_name"),
    businessType: (0, pg_core_1.varchar)("business_type"),
    phoneNumber: (0, pg_core_1.varchar)("phone_number"),
    streetAddress: (0, pg_core_1.varchar)("street_address"),
    city: (0, pg_core_1.varchar)("city"),
    state: (0, pg_core_1.varchar)("state"),
    zipCode: (0, pg_core_1.varchar)("zip_code"),
    onboardingCompleted: (0, pg_core_1.boolean)("onboarding_completed").default(false),
    onboardingDate: (0, pg_core_1.timestamp)("onboarding_date"),
    subscriptionStatus: (0, pg_core_1.varchar)("subscription_status").default("trial"),
    subscriptionPlan: (0, pg_core_1.varchar)("subscription_plan").default("basic"),
    subscriptionExpiresAt: (0, pg_core_1.timestamp)("subscription_expires_at"),
    // 3-Day Trial System Fields
    trialStartDate: (0, pg_core_1.timestamp)("trial_start_date"),
    trialEndDate: (0, pg_core_1.timestamp)("trial_end_date"),
    trialUsed: (0, pg_core_1.boolean)("trial_used").default(false),
    trialExpiredNotificationSent: (0, pg_core_1.boolean)("trial_expired_notification_sent").default(false),
    accessRestricted: (0, pg_core_1.boolean)("access_restricted").default(false),
    stripeCustomerId: (0, pg_core_1.varchar)("stripe_customer_id"),
    stripeSubscriptionId: (0, pg_core_1.varchar)("stripe_subscription_id"),
    stripeConnectAccountId: (0, pg_core_1.varchar)("stripe_connect_account_id"),
    stripeOnboardingComplete: (0, pg_core_1.boolean)("stripe_onboarding_complete").default(false),
    platformFeePercentage: (0, pg_core_1.decimal)("platform_fee_percentage", { precision: 5, scale: 2 }).default("0.00"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
    subdomain: (0, pg_core_1.varchar)("subdomain").unique(),
});
// Published websites table for hosting photographer sites
exports.publishedWebsites = (0, pg_core_1.pgTable)("published_websites", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    subdomain: (0, pg_core_1.varchar)("subdomain").notNull().unique(),
    customDomain: (0, pg_core_1.varchar)("custom_domain").unique(),
    websiteData: (0, pg_core_1.jsonb)("website_data").notNull(), // Stores HTML, components, settings
    pages: (0, pg_core_1.jsonb)("pages").default({}), // Stores multiple pages
    metadata: (0, pg_core_1.jsonb)("metadata").default({}), // SEO, title, etc
    theme: (0, pg_core_1.jsonb)("theme").default({}), // Colors, fonts, etc
    isPublished: (0, pg_core_1.boolean)("is_published").default(true),
    publishedAt: (0, pg_core_1.timestamp)("published_at").defaultNow(),
    lastUpdated: (0, pg_core_1.timestamp)("last_updated").defaultNow(),
    analytics: (0, pg_core_1.jsonb)("analytics").default({}), // View counts, etc
    sslEnabled: (0, pg_core_1.boolean)("ssl_enabled").default(true),
    customDomainVerified: (0, pg_core_1.boolean)("custom_domain_verified").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
// Photography sessions table with user ownership
exports.photographySessions = (0, pg_core_1.pgTable)("photography_sessions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    clientName: (0, pg_core_1.varchar)("client_name").notNull(),
    sessionType: (0, pg_core_1.varchar)("session_type").notNull(),
    dateTime: (0, pg_core_1.timestamp)("date_time").notNull(),
    location: (0, pg_core_1.varchar)("location").notNull(),
    phoneNumber: (0, pg_core_1.varchar)("phone_number").notNull(),
    email: (0, pg_core_1.varchar)("email").notNull(),
    price: (0, pg_core_1.decimal)("price", { precision: 10, scale: 2 }).notNull(),
    depositAmount: (0, pg_core_1.decimal)("deposit_amount", { precision: 10, scale: 2 }).default("0.00"),
    duration: (0, pg_core_1.integer)("duration").notNull(),
    notes: (0, pg_core_1.text)("notes").default(""),
    contractSigned: (0, pg_core_1.boolean)("contract_signed").default(false),
    paid: (0, pg_core_1.boolean)("paid").default(false),
    edited: (0, pg_core_1.boolean)("edited").default(false),
    delivered: (0, pg_core_1.boolean)("delivered").default(false),
    sendReminder: (0, pg_core_1.boolean)("send_reminder").default(false),
    notifyGalleryReady: (0, pg_core_1.boolean)("notify_gallery_ready").default(false),
    photos: (0, pg_core_1.jsonb)("photos").default([]),
    galleryAccessToken: (0, pg_core_1.varchar)("gallery_access_token"),
    galleryCreatedAt: (0, pg_core_1.timestamp)("gallery_created_at"),
    galleryExpiresAt: (0, pg_core_1.timestamp)("gallery_expires_at"),
    galleryReadyNotified: (0, pg_core_1.boolean)("gallery_ready_notified").default(false),
    lastGalleryNotification: (0, pg_core_1.jsonb)("last_gallery_notification"),
    stripeInvoice: (0, pg_core_1.jsonb)("stripe_invoice"),
    // Payment plan fields
    hasPaymentPlan: (0, pg_core_1.boolean)("has_payment_plan").default(false),
    paymentPlanId: (0, pg_core_1.varchar)("payment_plan_id"),
    totalAmount: (0, pg_core_1.decimal)("total_amount", { precision: 10, scale: 2 }),
    paymentPlanStartDate: (0, pg_core_1.timestamp)("payment_plan_start_date"),
    paymentPlanEndDate: (0, pg_core_1.timestamp)("payment_plan_end_date"),
    monthlyPayment: (0, pg_core_1.decimal)("monthly_payment", { precision: 10, scale: 2 }),
    paymentsRemaining: (0, pg_core_1.integer)("payments_remaining").default(0),
    nextPaymentDate: (0, pg_core_1.timestamp)("next_payment_date"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Payment plans table
exports.paymentPlans = (0, pg_core_1.pgTable)("payment_plans", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    sessionId: (0, pg_core_1.varchar)("session_id").notNull().references(() => exports.photographySessions.id),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    totalAmount: (0, pg_core_1.decimal)("total_amount", { precision: 10, scale: 2 }).notNull(),
    monthlyPayment: (0, pg_core_1.decimal)("monthly_payment", { precision: 10, scale: 2 }).notNull(),
    startDate: (0, pg_core_1.timestamp)("start_date").notNull(),
    endDate: (0, pg_core_1.timestamp)("end_date").notNull(),
    totalPayments: (0, pg_core_1.integer)("total_payments").notNull(),
    paymentsCompleted: (0, pg_core_1.integer)("payments_completed").default(0),
    amountPaid: (0, pg_core_1.decimal)("amount_paid", { precision: 10, scale: 2 }).default("0.00"),
    remainingBalance: (0, pg_core_1.decimal)("remaining_balance", { precision: 10, scale: 2 }).notNull(),
    status: (0, pg_core_1.varchar)("status").notNull().default("active"), // active, completed, cancelled, overdue
    nextPaymentDate: (0, pg_core_1.timestamp)("next_payment_date").notNull(),
    autoSendInvoices: (0, pg_core_1.boolean)("auto_send_invoices").default(true),
    reminderDaysBefore: (0, pg_core_1.integer)("reminder_days_before").default(3),
    paymentFrequency: (0, pg_core_1.varchar)("payment_frequency").notNull().default("monthly"), // weekly, bi-weekly, monthly
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Individual payment records
exports.paymentRecords = (0, pg_core_1.pgTable)("payment_records", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    planId: (0, pg_core_1.varchar)("plan_id").notNull().references(() => exports.paymentPlans.id),
    sessionId: (0, pg_core_1.varchar)("session_id").notNull().references(() => exports.photographySessions.id),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    paymentNumber: (0, pg_core_1.integer)("payment_number").notNull(),
    dueDate: (0, pg_core_1.timestamp)("due_date").notNull(),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    tipAmount: (0, pg_core_1.decimal)("tip_amount", { precision: 10, scale: 2 }).default("0.00"),
    status: (0, pg_core_1.varchar)("status").notNull().default("pending"), // pending, paid, overdue, cancelled
    paidDate: (0, pg_core_1.timestamp)("paid_date"),
    stripeInvoiceId: (0, pg_core_1.varchar)("stripe_invoice_id"),
    stripeInvoiceUrl: (0, pg_core_1.varchar)("stripe_invoice_url"),
    paymentMethod: (0, pg_core_1.varchar)("payment_method"), // stripe, check, cash, etc.
    notes: (0, pg_core_1.text)("notes").default(""),
    reminderSent: (0, pg_core_1.boolean)("reminder_sent").default(false),
    reminderSentAt: (0, pg_core_1.timestamp)("reminder_sent_at"),
    invoiceSent: (0, pg_core_1.boolean)("invoice_sent").default(false),
    invoiceSentAt: (0, pg_core_1.timestamp)("invoice_sent_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Contracts table for e-signature management
exports.contracts = (0, pg_core_1.pgTable)("contracts", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    sessionId: (0, pg_core_1.varchar)("session_id").notNull().references(() => exports.photographySessions.id),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    contractType: (0, pg_core_1.varchar)("contract_type").notNull(), // 'photo_release', 'wedding_contract', 'general_contract'
    contractTitle: (0, pg_core_1.varchar)("contract_title").notNull(),
    contractContent: (0, pg_core_1.text)("contract_content").notNull(),
    status: (0, pg_core_1.varchar)("status").notNull().default("pending"), // pending, sent, signed, cancelled
    clientName: (0, pg_core_1.varchar)("client_name").notNull(),
    clientEmail: (0, pg_core_1.varchar)("client_email").notNull(),
    photographerName: (0, pg_core_1.varchar)("photographer_name").notNull(),
    photographerEmail: (0, pg_core_1.varchar)("photographer_email").notNull(),
    signedDate: (0, pg_core_1.timestamp)("signed_date"),
    clientSignature: (0, pg_core_1.text)("client_signature"), // Base64 signature data
    clientSignatureDate: (0, pg_core_1.timestamp)("client_signature_date"),
    photographerSignature: (0, pg_core_1.text)("photographer_signature"),
    photographerSignatureDate: (0, pg_core_1.timestamp)("photographer_signature_date"),
    accessToken: (0, pg_core_1.varchar)("access_token").notNull(), // Secure token for client access
    sentAt: (0, pg_core_1.timestamp)("sent_at"),
    viewedAt: (0, pg_core_1.timestamp)("viewed_at"),
    remindersSent: (0, pg_core_1.integer)("reminders_sent").default(0),
    lastReminderSent: (0, pg_core_1.timestamp)("last_reminder_sent"),
    customFields: (0, pg_core_1.jsonb)("custom_fields").default({}), // Session-specific data
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Subscribers table for marketing notifications
exports.subscribers = (0, pg_core_1.pgTable)("subscribers", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    email: (0, pg_core_1.varchar)("email").unique().notNull(),
    firstName: (0, pg_core_1.varchar)("first_name"),
    lastName: (0, pg_core_1.varchar)("last_name"),
    subscriptionPlan: (0, pg_core_1.varchar)("subscription_plan").default("free"), // free, basic, pro, premium
    status: (0, pg_core_1.varchar)("status").default("active"), // active, inactive, unsubscribed
    welcomeEmailSent: (0, pg_core_1.boolean)("welcome_email_sent").default(false),
    lastBillingNotification: (0, pg_core_1.timestamp)("last_billing_notification"),
    lastFeatureUpdate: (0, pg_core_1.timestamp)("last_feature_update"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Files stored in R2 (RAW files and gallery images)
exports.r2Files = (0, pg_core_1.pgTable)("r2_files", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    sessionId: (0, pg_core_1.varchar)("session_id").notNull().references(() => exports.photographySessions.id),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    filename: (0, pg_core_1.varchar)("filename").notNull(),
    originalFilename: (0, pg_core_1.varchar)("original_filename").notNull(),
    fileType: (0, pg_core_1.varchar)("file_type").notNull(), // 'raw', 'gallery', 'document', 'video', etc.
    fileExtension: (0, pg_core_1.varchar)("file_extension").notNull(), // .NEF, .CR2, .JPG, .MP4, etc.
    fileSizeBytes: (0, pg_core_1.varchar)("file_size_bytes").notNull(), // Using varchar for large numbers
    fileSizeMB: (0, pg_core_1.decimal)("file_size_mb", { precision: 12, scale: 2 }).notNull(),
    r2Key: (0, pg_core_1.varchar)("r2_key").notNull(), // Full path in R2 bucket
    r2Url: (0, pg_core_1.varchar)("r2_url"), // Public URL if available
    uploadStatus: (0, pg_core_1.varchar)("upload_status").notNull().default("pending"), // pending, uploading, completed, failed
    uploadStartedAt: (0, pg_core_1.timestamp)("upload_started_at"),
    uploadCompletedAt: (0, pg_core_1.timestamp)("upload_completed_at"),
    lastAccessedAt: (0, pg_core_1.timestamp)("last_accessed_at"),
    downloadCount: (0, pg_core_1.integer)("download_count").notNull().default(0),
    isPublic: (0, pg_core_1.boolean)("is_public").default(false), // For gallery sharing
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Storage quota tracking per user (100GB free + 1TB packages at $25/month each)
exports.userStorageQuotas = (0, pg_core_1.pgTable)("user_storage_quotas", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().unique().references(() => exports.users.id),
    freeStorageGB: (0, pg_core_1.decimal)("free_storage_gb", { precision: 10, scale: 3 }).notNull().default("100.000"), // 100GB free
    usedStorageBytes: (0, pg_core_1.varchar)("used_storage_bytes").notNull().default("0"), // Current usage in bytes
    usedStorageGB: (0, pg_core_1.decimal)("used_storage_gb", { precision: 12, scale: 3 }).notNull().default("0"), // Current usage in GB
    totalQuotaGB: (0, pg_core_1.decimal)("total_quota_gb", { precision: 12, scale: 3 }).notNull().default("100.000"), // Free + purchased
    purchasedPackages: (0, pg_core_1.integer)("purchased_packages").notNull().default(0), // Number of 1TB packages purchased
    monthlyStorageCost: (0, pg_core_1.decimal)("monthly_storage_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
    quotaStatus: (0, pg_core_1.varchar)("quota_status").notNull().default("active"), // active, warning, overlimit, suspended
    lastWarningAt: (0, pg_core_1.timestamp)("last_warning_at"), // When user was last warned about approaching limit
    lastUpdated: (0, pg_core_1.timestamp)("last_updated").defaultNow(),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Storage subscription packages (1TB at $25/month each)
exports.storageSubscriptions = (0, pg_core_1.pgTable)("storage_subscriptions", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    stripeSubscriptionId: (0, pg_core_1.varchar)("stripe_subscription_id").notNull().unique(),
    stripePriceId: (0, pg_core_1.varchar)("stripe_price_id").notNull(), // Stripe price ID for 1TB package
    packageCount: (0, pg_core_1.integer)("package_count").notNull().default(1), // Number of 1TB packages
    storageAmountTB: (0, pg_core_1.integer)("storage_amount_tb").notNull().default(1), // Total TB purchased
    monthlyPrice: (0, pg_core_1.decimal)("monthly_price", { precision: 10, scale: 2 }).notNull().default("25.00"),
    status: (0, pg_core_1.varchar)("status").notNull().default("active"), // active, cancelled, past_due, unpaid
    currentPeriodStart: (0, pg_core_1.timestamp)("current_period_start").notNull(),
    currentPeriodEnd: (0, pg_core_1.timestamp)("current_period_end").notNull(),
    cancelAtPeriodEnd: (0, pg_core_1.boolean)("cancel_at_period_end").default(false),
    cancelledAt: (0, pg_core_1.timestamp)("cancelled_at"),
    trialStart: (0, pg_core_1.timestamp)("trial_start"),
    trialEnd: (0, pg_core_1.timestamp)("trial_end"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Storage billing history and invoices
exports.storageBillingHistory = (0, pg_core_1.pgTable)("storage_billing_history", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    subscriptionId: (0, pg_core_1.varchar)("subscription_id").notNull().references(() => exports.storageSubscriptions.id),
    stripeInvoiceId: (0, pg_core_1.varchar)("stripe_invoice_id").notNull().unique(),
    billingPeriodStart: (0, pg_core_1.timestamp)("billing_period_start").notNull(),
    billingPeriodEnd: (0, pg_core_1.timestamp)("billing_period_end").notNull(),
    packageCount: (0, pg_core_1.integer)("package_count").notNull(), // Number of 1TB packages billed
    totalAmount: (0, pg_core_1.decimal)("total_amount", { precision: 10, scale: 2 }).notNull(),
    amountPaid: (0, pg_core_1.decimal)("amount_paid", { precision: 10, scale: 2 }),
    status: (0, pg_core_1.varchar)("status").notNull(), // paid, open, void, uncollectible
    invoiceUrl: (0, pg_core_1.varchar)("invoice_url"), // Stripe hosted invoice URL
    paidAt: (0, pg_core_1.timestamp)("paid_at"),
    dueDate: (0, pg_core_1.timestamp)("due_date"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// R2 storage usage tracking per user for billing and limits
exports.r2StorageUsage = (0, pg_core_1.pgTable)("r2_storage_usage", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    totalFiles: (0, pg_core_1.integer)("total_files").notNull().default(0),
    totalSizeBytes: (0, pg_core_1.varchar)("total_size_bytes").notNull().default("0"), // Using varchar for large numbers
    totalSizeGB: (0, pg_core_1.decimal)("total_size_gb", { precision: 12, scale: 3 }).notNull().default("0"),
    totalSizeTB: (0, pg_core_1.decimal)("total_size_tb", { precision: 10, scale: 6 }).notNull().default("0"),
    baseStorageTB: (0, pg_core_1.decimal)("base_storage_tb", { precision: 10, scale: 2 }).notNull().default("1.00"), // Base 1TB included
    additionalStorageTB: (0, pg_core_1.integer)("additional_storage_tb").notNull().default(0), // Additional 1TB tiers purchased
    maxAllowedTB: (0, pg_core_1.decimal)("max_allowed_tb", { precision: 10, scale: 2 }).notNull().default("1.00"),
    storageStatus: (0, pg_core_1.varchar)("storage_status").notNull().default("active"), // active, overlimit, suspended
    monthlyStorageCost: (0, pg_core_1.decimal)("monthly_storage_cost", { precision: 10, scale: 2 }).notNull().default("0.00"),
    stripeStorageSubscriptionId: (0, pg_core_1.varchar)("stripe_storage_subscription_id"),
    lastUsageUpdate: (0, pg_core_1.timestamp)("last_usage_update").defaultNow(),
    nextBillingDate: (0, pg_core_1.timestamp)("next_billing_date"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// R2 storage billing history and tracking per photographer  
exports.r2StorageBilling = (0, pg_core_1.pgTable)("r2_storage_billing", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    billingMonth: (0, pg_core_1.varchar)("billing_month").notNull(), // YYYY-MM format
    totalStorageTB: (0, pg_core_1.decimal)("total_storage_tb", { precision: 10, scale: 6 }).notNull().default("0"),
    additionalTiersPurchased: (0, pg_core_1.integer)("additional_tiers_purchased").notNull().default(0),
    monthlyCharge: (0, pg_core_1.decimal)("monthly_charge", { precision: 10, scale: 2 }).notNull().default("0"),
    sessionCount: (0, pg_core_1.integer)("session_count").notNull().default(0),
    fileCount: (0, pg_core_1.integer)("file_count").notNull().default(0),
    billingStatus: (0, pg_core_1.varchar)("billing_status").notNull().default("pending"), // pending, invoiced, paid
    stripeInvoiceId: (0, pg_core_1.varchar)("stripe_invoice_id"),
    invoicedAt: (0, pg_core_1.timestamp)("invoiced_at"),
    paidAt: (0, pg_core_1.timestamp)("paid_at"),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// AI Credits usage tracking
exports.aiCreditUsage = (0, pg_core_1.pgTable)("ai_credit_usage", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    requestType: (0, pg_core_1.varchar)("request_type").notNull(), // page_generation, content_suggestion, etc.
    creditsUsed: (0, pg_core_1.integer)("credits_used").notNull().default(1),
    prompt: (0, pg_core_1.text)("prompt"),
    success: (0, pg_core_1.boolean)("success").default(true),
    usedAt: (0, pg_core_1.timestamp)("used_at").defaultNow(),
});
// Business expenses tracking
exports.businessExpenses = (0, pg_core_1.pgTable)("business_expenses", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    date: (0, pg_core_1.timestamp)("date").notNull(),
    category: (0, pg_core_1.varchar)("category").notNull(), // software, equipment, travel, marketing, misc
    description: (0, pg_core_1.text)("description").notNull(),
    amount: (0, pg_core_1.decimal)("amount", { precision: 10, scale: 2 }).notNull(),
    recurring: (0, pg_core_1.boolean)("recurring").default(false),
    receiptUrl: (0, pg_core_1.varchar)("receipt_url"), // Optional receipt attachment
    taxDeductible: (0, pg_core_1.boolean)("tax_deductible").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
// Community Platform Tables
exports.communityProfiles = (0, pg_core_1.pgTable)("community_profiles", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().unique().references(() => exports.users.id),
    displayName: (0, pg_core_1.varchar)("display_name").notNull(),
    bio: (0, pg_core_1.text)("bio").default(""),
    avatarUrl: (0, pg_core_1.varchar)("avatar_url"),
    specialty: (0, pg_core_1.varchar)("specialty"), // portrait, landscape, wedding, etc.
    location: (0, pg_core_1.varchar)("location"),
    experienceLevel: (0, pg_core_1.varchar)("experience_level").default("beginner"), // beginner, intermediate, professional
    reputationPoints: (0, pg_core_1.integer)("reputation_points").default(0),
    followersCount: (0, pg_core_1.integer)("followers_count").default(0),
    followingCount: (0, pg_core_1.integer)("following_count").default(0),
    postsCount: (0, pg_core_1.integer)("posts_count").default(0),
    isVerified: (0, pg_core_1.boolean)("is_verified").default(false),
    websiteUrl: (0, pg_core_1.varchar)("website_url"),
    socialLinks: (0, pg_core_1.jsonb)("social_links").default({}),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.communityPosts = (0, pg_core_1.pgTable)("community_posts", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    userName: (0, pg_core_1.varchar)("user_name").notNull(),
    userAvatar: (0, pg_core_1.varchar)("user_avatar"),
    type: (0, pg_core_1.varchar)("type").notNull().default("photo"), // photo, story, tip, question, showcase, sale
    title: (0, pg_core_1.varchar)("title"),
    content: (0, pg_core_1.text)("content"),
    imageUrls: (0, pg_core_1.jsonb)("image_urls").default({}), // Array of image URLs
    videoUrl: (0, pg_core_1.varchar)("video_url"),
    cameraSettings: (0, pg_core_1.jsonb)("camera_settings").default({}), // EXIF data, camera, lens, etc.
    location: (0, pg_core_1.varchar)("location"),
    price: (0, pg_core_1.decimal)("price", { precision: 10, scale: 2 }), // For sale posts
    tags: (0, pg_core_1.jsonb)("tags").default([]), // Photography tags/categories
    likesCount: (0, pg_core_1.integer)("likes_count").default(0),
    commentsCount: (0, pg_core_1.integer)("comments_count").default(0),
    sharesCount: (0, pg_core_1.integer)("shares_count").default(0),
    savesCount: (0, pg_core_1.integer)("saves_count").default(0),
    viewsCount: (0, pg_core_1.integer)("views_count").default(0),
    isPublic: (0, pg_core_1.boolean)("is_public").default(true),
    isFeatured: (0, pg_core_1.boolean)("is_featured").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.communityLikes = (0, pg_core_1.pgTable)("community_likes", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    postId: (0, pg_core_1.varchar)("post_id").notNull().references(() => exports.communityPosts.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.communityComments = (0, pg_core_1.pgTable)("community_comments", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    postId: (0, pg_core_1.varchar)("post_id").notNull().references(() => exports.communityPosts.id),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    userName: (0, pg_core_1.varchar)("user_name").notNull(),
    userAvatar: (0, pg_core_1.varchar)("user_avatar"),
    parentCommentId: (0, pg_core_1.varchar)("parent_comment_id").references(() => exports.communityComments.id),
    content: (0, pg_core_1.text)("content").notNull(),
    likesCount: (0, pg_core_1.integer)("likes_count").default(0),
    isEdited: (0, pg_core_1.boolean)("is_edited").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
    updatedAt: (0, pg_core_1.timestamp)("updated_at").defaultNow(),
});
exports.communitySaves = (0, pg_core_1.pgTable)("community_saves", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    userId: (0, pg_core_1.varchar)("user_id").notNull().references(() => exports.users.id),
    postId: (0, pg_core_1.varchar)("post_id").notNull().references(() => exports.communityPosts.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.communityFollows = (0, pg_core_1.pgTable)("community_follows", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    followerId: (0, pg_core_1.varchar)("follower_id").notNull().references(() => exports.users.id),
    followingId: (0, pg_core_1.varchar)("following_id").notNull().references(() => exports.users.id),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.communityMessages = (0, pg_core_1.pgTable)("community_messages", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    senderId: (0, pg_core_1.varchar)("sender_id").notNull().references(() => exports.users.id),
    senderName: (0, pg_core_1.varchar)("sender_name").notNull(),
    receiverId: (0, pg_core_1.varchar)("receiver_id").notNull().references(() => exports.users.id),
    receiverName: (0, pg_core_1.varchar)("receiver_name").notNull(),
    message: (0, pg_core_1.text)("message").notNull(),
    isRead: (0, pg_core_1.boolean)("is_read").default(false),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
exports.communityChallenges = (0, pg_core_1.pgTable)("community_challenges", {
    id: (0, pg_core_1.varchar)("id").primaryKey().notNull(),
    title: (0, pg_core_1.varchar)("title").notNull(),
    description: (0, pg_core_1.text)("description").notNull(),
    theme: (0, pg_core_1.varchar)("theme").notNull(), // weekly theme, technique focus, etc.
    startDate: (0, pg_core_1.timestamp)("start_date").notNull(),
    endDate: (0, pg_core_1.timestamp)("end_date").notNull(),
    participantsCount: (0, pg_core_1.integer)("participants_count").default(0),
    submissionsCount: (0, pg_core_1.integer)("submissions_count").default(0),
    prizeDescription: (0, pg_core_1.text)("prize_description"),
    isActive: (0, pg_core_1.boolean)("is_active").default(true),
    createdAt: (0, pg_core_1.timestamp)("created_at").defaultNow(),
});
