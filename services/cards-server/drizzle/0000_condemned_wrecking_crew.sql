CREATE SCHEMA "cards";
--> statement-breakpoint
CREATE TYPE "public"."cards_card_type" AS ENUM('basic', 'basic-reverse', 'cloze', 'type-in', 'image-occlusion', 'audio', 'multiple-choice');--> statement-breakpoint
CREATE TYPE "public"."cards_pr_status" AS ENUM('open', 'merged', 'closed', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."cards_ai_mod_verdict" AS ENUM('pass', 'flag', 'block');--> statement-breakpoint
CREATE TYPE "public"."cards_report_category" AS ENUM('spam', 'copyright', 'nsfw', 'misinformation', 'hate', 'other');--> statement-breakpoint
CREATE TYPE "public"."cards_report_status" AS ENUM('open', 'dismissed', 'actioned');--> statement-breakpoint
CREATE TABLE "cards"."author_follows" (
	"follower_user_id" text NOT NULL,
	"author_user_id" text NOT NULL,
	"since" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."authors" (
	"user_id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"display_name" text NOT NULL,
	"bio" text,
	"avatar_url" text,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"pseudonym" boolean DEFAULT false NOT NULL,
	"verified_mana" boolean DEFAULT false NOT NULL,
	"verified_community" boolean DEFAULT false NOT NULL,
	"banned_at" timestamp with time zone,
	"banned_reason" text
);
--> statement-breakpoint
CREATE TABLE "cards"."author_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"author_user_id" text NOT NULL,
	"source_purchase_id" uuid NOT NULL,
	"credits_granted" integer NOT NULL,
	"credits_grant_id" text,
	"granted_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."deck_purchases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"buyer_user_id" text NOT NULL,
	"deck_id" uuid NOT NULL,
	"version_id" uuid NOT NULL,
	"price_credits" integer NOT NULL,
	"author_share" integer NOT NULL,
	"mana_share" integer NOT NULL,
	"credits_transaction" text,
	"purchased_at" timestamp with time zone DEFAULT now() NOT NULL,
	"refunded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cards"."deck_cards" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"type" "cards_card_type" NOT NULL,
	"fields" jsonb NOT NULL,
	"ord" integer NOT NULL,
	"content_hash" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."deck_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"semver" text NOT NULL,
	"changelog" text,
	"content_hash" text NOT NULL,
	"card_count" integer NOT NULL,
	"published_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deprecated_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cards"."decks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"language" text,
	"license" text DEFAULT 'Cards-Personal-Use-1.0' NOT NULL,
	"price_credits" integer DEFAULT 0 NOT NULL,
	"owner_user_id" text NOT NULL,
	"latest_version_id" uuid,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_takedown" boolean DEFAULT false NOT NULL,
	"takedown_at" timestamp with time zone,
	"takedown_reason" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "decks_price_requires_license" CHECK (price_credits = 0 OR license = 'Cards-Pro-Only-1.0')
);
--> statement-breakpoint
CREATE TABLE "cards"."card_discussions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"card_content_hash" text NOT NULL,
	"deck_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"parent_id" uuid,
	"body" text NOT NULL,
	"hidden" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."deck_pull_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"author_user_id" text NOT NULL,
	"status" "cards_pr_status" DEFAULT 'open' NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"diff" jsonb NOT NULL,
	"merged_into_version_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cards"."deck_forks" (
	"user_id" text NOT NULL,
	"source_deck_id" uuid NOT NULL,
	"source_version_id" uuid NOT NULL,
	"forked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."deck_stars" (
	"user_id" text NOT NULL,
	"deck_id" uuid NOT NULL,
	"starred_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."deck_subscriptions" (
	"user_id" text NOT NULL,
	"deck_id" uuid NOT NULL,
	"current_version_id" uuid,
	"subscribed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notify_updates" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."deck_tags" (
	"deck_id" uuid NOT NULL,
	"tag_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."tag_definitions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"parent_id" uuid,
	"description" text,
	"curated" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."ai_moderation_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"version_id" uuid NOT NULL,
	"verdict" "cards_ai_mod_verdict" NOT NULL,
	"categories" text[],
	"model" text,
	"rationale" text,
	"human_reviewed" boolean DEFAULT false NOT NULL,
	"human_overrode" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cards"."deck_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deck_id" uuid NOT NULL,
	"version_id" uuid,
	"card_content_hash" text,
	"reporter_user_id" text NOT NULL,
	"category" "cards_report_category" NOT NULL,
	"body" text,
	"status" "cards_report_status" DEFAULT 'open' NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"resolution_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cards"."author_follows" ADD CONSTRAINT "author_follows_author_user_id_authors_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "cards"."authors"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."author_payouts" ADD CONSTRAINT "author_payouts_author_user_id_authors_user_id_fk" FOREIGN KEY ("author_user_id") REFERENCES "cards"."authors"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."author_payouts" ADD CONSTRAINT "author_payouts_source_purchase_id_deck_purchases_id_fk" FOREIGN KEY ("source_purchase_id") REFERENCES "cards"."deck_purchases"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_purchases" ADD CONSTRAINT "deck_purchases_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cards"."decks"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_purchases" ADD CONSTRAINT "deck_purchases_version_id_deck_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "cards"."deck_versions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_cards" ADD CONSTRAINT "deck_cards_version_id_deck_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "cards"."deck_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_versions" ADD CONSTRAINT "deck_versions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cards"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."decks" ADD CONSTRAINT "decks_owner_user_id_authors_user_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "cards"."authors"("user_id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."card_discussions" ADD CONSTRAINT "card_discussions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cards"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_pull_requests" ADD CONSTRAINT "deck_pull_requests_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cards"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_pull_requests" ADD CONSTRAINT "deck_pull_requests_merged_into_version_id_deck_versions_id_fk" FOREIGN KEY ("merged_into_version_id") REFERENCES "cards"."deck_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_forks" ADD CONSTRAINT "deck_forks_source_deck_id_decks_id_fk" FOREIGN KEY ("source_deck_id") REFERENCES "cards"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_forks" ADD CONSTRAINT "deck_forks_source_version_id_deck_versions_id_fk" FOREIGN KEY ("source_version_id") REFERENCES "cards"."deck_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_stars" ADD CONSTRAINT "deck_stars_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cards"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_subscriptions" ADD CONSTRAINT "deck_subscriptions_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cards"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_subscriptions" ADD CONSTRAINT "deck_subscriptions_current_version_id_deck_versions_id_fk" FOREIGN KEY ("current_version_id") REFERENCES "cards"."deck_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_tags" ADD CONSTRAINT "deck_tags_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cards"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_tags" ADD CONSTRAINT "deck_tags_tag_id_tag_definitions_id_fk" FOREIGN KEY ("tag_id") REFERENCES "cards"."tag_definitions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."ai_moderation_log" ADD CONSTRAINT "ai_moderation_log_version_id_deck_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "cards"."deck_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_reports" ADD CONSTRAINT "deck_reports_deck_id_decks_id_fk" FOREIGN KEY ("deck_id") REFERENCES "cards"."decks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cards"."deck_reports" ADD CONSTRAINT "deck_reports_version_id_deck_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "cards"."deck_versions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "author_follows_pk" ON "cards"."author_follows" USING btree ("follower_user_id","author_user_id");--> statement-breakpoint
CREATE INDEX "author_follows_author_idx" ON "cards"."author_follows" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "author_follows_follower_idx" ON "cards"."author_follows" USING btree ("follower_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "authors_slug_idx" ON "cards"."authors" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "authors_verified_idx" ON "cards"."authors" USING btree ("verified_mana","verified_community");--> statement-breakpoint
CREATE INDEX "author_payouts_author_idx" ON "cards"."author_payouts" USING btree ("author_user_id");--> statement-breakpoint
CREATE INDEX "author_payouts_purchase_idx" ON "cards"."author_payouts" USING btree ("source_purchase_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_purchases_buyer_deck_idx" ON "cards"."deck_purchases" USING btree ("buyer_user_id","deck_id");--> statement-breakpoint
CREATE INDEX "deck_purchases_buyer_idx" ON "cards"."deck_purchases" USING btree ("buyer_user_id");--> statement-breakpoint
CREATE INDEX "deck_purchases_deck_idx" ON "cards"."deck_purchases" USING btree ("deck_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_cards_version_ord_idx" ON "cards"."deck_cards" USING btree ("version_id","ord");--> statement-breakpoint
CREATE INDEX "deck_cards_hash_idx" ON "cards"."deck_cards" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_versions_deck_semver_idx" ON "cards"."deck_versions" USING btree ("deck_id","semver");--> statement-breakpoint
CREATE INDEX "deck_versions_deck_idx" ON "cards"."deck_versions" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "deck_versions_hash_idx" ON "cards"."deck_versions" USING btree ("content_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "decks_slug_idx" ON "cards"."decks" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "decks_owner_idx" ON "cards"."decks" USING btree ("owner_user_id");--> statement-breakpoint
CREATE INDEX "decks_featured_idx" ON "cards"."decks" USING btree ("is_featured");--> statement-breakpoint
CREATE INDEX "card_discussions_hash_idx" ON "cards"."card_discussions" USING btree ("card_content_hash");--> statement-breakpoint
CREATE INDEX "card_discussions_deck_idx" ON "cards"."card_discussions" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "card_discussions_parent_idx" ON "cards"."card_discussions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "deck_pull_requests_deck_idx" ON "cards"."deck_pull_requests" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "deck_pull_requests_status_idx" ON "cards"."deck_pull_requests" USING btree ("deck_id","status");--> statement-breakpoint
CREATE INDEX "deck_pull_requests_author_idx" ON "cards"."deck_pull_requests" USING btree ("author_user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_forks_pk" ON "cards"."deck_forks" USING btree ("user_id","source_deck_id","source_version_id");--> statement-breakpoint
CREATE INDEX "deck_forks_source_idx" ON "cards"."deck_forks" USING btree ("source_deck_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_stars_pk" ON "cards"."deck_stars" USING btree ("user_id","deck_id");--> statement-breakpoint
CREATE INDEX "deck_stars_deck_idx" ON "cards"."deck_stars" USING btree ("deck_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_subscriptions_pk" ON "cards"."deck_subscriptions" USING btree ("user_id","deck_id");--> statement-breakpoint
CREATE INDEX "deck_subscriptions_deck_idx" ON "cards"."deck_subscriptions" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "deck_subscriptions_user_idx" ON "cards"."deck_subscriptions" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "deck_tags_pk" ON "cards"."deck_tags" USING btree ("deck_id","tag_id");--> statement-breakpoint
CREATE INDEX "deck_tags_tag_idx" ON "cards"."deck_tags" USING btree ("tag_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_definitions_slug_idx" ON "cards"."tag_definitions" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "tag_definitions_parent_idx" ON "cards"."tag_definitions" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "ai_moderation_log_version_idx" ON "cards"."ai_moderation_log" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "ai_moderation_log_verdict_idx" ON "cards"."ai_moderation_log" USING btree ("verdict");--> statement-breakpoint
CREATE INDEX "deck_reports_deck_idx" ON "cards"."deck_reports" USING btree ("deck_id");--> statement-breakpoint
CREATE INDEX "deck_reports_status_idx" ON "cards"."deck_reports" USING btree ("status");