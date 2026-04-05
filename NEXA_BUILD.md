# Nexa — Build Specification
> UK Construction Procurement Intelligence Platform

---

## Overview

Nexa is a procurement intelligence tool for UK construction contractors, consultants, and specialists. It ingests live tender notices from UK government procurement APIs, filters by construction-relevant CPV codes, and surfaces opportunities in a clean dashboard. The MVP goal is a live data feed, filterable dashboard, and a landing page with waitlist capture — deployable tonight to gauge interest.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Styling | Tailwind CSS |
| Database | Supabase (Postgres) |
| ORM | Prisma |
| Hosting | Vercel |
| AI enrichment | Anthropic API (claude-sonnet-4-20250514) |
| Email | Resend |
| Cron / background | Vercel Cron Jobs |

---

## Design Language

Dark mode default. Surgical minimalism. No decorative elements.

- **Background:** `#0A0A0A`
- **Surface:** `#141414` / `#1A1A1A`
- **Text primary:** `#F5F5F5`
- **Text secondary:** `#A0A0A0`
- **Accent:** `#2563EB` (blue — used only for CTAs, active states, status indicators)
- **Borders:** `rgba(255,255,255,0.07)`
- **Font:** DM Sans (headings + body) + JetBrains Mono (data values, codes, CPV codes)
- **Border radius:** 6px cards, 4px buttons/inputs — never pill-shaped
- **Shadows:** none or minimal (1 level max)
- **No gradients, no illustrations, no icons for decoration**

---

## MVP Scope (Tonight)

### What ships tonight

1. Contracts Finder API ingestion (no auth required)
2. CPV filtering for construction codes
3. Opportunities dashboard with filter bar
4. Opportunity detail drawer
5. Landing page with waitlist email capture
6. Vercel deployment

### What does NOT ship tonight

- User accounts / auth
- Find a Tender or Public Contracts Scotland ingestion (v1.1)
- AI enrichment / fit scoring (v1.2)
- Email digest alerts (v2)
- Pricing page

---

## Data Sources

### Priority order

| Priority | API | Auth | Coverage |
|---|---|---|---|
| ① | Contracts Finder API | None | England + wider non-devolved UK |
| ② | Find a Tender OCDS API | API key | Regulated / high-value UK notices |
| ③ | Public Contracts Scotland | None | Scotland |
| ④ | data.gov.uk archives | None | Historical backfill only |

### Contracts Finder — wire this first

- **API docs root:** `https://www.contractsfinder.service.gov.uk/apidocumentation`
- **OCDS notice search:** `https://www.contractsfinder.service.gov.uk/apidocumentation/Notices/1/GET-Published-Notice-OCDS-Search`
- **V2 features (SME flags, supply-chain notices):** `https://www.contractsfinder.service.gov.uk/apidocumentation/V2`
- No API key required. Start immediately.

### Find a Tender — v1.1

- **Developer docs:** `https://www.find-tender.service.gov.uk/Developer/Documentation`
- **REST API docs:** `https://www.find-tender.service.gov.uk/apidocumentation`
- **OCDS release packages:** `https://www.find-tender.service.gov.uk/api/1.0/ocdsReleasePackages`
- **OCDS record packages:** `https://www.find-tender.service.gov.uk/apidocumentation/1.0/GET-ocdsRecordPackages`
- API key required — apply at the developer docs URL above while building tonight.

### Public Contracts Scotland — v1.1

- **API root:** `https://api.publiccontractsscotland.gov.uk`
- **Notices list:** `https://api.publiccontractsscotland.gov.uk/v1/Notices`
- **Notice family by OCID:** `https://api.publiccontractsscotland.gov.uk/v1/Notice?id={ocid}`
- No separate key stated in docs — public query endpoints.

---

## Database Schema

### `sources`

```sql
id            uuid PK
name          text          -- 'contracts_finder', 'find_a_tender', 'pcs'
base_url      text
auth_type     text          -- 'none', 'api_key'
last_synced   timestamptz
is_active     boolean
```

### `opportunities`

