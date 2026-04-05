-- CreateTable
CREATE TABLE "sources" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" TEXT NOT NULL,
    "base_url" TEXT NOT NULL,
    "auth_type" TEXT NOT NULL,
    "last_synced" TIMESTAMPTZ,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opportunities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_system" TEXT NOT NULL,
    "source_notice_id" TEXT,
    "ocid" TEXT NOT NULL,
    "notice_type" TEXT,
    "title" TEXT,
    "description_raw" TEXT,
    "description_summary" TEXT,
    "buyer_name" TEXT,
    "buyer_identifier" TEXT,
    "buyer_type" TEXT,
    "published_at" TIMESTAMPTZ,
    "updated_at" TIMESTAMPTZ,
    "tender_deadline" TIMESTAMPTZ,
    "contract_start" DATE,
    "contract_end" DATE,
    "value_min" DECIMAL,
    "value_max" DECIMAL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "framework_flag" BOOLEAN NOT NULL DEFAULT false,
    "lots_flag" BOOLEAN NOT NULL DEFAULT false,
    "lot_count" INTEGER,
    "location_text" TEXT,
    "region_code" TEXT,
    "postcode" TEXT,
    "cpv_primary" TEXT,
    "cpv_additional" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "documents" JSONB,
    "status" TEXT NOT NULL DEFAULT 'live',
    "source_url" TEXT,
    "raw_payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "opportunities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "identifier" TEXT NOT NULL,
    "name" TEXT,
    "type" TEXT,
    "region" TEXT,
    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sync_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "source_system" TEXT NOT NULL,
    "started_at" TIMESTAMPTZ NOT NULL,
    "completed_at" TIMESTAMPTZ,
    "notices_fetched" INTEGER,
    "notices_new" INTEGER,
    "notices_updated" INTEGER,
    "error" TEXT,
    CONSTRAINT "sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "waitlist" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" TEXT NOT NULL,
    "trade" TEXT,
    "company" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT "waitlist_pkey" PRIMARY KEY ("id")
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "opportunities_ocid_key" ON "opportunities"("ocid");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "buyers_identifier_key" ON "buyers"("identifier");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "waitlist_email_key" ON "waitlist"("email");

-- CreateIndex
CREATE INDEX "opportunities_cpv_primary_idx" ON "opportunities"("cpv_primary");
CREATE INDEX "opportunities_status_idx" ON "opportunities"("status");
CREATE INDEX "opportunities_tender_deadline_idx" ON "opportunities"("tender_deadline");
CREATE INDEX "opportunities_source_system_idx" ON "opportunities"("source_system");

-- Full text search index
CREATE INDEX opportunities_search_idx ON opportunities
  USING GIN (to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description_raw,'')));
