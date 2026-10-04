'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { IndianCurrency } from '@/components/indian-currency';
import { PrivacyBanner } from '@/components/privacy-banner';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock,
  ArrowRight,
  Play,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
} from 'lucide-react';

export default function DashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid' | 'needs_review'>('all');

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
  }, []);

  const handleRunMatching = async () => {
    try {
      setRunningMatch(true);
      const res = await fetch('/api/match/run', { method: 'POST' });
      if (res.ok) {
        await fetchDashboard();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setRunningMatch(false);
    }
  };

  const metrics = data?.metrics || {
    confirmedMatchedPaise: 0,
    highConfidencePaise: 0,
    reviewQueuePaise: 0,
    unmatchedCreditsPaise: 0,
    totalUnpaidPaise: 0,
    invoicesCount: 0,
    txnsCount: 0,
    highConfidenceCount: 0,
    reviewCount: 0,
    unmatchedCreditsCount: 0,
  };

  const invoices = (data?.invoices || []).filter((inv: any) => {
    if (filter === 'all') return true;
    return inv.status === filter;
  });

  return (
    <div className="space-y-6">
      {/* Privacy Banner */}
      <PrivacyBanner />

      {/* Header and Engine Trigger */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reconciliation Dashboard</h1>
          <p className="text-sm text-slate-500">
            {metrics.invoicesCount} invoices and {metrics.txnsCount} bank transactions in current session
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleRunMatching}
            disabled={runningMatch || loading || metrics.invoicesCount === 0}
            className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-all"
          >
            {runningMatch ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-white" />
            )}
            Run Matching Engine
          </button>
          <Link
            href="/export"
            className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            Export Books
          </Link>
        </div>
      </div>

      {/* Empty State Prompt */}
      {metrics.invoicesCount === 0 && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Invoices or Bank Records Loaded</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mt-1 mb-4">
            Upload your invoices and bank CSV, or load the pre-configured Indian MSME demo dataset to test reconciliation right away.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={async () => {
                const res = await fetch('/api/demo/seed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dataset: 'A' }),
                });
                if (res.ok) window.location.reload();
              }}
              className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700"
            >
              Load Demo Dataset (60 Invoices)
            </button>
            <Link
              href="/upload"
              className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Go to Upload
            </Link>
          </div>
        </div>
      )}

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 1. Matched Total */}
        <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
              Reconciled & Matched
            </span>
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-emerald-950">
            <IndianCurrency paise={metrics.confirmedMatchedPaise + metrics.highConfidencePaise} />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-emerald-700">
            <span>{metrics.highConfidenceCount} high-confidence auto-matches</span>
            <Link href="/review" className="underline font-medium hover:text-emerald-900">
              Review
            </Link>
          </div>
        </div>

        {/* 2. Needs Review */}
        <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-800 uppercase tracking-wide">
              Needs Human Review
            </span>
            <AlertTriangle className="h-5 w-5 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-950">
            <IndianCurrency paise={metrics.reviewQueuePaise} />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-amber-700">
            <span>{metrics.reviewCount} matches in review queue</span>
            <Link href="/review" className="underline font-medium hover:text-amber-900">
              Open Queue &rarr;
            </Link>
          </div>
        </div>

        {/* 3. Unmatched Bank Credits */}
        <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Unmatched Bank Credits
            </span>
            <HelpCircle className="h-5 w-5 text-slate-400" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-800">
            <IndianCurrency paise={metrics.unmatchedCreditsPaise} />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-slate-500">
            <span>{metrics.unmatchedCreditsCount} unlinked credits</span>
            <Link href="/export" className="underline hover:text-slate-800">
              Audit
            </Link>
          </div>
        </div>

        {/* 4. Total Outstanding Unpaid */}
        <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-800 uppercase tracking-wide">
              Outstanding Unpaid
            </span>
            <Clock className="h-5 w-5 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-950">
            <IndianCurrency paise={metrics.totalUnpaidPaise} />
          </div>
          <div className="mt-1 flex items-center justify-between text-xs text-rose-700">
            <span>Pending customer payment</span>
            <Link href="/reminders" className="underline font-medium hover:text-rose-900">
              Send Reminders &rarr;
            </Link>
          </div>
        </div>
      </div>

      {/* Invoice List & Status Breakdown */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-4 border-b border-slate-200 gap-3">
          <div>
            <h2 className="text-base font-semibold text-slate-900">Invoices & Settlement Tracking</h2>
            <p className="text-xs text-slate-500">
              Payment statuses are derived strictly from confirmed allocation paise
            </p>
          </div>

          {/* Filter Pills */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg text-xs">
            {(['all', 'unpaid', 'partial', 'paid', 'needs_review'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`rounded-md px-2.5 py-1 font-medium capitalize transition-all ${
                  filter === tab
                    ? 'bg-white text-slate-900 shadow-sm font-semibold'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {tab.replace('_', ' ')}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold text-slate-500 uppercase tracking-wider border-b border-slate-200">
              <tr>
                <th className="px-6 py-3">Invoice No.</th>
                <th className="px-6 py-3">Customer</th>
                <th className="px-6 py-3">Issue Date</th>
                <th className="px-6 py-3">Due Date</th>
                <th className="px-6 py-3 text-right">Total Amount</th>
                <th className="px-6 py-3 text-right">Settled</th>
                <th className="px-6 py-3 text-right">Outstanding</th>
                <th className="px-6 py-3 text-center">Derived Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-8 text-center text-slate-400">
                    No invoices match the selected filter.
                  </td>
                </tr>
              ) : (
                invoices.map((inv: any) => {
                  let badge = (
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                      Unpaid
                    </span>
                  );
                  if (inv.status === 'paid') {
                    badge = (
                      <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800">
                        Paid
                      </span>
                    );
                  } else if (inv.status === 'partial') {
                    badge = (
                      <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-800">
                        Partial
                      </span>
                    );
                  } else if (inv.status === 'needs_review') {
                    badge = (
                      <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800">
                        Needs Review
                      </span>
                    );
                  }

                  return (
                    <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-6 py-3.5 font-medium text-slate-900">{inv.number}</td>
                      <td className="px-6 py-3.5 text-slate-700">{inv.customer_name}</td>
                      <td className="px-6 py-3.5 text-slate-500 font-mono text-xs">{inv.issue_date}</td>
                      <td className="px-6 py-3.5 text-slate-500 font-mono text-xs">{inv.due_date}</td>
                      <td className="px-6 py-3.5 text-right font-medium text-slate-900">
                        <IndianCurrency paise={inv.amount_paise} />
                      </td>
                      <td className="px-6 py-3.5 text-right text-emerald-600 font-medium">
                        <IndianCurrency paise={inv.settled_paise} />
                      </td>
                      <td className="px-6 py-3.5 text-right text-rose-600 font-medium">
                        <IndianCurrency paise={inv.outstanding_paise} />
                      </td>
                      <td className="px-6 py-3.5 text-center">{badge}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
