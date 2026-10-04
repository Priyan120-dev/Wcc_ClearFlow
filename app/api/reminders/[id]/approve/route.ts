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
    const { id: reminderId } = await params;

    const body = await req.json();
    const { status, draft_text, invoice_id, outstanding_paise } = body;

    if (!['approved', 'sent'].includes(status)) {
      return NextResponse.json({ error: 'Status must be approved or sent' }, { status: 400 });
    }

    // Save reminder if not existing
    const reminders = await db.getReminders(userId);
    let reminder = reminders.find((r) => r.id === reminderId || r.invoice_id === invoice_id);

    if (!reminder && invoice_id) {
      reminder = {
        id: reminderId,
        user_id: userId,
        invoice_id,
        channel: 'whatsapp',
        outstanding_paise: Number(outstanding_paise) || 0,
        draft_text: draft_text || '',
        status: 'draft',
        created_at: new Date().toISOString(),
      };
      await db.saveReminders(userId, [reminder]);
    }

    const updated = await db.updateReminderStatus(userId, reminderId, status);

    await db.addAuditLog(userId, {
      actor: 'user',
      action: status === 'sent' ? 'REMINDER_SENT' : 'REMINDER_APPROVED',
      entity: 'reminders',
      entity_id: reminderId,
      after: updated as any,
    });

    return NextResponse.json({ success: true, reminder: updated }, { headers: res.headers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update reminder' }, { status: 500 });
  }
}
