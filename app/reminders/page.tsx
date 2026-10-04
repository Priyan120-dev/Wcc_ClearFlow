'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { IndianCurrency } from '@/components/indian-currency';
import { PrivacyBanner } from '@/components/privacy-banner';
import { Tooltip } from '@/components/tooltip';
import { useToast } from '@/components/toast';
import {
  MessageSquare,
  CheckCircle2,
  AlertTriangle,
  Send,
  QrCode,
  Check,
  RefreshCw,
} from 'lucide-react';

export default function RemindersPage() {
  const { showToast } = useToast();
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
    if (val.trim()) {
      showToast({
        type: 'info',
        title: 'UPI ID updated',
        message: `Payment links will embed ${val.trim()}`,
      });
    }
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
      showToast({
        type: 'error',
        title: 'Connection error',
        message: 'Could not fetch payment reminders.',
      });
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
        if (status === 'approved') {
          showToast({
            type: 'success',
            title: 'Draft approved',
            message: `Reminder for ${reminder.invoice_number} approved for WhatsApp dispatch.`,
          });
        } else {
          showToast({
            type: 'success',
            title: 'Marked as dispatched',
            message: `Logged follow-up dispatch for ${reminder.invoice_number}.`,
          });
        }
      } else {
        showToast({
          type: 'error',
          title: 'Update failed',
          message: 'Unable to update reminder status.',
        });
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Network error',
        message: 'Could not communicate with reminder service.',
      });
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-gray-900">Payment Reminders</h1>
          <p className="text-[14px] text-gray-500 mt-1">
            Review and approve WhatsApp reminders for unpaid invoices. No automated sending.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <PrivacyBanner variant="compact" />

          {/* UPI ID Setting */}
          <div className="flex items-center gap-2 rounded-lg bg-white border border-gray-200 px-3 py-1.5 min-h-[40px]">
            <QrCode className="h-4 w-4 stroke-[1.5] text-emerald-600 shrink-0" />
            <div className="text-[12px]">
              <span className="font-medium text-gray-500 block text-[10px] uppercase tracking-wide">
                UPI ID (Required)
              </span>
              <input
                type="text"
                placeholder="merchant@upi"
                value={upiId}
                onChange={(e) => handleSaveUpiId(e.target.value)}
                className="tabular-nums text-[12px] font-medium text-gray-900 focus:outline-none placeholder:text-gray-400 w-36 sm:w-44"
              />
            </div>
          </div>
        </div>
      </div>

      {!upiId.trim() && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900 flex items-center gap-2.5 font-medium">
          <AlertTriangle className="h-4 w-4 stroke-[1.5] text-amber-600 shrink-0" />
          <span>
            Please configure your UPI ID above to generate valid one-click NPCI UPI payment deep links with <code>tn=&lt;invoice_no&gt;</code>.
          </span>
        </div>
      )}

      {/* Skeletons while loading */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-36 rounded-lg bg-gray-100 border border-gray-200" />
          ))}
        </div>
      )}

      {/* Reminders List */}
      {!loading && reminders.length === 0 ? (
        <div className="rounded-lg border border-gray-200 bg-white p-12 text-center text-gray-500">
          <CheckCircle2 className="h-8 w-8 stroke-[1.5] text-gray-400 mx-auto mb-2" />
          <h3 className="text-[16px] font-semibold text-gray-900">All invoices settled</h3>
          <p className="text-[14px] text-gray-500 mt-1 max-w-sm mx-auto">
            There are no outstanding unpaid invoices requiring payment reminders.
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
          {reminders.map((rem) => {
            const waLink = buildWhatsAppLink(rem);
            const isApproved = rem.status === 'approved';
            const isSent = rem.status === 'sent';

            return (
              <div
                key={rem.id}
                className="rounded-lg border border-gray-200 bg-white p-6 space-y-4 transition-colors hover:border-gray-300"
              >
                {/* Warning if suggested match exists */}
                {rem.has_suggested_match && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 p-2.5 text-[12px] text-amber-900 flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-medium">
                      <AlertTriangle className="h-4 w-4 stroke-[1.5] text-amber-600 shrink-0" />
                      A bank payment match has been suggested for this invoice but is unconfirmed.
                    </span>
                    <Link href="/review" className="font-semibold underline hover:text-amber-950 ml-2">
                      Verify in review queue →
                    </Link>
                  </div>
                )}

                {/* Top Info Bar */}
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-gray-100 pb-3">
                  <div>
                    <span className="text-[16px] font-semibold text-gray-900">{rem.invoice_number}</span>
                    <span className="text-[14px] text-gray-500 ml-2">{rem.customer_name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[12px] text-gray-500 uppercase font-medium mr-2">Outstanding:</span>
                    <span className="text-[16px] font-semibold text-red-600 tabular-nums">
                      <IndianCurrency paise={rem.outstanding_paise} />
                    </span>
                  </div>
                </div>

                {/* Draft Content & WhatsApp Action */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  {/* Draft Message Pane */}
                  <div className="md:col-span-2 space-y-2">
                    <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
                      Reminder Draft (No Bank/IFSC Details Included)
                    </span>
                    <div className="rounded-lg bg-gray-50 p-4 tabular-nums text-[12px] text-gray-800 border border-gray-200 whitespace-pre-line leading-relaxed">
                      {rem.draft_text}
                      {upiId.trim() && (
                        <div className="mt-3 pt-2.5 border-t border-gray-200 text-emerald-800 font-medium text-[11px]">
                          Direct UPI Intent: upi://pay?pa={upiId}&am={rem.outstanding_rupees}&tn={rem.invoice_number}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions & Status Pane */}
                  <div className="space-y-3 bg-gray-50 p-4 rounded-lg border border-gray-200 flex flex-col justify-between">
                    <div className="space-y-1">
                      <span className="text-[12px] font-medium text-gray-500 uppercase tracking-wide">
                        Approval State
                      </span>
                      <div className="flex items-center gap-2 pt-1">
                        <span
                          className={`rounded-full px-2.5 py-0.5 text-[12px] font-medium uppercase ${
                            isSent
                              ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                              : isApproved
                              ? 'bg-amber-50 border border-amber-200 text-amber-800'
                              : 'bg-gray-100 border border-gray-200 text-gray-700'
                          }`}
                        >
                          {rem.status}
                        </span>
                        {rem.last_reminded_at && (
                          <span className="text-[12px] text-gray-500 tabular-nums">
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
                          className="min-h-[40px] w-full flex items-center justify-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-[12px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                        >
                          {savingId === rem.id ? (
                            <RefreshCw className="h-3.5 w-3.5 stroke-[1.5] animate-spin" />
                          ) : (
                            <Check className="h-3.5 w-3.5 stroke-[1.5]" />
                          )}
                          Approve reminder draft
                        </button>
                      )}

                      {/* Step 2: Open WhatsApp wa.me link */}
                      {waLink && (
                        <a
                          href={waLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="min-h-[40px] w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-gray-900 hover:bg-gray-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                        >
                          <MessageSquare className="h-3.5 w-3.5 stroke-[1.5] text-emerald-600" />
                          Open WhatsApp ({rem.normalized_phone})
                        </a>
                      )}

                      {/* Step 3: Mark as sent */}
                      {!isSent && (
                        <button
                          onClick={() => handleUpdateStatus(rem, 'sent')}
                          disabled={savingId === rem.id}
                          className="min-h-[40px] w-full flex items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
                        >
                          <Send className="h-3.5 w-3.5 stroke-[1.5] text-gray-500" />
                          Mark as dispatched
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