```sql
id                  uuid PK default gen_random_uuid()
source_system       text          -- 'contracts_finder' | 'find_a_tender' | 'pcs'
source_notice_id    text
ocid                text UNIQUE
notice_type         text          -- 'contract_notice' | 'award_notice' | 'prior_info' | 'framework'
title               text
description_raw     text
description_summary text          -- AI-generated, v1.2
buyer_name          text
buyer_identifier    text
buyer_type          text
published_at        timestamptz
updated_at          timestamptz
tender_deadline     timestamptz
contract_start      date
contract_end        date
value_min           numeric
value_max           numeric
currency            text DEFAULT 'GBP'
framework_flag      boolean DEFAULT false
lots_flag           boolean DEFAULT false
lot_count           int
location_text       text
region_code         text
postcode            text
cpv_primary         text
cpv_additional      text[]
keywords            text[]
documents           jsonb
status              text          -- 'live' | 'closing_soon' | 'closed'
source_url          text
raw_payload         jsonb
created_at          timestamptz DEFAULT now()

-- Full-text search
search_vector       tsvector GENERATED ALWAYS AS (
  to_tsvector('english', coalesce(title,'') || ' ' || coalesce(description_raw,''))
) STORED
```

```sql
CREATE INDEX ON opportunities USING GIN(search_vector);
CREATE INDEX ON opportunities(cpv_primary);
CREATE INDEX ON opportunities(status);
CREATE INDEX ON opportunities(tender_deadline);
CREATE INDEX ON opportunities(source_system);
```

### `buyers`

```sql
id              uuid PK
identifier      text UNIQUE
name            text
type            text
region          text
```

### `cpv_codes`

```sql
opportunity_id  uuid FK → opportunities.id
cpv_code        text
is_primary      boolean
```

### `documents`

```sql
id              uuid PK
opportunity_id  uuid FK → opportunities.id
title           text
url             text
mime_type       text
extracted_text  text          -- async OCR, v1.2
```

### `sync_logs`

```sql
id              uuid PK
source_system   text
started_at      timestamptz
completed_at    timestamptz
notices_fetched int
notices_new     int
notices_updated int
error           text
```

### `waitlist`

```sql
id          uuid PK default gen_random_uuid()
email       text UNIQUE NOT NULL
trade       text          -- optional: 'general_contractor' | 'mep' | 'consultant' | 'specialist' | 'other'
company     text
created_at  timestamptz DEFAULT now()
```

### `ai_extractions` (v1.2)

```sql
id              uuid PK
opportunity_id  uuid FK → opportunities.id
trade_class     text
risk_flags      text[]
fit_signals     jsonb
model           text
created_at      timestamptz
```

### `user_profiles` (v2)

```sql
id              uuid PK
user_id         uuid FK → auth.users
trade           text
regions         text[]
value_min       numeric
value_max       numeric
target_cpvs     text[]
```

### `match_scores` (v2)

```sql
id              uuid PK
user_id         uuid FK → user_profiles.id
opportunity_id  uuid FK → opportunities.id
trade_score     numeric
geo_score       numeric
value_score     numeric
buyer_score     numeric
timing_score    numeric
overall_score   numeric
created_at      timestamptz
```

---

## Ingestion Pipeline

### Architecture

```
Fetch layer → Normalize layer → Enrichment layer (v1.2) → Scoring layer (v1.2)
```

### Fetch layer (MVP)

File: `lib/ingestion/contracts-finder.ts`

- Call OCDS search endpoint with CPV filter params
- Paginate through all results using `page` and `limit` params
- Throttle: **1–2 requests per second maximum**
- On 429 or 5xx: exponential backoff starting at 2s, max 5 retries
- Store raw OCDS JSON in `raw_payload` before any transformation

### Normalize layer

File: `lib/ingestion/normalize.ts`

- Map OCDS fields to canonical schema columns
- Handle missing/null values defensively — CPV codes and values are often absent
- Detect duplicates by `ocid` — update on conflict, do not insert duplicate
- Compute `status`:
  - `closed` if `tender_deadline` is in the past
  - `closing_soon` if `tender_deadline` is within 5 days
  - `live` otherwise

### Sync cadence

