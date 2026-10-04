'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { IndianCurrency } from '@/components/indian-currency';
import { PrivacyBanner } from '@/components/privacy-banner';
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Send,
  ExternalLink,
  QrCode,
  Clock,
  Check,
  ShieldCheck,
} from 'lucide-react';

export default function RemindersPage() {
  const [reminders, setReminders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [upiId, setUpiId] = useState<string>('');
  const [savingId, setSavingId] = useState<string | null>(null);

  // Load UPI ID from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('wcc_clearflow_upi_id');
    if (saved) setUpiId(saved);
  }, []);

  const handleSaveUpiId = (val: string) => {
    setUpiId(val);
    localStorage.setItem('wcc_clearflow_upi_id', val.trim());
  };

  const loadReminders = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/reminders');
      if (res.ok) {
        const json = await res.json();
        setReminders(json.reminders || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const handleUpdateStatus = async (reminder: any, status: 'approved' | 'sent') => {
    try {
      setSavingId(reminder.id);
      const res = await fetch(`/api/reminders/${reminder.id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status,
          invoice_id: reminder.invoice_id,
          outstanding_paise: reminder.outstanding_paise,
          draft_text: reminder.draft_text,
        }),
      });
      if (res.ok) {
        await loadReminders();
      }
    } catch (e) {
      alert('Failed to update reminder status');
    } finally {
      setSavingId(null);
    }
  };

  // Helper to build WhatsApp deep link
  const buildWhatsAppLink = (rem: any) => {
    if (!rem.normalized_phone) return null;
    let message = rem.draft_text;

    if (upiId.trim()) {
      const upiUrl = `upi://pay?pa=${encodeURIComponent(upiId.trim())}&pn=${encodeURIComponent(
        'ClearFlow Merchant'
      )}&am=${rem.outstanding_rupees}&cu=INR&tn=${encodeURIComponent(rem.invoice_number)}`;
      message += `\n\nDirect UPI Pay Link: ${upiUrl}\nPayee UPI ID: ${upiId.trim()}`;
    }

    return `https://wa.me/${rem.normalized_phone}?text=${encodeURIComponent(message)}`;
  };

  return (
    <div className="space-y-6">
      <PrivacyBanner />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Unpaid Invoices & Reminders</h1>
          <p className="text-sm text-slate-500">
            Human approves every reminder. No messages are dispatched automatically without explicit user action.
          </p>
        </div>

        {/* Required UPI ID Setting */}
        <div className="flex items-center gap-2 rounded-lg bg-white border border-slate-300 p-2 shadow-sm">
          <QrCode className="h-4 w-4 text-emerald-600" />
          <div className="text-xs">
            <span className="font-semibold text-slate-700 block text-[10px] uppercase">Your UPI ID (Required)</span>
            <input
              type="text"
              placeholder="e.g. merchant@okhdfcbank"
              value={upiId}
              onChange={(e) => handleSaveUpiId(e.target.value)}
              className="font-mono text-xs font-semibold text-emerald-950 focus:outline-none placeholder:text-slate-400"
            />
          </div>
        </div>
      </div>

      {!upiId.trim() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          Please enter your UPI ID above to generate valid UPI deep payment links with tn=&lt;invoice_no&gt;.
        </div>
      )}

      {/* Reminders List */}
      {loading ? (
        <div className="p-12 text-center text-slate-400 text-sm">Loading unpaid invoices...</div>
      ) : reminders.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-12 text-center text-slate-500 shadow-sm">
          <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
          <h3 className="text-base font-semibold text-slate-800">All invoices settled!</h3>
          <p className="text-sm text-slate-500 mt-1">There are no outstanding unpaid invoices requiring payment reminders.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {reminders.map((rem) => {
            const waLink = buildWhatsAppLink(rem);
            const isApproved = rem.status === 'approved';
            const isSent = rem.status === 'sent';

            return (
              <div
                key={rem.id}
                className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4"
              >
                {/* Warning if suggested match exists */}
                {rem.has_suggested_match && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-xs text-amber-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                      Warning: A bank payment match has been suggested for this invoice but is unconfirmed.
                    </span>
                    <Link href="/review" className="underline font-semibold hover:text-amber-950">
                      Verify in Review Queue &rarr;
                    </Link>
                  </div>
                )}

                {/* Top Info Bar */}
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
                  <div>
                    <span className="text-base font-bold text-slate-900">{rem.invoice_number}</span>
                    <span className="text-sm text-slate-600 ml-2 font-medium">{rem.customer_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs text-slate-500 uppercase tracking-wide mr-2">Outstanding:</span>
                    <span className="text-base font-bold text-rose-600">
                      <IndianCurrency paise={rem.outstanding_paise} />
                    </span>
                  </div>
                </div>

                {/* Draft Content & WhatsApp Action */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {/* Draft Message Pane */}
                  <div className="md:col-span-2 space-y-2">
                    <span className="text-xs font-semibold text-slate-500 uppercase">
                      Polite Payment Reminder Draft (No Bank/IFSC Details)
                    </span>
                    <div className="rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-800 border border-slate-200 whitespace-pre-line">
                      {rem.draft_text}
                      {upiId.trim() && (
                        <div className="mt-3 pt-2 border-t border-slate-200 text-emerald-800 font-semibold">
                          Direct UPI: upi://pay?pa={upiId}&am={rem.outstanding_rupees}&tn={rem.invoice_number}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Pane */}
                  <div className="space-y-3 bg-slate-50/70 p-4 rounded-lg border border-slate-200 flex flex-col justify-between">
                    <div className="space-y-1">
                      <span className="text-xs font-semibold text-slate-500 uppercase">Approval Status</span>
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-xs font-bold uppercase ${
                            isSent
                              ? 'bg-emerald-100 text-emerald-800'
                              : isApproved
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-slate-200 text-slate-700'
                          }`}
                        >
                          {rem.status}
                        </span>
                        {rem.last_reminded_at && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            Sent: {new Date(rem.last_reminded_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2 pt-2">
                      {/* Step 1: Explicit Human Approval */}
                      {!isApproved && !isSent && (
                        <button
                          onClick={() => handleUpdateStatus(rem, 'approved')}
                          disabled={savingId === rem.id}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Check className="h-3.5 w-3.5" />
                          Approve Reminder Draft
                        </button>
                      )}

                      {/* Step 2: Open WhatsApp wa.me link */}
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                        >
                          <MessageSquare className="h-3.5 w-3.5" />
                          Open WhatsApp ({rem.normalized_phone})
                        </a>
                      )}

                      {/* Step 3: Mark as sent */}
                      {!isSent && (
                        <button
                          onClick={() => handleUpdateStatus(rem, 'sent')}
                          disabled={savingId === rem.id}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                        >
                          <Send className="h-3.5 w-3.5 text-slate-500" />
                          Mark as Sent
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
