const {
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
} = require("drizzle-orm/pg-core");

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
const sessions = pgTable(
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
const users = pgTable("users", {
  id: varchar("id").primaryKey().notNull(),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  subscriptionStatus: varchar("subscription_status").default("trial"),
  subscriptionPlan: varchar("subscription_plan").default("basic"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  aiCredits: integer("ai_credits").default(0),
  totalAiCreditsUsed: integer("total_ai_credits_used").default(0),
  lastAiCreditPurchase: timestamp("last_ai_credit_purchase"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Photography sessions table with user ownership
const photographySessions = pgTable("photography_sessions", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  clientName: varchar("client_name").notNull(),
  sessionType: varchar("session_type").notNull(),
  dateTime: timestamp("date_time").notNull(),
  location: varchar("location").notNull(),
  phoneNumber: varchar("phone_number").notNull(),
  email: varchar("email").notNull(),
  price: decimal("price", { precision: 10, scale: 2 }).notNull(),
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Payment plans table
const paymentPlans = pgTable("payment_plans", {
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
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Individual payment records
const paymentRecords = pgTable("payment_records", {
  id: varchar("id").primaryKey().notNull(),
  planId: varchar("plan_id").notNull().references(() => paymentPlans.id),
  sessionId: varchar("session_id").notNull().references(() => photographySessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  paymentNumber: integer("payment_number").notNull(),
  dueDate: timestamp("due_date").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
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

// Contracts table for e-signature management
const contracts = pgTable("contracts", {
  id: varchar("id").primaryKey().notNull(),
  sessionId: varchar("session_id").notNull().references(() => photographySessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  contractType: varchar("contract_type").notNull(), // 'photo_release', 'wedding_contract', 'general_contract'
  contractTitle: varchar("contract_title").notNull(),
  contractContent: text("contract_content").notNull(),
  status: varchar("status").notNull().default("pending"), // pending, sent, signed, cancelled
  clientName: varchar("client_name").notNull(),
  clientEmail: varchar("client_email").notNull(),
  photographerName: varchar("photographer_name").notNull(),
  photographerEmail: varchar("photographer_email").notNull(),
  signedDate: timestamp("signed_date"),
  clientSignature: text("client_signature"), // Base64 signature data
  clientSignatureDate: timestamp("client_signature_date"),
  photographerSignature: text("photographer_signature"),
  photographerSignatureDate: timestamp("photographer_signature_date"),
  accessToken: varchar("access_token").notNull(), // Secure token for client access
  sentAt: timestamp("sent_at"),
  viewedAt: timestamp("viewed_at"),
  remindersSent: integer("reminders_sent").default(0),
  lastReminderSent: timestamp("last_reminder_sent"),
  customFields: jsonb("custom_fields").default({}), // Session-specific data
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Subscribers table for marketing notifications
const subscribers = pgTable("subscribers", {
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
const r2Files = pgTable("r2_files", {
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

// R2 storage usage tracking per user for billing and limits
const r2StorageUsage = pgTable("r2_storage_usage", {
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
const r2StorageBilling = pgTable("r2_storage_billing", {
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


// type User = typeof users.$inferSelect;
// type InsertPhotographySession = typeof photographySessions.$inferInsert;
// type PhotographySession = typeof photographySessions.$inferSelect;
// type InsertPaymentPlan = typeof paymentPlans.$inferInsert;
// type PaymentPlan = typeof paymentPlans.$inferSelect;
// type InsertPaymentRecord = typeof paymentRecords.$inferInsert;
// type PaymentRecord = typeof paymentRecords.$inferSelect;
// type InsertSubscriber = typeof subscribers.$inferInsert;
// type Subscriber = typeof subscribers.$inferSelect;
// type InsertR2File = typeof r2Files.$inferInsert;
// type R2File = typeof r2Files.$inferSelect;
// type InsertR2StorageUsage = typeof r2StorageUsage.$inferInsert;
// type R2StorageUsage = typeof r2StorageUsage.$inferSelect;
// type InsertR2StorageBilling = typeof r2StorageBilling.$inferInsert;
// type R2StorageBilling = typeof r2StorageBilling.$inferSelect;

// AI Credits purchase tracking
const aiCreditPurchases = pgTable("ai_credit_purchases", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  creditsAmount: integer("credits_amount").notNull(),
  priceUsd: decimal("price_usd", { precision: 10, scale: 2 }).notNull(),
  stripePaymentIntentId: varchar("stripe_payment_intent_id"),
  status: varchar("status").notNull().default("pending"), // pending, completed, failed
  purchasedAt: timestamp("purchased_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

// AI Credits usage tracking
const aiCreditUsage = pgTable("ai_credit_usage", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  requestType: varchar("request_type").notNull(), // page_generation, content_suggestion, etc.
  creditsUsed: integer("credits_used").notNull().default(1),
  prompt: text("prompt"),
  success: boolean("success").default(true),
  usedAt: timestamp("used_at").defaultNow(),
});

// Workflow automation tables
const userAutomationSettings = pgTable('user_automation_settings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  automationSettings: jsonb('automation_settings').notNull(),
  messageTemplate: text('message_template').default('professional'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

const workflowLogs = pgTable('workflow_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  sessionId: text('session_id'),
  workflowType: text('workflow_type').notNull(),
  status: text('status').notNull(), // 'success', 'failed', 'pending'
  executedAt: timestamp('executed_at').defaultNow(),
  resultData: jsonb('result_data'),
  createdAt: timestamp('created_at').defaultNow()
});

// type InsertUserAutomationSettings = typeof userAutomationSettings.$inferInsert;
// type UserAutomationSettings = typeof userAutomationSettings.$inferSelect;
// type InsertWorkflowLog = typeof workflowLogs.$inferInsert;
// type WorkflowLog = typeof workflowLogs.$inferSelect;
// type InsertAiCreditPurchase = typeof aiCreditPurchases.$inferInsert;
// type AiCreditPurchase = typeof aiCreditPurchases.$inferSelect;
// type InsertAiCreditUsage = typeof aiCreditUsage.$inferInsert;
// type AiCreditUsage = typeof aiCreditUsage.$inferSelect;

// Export all tables and types
module.exports = {
  sessions,
  users,
  photographySessions,
  paymentPlans,
  paymentRecords,
  subscribers,
  r2Files,
  r2StorageUsage,
  r2StorageBilling,
  aiCreditPurchases,
  aiCreditUsage,
  userAutomationSettings,
  workflowLogs
};