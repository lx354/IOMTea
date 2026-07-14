CREATE TYPE "public"."alert_severity" AS ENUM('critical', 'warning', 'info');--> statement-breakpoint
CREATE TYPE "public"."alert_status" AS ENUM('active', 'acknowledged', 'resolved');--> statement-breakpoint
CREATE TYPE "public"."device_status" AS ENUM('active', 'inactive', 'maintenance');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('mattress', 'vision', 'imu', 'generic', 'simulator', 'custom');--> statement-breakpoint
CREATE TYPE "public"."kind" AS ENUM('observation', 'alert');--> statement-breakpoint
CREATE TYPE "public"."patient_status" AS ENUM('active', 'discharged');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('admin', 'doctor', 'nurse', 'caregiver');--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" varchar(100) NOT NULL,
	"resource" varchar(100) NOT NULL,
	"resource_id" varchar(50),
	"details" jsonb DEFAULT '{}'::jsonb,
	"ip" varchar(50),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "devices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"serial_number" varchar(100) NOT NULL,
	"device_type" "device_type" NOT NULL,
	"status" "device_status" DEFAULT 'active' NOT NULL,
	"patient_id" uuid,
	"last_seen" timestamp with time zone,
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "devices_serial_number_unique" UNIQUE("serial_number")
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"patient_id" uuid NOT NULL,
	"device_id" uuid NOT NULL,
	"kind" "kind" NOT NULL,
	"metric" varchar(50) NOT NULL,
	"value" double precision,
	"unit" varchar(20),
	"severity" "alert_severity",
	"status" "alert_status",
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"recorded_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ingest_raw_data" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source" varchar(50) NOT NULL,
	"raw_payload" text NOT NULL,
	"status" varchar(20) DEFAULT 'received' NOT NULL,
	"error" text,
	"processed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "patients" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"birth_date" varchar(10),
	"gender" varchar(10),
	"room" varchar(20),
	"bed_number" varchar(20),
	"status" "patient_status" DEFAULT 'active' NOT NULL,
	"tags" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" varchar(50) NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" varchar(100) NOT NULL,
	"role" "role" DEFAULT 'caregiver' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "devices" ADD CONSTRAINT "devices_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_patient_id_patients_id_fk" FOREIGN KEY ("patient_id") REFERENCES "public"."patients"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_device_id_devices_id_fk" FOREIGN KEY ("device_id") REFERENCES "public"."devices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "events_patient_metric_time_idx" ON "events" USING btree ("patient_id","metric","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_patient_kind_time_idx" ON "events" USING btree ("patient_id","kind","recorded_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "events_device_time_idx" ON "events" USING btree ("device_id","recorded_at" DESC NULLS LAST);