- Vercel Cron: every 30 minutes for live notice pull
- Incremental: filter by `publishedFrom` date — do not re-pull full history each time
- Log every sync run to `sync_logs`

### CPV filter — construction codes to index

```
45000000   Construction work
45100000   Site preparation
45200000   Civil engineering and building
45210000   Building construction
45300000   Building installation (electrical, HVAC, MEP)
45400000   Building completion (fit-out, finishes)
50000000   Repair and maintenance
71000000   Architecture, construction, engineering, inspection
71200000   Architectural services
71300000   Engineering services
71500000   Construction-related services
72224000   Project management consultancy
```

---

## Pages and Routes

### `app/page.tsx` — Landing page

Sections in order:
1. **Nav** — Logo "Nexa", "Get early access" button (scrolls to waitlist)
2. **Hero** — Headline, sub, waitlist email input, submit button
3. **Stats bar** — 3 numbers: total notices indexed, total £ value tracked, sources connected (pull from DB)
4. **Live preview** — 6 most recent live opportunities (no auth, real data)
5. **How it works** — 3 steps: We index → You filter → You bid
6. **Waitlist form** — email + trade dropdown + company (all optional except email)
7. **Footer** — Nexa, a Staqtech product

Hero copy:
> **Every UK construction tender. One feed.**
> Stop checking three portals. Nexa pulls from Contracts Finder, Find a Tender, and Public Contracts Scotland — filtered for your trade, region, and value range.

### `app/dashboard/page.tsx` — Opportunities dashboard

Layout: sidebar filter panel (240px) + main content area

**Filter bar (left sidebar):**
- Keyword search (full-text against title + description)
- Trade / CPV family (multi-select): General Works, Civil Engineering, Fit-Out, MEP, Architecture & Engineering, Maintenance, PM & Consultancy
- Region (multi-select): London, South East, South West, Midlands, North West, North East, Yorkshire, Scotland, Wales, Northern Ireland, National
- Value band (range slider or checkboxes): <£50k, £50k–£250k, £250k–£1m, £1m–£5m, £5m+
- Status (toggle): Live only / All
- Source (checkboxes): Contracts Finder, Find a Tender, PCS

**Opportunity cards:**
- Title (truncated to 2 lines)
- Buyer name + buyer type badge
- Value (formatted: "£1.2m" or "£250,000" or "Value not stated")
- Deadline (relative: "Closes in 14 days" — red if ≤5 days)
- Region
- CPV primary code + label
- Source badge (CF / FaT / PCS)
- Status pill (Live / Closing Soon / Closed)

**Sort options:** Newest first / Deadline soonest / Value (high to low)

**Opportunity detail drawer (right slide-over):**
- Full title
- Full description
- Buyer details
- Value range
- Deadline
- Contract start/end
- CPV codes (all)
- Documents list with links
- Source link ("View on Contracts Finder →")

### `app/api/opportunities/route.ts`

Query params: `cpv`, `region`, `value_min`, `value_max`, `status`, `q`, `sort`, `page`, `limit`
Returns paginated opportunities from DB.

### `app/api/ingest/route.ts`

Protected route (cron secret header). Triggers Contracts Finder sync.

### `app/api/waitlist/route.ts`

POST: email, trade, company → insert to `waitlist` table → trigger Resend welcome email.

---

## AI Enrichment (v1.2)

Run as async background job after ingest. Do not block the feed.

**Model:** `claude-sonnet-4-20250514`

**Prompt (per opportunity):**

```
You are a UK construction procurement analyst. Given the following tender notice, extract:

1. trade_classification: one of [general_contractor, civils, mep, fit_out, roofing, architecture, engineering, pm_consultancy, maintenance, specialist, other]
2. risk_flags: array of applicable flags from [short_deadline, bond_required, framework_only, mandatory_accreditations, multi_lot_complexity, heavy_documentation, unclear_scope]
3. summary: 2-sentence plain English summary of what is being procured

Respond only in JSON. No preamble.

Notice title: {title}
Buyer: {buyer_name}
Description: {description_raw}
CPV: {cpv_primary}
Deadline: {tender_deadline}
Value: {value_min}–{value_max}
```

Store results in `ai_extractions` and surface risk flags on opportunity cards.

