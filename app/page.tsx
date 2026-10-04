'use client';

import React, { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { IndianCurrency } from '@/components/indian-currency';
import { Tooltip } from '@/components/tooltip';
import { PrivacyBanner } from '@/components/privacy-banner';
import { useToast } from '@/components/toast';
import {
  Play,
  RefreshCw,
  Download,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
  Check,
  AlertCircle,
} from 'lucide-react';

export default function DashboardPage() {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
      setError(null);
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setData(json);
      } else {
        throw new Error('Failed to load dashboard data');
      }
    } catch (e: any) {
      setError(e.message || 'Network error fetching data');
      showToast({
        type: 'error',
        title: 'Connection error',
        message: 'Could not fetch dashboard metrics. Please retry.',
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
          title: 'Matching complete',
          message: `Generated ${result.summary?.totalMatches || 0} match candidates across ${metrics.invoicesCount} invoices.`,
        });
      } else {
        showToast({
          type: 'error',
          title: 'Matching failed',
          message: 'Error executing deterministic matching engine.',
        });
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Network error',
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

  // 5-Step Workflow calculations derived from real data
  const stepUploadDone = metrics.invoicesCount > 0 && metrics.txnsCount > 0;
  const stepMatchDone = (metrics.highConfidenceCount + metrics.reviewCount + metrics.confirmedMatchedPaise) > 0;
  const stepReviewDone = metrics.reviewCount === 0 && metrics.confirmedMatchedPaise > 0;
  const stepRemindDone = metrics.totalUnpaidPaise === 0 && metrics.invoicesCount > 0;
  const stepExportDone = metrics.confirmedMatchedPaise > 0 && metrics.reviewCount === 0;

  const steps = [
    {
      num: 1,
      name: 'Upload',
      desc: 'Invoices and bank statement',
      href: '/upload',
      status: stepUploadDone ? 'done' : !hasData ? 'current' : 'pending',
    },
    {
      num: 2,
      name: 'Match',
      desc: 'Deterministic engine',
      href: '/review',
      status: stepMatchDone ? 'done' : stepUploadDone ? 'current' : 'pending',
    },
    {
      num: 3,
      name: 'Review',
      desc: `${metrics.reviewCount} pending decisions`,
      href: '/review',
      status: stepReviewDone ? 'done' : metrics.reviewCount > 0 ? 'current' : 'pending',
    },
    {
      num: 4,
      name: 'Remind',
      desc: 'WhatsApp follow-ups',
      href: '/reminders',
      status: stepRemindDone ? 'done' : metrics.totalUnpaidPaise > 0 && stepMatchDone ? 'current' : 'pending',
    },
    {
      num: 5,
      name: 'Export',
      desc: 'Reconciled workbook',
      href: '/export',
      status: stepExportDone ? 'done' : metrics.confirmedMatchedPaise > 0 ? 'current' : 'pending',
    },
  ];

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const todayStr = new Date().toISOString().split('T')[0];

  const getOverdueDays = (dueDateStr: string) => {
    if (!dueDateStr) return 0;
    const diff = new Date(todayStr).getTime() - new Date(dueDateStr).getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24));
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
      {/* Standard Page Header Pattern */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-gray-900">Dashboard</h1>
          <p className="text-[14px] text-gray-500 mt-1">
            Reconcile customer payments against GST invoices with human verification.
            {lastMatchRun && (
              <span className="ml-2 inline-flex items-center text-[12px] text-gray-400">
                • Last matching run: {lastMatchRun}
              </span>
            )}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PrivacyBanner variant="compact" />

          <Tooltip
            content={
              metrics.invoicesCount === 0 || metrics.txnsCount === 0
                ? 'Upload invoices and a bank statement before running matching.'
                : ''
            }
          >
            <button
              onClick={handleRunMatching}
              disabled={runningMatch || loading || metrics.invoicesCount === 0 || metrics.txnsCount === 0}
              className="flex min-h-[40px] items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-emerald-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
            >
              {runningMatch ? (
                <RefreshCw className="h-4 w-4 stroke-[1.5] animate-spin" />
              ) : (
                <Play className="h-4 w-4 stroke-[1.5]" />
              )}
              <span>{lastMatchRun ? 'Re-run matching' : 'Run matching'}</span>
            </button>
          </Tooltip>

          <Link
            href="/export"
            className="flex min-h-[40px] items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[14px] font-medium text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            <Download className="h-4 w-4 stroke-[1.5] text-gray-500" />
            <span>Export books →</span>
          </Link>
        </div>
      </div>

      {/* Loading Skeleton */}
      {loading && !data && (
        <div className="space-y-6 animate-pulse">
          <div className="h-24 rounded-lg bg-gray-200 border border-gray-200" />
          <div className="h-20 rounded-lg bg-gray-200 border border-gray-200" />
          <div className="h-96 rounded-lg bg-gray-200 border border-gray-200" />
        </div>
      )}

      {/* Error State with Retry */}
      {error && !loading && (
        <div className="rounded-lg border border-red-200 bg-white p-6 text-center space-y-3">
          <AlertCircle className="h-6 w-6 stroke-[1.5] text-red-600 mx-auto" />
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Failed to load dashboard data</h3>
            <p className="text-xs text-gray-500 mt-1">{error}</p>
          </div>
          <button
            onClick={fetchDashboard}
            className="h-9 rounded border border-gray-200 bg-white px-4 text-xs font-medium text-gray-700 hover:bg-gray-50"
          >
            Retry request
          </button>
        </div>
      )}

      {/* Onboarding Empty State: Shown only when no data exists */}
      {!hasData && !loading && !error && (
        <div className="rounded-lg border border-gray-200 bg-white p-8 text-center space-y-4">
          <div className="max-w-md mx-auto space-y-2">
            <h2 className="text-base font-semibold text-gray-900">No invoices or bank records found</h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Upload customer invoices and a bank statement CSV to begin reconciliation, or load the sample Indian MSME dataset for an instant demonstration.
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
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
                    title: 'Demo dataset loaded',
                    message: '60 invoices and 80 bank transactions populated.',
                  });
                  setTimeout(() => window.location.reload(), 400);
                }
              }}
              className="h-10 rounded bg-emerald-600 px-4 text-xs font-medium text-white hover:bg-emerald-700 transition-colors"
            >
              Seed demo data
            </button>
            <Link
              href="/upload"
              className="flex h-10 items-center rounded border border-gray-200 bg-white px-4 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Upload files →
            </Link>
          </div>
        </div>
      )}

      {/* DASHBOARD MAIN CONTENT (When Data Exists) */}
      {hasData && !loading && (
        <div className="space-y-6">
          {/* COMPACT SUMMARY STRIP: 4 metrics in ONE bordered row with vertical dividers */}
          <div className="rounded-lg border border-gray-200 bg-white grid grid-cols-1 divide-y sm:grid-cols-4 sm:divide-y-0 sm:divide-x divide-gray-200">
            {/* Metric 1: Reconciled */}
            <div className="p-4 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Reconciled
              </span>
              <div className="text-xl font-semibold text-gray-900 tabular-nums">
                <IndianCurrency paise={metrics.confirmedMatchedPaise + metrics.highConfidencePaise} />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
                <span>{metrics.highConfidenceCount} auto-confirmed</span>
                <Link href="/review" className="font-medium text-emerald-700 hover:text-emerald-800">
                  Review →
                </Link>
              </div>
            </div>

            {/* Metric 2: Needs decision */}
            <div className="p-4 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Needs decision
              </span>
              <div className="text-xl font-semibold text-gray-900 tabular-nums">
                <IndianCurrency paise={metrics.reviewQueuePaise} />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
                <span>{metrics.reviewCount} matches in queue</span>
                <Link href="/review" className="font-medium text-amber-700 hover:text-amber-800">
                  Open queue →
                </Link>
              </div>
            </div>

            {/* Metric 3: Unmatched credits */}
            <div className="p-4 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Unmatched credits
              </span>
              <div className="text-xl font-semibold text-gray-900 tabular-nums">
                <IndianCurrency paise={metrics.unmatchedCreditsPaise} />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
                <span>{metrics.unmatchedCreditsCount} unallocated deposits</span>
                <Link href="/export" className="font-medium text-gray-700 hover:text-gray-900">
                  Audit →
                </Link>
              </div>
            </div>

            {/* Metric 4: Outstanding unpaid */}
            <div className="p-4 space-y-1">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Outstanding unpaid
              </span>
              <div className="text-xl font-semibold text-gray-900 tabular-nums">
                <IndianCurrency paise={metrics.totalUnpaidPaise} />
              </div>
              <div className="flex items-center justify-between text-xs text-gray-500 pt-0.5">
                <span>Pending collection</span>
                <Link href="/reminders" className="font-medium text-gray-700 hover:text-gray-900">
                  Reminders →
                </Link>
              </div>
            </div>
          </div>

          {/* 5-STEP WORKFLOW STEPPER: Restrained bordered container */}
          <div className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <span className="text-xs font-medium uppercase tracking-wider text-gray-500">
                Reconciliation workflow
              </span>
              <span className="text-xs text-gray-400">
                Step {steps.findIndex((s) => s.status === 'current') + 1 || 5} of 5
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 pt-3">
              {steps.map((step) => {
                const isDone = step.status === 'done';
                const isCurrent = step.status === 'current';

                return (
                  <Link
                    key={step.num}
                    href={step.href}
                    className={`flex flex-col justify-between rounded-lg border p-3 transition-colors ${
                      isDone
                        ? 'border-gray-200 bg-gray-50/50 hover:bg-gray-50'
                        : isCurrent
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-gray-200 bg-white hover:bg-gray-50 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-semibold text-gray-700 bg-gray-100">
                        {isDone ? <Check className="h-3 w-3 stroke-[2] text-emerald-700" /> : step.num}
                      </div>
                      <span
                        className={`text-[10px] font-medium uppercase px-2 py-0.5 rounded-full ${
                          isDone
                            ? 'text-emerald-700 bg-emerald-50 border border-emerald-200'
                            : isCurrent
                            ? 'text-emerald-800 bg-emerald-100 border border-emerald-200'
                            : 'text-gray-500 bg-gray-100 border border-gray-200'
                        }`}
                      >
                        {isDone ? 'Done' : isCurrent ? 'Active' : 'Pending'}
                      </span>
                    </div>

                    <div className="mt-2">
                      <p className="text-[12px] font-semibold text-gray-900">
                        {step.name} →
                      </p>
                      <p className="text-[11px] text-gray-500 mt-0.5 line-clamp-1">
                        {step.desc}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </div>
          </div>

          {/* MAIN INVOICE TABLE */}
          <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
            {/* Table Controls Header: Search & Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between p-4 border-b border-gray-200 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 stroke-[1.5] text-gray-400" />
                <input
                  type="text"
                  placeholder="Search invoice or customer..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="h-10 w-full sm:w-64 rounded-lg border border-gray-200 bg-white pl-9 pr-3 text-[14px] text-gray-900 placeholder:text-gray-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                />
              </div>

              {/* Status Filters */}
              <div className="flex items-center gap-1 overflow-x-auto text-[14px]">
                {(['all', 'unpaid', 'partial', 'paid', 'needs_review'] as const).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => {
                      setFilter(tab);
                      setCurrentPage(1);
                    }}
                    className={`h-10 rounded-lg px-3 text-[12px] font-medium capitalize whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 ${
                      filter === tab
                        ? 'bg-gray-100 font-semibold text-gray-900'
                        : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                    }`}
                  >
                    {tab.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Dense Table (40px Rows, Sticky Header, Horizontally Scrollable on Mobile) */}
            <div className="overflow-x-auto max-h-[560px]">
              <table className="w-full text-left text-sm border-collapse min-w-[700px]">
                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200 text-xs font-medium text-gray-500 uppercase tracking-wider z-10">
                  <tr className="h-10">
                    <th
                      onClick={() => handleSort('number')}
                      className="px-4 py-2 cursor-pointer hover:text-gray-900 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Invoice</span>
                        {sortField === 'number' ? (
                          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-emerald-700" /> : <ArrowDown className="h-3 w-3 text-emerald-700" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('customer_name')}
                      className="px-4 py-2 cursor-pointer hover:text-gray-900 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Customer</span>
                        {sortField === 'customer_name' ? (
                          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-emerald-700" /> : <ArrowDown className="h-3 w-3 text-emerald-700" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('issue_date')}
                      className="px-4 py-2 cursor-pointer hover:text-gray-900 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Issued</span>
                        {sortField === 'issue_date' ? (
                          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-emerald-700" /> : <ArrowDown className="h-3 w-3 text-emerald-700" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('due_date')}
                      className="px-4 py-2 cursor-pointer hover:text-gray-900 select-none"
                    >
                      <div className="flex items-center gap-1">
                        <span>Due date</span>
                        {sortField === 'due_date' ? (
                          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-emerald-700" /> : <ArrowDown className="h-3 w-3 text-emerald-700" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('amount_paise')}
                      className="px-4 py-2 text-right cursor-pointer hover:text-gray-900 select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Amount</span>
                        {sortField === 'amount_paise' ? (
                          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-emerald-700" /> : <ArrowDown className="h-3 w-3 text-emerald-700" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('settled_paise')}
                      className="px-4 py-2 text-right cursor-pointer hover:text-gray-900 select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Settled</span>
                        {sortField === 'settled_paise' ? (
                          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-emerald-700" /> : <ArrowDown className="h-3 w-3 text-emerald-700" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th
                      onClick={() => handleSort('outstanding_paise')}
                      className="px-4 py-2 text-right cursor-pointer hover:text-gray-900 select-none"
                    >
                      <div className="flex items-center justify-end gap-1">
                        <span>Outstanding</span>
                        {sortField === 'outstanding_paise' ? (
                          sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-emerald-700" /> : <ArrowDown className="h-3 w-3 text-emerald-700" />
                        ) : (
                          <ArrowUpDown className="h-3 w-3 text-gray-400 opacity-60" />
                        )}
                      </div>
                    </th>
                    <th className="px-4 py-2 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paginatedInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-12 text-center text-xs text-gray-400">
                        No invoices match the filter criteria.
                      </td>
                    </tr>
                  ) : (
                    paginatedInvoices.map((inv: any) => {
                      const overdueDays = getOverdueDays(inv.due_date);
                      const isOverdue = overdueDays > 0 && inv.status !== 'paid';

                      let badge = (
                        <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium text-gray-700 bg-gray-100 border border-gray-200">
                          Unpaid
                        </span>
                      );
                      if (inv.status === 'paid') {
                        badge = (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium text-emerald-800 bg-emerald-50 border border-emerald-200">
                            Paid
                          </span>
                        );
                      } else if (inv.status === 'partial') {
                        badge = (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium text-amber-800 bg-amber-50 border border-amber-200">
                            Partial
                          </span>
                        );
                      } else if (inv.status === 'needs_review') {
                        badge = (
                          <span className="inline-flex items-center rounded-full px-2.5 py-0.5 text-[12px] font-medium text-amber-800 bg-amber-50 border border-amber-200">
                            Review
                          </span>
                        );
                      }

                      return (
                        <tr
                          key={inv.id}
                          className="h-10 hover:bg-gray-50/80 transition-colors"
                        >
                          <td className="px-4 py-2 font-medium text-gray-900">{inv.number}</td>
                          <td className="px-4 py-2 text-gray-700 truncate max-w-[200px]">{inv.customer_name}</td>
                          <td className="px-4 py-2 text-gray-500 tabular-nums text-[12px]">{inv.issue_date}</td>
                          <td className="px-4 py-2 text-[12px] tabular-nums">
                            <span className={isOverdue ? 'text-red-600 font-medium' : 'text-gray-500'}>
                              {inv.due_date}
                            </span>
                            {isOverdue && (
                              <span className="ml-1 text-[11px] text-red-600 font-medium">
                                ({overdueDays}d overdue)
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-2 text-right font-medium text-gray-900 tabular-nums">
                            <IndianCurrency paise={inv.amount_paise} />
                          </td>
                          <td className="px-4 py-2 text-right text-gray-700 font-medium tabular-nums">
                            <IndianCurrency paise={inv.settled_paise} />
                          </td>
                          <td className="px-4 py-2 text-right tabular-nums font-medium">
                            <span className={inv.outstanding_paise > 0 ? 'text-gray-900' : 'text-gray-400'}>
                              <IndianCurrency paise={inv.outstanding_paise} />
                            </span>
                          </td>
                          <td className="px-4 py-2 text-center">{badge}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {filteredAndSortedInvoices.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 py-3 border-t border-gray-200 bg-gray-50 text-[12px] text-gray-500 gap-2">
                <div>
                  Showing {(currentPage - 1) * PAGE_SIZE + 1} to{' '}
                  {Math.min(currentPage * PAGE_SIZE, filteredAndSortedInvoices.length)} of{' '}
                  {filteredAndSortedInvoices.length} invoices
                </div>

                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 stroke-[1.5]" />
                    Previous
                  </button>

                  <span className="px-2 font-medium text-gray-700">
                    {currentPage} / {totalPages}
                  </span>

                  <button
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="flex h-8 items-center gap-1 rounded-lg border border-gray-200 bg-white px-2.5 font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >
                    Next
                    <ChevronRight className="h-3.5 w-3.5 stroke-[1.5]" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
