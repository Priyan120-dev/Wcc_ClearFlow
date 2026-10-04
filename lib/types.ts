// Domain types for WCC ClearFlow

export type InvoiceStatus = 'paid' | 'partial' | 'unpaid' | 'needs_review';

export interface Invoice {
  id: string;
  user_id: string;
  number: string;
  customer_name: string;
  customer_phone?: string | null;
  customer_email?: string | null;
  amount_paise: number; // Stored as integer paise (e.g. ₹1,500.50 = 150050)
  gst_paise: number;
  round_off_paise: number;
  issue_date: string; // ISO date string YYYY-MM-DD
  due_date: string;
  needs_review: boolean;
  file_path?: string | null;
  extraction_confidence?: number | null;
  raw_json?: Record<string, unknown> | null;
  created_at?: string;
}

export type TxnDirection = 'credit' | 'debit';

export interface BankTxn {
  id: string;
  user_id: string;
  date: string; // ISO date string YYYY-MM-DD
  amount_paise: number;
  direction: TxnDirection;
  narration: string;
  utr_ref?: string | null;
  dedupe_hash: string;
  source_file?: string | null;
  created_at?: string;
}

export type MatchMethod = 'ref_match' | 'fuzzy_composite' | 'short_pay_tds' | 'subset_sum';
export type MatchStatus = 'suggested' | 'confirmed' | 'rejected';
export type AdjustmentKind = 'tds' | 'bank_charge';

export interface Match {
  id: string;
  user_id: string;
  invoice_id: string;
  txn_id: string;
  allocated_paise: number;
  adjustment_paise: number;
  adjustment_kind?: AdjustmentKind | null;
  score: number;
  method: MatchMethod;
  status: MatchStatus;
  reasons: string[];
  created_at?: string;
  updated_at?: string;
}

export interface PayerAlias {
  id: string;
  user_id: string;
  raw_alias: string;
  customer_name: string;
  created_at?: string;
}

export type ReminderChannel = 'whatsapp' | 'email';
export type ReminderStatus = 'draft' | 'approved' | 'sent';

export interface Reminder {
  id: string;
  user_id: string;
  invoice_id: string;
  channel: ReminderChannel;
  outstanding_paise: number;
  draft_text: string;
  status: ReminderStatus;
  last_reminded_at?: string | null;
  created_at?: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  actor: string;
  action: string;
  entity: string;
  entity_id: string;
  before?: Record<string, unknown> | null;
  after?: Record<string, unknown> | null;
  ts?: string;
}

/**
 * Calculates settled paise from confirmed matches:
 * settled_paise = sum(allocated_paise + adjustment_paise) for confirmed matches
 */
export function calculateSettledPaise(matches: Array<Pick<Match, 'allocated_paise' | 'adjustment_paise' | 'status'>>): number {
  return matches
    .filter((m) => m.status === 'confirmed')
    .reduce((sum, m) => sum + (m.allocated_paise || 0) + (m.adjustment_paise || 0), 0);
}

/**
 * Computes derived invoice status from settled paise:
 * - 'needs_review' if needs_review is true
 * - 'paid' if settled_paise >= amount_paise
 * - 'partial' if 0 < settled_paise < amount_paise
 * - 'unpaid' if settled_paise === 0
 */
export function deriveInvoiceStatus(
  invoice: Pick<Invoice, 'amount_paise' | 'needs_review'>,
  matches: Array<Pick<Match, 'allocated_paise' | 'adjustment_paise' | 'status'>>
): InvoiceStatus {
  if (invoice.needs_review) {
    return 'needs_review';
  }
  const settled = calculateSettledPaise(matches);
  if (settled >= invoice.amount_paise && invoice.amount_paise > 0) {
    return 'paid';
  }
  if (settled > 0) {
    return 'partial';
  }
  return 'unpaid';
}

/**
 * Calculates outstanding paise for an invoice:
 * max(0, amount_paise - settled_paise)
 */
export function calculateOutstandingPaise(
  invoice: Pick<Invoice, 'amount_paise'>,
  matches: Array<Pick<Match, 'allocated_paise' | 'adjustment_paise' | 'status'>>
): number {
  const settled = calculateSettledPaise(matches);
  return Math.max(0, invoice.amount_paise - settled);
}
