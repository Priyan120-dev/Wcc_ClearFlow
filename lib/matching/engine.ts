import { Invoice, BankTxn, Match, PayerAlias } from '@/lib/types';
import { runPass1Reference, CandidateMatch } from './pass1-reference';
import { runPass2Fuzzy } from './pass2-fuzzy';
import { runPass2bShortPay } from './pass2b-shortpay';
import { runPass3Combined } from './pass3-subsetsum';
import { assignMatches, FinalMatchOutput } from './assignment';

export interface MatchingEngineOptions {
  invoices: Invoice[];
  txns: BankTxn[];
  existingMatches?: Match[];
  payerAliases?: PayerAlias[];
  enablePass2b?: boolean;
  enablePass3?: boolean;
}

export interface MatchingResult {
  matches: Match[]; // All matches (preserved confirmed + preserved rejected + freshly generated suggested)
  newSuggestedMatches: Match[];
  highConfidenceCount: number;
  reviewCount: number;
  unmatchedTxnCount: number;
  unmatchedInvoiceCount: number;
  processingTimeMs: number;
}

/**
 * Pure TypeScript deterministic matching engine.
 * Never uses LLMs. Fully testable and explainable.
 * Invariants:
 * 1. Confirmed and Rejected matches are preserved and never altered.
 * 2. Rejected pairs are never re-suggested.
 * 3. Re-runs only recompute 'suggested' rows on remaining unallocated amounts.
 */
export function runMatchingEngine(options: MatchingEngineOptions): MatchingResult {
  const startTime = performance.now();
  const {
    invoices,
    txns,
    existingMatches = [],
    payerAliases = [],
    enablePass2b = true,
    enablePass3 = true,
  } = options;

  // 1. Separate existing matches by status
  const confirmedMatches = existingMatches.filter((m) => m.status === 'confirmed');
  const rejectedMatches = existingMatches.filter((m) => m.status === 'rejected');

  const rejectedPairs = new Set<string>();
  for (const r of rejectedMatches) {
    rejectedPairs.add(`${r.invoice_id}:${r.txn_id}`);
  }

  // 2. Compute unallocated amounts for invoices and transactions
  const invoicesUnallocated = new Map<string, number>();
  for (const inv of invoices) {
    invoicesUnallocated.set(inv.id, inv.amount_paise);
  }

  const txnsUnallocated = new Map<string, number>();
  for (const t of txns) {
    // Only credits can be allocated to invoices
    txnsUnallocated.set(t.id, t.direction === 'credit' ? t.amount_paise : 0);
  }

  // Deduct confirmed matches from unallocated amounts
  for (const cm of confirmedMatches) {
    const curTxn = txnsUnallocated.get(cm.txn_id) || 0;
    txnsUnallocated.set(cm.txn_id, Math.max(0, curTxn - cm.allocated_paise));

    const curInv = invoicesUnallocated.get(cm.invoice_id) || 0;
    const totalDeducted = cm.allocated_paise + (cm.adjustment_paise || 0);
    invoicesUnallocated.set(cm.invoice_id, Math.max(0, curInv - totalDeducted));
  }

  // 3. Prepare data with current unallocated amounts
  const activeInvoices = invoices.map((inv) => ({
    ...inv,
    unallocated_paise: invoicesUnallocated.get(inv.id) || 0,
  }));

  const activeTxns = txns.map((t) => ({
    ...t,
    unallocated_paise: txnsUnallocated.get(t.id) || 0,
  }));

  // 4. Candidate Generation
  // Pass 1: Reference / UTR Match
  const pass1Candidates = runPass1Reference(activeInvoices, activeTxns);

  // Pass 2: Composite Heuristic (Amount + Date + Name/Alias)
  const pass2Candidates = runPass2Fuzzy(activeInvoices, activeTxns, payerAliases);

  // Pass 2b: Short-Pay Tolerance (TDS dual-base + bank charges)
  const pass2bCandidates = enablePass2b
    ? runPass2bShortPay(activeInvoices, activeTxns, payerAliases)
    : [];

  // Pass 3: Combined Payments (Subset-Sum)
  const pass3GroupCandidates = enablePass3
    ? runPass3Combined(activeInvoices, activeTxns, payerAliases)
    : [];

  // Merge single candidate matches, avoiding duplicate pairs between passes (keep highest score)
  const candidateKeyMap = new Map<string, CandidateMatch>();
  const allSingleCandidates = [...pass1Candidates, ...pass2Candidates, ...pass2bCandidates];

  for (const c of allSingleCandidates) {
    const key = `${c.invoice_id}:${c.txn_id}`;
    if (!candidateKeyMap.has(key) || candidateKeyMap.get(key)!.score < c.score) {
      candidateKeyMap.set(key, c);
    }
  }

  // 5. Pre-Assignment Ambiguity Check & Greedy 1-to-1 Assignment
  const assigned = assignMatches(
    Array.from(candidateKeyMap.values()),
    pass3GroupCandidates,
    {
      rejectedPairs,
      invoicesUnallocated,
      txnsUnallocated,
    }
  );

  // 6. Convert assigned outputs to Match domain objects
  const newSuggestedMatches: Match[] = assigned.map((a, idx) => ({
    id: `suggested-${Date.now()}-${idx}`,
    user_id: invoices.find((i) => i.id === a.invoice_id)?.user_id || 'demo-user',
    invoice_id: a.invoice_id,
    txn_id: a.txn_id,
    allocated_paise: a.allocated_paise,
    adjustment_paise: a.adjustment_paise,
    adjustment_kind: a.adjustment_kind,
    score: a.score,
    method: a.method,
    status: 'suggested',
    reasons: a.reasons,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }));

  // Combine confirmed + rejected + newly generated suggested matches
  const allMatches = [...confirmedMatches, ...rejectedMatches, ...newSuggestedMatches];

  // Compute operational KPIs
  const highConfidenceCount = newSuggestedMatches.filter((m) => m.score >= 0.90).length;
  const reviewCount = newSuggestedMatches.filter((m) => m.score >= 0.60 && m.score < 0.90).length;

  const matchedTxnIds = new Set(allMatches.filter((m) => m.status !== 'rejected').map((m) => m.txn_id));
  const unmatchedTxnCount = txns.filter((t) => t.direction === 'credit' && !matchedTxnIds.has(t.id)).length;

  const matchedInvoiceIds = new Set(
    allMatches.filter((m) => m.status === 'confirmed').map((m) => m.invoice_id)
  );
  const unmatchedInvoiceCount = invoices.filter((i) => !matchedInvoiceIds.has(i.id)).length;

  const processingTimeMs = Math.round((performance.now() - startTime) * 100) / 100;

  return {
    matches: allMatches,
    newSuggestedMatches,
    highConfidenceCount,
    reviewCount,
    unmatchedTxnCount,
    unmatchedInvoiceCount,
    processingTimeMs,
  };
}
