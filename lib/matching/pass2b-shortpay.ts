import { Invoice, BankTxn, PayerAlias } from '@/lib/types';
import { CandidateMatch } from './pass1-reference';
import { calculateNameScore } from './similarity';
import { formatPaiseToINR } from '@/lib/currency';

export interface ShortPayConfig {
  tdsRates?: number[]; // Default: [1, 2, 5, 10] percent
  maxBankChargeTolerancePaise?: number; // Default: 5000 paise (₹50.00)
}

/**
 * Pass 2b: Short-Pay Tolerance (TDS & Bank Charges/Rounding)
 * Always places matches in the REVIEW tier (score capped at 0.85).
 * Requires positive name/alias/reference evidence; amount-only shortfalls are rejected.
 */
export function runPass2bShortPay(
  invoices: Array<Invoice & { unallocated_paise: number }>,
  txns: Array<BankTxn & { unallocated_paise: number }>,
  aliases: PayerAlias[] = [],
  config: ShortPayConfig = {}
): CandidateMatch[] {
  const { tdsRates = [1, 2, 5, 10], maxBankChargeTolerancePaise = 5000 } = config;
  const candidates: CandidateMatch[] = [];

  for (const txn of txns) {
    if (txn.direction !== 'credit' || txn.unallocated_paise <= 0) continue;

    for (const inv of invoices) {
      if (inv.unallocated_paise <= 0) continue;
      // If txn is greater than or equal to unallocated, not a short-pay
      if (txn.unallocated_paise >= inv.unallocated_paise) continue;

      // REQUIREMENT: Must have positive name, alias, or reference evidence
      const normNarration = txn.narration.toUpperCase();
      const hasInvoiceRef = normNarration.includes(inv.number.toUpperCase());
      const nameResult = calculateNameScore(inv.customer_name, txn.narration, aliases);
      const hasStrongIdentity = hasInvoiceRef || nameResult.isAliasHit || nameResult.score >= 0.50;

      if (!hasStrongIdentity) {
        // Amount-only shortfalls are NOT candidates!
        continue;
      }

      let matched = false;
      let adjustmentPaise = 0;
      let adjustmentKind: 'tds' | 'bank_charge' = 'tds';
      const reasons: string[] = [];

      // Add identity reason
      if (hasInvoiceRef) {
        reasons.push(`Invoice number "${inv.number}" found in narration`);
      } else if (nameResult.isAliasHit && nameResult.matchedAlias) {
        reasons.push(`Matched via saved alias: "${nameResult.matchedAlias}" -> "${inv.customer_name}"`);
      } else {
        reasons.push(`Customer name similarity (${Math.round(nameResult.score * 100)}%) in narration`);
      }

      // 1. Dual-base TDS Check:
      // Base A: Pre-GST amount (amount_paise - gst_paise)
      const preGstBase = Math.max(0, inv.amount_paise - inv.gst_paise);
      if (preGstBase > 0) {
        for (const rate of tdsRates) {
          const expectedTds = Math.round(preGstBase * (rate / 100));
          const expectedPayment = inv.amount_paise - expectedTds;

          // Allow up to 100 paise (₹1.00) rounding leeway
          if (Math.abs(txn.unallocated_paise - expectedPayment) <= 100) {
            matched = true;
            adjustmentPaise = expectedTds;
            adjustmentKind = 'tds';
            reasons.push(
              `Amount ${formatPaiseToINR(txn.unallocated_paise)} matches ${formatPaiseToINR(
                inv.amount_paise
              )} invoice minus ${rate}% TDS (${formatPaiseToINR(expectedTds)}) computed on pre-GST base (${formatPaiseToINR(
                preGstBase
              )})`
            );
            break;
          }
        }
      }

      // Base B: Total amount base (if pre-GST didn't match)
      if (!matched && inv.amount_paise > 0) {
        for (const rate of tdsRates) {
          const expectedTds = Math.round(inv.amount_paise * (rate / 100));
          const expectedPayment = inv.amount_paise - expectedTds;

          if (Math.abs(txn.unallocated_paise - expectedPayment) <= 100) {
            matched = true;
            adjustmentPaise = expectedTds;
            adjustmentKind = 'tds';
            reasons.push(
              `Amount ${formatPaiseToINR(txn.unallocated_paise)} matches ${formatPaiseToINR(
                inv.amount_paise
              )} invoice minus ${rate}% TDS (${formatPaiseToINR(expectedTds)}) computed on total base`
            );
            break;
          }
        }
      }

      // 2. Bank charge / small rounding tolerance (up to maxBankChargeTolerancePaise)
      if (!matched) {
        const shortfall = inv.unallocated_paise - txn.unallocated_paise;
        if (shortfall > 0 && shortfall <= maxBankChargeTolerancePaise) {
          matched = true;
          adjustmentPaise = shortfall;
          adjustmentKind = 'bank_charge';
          reasons.push(
            `Amount ${formatPaiseToINR(txn.unallocated_paise)} matches ${formatPaiseToINR(
              inv.unallocated_paise
            )} invoice minus ${formatPaiseToINR(shortfall)} bank charge / rounding`
          );
        }
      }

      if (matched) {
        // ALWAYS in the REVIEW tier (score capped between 0.75 and 0.85)
        const score = hasInvoiceRef || nameResult.isAliasHit ? 0.85 : 0.78;
        candidates.push({
          invoice_id: inv.id,
          txn_id: txn.id,
          allocated_paise: txn.unallocated_paise,
          adjustment_paise: adjustmentPaise,
          adjustment_kind: adjustmentKind,
          score,
          method: 'short_pay_tds',
          reasons,
        });
      }
    }
  }

  return candidates;
}
