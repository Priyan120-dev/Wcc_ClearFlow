'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { IndianCurrency } from '@/components/indian-currency';
import { Tooltip } from '@/components/tooltip';
import { useToast } from '@/components/toast';
import {
  CheckCircle2,
  AlertTriangle,
  HelpCircle,
  Clock,
  Play,
  RefreshCw,
  Sparkles,
  FileSpreadsheet,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  UploadCloud,
  CheckSquare,
  Send,
  DownloadCloud,
} from 'lucide-react';

export default function DashboardPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [runningMatch, setRunningMatch] = useState(false);
  const [filter, setFilter] = useState<'all' | 'unpaid' | 'partial' | 'paid' | 'needs_review'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<string>('due_date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const [lastMatchRun, setLastMatchRun] = useState<string | null>(null);

  const PAGE_SIZE = 25;

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
      showToast({
        type: 'error',
        title: 'Connection Error',
        message: 'Could not fetch dashboard metrics.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const stored = localStorage.getItem('cf_last_match_run');
    if (stored) {
      setLastMatchRun(stored);
    }
  }, []);

  const handleRunMatching = async () => {
    if (metrics.invoicesCount === 0 || metrics.txnsCount === 0) return;
    try {
      setRunningMatch(true);
      const res = await fetch('/api/match/run', { method: 'POST' });
      if (res.ok) {
        const result = await res.json();
        const nowStr = new Date().toLocaleTimeString('en-IN', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        });
        setLastMatchRun(nowStr);
        localStorage.setItem('cf_last_match_run', nowStr);
        await fetchDashboard();
        showToast({
          type: 'success',
          title: 'Reconciliation Complete',
          message: `Processed ${result.summary?.totalMatches || 0} match candidates across ${metrics.invoicesCount} invoices.`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Matching Failed',
          message: 'Error executing deterministic matching engine.',
        });
      }
    } catch (e) {
      console.error(e);
      showToast({
        type: 'error',
        title: 'Network Error',
        message: 'Could not communicate with matching service.',
      });
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

  const hasData = metrics.invoicesCount > 0 || metrics.txnsCount > 0;

  // 5-Step Workflow Stepper calculations derived from live data
  const stepUploadDone = metrics.invoicesCount > 0 && metrics.txnsCount > 0;
  const stepMatchDone = (metrics.highConfidenceCount + metrics.reviewCount + metrics.confirmedMatchedPaise) > 0;
  const stepReviewDone = metrics.reviewCount === 0 && metrics.confirmedMatchedPaise > 0;
  const stepRemindDone = metrics.totalUnpaidPaise === 0 && metrics.invoicesCount > 0;
  const stepExportDone = metrics.confirmedMatchedPaise > 0 && metrics.reviewCount === 0;

  const steps = [
    {
      num: 1,
      name: 'Upload',
      desc: 'Invoices & Bank CSV',
      href: '/upload',
      icon: UploadCloud,
      status: stepUploadDone ? 'done' : !hasData ? 'current' : 'pending',
    },
    {
      num: 2,
      name: 'Match',
      desc: 'Deterministic Engine',
      href: '/review',
      icon: Play,
      status: stepMatchDone ? 'done' : stepUploadDone ? 'current' : 'pending',
    },
    {
      num: 3,
      name: 'Review',
      desc: `${metrics.reviewCount} pending decisions`,
      href: '/review',
      icon: CheckSquare,
      status: stepReviewDone ? 'done' : metrics.reviewCount > 0 ? 'current' : 'pending',
    },
    {
      num: 4,
      name: 'Remind',
      desc: 'WhatsApp & UPI Chase',
      href: '/reminders',
      icon: Send,
      status: stepRemindDone ? 'done' : metrics.totalUnpaidPaise > 0 && stepMatchDone ? 'current' : 'pending',
    },
    {
      num: 5,
      name: 'Export',
      desc: 'Reconciled Books',
      href: '/export',
      icon: DownloadCloud,
      status: stepExportDone ? 'done' : metrics.confirmedMatchedPaise > 0 ? 'current' : 'pending',
    },
  ];

  // Sorting and Filtering Invoices
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const filteredAndSortedInvoices = useMemo(() => {
    const list = (data?.invoices || []).filter((inv: any) => {
      if (filter !== 'all' && inv.status !== filter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const numMatch = inv.number?.toLowerCase().includes(q);
        const nameMatch = inv.customer_name?.toLowerCase().includes(q);
        return numMatch || nameMatch;
      }
      return true;
    });

    list.sort((a: any, b: any) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        const comp = valA.localeCompare(valB || '');
        return sortOrder === 'asc' ? comp : -comp;
      }

      valA = Number(valA || 0);
      valB = Number(valB || 0);
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    });

    return list;
  }, [data?.invoices, filter, searchQuery, sortField, sortOrder]);

  const totalPages = Math.ceil(filteredAndSortedInvoices.length / PAGE_SIZE) || 1;
  const paginatedInvoices = filteredAndSortedInvoices.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  return (
    <div className="space-y-6">
      {/* Top Header & Engine Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Reconciliation Dashboard</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {metrics.invoicesCount} invoices and {metrics.txnsCount} bank transactions in current session
            {lastMatchRun && (
              <span className="ml-2 inline-flex items-center text-xs text-slate-400">
                • Last matching run: <strong className="ml-1 text-slate-600 font-semibold">{lastMatchRun}</strong>
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Tooltip
            content={
              metrics.invoicesCount === 0 || metrics.txnsCount === 0
                ? 'Upload at least 1 invoice and 1 bank statement to run matching.'
                : ''
            }
          >
            <button
              onClick={handleRunMatching}
              disabled={runningMatch || loading || metrics.invoicesCount === 0 || metrics.txnsCount === 0}
              className="min-h-[40px] flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              {runningMatch ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-white" />
              )}
              <span>{lastMatchRun ? 'Re-run Matching' : 'Run Matching Engine'}</span>
            </button>
          </Tooltip>

          <Link
            href="/export"
            className="min-h-[40px] flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
          >
            <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
            <span>Export Books →</span>
          </Link>
        </div>
      </div>

      {/* 5-Step Workflow Stepper */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Reconciliation Workflow
          </h2>
          <span className="text-xs text-slate-400 font-medium">
            Step {steps.findIndex((s) => s.status === 'current') + 1 || 5} of 5
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 mt-4">
          {steps.map((step) => {
            const Icon = step.icon;
            const isDone = step.status === 'done';
            const isCurrent = step.status === 'current';

            return (
              <Link
                key={step.num}
                href={step.href}
                className={`group relative flex flex-col justify-between rounded-xl p-3.5 border transition-all ${
                  isDone
                    ? 'border-emerald-200 bg-emerald-50/60 hover:bg-emerald-50'
                    : isCurrent
                    ? 'border-blue-300 bg-blue-50/70 shadow-sm ring-1 ring-blue-400/30'
                    : 'border-slate-200 bg-slate-50/40 opacity-70 hover:opacity-100'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div
                    className={`flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold ${
                      isDone
                        ? 'bg-emerald-600 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isDone ? <CheckCircle2 className="h-4 w-4" /> : step.num}
                  </div>
                  <span
                    className={`text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      isDone
                        ? 'bg-emerald-100 text-emerald-800'
                        : isCurrent
                        ? 'bg-blue-100 text-blue-800'
                        : 'bg-slate-100 text-slate-500'
                    }`}
                  >
                    {isDone ? 'Done' : isCurrent ? 'Active' : 'Pending'}
                  </span>
                </div>

                <div className="mt-3">
                  <p className="text-xs font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                    {step.name} →
                  </p>
                  <p className="text-[11px] text-slate-500 mt-0.5 line-clamp-1">{step.desc}</p>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Skeletons while loading */}
      {loading && !data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-xl bg-slate-200" />
          ))}
        </div>
      )}

      {/* EMPTY STATE: Only shown when no data exists (Requirement 3: hide the four stat cards when there is no data) */}
      {!hasData && !loading && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-sm">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-600 mb-4 shadow-sm">
            <Sparkles className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Welcome to ClearFlow</h2>
          <p className="text-sm text-slate-600 max-w-lg mx-auto mt-1 mb-6 leading-relaxed">
            Automate invoice-to-bank matching with pure deterministic TypeScript algorithms. 
            Upload your own PDF invoices and bank CSVs, or populate the realistic Indian MSME demo dataset in one click.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={async () => {
                const res = await fetch('/api/demo/seed', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ dataset: 'A' }),
                });
                if (res.ok) {
                  showToast({
                    type: 'success',
                    title: 'Demo Data Loaded',
                    message: '60 MSME Invoices and 80 Bank Txns ready for matching.',
                  });
                  setTimeout(() => window.location.reload(), 500);
                }
              }}
              className="min-h-[40px] rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            >
              Load Demo Dataset (60 Invoices)
            </button>
            <Link
              href="/upload"
              className="min-h-[40px] rounded-xl border border-slate-300 bg-white px-5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 inline-flex items-center"
            >
              Go to Upload →
            </Link>
          </div>
        </div>
      )}

      {/* FOUR STAT CARDS: Rendered ONLY when data exists (Requirement 3) */}
      {hasData && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* 1. Matched Total */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-800 uppercase tracking-wide">
                Reconciled & Matched
              </span>
              <CheckCircle2 className="h-5 w-5 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-emerald-950 tabular-nums">
              <IndianCurrency paise={metrics.confirmedMatchedPaise + metrics.highConfidencePaise} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-emerald-700 pt-1 border-t border-emerald-200/60">
              <span>{metrics.highConfidenceCount} auto-confirmed</span>
              <Link href="/review" className="font-semibold hover:text-emerald-900 transition-colors">
                Review →
              </Link>
            </div>
          </div>

          {/* 2. Needs Review */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-800 uppercase tracking-wide">
                Needs Human Review
              </span>
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-950 tabular-nums">
              <IndianCurrency paise={metrics.reviewQueuePaise} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-amber-700 pt-1 border-t border-amber-200/60">
              <span>{metrics.reviewCount} matches in queue</span>
              <Link href="/review" className="font-semibold hover:text-amber-900 transition-colors">
                Open Queue →
              </Link>
            </div>
          </div>

          {/* 3. Unmatched Bank Credits */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                Unmatched Credits
              </span>
              <HelpCircle className="h-5 w-5 text-slate-400" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">
              <IndianCurrency paise={metrics.unmatchedCreditsPaise} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100">
              <span>{metrics.unmatchedCreditsCount} unlinked credits</span>
              <Link href="/export" className="font-semibold hover:text-slate-800 transition-colors">
                Audit →
              </Link>
            </div>
          </div>

          {/* 4. Total Outstanding Unpaid */}
          <div className="rounded-xl border border-rose-200 bg-rose-50/60 p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-800 uppercase tracking-wide">
                Outstanding Unpaid
              </span>
              <Clock className="h-5 w-5 text-rose-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-950 tabular-nums">
              <IndianCurrency paise={metrics.totalUnpaidPaise} />
            </div>
            <div className="mt-2 flex items-center justify-between text-xs text-rose-700 pt-1 border-t border-rose-200/60">
              <span>Pending customer payment</span>
              <Link href="/reminders" className="font-semibold hover:text-rose-900 transition-colors">
                Send Reminders →
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Invoice Table Section */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        {/* Table Controls Header: Search & Filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between px-6 py-4 border-b border-slate-200 gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900">Invoices & Settlement Tracking</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Derived dynamically: Settled = Sum(Allocated + Adjustments)
            </p>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            {/* Search Input */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search invoice or customer..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full sm:w-64 rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl text-xs overflow-x-auto">
              {(['all', 'unpaid', 'partial', 'paid', 'needs_review'] as const).map((tab) => (
                <button
                  key={tab}
                  onClick={() => {
                    setFilter(tab);
                    setCurrentPage(1);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold capitalize whitespace-nowrap transition-all ${
                    filter === tab
                      ? 'bg-white text-slate-900 shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Scrollable Table with Sticky Header */}
        <div className="overflow-x-auto max-h-[600px] relative">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="sticky top-0 bg-slate-50/95 backdrop-blur z-10 border-b border-slate-200 text-xs font-bold text-slate-600 uppercase tracking-wider">
              <tr>
                <th
                  onClick={() => handleSort('number')}
                  className="px-6 py-3.5 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Invoice No.</span>
                    {sortField === 'number' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('customer_name')}
                  className="px-6 py-3.5 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Customer</span>
                    {sortField === 'customer_name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('issue_date')}
                  className="px-6 py-3.5 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Issue Date</span>
                    {sortField === 'issue_date' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('due_date')}
                  className="px-6 py-3.5 cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Due Date</span>
                    {sortField === 'due_date' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('amount_paise')}
                  className="px-6 py-3.5 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Total Amount</span>
                    {sortField === 'amount_paise' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('settled_paise')}
                  className="px-6 py-3.5 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Settled</span>
                    {sortField === 'settled_paise' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort('outstanding_paise')}
                  className="px-6 py-3.5 text-right cursor-pointer hover:text-slate-900 select-none"
                >
                  <div className="flex items-center justify-end gap-1.5">
                    <span>Outstanding</span>
                    {sortField === 'outstanding_paise' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3.5 w-3.5 text-emerald-600" /> : <ArrowDown className="h-3.5 w-3.5 text-emerald-600" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400 opacity-60" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {paginatedInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-slate-400">
                    <p className="font-semibold text-slate-700">No invoices match your filters</p>
                    <p className="text-xs text-slate-400 mt-1">
                      {searchQuery ? `No results for "${searchQuery}"` : 'Try changing or resetting your active filter.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedInvoices.map((inv: any) => {
                  let badge = (
                    <span className="inline-flex items-center rounded-full bg-rose-50 px-2.5 py-0.5 text-xs font-semibold text-rose-700 border border-rose-200">
                      Unpaid
                    </span>
                  );
                  if (inv.status === 'paid') {
                    badge = (
                      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 border border-emerald-200">
                        Paid
                      </span>
                    );
                  } else if (inv.status === 'partial') {
                    badge = (
                      <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-semibold text-amber-700 border border-amber-200">
                        Partial
                      </span>
                    );
                  } else if (inv.status === 'needs_review') {
                    badge = (
                      <span className="inline-flex items-center rounded-full bg-purple-50 px-2.5 py-0.5 text-xs font-semibold text-purple-700 border border-purple-200">
                        Needs Review
                      </span>
                    );
                  }

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      <td className="px-6 py-3.5 font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                        {inv.number}
                      </td>
                      <td className="px-6 py-3.5 text-slate-800 font-medium">{inv.customer_name}</td>
                      <td className="px-6 py-3.5 text-slate-500 tabular-nums text-xs">{inv.issue_date}</td>
                      <td className="px-6 py-3.5 text-slate-500 tabular-nums text-xs">{inv.due_date}</td>
                      <td className="px-6 py-3.5 text-right font-semibold text-slate-900 tabular-nums">
                        <IndianCurrency paise={inv.amount_paise} />
                      </td>
                      <td className="px-6 py-3.5 text-right text-emerald-700 font-semibold tabular-nums">
                        <IndianCurrency paise={inv.settled_paise} />
                      </td>
                      <td className="px-6 py-3.5 text-right text-rose-700 font-semibold tabular-nums">
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

        {/* Pagination Bar */}
        {filteredAndSortedInvoices.length > 0 && (
          <div className="flex flex-col sm:flex-row items-center justify-between px-6 py-3.5 border-t border-slate-200 bg-slate-50/50 gap-3 text-xs text-slate-500">
            <div>
              Showing <strong className="text-slate-800 font-semibold">{(currentPage - 1) * PAGE_SIZE + 1}</strong> to{' '}
              <strong className="text-slate-800 font-semibold">
                {Math.min(currentPage * PAGE_SIZE, filteredAndSortedInvoices.length)}
              </strong>{' '}
              of <strong className="text-slate-800 font-semibold">{filteredAndSortedInvoices.length}</strong> invoices
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Previous
              </button>

              <span className="px-2 font-medium text-slate-700">
                Page {currentPage} of {totalPages}
              </span>

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
