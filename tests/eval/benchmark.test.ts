import { describe, it, expect } from 'vitest';
import { runEvaluationBenchmark } from '@/lib/eval/evaluator';

describe('ClearFlow Scientific Evaluation Benchmark', () => {
  const report = runEvaluationBenchmark();

  it('CRITICAL TARGET: Zero wrong auto-confirms on out-of-sample Dataset B', () => {
    expect(report.datasetB.wrongAutoConfirmsCount).toBe(0);
  });

  it('High-confidence tier achieves >= 95% precision', () => {
    expect(report.datasetB.highConfidenceTier.precision).toBeGreaterThanOrEqual(95.0);
  });

  it('Adversarial robustness: 0% false matches on non-invoice credits & flipped debits', () => {
    expect(report.adversarial.falseMatchRatePct).toBe(0.0);
  });

  it('Deterministic math check: 100% catch rate on corrupted invoice totals', () => {
    expect(report.extractionQuality.mathCheckCatchRatePct).toBe(100.0);
    expect(report.extractionQuality.corruptedTotalsCaught).toBeGreaterThan(0);
  });

  it('Generalization: A-vs-B metric gap is tight (< 15%)', () => {
    expect(report.generalization.aVsBMetricGapPct).toBeLessThan(15.0);
  });

  it('Engine performance: executes within 1000ms on 140 documents (sub-second)', () => {
    expect(report.datasetB.engineLatencyMs).toBeLessThan(1000.0);
  });
});
