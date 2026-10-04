import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';
import { runMatchingEngine } from '@/lib/matching/engine';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const res = new NextResponse();
    const userId = getOrCreateSessionId(req, res);

    const [invoices, txns, existingMatches, aliases] = await Promise.all([
      db.getInvoices(userId),
      db.getBankTxns(userId),
      db.getMatches(userId),
      db.getPayerAliases(userId),
    ]);

    const result = runMatchingEngine({
      invoices,
      txns,
      existingMatches,
      payerAliases: aliases,
    });

    // Save updated matches (confirmed & rejected preserved, suggested recomputed)
    await db.saveMatches(userId, result.matches);

    // Audit log
    await db.addAuditLog(userId, {
      actor: 'system',
      action: 'MATCH_ENGINE_RUN',
      entity: 'matching_engine',
      entity_id: `run-${Date.now()}`,
      after: {
        totalMatches: result.matches.length,
        newSuggested: result.newSuggestedMatches.length,
        highConfidence: result.highConfidenceCount,
        reviewCount: result.reviewCount,
        processingTimeMs: result.processingTimeMs,
      },
    });

    return NextResponse.json(
      {
        success: true,
        ...result,
      },
      { headers: res.headers }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Matching engine failed' }, { status: 500 });
  }
}
