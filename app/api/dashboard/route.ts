import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';
import { deriveInvoiceStatus, calculateSettledPaise, calculateOutstandingPaise } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const res = new NextResponse();
    const userId = getOrCreateSessionId(req, res);

    const [invoices, txns, matches, auditLogs] = await Promise.all([
      db.getInvoices(userId),
      db.getBankTxns(userId),
      db.getMatches(userId),
      db.getAuditLogs(userId),
    ]);

    // Build map of invoice_id -> confirmed matches
    const confirmedMatchesByInv = new Map<string, typeof matches>();
    for (const m of matches) {
      if (m.status === 'confirmed') {
        if (!confirmedMatchesByInv.has(m.invoice_id)) {
          confirmedMatchesByInv.set(m.invoice_id, []);
        }
        confirmedMatchesByInv.get(m.invoice_id)!.push(m);
      }
    }

    // Derive status and compute outstanding for each invoice
    const enhancedInvoices = invoices.map((inv) => {
      const invMatches = confirmedMatchesByInv.get(inv.id) || [];
      const status = deriveInvoiceStatus(inv, invMatches);
      const settledPaise = calculateSettledPaise(invMatches);
      const outstandingPaise = calculateOutstandingPaise(inv, invMatches);

      return {
        ...inv,
        status,
        settled_paise: settledPaise,
        outstanding_paise: outstandingPaise,
      };
    });

    // Compute Dashboard Metric Totals
    const confirmedMatchedPaise = matches
      .filter((m) => m.status === 'confirmed')
      .reduce((sum, m) => sum + m.allocated_paise + (m.adjustment_paise || 0), 0);

    const highConfidenceSuggestedMatches = matches.filter((m) => m.status === 'suggested' && m.score >= 0.90);
    const highConfidencePaise = highConfidenceSuggestedMatches.reduce((sum, m) => sum + m.allocated_paise, 0);

    const reviewQueueMatches = matches.filter((m) => m.status === 'suggested' && m.score < 0.90);
    const reviewQueuePaise = reviewQueueMatches.reduce((sum, m) => sum + m.allocated_paise, 0);

    const activeMatchedTxnIds = new Set(matches.filter((m) => m.status !== 'rejected').map((m) => m.txn_id));
    const unmatchedCredits = txns.filter((t) => t.direction === 'credit' && !activeMatchedTxnIds.has(t.id));
    const unmatchedCreditsPaise = unmatchedCredits.reduce((sum, t) => sum + t.amount_paise, 0);

    const totalUnpaidPaise = enhancedInvoices
      .filter((i) => i.status !== 'paid')
      .reduce((sum, i) => sum + i.outstanding_paise, 0);

    return NextResponse.json(
      {
        metrics: {
          confirmedMatchedPaise,
          highConfidencePaise,
          reviewQueuePaise,
          unmatchedCreditsPaise,
          totalUnpaidPaise,
          invoicesCount: invoices.length,
          txnsCount: txns.length,
          highConfidenceCount: highConfidenceSuggestedMatches.length,
          reviewCount: reviewQueueMatches.length,
          unmatchedCreditsCount: unmatchedCredits.length,
        },
        invoices: enhancedInvoices,
        txns,
        matches,
        recentActivity: auditLogs.slice(0, 10),
      },
      { headers: res.headers }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch dashboard data' }, { status: 500 });
  }
}
