import { Invoice, BankTxn, Match } from '@/lib/types';
import { formatPaiseToINR } from '@/lib/currency';

export interface CandidateMatch {
  invoice_id: string;
  txn_id: string;
  allocated_paise: number;
  adjustment_paise: number;
  adjustment_kind?: 'tds' | 'bank_charge' | null;
  score: number;
  method: 'ref_match' | 'fuzzy_composite' | 'short_pay_tds' | 'subset_sum';
  reasons: string[];
}

/**
 * Extracts alphanumeric representation for comparison (e.g. "INV-2024-042" -> "INV2024042")
 */
function cleanRef(str: string): string {
  return str.replace(/[^A-Z0-9]/gi, '').toUpperCase();
}

/**
 * Pass 1: Reference Match (Score >= 0.95)
 * Checks for invoice number or UTR reference in bank narration + exact amount match.
 */
export function runPass1Reference(
  invoices: Array<Invoice & { unallocated_paise: number }>,
  txns: Array<BankTxn & { unallocated_paise: number }>
): CandidateMatch[] {
  const candidates: CandidateMatch[] = [];

  for (const txn of txns) {
    if (txn.direction !== 'credit' || txn.unallocated_paise <= 0) continue;

    const normNarration = txn.narration.toUpperCase();
    const cleanNarration = cleanRef(txn.narration);

    for (const inv of invoices) {
      if (inv.unallocated_paise <= 0) continue;

      // Exact amount match check
      if (txn.unallocated_paise !== inv.unallocated_paise) continue;

      const invNum = inv.number.toUpperCase();
      const cleanInvNum = cleanRef(inv.number);

      let isRefHit = false;
      const reasons: string[] = [];

      // 1. Direct invoice number in narration
      if (normNarration.includes(invNum) || (cleanInvNum.length >= 4 && cleanNarration.includes(cleanInvNum))) {
        isRefHit = true;
        reasons.push(`Invoice number "${inv.number}" found in transaction narration`);
      }

      // 2. UTR reference match if invoice raw_json or reference field contains it
      if (txn.utr_ref && txn.utr_ref.length >= 8 && normNarration.includes(txn.utr_ref.toUpperCase())) {
        if (!isRefHit) {
          // Check if invoice raw_json notes or comments mention this UTR
          const rawText = JSON.stringify(inv.raw_json || '').toUpperCase();
          if (rawText.includes(txn.utr_ref.toUpperCase())) {
            isRefHit = true;
            reasons.push(`UTR reference ${txn.utr_ref} matched invoice records`);
          }
        }
      }

      if (isRefHit) {
        reasons.push(`Exact amount matched (${formatPaiseToINR(txn.unallocated_paise)})`);
        candidates.push({
          invoice_id: inv.id,
          txn_id: txn.id,
          allocated_paise: txn.unallocated_paise,
          adjustment_paise: 0,
          adjustment_kind: null,
          score: 0.98,
          method: 'ref_match',
          reasons,
        });
      }
    }
  }

  return candidates;
}
