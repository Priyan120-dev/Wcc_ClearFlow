'use client';

import React, { useEffect, useState } from 'react';
import { IndianCurrency } from '@/components/indian-currency';
import { PrivacyBanner } from '@/components/privacy-banner';
import {
  DownloadCloud,
  FileSpreadsheet,
  CheckCircle2,
  FileText,
  Clock,
  Layers,
  ArrowRight,
} from 'lucide-react';

export default function ExportPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((json) => setData(json))
      .finally(() => setLoading(false));
  }, []);

  const metrics = data?.metrics || {};

  return (
    <div className="space-y-6">
      <PrivacyBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Export Reconciled Books</h1>
          <p className="text-sm text-slate-500">
            Download accountant-ready Microsoft Excel (.xlsx) workbook with 4 structured sheets.
          </p>
        </div>

        <a
          href="/api/export"
          download="ClearFlow_Reconciled_Books.xlsx"
          className="flex items-center gap-2 rounded-lg bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow hover:bg-emerald-700 transition-all"
        >
          <DownloadCloud className="h-4 w-4" />
          Download XLSX Workbook
        </a>
      </div>

      {/* Sheet Summaries Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Sheet 1: Matched */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              Sheet 1: Matched Reconciliations
            </span>
            <span className="rounded bg-emerald-100 px-2 py-0.5 text-xs font-semibold text-emerald-800">
              {(metrics.confirmedMatchedPaise ? 1 : 0) + (metrics.highConfidenceCount || 0)} records
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Contains all confirmed and high-confidence payments mapped to invoice numbers, UTR references, allocation paise, and TDS adjustments.
          </p>
          <div className="rounded bg-slate-50 p-2.5 text-xs font-mono text-slate-700">
            Columns: Invoice No, Customer, Total (₹), Bank Date, Allocated, Adjustment, Method, UTR, Narration
          </div>
        </div>

        {/* Sheet 2: Unmatched Bank Txns */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Layers className="h-5 w-5 text-slate-500" />
              Sheet 2: Unmatched Bank Transactions
            </span>
            <span className="rounded bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700">
              {metrics.unmatchedCreditsCount || 0} records
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Unassigned bank statement deposits (e.g. interest credits, tax refunds, direct transfers) for accountant review.
          </p>
          <div className="rounded bg-slate-50 p-2.5 text-xs font-mono text-slate-700">
            Columns: Transaction Date, Amount (₹), Direction, Narration, UTR Ref, Dedupe Hash
          </div>
        </div>

        {/* Sheet 3: Unpaid Invoices */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <Clock className="h-5 w-5 text-rose-500" />
              Sheet 3: Unpaid & Partial Invoices
            </span>
            <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-semibold text-rose-800">
              {data?.invoices?.filter((i: any) => i.status !== 'paid').length || 0} records
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Invoices pending customer clearance, displaying settled amount and outstanding balance calculated from confirmed allocations.
          </p>
          <div className="rounded bg-slate-50 p-2.5 text-xs font-mono text-slate-700">
            Columns: Invoice No, Customer Name, Phone, Issue Date, Due Date, Total, Settled, Outstanding
          </div>
        </div>

        {/* Sheet 4: GST Summary */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm font-bold text-slate-900">
              <FileSpreadsheet className="h-5 w-5 text-indigo-600" />
              Sheet 4: GST Summary
            </span>
            <span className="rounded bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800">
              {metrics.invoicesCount || 0} records
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Taxable base and total GST breakdown ready for monthly GSTR-1 preparation and sales register filing.
          </p>
          <div className="rounded bg-slate-50 p-2.5 text-xs font-mono text-slate-700">
            Columns: Invoice No, Customer Name, Issue Date, Taxable Base (₹), GST Total (₹), Total Amount (₹)
          </div>
        </div>
      </div>
    </div>
  );
}
