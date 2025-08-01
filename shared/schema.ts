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
} from "drizzle-orm/pg-core";

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
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  subscriptionStatus: varchar("subscription_status").default("trial"),
  subscriptionPlan: varchar("subscription_plan").default("basic"),
  subscriptionExpiresAt: timestamp("subscription_expires_at"),
  stripeCustomerId: varchar("stripe_customer_id"),
  stripeSubscriptionId: varchar("stripe_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
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
export const contracts = pgTable("contracts", {
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

// RAW backup storage tracking for $20/TB service
export const rawBackups = pgTable("raw_backups", {
  id: varchar("id").primaryKey().notNull(),
  sessionId: varchar("session_id").notNull().references(() => photographySessions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: varchar("status").notNull().default("pending"), // pending, uploading, completed, failed
  fileCount: integer("file_count").notNull().default(0),
  totalSizeBytes: varchar("total_size_bytes").notNull().default("0"), // Using varchar for large numbers
  totalSizeTB: decimal("total_size_tb", { precision: 10, scale: 6 }).notNull().default("0"),
  monthlyCharge: decimal("monthly_charge", { precision: 10, scale: 2 }).notNull().default("0"),
  r2Prefix: varchar("r2_prefix").notNull(), // photographer-{id}/session-{id}/raw/
  backupStartedAt: timestamp("backup_started_at"),
  backupCompletedAt: timestamp("backup_completed_at"),
  lastBillingDate: timestamp("last_billing_date"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// RAW storage billing tracking per photographer
export const rawStorageBilling = pgTable("raw_storage_billing", {
  id: varchar("id").primaryKey().notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  billingMonth: varchar("billing_month").notNull(), // YYYY-MM format
  totalStorageTB: decimal("total_storage_tb", { precision: 10, scale: 6 }).notNull().default("0"),
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
export type InsertRawBackup = typeof rawBackups.$inferInsert;
export type RawBackup = typeof rawBackups.$inferSelect;
export type InsertRawStorageBilling = typeof rawStorageBilling.$inferInsert;
export type RawStorageBilling = typeof rawStorageBilling.$inferSelect;

// Workflow automation tables
export const userAutomationSettings = pgTable('user_automation_settings', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull().unique(),
  automationSettings: jsonb('automation_settings').notNull(),
  messageTemplate: text('message_template').default('professional'),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow()
});

export const workflowLogs = pgTable('workflow_logs', {
  id: serial('id').primaryKey(),
  userId: text('user_id').notNull(),
  sessionId: text('session_id'),
  workflowType: text('workflow_type').notNull(),
  status: text('status').notNull(), // 'success', 'failed', 'pending'
  executedAt: timestamp('executed_at').defaultNow(),
  resultData: jsonb('result_data'),
  createdAt: timestamp('created_at').defaultNow()
});

export type InsertUserAutomationSettings = typeof userAutomationSettings.$inferInsert;
export type UserAutomationSettings = typeof userAutomationSettings.$inferSelect;
export type InsertWorkflowLog = typeof workflowLogs.$inferInsert;
export type WorkflowLog = typeof workflowLogs.$inferSelect;