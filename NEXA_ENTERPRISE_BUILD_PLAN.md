# Nexa Enterprise Features - Build Plan

> **Purpose**: Step-by-step implementation guide for adding 5 enterprise features to Nexa.
> **Stack**: Next.js 14 (App Router), Prisma + PostgreSQL (Supabase), Supabase Auth, OpenRouter (Qwen), Tailwind CSS.
> **AI Provider**: OpenRouter (`https://openrouter.ai/api/v1/chat/completions`) with `OPENROUTER_API_KEY` env var.

---

## Table of Contents

1. [Feature 1: Corporate Knowledge Base (RAG)](#feature-1-corporate-knowledge-base-rag)
2. [Feature 2: Go/No-Go Decision Summaries](#feature-2-gono-go-decision-summaries)
3. [Feature 3: Pre-Submission Compliance Checker](#feature-3-pre-submission-compliance-checker)
4. [Feature 4: In-Line Copilot Document Editor](#feature-4-in-line-copilot-document-editor)
5. [Feature 5: Teaming & Export Integrations](#feature-5-teaming--export-integrations)

---

## Feature 1: Corporate Knowledge Base (RAG)

### Goal
Allow users to upload company documents (past proposals, CVs, case studies, compliance certs, company profiles). When the AI generates a proposal, it retrieves relevant chunks from these documents and injects real company data instead of generic filler.

### 1.1 Database Schema Changes

**File**: `prisma/schema.prisma`

Add these models:

```prisma
model KnowledgeDocument {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id     String
  file_name   String
  file_type   String           // "proposal", "cv", "case_study", "cert", "company_profile", "other"
  file_url    String           // Supabase Storage URL
  file_size   Int
  status      String   @default("processing") // "processing", "ready", "error"
  created_at  DateTime @default(now()) @db.Timestamptz
  updated_at  DateTime @default(now()) @db.Timestamptz

  chunks KnowledgeChunk[]

  @@index([user_id])
  @@index([file_type])
  @@map("knowledge_documents")
}

model KnowledgeChunk {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  document_id String   @db.Uuid
  user_id     String
  content     String
  embedding   Unsupported("vector(1536)")?  // pgvector embedding
  metadata    Json?            // { page, section, heading, etc. }
  created_at  DateTime @default(now()) @db.Timestamptz

  document KnowledgeDocument @relation(fields: [document_id], references: [id], onDelete: Cascade)

  @@index([user_id])
  @@index([document_id])
  @@map("knowledge_chunks")
}
```

**Action items**:
- [ ] Run `npx prisma migrate dev --name add_knowledge_base`
- [ ] Enable pgvector extension in Supabase: `CREATE EXTENSION IF NOT EXISTS vector;`
- [ ] Create a similarity search SQL function in Supabase:

```sql
CREATE OR REPLACE FUNCTION match_knowledge_chunks(
  query_embedding vector(1536),
  match_user_id text,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE sql STABLE
AS $$
  SELECT
    kc.id,
    kc.content,
    kc.metadata,
    1 - (kc.embedding <=> query_embedding) AS similarity
  FROM knowledge_chunks kc
  WHERE kc.user_id = match_user_id
    AND 1 - (kc.embedding <=> query_embedding) > match_threshold
  ORDER BY kc.embedding <=> query_embedding
  LIMIT match_count;
$$;
```

### 1.2 File Upload API

**File to create**: `app/api/knowledge/upload/route.ts`

Requirements:
- [ ] Accept multipart form data (PDF, DOCX, TXT files)
- [ ] Max file size: 10MB
- [ ] Validate file type (only `.pdf`, `.docx`, `.txt`, `.doc`)
- [ ] Upload file to Supabase Storage bucket named `knowledge-docs`
- [ ] Create `KnowledgeDocument` record with status `"processing"`
- [ ] Return the document ID immediately
- [ ] Trigger async processing (chunking + embedding) - see 1.3

### 1.3 Document Processing Pipeline

**File to create**: `lib/knowledge/processor.ts`

This runs after upload and handles:

- [ ] **Text Extraction**:
  - PDF: Use `pdf-parse` npm package to extract text
  - DOCX: Use `mammoth` npm package to extract text
  - TXT: Read directly
- [ ] **Chunking**:
  - Split text into chunks of ~500 tokens with ~50 token overlap
  - Preserve paragraph boundaries where possible
  - Store each chunk with metadata (page number, section heading if detectable)
- [ ] **Embedding Generation**:
  - Use OpenRouter to generate embeddings for each chunk
  - Model: Use `openai/text-embedding-3-small` via OpenRouter (or fallback to another embedding model available on OpenRouter)
  - Store embeddings in the `KnowledgeChunk` table
- [ ] **Status Update**:
  - Update `KnowledgeDocument.status` to `"ready"` on success
  - Update to `"error"` on failure

**File to create**: `app/api/knowledge/process/route.ts`
- [ ] POST endpoint that accepts `{ documentId }`
- [ ] Calls the processor pipeline
- [ ] Called internally after upload completes

### 1.4 RAG Retrieval Function

**File to create**: `lib/knowledge/retriever.ts`

- [ ] `retrieveRelevantChunks(userId: string, query: string, topK?: number): Promise<string[]>`
- [ ] Generate embedding for the query text
- [ ] Call the `match_knowledge_chunks` Supabase RPC function
- [ ] Return the top K chunk contents as an array of strings
- [ ] Default topK = 5

### 1.5 Update Proposal Generation

**File to modify**: `app/api/propose/route.ts`

- [ ] Import the `retrieveRelevantChunks` function
- [ ] Before calling OpenRouter, retrieve relevant knowledge chunks for the current user
- [ ] Build a context block from retrieved chunks:
```
Company Knowledge (use these real details in the proposal):
---
[chunk 1 content]
---
[chunk 2 content]
---
```
- [ ] Inject this context block into the prompt BEFORE the opportunity details
- [ ] Update the system prompt to instruct the AI: "Use the provided Company Knowledge to include specific, real details about the company. Prefer real data over generic statements."

### 1.6 Knowledge Base Management UI

**File to create**: `app/knowledge/page.tsx`

- [ ] Page at `/knowledge` route
- [ ] Match existing dark theme (`bg-[#0A0A0A]`, `border-white/[0.07]`, etc.)
- [ ] Include `<Header />` component at top
- [ ] **Upload Section**:
  - Drag-and-drop zone + file picker button
  - File type selector dropdown: "Past Proposal", "Employee CV", "Case Study", "Compliance Certificate", "Company Profile", "Other"
  - Upload progress indicator
  - Accepted formats shown: PDF, DOCX, TXT
- [ ] **Documents List**:
  - Table/card grid showing all uploaded documents
  - Columns: File name, Type, Status (processing/ready/error), Upload date, Actions
  - Status badge: green for ready, yellow/pulsing for processing, red for error
  - Delete button per document
- [ ] **Stats**: Show total documents, total chunks processed

**File to create**: `app/api/knowledge/route.ts`
- [ ] GET: List all documents for the authenticated user
- [ ] DELETE: Remove a document and all its chunks (cascade)

### 1.7 Dependencies to Install

```bash
npm install pdf-parse mammoth
```

### 1.8 Environment Variables Needed

- `OPENROUTER_API_KEY` (already exists)
- No new env vars needed if using OpenRouter for embeddings too

### 1.9 Supabase Storage Setup

- [ ] Create a storage bucket named `knowledge-docs` in Supabase
- [ ] Set RLS policy: users can only access their own files
- [ ] Max file size: 10MB

---

## Feature 2: Go/No-Go Decision Summaries

### Goal
AI reads a tender document (the opportunity description + any linked documents) and instantly extracts must-have requirements, providing a quick decision summary so contractors can decide in 60 seconds whether to bid.

### 2.1 API Endpoint

**File to create**: `app/api/go-no-go/route.ts`

- [ ] POST endpoint accepting `{ opportunityId }`
- [ ] Fetch the opportunity from DB including `description_raw`, `raw_payload`, and `documents` JSON field
- [ ] If the opportunity has linked document URLs in the `documents` JSON field, attempt to fetch and extract text from them (PDF support via `pdf-parse`)
- [ ] Build a prompt for the AI:

```
You are a UK procurement compliance expert. Analyze this tender notice and provide a Go/No-Go decision summary.

Extract and organize the following:
1. **MANDATORY REQUIREMENTS** - List every must-have qualification, certification, or requirement (e.g., ISO certifications, minimum turnover, DBS checks, insurance levels, specific accreditations)
2. **KEY DEADLINES** - All critical dates (submission deadline, site visit dates, clarification deadlines, contract start)
3. **FINANCIAL THRESHOLDS** - Required turnover, bond/guarantee requirements, pricing format requirements
4. **EXPERIENCE REQUIREMENTS** - Minimum years, similar project requirements, reference requirements
5. **GEOGRAPHICAL CONSTRAINTS** - Location requirements, site access needs, regional restrictions
6. **RED FLAGS** - Unusually tight timelines, onerous T&Cs, unclear scope, framework restrictions
7. **GO/NO-GO RECOMMENDATION** - Based on the above, give a clear recommendation with confidence level (High/Medium/Low)

Format your response as structured JSON:
{
  "mandatory_requirements": [{"requirement": "...", "critical": true/false}],
  "deadlines": [{"date": "...", "description": "..."}],
  "financial_thresholds": [{"description": "...", "value": "..."}],
  "experience_requirements": ["..."],
  "geographical_constraints": ["..."],
  "red_flags": ["..."],
  "recommendation": "GO" | "NO-GO" | "CONDITIONAL",
  "confidence": "HIGH" | "MEDIUM" | "LOW",
  "reasoning": "...",
  "time_to_submit": "X days"
}

Tender Document:
[FULL OPPORTUNITY TEXT HERE]
```

- [ ] Send to OpenRouter with the existing model config
- [ ] Parse the JSON response
- [ ] Return structured JSON to the frontend

### 2.2 Database Changes

**File to modify**: `prisma/schema.prisma`

```prisma
model GoNoGoAnalysis {
  id               String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  opportunity_id   String   @db.Uuid
  user_id          String
  recommendation   String   // "GO", "NO-GO", "CONDITIONAL"
  confidence       String   // "HIGH", "MEDIUM", "LOW"
  analysis         Json     // Full structured analysis JSON
  created_at       DateTime @default(now()) @db.Timestamptz

  @@unique([opportunity_id, user_id])
  @@map("go_no_go_analyses")
}
```

- [ ] Run migration: `npx prisma migrate dev --name add_go_no_go`

### 2.3 Frontend - Go/No-Go Button & Modal

**File to modify**: `components/OpportunityDrawer.tsx`

- [ ] Add a "Go/No-Go Analysis" button in the drawer (alongside existing "Generate Proposal" button)
- [ ] Style: Amber/yellow themed button to distinguish from proposal generation
- [ ] On click, show loading state ("Analyzing tender requirements...")
- [ ] Call `POST /api/go-no-go` with the opportunity ID

**File to create**: `components/GoNoGoModal.tsx`

- [ ] Full-screen or large modal overlay
- [ ] Display the structured analysis with clear visual hierarchy:
  - **Header**: GO (green badge) / NO-GO (red badge) / CONDITIONAL (amber badge) with confidence level
  - **Time to Submit**: Prominent countdown/days remaining
  - **Mandatory Requirements**: Checklist-style list, critical items highlighted in red
  - **Deadlines**: Timeline or sorted date list
  - **Financial Thresholds**: Card-style display
  - **Experience Requirements**: Bullet list
  - **Red Flags**: Warning-styled section with orange/red highlights
  - **Reasoning**: AI's explanation paragraph
- [ ] "Proceed to Proposal" button (if GO/CONDITIONAL) that triggers proposal generation
- [ ] "Dismiss" button
- [ ] Match dark theme

---

## Feature 3: Pre-Submission Compliance Checker

### Goal
After a proposal is generated/edited, the AI scans it against the original tender requirements to verify every mandatory requirement has been addressed. Highlights gaps and missing items.

### 3.1 API Endpoint

**File to create**: `app/api/compliance-check/route.ts`

- [ ] POST endpoint accepting `{ opportunityId, proposalText }`
- [ ] Fetch the opportunity from DB (full description, requirements)
- [ ] If a Go/No-Go analysis exists for this opportunity+user, fetch it too (to get the extracted mandatory requirements)
- [ ] Build the compliance check prompt:

```
You are a UK procurement compliance auditor. Compare this draft proposal against the original tender requirements and identify compliance gaps.

ORIGINAL TENDER REQUIREMENTS:
[opportunity description_raw + any extracted requirements from Go/No-Go]

DRAFT PROPOSAL:
[proposalText]

For each requirement in the tender, assess whether the proposal adequately addresses it.

Return structured JSON:
{
  "overall_compliance": "COMPLIANT" | "PARTIALLY_COMPLIANT" | "NON_COMPLIANT",
  "compliance_score": 85, // percentage 0-100
  "requirements_checked": [
    {
      "requirement": "Description of the requirement",
      "status": "MET" | "PARTIALLY_MET" | "NOT_MET" | "NOT_APPLICABLE",
      "evidence": "Quote or reference from the proposal that addresses this",
      "suggestion": "If not met, how to fix it"
    }
  ],
  "missing_sections": ["List of sections/topics the proposal should include but doesn't"],
  "warnings": ["Any other compliance risks"],
  "word_count_check": {
    "current": 450,
    "limit": 500,
    "status": "OK" | "OVER_LIMIT"
  }
}
```

- [ ] Parse and return the structured JSON response

### 3.2 Frontend - Compliance Check Panel

**File to create**: `components/CompliancePanel.tsx`

This component appears after a proposal is generated or in the proposal editor view.

- [ ] **Trigger**: "Audit Proposal" / "Check Compliance" button
- [ ] **Loading State**: Progress bar with "Scanning proposal against tender requirements..."
- [ ] **Results Display**:
  - Overall compliance badge (green/amber/red) with percentage score
  - Scrollable list of requirements:
    - Each item shows: requirement text, status icon (checkmark/warning/X), evidence quote, fix suggestion
    - Color coding: green (MET), amber (PARTIALLY_MET), red (NOT_MET), grey (N/A)
  - Missing sections highlighted prominently
  - Warnings section
  - Word count status
- [ ] **Actions**:
  - "Fix All Issues" button - sends suggestions back to the AI to auto-fix the proposal
  - "Re-Check" button after edits
- [ ] Match dark theme styling

### 3.3 Integration with Proposal Flow

**File to modify**: `components/OpportunityDrawer.tsx`

- [ ] After proposal is generated, show the compliance check button
- [ ] Store the current proposal text in state so it can be sent to compliance check
- [ ] Wire up the "Fix All Issues" action to re-call `/api/propose` with additional context about what needs fixing

---

## Feature 4: In-Line Copilot Document Editor

### Goal
Replace the simple proposal output with a rich-text editor where users can highlight text and prompt the AI to modify specific sections (e.g., "make this more technical", "expand on our H&S policy", "answer question 4.2 based on my uploaded CV").

### 4.1 Rich Text Editor Component

**File to create**: `components/ProposalEditor.tsx`

- [ ] Install and use a React rich-text editor. Recommended: `@tiptap/react` with `@tiptap/starter-kit`
- [ ] Dependencies to install:
```bash
npm install @tiptap/react @tiptap/starter-kit @tiptap/extension-highlight @tiptap/extension-placeholder @tiptap/pm
```
- [ ] Editor features:
  - Markdown rendering of the initial AI-generated proposal
  - Bold, italic, headings, bullet lists, numbered lists
  - Text highlighting/selection
  - Dark theme styling to match Nexa
- [ ] **Toolbar** at the top:
  - Basic formatting buttons (B, I, H1, H2, H3, bullet list, numbered list)
  - "Audit Proposal" button (triggers compliance check - Feature 3)
  - "Export" dropdown (Feature 5)
  - Word count display

### 4.2 AI Copilot Sidebar / Popover

**File to create**: `components/CopilotAssistant.tsx`

- [ ] When user selects/highlights text in the editor, show a floating toolbar or popover near the selection
- [ ] The popover contains:
  - Quick action buttons:
    - "Make more technical"
    - "Make more concise"
    - "Expand this section"
    - "Add specific examples"
    - "Improve persuasiveness"
  - Free-text input: "Ask AI to..." with a text field for custom instructions
  - If RAG is enabled (Feature 1): "Use company knowledge" toggle/checkbox
- [ ] On action click or custom prompt submit:
  - Send the selected text + the instruction + (optionally) relevant knowledge chunks to the AI
  - Show inline loading state
  - Replace the selected text with the AI's revised version
  - Keep an undo stack so users can revert changes

### 4.3 Copilot API Endpoint

**File to create**: `app/api/copilot/route.ts`

- [ ] POST endpoint accepting:
```json
{
  "selectedText": "The paragraph to modify",
  "instruction": "make more technical" | "expand" | "concise" | custom string,
  "fullProposalContext": "The entire proposal for context",
  "opportunityId": "uuid",
  "useKnowledge": true/false
}
```
- [ ] Build the prompt:
```
You are an expert UK bid writer assistant. The user is editing a proposal and has selected the following text. Modify ONLY the selected text according to their instruction, keeping it consistent with the rest of the proposal.

Full proposal (for context only - do not modify):
[fullProposalContext]

Selected text to modify:
[selectedText]

Instruction: [instruction]

[If useKnowledge is true, include relevant knowledge chunks from RAG]

Return ONLY the revised text, nothing else. No explanations, no markdown code blocks.
```
- [ ] If `useKnowledge` is true, call `retrieveRelevantChunks()` from Feature 1 with the selected text + instruction as query
- [ ] Return `{ revisedText: "..." }`

### 4.4 Integration - Replace Current Proposal Output

**File to modify**: `components/OpportunityDrawer.tsx`

- [ ] Currently the drawer likely renders the proposal as static markdown
- [ ] Replace with the `<ProposalEditor />` component when a proposal is generated
- [ ] OR create a dedicated proposal editing page:

**File to create**: `app/proposal/[id]/page.tsx`

- [ ] Full-page editor view at `/proposal/[opportunityId]`
- [ ] Layout: Left side = editor (70%), Right side = copilot panel / compliance results (30%)
- [ ] Header with opportunity title and back button
- [ ] Auto-save proposal drafts (see 4.5)

### 4.5 Proposal Draft Storage

**File to modify**: `prisma/schema.prisma`

```prisma
model ProposalDraft {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  user_id         String
  opportunity_id  String   @db.Uuid
  content         String   // The proposal markdown/HTML content
  version         Int      @default(1)
  is_latest       Boolean  @default(true)
  created_at      DateTime @default(now()) @db.Timestamptz
  updated_at      DateTime @default(now()) @db.Timestamptz

  @@index([user_id, opportunity_id])
  @@index([is_latest])
  @@map("proposal_drafts")
}
```

- [ ] Run migration: `npx prisma migrate dev --name add_proposal_drafts`

**File to create**: `app/api/proposals/route.ts`
- [ ] GET: Fetch latest draft for a user + opportunity
- [ ] POST: Save/update draft (auto-increment version, set previous versions `is_latest = false`)
- [ ] Implement auto-save: debounced save every 5 seconds of inactivity after changes

---

## Feature 5: Teaming & Export Integrations

### Goal
Allow multiple users to collaborate on proposals and export finished proposals to Word/Google Docs with proper formatting.

### 5.1 Export to Microsoft Word (.docx)

**File to create**: `lib/export/word.ts`

- [ ] Install dependency:
```bash
npm install docx file-saver
```
- [ ] Function: `generateWordDocument(proposalContent: string, metadata: { title, buyer, deadline }): Buffer`
- [ ] Convert the proposal markdown/HTML to a structured Word document:
  - Title page with opportunity name, buyer, and date
  - Proper heading styles (H1, H2, H3)
  - Body text with consistent font (Calibri or Arial, 11pt)
  - Bullet and numbered lists
  - Company logo placeholder
  - Page numbers in footer
  - Table of contents (if proposal has headings)
- [ ] Return as a downloadable `.docx` buffer

**File to create**: `app/api/export/word/route.ts`
- [ ] POST endpoint accepting `{ opportunityId, proposalContent }`
- [ ] Generate the Word doc using the above function
- [ ] Return as a file download response with proper headers:
  ```
  Content-Type: application/vnd.openxmlformats-officedocument.wordprocessingml.document
  Content-Disposition: attachment; filename="Proposal - [Title].docx"
  ```

### 5.2 Export to PDF

**File to create**: `lib/export/pdf.ts`

- [ ] Use a lightweight approach: convert HTML to PDF
- [ ] Option A: Use `@react-pdf/renderer` for React-based PDF generation
- [ ] Option B: Use a CSS print stylesheet approach with the browser's print function
- [ ] Recommended: Start with Option B (simplest) - add a "Print to PDF" button that opens browser print dialog with a print-optimized stylesheet

**File to create**: `app/proposal/[id]/print/page.tsx`
- [ ] Print-optimized view of the proposal
- [ ] White background, proper fonts, formatted for A4
- [ ] Auto-trigger `window.print()` on load

### 5.3 Copy as Formatted Text

- [ ] Add a "Copy to Clipboard" button in the editor toolbar
- [ ] Copy as rich text (HTML) so it pastes with formatting into Google Docs, Word, etc.
- [ ] Use the Clipboard API: `navigator.clipboard.write()` with `text/html` MIME type

### 5.4 Team Collaboration - Proposal Sharing

**File to modify**: `prisma/schema.prisma`

```prisma
model ProposalCollaborator {
  id            String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  proposal_id   String   @db.Uuid
  user_id       String
  role          String   @default("editor") // "owner", "editor", "viewer"
  invited_email String?
  accepted      Boolean  @default(false)
  created_at    DateTime @default(now()) @db.Timestamptz

  @@unique([proposal_id, user_id])
  @@index([user_id])
  @@map("proposal_collaborators")
}
```

- [ ] Run migration: `npx prisma migrate dev --name add_collaborators`

**File to create**: `app/api/proposals/[id]/collaborators/route.ts`
- [ ] GET: List collaborators for a proposal
- [ ] POST: Invite a collaborator by email
  - If user exists in UserProfile, add directly
  - If not, send an invitation email (via Resend - already installed)
- [ ] DELETE: Remove a collaborator

**File to create**: `components/CollaboratorPanel.tsx`
- [ ] UI panel showing current collaborators with their roles
- [ ] "Invite" button with email input
- [ ] Role dropdown (editor/viewer)
- [ ] Remove button for each collaborator (owner only)

### 5.5 Real-Time Collaboration (Optional/Phase 2)

> Note: This is a stretch goal. Basic sharing (above) should be implemented first.

- [ ] Use Supabase Realtime for presence and basic sync
- [ ] Show collaborator cursors/avatars in the editor
- [ ] Conflict resolution: last-write-wins for MVP, or use Yjs for CRDT-based collaboration

---

## Implementation Order (Recommended)

Build in this order to maximize dependencies and avoid rework:

### Phase 1: Foundation (Week 1-2)
1. **Database migrations** - All schema changes across all features at once
2. **Feature 1: Knowledge Base (RAG)** - This is the foundation that Features 3 and 4 depend on
   - 1.1 Schema + migrations
   - 1.7 Install dependencies
   - 1.9 Supabase storage setup
   - 1.2 Upload API
   - 1.3 Processing pipeline
   - 1.4 Retrieval function
   - 1.5 Update proposal generation
   - 1.6 Knowledge management UI

### Phase 2: Intelligence (Week 2-3)
3. **Feature 2: Go/No-Go Summaries**
   - 2.1 API endpoint
   - 2.2 Database changes
   - 2.3 Frontend button + modal
4. **Feature 3: Compliance Checker**
   - 3.1 API endpoint
   - 3.2 Frontend panel
   - 3.3 Integration with proposal flow

### Phase 3: Editor (Week 3-4)
5. **Feature 4: Copilot Editor**
   - 4.5 Draft storage schema + API
   - 4.1 Rich text editor component
   - 4.2 Copilot sidebar
   - 4.3 Copilot API
   - 4.4 Integration

### Phase 4: Collaboration (Week 4-5)
6. **Feature 5: Teaming & Exports**
   - 5.1 Word export
   - 5.2 PDF export
   - 5.3 Copy as formatted text
   - 5.4 Team collaboration
   - 5.5 Real-time (stretch)

---

## All New Dependencies

```bash
npm install pdf-parse mammoth @tiptap/react @tiptap/starter-kit @tiptap/extension-highlight @tiptap/extension-placeholder @tiptap/pm docx file-saver
npm install -D @types/file-saver
```

---

## All New Files to Create

```
app/
  api/
    knowledge/
      upload/route.ts       # File upload endpoint
      process/route.ts      # Document processing endpoint
      route.ts              # List/delete documents
    go-no-go/
      route.ts              # Go/No-Go analysis endpoint
    compliance-check/
      route.ts              # Compliance checking endpoint
    copilot/
      route.ts              # Inline AI editing endpoint
    proposals/
      route.ts              # Draft CRUD endpoint
      [id]/
        collaborators/
          route.ts           # Collaborator management
    export/
      word/route.ts          # Word export endpoint
  knowledge/
    page.tsx                 # Knowledge base management page
  proposal/
    [id]/
      page.tsx               # Full proposal editor page
      print/
        page.tsx             # Print-optimized proposal view

components/
  GoNoGoModal.tsx            # Go/No-Go results display
  CompliancePanel.tsx        # Compliance check results
  ProposalEditor.tsx         # Rich text editor
  CopilotAssistant.tsx       # AI copilot popover/sidebar
  CollaboratorPanel.tsx      # Team collaboration UI

lib/
  knowledge/
    processor.ts             # Document chunking + embedding
    retriever.ts             # RAG retrieval function
  export/
    word.ts                  # Word document generation
    pdf.ts                   # PDF generation utilities
```

---

## All Files to Modify

```
prisma/schema.prisma                 # Add 4 new models
app/api/propose/route.ts             # Inject RAG context into prompts
components/OpportunityDrawer.tsx     # Add Go/No-Go + Compliance buttons, editor integration
app/layout.tsx                       # Add /knowledge to navigation if applicable
components/Header.tsx                # Add Knowledge Base nav link
```

---

## All Database Migrations Required

Run these in order:
1. `npx prisma migrate dev --name add_knowledge_base` (KnowledgeDocument + KnowledgeChunk)
2. `npx prisma migrate dev --name add_go_no_go` (GoNoGoAnalysis)
3. `npx prisma migrate dev --name add_proposal_drafts` (ProposalDraft)
4. `npx prisma migrate dev --name add_collaborators` (ProposalCollaborator)

Or combine into a single migration if building all at once:
`npx prisma migrate dev --name add_enterprise_features`

---

## Supabase Setup Required

1. Enable pgvector extension: `CREATE EXTENSION IF NOT EXISTS vector;`
2. Create `knowledge-docs` storage bucket
3. Set RLS policies on the storage bucket
4. Create the `match_knowledge_chunks` SQL function (see 1.1)

---

## Environment Variables

No new environment variables needed. All features use the existing:
- `DATABASE_URL`
- `DIRECT_URL`
- `OPENROUTER_API_KEY`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

---

## Navigation Updates

Add these links to the header/navigation:
- `/knowledge` - "Knowledge Base" (with document icon)
- `/proposal/[id]` - Linked from opportunity drawer after generating a proposal

---

## Testing Checklist

### Feature 1: Knowledge Base
- [ ] Upload a PDF and verify text extraction
- [ ] Upload a DOCX and verify text extraction
- [ ] Verify chunks are created with embeddings
- [ ] Generate a proposal and verify it includes company-specific details from uploaded docs
- [ ] Delete a document and verify chunks are cascade deleted

### Feature 2: Go/No-Go
- [ ] Run analysis on an opportunity with a detailed description
- [ ] Verify all JSON fields are populated
- [ ] Verify the modal renders correctly with color-coded badges
- [ ] Test with a sparse opportunity (minimal description)

### Feature 3: Compliance Check
- [ ] Generate a proposal, then run compliance check
- [ ] Verify requirements are extracted and checked
- [ ] Test "Fix All Issues" flow
- [ ] Re-check after fixes

### Feature 4: Copilot Editor
- [ ] Generate a proposal and verify it loads in the editor
- [ ] Select text and verify the copilot popover appears
- [ ] Test each quick action (technical, concise, expand, etc.)
- [ ] Test custom instruction
- [ ] Test with knowledge base toggle on/off
- [ ] Verify auto-save works (check DB after edits)
- [ ] Verify undo works after AI edits

### Feature 5: Teaming & Export
- [ ] Export a proposal to Word and open in Microsoft Word
- [ ] Verify Word formatting (headings, lists, fonts)
- [ ] Test "Copy to Clipboard" and paste into Google Docs
- [ ] Invite a collaborator by email
- [ ] Verify the collaborator can access the proposal
- [ ] Test role-based access (editor vs viewer)
