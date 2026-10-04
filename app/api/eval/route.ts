import { NextResponse } from 'next/server';
import { runEvaluationBenchmark } from '@/lib/eval/evaluator';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function GET() {
  try {
    const report = runEvaluationBenchmark();
    return NextResponse.json(report);
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Evaluation failed' }, { status: 500 });
  }
}
