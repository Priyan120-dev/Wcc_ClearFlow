'use client';

import React, { useEffect, useState } from 'react';
import { PrivacyBanner } from '@/components/privacy-banner';
import {
  ShieldAlert,
  ShieldCheck,
  CheckCircle2,
  TrendingUp,
  Brain,
  Zap,
  Target,
  BarChart2,
  Layers,
  Sparkles,
} from 'lucide-react';

export default function EvaluationPage() {
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/eval')
      .then((res) => res.json())
      .then((json) => setReport(json))
      .catch((e) => console.error(e))
      .finally(() => setLoading(false));
  }, []);

  const d = report?.datasetB || {};
  const adv = report?.adversarial || {};
  const alias = report?.aliasLearningEffect || {};
  const ext = report?.extractionQuality || {};
  const gen = report?.generalization || {};

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Accuracy & Scientific Benchmarks
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Evaluated against out-of-sample Dataset B (60 invoices, 80 bank txns) and 15 adversarial edge cases.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <PrivacyBanner variant="compact" />
        </div>
      </div>

      {/* Skeletons while loading */}
      {loading && (
        <div className="space-y-4 animate-pulse">
          <div className="h-32 rounded-xl bg-slate-200" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-40 rounded-xl bg-slate-200" />
            <div className="h-40 rounded-xl bg-slate-200" />
          </div>
        </div>
      )}

      {!loading && (
        <>
          {/* Hero Safety Metric: Wrong Auto-Confirms Count */}
          <div className="rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-teal-50/50 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="rounded-xl bg-emerald-600 p-2.5 text-white shadow-sm shrink-0">
                  <ShieldCheck className="h-6 w-6" />
                </div>
                <div>
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider">
                    Critical Safety Invariant
                  </span>
                  <h2 className="text-xl font-bold text-slate-900 mt-0.5">Wrong Auto-Confirms Count</h2>
                  <p className="text-xs text-slate-600 max-w-xl mt-1 leading-relaxed">
                    Payments automatically confirmed that did not match ground truth. The system enforces strict
                    ambiguity guards and identity thresholds to guarantee zero false auto-reconciliations.
                  </p>
                </div>
              </div>

              <div className="text-center sm:text-right">
                <div className="text-4xl font-extrabold text-emerald-700 tracking-tight tabular-nums">
                  {d.wrongAutoConfirmsCount ?? 0}
                </div>
                <span className="inline-block mt-1 rounded-full bg-emerald-100 border border-emerald-200 px-3 py-0.5 text-xs font-semibold text-emerald-800">
                  Target: Exactly 0
                </span>
              </div>
            </div>
          </div>

          {/* Tier Performance Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* High-Confidence Tier */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  High-Confidence Tier (Score &ge; 0.90)
                </span>
                <span className="text-xs text-slate-500 tabular-nums font-semibold">{d.highConfidenceTier?.count || 0} matches</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl bg-emerald-50/70 p-4 text-center border border-emerald-100">
                  <span className="text-xs text-emerald-800 font-semibold block">Precision</span>
                  <span className="text-2xl font-bold text-emerald-950 tabular-nums">
                    {d.highConfidenceTier?.precision}%
                  </span>
                  <span className="text-[10px] text-emerald-700 block mt-0.5">Target: &ge; 95%</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center border border-slate-100">
                  <span className="text-xs text-slate-600 font-semibold block">Recall</span>
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    {d.highConfidenceTier?.recall}%
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Touchless coverage</span>
                </div>
              </div>
            </div>

            {/* Review Tier */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                  <Layers className="h-4 w-4 text-amber-600" />
                  Review Queue Tier (Score &lt; 0.90)
                </span>
                <span className="text-xs text-slate-500 tabular-nums font-semibold">{d.reviewTier?.count || 0} matches</span>
              </div>
              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="rounded-xl bg-amber-50/70 p-4 text-center border border-amber-100">
                  <span className="text-xs text-amber-800 font-semibold block">Precision</span>
                  <span className="text-2xl font-bold text-amber-950 tabular-nums">
                    {d.reviewTier?.precision}%
                  </span>
                  <span className="text-[10px] text-amber-700 block mt-0.5">Target: &ge; 80%</span>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center border border-slate-100">
                  <span className="text-xs text-slate-600 font-semibold block">Recall</span>
                  <span className="text-2xl font-bold text-slate-900 tabular-nums">
                    {d.reviewTier?.recall}%
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">Human approved</span>
                </div>
              </div>
            </div>
          </div>

          {/* Detailed Pass Metrics Grid */}
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wide">
              Per-Pass Algorithm Precision on Dataset B
            </h3>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold block">Pass 1: Ref Match</span>
                <span className="text-xl font-bold text-emerald-700 tabular-nums">{d.passMetrics?.pass1RefPrecision}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">UTR / Narration</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold block">Pass 2: Composite</span>
                <span className="text-xl font-bold text-emerald-700 tabular-nums">{d.passMetrics?.pass2CompositePrecision}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Amount + Date + Name</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold block">Pass 2b: TDS Short-Pay</span>
                <span className="text-xl font-bold text-emerald-700 tabular-nums">{d.passMetrics?.pass2bTdsPrecision}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">1%, 2%, 5%, 10% Dual Base</span>
              </div>
              <div className="rounded-xl bg-slate-50 p-3.5 border border-slate-100">
                <span className="text-[11px] text-slate-500 font-bold block">Pass 3: Combined</span>
                <span className="text-xl font-bold text-emerald-700 tabular-nums">{d.passMetrics?.pass3CombinedPrecision}%</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Subset-Sum Splits</span>
              </div>
            </div>
          </div>

          {/* Adversarial & Generalization Security Matrix */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Adversarial Traps Resistance */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-5 w-5 text-indigo-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase">Adversarial Resistance</h4>
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {adv.trapsPassed} / {adv.trapsTested}
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Tested against 15 hostile scenarios (name collisions, forged UTRs, reverse charges). False match rate: <strong>{adv.falseMatchRate}%</strong>.
              </p>
            </div>

            {/* Generalization Gap A vs B */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase">Generalization Gap</h4>
              </div>
              <div className="text-2xl font-bold text-slate-900 tabular-nums">
                {gen.generalizationGap}%
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Difference in precision between calibration Dataset A and out-of-sample Dataset B. Demonstrates zero overfitting.
              </p>
            </div>

            {/* Payer Alias Learning Shrinkage */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-2">
              <div className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-purple-600" />
                <h4 className="text-xs font-bold text-slate-900 uppercase">Alias Learning Loop</h4>
              </div>
              <div className="text-2xl font-bold text-purple-900 tabular-nums">
                {alias.reviewQueueReduction}%
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                Queue shrinkage after confirming customer aliases. Future transfers from the same payer match touchlessly.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
