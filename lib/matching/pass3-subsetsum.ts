import { Invoice, BankTxn, PayerAlias } from '@/lib/types';
import { CandidateMatch } from './pass1-reference';
import { calculateNameScore } from './similarity';
import { formatPaiseToINR } from '@/lib/currency';

export interface GroupCandidateMatch {
  txn_id: string;
  invoice_ids: string[];
  allocations: Array<{ invoice_id: string; allocated_paise: number }>;
  score: number;
  method: 'subset_sum';
  reasons: string[];
}

/**
 * Pass 3: Combined Payments (Subset-Sum) & Split Payments
 * - Finds one bank transaction whose amount exactly equals the sum of 2 to 4 invoices
 *   belonging to the same customer.
 */
export function runPass3Combined(
  invoices: Array<Invoice & { unallocated_paise: number }>,
  txns: Array<BankTxn & { unallocated_paise: number }>,
  aliases: PayerAlias[] = []
): GroupCandidateMatch[] {
  const groupCandidates: GroupCandidateMatch[] = [];

  // Group invoices by customer name
  const invoicesByCustomer = new Map<string, Array<Invoice & { unallocated_paise: number }>>();
  for (const inv of invoices) {
    if (inv.unallocated_paise <= 0) continue;
    const custKey = inv.customer_name.trim().toUpperCase();
    if (!invoicesByCustomer.has(custKey)) {
      invoicesByCustomer.set(custKey, []);
    }
    invoicesByCustomer.get(custKey)!.push(inv);
  }

  for (const txn of txns) {
    if (txn.direction !== 'credit' || txn.unallocated_paise <= 0) continue;

    for (const [custName, custInvoices] of invoicesByCustomer.entries()) {
      if (custInvoices.length < 2) continue;

      // Identity check: does narration match customer name or alias?
      const nameResult = calculateNameScore(custName, txn.narration, aliases);
      if (!nameResult.isAliasHit && nameResult.score < 0.50) {
        continue;
      }

      // Check combinations of size 2, 3, 4 (capped to max 5 items to avoid combinatorial explosion)
      const subsetCandidates = custInvoices.slice(0, 5);
      const n = subsetCandidates.length;

      // Test combinations using bitmasks
      for (let mask = 3; mask < 1 << n; mask++) {
        // Count number of bits set
        const count = mask.toString(2).split('1').length - 1;
        if (count < 2 || count > 4) continue;

        let sumPaise = 0;
        const selectedInvoices: Array<Invoice & { unallocated_paise: number }> = [];

        for (let i = 0; i < n; i++) {
          if (mask & (1 << i)) {
            sumPaise += subsetCandidates[i].unallocated_paise;
            selectedInvoices.push(subsetCandidates[i]);
          }
        }

        if (sumPaise === txn.unallocated_paise) {
          const invNumbers = selectedInvoices.map((inv) => `"${inv.number}"`).join(', ');
          const reasons = [
            `Single payment of ${formatPaiseToINR(txn.unallocated_paise)} perfectly covers ${selectedInvoices.length} invoices: ${invNumbers}`,
          ];

          if (nameResult.isAliasHit && nameResult.matchedAlias) {
            reasons.push(`Matched via saved alias: "${nameResult.matchedAlias}" -> "${custName}"`);
          } else {
            reasons.push(`Customer name similarity (${Math.round(nameResult.score * 100)}%) with narration`);
          }

          groupCandidates.push({
            txn_id: txn.id,
            invoice_ids: selectedInvoices.map((inv) => inv.id),
            allocations: selectedInvoices.map((inv) => ({
              invoice_id: inv.id,
              allocated_paise: inv.unallocated_paise,
            })),
            score: nameResult.isAliasHit || nameResult.score >= 0.70 ? 0.91 : 0.84,
            method: 'subset_sum',
            reasons,
          });

          // Break to avoid duplicate combinations for this txn
          break;
        }
      }
    }
  }

  return groupCandidates;
}
