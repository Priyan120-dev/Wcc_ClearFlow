import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';
import ExcelJS from 'exceljs';
import { paiseToRupees } from '@/lib/currency';
import { deriveInvoiceStatus, calculateSettledPaise, calculateOutstandingPaise } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  try {
    const res = new NextResponse();
    const userId = getOrCreateSessionId(req, res);

    const [invoices, txns, matches] = await Promise.all([
      db.getInvoices(userId),
      db.getBankTxns(userId),
      db.getMatches(userId),
    ]);

    const invoicesMap = new Map(invoices.map((i) => [i.id, i]));
    const txnsMap = new Map(txns.map((t) => [t.id, t]));

    // Confirmed matches per invoice
    const confirmedMatchesByInv = new Map<string, typeof matches>();
    for (const m of matches) {
      if (m.status === 'confirmed') {
        if (!confirmedMatchesByInv.has(m.invoice_id)) confirmedMatchesByInv.set(m.invoice_id, []);
        confirmedMatchesByInv.get(m.invoice_id)!.push(m);
      }
    }

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'WCC ClearFlow';
    workbook.created = new Date();

    // -------------------------------------------------------------
    // SHEET 1: Matched (Confirmed and suggested high-confidence)
    // -------------------------------------------------------------
    const matchedSheet = workbook.addWorksheet('Matched');
    matchedSheet.columns = [
      { header: 'Invoice No', key: 'invoice_no', width: 18 },
      { header: 'Customer Name', key: 'customer', width: 28 },
      { header: 'Total Invoice (₹)', key: 'inv_total', width: 16 },
      { header: 'Bank Date', key: 'bank_date', width: 14 },
      { header: 'Allocated (₹)', key: 'allocated', width: 16 },
      { header: 'Adjustment (₹)', key: 'adjustment', width: 16 },
      { header: 'Adjustment Kind', key: 'adj_kind', width: 16 },
      { header: 'Score', key: 'score', width: 10 },
      { header: 'Method', key: 'method', width: 18 },
      { header: 'Status', key: 'status', width: 14 },
      { header: 'UTR Reference', key: 'utr', width: 20 },
      { header: 'Narration', key: 'narration', width: 40 },
    ];

    const activeMatches = matches.filter((m) => m.status === 'confirmed' || (m.status === 'suggested' && m.score >= 0.90));
    for (const m of activeMatches) {
      const inv = invoicesMap.get(m.invoice_id);
      const txn = txnsMap.get(m.txn_id);
      if (!inv || !txn) continue;

      matchedSheet.addRow({
        invoice_no: inv.number,
        customer: inv.customer_name,
        inv_total: paiseToRupees(inv.amount_paise),
        bank_date: txn.date,
        allocated: paiseToRupees(m.allocated_paise),
        adjustment: paiseToRupees(m.adjustment_paise || 0),
        adj_kind: m.adjustment_kind || 'none',
        score: `${Math.round(m.score * 100)}%`,
        method: m.method,
        status: m.status,
        utr: txn.utr_ref || '-',
        narration: txn.narration,
      });
    }

    // -------------------------------------------------------------
    // SHEET 2: Unmatched Bank Transactions
    // -------------------------------------------------------------
    const unmatchedSheet = workbook.addWorksheet('Unmatched Bank Txns');
    unmatchedSheet.columns = [
      { header: 'Transaction Date', key: 'date', width: 16 },
      { header: 'Amount (₹)', key: 'amount', width: 16 },
      { header: 'Direction', key: 'direction', width: 12 },
      { header: 'Narration', key: 'narration', width: 45 },
      { header: 'UTR Ref', key: 'utr', width: 20 },
      { header: 'Dedupe Hash', key: 'hash', width: 28 },
    ];

    const matchedTxnIds = new Set(matches.filter((m) => m.status !== 'rejected').map((m) => m.txn_id));
    const unmatchedTxns = txns.filter((t) => !matchedTxnIds.has(t.id));

    for (const t of unmatchedTxns) {
      unmatchedSheet.addRow({
        date: t.date,
        amount: paiseToRupees(t.amount_paise),
        direction: t.direction,
        narration: t.narration,
        utr: t.utr_ref || '-',
        hash: t.dedupe_hash,
      });
    }

    // -------------------------------------------------------------
    // SHEET 3: Unpaid Invoices
    // -------------------------------------------------------------
    const unpaidSheet = workbook.addWorksheet('Unpaid Invoices');
    unpaidSheet.columns = [
      { header: 'Invoice No', key: 'invoice_no', width: 18 },
      { header: 'Customer Name', key: 'customer', width: 28 },
      { header: 'Phone', key: 'phone', width: 16 },
      { header: 'Issue Date', key: 'issue_date', width: 14 },
      { header: 'Due Date', key: 'due_date', width: 14 },
      { header: 'Total (₹)', key: 'total', width: 16 },
      { header: 'Settled (₹)', key: 'settled', width: 16 },
      { header: 'Outstanding (₹)', key: 'outstanding', width: 16 },
      { header: 'Status', key: 'status', width: 14 },
    ];

    for (const inv of invoices) {
      const invMatches = confirmedMatchesByInv.get(inv.id) || [];
      const status = deriveInvoiceStatus(inv, invMatches);
      if (status === 'paid') continue;

      const settled = calculateSettledPaise(invMatches);
      const outstanding = calculateOutstandingPaise(inv, invMatches);

      unpaidSheet.addRow({
        invoice_no: inv.number,
        customer: inv.customer_name,
        phone: inv.customer_phone || '-',
        issue_date: inv.issue_date,
        due_date: inv.due_date,
        total: paiseToRupees(inv.amount_paise),
        settled: paiseToRupees(settled),
        outstanding: paiseToRupees(outstanding),
        status,
      });
    }

    // -------------------------------------------------------------
    // SHEET 4: GST Summary
    // -------------------------------------------------------------
    const gstSheet = workbook.addWorksheet('GST Summary');
    gstSheet.columns = [
      { header: 'Invoice No', key: 'invoice_no', width: 18 },
      { header: 'Customer Name', key: 'customer', width: 28 },
      { header: 'Issue Date', key: 'issue_date', width: 14 },
      { header: 'Taxable Base (₹)', key: 'taxable', width: 18 },
      { header: 'GST Total (₹)', key: 'gst', width: 16 },
      { header: 'Total Amount (₹)', key: 'total', width: 18 },
    ];

    for (const inv of invoices) {
      const taxable = Math.max(0, inv.amount_paise - inv.gst_paise);
      gstSheet.addRow({
        invoice_no: inv.number,
        customer: inv.customer_name,
        issue_date: inv.issue_date,
        taxable: paiseToRupees(taxable),
        gst: paiseToRupees(inv.gst_paise),
        total: paiseToRupees(inv.amount_paise),
      });
    }

    // Generate buffer
    const buffer = await workbook.xlsx.writeBuffer();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="ClearFlow_Reconciled_Books.xlsx"',
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Export failed' }, { status: 500 });
  }
}
