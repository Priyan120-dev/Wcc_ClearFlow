'use client';

import React, { useState } from 'react';
import { Shield, X, Lock, CheckCircle2 } from 'lucide-react';

interface PrivacyBannerProps {
  variant?: 'compact' | 'full';
  className?: string;
}

export function PrivacyBanner({ variant = 'compact', className = '' }: PrivacyBannerProps) {
  const [isOpen, setIsOpen] = useState(false);

  // Full variant: used on the Trust (/audit) page
  if (variant === 'full') {
    return (
      <div className={`rounded-lg border border-gray-200 bg-white p-4 text-xs text-gray-700 ${className}`}>
        <div className="flex items-start gap-3">
          <Shield className="h-4 w-4 stroke-[1.5] text-emerald-700 shrink-0 mt-0.5" />
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-sm text-gray-900">
                Data privacy and local execution policy
              </h3>
              <span className="rounded border border-gray-200 bg-gray-50 px-2 py-0.5 text-[10px] font-medium text-gray-600">
                DPDP and GDPR compliant
              </span>
            </div>
            <p className="text-gray-600 leading-relaxed">
              Bank statements, accounts, and transaction narrations are processed <strong>strictly locally</strong> on this server and are <strong>never</strong> transmitted to any external AI provider.
            </p>
            <p className="text-gray-600 leading-relaxed">
              Invoice documents are read by the Google Gemini API solely for optical character recognition. All arithmetic, matching algorithms, and balance calculations execute through deterministic TypeScript.
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Compact variant: plain button badge
  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className={`inline-flex h-9 items-center gap-1.5 rounded border border-gray-200 bg-white px-2.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors ${className}`}
        title="View data privacy policy"
      >
        <Shield className="h-4 w-4 stroke-[1.5] text-gray-500" />
        <span>Privacy</span>
      </button>

      {/* Popover / Dialog */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/30 backdrop-blur-sm">
          <div
            className="w-full max-w-md rounded-lg border border-gray-200 bg-white p-5 shadow-lg"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 stroke-[1.5] text-emerald-700" />
                <h3 className="text-sm font-semibold text-gray-900">Data Privacy & Invariants</h3>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="rounded p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                aria-label="Close dialog"
              >
                <X className="h-4 w-4 stroke-[1.5]" />
              </button>
            </div>

            <div className="mt-4 space-y-3 text-xs text-gray-600 leading-relaxed">
              <div>
                <p className="font-semibold text-gray-900">Local Bank Statement Processing</p>
                <p className="mt-0.5">
                  Bank transaction narrations and ledger records are processed strictly on this serverless runtime. They are never sent to external AI APIs.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">Document Vision OCR Only</p>
                <p className="mt-0.5">
                  Invoice files are read by Gemini Flash solely for field extraction. The model never computes arithmetic or makes reconciliation decisions.
                </p>
              </div>

              <div>
                <p className="font-semibold text-gray-900">Deterministic Accounting</p>
                <p className="mt-0.5">
                  All monetary calculations are performed in integer paise using transparent multi-pass algorithms with human sign-off on uncertain matches.
                </p>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="h-9 rounded bg-gray-900 px-4 text-xs font-medium text-white hover:bg-gray-800 transition-colors"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
