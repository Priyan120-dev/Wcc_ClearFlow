import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';
import { deriveInvoiceStatus, calculateSettledPaise, calculateOutstandingPaise } from '@/lib/types';
import { formatPaiseToINR, paiseToRupees } from '@/lib/currency';
import { normalizePhoneForWhatsApp } from '@/lib/utils';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const res = new NextResponse();
    const userId = getOrCreateSessionId(req, res);

    const [invoices, matches, existingReminders] = await Promise.all([
      db.getInvoices(userId),
      db.getMatches(userId),
      db.getReminders(userId),
    ]);

    const remindersMap = new Map(existingReminders.map((r) => [r.invoice_id, r]));

    // Confirmed matches per invoice
    const confirmedMatchesByInv = new Map<string, typeof matches>();
    const suggestedMatchesByInv = new Map<string, typeof matches>();

    for (const m of matches) {
      if (m.status === 'confirmed') {
        if (!confirmedMatchesByInv.has(m.invoice_id)) confirmedMatchesByInv.set(m.invoice_id, []);
        confirmedMatchesByInv.get(m.invoice_id)!.push(m);
      } else if (m.status === 'suggested') {
        if (!suggestedMatchesByInv.has(m.invoice_id)) suggestedMatchesByInv.set(m.invoice_id, []);
        suggestedMatchesByInv.get(m.invoice_id)!.push(m);
      }
    }

    const items: any[] = [];

    for (const inv of invoices) {
      // REQUIREMENT: Block reminders for needs_review invoices
      if (inv.needs_review) continue;

      const confirmedMatches = confirmedMatchesByInv.get(inv.id) || [];
      const status = deriveInvoiceStatus(inv, confirmedMatches);

      // Only unpaid or partial invoices get payment reminders
      if (status === 'paid') continue;

      const outstandingPaise = calculateOutstandingPaise(inv, confirmedMatches);
      if (outstandingPaise <= 0) continue;

      const hasSuggestedMatch = (suggestedMatchesByInv.get(inv.id) || []).length > 0;
      const existing = remindersMap.get(inv.id);

      const normalizedPhone = normalizePhoneForWhatsApp(inv.customer_phone);

      // Plain text reminder draft (NO bank account or IFSC details)
      const draftText = `Dear ${inv.customer_name},

This is a gentle payment reminder regarding Invoice #${inv.number} (dated ${inv.issue_date}).
Outstanding Balance: ${formatPaiseToINR(outstandingPaise)}
Due Date: ${inv.due_date}

Kindly settle the outstanding amount using UPI.
Thank you for your business.`;

      items.push({
        id: existing?.id || `rem-${inv.id}`,
        invoice_id: inv.id,
        invoice_number: inv.number,
        customer_name: inv.customer_name,
        customer_phone: inv.customer_phone,
        normalized_phone: normalizedPhone,
        customer_email: inv.customer_email,
        due_date: inv.due_date,
        total_paise: inv.amount_paise,
        outstanding_paise: outstandingPaise,
        outstanding_rupees: paiseToRupees(outstandingPaise).toFixed(2),
        draft_text: existing?.draft_text || draftText,
        status: existing?.status || 'draft',
        last_reminded_at: existing?.last_reminded_at || null,
        has_suggested_match: hasSuggestedMatch,
      });
    }

    return NextResponse.json({ reminders: items }, { headers: res.headers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to fetch reminders' }, { status: 500 });
  }
}
