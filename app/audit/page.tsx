'use client';

import React, { useEffect, useState } from 'react';
import { PrivacyBanner } from '@/components/privacy-banner';
import {
  ShieldCheck,
  Trash2,
  Lock,
  Eye,
  FileCheck2,
  Clock,
  AlertTriangle,
  History,
  RefreshCw,
} from 'lucide-react';

export default function AuditPage() {
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
        setLogs(json.recentActivity || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const handlePurgeData = async () => {
    const confirmed = window.confirm(
      'Are you sure you want to permanently delete all your data? This will purge all your uploaded invoices, bank transactions, matches, and reminders from the database and storage.'
    );
    if (!confirmed) return;

    try {
      setPurging(true);
      const res = await fetch('/api/user/purge', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage(data.message || 'All data has been deleted.');
        setLogs([]);
      } else {
        alert(data.error || 'Failed to delete data');
      }
    } catch (e) {
      alert('Network error deleting data');
    } finally {
      setPurging(false);
    }
  };

  return (
    <div className="space-y-6">
      <PrivacyBanner />

      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Trust, Privacy & Audit Trail</h1>
        <p className="text-sm text-slate-500">
          Immutable log of all reconciliation decisions and clear data handling policies.
        </p>
      </div>

      {statusMessage && (
        <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">
          {statusMessage}
        </div>
      )}

      {/* Trust & Data Privacy Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-slate-900">How Your Data is Handled</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs text-slate-600">
          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-emerald-600" />
              1. Local Bank Narration Processing
            </span>
            <p>
              Bank statements and transaction narrations are parsed and matched strictly on your machine/server. They are{' '}
              <strong>never</strong> sent to any external LLM or cloud AI service.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <Eye className="h-3.5 w-3.5 text-blue-600" />
              2. Document Vision Extraction
            </span>
            <p>
              Invoice documents (PDFs and photos) are transmitted to the Google Gemini API as-is for text/amount extraction.
              The AI never performs matching or math.
            </p>
          </div>

          <div className="rounded-lg bg-slate-50 p-3.5 border border-slate-200 space-y-1">
            <span className="font-bold text-slate-900 flex items-center gap-1.5">
              <FileCheck2 className="h-3.5 w-3.5 text-purple-600" />
              3. Human Decision Enforcement
            </span>
            <p>
              Ambiguous matches, short-pays, and customer payment reminders require explicit human review and approval.
              Nothing is ever auto-dispatched.
            </p>
          </div>
        </div>

        {/* Delete all my data section */}
        <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h4 className="text-xs font-semibold text-slate-800">Right to Erasure (GDPR / Indian DPDP Compliance)</h4>
            <p className="text-[11px] text-slate-500">
              Permanently delete all your session records, uploaded documents, matches, and audit logs.
            </p>
          </div>
          <button
            onClick={handlePurgeData}
            disabled={purging}
            className="flex items-center gap-1.5 rounded-lg border border-rose-300 bg-rose-50 px-3.5 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50 transition-all shrink-0"
          >
            {purging ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            Delete All My Data
          </button>
        </div>
      </div>

      {/* Immutable Audit Log Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <History className="h-4 w-4 text-slate-500" />
              Immutable Audit Trail (Append-Only)
            </h3>
            <p className="text-xs text-slate-500">
              Row-Level Security allows INSERT and SELECT only. Entries cannot be altered or retroactively modified.
            </p>
          </div>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-50"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        <div className="divide-y divide-slate-100 text-xs">
          {logs.length === 0 ? (
            <div className="p-8 text-center text-slate-400">No audit log entries recorded in this session.</div>
          ) : (
            logs.map((log) => (
              <div key={log.id} className="p-4 hover:bg-slate-50/50 transition-colors flex flex-col gap-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono font-semibold text-slate-800">
                      {log.action}
                    </span>
                    <span className="text-slate-500">
                      on <span className="font-mono text-slate-700">{log.entity}</span> (ID: {log.entity_id})
                    </span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(log.ts).toLocaleString()}
                  </span>
                </div>

                {log.after && (
                  <div className="mt-1 rounded bg-slate-50 p-2 font-mono text-[11px] text-slate-600 border border-slate-200 overflow-x-auto">
                    {JSON.stringify(log.after)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
