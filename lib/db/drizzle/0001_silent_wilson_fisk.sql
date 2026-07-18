CREATE TABLE "economic_events" (
	"time" integer NOT NULL,
	"currency" text NOT NULL,
	"event" text NOT NULL,
	"impact" text,
	"forecast" text,
	"previous" text,
	"actual" text,
	"refreshed_at" timestamp DEFAULT now() NOT NULL,
	"source" text DEFAULT 'forexfactory' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "idx_ee_upsert" ON "economic_events" USING btree ("time","currency","event");--> statement-breakpoint
CREATE INDEX "idx_ee_currency" ON "economic_events" USING btree ("currency");--> statement-breakpoint
CREATE INDEX "idx_ee_impact" ON "economic_events" USING btree ("impact");--> statement-breakpoint
CREATE INDEX "idx_ee_time" ON "economic_events" USING btree ("time");