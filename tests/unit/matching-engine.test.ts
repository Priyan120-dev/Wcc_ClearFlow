import { describe, it, expect } from 'vitest';
import { runMatchingEngine } from '@/lib/matching/engine';
import { Invoice, BankTxn, Match, PayerAlias } from '@/lib/types';

describe('Pure TypeScript Matching Engine Suite', () => {
  const baseInvoice: Invoice = {
    id: 'inv-101',
    user_id: 'user-1',
    number: 'INV-2024-101',
    customer_name: 'Sharma Tech Enterprises',
    customer_phone: '9876543210',
    amount_paise: 5000000, // ₹50,000.00
    gst_paise: 900000,    // ₹9,000.00 (Pre-GST = ₹41,000.00)
    round_off_paise: 0,
    issue_date: '2026-09-01',
    due_date: '2026-09-15',
    needs_review: false,
  };

  it('Pass 1: Matches exact amount with invoice number in narration with score >= 0.95', () => {
    const txn: BankTxn = {
      id: 'txn-1',
      user_id: 'user-1',
      date: '2026-09-05',
      amount_paise: 5000000,
      direction: 'credit',
      narration: 'UPI/4281901829/Payment for INV-2024-101/Axis Bank',
      utr_ref: '4281901829',
      dedupe_hash: 'hash-1',
    };

    const res = runMatchingEngine({
      invoices: [baseInvoice],
      txns: [txn],
    });

    expect(res.newSuggestedMatches.length).toBe(1);
    const m = res.newSuggestedMatches[0];
    expect(m.invoice_id).toBe('inv-101');
    expect(m.txn_id).toBe('txn-1');
    expect(m.score).toBeGreaterThanOrEqual(0.95);
    expect(m.method).toBe('ref_match');
    expect(m.reasons.some((r) => r.includes('INV-2024-101'))).toBe(true);
    expect(res.highConfidenceCount).toBe(1);
  });

  it('Pass 2: Matches exact amount with fuzzy name and close date', () => {
    const txn: BankTxn = {
      id: 'txn-2',
      user_id: 'user-1',
      date: '2026-09-08',
      amount_paise: 5000000,
      direction: 'credit',
      narration: 'NEFT-CR-SHARMA TECH ENTP-SALES',
      utr_ref: null,
      dedupe_hash: 'hash-2',
    };

    const res = runMatchingEngine({
      invoices: [baseInvoice],
      txns: [txn],
    });

    expect(res.newSuggestedMatches.length).toBe(1);
    const m = res.newSuggestedMatches[0];
    expect(m.score).toBeGreaterThanOrEqual(0.80);
    expect(m.method).toBe('fuzzy_composite');
  });

  it('Pass 2b: Computes TDS on pre-GST base first (10% on ₹41,000 = ₹4,100 -> ₹45,900)', () => {
    // Pre-GST base: 50,000 - 9,000 = 41,000. 10% TDS = 4,100. Expected payment = 45,900 (4590000 paise)
    const txn: BankTxn = {
      id: 'txn-3',
      user_id: 'user-1',
      date: '2026-09-10',
      amount_paise: 4590000, // ₹45,900
      direction: 'credit',
      narration: 'IMPS/P2A/SHARMA TECH/TDS DEDUCTED',
      utr_ref: null,
      dedupe_hash: 'hash-3',
    };

    const res = runMatchingEngine({
      invoices: [baseInvoice],
      txns: [txn],
    });

    expect(res.newSuggestedMatches.length).toBe(1);
    const m = res.newSuggestedMatches[0];
    expect(m.method).toBe('short_pay_tds');
    expect(m.adjustment_kind).toBe('tds');
    expect(m.adjustment_paise).toBe(410000); // ₹4,100
    expect(m.score).toBeLessThan(0.90); // Always REVIEW tier
    expect(m.reasons.some((r) => r.includes('pre-GST base'))).toBe(true);
    expect(res.reviewCount).toBe(1);
  });

  it('Pass 2b: Computes bank charges shortfall tolerance (₹20 = 2000 paise)', () => {
    const txn: BankTxn = {
      id: 'txn-4',
      user_id: 'user-1',
      date: '2026-09-05',
      amount_paise: 4998000, // ₹49,980 (₹20 bank fee deducted)
      direction: 'credit',
      narration: 'CMS/PAYMENT SHARMA TECH ENTERPRISES',
      utr_ref: null,
      dedupe_hash: 'hash-4',
    };

    const res = runMatchingEngine({
      invoices: [baseInvoice],
      txns: [txn],
    });

    expect(res.newSuggestedMatches.length).toBe(1);
    const m = res.newSuggestedMatches[0];
    expect(m.method).toBe('short_pay_tds');
    expect(m.adjustment_kind).toBe('bank_charge');
    expect(m.adjustment_paise).toBe(2000);
    expect(m.score).toBeLessThan(0.90);
  });

  it('Ambiguity Check: If top-2 candidate scores differ by < 0.05, forces REVIEW tier', () => {
    // Two nearly identical invoices for Sharma
    const invA: Invoice = {
      ...baseInvoice,
      id: 'inv-A',
      number: 'INV-A',
      issue_date: '2026-09-01',
    };
    const invB: Invoice = {
      ...baseInvoice,
      id: 'inv-B',
      number: 'INV-B',
      issue_date: '2026-09-02',
    };

    const txn: BankTxn = {
      id: 'txn-ambig',
      user_id: 'user-1',
      date: '2026-09-05',
      amount_paise: 5000000,
      direction: 'credit',
      narration: 'NEFT-SHARMA TECH ENTERPRISES-PAYMENT', // Matches both equally well
      utr_ref: null,
      dedupe_hash: 'hash-ambig',
    };

    const res = runMatchingEngine({
      invoices: [invA, invB],
      txns: [txn],
    });

    expect(res.newSuggestedMatches.length).toBe(1);
    const m = res.newSuggestedMatches[0];
    // Score should be forced below 0.90 into Review Tier
    expect(m.score).toBeLessThan(0.90);
    expect(m.reasons.some((r) => r.includes('Ambiguous match'))).toBe(true);
    expect(res.highConfidenceCount).toBe(0);
    expect(res.reviewCount).toBe(1);
  });

  it('Pass 3: Combined payment covering two invoices from the same customer', () => {
    const inv1: Invoice = {
      id: 'inv-c1',
      user_id: 'user-1',
      number: 'INV-201',
      customer_name: 'Patel Logistics',
      amount_paise: 2000000, // ₹20,000
      gst_paise: 0,
      round_off_paise: 0,
      issue_date: '2026-09-01',
      due_date: '2026-09-15',
      needs_review: false,
    };
    const inv2: Invoice = {
      id: 'inv-c2',
      user_id: 'user-1',
      number: 'INV-202',
      customer_name: 'Patel Logistics',
      amount_paise: 3000000, // ₹30,000
      gst_paise: 0,
      round_off_paise: 0,
      issue_date: '2026-09-02',
      due_date: '2026-09-16',
      needs_review: false,
    };

    const txnCombined: BankTxn = {
      id: 'txn-comb',
      user_id: 'user-1',
      date: '2026-09-05',
      amount_paise: 5000000, // Exactly ₹20,000 + ₹30,000
      direction: 'credit',
      narration: 'RTGS-PATEL LOGISTICS-INVOICE CLEARANCE',
      utr_ref: null,
      dedupe_hash: 'hash-comb',
    };

    const res = runMatchingEngine({
      invoices: [inv1, inv2],
      txns: [txnCombined],
    });

    expect(res.newSuggestedMatches.length).toBe(2);
    expect(res.newSuggestedMatches.every((m) => m.method === 'subset_sum')).toBe(true);
    expect(res.newSuggestedMatches.reduce((s, m) => s + m.allocated_paise, 0)).toBe(5000000);
  });

  it('Re-runs: Preserves confirmed matches, never alters rejected, never re-suggests rejected', () => {
    const confirmedMatch: Match = {
      id: 'match-conf',
      user_id: 'user-1',
      invoice_id: 'inv-101',
      txn_id: 'txn-existing',
      allocated_paise: 5000000,
      adjustment_paise: 0,
      score: 0.98,
      method: 'ref_match',
      status: 'confirmed',
      reasons: ['User confirmed'],
    };

    const rejectedMatch: Match = {
      id: 'match-rej',
      user_id: 'user-1',
      invoice_id: 'inv-101',
      txn_id: 'txn-bad',
      allocated_paise: 5000000,
      adjustment_paise: 0,
      score: 0.95,
      method: 'ref_match',
      status: 'rejected',
      reasons: ['User rejected'],
    };

    const badTxn: BankTxn = {
      id: 'txn-bad',
      user_id: 'user-1',
      date: '2026-09-05',
      amount_paise: 5000000,
      direction: 'credit',
      narration: 'INV-2024-101 payment',
      utr_ref: null,
      dedupe_hash: 'hash-bad',
    };

    const res = runMatchingEngine({
      invoices: [baseInvoice],
      txns: [badTxn],
      existingMatches: [confirmedMatch, rejectedMatch],
    });

    // Confirmed and rejected matches are preserved
    expect(res.matches.some((m) => m.id === 'match-conf')).toBe(true);
    expect(res.matches.some((m) => m.id === 'match-rej')).toBe(true);

    // Rejected pair (inv-101, txn-bad) MUST NOT be suggested again!
    expect(res.newSuggestedMatches.some((m) => m.txn_id === 'txn-bad')).toBe(false);
  });

  it('Payer Aliases: Saved alias elevates name matching score to 1.0 and records reason', () => {
    const alias: PayerAlias = {
      id: 'alias-1',
      user_id: 'user-1',
      raw_alias: 'STE-MUMBAI',
      customer_name: 'Sharma Tech Enterprises',
    };

    const txn: BankTxn = {
      id: 'txn-alias',
      user_id: 'user-1',
      date: '2026-09-05',
      amount_paise: 5000000,
      direction: 'credit',
      narration: 'UPI/STE-MUMBAI/PAYMENT',
      utr_ref: null,
      dedupe_hash: 'hash-alias',
    };

    const res = runMatchingEngine({
      invoices: [baseInvoice],
      txns: [txn],
      payerAliases: [alias],
    });

    expect(res.newSuggestedMatches.length).toBe(1);
    const m = res.newSuggestedMatches[0];
    expect(m.reasons.some((r) => r.includes('Matched via saved alias: "STE-MUMBAI"'))).toBe(true);
    expect(m.score).toBeGreaterThanOrEqual(0.90);
  });
});
