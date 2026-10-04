import React from 'react';
import { ShieldCheck, AlertCircle } from 'lucide-react';

export function PrivacyBanner() {
  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-3.5 text-xs text-slate-600 mb-6">
      <div className="flex items-start gap-2.5">
        <ShieldCheck className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-slate-800">
            Privacy & AI Execution Notice
          </p>
          <p>
            Bank statements and transaction narrations are processed <strong>strictly locally</strong> on this server and are <strong>never</strong> transmitted to external AI providers.
            Invoice files are processed via the Google Gemini API as-is.
          </p>
          <p className="flex items-center gap-1.5 text-amber-700 font-medium pt-0.5">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            Advisory: Please use sample, synthetic, or redacted test data only on free-tier AI APIs.
          </p>
        </div>
      </div>
    </div>
  );
}
