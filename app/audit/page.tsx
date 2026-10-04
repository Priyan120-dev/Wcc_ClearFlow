'use client';

import React, { useEffect, useState } from 'react';
import { PrivacyBanner } from '@/components/privacy-banner';
import { useToast } from '@/components/toast';
import {
  ShieldCheck,
  Lock,
  Eye,
  FileCheck2,
  Trash2,
  RefreshCw,
  History,
  CheckCircle2,
} from 'lucide-react';

export default function AuditTrustPage() {
  const { showToast } = useToast();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [purging, setPurging] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/dashboard');
      if (res.ok) {
        const json = await res.json();
        setLogs(json.auditLogs || []);
      }
    } catch (e) {
      console.error(e);
      showToast({
        type: 'error',
        title: 'Connection error',
        message: 'Could not fetch audit log history.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handlePurgeData = async () => {
    if (
      !confirm(
        'Are you sure you want to permanently delete all invoices, bank transactions, matches, payer aliases, reminders, and audit logs? This cannot be undone.'
      )
    ) {
      return;
    }

    try {
      setPurging(true);
      const res = await fetch('/api/user/purge', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(data.message || 'All session data permanently deleted.');
        setLogs([]);
        showToast({
          type: 'success',
          title: 'Data erased',
          message: 'All records, storage blobs, and audit entries permanently removed.',
        });
      } else {
        showToast({
          type: 'error',
          title: 'Purge failed',
          message: data.error || 'Failed to erase data.',
        });
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Network error',
        message: 'Unable to communicate with purge service.',
      });
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-gray-900">Audit Trail & Trust</h1>
          <p className="text-[14px] text-gray-500 mt-1">
            Immutable append-only log of reconciliation actions and data governance policies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="min-h-[40px] flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[14px] font-medium text-gray-700 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            <RefreshCw className={`h-4 w-4 stroke-[1.5] ${loading ? 'animate-spin' : ''}`} />
            Refresh log
          </button>
        </div>
      </div>

      {/* Full Privacy Notice */}
      <PrivacyBanner variant="full" />

      {statusMessage && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-[14px] font-medium text-emerald-800 flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4 stroke-[1.5] text-emerald-600 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Trust & Data Privacy Policy Panel */}
      <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-5">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 stroke-[1.5] text-emerald-600" />
          <h2 className="text-[16px] font-semibold text-gray-900">How your data is handled</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-[14px] text-gray-600">
          <div className="rounded-lg bg-gray-50 p-4 border border-gray-200 space-y-1.5">
            <span className="font-semibold text-gray-900 flex items-center gap-1.5 text-[14px]">
              <Lock className="h-4 w-4 stroke-[1.5] text-gray-500" />
              1. Local Bank Narration Processing
            </span>
            <p className="text-[14px] text-gray-500 leading-relaxed">
              Bank statements and transaction narrations are parsed and matched strictly on your machine/server. They are{' '}
              <strong className="text-gray-900 font-medium">never</strong> sent to any external LLM or cloud AI service.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 border border-gray-200 space-y-1.5">
            <span className="font-semibold text-gray-900 flex items-center gap-1.5 text-[14px]">
              <Eye className="h-4 w-4 stroke-[1.5] text-gray-500" />
              2. Document Vision Extraction
            </span>
            <p className="text-[14px] text-gray-500 leading-relaxed">
              Invoice documents (PDFs and photos) are transmitted to the Google Gemini API as-is for text/amount extraction.
              The AI never performs matching or math.
            </p>
          </div>

          <div className="rounded-lg bg-gray-50 p-4 border border-gray-200 space-y-1.5">
            <span className="font-semibold text-gray-900 flex items-center gap-1.5 text-[14px]">
              <FileCheck2 className="h-4 w-4 stroke-[1.5] text-gray-500" />
              3. Human Decision Enforcement
            </span>
            <p className="text-[14px] text-gray-500 leading-relaxed">
              Ambiguous matches, short-pays, and customer payment reminders require explicit human review and approval.
              Nothing is ever auto-dispatched.
            </p>
          </div>
        </div>

        {/* Delete all my data section */}
        <div className="pt-4 border-t border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h4 className="text-[14px] font-semibold text-gray-900">Right to Erasure (GDPR / Indian DPDP Compliance)</h4>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Permanently delete all session records, uploaded documents, matches, aliases, and audit logs.
            </p>
          </div>
          <button
            onClick={handlePurgeData}
            disabled={purging}
            className="min-h-[40px] flex items-center justify-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-[14px] font-medium text-red-700 hover:bg-red-100 disabled:opacity-50 transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-600 focus-visible:ring-offset-2"
          >
            {purging ? (
              <RefreshCw className="h-4 w-4 stroke-[1.5] animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4 stroke-[1.5]" />
            )}
            Delete all session data
          </button>
        </div>
      </div>

      {/* Immutable Audit Log Table */}
      <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
          <div>
            <h3 className="text-[14px] font-semibold text-gray-900 flex items-center gap-1.5">
              <History className="h-4 w-4 stroke-[1.5] text-gray-500" />
              Audit Log (Append-Only)
            </h3>
            <p className="text-[12px] text-gray-500 mt-0.5">
              Row-Level Security permits INSERT and SELECT only. Entries cannot be altered or retroactively modified.
            </p>
          </div>
        </div>

        {/* Skeletons while loading */}
        {loading && (
          <div className="p-6 space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 rounded-lg bg-gray-100" />
            ))}
          </div>
        )}

        {!loading && (
          <div className="divide-y divide-gray-100 text-[14px]">
            {logs.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-[14px]">
                No audit log entries recorded in this session.
              </div>
            ) : (
              logs.map((log) => (
                <div key={log.id} className="p-4 hover:bg-gray-50/50 transition-colors flex flex-col gap-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 tabular-nums text-[12px] font-medium text-gray-700">
                        {log.action}
                      </span>
                      <span className="text-gray-500 text-[14px]">
                        on <span className="text-gray-900 font-medium">{log.entity}</span> (ID: <span className="tabular-nums font-mono text-[12px] text-gray-600">{log.entity_id}</span>)
                      </span>
                    </div>
                    <span className="text-gray-400 tabular-nums text-[12px]">
                      {new Date(log.ts).toLocaleString()}
                    </span>
                  </div>

                  {log.after && (
                    <div className="mt-1 rounded-lg bg-gray-50 p-2.5 tabular-nums text-[12px] text-gray-600 border border-gray-200 overflow-x-auto font-mono">
                      {JSON.stringify(log.after)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