---

## Fit Score Formula (v1.2)

```
overall_fit = (0.35 × trade_score)
            + (0.25 × geography_score)
            + (0.20 × value_score)
            + (0.10 × buyer_score)
            + (0.10 × timing_score)
```

Each component is 0–1. Store per user per opportunity in `match_scores`.

---

## Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Anthropic (v1.2)
ANTHROPIC_API_KEY=

# Resend
RESEND_API_KEY=
RESEND_FROM_EMAIL=hello@nexa.staqtech.com

# Find a Tender (v1.1 — apply now)
FIND_A_TENDER_API_KEY=

# Cron protection
CRON_SECRET=

# App
NEXT_PUBLIC_APP_URL=https://nexa.staqtech.com
```

---

## Rate Limiting and Resilience

| Behaviour | Setting |
|---|---|
| Requests per second | 1–2 per source |
| Retry on 429 | Exponential backoff: 2s, 4s, 8s, 16s, max 5 attempts |
| Retry on 5xx | Same backoff |
| Cache list endpoints | 5 min in-memory or Redis |
| Sync strategy | Incremental by `publishedFrom` date, not full re-pull |
| Deduplication | By `ocid` — upsert, not insert |
| Dead letter | Log malformed/partial notices to `sync_logs.error`, skip and continue |

---

## Tonight's Deploy Checklist

- [ ] Supabase project created, schema migrated, RLS disabled for now
- [ ] Contracts Finder ingest script running, data appearing in DB
- [ ] Dashboard rendering live opportunities with CPV + region filter working
- [ ] Opportunity detail drawer opening correctly
- [ ] Landing page live with working waitlist form
- [ ] Resend welcome email sending on waitlist signup
- [ ] Vercel deployment live
- [ ] Custom domain pointed (nexa.staqtech.com or similar)
- [ ] Apply for Find a Tender API key (do this now, takes time)

---

## File Structure

```
nexa/
├── app/
│   ├── page.tsx                    # Landing page
│   ├── dashboard/
│   │   └── page.tsx                # Opportunities dashboard
│   └── api/
│       ├── opportunities/route.ts  # Query opportunities
│       ├── ingest/route.ts         # Cron trigger
│       └── waitlist/route.ts       # Email capture
├── lib/
│   ├── ingestion/
│   │   ├── contracts-finder.ts     # CF API connector
│   │   ├── find-a-tender.ts        # FaT connector (v1.1)
│   │   ├── pcs.ts                  # PCS connector (v1.1)
│   │   └── normalize.ts            # OCDS → canonical schema
│   ├── db/
│   │   └── client.ts               # Supabase + Prisma client
│   ├── ai/
│   │   └── enrichment.ts           # Claude extraction (v1.2)
│   └── scoring/
│       └── fit-score.ts            # Match scoring (v1.2)
├── components/
│   ├── OpportunityCard.tsx
│   ├── OpportunityDrawer.tsx
│   ├── FilterSidebar.tsx
│   └── WaitlistForm.tsx
├── prisma/
│   └── schema.prisma
└── vercel.json                     # Cron config
```

### `vercel.json` cron config

```json
{
  "crons": [
    {
      "path": "/api/ingest",
      "schedule": "*/30 * * * *"
    }
  ]
}
```

---

## Known Risks

- **Contracts Finder rate limits are undisclosed.** A "rate limit exceeded" error is documented but no numeric limit is published. Start at 1 req/sec and monitor.
- **Find a Tender API key takes time to issue.** Apply immediately so it's ready for v1.1.
- **OCDS payloads are inconsistent across sources.** Value fields (`estimatedValue`, `minValue`, `maxValue`) are frequently null or structured differently per source. Handle all nulls defensively.
- **CPV codes are sometimes missing or wrong on notices.** Supplement with keyword extraction from title and description for fallback classification.
- **Document/attachment URLs may expire.** Do not treat stored URLs as permanent. Re-fetch on view, not on ingest.
- **PCS notice volume includes lower-value Quick Quotes.** May need a minimum value filter to avoid noise once PCS is wired.

---

*Nexa is a Staqtech product. Build started: April 2026.*
