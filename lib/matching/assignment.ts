import { CandidateMatch } from './pass1-reference';
import { GroupCandidateMatch } from './pass3-subsetsum';
import { Match } from '@/lib/types';

export interface AssignOptions {
  rejectedPairs: Set<string>; // Set of "invoice_id:txn_id"
  invoicesUnallocated: Map<string, number>;
  txnsUnallocated: Map<string, number>;
}

export interface FinalMatchOutput {
  invoice_id: string;
  txn_id: string;
  allocated_paise: number;
  adjustment_paise: number;
  adjustment_kind?: 'tds' | 'bank_charge' | null;
  score: number;
  method: 'ref_match' | 'fuzzy_composite' | 'short_pay_tds' | 'subset_sum';
  reasons: string[];
  status: 'suggested';
}

/**
 * Evaluates ambiguity margins and performs greedy 1-to-1 assignment:
 * - Checks ambiguity (< 0.05 score difference) per txn and per invoice BEFORE greedy assignment
 * - Assigns on remaining unallocated amounts
 * - Preserves rejected pairs (never re-suggests)
 */
export function assignMatches(
  singleCandidates: CandidateMatch[],
  groupCandidates: GroupCandidateMatch[],
  options: AssignOptions
): FinalMatchOutput[] {
  const { rejectedPairs, invoicesUnallocated, txnsUnallocated } = options;

  // 1. Filter out rejected pairs
  const validSingles = singleCandidates.filter(
    (c) => !rejectedPairs.has(`${c.invoice_id}:${c.txn_id}`)
  );

  // Group candidates filtering
  const validGroups = groupCandidates.filter((g) => {
    return !g.invoice_ids.some((invId) => rejectedPairs.has(`${invId}:${g.txn_id}`));
  });

  // 2. Pre-assignment Ambiguity Check per Transaction and per Invoice
  const txnCandidatesMap = new Map<string, CandidateMatch[]>();
  const invCandidatesMap = new Map<string, CandidateMatch[]>();

  for (const c of validSingles) {
    if (!txnCandidatesMap.has(c.txn_id)) txnCandidatesMap.set(c.txn_id, []);
    txnCandidatesMap.get(c.txn_id)!.push(c);

    if (!invCandidatesMap.has(c.invoice_id)) invCandidatesMap.set(c.invoice_id, []);
    invCandidatesMap.get(c.invoice_id)!.push(c);
  }

  const ambiguousKeys = new Set<string>(); // "invoice_id:txn_id"

  // Ambiguity per transaction
  for (const [, candidates] of txnCandidatesMap.entries()) {
    if (candidates.length >= 2) {
      candidates.sort((a, b) => b.score - a.score);
      const top1 = candidates[0];
      const top2 = candidates[1];
      if (top1.score - top2.score < 0.05) {
        ambiguousKeys.add(`${top1.invoice_id}:${top1.txn_id}`);
        ambiguousKeys.add(`${top2.invoice_id}:${top2.txn_id}`);
      }
    }
  }

  // Ambiguity per invoice
  for (const [, candidates] of invCandidatesMap.entries()) {
    if (candidates.length >= 2) {
      candidates.sort((a, b) => b.score - a.score);
      const top1 = candidates[0];
      const top2 = candidates[1];
      if (top1.score - top2.score < 0.05) {
        ambiguousKeys.add(`${top1.invoice_id}:${top1.txn_id}`);
        ambiguousKeys.add(`${top2.invoice_id}:${top2.txn_id}`);
      }
    }
  }

  // Apply ambiguity enforcement: If ambiguous, force to REVIEW tier (cap score at 0.84)
  for (const c of validSingles) {
    const key = `${c.invoice_id}:${c.txn_id}`;
    if (ambiguousKeys.has(key)) {
      if (c.score >= 0.90) {
        c.score = 0.84; // Cap below 0.90 high-confidence threshold
      }
      c.reasons.push('Ambiguous match: competing candidate exists within 0.05 score margin (routed to Review Queue)');
    }
  }

  // 3. Greedy 1-to-1 Assignment
  // Unified candidate list
  type AssignmentItem =
    | { type: 'single'; candidate: CandidateMatch; score: number }
    | { type: 'group'; candidate: GroupCandidateMatch; score: number };

  const allItems: AssignmentItem[] = [
    ...validSingles.map((c) => ({ type: 'single' as const, candidate: c, score: c.score })),
    ...validGroups.map((g) => ({ type: 'group' as const, candidate: g, score: g.score })),
  ];

  // Sort descending by score
  allItems.sort((a, b) => b.score - a.score);

  const finalMatches: FinalMatchOutput[] = [];

  for (const item of allItems) {
    if (item.type === 'single') {
      const c = item.candidate;
      const curTxnUnallocated = txnsUnallocated.get(c.txn_id) || 0;
      const curInvUnallocated = invoicesUnallocated.get(c.invoice_id) || 0;

      // Check if both have remaining unallocated funds
      if (curTxnUnallocated <= 0 || curInvUnallocated <= 0) continue;

      const effectiveAllocation = Math.min(c.allocated_paise, curTxnUnallocated, curInvUnallocated);
      if (effectiveAllocation <= 0) continue;

      txnsUnallocated.set(c.txn_id, curTxnUnallocated - effectiveAllocation);
      invoicesUnallocated.set(c.invoice_id, curInvUnallocated - effectiveAllocation - (c.adjustment_paise || 0));

      finalMatches.push({
        invoice_id: c.invoice_id,
        txn_id: c.txn_id,
        allocated_paise: effectiveAllocation,
        adjustment_paise: c.adjustment_paise,
        adjustment_kind: c.adjustment_kind,
        score: c.score,
        method: c.method,
        reasons: c.reasons,
        status: 'suggested',
      });
    } else {
      // Group candidate (Pass 3)
      const g = item.candidate;
      const curTxnUnallocated = txnsUnallocated.get(g.txn_id) || 0;

      // Verify all invoices have sufficient unallocated amount
      let canFulfill = curTxnUnallocated > 0;
      for (const alloc of g.allocations) {
        const invRem = invoicesUnallocated.get(alloc.invoice_id) || 0;
        if (invRem < alloc.allocated_paise) {
          canFulfill = false;
          break;
        }
      }

      if (canFulfill) {
        let txnUsed = 0;
        for (const alloc of g.allocations) {
          const invRem = invoicesUnallocated.get(alloc.invoice_id) || 0;
          invoicesUnallocated.set(alloc.invoice_id, invRem - alloc.allocated_paise);
          txnUsed += alloc.allocated_paise;

          finalMatches.push({
            invoice_id: alloc.invoice_id,
            txn_id: g.txn_id,
            allocated_paise: alloc.allocated_paise,
            adjustment_paise: 0,
            adjustment_kind: null,
            score: g.score,
            method: g.method,
            reasons: g.reasons,
            status: 'suggested',
          });
        }
        txnsUnallocated.set(g.txn_id, curTxnUnallocated - txnUsed);
      }
    }
  }

  return finalMatches;
}
