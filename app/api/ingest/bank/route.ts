import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';
import Papa from 'papaparse';
import crypto from 'crypto';
import { BankTxn } from '@/lib/types';
import { parseAmountToPaise } from '@/lib/currency';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Extracts UTR number from bank narration via regex
 */
function extractUtrFromNarration(narration: string): string | null {
  if (!narration) return null;
  // Match 12-digit standard UTR/RRN numbers (e.g. 428910482910)
  const digit12Match = narration.match(/\b(\d{12})\b/);
  if (digit12Match) return digit12Match[1];

  // Match standard UPI transaction refs (e.g. UPI/428910482910 or UPI1234567890)
  const upiMatch = narration.match(/UPI[/:]([A-Z0-9]{8,18})/i);
  if (upiMatch) return upiMatch[1];

  // Match IMPS/NEFT reference patterns
  const neftMatch = narration.match(/NEFT[-/]([A-Z0-9]{10,16})/i);
  if (neftMatch) return neftMatch[1];

  return null;
}

export async function POST(req: NextRequest) {
  try {
    const res = new NextResponse();
    const userId = getOrCreateSessionId(req, res);

    const body = await req.json().catch(() => ({}));
    const { csvText, columnMapping, filename = 'bank_statement.csv' } = body;

    if (!csvText || typeof csvText !== 'string') {
      return NextResponse.json({ error: 'csvText string is required' }, { status: 400 });
    }

    const parsed = Papa.parse(csvText, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h) => h.trim(),
    });

    if (parsed.errors.length > 0 && parsed.data.length === 0) {
      return NextResponse.json({ error: 'Failed to parse CSV file' }, { status: 400 });
    }

    const rows = parsed.data as Record<string, string>[];
    if (rows.length === 0) {
      return NextResponse.json({ error: 'CSV file contains no data rows' }, { status: 400 });
    }

    // Header Auto-Detection (HDFC, ICICI, or Custom Fallback)
    const headers = Object.keys(rows[0]).map((h) => h.toLowerCase());

    const findHeader = (patterns: string[]): string | undefined => {
      for (const p of patterns) {
        const found = Object.keys(rows[0]).find((h) => h.toLowerCase().includes(p.toLowerCase()));
        if (found) return found;
      }
      return undefined;
    };

    const dateKey = columnMapping?.dateCol || findHeader(['date', 'txn date', 'transaction date', 'value dt']);
    const narrationKey =
      columnMapping?.narrationCol ||
      findHeader(['narration', 'description', 'particulars', 'remarks', 'transaction details']);
    const creditKey =
      columnMapping?.creditCol || findHeader(['deposit', 'deposit amt', 'credit', 'cr amt', 'credit amount']);
    const debitKey =
      columnMapping?.debitCol || findHeader(['withdrawal', 'withdrawal amt', 'debit', 'dr amt', 'debit amount']);
    const amountKey = columnMapping?.amountCol || findHeader(['amount', 'txn amount', 'transaction amount']);
    const refKey = columnMapping?.utrCol || findHeader(['chq/ref no', 'ref no', 'reference', 'cheque number', 'rrn']);

    if (!dateKey || !narrationKey) {
      return NextResponse.json(
        {
          error: 'Could not auto-detect Date and Narration columns. Please provide manual column mapping.',
          detectedHeaders: Object.keys(rows[0]),
        },
        { status: 422 }
      );
    }

    // Fetch existing txns to check dedupe hashes
    const existingTxns = await db.getBankTxns(userId);
    const existingHashSet = new Set(existingTxns.map((t) => t.dedupe_hash));

    const occurrenceCounts = new Map<string, number>();
    const newTxns: BankTxn[] = [];
    let duplicateCount = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rawDate = row[dateKey]?.trim();
      const rawNarration = row[narrationKey]?.trim();

      if (!rawDate || !rawNarration) continue;

      // Normalize date to YYYY-MM-DD
      let normalizedDate = rawDate;
      const dmyMatch = rawDate.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})$/);
      if (dmyMatch) {
        const d = dmyMatch[1].padStart(2, '0');
        const m = dmyMatch[2].padStart(2, '0');
        const y = dmyMatch[3].length === 2 ? `20${dmyMatch[3]}` : dmyMatch[3];
        normalizedDate = `${y}-${m}-${d}`;
      }

      // Determine amount and direction
      let amountPaise = 0;
      let direction: 'credit' | 'debit' = 'credit';

      if (creditKey && row[creditKey] && parseAmountToPaise(row[creditKey]) > 0) {
        amountPaise = parseAmountToPaise(row[creditKey]);
        direction = 'credit';
      } else if (debitKey && row[debitKey] && parseAmountToPaise(row[debitKey]) > 0) {
        amountPaise = parseAmountToPaise(row[debitKey]);
        direction = 'debit';
      } else if (amountKey && row[amountKey]) {
        amountPaise = parseAmountToPaise(row[amountKey]);
        const typeCol = findHeader(['cr/dr', 'type', 'indicator']);
        if (typeCol && row[typeCol]?.toLowerCase().includes('dr')) {
          direction = 'debit';
        }
      }

      if (amountPaise <= 0) continue;

      // Extract UTR
      const explicitRef = refKey ? row[refKey]?.trim() : null;
      const extractedUtr = explicitRef || extractUtrFromNarration(rawNarration);

      // Compute occurrence index for exact same date + amount + narration
      const occKey = `${normalizedDate}|${amountPaise}|${rawNarration.toUpperCase()}`;
      const occIndex = (occurrenceCounts.get(occKey) || 0) + 1;
      occurrenceCounts.set(occKey, occIndex);

      // Unique dedupe hash
      const dedupeHash = crypto
        .createHash('sha256')
        .update(`${normalizedDate}|${amountPaise}|${rawNarration.toUpperCase()}|${occIndex}`)
        .digest('hex');

      if (existingHashSet.has(dedupeHash)) {
        duplicateCount++;
        continue;
      }

      existingHashSet.add(dedupeHash);

      newTxns.push({
        id: `txn-${Date.now()}-${i}-${Math.random().toString(36).substring(2, 6)}`,
        user_id: userId,
        date: normalizedDate,
        amount_paise: amountPaise,
        direction,
        narration: rawNarration,
        utr_ref: extractedUtr,
        dedupe_hash: dedupeHash,
        source_file: filename,
        created_at: new Date().toISOString(),
      });
    }

    if (newTxns.length > 0) {
      await db.saveBankTxns(userId, newTxns);

      await db.addAuditLog(userId, {
        actor: 'user',
        action: 'BANK_CSV_INGESTED',
        entity: 'bank_txns',
        entity_id: `batch-${Date.now()}`,
        after: {
          imported: newTxns.length,
          duplicatesSkipped: duplicateCount,
          sourceFile: filename,
        },
      });
    }

    return NextResponse.json(
      {
        success: true,
        importedCount: newTxns.length,
        duplicateCount,
        totalRows: rows.length,
      },
      { headers: res.headers }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to ingest bank CSV' }, { status: 500 });
  }
}
