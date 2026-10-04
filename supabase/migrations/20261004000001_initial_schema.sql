-- ==============================================================================
-- WCC ClearFlow: Complete Production Supabase Schema Migration
-- Designed for PostgreSQL 15+ with High-Performance Row-Level Security (RLS)
-- Optimized following official Supabase Postgres Best Practices
-- ==============================================================================

-- 0. Enable pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 1. Invoices Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    number TEXT NOT NULL,
    customer_name TEXT NOT NULL,
    customer_phone TEXT,
    customer_email TEXT,
    amount_paise BIGINT NOT NULL,               -- Total amount in integer paise (₹1 = 100 paise)
    gst_paise BIGINT NOT NULL DEFAULT 0,       -- GST in integer paise
    round_off_paise BIGINT NOT NULL DEFAULT 0, -- Round-off in integer paise
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    needs_review BOOLEAN NOT NULL DEFAULT false, -- True if OCR uncertainty or math fail
    file_path TEXT,                            -- Path in private Supabase Storage
    extraction_confidence NUMERIC(4, 3),         -- 0.000 to 1.000
    raw_json JSONB,                            -- Structured extracted data
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Invoices Indexes
CREATE INDEX IF NOT EXISTS idx_invoices_user_id ON invoices(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_invoices_user_number ON invoices(user_id, number);
CREATE INDEX IF NOT EXISTS idx_invoices_due_date ON invoices(user_id, due_date);

-- ==============================================================================
-- 2. Bank Transactions Table
-- ==============================================================================
CREATE TABLE IF NOT EXISTS bank_txns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    date DATE NOT NULL,
    amount_paise BIGINT NOT NULL,
    direction TEXT NOT NULL DEFAULT 'credit' CHECK (direction IN ('credit', 'debit')),
    narration TEXT NOT NULL,
    utr_ref TEXT,
    dedupe_hash TEXT NOT NULL,                 -- SHA256(date|amount_paise|narration|occurrence_index)
    source_file TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Bank Transactions Indexes
CREATE INDEX IF NOT EXISTS idx_bank_txns_user_id ON bank_txns(user_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_bank_txns_dedupe_hash ON bank_txns(user_id, dedupe_hash);
CREATE INDEX IF NOT EXISTS idx_bank_txns_date ON bank_txns(user_id, date);

-- ==============================================================================
-- 3. Matches Table (Invoice <-> Bank Transaction Allocations)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    txn_id UUID NOT NULL REFERENCES bank_txns(id) ON DELETE CASCADE,
    allocated_paise BIGINT NOT NULL,           -- Amount credited to invoice in paise
    adjustment_paise BIGINT NOT NULL DEFAULT 0, -- TDS or bank fee deduction in paise
    adjustment_kind TEXT CHECK (adjustment_kind IN ('tds', 'bank_charge') OR adjustment_kind IS NULL),
    score NUMERIC(4, 3) NOT NULL,
    method TEXT NOT NULL,                       -- 'ref_match', 'fuzzy_composite', 'short_pay_tds', 'subset_sum'
    status TEXT NOT NULL DEFAULT 'suggested' CHECK (status IN ('suggested', 'confirmed', 'rejected')),
    reasons JSONB NOT NULL,                     -- Explanation array
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_matches_invoice_txn UNIQUE (invoice_id, txn_id)
);

-- Matches Indexes (Including Foreign Key Indexes for fast JOINs and CASCADE operations)
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_invoice_id ON matches(invoice_id);
CREATE INDEX IF NOT EXISTS idx_matches_txn_id ON matches(txn_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(user_id, status);

-- ==============================================================================
-- 4. Payer Aliases Table (Auto-Learned Customer Aliases)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS payer_aliases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    raw_alias TEXT NOT NULL,                   -- Narration token (e.g. "SHARMA ENTP")
    customer_name TEXT NOT NULL,               -- Canonical customer name
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_payer_alias UNIQUE (user_id, raw_alias)
);

-- Payer Aliases Indexes
CREATE INDEX IF NOT EXISTS idx_payer_aliases_user_id ON payer_aliases(user_id);

-- ==============================================================================
-- 5. Reminders Table (Payment Follow-Up State Machine)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS reminders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
    channel TEXT NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'email')),
    outstanding_paise BIGINT NOT NULL,
    draft_text TEXT NOT NULL,                   -- Polite message + UPI text & link, NO bank details
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'approved', 'sent')),
    last_reminded_at TIMESTAMPTZ,              -- Recorded when marked as sent
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reminders Indexes (Including Foreign Key Index)
CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_invoice_id ON reminders(invoice_id);
CREATE INDEX IF NOT EXISTS idx_reminders_status ON reminders(user_id, status);

