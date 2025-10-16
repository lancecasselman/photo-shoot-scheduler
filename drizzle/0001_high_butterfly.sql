CREATE TABLE "analytics_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"metric_type" varchar NOT NULL,
	"time_period" varchar NOT NULL,
	"data" jsonb NOT NULL,
	"calculated_at" timestamp DEFAULT now(),
	"expires_at" timestamp NOT NULL,
	CONSTRAINT "analytics_cache_metric_type_time_period_key" UNIQUE("metric_type","time_period")
);
--> statement-breakpoint
CREATE TABLE "backup_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"backup_id" varchar NOT NULL,
	"backup_type" varchar NOT NULL,
	"status" varchar DEFAULT 'pending',
	"backup_size" varchar,
	"backup_location" text,
	"verification_status" varchar,
	"manual_backup" boolean DEFAULT false,
	"requested_by" varchar,
	"error_message" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"last_verified" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "backup_logs_backup_id_unique" UNIQUE("backup_id")
);
--> statement-breakpoint
CREATE TABLE "booking_agreement_signatures" (
	"id" varchar PRIMARY KEY NOT NULL,
	"agreement_id" varchar,
	"signer_name" varchar,
	"signer_email" varchar,
	"signature_data" text,
	"signature_type" varchar,
	"signed_at" timestamp DEFAULT now(),
	"ip_address" varchar,
	"user_agent" text
);
--> statement-breakpoint
CREATE TABLE "booking_agreement_templates" (
	"id" varchar PRIMARY KEY NOT NULL,
	"name" varchar NOT NULL,
	"category" varchar,
	"content" text NOT NULL,
	"is_default" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "booking_agreements" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"template_id" varchar,
	"content" text NOT NULL,
	"status" varchar DEFAULT 'draft',
	"access_token" varchar,
	"created_at" timestamp DEFAULT now(),
	"sent_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "booking_agreements_access_token_unique" UNIQUE("access_token")
);
--> statement-breakpoint
CREATE TABLE "client_quotas" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"client_key" varchar NOT NULL,
	"quota_type" varchar DEFAULT 'freemium' NOT NULL,
	"total_quota" integer DEFAULT 0,
	"used_quota" integer DEFAULT 0,
	"remaining_quota" integer DEFAULT 0,
	"reset_date" timestamp,
	"is_active" boolean DEFAULT true,
	"last_activity" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "client_quotas_session_client_key" UNIQUE("session_id","client_key")
);
--> statement-breakpoint
CREATE TABLE "data_export_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"export_id" varchar NOT NULL,
	"format" varchar NOT NULL,
	"status" varchar DEFAULT 'processing',
	"file_path" text,
	"file_size" varchar,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "download_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"client_key" varchar NOT NULL,
	"photo_id" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"download_status" varchar DEFAULT 'initiated' NOT NULL,
	"file_size" varchar,
	"download_duration" integer,
	"user_agent" text,
	"ip_address" varchar,
	"error_message" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gdpr_deletion_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"deletion_completed_at" timestamp NOT NULL,
	"deletion_details" jsonb,
	"compliance_status" varchar DEFAULT 'completed',
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "gdpr_deletion_requests" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"verification_code" varchar NOT NULL,
	"verified" boolean DEFAULT false,
	"verified_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "multipart_uploads" (
	"upload_id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"folder_type" varchar NOT NULL,
	"key" varchar NOT NULL,
	"file_name" varchar NOT NULL,
	"file_size" varchar NOT NULL,
	"total_parts" integer NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	"success" boolean DEFAULT false,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "session_files" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"original_name" varchar NOT NULL,
	"file_size" varchar NOT NULL,
	"mime_type" varchar NOT NULL,
	"folder_type" varchar DEFAULT 'gallery' NOT NULL,
	"r2_key" varchar NOT NULL,
	"r2_url" varchar,
	"thumbnail_r2_key" varchar,
	"is_public" boolean DEFAULT true,
	"uploaded_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "storage_usage_logs" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"session_id" varchar,
	"action" varchar NOT NULL,
	"file_size_bytes" varchar NOT NULL,
	"folder_type" varchar NOT NULL,
	"filename" varchar,
	"timestamp" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscription_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"subscription_id" varchar,
	"event_type" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"external_event_id" varchar,
	"event_data" jsonb DEFAULT '{}'::jsonb,
	"processed_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_type" varchar NOT NULL,
	"platform" varchar NOT NULL,
	"external_subscription_id" varchar NOT NULL,
	"external_customer_id" varchar,
	"status" varchar DEFAULT 'active' NOT NULL,
	"price_amount" numeric(10, 2) NOT NULL,
	"currency" varchar DEFAULT 'USD',
	"billing_cycle" varchar DEFAULT 'monthly',
	"storage_tb" integer DEFAULT 0,
	"platform_commission" numeric(5, 4) DEFAULT '0.0000',
	"current_period_start" timestamp,
	"current_period_end" timestamp,
	"trial_end" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"metadata" jsonb DEFAULT '{}'::jsonb
);
--> statement-breakpoint
CREATE TABLE "support_tickets" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticket_id" varchar NOT NULL,
	"user_email" varchar NOT NULL,
	"photographer_email" varchar,
	"subject" varchar NOT NULL,
	"category" varchar NOT NULL,
	"priority" varchar DEFAULT 'medium' NOT NULL,
	"description" text NOT NULL,
	"session_id" varchar,
	"client_affected" boolean DEFAULT false,
	"status" varchar DEFAULT 'open',
	"escalated" boolean DEFAULT false,
	"escalated_at" timestamp,
	"resolved_at" timestamp,
	"user_agent" text,
	"ip_address" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "support_tickets_ticket_id_unique" UNIQUE("ticket_id")
);
--> statement-breakpoint
CREATE TABLE "user_activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"activity_type" varchar NOT NULL,
	"activity_data" jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "user_subscription_summary" (
	"user_id" varchar PRIMARY KEY NOT NULL,
	"has_professional_plan" boolean DEFAULT false,
	"professional_platform" varchar,
	"professional_status" varchar,
	"total_storage_tb" integer DEFAULT 0,
	"base_storage_gb" integer DEFAULT 0,
	"total_storage_gb" integer DEFAULT 0,
	"active_subscriptions" integer DEFAULT 0,
	"monthly_total" numeric(10, 2) DEFAULT '0.00',
	"next_billing_date" timestamp,
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "webhook_events" (
	"id" varchar PRIMARY KEY NOT NULL,
	"stripe_event_id" varchar NOT NULL,
	"event_type" varchar NOT NULL,
	"processed_at" timestamp DEFAULT now(),
	"processing_attempts" integer DEFAULT 0 NOT NULL,
	"max_retries" integer DEFAULT 3 NOT NULL,
	"last_retry_at" timestamp,
	"next_retry_at" timestamp,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"event_data" jsonb,
	"order_id" varchar,
	"session_id" varchar,
	"processing_duration_ms" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "webhook_events_stripe_event_id_unique" UNIQUE("stripe_event_id")
);
--> statement-breakpoint
ALTER TABLE "download_entitlements" ALTER COLUMN "remaining" SET DEFAULT 1;--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD COLUMN "type" varchar DEFAULT 'download';--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD COLUMN "last_access_at" timestamp;--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD COLUMN "ip_address" varchar;--> statement-breakpoint
ALTER TABLE "download_orders" ADD COLUMN "is_admin_account" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "photography_sessions" ADD COLUMN "free_downloads_remaining" integer;--> statement-breakpoint
ALTER TABLE "photography_sessions" ADD COLUMN "unlimited_access" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "photography_sessions" ADD COLUMN "unlimited_access_price" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "photography_sessions" ADD COLUMN "unlimited_access_purchased_at" timestamp;--> statement-breakpoint
ALTER TABLE "booking_agreement_signatures" ADD CONSTRAINT "booking_agreement_signatures_agreement_id_booking_agreements_id_fk" FOREIGN KEY ("agreement_id") REFERENCES "public"."booking_agreements"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "booking_agreements" ADD CONSTRAINT "booking_agreements_template_id_booking_agreement_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."booking_agreement_templates"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_quotas" ADD CONSTRAINT "client_quotas_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_quotas" ADD CONSTRAINT "client_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_events" ADD CONSTRAINT "download_events_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_files" ADD CONSTRAINT "session_files_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_files" ADD CONSTRAINT "session_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_usage_logs" ADD CONSTRAINT "storage_usage_logs_user_id_user_storage_quotas_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user_storage_quotas"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscription_events" ADD CONSTRAINT "subscription_events_subscription_id_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_order_id_download_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."download_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "webhook_events" ADD CONSTRAINT "webhook_events_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_agreements_session" ON "booking_agreements" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_agreements_user" ON "booking_agreements" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_agreements_token" ON "booking_agreements" USING btree ("access_token");--> statement-breakpoint
CREATE INDEX "idx_client_quotas_session_client" ON "client_quotas" USING btree ("session_id","client_key");--> statement-breakpoint
CREATE INDEX "idx_client_quotas_active" ON "client_quotas" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_client_quotas_last_activity" ON "client_quotas" USING btree ("last_activity");--> statement-breakpoint
CREATE INDEX "idx_download_events_session_date" ON "download_events" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_download_events_client" ON "download_events" USING btree ("client_key");--> statement-breakpoint
CREATE INDEX "idx_download_events_status" ON "download_events" USING btree ("download_status");--> statement-breakpoint
CREATE INDEX "idx_download_events_created_at" ON "download_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_session_files_session" ON "session_files" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_session_files_folder_type" ON "session_files" USING btree ("folder_type");--> statement-breakpoint
CREATE INDEX "idx_session_files_uploaded_at" ON "session_files" USING btree ("uploaded_at");--> statement-breakpoint
CREATE INDEX "idx_subscription_events_subscription_id" ON "subscription_events" USING btree ("subscription_id");--> statement-breakpoint
CREATE INDEX "idx_subscription_events_type" ON "subscription_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_user_id" ON "subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_platform" ON "subscriptions" USING btree ("platform");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_status" ON "subscriptions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_subscriptions_external_id" ON "subscriptions" USING btree ("external_subscription_id");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_type" ON "webhook_events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_status" ON "webhook_events" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_retry" ON "webhook_events" USING btree ("next_retry_at","status");--> statement-breakpoint
CREATE INDEX "idx_webhook_events_created" ON "webhook_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_quota_check" ON "download_entitlements" USING btree ("session_id","client_key","remaining","is_active");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_active_quota" ON "download_entitlements" USING btree ("session_id","client_key","is_active","expires_at");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_remaining" ON "download_entitlements" USING btree ("remaining","is_active");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_expires" ON "download_entitlements" USING btree ("expires_at","is_active");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_type" ON "download_entitlements" USING btree ("type","is_active");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_ip_tracking" ON "download_entitlements" USING btree ("ip_address","created_at");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_access_pattern" ON "download_entitlements" USING btree ("client_key","last_access_at");--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD CONSTRAINT "download_entitlements_unique" UNIQUE("client_key","session_id","photo_id");--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD CONSTRAINT "download_entitlements_remaining_check" CHECK (remaining >= 0);--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD CONSTRAINT "download_entitlements_expires_logic_check" CHECK (
    expires_at IS NULL OR expires_at > created_at
  );--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD CONSTRAINT "download_entitlements_used_logic_check" CHECK (
    (remaining = 0 AND used_at IS NOT NULL) OR (remaining > 0 AND used_at IS NULL)
  );--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD CONSTRAINT "download_entitlements_type_check" CHECK (
    type IN ('download', 'cart_reservation', 'bulk')
  );