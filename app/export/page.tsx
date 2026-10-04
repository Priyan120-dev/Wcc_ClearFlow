'use client';

import React, { useEffect, useState } from 'react';
import { PrivacyBanner } from '@/components/privacy-banner';
import { useToast } from '@/components/toast';
import {
  DownloadCloud,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';

export default function ExportPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/dashboard')
      .then((res) => res.json())
      .then((json) => setData(json))
      .catch(() => {
        showToast({
          type: 'error',
          title: 'Connection error',
          message: 'Could not load ledger counts.',
        });
      })
      .finally(() => setLoading(false));
  }, [showToast]);

  const metrics = data?.metrics || {};

  const handleDownload = () => {
    showToast({
      type: 'success',
      title: 'Workbook generation started',
      message: 'Streaming 4-sheet reconciled books XLSX file...',
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-gray-900">Export Books</h1>
          <p className="text-[14px] text-gray-500 mt-1">
            Download reconciliation ledger workbook with 4 structured audit sheets.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PrivacyBanner variant="compact" />

          <a
            href="/api/export"
            download="ClearFlow_Reconciled_Books.xlsx"
            onClick={handleDownload}
            className="min-h-[40px] flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <DownloadCloud className="h-4 w-4 stroke-[1.5]" />
            Download XLSX workbook
          </a>
        </div>
      </div>

      {/* Skeletons while loading */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-44 rounded-lg bg-gray-100 border border-gray-200" />
          ))}
        </div>
      )}

      {/* Sheet Summaries Grid */}
      {!loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Sheet 1: Matched */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[16px] font-semibold text-gray-900">
                <CheckCircle2 className="h-4 w-4 stroke-[1.5] text-emerald-600" />
                Sheet 1: Matched Reconciliations
              </span>
              <span className="rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[12px] font-medium text-emerald-800 tabular-nums">
                {(metrics.confirmedMatchedPaise ? 1 : 0) + (metrics.highConfidenceCount || 0)} records
              </span>
            </div>
            <p className="text-[14px] text-gray-500 leading-relaxed">
              All confirmed and high-confidence payments mapped to invoice numbers, UTR references, allocation amounts, and TDS adjustments.
            </p>
            <div className="rounded-lg bg-gray-50 p-3 text-[12px] text-gray-700 border border-gray-200 tabular-nums">
              <strong>Columns:</strong> Invoice No, Customer, Total (₹), Bank Date, Allocated, Adjustment, Method, UTR, Narration
            </div>
          </div>

          {/* Sheet 2: Unmatched Bank Txns */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[16px] font-semibold text-gray-900">
                <Layers className="h-4 w-4 stroke-[1.5] text-gray-500" />
                Sheet 2: Unmatched Bank Transactions
              </span>
              <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[12px] font-medium text-gray-700 tabular-nums">
                {metrics.unmatchedCreditsCount || 0} records
              </span>
            </div>
            <p className="text-[14px] text-gray-500 leading-relaxed">
              Unassigned bank statement deposits (e.g. interest credits, refunds, direct transfers) for suspense account review.
            </p>
            <div className="rounded-lg bg-gray-50 p-3 text-[12px] text-gray-700 border border-gray-200 tabular-nums">
              <strong>Columns:</strong> Transaction Date, Amount (₹), Direction, Narration, UTR Ref, Dedupe Hash
            </div>
          </div>

          {/* Sheet 3: Unpaid Invoices */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[16px] font-semibold text-gray-900">
                <Clock className="h-4 w-4 stroke-[1.5] text-red-600" />
                Sheet 3: Unpaid & Partial Invoices
              </span>
              <span className="rounded-full bg-red-50 border border-red-200 px-2.5 py-0.5 text-[12px] font-medium text-red-800 tabular-nums">
                {data?.invoices?.filter((i: any) => i.status !== 'paid').length || 0} records
              </span>
            </div>
            <p className="text-[14px] text-gray-500 leading-relaxed">
              Invoices pending customer clearance, displaying settled amount and outstanding balance calculated from confirmed allocations.
            </p>
            <div className="rounded-lg bg-gray-50 p-3 text-[12px] text-gray-700 border border-gray-200 tabular-nums">
              <strong>Columns:</strong> Invoice No, Customer Name, Phone, Issue Date, Due Date, Total, Settled, Outstanding
            </div>
          </div>

          {/* Sheet 4: GST Summary */}
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-3">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-[16px] font-semibold text-gray-900">
                <FileSpreadsheet className="h-4 w-4 stroke-[1.5] text-gray-500" />
                Sheet 4: GST Summary
              </span>
              <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[12px] font-medium text-gray-700 tabular-nums">
                {metrics.invoicesCount || 0} records
              </span>
            </div>
            <p className="text-[14px] text-gray-500 leading-relaxed">
              Taxable base and total GST breakdown ready for monthly GSTR-1 preparation and sales register filing.
            </p>
            <div className="rounded-lg bg-gray-50 p-3 text-[12px] text-gray-700 border border-gray-200 tabular-nums">
              <strong>Columns:</strong> Invoice No, Customer Name, Issue Date, Taxable Base (₹), GST Total (₹), Total Amount (₹)
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
