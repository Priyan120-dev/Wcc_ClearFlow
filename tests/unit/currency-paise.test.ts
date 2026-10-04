import { describe, it, expect } from 'vitest';
import { formatPaiseToINR, paiseToRupees, rupeesToPaise, parseAmountToPaise } from '@/lib/currency';
import { deriveInvoiceStatus, calculateSettledPaise, calculateOutstandingPaise, Invoice, Match } from '@/lib/types';

describe('Currency and Integer Paise Calculations', () => {
  it('formats integer paise to INR with Indian number grouping', () => {
    expect(formatPaiseToINR(0)).toBe('₹0.00');
    expect(formatPaiseToINR(150000)).toBe('₹1,500.00');
    expect(formatPaiseToINR(12450050)).toBe('₹1,24,500.50');
    expect(formatPaiseToINR(1000000000)).toBe('₹1,00,00,000.00');
    expect(formatPaiseToINR(12450050, { decimals: false })).toBe('₹1,24,500');
  });

  it('converts correctly between rupees and paise without floating point issues', () => {
    expect(rupeesToPaise('124500.50')).toBe(12450050);
    expect(rupeesToPaise(1245.5)).toBe(124550);
    expect(paiseToRupees(124550)).toBe(1245.5);
    expect(parseAmountToPaise('₹ 1,50,000.75')).toBe(15000075);
  });
});

describe('Derived Invoice Status and Settlement Math', () => {
  const invoice: Invoice = {
    id: 'inv-1',
    user_id: 'user-1',
    number: 'INV-001',
    customer_name: 'Sharma Tech',
    amount_paise: 5000000, // ₹50,000
    gst_paise: 900000,
    round_off_paise: 0,
    issue_date: '2026-09-01',
    due_date: '2026-09-15',
    needs_review: false,
  };

  it('returns unpaid when no confirmed matches exist', () => {
    const status = deriveInvoiceStatus(invoice, []);
    expect(status).toBe('unpaid');
    expect(calculateOutstandingPaise(invoice, [])).toBe(5000000);
  });

  it('ignores suggested and rejected matches', () => {
    const matches: Match[] = [
      {
        id: 'm1',
        user_id: 'user-1',
        invoice_id: 'inv-1',
        txn_id: 't1',
        allocated_paise: 5000000,
        adjustment_paise: 0,
        score: 0.95,
        method: 'ref_match',
        status: 'suggested',
        reasons: [],
      },
      {
        id: 'm2',
        user_id: 'user-1',
        invoice_id: 'inv-1',
        txn_id: 't2',
        allocated_paise: 5000000,
        adjustment_paise: 0,
        score: 0.95,
        method: 'ref_match',
        status: 'rejected',
        reasons: [],
      },
    ];
    expect(deriveInvoiceStatus(invoice, matches)).toBe('unpaid');
  });

  it('derives partial status when settled_paise < amount_paise', () => {
    const matches: Match[] = [
      {
        id: 'm1',
        user_id: 'user-1',
        invoice_id: 'inv-1',
        txn_id: 't1',
        allocated_paise: 2500000, // ₹25,000
        adjustment_paise: 0,
        score: 0.95,
        method: 'ref_match',
        status: 'confirmed',
        reasons: [],
      },
    ];
    expect(calculateSettledPaise(matches)).toBe(2500000);
    expect(calculateOutstandingPaise(invoice, matches)).toBe(2500000);
    expect(deriveInvoiceStatus(invoice, matches)).toBe('partial');
  });

  it('derives paid status when settled_paise >= amount_paise (including adjustments)', () => {
    const matches: Match[] = [
      {
        id: 'm1',
        user_id: 'user-1',
        invoice_id: 'inv-1',
        txn_id: 't1',
        allocated_paise: 4500000, // ₹45,000 payment
        adjustment_paise: 500000,  // ₹5,000 TDS deduction
        adjustment_kind: 'tds',
        score: 0.85,
        method: 'short_pay_tds',
        status: 'confirmed',
        reasons: ['TDS deduction'],
      },
    ];
    expect(calculateSettledPaise(matches)).toBe(5000000);
    expect(calculateOutstandingPaise(invoice, matches)).toBe(0);
    expect(deriveInvoiceStatus(invoice, matches)).toBe('paid');
  });

  it('returns needs_review if invoice has extraction needs_review flag', () => {
    const invReview = { ...invoice, needs_review: true };
    expect(deriveInvoiceStatus(invReview, [])).toBe('needs_review');
  });
});
