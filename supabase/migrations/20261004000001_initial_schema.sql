-- WCC ClearFlow: Complete Supabase Schema Migration
-- Designed for PostgreSQL with Row-Level Security

-- Enable pgcrypto if not enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Invoices
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    amount_paise BIGINT NOT NULL,              -- Total invoice amount in integer paise (₹1 = 100 paise)
    gst_paise BIGINT NOT NULL DEFAULT 0,      -- Total GST in integer paise
    round_off_paise BIGINT NOT NULL DEFAULT 0,-- Extracted round-off in integer paise
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    needs_review BOOLEAN NOT NULL DEFAULT false, -- True if extraction error, low confidence, or math fail
    file_path TEXT,                           -- Path in private Supabase Storage bucket
    extraction_confidence NUMERIC(4, 3),        -- 0.000 to 1.000
    raw_json JSONB,                           -- Extracted structured JSON
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_user_number ON invoices(user_id, number);

-- 2. Bank Transactions
CREATE TABLE IF NOT EXISTS bank_txns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    amount_paise BIGINT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'credit' CHECK (direction IN ('credit', 'debit')),
    narration TEXT NOT NULL,
    utr_ref TEXT,
    dedupe_hash TEXT NOT NULL,                -- SHA256(date|amount_paise|narration|occurrence_index)
    source_file TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_txns_dedupe_hash ON bank_txns(user_id, dedupe_hash);

-- 3. Matches
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    txn_id UUID NOT NULL REFERENCES bank_txns(id) ON DELETE CASCADE,
    allocated_paise BIGINT NOT NULL,          -- Integer paise allocated to this invoice
    adjustment_paise BIGINT NOT NULL DEFAULT 0,-- TDS deduction or bank charge/rounding paise
    adjustment_kind TEXT CHECK (adjustment_kind IN ('tds', 'bank_charge') OR adjustment_kind IS NULL),
    score NUMERIC(4, 3) NOT NULL,
    method TEXT NOT NULL,                      -- 'ref_match', 'fuzzy_composite', 'short_pay_tds', 'subset_sum'
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
    reasons JSONB NOT NULL,                    -- Array of string explanations
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_matches_invoice_txn UNIQUE (invoice_id, txn_id)
);

-- 4. Payer Aliases
CREATE TABLE IF NOT EXISTS payer_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    raw_alias TEXT NOT NULL,                  -- Cleaned token from bank narration (e.g. "SHARMA ENTP")
    customer_name TEXT NOT NULL,              -- Target canonical customer name (e.g. "Sharma Enterprises")
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payer_alias UNIQUE (user_id, raw_alias)
);

-- 5. Reminders
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email')),
    outstanding_paise BIGINT NOT NULL,
    draft_text TEXT NOT NULL,                  -- Polite message + UPI text & link, NO bank details
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
    last_reminded_at TIMESTAMPTZ,             -- Set ONLY when user clicks "Mark as sent"
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 6. Audit Log (INSERT + SELECT only)
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    actor TEXT NOT NULL DEFAULT 'user',
    action TEXT NOT NULL,                      -- 'MATCH_CONFIRM', 'MATCH_REJECT', 'INVOICE_EDIT', 'REMINDER_SENT'
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before JSONB,
    after JSONB,
    ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Row Level Security (RLS) - Strictly Per-Visitor / Per-User
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_txns ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

-- Dynamic policies checking auth.uid() = user_id
DO $$
BEGIN
    DROP POLICY IF EXISTS "invoices_user_isolation" ON invoices;
    CREATE POLICY "invoices_user_isolation" ON invoices FOR ALL USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "bank_txns_user_isolation" ON bank_txns;
    CREATE POLICY "bank_txns_user_isolation" ON bank_txns FOR ALL USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "matches_user_isolation" ON matches;
    CREATE POLICY "matches_user_isolation" ON matches FOR ALL USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "payer_aliases_user_isolation" ON payer_aliases;
    CREATE POLICY "payer_aliases_user_isolation" ON payer_aliases FOR ALL USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "reminders_user_isolation" ON reminders;
    CREATE POLICY "reminders_user_isolation" ON reminders FOR ALL USING (auth.uid() = user_id);

    DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
    CREATE POLICY "audit_log_insert" ON audit_log FOR INSERT WITH CHECK (auth.uid() = user_id);

    DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
    CREATE POLICY "audit_log_select" ON audit_log FOR SELECT USING (auth.uid() = user_id);
END $$;
