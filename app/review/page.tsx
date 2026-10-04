'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { IndianCurrency } from '@/components/indian-currency';
import { PrivacyBanner } from '@/components/privacy-banner';
import { Tooltip } from '@/components/tooltip';
import { useToast } from '@/components/toast';
import {
  CheckCircle,
  XCircle,
  AlertTriangle,
  RotateCcw,
  Sparkles,
  CheckCheck,
  Clock,
  Building,
  CreditCard,
  RefreshCw,
} from 'lucide-react';

export default function ReviewQueuePage() {
  const { showToast } = useToast();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [undoState, setUndoState] = useState<{ confirmedIds: string[]; timer: any } | null>(null);
  const [selectedTab, setSelectedTab] = useState<'review' | 'high_confidence' | 'confirmed' | 'rejected'>('review');

  const loadData = async () => {
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
        message: 'Could not fetch review queue matches.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleUpdateStatus = async (matchId: string, status: 'confirmed' | 'rejected') => {
    try {
      setActionLoading(matchId);
      const res = await fetch(`/api/matches/${matchId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        await loadData();
        if (status === 'confirmed') {
          showToast({
            type: 'success',
            title: 'Match Confirmed',
            message: 'Invoice payment allocated and payer alias saved to memory.',
          });
        } else {
          showToast({
            type: 'info',
            title: 'Match Rejected',
            message: 'Candidate rejected. Engine will not re-suggest this pair.',
          });
        }
      } else {
        showToast({
          type: 'error',
          title: 'Update Failed',
          message: 'Unable to update match decision in storage.',
        });
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Network Error',
        message: 'Could not reach match service.',
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkConfirmHighConfidence = async () => {
    const highConf = (data?.matches || []).filter(
      (m: any) => m.status === 'suggested' && m.score >= 0.90
    );
    if (highConf.length === 0) return;

    const ids = highConf.map((m: any) => m.id);
    setActionLoading('bulk');

    // Confirm all
    for (const id of ids) {
      await fetch(`/api/matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'confirmed' }),
      });
    }

    await loadData();
    setActionLoading(null);

    showToast({
      type: 'success',
      title: 'Bulk Confirmation Complete',
      message: `Confirmed ${ids.length} high-confidence matches. 10s undo window active.`,
    });

    // Set 10-second undo toast
    if (undoState?.timer) clearTimeout(undoState.timer);
    const timer = setTimeout(() => {
      setUndoState(null);
    }, 10000);

    setUndoState({ confirmedIds: ids, timer });
  };

  const handleUndoBulk = async () => {
    if (!undoState) return;
    clearTimeout(undoState.timer);
    setActionLoading('undo');

    for (const id of undoState.confirmedIds) {
      await fetch(`/api/matches/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'suggested' }),
      });
    }

    setUndoState(null);
    await loadData();
    setActionLoading(null);

    showToast({
      type: 'info',
      title: 'Action Undone',
      message: 'Reverted matches back to suggested review status.',
    });
  };

  const invoicesMap = new Map<string, any>((data?.invoices || []).map((i: any) => [i.id, i]));
  const txnsMap = new Map<string, any>((data?.txns || []).map((t: any) => [t.id, t]));

  const allMatches = data?.matches || [];
  const reviewMatches = allMatches.filter((m: any) => m.status === 'suggested' && m.score < 0.90);
  const highConfidenceMatches = allMatches.filter((m: any) => m.status === 'suggested' && m.score >= 0.90);
  const confirmedMatches = allMatches.filter((m: any) => m.status === 'confirmed');
  const rejectedMatches = allMatches.filter((m: any) => m.status === 'rejected');

  let currentList = reviewMatches;
  if (selectedTab === 'high_confidence') currentList = highConfidenceMatches;
  if (selectedTab === 'confirmed') currentList = confirmedMatches;
  if (selectedTab === 'rejected') currentList = rejectedMatches;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Review & Approval Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            A human approves every low-confidence match. No payments are reconciled without human sign-off.
          </p>
        </div>

        {/* Bulk Confirm High Confidence with Undo */}
        <div className="flex items-center gap-3">
          <PrivacyBanner variant="compact" />

          {highConfidenceMatches.length > 0 && (
            <Tooltip content="Confirm all matches with score >= 90% in one click">
              <button
                onClick={handleBulkConfirmHighConfidence}
                disabled={actionLoading !== null}
                className="min-h-[40px] flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
              >
                {actionLoading === 'bulk' ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4" />
                )}
                Confirm All High-Confidence ({highConfidenceMatches.length})
              </button>
            </Tooltip>
          )}

          {undoState && (
            <div className="flex items-center gap-2 rounded-xl bg-amber-500 text-white min-h-[40px] px-3.5 py-1.5 text-xs font-semibold shadow-md animate-pulse">
              <span>Confirmed {undoState.confirmedIds.length} matches</span>
              <button
                onClick={handleUndoBulk}
                className="underline flex items-center gap-1 hover:text-amber-100 ml-1 font-bold"
              >
                <RotateCcw className="h-3 w-3" />
                Undo (10s)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-slate-200 space-x-6 text-sm overflow-x-auto">
        <button
          onClick={() => setSelectedTab('review')}
          className={`pb-3 font-semibold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            selectedTab === 'review'
              ? 'border-amber-600 text-amber-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Clock className="h-4 w-4 text-amber-600" />
          Review Queue ({reviewMatches.length})
        </button>

        <button
          onClick={() => setSelectedTab('high_confidence')}
          className={`pb-3 font-semibold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            selectedTab === 'high_confidence'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Sparkles className="h-4 w-4 text-emerald-600" />
          High-Confidence ({highConfidenceMatches.length})
        </button>

        <button
          onClick={() => setSelectedTab('confirmed')}
          className={`pb-3 font-semibold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            selectedTab === 'confirmed'
              ? 'border-slate-900 text-slate-900'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <CheckCircle className="h-4 w-4 text-emerald-600" />
          Confirmed ({confirmedMatches.length})
        </button>

        <button
          onClick={() => setSelectedTab('rejected')}
          className={`pb-3 font-semibold transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            selectedTab === 'rejected'
              ? 'border-rose-600 text-rose-800'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <XCircle className="h-4 w-4 text-rose-600" />
          Rejected ({rejectedMatches.length})
        </button>
      </div>

      {/* Skeletons while loading */}
      {loading && !data && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-xl bg-slate-200" />
          ))}
        </div>
      )}

      {/* Match Cards List */}
      {!loading && currentList.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
          <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-base font-bold text-slate-800">No matches in this view</h3>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {selectedTab === 'review'
              ? 'All suggested matches have been confirmed or verified. Check High-Confidence or Confirmed tabs.'
              : 'Switch tabs or run the matching engine from the Dashboard to process new records.'}
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex items-center text-xs font-semibold text-emerald-700 hover:text-emerald-800"
            >
              Go to Dashboard →
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {currentList.map((match: any) => {
            const inv = invoicesMap.get(match.invoice_id);
            const txn = txnsMap.get(match.txn_id);
            if (!inv || !txn) return null;

            const isHighConfidence = match.score >= 0.90;
            const isAmbiguous = match.reasons.some((r: string) => r.toLowerCase().includes('ambiguous'));
            const isTds = match.adjustment_kind === 'tds';
            const isBankCharge = match.adjustment_kind === 'bank_charge';

            return (
              <div
                key={match.id}
                className={`rounded-xl border bg-white p-6 shadow-sm transition-all ${
                  isAmbiguous
                    ? 'border-amber-300 ring-1 ring-amber-200'
                    : isHighConfidence
                    ? 'border-emerald-200'
                    : 'border-slate-200'
                }`}
              >
                {/* Top Bar: Match Score & Method Badges */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-bold tabular-nums ${
                        isHighConfidence
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {Math.round(match.score * 100)}% Match Score
                    </span>
                    <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-600 uppercase">
                      {match.method.replace('_', ' ')}
                    </span>
                    {isTds && (
                      <span className="rounded-md bg-indigo-50 border border-indigo-200 px-2 py-0.5 text-[11px] font-semibold text-indigo-800 tabular-nums">
                        TDS Adjusted: -<IndianCurrency paise={match.adjustment_paise} />
                      </span>
                    )}
                    {isBankCharge && (
                      <span className="rounded-md bg-purple-50 border border-purple-200 px-2 py-0.5 text-[11px] font-semibold text-purple-800 tabular-nums">
                        Bank Charge Tol: -<IndianCurrency paise={match.adjustment_paise} />
                      </span>
                    )}
                  </div>

                  {/* Actions for Suggested Matches */}
                  {match.status === 'suggested' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateStatus(match.id, 'confirmed')}
                        disabled={actionLoading === match.id}
                        className="min-h-[40px] flex items-center gap-1.5 rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        Confirm Match
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(match.id, 'rejected')}
                        disabled={actionLoading === match.id}
                        className="min-h-[40px] flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500"
                      >
                        <XCircle className="h-3.5 w-3.5 text-rose-500" />
                        Reject
                      </button>
                    </div>
                  )}

                  {match.status === 'confirmed' && (
                    <span className="flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <CheckCircle className="h-4 w-4" />
                      Confirmed
                    </span>
                  )}
                  {match.status === 'rejected' && (
                    <span className="flex items-center gap-1 text-xs font-bold text-rose-600">
                      <XCircle className="h-4 w-4" />
                      Rejected
                    </span>
                  )}
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 pb-2">
                  {/* Left: Invoice Data */}
                  <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <Building className="h-3.5 w-3.5 text-slate-400" />
                      Invoice Record
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-base font-bold text-slate-900">{inv.number}</span>
                      <span className="text-sm font-bold text-slate-900 tabular-nums">
                        <IndianCurrency paise={inv.amount_paise} />
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 font-semibold">{inv.customer_name}</p>
                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 tabular-nums">
                      <span>Issued: {inv.issue_date}</span>
                      <span className="font-semibold text-slate-700">Due: {inv.due_date}</span>
                    </div>
                  </div>

                  {/* Right: Bank Transaction Record */}
                  <div className="space-y-1.5 rounded-xl bg-slate-50 p-4 border border-slate-200">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                      <CreditCard className="h-3.5 w-3.5 text-slate-400" />
                      Bank Statement Credit
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-xs text-slate-600 tabular-nums">{txn.date}</span>
                      <span className="text-sm font-bold text-emerald-700 tabular-nums">
                        +<IndianCurrency paise={txn.amount_paise} />
                      </span>
                    </div>
                    <p className="text-xs text-slate-800 break-all bg-white p-2 rounded-lg border border-slate-200 tabular-nums leading-snug">
                      {txn.narration}
                    </p>
                    {txn.utr_ref && (
                      <p className="text-[11px] text-slate-500 tabular-nums">UTR: {txn.utr_ref}</p>
                    )}
                  </div>
                </div>

                {/* Plain-Language Explainability Reasons */}
                <div className="mt-3 pt-3 border-t border-slate-100">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                    Matching Evidence & Explainability
                  </span>
                  <ul className="flex flex-wrap gap-2 text-xs">
                    {match.reasons.map((r: string, idx: number) => {
                      const isAlert = r.toLowerCase().includes('ambiguous');
                      return (
                        <li
                          key={idx}
                          className={`rounded-lg px-2.5 py-1 ${
                            isAlert
                              ? 'bg-amber-100 text-amber-900 font-semibold border border-amber-300'
                              : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          • {r}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
