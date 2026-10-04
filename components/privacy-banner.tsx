'use client';

import React, { useState } from 'react';
import { ShieldCheck, AlertCircle, X, Lock, CheckCircle2 } from 'lucide-react';

interface PrivacyBannerProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function PrivacyBanner({ variant = 'compact', className = '' }: PrivacyBannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Full variant: used directly on the Trust / Audit page
  if (variant === 'full') {
    return (
      <div className={`rounded-xl border border-emerald-200 bg-emerald-50/80 p-5 text-xs text-slate-700 shadow-sm ${className}`}>
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="space-y-2 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-slate-900">
                Data Privacy & Zero-AI Statement Invariant
              </h3>
              <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-800 uppercase tracking-wide">
                DPDP & GDPR Compliant
              </span>
            </div>
            <p className="leading-relaxed">
              Bank statements, account figures, and transaction narrations are processed <strong>strictly locally</strong> on this server and are <strong>never</strong> transmitted to any external AI provider.
            </p>
            <p className="leading-relaxed">
              Invoice scans and PDF files are read by the Google Gemini API solely for optical character recognition (OCR). All downstream math, matching, and accounting logic execute through 100% deterministic, auditable TypeScript.
            </p>
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 p-2.5 text-amber-900 border border-amber-200 font-medium text-[11px]">
              <AlertCircle className="h-4 w-4 shrink-0 text-amber-600" />
              <span>Advisory: Please use sample, synthetic, or redacted test data only on free-tier AI APIs.</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Compact variant: sleek shield badge that opens dialog modal
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/90 px-3 py-1 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 hover:border-emerald-300 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 shadow-sm ${className}`}
        title="Click to view privacy & data security guarantee"
      >
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
        <span>Privacy Shield</span>
      </button>

      {/* Popover / Modal Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-150">
          <div
            className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700">
                  <Lock className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">Privacy & Data Governance</h3>
                  <p className="text-xs text-slate-500">WCC ClearFlow Security Architecture</p>
                </div>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                aria-label="Close dialog"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-xs text-slate-600 leading-relaxed">
              <div className="rounded-lg bg-emerald-50/70 p-3 border border-emerald-100 space-y-1">
                <p className="font-semibold text-emerald-950 flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Bank Data Confidentiality Guarantee
                </p>
                <p className="text-emerald-900">
                  Bank statements, account numbers, and transaction narrations are processed <strong>strictly locally</strong> on this server and are <strong>never sent to any external AI API</strong>.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-slate-800">Invoice Vision OCR</p>
                <p>
                  Uploaded invoice PDFs/photos are processed by the Google Gemini Vision API strictly for text and table extraction. It never does calculations or matching.
                </p>
              </div>

              <div className="space-y-1">
                <p className="font-semibold text-slate-800">100% Deterministic Engine</p>
                <p>
                  All currency accounting, TDS short-pay math, and payment allocation are executed by pure TypeScript algorithms with zero LLM hallucinations.
                </p>
              </div>

              <div className="rounded-lg bg-amber-50 p-2.5 text-amber-900 border border-amber-200 text-[11px] flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
                <span>
                  <strong>Advisory:</strong> Please use sample, synthetic, or redacted test data only on free-tier AI APIs.
                </span>
              </div>
            </div>

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="min-h-[40px] rounded-lg bg-slate-900 px-5 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition-colors"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
