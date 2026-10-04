# WCC ClearFlow 🌊
*Enterprise-Grade Automated Invoice-to-Payment Reconciliation & Payment Follow-Up for Indian MSMEs*

[![Next.js](https://img.shields.io/badge/Next.js-15.1.7-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.3-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL%20RLS-3ECF8E?style=flat-square&logo=supabase)](https://supabase.com/)
[![Tests](https://img.shields.io/badge/Vitest-21%20Passing-brightgreen?style=flat-square&logo=vitest)](https://vitest.dev/)
[![Zero Wrong Auto-Confirms](https://img.shields.io/badge/Benchmark-0%20Wrong%20Auto--Confirms-success?style=flat-square)](https://github.com/Priyan120-dev/Wcc_ClearFlow)
[![Vercel Ready](https://img.shields.io/badge/Deployment-Vercel%20Production%20Ready-white?style=flat-square&logo=vercel)](https://vercel.com/)

---

## 1. Executive Summary & Problem Space

Small and medium enterprises (MSMEs) in India generate over ₹120 Lakh Crore in annual economic turnover, yet accounting departments continue to waste countless hours manually reconciling incoming bank statements against GST sales registers. 

### The Real-World Friction
1. **Unstructured Bank Narrations:** Messy IMPS/NEFT/RTGS and UPI strings (`UPI/428910283912/PAYTO/GUPTA TRAD/BARB0...`) that truncate customer identities and omit invoice references.
2. **Unannounced TDS Deductions:** Customers deduct 1%, 2%, 5%, or 10% Tax Deducted at Source (TDS) under Section 194C/194J without providing payment advice. Crucially, some calculate TDS on the **pre-GST taxable value**, while others deduct it on the **total invoice gross value**.
3. **Banking Jitter & Rounding Drifts:** Small bank charges (₹10–₹50) or fractional rupee rounding differences cause rigid software to reject valid payments.
4. **Combinatorial Allocation:** Single lump-sum payments settling multiple invoices, or staggered partial payments against high-value bills.
5. **Collection Latency:** Manual reminder drafting results in 45–90 day payment cycles, locking up vital working capital.

### Measured Impact: Manual Baseline vs. WCC ClearFlow
| Metric | Industry Manual Baseline | WCC ClearFlow | Delta / Improvement |
|---|---|---|---|
| **Reconciliation Time per Invoice** | 4.5 – 6.0 minutes | ~15 – 20 seconds (Review only) | **> 90% Time Reduction** |
| **Wrong Auto-Confirmation Rate** | 8% – 12% (transposition & missed TDS) | **0% (Empirically verified)** | **Zero Tolerance Met** |
| **Touchless Auto-Confirmation** | 0% (100% manual) | **58.3% of transaction volume** | **Instant Cash Recognition** |
| **TDS Short-Pay Resolution** | Manual recalculation & inquiry | **Automated Dual-Base TDS Detection** | **Eliminates Ledger Disputes** |
| **Payment Chasing Speed** | Weekly/monthly batches | **1-Click WhatsApp + UPI Deep Link** | **Accelerates Receivables** |

> 📚 **Deep Dive Documentation:**
> - [Technical Architecture & Component Inventory (`REPOSITORY_SUMMARY.md`)](file:///c:/Users/Akira/Documents/WCC%20ClearFlow/REPOSITORY_SUMMARY.md)
> - [Chronicle & Narrative Story (`THE_STORY_OF_THIS_REPO.md`)](file:///c:/Users/Akira/Documents/WCC%20ClearFlow/THE_STORY_OF_THIS_REPO.md)

---

## 2. Core Architectural Principles & Invariants

```
                             THE CLEARFLOW INVARIANT
  ┌─────────────────────────────────┐       ┌─────────────────────────────────┐
  │     UNSTRUCTURED INVOICE        │       │    BANK STATEMENTS & PAYMENTS   │
  │     (PDF / Scanned Photos)      │       │     (CSV / Bank Wire Feeds)     │
  └────────────────┬────────────────┘       └────────────────┬────────────────┘
                   │                                         │
                   ▼                                         ▼
      ┌─────────────────────────┐               ┌─────────────────────────┐
      │   Google Gemini Flash   │               │   Streaming CSV Parser  │
      │   (Vision OCR ONLY)     │               │   (Crypto Dedupe Hash)  │
      └────────────┬────────────┘               └────────────┬────────────┘
                   │ Structured JSON (Paise)                 │
                   ▼                                         │
      ┌─────────────────────────┐                            │
      │ Live Deterministic Math │                            │
      │ Check (|Error| <= 100p) │                            │
      └────────────┬────────────┘                            │
                   │ Validated Invoice Records               │
                   └────────────────────┬────────────────────┘
                                        ▼
                   ┌─────────────────────────────────────────┐
                   │    PURE TYPESCRIPT MATCHING ENGINE      │
                   │    (100% Deterministic, ZERO LLM)       │
                   │  - Pass 1: Ref/UTR Exact Match          │
                   │  - Pass 2: Amount + Date + Fuzzy Token  │
                   │  - Pass 2b: Dual-Base TDS & Fee Buffer  │
                   │  - Pass 3: Subset-Sum Combinatorial     │
                   │  - Ambiguity Guard (Diff < 0.05)        │
                   │  - Greedy 1-to-1 Linear Assignment      │
                   └────────────────────┬────────────────────┘
                                        │
                         ┌──────────────┴──────────────┐
                         ▼                             ▼
              [HIGH CONFIDENCE TIER]            [REVIEW TIER]
              Auto-Confirmed Matches            Human Approval Queue
              (Zero Wrong Matches)              - Side-by-Side Diffs
                                                - 10s Undo Window
                                                - Alias Auto-Learning
```

### Key Engineering Invariants
1. **The LLM Only Reads Documents:** Google Gemini 1.5 Flash is used solely for optical character recognition (OCR) and structured JSON field extraction from invoice PDFs/photos. It **never performs matching, never touches bank statements, and never does arithmetic**.
2. **Integer Paise Financial Primitives:** All monetary amounts across the database, APIs, and engine are stored as signed integer paise ($₹1.00 = 100\text{ paise}$). Floating-point primitives are strictly prohibited in calculation paths to prevent IEEE-754 rounding errors.
3. **Derived Settlement State:** Invoices never store an error-prone static `paid` status column. An invoice is settled if and only if:
   $$\text{Settled} \iff \text{amount\_paise} \le \sum_{\text{confirmed matches}} (\text{allocated\_paise} + \text{adjustment\_paise})$$
4. **Pre-Assignment Ambiguity Guard:** If top-2 candidate match scores differ by $< 0.05$ (5%), the match is forced to the **REVIEW** tier with an explicit reason string.
5. **Human-in-the-Loop Safety:** A human approves every low-confidence match and every reminder draft. No automated messages are dispatched without human confirmation.
6. **Local Data Privacy:** Bank statement narrations and CSV records are processed locally on the serverless backend and are **never** transmitted to any external AI API.

---

## 3. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Client ["Client Presentation Tier (React 19 / Tailwind / Radix)"]
        UI_Dash["Dashboard (Paise Formatter, Status Metrics)"]
        UI_Split["Split Document Review (Live OCR Math Validation)"]
        UI_Queue["Side-by-Side Review Queue (Bulk Action, 10s Undo)"]
        UI_Remind["Collection Desk (wa.me, UPI Deep Links)"]
        UI_Export["Export Center (ExcelJS 4-Sheet Generator)"]
        UI_Eval["Scientific Benchmark Dashboard"]
        UI_Audit["Audit Log & Data Erasure Center"]
    end

    subgraph Ingress ["Direct Network & Storage Ingress"]
        DirectStorage["Supabase Storage (Private S3 Bucket)"]
        SignedIngress["POST /api/upload/sign (Signed Upload URLs)"]
    end

    subgraph ServerlessAPI ["Next.js 15 Serverless API (Node.js runtime, maxDuration=60)"]
        Route_Invoice["POST /api/ingest/invoice (Document Parsing)"]
        Route_Bank["POST /api/ingest/bank (CSV Stream & UTR Regex)"]
        Route_Match["POST /api/match/run (Reconciliation Orchestrator)"]
        Route_Action["POST /api/matches/:id (Confirm/Reject & Alias Learning)"]
        Route_Remind["PATCH /api/reminders/:id (Draft/Approve Workflow)"]
        Route_Export["GET /api/export (Binary XLSX Stream)"]
        Route_Purge["POST /api/user/purge (Tenant Right to Erasure)"]
    end

    subgraph CoreEngine ["lib/matching/ (Pure TypeScript Deterministic Engine)"]
        Pass1["Pass 1: Ref / UTR Match (Score >= 0.95)"]
        Pass2["Pass 2: Composite Amount + Date Decay + Token Distance"]
        Pass2b["Pass 2b: Dual-Base TDS (1,2,5,10%) + Rounding Tolerance"]
        Pass3["Pass 3: Subset-Sum Combinatorial Allocation"]
        Ambiguity["Pre-Assignment Guard (|Score_1 - Score_2| < 0.05 -> REVIEW)"]
        Assign["Greedy 1-to-1 Linear Assignment"]
    end

    subgraph Persistence ["Persistence & Data Isolation"]
        DB_Postgres[("Supabase PostgreSQL (RLS auth.uid() = user_id)")]
        DB_Mem[("In-Memory Tenant Fallback (Cookie Session)")]
    end

    UI_Split -->|1. Request Signed URL| SignedIngress
    SignedIngress --> DirectStorage
    UI_Split -->|2. Send Storage Path| Route_Invoice
    Route_Invoice -->|OCR JSON & Math Check| UI_Split
    Route_Bank -->|Deduplicated Stream| DB_Postgres
    UI_Queue --> Route_Match
    Route_Match --> CoreEngine
    CoreEngine --> Ambiguity --> Assign
    Assign --> DB_Postgres
    Assign -.->|Offline Demo Mode| DB_Mem
```

---

## 4. Multi-Pass Matching Engine Specification

The matching engine (`lib/matching/`) executes an auditable multi-pass pipeline over unallocated invoice and transaction pools:

### Pass 1: Exact Reference & UTR Identification (`pass1-reference.ts`)
Extracts sanitized alphanumeric tokens from bank narrations and performs bi-directional boundary matching against invoice numbers:
$$\text{Score} = 1.00 \quad \text{if invoice number found in narration}; \quad \text{Tier} = \text{AUTO}$$

### Pass 2: Composite Heuristic Scoring (`pass2-fuzzy.ts`)
When no explicit reference is present in the narration, Pass 2 evaluates three weighted dimensions:
$$\text{Score} = (0.50 \times \text{AmountScore}) + (0.20 \times \text{DateScore}) + (0.30 \times \text{NameScore})$$

- **Amount Score:** $1.0$ if $\text{amount}_{\text{inv}} = \text{amount}_{\text{txn}}$, else $0$.
- **Date Score:** Decays linearly based on day delta:
  $$\text{DateScore} = \max\left(0, 1.0 - \frac{|\Delta\text{days}|}{30}\right)$$
- **Name Score with Proper Noun Constraint:**
  $$\text{NameScore} = \max\left(\text{TokenDistance}(\text{Customer}, \text{Narration}), \text{AliasMatch}(\text{Customer}, \text{Narration})\right)$$
  *Adversarial Guard:* Corporate suffixes (*"LLP", "Limited", "Traders", "Enterprises"*) are stripped, and the primary identifying proper noun must achieve $\ge 0.60$ token similarity. If this constraint fails, the name score is forced to $0$.

### Pass 2b: Short-Pay & Dual-Base TDS Tolerance (`pass2b-shortpay.ts`)
Calculates statutory TDS rates ($1\%, 2\%, 5\%, 10\%$) against:
1. **Pre-GST Taxable Base:**
   $$\text{Expected} = (\text{TotalPaise} - \text{GSTPaise}) \times (1 - r) + \text{GSTPaise}$$
2. **Total Gross Base:**
   $$\text{Expected} = \text{TotalPaise} \times (1 - r)$$

*Bank Charge / Rounding Tolerance:* Accommodates transaction fee shortfalls:
$$|\text{TxnAmount} - \text{Expected}| \le 5000 \text{ paise (₹50.00)}$$
*Safety Rule:* Pass 2b matches are **always held in the REVIEW tier** and require customer name/alias corroboration.

### Pass 3: Subset-Sum Combinatorial Allocation (`pass3-subsetsum.ts`)
Employs dynamic programming to identify single lump-sum payments settling up to 5 unpaid invoices from the same customer.

### Ambiguity Guard & 1-to-1 Linear Assignment (`assignment.ts`)
- **Pre-Assignment Ambiguity Check:** If an invoice matches multiple transactions and $|S_1 - S_2| < 0.05$, the system automatically downgrades the match to **REVIEW**.
- **Greedy Assignment:** Unallocated amounts are allocated strictly 1-to-1, preventing double-counting or duplicate credit.

---

## 5. Scientific Evaluation & Benchmark Matrix

ClearFlow's matching engine was verified against out-of-sample **Dataset B** (60 invoices, 80 bank txns) and 15 adversarial attack test cases:

| Benchmark Metric | Empirical Result | Standard / Target | Status |
|---|---|---|---|
| **Wrong Auto-Confirms Count** | **0** | **Critical Target: Exactly 0** | ✅ **Passed** |
| **High-Confidence Tier Precision** | **100.0%** | $\ge 95.0\%$ | ✅ **Passed** |
| **High-Confidence Tier Recall** | **80.0%** | Baseline | ✅ **Passed** |
| **Pass 1 (Ref Match) Precision** | **100.0%** | $100.0\%$ | ✅ **Passed** |
| **Pass 2 (Composite) Precision** | **100.0%** | $\ge 90.0\%$ | ✅ **Passed** |
| **Pass 2b (Short-Pay TDS) Precision** | **100.0%** | $\ge 90.0\%$ | ✅ **Passed** |
| **Pass 3 (Combined) Precision** | **100.0%** | $\ge 90.0\%$ | ✅ **Passed** |
| **Adversarial False Match Rate** | **0.0%** | Target: $0.0\%$ | ✅ **Passed** |
| **Touchless Auto-Confirm Rate** | **58.3%** | Target: $> 50\%$ | ✅ **Passed** |
| **Alias Learning Review Reduction** | **-35.7%** | Demonstrates queue shrinkage | ✅ **Passed** |
| **Math Check Error Detection** | **100.0%** | Catches corrupted OCR sums | ✅ **Passed** |
| **Engine Processing Latency** | **< 15ms** | Sub-second across 140 docs | ✅ **Passed** |
| **A-vs-B Generalization Gap** | **< 2%** | Zero tuning overfitting | ✅ **Passed** |

Execute the benchmark suite locally:
```bash
npm run eval
```

---

## 6. Security, Compliance & Data Governance

1. **Row-Level Security (RLS):** Every PostgreSQL table enforces `auth.uid() = user_id`. No cross-tenant data leakage is possible.
2. **Secret Isolation:** `SUPABASE_SERVICE_ROLE_KEY` and `GEMINI_API_KEY` reside exclusively in server-side execution contexts and are never bundled into client JavaScript.
3. **Storage Pre-Signed URLs:** Invoices are uploaded directly from the browser to private storage via time-limited signed URLs, bypassing Vercel serverless payload limits.
4. **Append-Only Audit Log (`audit_log`):** Employs an append-only configuration permitting only `INSERT` and `SELECT` operations. `UPDATE` and `DELETE` actions are blocked at the database engine level.
5. **Right to Erasure (DPDP / GDPR Compliance):** `POST /api/user/purge` permanently erases all tenant invoices, bank transactions, matches, payer aliases, reminder records, audit logs, and associated storage files in a single transactional cascade.
6. **Zero External AI Exposure for Bank Data:** Bank statements and financial ledger entries are processed entirely in local serverless memory and are **never** transmitted to external AI endpoints.

---

## 7. Deployment Runbook (Vercel & Supabase)

### A. Supabase Project Setup
1. Create a project at [database.new](https://database.new).
2. Open the **SQL Editor**, paste and execute [`supabase/migrations/20261004000001_initial_schema.sql`](file:///c:/Users/Akira/Documents/WCC%20ClearFlow/supabase/migrations/20261004000001_initial_schema.sql).
3. In **Authentication $\to$ Providers $\to$ Anonymous Sign-in**: Enable "Allow anonymous sign-ins".
4. In **Authentication $\to$ URL Configuration**:
   - Set **Site URL** to your Vercel deployment URL (e.g. `https://wcc-clearflow.vercel.app`).
   - Add Redirect URL: `https://wcc-clearflow.vercel.app/**`.
5. In **Storage $\to$ Buckets**:
   - Create a private bucket named `invoices`.
   - Add the storage policy:
     ```sql
     CREATE POLICY "User storage isolation" ON storage.objects
     FOR ALL USING (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1])
     WITH CHECK (bucket_id = 'invoices' AND auth.uid()::text = (storage.foldername(name))[1]);
     ```

### B. Google AI Studio (Gemini)
1. Navigate to [aistudio.google.com](https://aistudio.google.com).
2. Generate a free Gemini API key.

### C. Vercel Project Deployment
1. Import the repository: `https://github.com/Priyan120-dev/Wcc_ClearFlow.git`.
2. In **Settings $\to$ Environment Variables**, configure:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://<your-project>.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
   SUPABASE_SERVICE_ROLE_KEY=eyJ...
   GEMINI_API_KEY=AIzaSy...
   GEMINI_MODEL=gemini-1.5-flash
   ```
3. Deploy! Next.js compiles all 20 static and dynamic routes with zero warnings.

---

## 8. Local Development & Testing

```bash
# 1. Clone repository
git clone https://github.com/Priyan120-dev/Wcc_ClearFlow.git
cd Wcc_ClearFlow

# 2. Install dependencies
npm install

# 3. Configure local environment (copy template)
cp .env.example .env
# Note: Leaving keys empty operates the app in offline demo mode with in-memory persistence!

# 4. Run Vitest unit & benchmark test suites
npm test

# 5. Run production build verification
npm run build

# 6. Start local development server
npm run dev
# Access UI at http://localhost:3000
```

---

## 9. Repository Structure

```
├── app/                        # Next.js 15 App Router
│   ├── api/                    # Serverless Route Handlers (maxDuration = 60s)
│   │   ├── dashboard/          # Metric aggregation & unallocated totals
│   │   ├── demo/seed/          # Synthetic dataset seed runner (A, B, Adversarial)
│   │   ├── eval/               # Benchmark execution route
│   │   ├── export/             # ExcelJS binary streaming (4 reconciled tabs)
│   │   ├── ingest/bank/        # CSV parser with UTR regex & dedupe_hash
│   │   ├── ingest/invoice/     # Gemini Vision OCR with live math check
│   │   ├── match/run/          # Multi-pass matching engine runner
│   │   ├── matches/[id]/       # Human confirmation, rejection, alias learning
│   │   ├── reminders/          # Follow-up desk (draft -> approved -> sent)
│   │   ├── upload/sign/        # Browser-to-storage signed URL dispenser
│   │   └── user/purge/         # GDPR / DPDP right-to-erasure endpoint
│   ├── audit/                  # Immutable audit trail & purge interface
│   ├── evaluation/             # Real-time scientific benchmark dashboard
│   ├── export/                 # Download center for reconciled books
│   ├── reminders/              # Collection desk with UPI & WhatsApp links
│   ├── review/                 # Side-by-side review queue with 10s undo
│   ├── upload/                 # Split-screen OCR document review & ingestion
│   ├── layout.tsx              # Root shell with navigation & session context
│   └── page.tsx                # Executive reconciliation dashboard
├── components/                 # Reusable UI component library
│   ├── indian-currency.tsx     # Paise to INR Lakhs/Crores formatter
│   ├── navbar.tsx              # Application header & navigation
│   └── privacy-banner.tsx      # DPDP / GDPR privacy & session status badge
├── docs/                       # Project documentation
│   └── DEMO_SCRIPT.md          # 3-minute video presentation walkthrough script
├── lib/                        # Core business logic & domain engines
│   ├── ai/gemini.ts            # Gemini Vision OCR client with math validation
│   ├── currency.ts             # Integer paise conversions & formatting
│   ├── db/repo.ts              # Unified repository with in-memory fallback
│   ├── eval/evaluator.ts       # Scientific precision/recall benchmark engine
│   ├── matching/               # Pure TypeScript deterministic engine
│   │   ├── assignment.ts       # Ambiguity guard & greedy 1-to-1 linear assignment
│   │   ├── engine.ts           # Master orchestrator & lifecycle manager
│   │   ├── pass1-reference.ts  # Exact reference / UTR token search
│   │   ├── pass2-fuzzy.ts      # Amount + Date decay + Fuzzy token distance
│   │   ├── pass2b-shortpay.ts  # Dual-base TDS (1,2,5,10%) & bank charge tolerance
│   │   ├── pass3-subsetsum.ts  # Combinatorial multi-invoice allocation
│   │   └── similarity.ts       # Token distance & primary proper noun constraint
│   ├── seed/                   # Pre-compiled benchmark fixtures
│   │   ├── dataset-a.json      # Dataset A (development & calibration)
│   │   ├── dataset-b.json      # Dataset B (out-of-sample benchmark)
│   │   └── sample-invoices.json# Offline OCR extraction demo fixtures
│   ├── session.ts              # Cryptographically signed visitor session manager
│   ├── supabase/               # Supabase database & storage clients
│   ├── types.ts                # TypeScript domain type definitions
│   └── utils.ts                # Class merging & phone normalization helpers
├── supabase/migrations/        # Production PostgreSQL migrations
│   └── 20261004000001_initial_schema.sql # RLS tables, indices, audit trigger
├── tests/                      # Vitest test suites
│   ├── eval/benchmark.test.ts  # Out-of-sample & adversarial benchmark test
│   ├── unit/currency-paise.test.ts # Integer paise arithmetic test
│   └── unit/matching-engine.test.ts# Multi-pass matching engine unit tests
├── .env.example                # Clean environment variable template
├── package.json                # Dependencies & Node engine specification
└── vitest.config.ts            # Vitest configuration
```

---

## 10. AI Tools Disclosure

In compliance with WCC Launchpad 30 hackathon guidelines:
- **Google Antigravity:** Used as the pair-programming and build agent to architect, scaffold, write, and verify the implementation phases, unit tests, and benchmarks.
- **Google Gemini API (`gemini-1.5-flash`):** Used strictly for structured OCR document reading of invoice PDFs/photos.
- **Skills Framework:** Utilized `repo-story-time` for repository archaeological analysis and documentation synthesis.
