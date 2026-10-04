import { Invoice, BankTxn, PayerAlias } from '@/lib/types';
import { CandidateMatch } from './pass1-reference';
import { calculateNameScore } from './similarity';
import { formatPaiseToINR } from '@/lib/currency';

/**
 * Calculates date proximity score between invoice issue date and transaction date:
 * Payment within 0-60 days of invoice issue date.
 */
function calculateDateProximity(issueDateStr: string, txnDateStr: string): { score: number; daysDiff: number } {
  const issueDate = new Date(issueDateStr).getTime();
  const txnDate = new Date(txnDateStr).getTime();
  const daysDiff = Math.round((txnDate - issueDate) / (1000 * 60 * 60 * 24));

  // Payment occurred before invoice was issued (allow up to 2 days for bank clearing / backdating)
  if (daysDiff < -2) {
    return { score: 0.0, daysDiff };
  }
  if (daysDiff >= -2 && daysDiff <= 15) {
    return { score: 1.0, daysDiff };
  }
  if (daysDiff <= 30) {
    return { score: 0.8, daysDiff };
  }
  if (daysDiff <= 60) {
    return { score: 0.5, daysDiff };
  }
  return { score: 0.2, daysDiff };
}

/**
 * Pass 2: Composite Heuristic Match
 * Combines exact amount (0.50) + date proximity (0.20) + fuzzy/alias name (0.30).
 */
export function runPass2Fuzzy(
  invoices: Array<Invoice & { unallocated_paise: number }>,
  txns: Array<BankTxn & { unallocated_paise: number }>,
  aliases: PayerAlias[] = []
): CandidateMatch[] {
  const candidates: CandidateMatch[] = [];

  for (const txn of txns) {
    if (txn.direction !== 'credit' || txn.unallocated_paise <= 0) continue;

    for (const inv of invoices) {
      if (inv.unallocated_paise <= 0) continue;

      // Exact amount is required for Pass 2 composite matching
      if (txn.unallocated_paise !== inv.unallocated_paise) continue;

      const reasons: string[] = [];
      const amountScore = 0.50;
      reasons.push(`Exact amount matched (${formatPaiseToINR(txn.unallocated_paise)})`);

      // Date Proximity (0.20 weight)
      const { score: dateNorm, daysDiff } = calculateDateProximity(inv.issue_date, txn.date);
      const dateScore = dateNorm * 0.20;
      if (daysDiff >= 0) {
        reasons.push(`Payment received ${daysDiff} days after invoice date`);
      } else {
        reasons.push(`Payment received close to invoice issue date (${daysDiff} days)`);
      }

      // Customer Name / Alias Match (0.30 weight)
      const nameResult = calculateNameScore(inv.customer_name, txn.narration, aliases);
      // Require at least partial customer identity evidence (>= 0.35) or alias hit
      if (!nameResult.isAliasHit && nameResult.score < 0.35) {
        continue;
      }
      const nameScore = nameResult.score * 0.30;

      if (nameResult.isAliasHit && nameResult.matchedAlias) {
        reasons.push(`Matched via saved alias: "${nameResult.matchedAlias}" -> "${inv.customer_name}"`);
      } else if (nameResult.score >= 0.70) {
        reasons.push(`Customer name similarity (${Math.round(nameResult.score * 100)}%) with narration`);
      } else {
        reasons.push(`Partial customer name match in narration`);
      }

      const totalScore = Number((amountScore + dateScore + nameScore).toFixed(3));

      // Threshold: only return candidates with score >= 0.60
      if (totalScore >= 0.60) {
        candidates.push({
          invoice_id: inv.id,
          txn_id: txn.id,
          allocated_paise: txn.unallocated_paise,
          adjustment_paise: 0,
          adjustment_kind: null,
          score: totalScore,
          method: 'fuzzy_composite',
          reasons,
        });
      }
    }
  }

  return candidates;
}