-- ==============================================================================
-- 6. Audit Log Table (Append-Only Immutable Ledger)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    actor TEXT NOT NULL DEFAULT 'user',
    action TEXT NOT NULL,                       -- 'MATCH_CONFIRM', 'MATCH_REJECT', 'INVOICE_EDIT', 'REMINDER_SENT'
    entity TEXT NOT NULL,
    entity_id TEXT NOT NULL,
    before JSONB,
    after JSONB,
    ts TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Audit Log Indexes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_user_ts ON audit_log(user_id, ts DESC);

-- ==============================================================================
-- 7. High-Performance Row-Level Security (RLS)
-- Optimized with cached `(SELECT auth.uid())` per Supabase performance benchmarks
-- ==============================================================================
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE bank_txns ENABLE ROW LEVEL SECURITY;
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE payer_aliases ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_log ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Invoices policy
    DROP POLICY IF EXISTS "invoices_user_isolation" ON invoices;
    CREATE POLICY "invoices_user_isolation" ON invoices 
        FOR ALL USING ((SELECT auth.uid()) = user_id)
        WITH CHECK ((SELECT auth.uid()) = user_id);

    -- Bank Transactions policy
    DROP POLICY IF EXISTS "bank_txns_user_isolation" ON bank_txns;
    CREATE POLICY "bank_txns_user_isolation" ON bank_txns 
        FOR ALL USING ((SELECT auth.uid()) = user_id)
        WITH CHECK ((SELECT auth.uid()) = user_id);

    -- Matches policy
    DROP POLICY IF EXISTS "matches_user_isolation" ON matches;
    CREATE POLICY "matches_user_isolation" ON matches 
        FOR ALL USING ((SELECT auth.uid()) = user_id)
        WITH CHECK ((SELECT auth.uid()) = user_id);

    -- Payer Aliases policy
    DROP POLICY IF EXISTS "payer_aliases_user_isolation" ON payer_aliases;
    CREATE POLICY "payer_aliases_user_isolation" ON payer_aliases 
        FOR ALL USING ((SELECT auth.uid()) = user_id)
        WITH CHECK ((SELECT auth.uid()) = user_id);

    -- Reminders policy
    DROP POLICY IF EXISTS "reminders_user_isolation" ON reminders;
    CREATE POLICY "reminders_user_isolation" ON reminders 
        FOR ALL USING ((SELECT auth.uid()) = user_id)
        WITH CHECK ((SELECT auth.uid()) = user_id);

    -- Audit Log policies: STRICTLY Append-Only (INSERT and SELECT only)
    DROP POLICY IF EXISTS "audit_log_insert" ON audit_log;
    CREATE POLICY "audit_log_insert" ON audit_log 
        FOR INSERT WITH CHECK ((SELECT auth.uid()) = user_id);

    DROP POLICY IF EXISTS "audit_log_select" ON audit_log;
    CREATE POLICY "audit_log_select" ON audit_log 
        FOR SELECT USING ((SELECT auth.uid()) = user_id);
END $$;

-- ==============================================================================
-- 8. Supabase Storage RLS Policy (for private 'invoices' bucket)
-- ==============================================================================
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'storage' AND tablename = 'objects') THEN
        DROP POLICY IF EXISTS "User storage isolation" ON storage.objects;
        CREATE POLICY "User storage isolation" ON storage.objects
            FOR ALL USING (
                bucket_id = 'invoices' 
                AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
            )
            WITH CHECK (
                bucket_id = 'invoices' 
                AND (SELECT auth.uid())::text = (storage.foldername(name))[1]
            );
    END IF;
END $$;
