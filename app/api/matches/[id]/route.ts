import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';
import { normalizeBusinessName } from '@/lib/matching/similarity';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const res = new NextResponse();
    const userId = getOrCreateSessionId(req, res);
    const { id: matchId } = await params;

    const body = await req.json();
    const { status, saveAlias } = body;

    if (!['confirmed', 'rejected'].includes(status)) {
      return NextResponse.json({ error: 'Status must be confirmed or rejected' }, { status: 400 });
    }

    const matches = await db.getMatches(userId);
    const match = matches.find((m) => m.id === matchId);
    if (!match) {
      return NextResponse.json({ error: 'Match not found' }, { status: 404 });
    }

    const beforeState = { ...match };
    const updated = await db.updateMatchStatus(userId, matchId, status);

    // If confirmed and user requested or narration has potential alias, save alias
    if (status === 'confirmed') {
      const [invoices, txns] = await Promise.all([db.getInvoices(userId), db.getBankTxns(userId)]);
      const inv = invoices.find((i) => i.id === match.invoice_id);
      const txn = txns.find((t) => t.id === match.txn_id);

      if (inv && txn) {
        // Auto-extract candidate alias from narration tokens
        const cleanNarration = normalizeBusinessName(txn.narration);
        const tokens = cleanNarration.split(' ').filter((w) => w.length >= 3 && !['UPI', 'NEFT', 'IMPS', 'RTGS', 'CR', 'DR', 'PAYMENT', 'SALES'].includes(w));
        const candidateAlias = saveAlias || tokens.slice(0, 3).join(' ');

        if (candidateAlias && candidateAlias.length >= 3) {
          await db.savePayerAlias(userId, candidateAlias, inv.customer_name);
        }
      }
    }

    // Write to immutable audit_log
    await db.addAuditLog(userId, {
      actor: 'user',
      action: status === 'confirmed' ? 'MATCH_CONFIRM' : 'MATCH_REJECT',
      entity: 'matches',
      entity_id: matchId,
      before: beforeState as any,
      after: updated as any,
    });

    return NextResponse.json({ success: true, match: updated }, { headers: res.headers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to update match' }, { status: 500 });
  }
}
