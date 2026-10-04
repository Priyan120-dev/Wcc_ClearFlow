import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const res = new NextResponse();
    const userId = getOrCreateSessionId(req, res);
    const { id: invoiceId } = await params;

    const body = await req.json();
    const {
      number,
      customer_name,
      customer_phone,
      customer_email,
      issue_date,
      due_date,
      subtotal_paise,
      gst_paise,
      round_off_paise = 0,
      total_paise,
    } = body;

    const invoices = await db.getInvoices(userId);
    const existing = invoices.find((i) => i.id === invoiceId);
    if (!existing) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Re-validate math check: |subtotal + gst + round_off - total| <= 100 paise
    const subtotal = Number(subtotal_paise) || 0;
    const gst = Number(gst_paise) || 0;
    const roundOff = Number(round_off_paise) || 0;
    const total = Number(total_paise) || subtotal + gst + roundOff;
    const diff = Math.abs(subtotal + gst + roundOff - total);

    let needsReview = false;
    let reviewReason: string | undefined = undefined;

    if (diff > 100) {
      needsReview = true;
      reviewReason = `Math check mismatch: Subtotal + GST + Round-off differs from total by ₹${(diff / 100).toFixed(2)}`;
    }

    const updates = {
      number: number || existing.number,
      customer_name: customer_name || existing.customer_name,
      customer_phone: customer_phone !== undefined ? customer_phone : existing.customer_phone,
      customer_email: customer_email !== undefined ? customer_email : existing.customer_email,
      issue_date: issue_date || existing.issue_date,
      due_date: due_date || existing.due_date,
      amount_paise: total,
      gst_paise: gst,
      round_off_paise: roundOff,
      needs_review: needsReview,
      raw_json: {
        ...(existing.raw_json || {}),
        subtotal_paise: subtotal,
        gst_paise: gst,
        round_off_paise: roundOff,
        total_paise: total,
        review_reason: reviewReason,
        manual_verified: !needsReview,
      },
    };

    const updated = await db.updateInvoice(userId, invoiceId, updates);

    await db.addAuditLog(userId, {
      actor: 'user',
      action: 'INVOICE_EDIT_VERIFIED',
      entity: 'invoices',
      entity_id: invoiceId,
      before: existing as any,
      after: updated as any,
    });

    return NextResponse.json({ success: true, invoice: updated }, { headers: res.headers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update invoice' }, { status: 500 });
  }
}
