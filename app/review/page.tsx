'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { IndianCurrency } from '@/components/indian-currency';
import { PrivacyBanner } from '@/components/privacy-banner';
import { Tooltip } from '@/components/tooltip';
import { useToast } from '@/components/toast';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  RotateCcw,
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
        title: 'Connection error',
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
            title: 'Match confirmed',
            message: 'Invoice payment allocated and payer alias saved to memory.',
          });
        } else {
          showToast({
            type: 'info',
            title: 'Match rejected',
            message: 'Candidate rejected. Engine will not re-suggest this pair.',
          });
        }
      } else {
        showToast({
          type: 'error',
          title: 'Update failed',
          message: 'Unable to update match decision in storage.',
        });
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Network error',
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
      title: 'Bulk confirmation complete',
      message: `Confirmed ${ids.length} high-confidence matches. 10s undo window active.`,
    });

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
      title: 'Action undone',
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-gray-900">Review Queue</h1>
          <p className="text-[14px] text-gray-500 mt-1">
            {reviewMatches.length > 0
              ? `${reviewMatches.length} matches need your decision before payment allocation.`
              : 'Every reconciliation decision is verified with human sign-off.'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PrivacyBanner variant="compact" />

          {highConfidenceMatches.length > 0 && (
            <Tooltip content="Confirm all matches with score >= 90% in one click">
              <button
                onClick={handleBulkConfirmHighConfidence}
                disabled={actionLoading !== null}
                className="min-h-[40px] flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
              >
                {actionLoading === 'bulk' ? (
                  <RefreshCw className="h-4 w-4 stroke-[1.5] animate-spin" />
                ) : (
                  <CheckCheck className="h-4 w-4 stroke-[1.5]" />
                )}
                Confirm {highConfidenceMatches.length} high-confidence matches
              </button>
            </Tooltip>
          )}

          {undoState && (
            <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 min-h-[40px] px-3.5 py-1.5 text-[12px] font-medium">
              <span>Confirmed {undoState.confirmedIds.length} matches</span>
              <button
                onClick={handleUndoBulk}
                className="underline flex items-center gap-1 hover:text-amber-950 ml-1 font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-600 rounded"
              >
                <RotateCcw className="h-3 w-3 stroke-[1.5]" />
                Undo (10s)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-gray-200 gap-2 overflow-x-auto">
        <button
          onClick={() => setSelectedTab('review')}
          className={`pb-2.5 px-3 text-[14px] font-medium transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            selectedTab === 'review'
              ? 'border-amber-600 text-amber-800'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <Clock className="h-4 w-4 stroke-[1.5] text-amber-600" />
          Review queue ({reviewMatches.length})
        </button>

        <button
          onClick={() => setSelectedTab('high_confidence')}
          className={`pb-2.5 px-3 text-[14px] font-medium transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            selectedTab === 'high_confidence'
              ? 'border-emerald-600 text-emerald-800'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <CheckCheck className="h-4 w-4 stroke-[1.5] text-emerald-600" />
          High-confidence ({highConfidenceMatches.length})
        </button>

        <button
          onClick={() => setSelectedTab('confirmed')}
          className={`pb-2.5 px-3 text-[14px] font-medium transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            selectedTab === 'confirmed'
              ? 'border-gray-900 text-gray-900'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <CheckCircle2 className="h-4 w-4 stroke-[1.5] text-gray-600" />
          Confirmed ({confirmedMatches.length})
        </button>

        <button
          onClick={() => setSelectedTab('rejected')}
          className={`pb-2.5 px-3 text-[14px] font-medium transition-colors border-b-2 flex items-center gap-1.5 whitespace-nowrap ${
            selectedTab === 'rejected'
              ? 'border-red-600 text-red-800'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <XCircle className="h-4 w-4 stroke-[1.5] text-red-600" />
          Rejected ({rejectedMatches.length})
        </button>
      </div>

      {/* Skeletons while loading */}
      {loading && !data && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 rounded-lg bg-gray-100 border border-gray-200" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && currentList.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          <CheckCircle2 className="h-8 w-8 stroke-[1.5] text-gray-400 mx-auto mb-2" />
          <h3 className="text-[16px] font-semibold text-gray-900">No matches in this view</h3>
          <p className="text-[14px] text-gray-500 mt-1 max-w-sm mx-auto">
            {selectedTab === 'review'
              ? 'All suggested matches have been confirmed or verified. Check high-confidence or confirmed tabs.'
              : 'Switch tabs or run the matching engine from the dashboard to process new records.'}
          </p>
          <div className="mt-4">
            <Link
              href="/"
              className="inline-flex items-center text-[14px] font-medium text-emerald-700 hover:text-emerald-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded"
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
                className={`rounded-lg border bg-white p-6 space-y-4 transition-colors ${
                  isAmbiguous
                    ? 'border-amber-300 bg-amber-50/20'
                    : isHighConfidence
                    ? 'border-gray-200 hover:border-gray-300'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                {/* Top Bar: Match Score & Method Badges */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-gray-100">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium tabular-nums ${
                        isHighConfidence
                          ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                          : 'bg-amber-50 border border-amber-200 text-amber-800'
                      }`}
                    >
                      {Math.round(match.score * 100)}% match score
                    </span>
                    <span className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[12px] font-medium text-gray-700 uppercase">
                      {match.method.replace('_', ' ')}
                    </span>
                    {isTds && (
                      <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[12px] font-medium text-gray-700 tabular-nums">
                        TDS adjusted: -<IndianCurrency paise={match.adjustment_paise} />
                      </span>
                    )}
                    {isBankCharge && (
                      <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[12px] font-medium text-gray-700 tabular-nums">
                        Bank charge: -<IndianCurrency paise={match.adjustment_paise} />
                      </span>
                    )}
                  </div>

                  {/* Actions for Suggested Matches */}
                  {match.status === 'suggested' && (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleUpdateStatus(match.id, 'confirmed')}
                        disabled={actionLoading === match.id}
                        className="min-h-[40px] flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 stroke-[1.5]" />
                        Confirm match
                      </button>
                      <button
                        onClick={() => handleUpdateStatus(match.id, 'rejected')}
                        disabled={actionLoading === match.id}
                        className="min-h-[40px] flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                      >
                        <XCircle className="h-3.5 w-3.5 stroke-[1.5] text-red-500" />
                        Reject candidate
                      </button>
                    </div>
                  )}

                  {match.status === 'confirmed' && (
                    <span className="flex items-center gap-1 text-[12px] font-medium text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 stroke-[1.5]" />
                      Confirmed
                    </span>
                  )}
                  {match.status === 'rejected' && (
                    <span className="flex items-center gap-1 text-[12px] font-medium text-red-600">
                      <XCircle className="h-4 w-4 stroke-[1.5]" />
                      Rejected
                    </span>
                  )}
                </div>

                {/* Side-by-Side Comparison */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Left: Invoice Data */}
                  <div className="rounded-lg bg-gray-50 p-4 border border-gray-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 uppercase tracking-wider">
                      <Building className="h-3.5 w-3.5 stroke-[1.5] text-gray-500" />
                      Invoice Record
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-[16px] font-semibold text-gray-900">{inv.number}</span>
                      <span className="text-[14px] font-semibold text-gray-900 tabular-nums">
                        <IndianCurrency paise={inv.amount_paise} />
                      </span>
                    </div>
                    <p className="text-[14px] text-gray-800 font-medium">{inv.customer_name}</p>
                    <div className="flex items-center gap-4 text-[12px] text-gray-500 pt-1 tabular-nums">
                      <span>Issued: {inv.issue_date}</span>
                      <span className="font-medium text-gray-700">Due: {inv.due_date}</span>
                    </div>
                  </div>

                  {/* Right: Bank Transaction Record */}
                  <div className="rounded-lg bg-gray-50 p-4 border border-gray-200 space-y-1.5">
                    <div className="flex items-center gap-1.5 text-[12px] font-medium text-gray-500 uppercase tracking-wider">
                      <CreditCard className="h-3.5 w-3.5 stroke-[1.5] text-gray-500" />
                      Bank Statement Credit
                    </div>
                    <div className="flex items-baseline justify-between pt-1">
                      <span className="text-[12px] text-gray-500 tabular-nums">{txn.date}</span>
                      <span className="text-[14px] font-semibold text-emerald-700 tabular-nums">
                        +<IndianCurrency paise={txn.amount_paise} />
                      </span>
                    </div>
                    <p className="text-[12px] text-gray-800 break-all bg-white p-2.5 rounded-lg border border-gray-200 tabular-nums leading-snug">
                      {txn.narration}
                    </p>
                    {txn.utr_ref && (
                      <p className="text-[12px] text-gray-500 tabular-nums">UTR: {txn.utr_ref}</p>
                    )}
                  </div>
                </div>

                {/* Plain-Language Explainability Reasons */}
                <div className="pt-2 border-t border-gray-100">
                  <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wider block mb-1.5">
                    Matching Evidence & Explainability
                  </span>
                  <ul className="flex flex-wrap gap-2 text-[12px]">
                    {match.reasons.map((r: string, idx: number) => {
                      const isAlert = r.toLowerCase().includes('ambiguous');
                      return (
                        <li
                          key={idx}
                          className={`rounded-full px-2.5 py-0.5 ${
                            isAlert
                              ? 'bg-amber-50 text-amber-900 font-medium border border-amber-200'
                              : 'bg-gray-100 text-gray-700 border border-gray-200'
                          }`}
                        >
                          {r}
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
