ALTER TABLE "model_definitions" ADD COLUMN "ontology" text;--> statement-breakpoint
ALTER TABLE "model_definitions" ADD COLUMN "priority" text DEFAULT 'ALTERNATIVE';--> statement-breakpoint
ALTER TABLE "model_definitions" ADD COLUMN "invalidation" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "model_definitions" ADD COLUMN "temporalRules" jsonb DEFAULT 'null'::jsonb;--> statement-breakpoint
ALTER TABLE "model_definitions" ADD COLUMN "confusionGuards" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "model_definitions" ADD COLUMN "prerequisites" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
CREATE INDEX "idx_md_ontology" ON "model_definitions" USING btree ("ontology");--> statement-breakpoint
CREATE INDEX "idx_md_priority" ON "model_definitions" USING btree ("priority");