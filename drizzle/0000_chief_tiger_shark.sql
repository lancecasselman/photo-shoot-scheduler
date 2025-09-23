CREATE TABLE "admin_content_edits" (
	"id" serial PRIMARY KEY NOT NULL,
	"page" varchar(255) NOT NULL,
	"selector" text NOT NULL,
	"content" text NOT NULL,
	"content_type" varchar(50) DEFAULT 'text',
	"edited_by" varchar(255) NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "ai_credit_usage" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"request_type" varchar NOT NULL,
	"credits_used" integer DEFAULT 1 NOT NULL,
	"prompt" text,
	"success" boolean DEFAULT true,
	"used_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "business_expenses" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"date" timestamp NOT NULL,
	"category" varchar NOT NULL,
	"description" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"recurring" boolean DEFAULT false,
	"receipt_url" varchar,
	"tax_deductible" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_challenges" (
	"id" varchar PRIMARY KEY NOT NULL,
	"title" varchar NOT NULL,
	"description" text NOT NULL,
	"theme" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"participants_count" integer DEFAULT 0,
	"submissions_count" integer DEFAULT 0,
	"prize_description" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_comments" (
	"id" varchar PRIMARY KEY NOT NULL,
	"post_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"user_avatar" varchar,
	"parent_comment_id" varchar,
	"content" text NOT NULL,
	"likes_count" integer DEFAULT 0,
	"is_edited" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_follows" (
	"id" varchar PRIMARY KEY NOT NULL,
	"follower_id" varchar NOT NULL,
	"following_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_likes" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"post_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_messages" (
	"id" varchar PRIMARY KEY NOT NULL,
	"sender_id" varchar NOT NULL,
	"sender_name" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"receiver_name" varchar NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_posts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"user_name" varchar NOT NULL,
	"user_avatar" varchar,
	"type" varchar DEFAULT 'photo' NOT NULL,
	"title" varchar,
	"content" text,
	"image_urls" jsonb DEFAULT '{}'::jsonb,
	"video_url" varchar,
	"camera_settings" jsonb DEFAULT '{}'::jsonb,
	"location" varchar,
	"price" numeric(10, 2),
	"tags" jsonb DEFAULT '[]'::jsonb,
	"likes_count" integer DEFAULT 0,
	"comments_count" integer DEFAULT 0,
	"shares_count" integer DEFAULT 0,
	"saves_count" integer DEFAULT 0,
	"views_count" integer DEFAULT 0,
	"is_public" boolean DEFAULT true,
	"is_featured" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "community_profiles" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"display_name" varchar NOT NULL,
	"bio" text DEFAULT '',
	"avatar_url" varchar,
	"specialty" varchar,
	"location" varchar,
	"experience_level" varchar DEFAULT 'beginner',
	"reputation_points" integer DEFAULT 0,
	"followers_count" integer DEFAULT 0,
	"following_count" integer DEFAULT 0,
	"posts_count" integer DEFAULT 0,
	"is_verified" boolean DEFAULT false,
	"website_url" varchar,
	"social_links" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "community_profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "community_saves" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"post_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "digital_transactions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"photo_id" varchar NOT NULL,
	"stripe_payment_intent_id" varchar NOT NULL,
	"amount" integer NOT NULL,
	"download_token" varchar NOT NULL,
	"status" varchar DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "digital_transactions_download_token_unique" UNIQUE("download_token")
);
--> statement-breakpoint
CREATE TABLE "download_entitlements" (
	"id" varchar PRIMARY KEY NOT NULL,
	"order_id" varchar,
	"session_id" varchar NOT NULL,
	"client_key" varchar NOT NULL,
	"photo_id" varchar,
	"remaining" integer NOT NULL,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "download_history" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"client_key" varchar NOT NULL,
	"photo_id" varchar NOT NULL,
	"token_id" varchar,
	"order_id" varchar,
	"ip_address" varchar,
	"user_agent" text,
	"status" varchar NOT NULL,
	"failure_reason" varchar,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "download_history_status_check" CHECK (
    status IN ('success', 'failed', 'denied', 'expired')
  )
);
--> statement-breakpoint
CREATE TABLE "download_orders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"client_key" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" varchar NOT NULL,
	"mode" varchar NOT NULL,
	"items" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"stripe_checkout_session_id" varchar,
	"stripe_payment_intent_id" varchar,
	"stripe_connect_account_id" varchar,
	"platform_fee_amount" numeric(10, 2),
	"status" varchar DEFAULT 'pending' NOT NULL,
	"receipt_url" varchar,
	"created_at" timestamp DEFAULT now(),
	"completed_at" timestamp,
	CONSTRAINT "download_orders_stripe_checkout_session_id_unique" UNIQUE("stripe_checkout_session_id"),
	CONSTRAINT "download_orders_stripe_payment_intent_id_unique" UNIQUE("stripe_payment_intent_id"),
	CONSTRAINT "download_orders_status_check" CHECK (
    status IN ('pending', 'processing', 'completed', 'failed', 'refunded')
  )
);
--> statement-breakpoint
CREATE TABLE "download_policies" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"mode" varchar NOT NULL,
	"price_per_photo" numeric(10, 2),
	"free_count" integer,
	"bulk_tiers" jsonb DEFAULT '[]'::jsonb,
	"max_per_client" integer,
	"max_global" integer,
	"screenshot_protection" boolean DEFAULT false,
	"currency" varchar DEFAULT 'USD',
	"tax_included" boolean DEFAULT false,
	"watermark_preset" varchar,
	"updated_by" varchar,
	"updated_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "download_policies_mode_check" CHECK (
    mode IN ('free', 'fixed', 'freemium', 'per_photo', 'bulk')
  )
);
--> statement-breakpoint
CREATE TABLE "download_tokens" (
	"id" varchar PRIMARY KEY NOT NULL,
	"token" varchar NOT NULL,
	"photo_url" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"is_used" boolean DEFAULT false,
	"used_at" timestamp,
	"one_time" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "download_tokens_token_unique" UNIQUE("token"),
	CONSTRAINT "download_tokens_token_session_key" UNIQUE("token","session_id")
);
--> statement-breakpoint
CREATE TABLE "gallery_downloads" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"client_key" varchar NOT NULL,
	"client_email" varchar,
	"client_name" varchar,
	"photo_id" varchar NOT NULL,
	"photo_url" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"download_type" varchar DEFAULT 'free' NOT NULL,
	"amount_paid" integer DEFAULT 0,
	"stripe_payment_id" varchar,
	"digital_transaction_id" varchar,
	"download_token" varchar NOT NULL,
	"is_watermarked" boolean DEFAULT false,
	"watermark_config" jsonb DEFAULT '{}'::jsonb,
	"ip_address" varchar,
	"user_agent" text,
	"status" varchar DEFAULT 'completed' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "gallery_downloads_digital_transaction_id_unique" UNIQUE("digital_transaction_id"),
	CONSTRAINT "gallery_downloads_download_token_unique" UNIQUE("download_token"),
	CONSTRAINT "download_type_consistency_check" CHECK (
    (download_type = 'free' AND amount_paid = 0 AND digital_transaction_id IS NULL) OR
    (download_type = 'paid' AND amount_paid > 0 AND digital_transaction_id IS NOT NULL)
  )
);
--> statement-breakpoint
CREATE TABLE "payment_plans" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"monthly_payment" numeric(10, 2) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"total_payments" integer NOT NULL,
	"payments_completed" integer DEFAULT 0,
	"amount_paid" numeric(10, 2) DEFAULT '0.00',
	"remaining_balance" numeric(10, 2) NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"next_payment_date" timestamp NOT NULL,
	"auto_send_invoices" boolean DEFAULT true,
	"reminder_days_before" integer DEFAULT 3,
	"payment_frequency" varchar DEFAULT 'monthly' NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "payment_records" (
	"id" varchar PRIMARY KEY NOT NULL,
	"plan_id" varchar NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"payment_number" integer NOT NULL,
	"due_date" timestamp NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"tip_amount" numeric(10, 2) DEFAULT '0.00',
	"status" varchar DEFAULT 'pending' NOT NULL,
	"paid_date" timestamp,
	"stripe_invoice_id" varchar,
	"stripe_invoice_url" varchar,
	"payment_method" varchar,
	"notes" text DEFAULT '',
	"reminder_sent" boolean DEFAULT false,
	"reminder_sent_at" timestamp,
	"invoice_sent" boolean DEFAULT false,
	"invoice_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photo_for_sale_settings" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"page_id" varchar NOT NULL,
	"photo_selector" text NOT NULL,
	"photo_url" varchar NOT NULL,
	"photo_filename" varchar NOT NULL,
	"is_for_sale" boolean DEFAULT true,
	"allow_prints" boolean DEFAULT true,
	"allow_digital" boolean DEFAULT true,
	"digital_price" numeric(10, 2) NOT NULL,
	"print_markup_percentage" numeric(5, 2) DEFAULT '25.00',
	"min_print_price" numeric(10, 2) DEFAULT '5.00',
	"featured_products" jsonb DEFAULT '[]'::jsonb,
	"custom_pricing" jsonb DEFAULT '{}'::jsonb,
	"sale_description" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photographer_clients" (
	"id" varchar PRIMARY KEY NOT NULL,
	"photographer_id" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"email" varchar,
	"phone_number" varchar,
	"notes" text,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"total_sessions" integer DEFAULT 0,
	"total_revenue" numeric(10, 2) DEFAULT '0.00',
	"last_session_date" timestamp,
	"last_contact_date" timestamp,
	"source" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "photography_sessions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"client_name" varchar NOT NULL,
	"session_type" varchar NOT NULL,
	"date_time" timestamp NOT NULL,
	"location" varchar NOT NULL,
	"phone_number" varchar NOT NULL,
	"email" varchar NOT NULL,
	"price" numeric(10, 2) NOT NULL,
	"deposit_amount" numeric(10, 2) DEFAULT '0.00',
	"duration" integer NOT NULL,
	"notes" text DEFAULT '',
	"contract_signed" boolean DEFAULT false,
	"paid" boolean DEFAULT false,
	"edited" boolean DEFAULT false,
	"delivered" boolean DEFAULT false,
	"send_reminder" boolean DEFAULT false,
	"notify_gallery_ready" boolean DEFAULT false,
	"photos" jsonb DEFAULT '[]'::jsonb,
	"gallery_access_token" varchar,
	"gallery_created_at" timestamp,
	"gallery_expires_at" timestamp,
	"gallery_ready_notified" boolean DEFAULT false,
	"last_gallery_notification" jsonb,
	"stripe_invoice" jsonb,
	"has_payment_plan" boolean DEFAULT false,
	"payment_plan_id" varchar,
	"total_amount" numeric(10, 2),
	"payment_plan_start_date" timestamp,
	"payment_plan_end_date" timestamp,
	"monthly_payment" numeric(10, 2),
	"payments_remaining" integer DEFAULT 0,
	"next_payment_date" timestamp,
	"download_enabled" boolean DEFAULT true,
	"download_max" integer,
	"pricing_model" varchar DEFAULT 'free',
	"free_downloads" integer DEFAULT 0,
	"price_per_download" numeric(10, 2) DEFAULT '0.00',
	"watermark_enabled" boolean DEFAULT false,
	"watermark_type" varchar DEFAULT 'text',
	"watermark_logo_url" varchar,
	"watermark_text" varchar DEFAULT '© Photography',
	"watermark_opacity" integer DEFAULT 60,
	"watermark_position" varchar DEFAULT 'bottom-right',
	"watermark_scale" integer DEFAULT 20,
	"watermark_updated_at" timestamp DEFAULT now(),
	"download_policy_id" varchar,
	"total_download_revenue" numeric(10, 2) DEFAULT '0.00',
	"last_download_activity" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "photography_sessions_user_id_id_key" UNIQUE("user_id","id")
);
--> statement-breakpoint
CREATE TABLE "print_carts" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"client_email" varchar,
	"items" jsonb DEFAULT '[]'::jsonb,
	"expires_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "print_orders" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar,
	"session_id" varchar,
	"photographer_id" varchar,
	"client_email" varchar,
	"client_name" varchar,
	"order_status" varchar DEFAULT 'pending',
	"oas_order_id" varchar,
	"editor_project_id" varchar,
	"items" jsonb DEFAULT '[]'::jsonb,
	"customer_info" jsonb,
	"shipping_info" jsonb,
	"subtotal" numeric(10, 2) DEFAULT '0.00',
	"shipping_cost" numeric(10, 2) DEFAULT '0.00',
	"tax" numeric(10, 2) DEFAULT '0.00',
	"total" numeric(10, 2) DEFAULT '0.00',
	"total_amount" numeric(10, 2) DEFAULT '0.00',
	"shipping_address" jsonb,
	"billing_address" jsonb,
	"payment_status" varchar DEFAULT 'pending',
	"payment_intent_id" varchar,
	"stripe_payment_intent_id" varchar,
	"photographer_profit" numeric(10, 2) DEFAULT '0.00',
	"platform_fee" numeric(10, 2) DEFAULT '0.00',
	"tracking_number" varchar,
	"production_date" timestamp,
	"ship_date" timestamp,
	"shipped_at" timestamp,
	"delivered_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "print_products" (
	"id" varchar PRIMARY KEY NOT NULL,
	"oas_product_id" varchar NOT NULL,
	"category_id" varchar,
	"category_name" varchar,
	"product_name" varchar NOT NULL,
	"product_description" text,
	"base_price" numeric(10, 2) NOT NULL,
	"photographer_price" numeric(10, 2),
	"sizes" jsonb DEFAULT '[]'::jsonb,
	"options" jsonb DEFAULT '[]'::jsonb,
	"thumbnail" varchar,
	"is_active" boolean DEFAULT true,
	"sort_order" integer DEFAULT 0,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"last_synced_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "print_products_oas_product_id_unique" UNIQUE("oas_product_id")
);
--> statement-breakpoint
CREATE TABLE "published_websites" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"subdomain" varchar NOT NULL,
	"custom_domain" varchar,
	"website_data" jsonb NOT NULL,
	"pages" jsonb DEFAULT '{}'::jsonb,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"theme" jsonb DEFAULT '{}'::jsonb,
	"is_published" boolean DEFAULT true,
	"published_at" timestamp DEFAULT now(),
	"last_updated" timestamp DEFAULT now(),
	"analytics" jsonb DEFAULT '{}'::jsonb,
	"ssl_enabled" boolean DEFAULT true,
	"custom_domain_verified" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "published_websites_subdomain_unique" UNIQUE("subdomain"),
	CONSTRAINT "published_websites_custom_domain_unique" UNIQUE("custom_domain")
);
--> statement-breakpoint
CREATE TABLE "r2_files" (
	"id" varchar PRIMARY KEY NOT NULL,
	"session_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"filename" varchar NOT NULL,
	"original_filename" varchar NOT NULL,
	"file_type" varchar NOT NULL,
	"file_extension" varchar NOT NULL,
	"file_size_bytes" varchar NOT NULL,
	"file_size_mb" numeric(12, 2) NOT NULL,
	"r2_key" varchar NOT NULL,
	"r2_url" varchar,
	"upload_status" varchar DEFAULT 'pending' NOT NULL,
	"upload_started_at" timestamp,
	"upload_completed_at" timestamp,
	"last_accessed_at" timestamp,
	"download_count" integer DEFAULT 0 NOT NULL,
	"is_public" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "r2_storage_billing" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"billing_month" varchar NOT NULL,
	"total_storage_tb" numeric(10, 6) DEFAULT '0' NOT NULL,
	"additional_tiers_purchased" integer DEFAULT 0 NOT NULL,
	"monthly_charge" numeric(10, 2) DEFAULT '0' NOT NULL,
	"session_count" integer DEFAULT 0 NOT NULL,
	"file_count" integer DEFAULT 0 NOT NULL,
	"billing_status" varchar DEFAULT 'pending' NOT NULL,
	"stripe_invoice_id" varchar,
	"invoiced_at" timestamp,
	"paid_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "r2_storage_usage" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"total_files" integer DEFAULT 0 NOT NULL,
	"total_size_bytes" varchar DEFAULT '0' NOT NULL,
	"total_size_gb" numeric(12, 3) DEFAULT '0' NOT NULL,
	"total_size_tb" numeric(10, 6) DEFAULT '0' NOT NULL,
	"base_storage_tb" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"additional_storage_tb" integer DEFAULT 0 NOT NULL,
	"max_allowed_tb" numeric(10, 2) DEFAULT '1.00' NOT NULL,
	"storage_status" varchar DEFAULT 'active' NOT NULL,
	"monthly_storage_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"stripe_storage_subscription_id" varchar,
	"last_usage_update" timestamp DEFAULT now(),
	"next_billing_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "storage_billing_history" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"subscription_id" varchar NOT NULL,
	"stripe_invoice_id" varchar NOT NULL,
	"billing_period_start" timestamp NOT NULL,
	"billing_period_end" timestamp NOT NULL,
	"package_count" integer NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"amount_paid" numeric(10, 2),
	"status" varchar NOT NULL,
	"invoice_url" varchar,
	"paid_at" timestamp,
	"due_date" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "storage_billing_history_stripe_invoice_id_unique" UNIQUE("stripe_invoice_id")
);
--> statement-breakpoint
CREATE TABLE "storage_subscriptions" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"stripe_subscription_id" varchar NOT NULL,
	"stripe_price_id" varchar NOT NULL,
	"package_count" integer DEFAULT 1 NOT NULL,
	"storage_amount_tb" integer DEFAULT 1 NOT NULL,
	"monthly_price" numeric(10, 2) DEFAULT '25.00' NOT NULL,
	"status" varchar DEFAULT 'active' NOT NULL,
	"current_period_start" timestamp NOT NULL,
	"current_period_end" timestamp NOT NULL,
	"cancel_at_period_end" boolean DEFAULT false,
	"cancelled_at" timestamp,
	"trial_start" timestamp,
	"trial_end" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "storage_subscriptions_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "subscribers" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar NOT NULL,
	"first_name" varchar,
	"last_name" varchar,
	"subscription_plan" varchar DEFAULT 'free',
	"status" varchar DEFAULT 'active',
	"welcome_email_sent" boolean DEFAULT false,
	"last_billing_notification" timestamp,
	"last_feature_update" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "subscribers_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "user_storage_quotas" (
	"id" varchar PRIMARY KEY NOT NULL,
	"user_id" varchar NOT NULL,
	"free_storage_gb" numeric(10, 3) DEFAULT '100.000' NOT NULL,
	"used_storage_bytes" varchar DEFAULT '0' NOT NULL,
	"used_storage_gb" numeric(12, 3) DEFAULT '0' NOT NULL,
	"total_quota_gb" numeric(12, 3) DEFAULT '100.000' NOT NULL,
	"purchased_packages" integer DEFAULT 0 NOT NULL,
	"monthly_storage_cost" numeric(10, 2) DEFAULT '0.00' NOT NULL,
	"quota_status" varchar DEFAULT 'active' NOT NULL,
	"last_warning_at" timestamp,
	"last_updated" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "user_storage_quotas_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY NOT NULL,
	"email" varchar,
	"username" varchar,
	"display_name" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"business_name" varchar,
	"business_type" varchar,
	"phone_number" varchar,
	"street_address" varchar,
	"city" varchar,
	"state" varchar,
	"zip_code" varchar,
	"onboarding_completed" boolean DEFAULT false,
	"onboarding_date" timestamp,
	"subscription_status" varchar DEFAULT 'trial',
	"subscription_plan" varchar DEFAULT 'basic',
	"subscription_expires_at" timestamp,
	"trial_start_date" timestamp,
	"trial_end_date" timestamp,
	"trial_used" boolean DEFAULT false,
	"trial_expired_notification_sent" boolean DEFAULT false,
	"access_restricted" boolean DEFAULT false,
	"stripe_customer_id" varchar,
	"stripe_subscription_id" varchar,
	"stripe_connect_account_id" varchar,
	"stripe_onboarding_complete" boolean DEFAULT false,
	"platform_fee_percentage" numeric(5, 2) DEFAULT '0.00',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	"subdomain" varchar,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_subdomain_unique" UNIQUE("subdomain")
);
--> statement-breakpoint
ALTER TABLE "ai_credit_usage" ADD CONSTRAINT "ai_credit_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "business_expenses" ADD CONSTRAINT "business_expenses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_comments" ADD CONSTRAINT "community_comments_parent_comment_id_community_comments_id_fk" FOREIGN KEY ("parent_comment_id") REFERENCES "public"."community_comments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_follows" ADD CONSTRAINT "community_follows_follower_id_users_id_fk" FOREIGN KEY ("follower_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_follows" ADD CONSTRAINT "community_follows_following_id_users_id_fk" FOREIGN KEY ("following_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_likes" ADD CONSTRAINT "community_likes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_likes" ADD CONSTRAINT "community_likes_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_messages" ADD CONSTRAINT "community_messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_posts" ADD CONSTRAINT "community_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_profiles" ADD CONSTRAINT "community_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_saves" ADD CONSTRAINT "community_saves_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_saves" ADD CONSTRAINT "community_saves_post_id_community_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."community_posts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_transactions" ADD CONSTRAINT "digital_transactions_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_transactions" ADD CONSTRAINT "digital_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_transactions" ADD CONSTRAINT "digital_transactions_download_token_download_tokens_token_fk" FOREIGN KEY ("download_token") REFERENCES "public"."download_tokens"("token") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "digital_transactions" ADD CONSTRAINT "digital_transactions_token_session_fkey" FOREIGN KEY ("download_token","session_id") REFERENCES "public"."download_tokens"("token","session_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD CONSTRAINT "download_entitlements_order_id_download_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."download_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_entitlements" ADD CONSTRAINT "download_entitlements_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_history" ADD CONSTRAINT "download_history_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_history" ADD CONSTRAINT "download_history_token_id_download_tokens_id_fk" FOREIGN KEY ("token_id") REFERENCES "public"."download_tokens"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_history" ADD CONSTRAINT "download_history_order_id_download_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."download_orders"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_orders" ADD CONSTRAINT "download_orders_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_orders" ADD CONSTRAINT "download_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_policies" ADD CONSTRAINT "download_policies_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "download_tokens" ADD CONSTRAINT "download_tokens_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_downloads" ADD CONSTRAINT "gallery_downloads_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_downloads" ADD CONSTRAINT "gallery_downloads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_downloads" ADD CONSTRAINT "gallery_downloads_digital_transaction_id_digital_transactions_id_fk" FOREIGN KEY ("digital_transaction_id") REFERENCES "public"."digital_transactions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_downloads" ADD CONSTRAINT "gallery_downloads_download_token_download_tokens_token_fk" FOREIGN KEY ("download_token") REFERENCES "public"."download_tokens"("token") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_downloads" ADD CONSTRAINT "gallery_downloads_user_session_fkey" FOREIGN KEY ("user_id","session_id") REFERENCES "public"."photography_sessions"("user_id","id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gallery_downloads" ADD CONSTRAINT "gallery_downloads_token_session_fkey" FOREIGN KEY ("download_token","session_id") REFERENCES "public"."download_tokens"("token","session_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_plans" ADD CONSTRAINT "payment_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_plan_id_payment_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."payment_plans"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment_records" ADD CONSTRAINT "payment_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photo_for_sale_settings" ADD CONSTRAINT "photo_for_sale_settings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photographer_clients" ADD CONSTRAINT "photographer_clients_photographer_id_users_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "photography_sessions" ADD CONSTRAINT "photography_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_orders" ADD CONSTRAINT "print_orders_photographer_id_users_id_fk" FOREIGN KEY ("photographer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "published_websites" ADD CONSTRAINT "published_websites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r2_files" ADD CONSTRAINT "r2_files_session_id_photography_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."photography_sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r2_files" ADD CONSTRAINT "r2_files_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r2_storage_billing" ADD CONSTRAINT "r2_storage_billing_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "r2_storage_usage" ADD CONSTRAINT "r2_storage_usage_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_billing_history" ADD CONSTRAINT "storage_billing_history_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_billing_history" ADD CONSTRAINT "storage_billing_history_subscription_id_storage_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."storage_subscriptions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "storage_subscriptions" ADD CONSTRAINT "storage_subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_storage_quotas" ADD CONSTRAINT "user_storage_quotas_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "unique_page_selector" ON "admin_content_edits" USING btree ("page","selector");--> statement-breakpoint
CREATE INDEX "idx_digital_transactions_session_date" ON "digital_transactions" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_session" ON "download_entitlements" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_client" ON "download_entitlements" USING btree ("client_key");--> statement-breakpoint
CREATE INDEX "idx_download_entitlements_session_client" ON "download_entitlements" USING btree ("session_id","client_key");--> statement-breakpoint
CREATE INDEX "idx_download_history_session" ON "download_history" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_download_history_client" ON "download_history" USING btree ("client_key");--> statement-breakpoint
CREATE INDEX "idx_download_orders_session" ON "download_orders" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_download_orders_status" ON "download_orders" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_download_orders_stripe_checkout" ON "download_orders" USING btree ("stripe_checkout_session_id");--> statement-breakpoint
CREATE INDEX "idx_download_orders_stripe_payment" ON "download_orders" USING btree ("stripe_payment_intent_id");--> statement-breakpoint
CREATE INDEX "idx_download_policies_session" ON "download_policies" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_download_tokens_session" ON "download_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "idx_download_tokens_token" ON "download_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_download_tokens_expires" ON "download_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_gallery_downloads_session_client" ON "gallery_downloads" USING btree ("session_id","client_key","status");--> statement-breakpoint
CREATE INDEX "idx_gallery_downloads_session_date" ON "gallery_downloads" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_photography_sessions_user_id" ON "photography_sessions" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");