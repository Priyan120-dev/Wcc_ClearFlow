import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';
import { runMatchingEngine } from '@/lib/matching/engine';
import datasetA from '@/lib/seed/dataset-a.json';
import datasetB from '@/lib/seed/dataset-b.json';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const res = NextResponse.next();
    const userId = getOrCreateSessionId(req, res);

    const body = await req.json().catch(() => ({}));
    const datasetChoice = body?.dataset === 'B' ? 'B' : 'A';
    const sourceData = datasetChoice === 'B' ? datasetB : datasetA;

    // Reset caller's data before seeding new dataset
    await db.purgeUserData(userId);

    // Save invoices, bank transactions, and initial aliases
    await db.saveInvoices(userId, sourceData.invoices as any);
    await db.saveBankTxns(userId, sourceData.txns as any);
    for (const a of sourceData.aliases) {
      await db.savePayerAlias(userId, a.raw_alias, a.customer_name);
    }

    // Run matching engine to produce initial suggested matches
    const aliases = await db.getPayerAliases(userId);
    const matchResult = runMatchingEngine({
      invoices: sourceData.invoices as any,
      txns: sourceData.txns as any,
      existingMatches: [],
      payerAliases: aliases,
    });

    await db.saveMatches(userId, matchResult.matches);

    // Audit log entry
    await db.addAuditLog(userId, {
      actor: 'user',
      action: 'DEMO_SEED_LOADED',
      entity: 'system',
      entity_id: `seed-${datasetChoice}`,
      after: {
        dataset: datasetChoice,
        invoices: sourceData.invoices.length,
        txns: sourceData.txns.length,
        suggested: matchResult.newSuggestedMatches.length,
      },
    });

    return NextResponse.json(
      {
        success: true,
        message: `Dataset ${datasetChoice} loaded successfully`,
        invoicesCount: sourceData.invoices.length,
        txnsCount: sourceData.txns.length,
        suggestedMatchesCount: matchResult.newSuggestedMatches.length,
        highConfidenceCount: matchResult.highConfidenceCount,
        reviewCount: matchResult.reviewCount,
      },
      { headers: res.headers }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to seed demo data' }, { status: 500 });
  }
}
