'use client';

import React, { useState } from 'react';
import { IndianCurrency } from '@/components/indian-currency';
import { PrivacyBanner } from '@/components/privacy-banner';
import sampleInvoices from '@/lib/seed/sample-invoices.json';
import {
  UploadCloud,
  FileText,
  FileSpreadsheet,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
  Save,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';

export default function UploadPage() {
  const [activeTab, setActiveTab] = useState<'invoices' | 'bank'>('invoices');
  const [uploading, setUploading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; isError?: boolean } | null>(null);

  // Split Screen Review State
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [editForm, setEditForm] = useState({
    number: '',
    customer_name: '',
    customer_phone: '',
    customer_email: '',
    issue_date: '',
    due_date: '',
    subtotal_paise: 0,
    gst_paise: 0,
    round_off_paise: 0,
    total_paise: 0,
  });

  // Load a sample fixture
  const handleLoadSample = async (sampleId: string) => {
    try {
      setUploading(true);
      setStatusMessage(null);
      const res = await fetch('/api/ingest/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sampleId }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({ text: `Loaded sample invoice ${data.invoice.number} successfully` });
        openEditScreen(data.invoice);
      } else {
        setStatusMessage({ text: data.error || 'Failed to load sample', isError: true });
      }
    } catch (e) {
      setStatusMessage({ text: 'Error connecting to server', isError: true });
    } finally {
      setUploading(false);
    }
  };

  const openEditScreen = (inv: any) => {
    setSelectedInvoice(inv);
    const subtotal = inv.raw_json?.subtotal_paise || inv.amount_paise - inv.gst_paise;
    setEditForm({
      number: inv.number,
      customer_name: inv.customer_name,
      customer_phone: inv.customer_phone || '',
      customer_email: inv.customer_email || '',
      issue_date: inv.issue_date,
      due_date: inv.due_date,
      subtotal_paise: subtotal,
      gst_paise: inv.gst_paise,
      round_off_paise: inv.round_off_paise || 0,
      total_paise: inv.amount_paise,
    });
  };

  // Save edits on right side of split screen
  const handleSaveInvoiceEdits = async () => {
    if (!selectedInvoice) return;
    try {
      setUploading(true);
      const res = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });
      const data = await res.json();
      if (res.ok) {
        setSelectedInvoice(data.invoice);
        setStatusMessage({
          text: data.invoice.needs_review
            ? 'Saved, but math check still shows discrepancy.'
            : 'Verified successfully! Math check passed.',
          isError: data.invoice.needs_review,
        });
      } else {
        setStatusMessage({ text: data.error, isError: true });
      }
    } catch (e) {
      setStatusMessage({ text: 'Failed to save edits', isError: true });
    } finally {
      setUploading(false);
    }
  };

  // Upload Bank CSV
  const handleUploadBankCsv = async (csvText: string, filename: string) => {
    try {
      setUploading(true);
      setStatusMessage(null);
      const res = await fetch('/api/ingest/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, filename }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          text: `Imported ${data.importedCount} transactions (${data.duplicateCount} duplicates skipped)`,
        });
      } else {
        setStatusMessage({ text: data.error, isError: true });
      }
    } catch (e) {
      setStatusMessage({ text: 'Error uploading bank CSV', isError: true });
    } finally {
      setUploading(false);
    }
  };

  // Sample HDFC CSV text
  const loadSampleHdfcCsv = () => {
    const sampleHdfc = `Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amt,Deposit Amt,Closing Balance
02/09/2026,UPI/4281901829/Payment for INV-2024-001/HDFC,4281901829,02/09/2026,,59000.00,159000.00
05/09/2026,NEFT-CR-AXIS0001-PATEL LOGISTICS-SALES REC,NEFT982182,05/09/2026,,141600.00,300600.00
10/09/2026,IMPS/P2A/SHARMA TECH/TDS 10PCT DEDUCTED,IMPS01928,10/09/2026,,53100.00,353700.00
12/09/2026,CHQ WDL-OFFICE RENT,CHQ00012,12/09/2026,25000.00,,328700.00
15/09/2026,INT.COLL-PERIODIC BANK INTEREST CR-2026-09-15,,15/09/2026,,1250.00,329950.00`;
    handleUploadBankCsv(sampleHdfc, 'hdfc_sept_sample.csv');
  };

  // Live Math Check for Split Screen Form
  const calcExpectedTotal =
    Number(editForm.subtotal_paise) + Number(editForm.gst_paise) + Number(editForm.round_off_paise);
  const mathDiff = Math.abs(calcExpectedTotal - Number(editForm.total_paise));
  const isMathValid = mathDiff <= 100; // <= 100 paise (₹1.00)

  return (
    <div className="space-y-6">
      <PrivacyBanner />

      {/* Header */}
      <div className="pb-2 border-b border-slate-200">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Ingestion & Document AI Extraction</h1>
        <p className="text-sm text-slate-500">
          Upload bank statements and invoices. Human approves any discrepancy before reconciliation.
        </p>
      </div>

      {statusMessage && (
        <div
          className={`rounded-lg p-3 text-xs font-semibold ${
            statusMessage.isError
              ? 'bg-rose-50 text-rose-800 border border-rose-200'
              : 'bg-emerald-50 text-emerald-800 border border-emerald-200'
          }`}
        >
          {statusMessage.text}
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex items-center border-b border-slate-200 space-x-6 text-sm">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`pb-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'invoices'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="h-4 w-4" />
          Invoice Documents (PDF / Photos)
        </button>

        <button
          onClick={() => setActiveTab('bank')}
          className={`pb-3 font-medium transition-colors border-b-2 flex items-center gap-1.5 ${
            activeTab === 'bank'
              ? 'border-emerald-600 text-emerald-700 font-semibold'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Bank Statement (CSV)
        </button>
      </div>

      {activeTab === 'invoices' ? (
        <div className="space-y-6">
          {/* Quick-load Sample Invoices Bar */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              Pre-Extracted Sample Invoice Fixtures (Offline Demo Ready)
            </div>
            <div className="flex flex-wrap gap-2">
              {sampleInvoices.map((s) => (
                <button
                  key={s.id}
                  onClick={() => handleLoadSample(s.id)}
                  disabled={uploading}
                  className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-all ${
                    s.needs_review
                      ? 'border-amber-300 bg-amber-50/50 text-amber-900 hover:bg-amber-100'
                      : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <FileText className="h-3.5 w-3.5 text-slate-400" />
                  <span>{s.number}</span>
                  <span className="text-[10px] text-slate-500 font-mono">
                    (<IndianCurrency paise={s.total_paise} />)
                  </span>
                  {s.needs_review ? (
                    <span className="rounded bg-amber-200 px-1 text-[9px] font-bold text-amber-800">
                      Corrupted Total
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-100 px-1 text-[9px] font-semibold text-emerald-800">
                      Sample
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Split Screen Review Panel */}
          {selectedInvoice && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-slate-900">
                    Split Extraction Review: {selectedInvoice.number}
                  </span>
                  <span className="rounded bg-slate-200 px-2 py-0.5 text-[10px] font-semibold text-slate-700">
                    cached sample
                  </span>
                  {selectedInvoice.needs_review && (
                    <span className="flex items-center gap-1 rounded bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                      <AlertTriangle className="h-3 w-3" />
                      Needs Review
                    </span>
                  )}
                </div>
                <button
                  onClick={handleSaveInvoiceEdits}
                  disabled={uploading}
                  className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700"
                >
                  <Save className="h-3.5 w-3.5" />
                  Save & Verify Math
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-slate-200">
                {/* Left Side: Document Preview Layout */}
                <div className="p-6 bg-slate-50/50 space-y-4">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Source Document Preview (Left)
                  </span>
                  <div className="rounded-lg border border-slate-300 bg-white p-6 shadow-sm font-sans space-y-4">
                    <div className="flex justify-between border-b pb-3">
                      <div>
                        <h2 className="font-bold text-base text-slate-900">TAX INVOICE</h2>
                        <p className="text-xs text-slate-500 font-mono">{editForm.number}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-xs text-slate-500">Invoice Date:</span>
                        <p className="text-xs font-semibold text-slate-800">{editForm.issue_date}</p>
                      </div>
                    </div>

                    <div className="text-xs space-y-1">
                      <span className="text-slate-500 uppercase font-semibold">Billed To:</span>
                      <p className="font-bold text-slate-900">{editForm.customer_name}</p>
                      <p className="text-slate-600">{editForm.customer_phone}</p>
                      <p className="text-slate-600">{editForm.customer_email}</p>
                    </div>

                    {/* Extracted Line Items */}
                    <div className="border-t pt-3">
                      <div className="text-xs font-semibold text-slate-500 uppercase mb-2">Line Items</div>
                      <div className="space-y-1 text-xs">
                        {(selectedInvoice.raw_json?.line_items || []).map((it: any, idx: number) => (
                          <div key={idx} className="flex justify-between">
                            <span>{it.description}</span>
                            <IndianCurrency paise={it.amount_paise} />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Breakdown */}
                    <div className="border-t pt-3 text-xs space-y-1">
                      <div className="flex justify-between">
                        <span>Subtotal:</span>
                        <IndianCurrency paise={editForm.subtotal_paise} />
                      </div>
                      <div className="flex justify-between">
                        <span>GST (18%):</span>
                        <IndianCurrency paise={editForm.gst_paise} />
                      </div>
                      <div className="flex justify-between font-bold text-sm border-t pt-1">
                        <span>Invoice Total:</span>
                        <IndianCurrency paise={editForm.total_paise} />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Editable Fields with Live Math Check */}
                <div className="p-6 space-y-4 bg-white">
                  <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                    Extracted Fields (Editable Right)
                  </span>

                  {/* Math Check Badge */}
                  <div
                    className={`rounded-lg p-3 text-xs flex items-start gap-2 ${
                      isMathValid
                        ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-50 text-amber-800 border border-amber-200'
                    }`}
                  >
                    {isMathValid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {isMathValid
                          ? 'Deterministic Math Check: Verified (<= ₹1.00 tolerance)'
                          : `Math Discrepancy Detected: Diff ₹${(mathDiff / 100).toFixed(2)}`}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5 font-mono">
                        Subtotal (₹{(editForm.subtotal_paise / 100).toFixed(2)}) + GST (₹
                        {(editForm.gst_paise / 100).toFixed(2)}) = ₹{(calcExpectedTotal / 100).toFixed(2)} vs Total (₹
                        {(editForm.total_paise / 100).toFixed(2)})
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Invoice Number</label>
                      <input
                        type="text"
                        value={editForm.number}
                        onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                        className="w-full rounded-md border border-slate-300 p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={editForm.customer_name}
                        onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                        className="w-full rounded-md border border-slate-300 p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Customer Phone</label>
                      <input
                        type="text"
                        value={editForm.customer_phone}
                        onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                        className="w-full rounded-md border border-slate-300 p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Customer Email</label>
                      <input
                        type="email"
                        value={editForm.customer_email}
                        onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                        className="w-full rounded-md border border-slate-300 p-2"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Issue Date</label>
                      <input
                        type="date"
                        value={editForm.issue_date}
                        onChange={(e) => setEditForm({ ...editForm, issue_date: e.target.value })}
                        className="w-full rounded-md border border-slate-300 p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Due Date</label>
                      <input
                        type="date"
                        value={editForm.due_date}
                        onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                        className="w-full rounded-md border border-slate-300 p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">Subtotal (Paise)</label>
                      <input
                        type="number"
                        value={editForm.subtotal_paise}
                        onChange={(e) =>
                          setEditForm({ ...editForm, subtotal_paise: parseInt(e.target.value) || 0 })
                        }
                        className="w-full rounded-md border border-slate-300 p-2 font-mono"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-medium mb-1">GST (Paise)</label>
                      <input
                        type="number"
                        value={editForm.gst_paise}
                        onChange={(e) => setEditForm({ ...editForm, gst_paise: parseInt(e.target.value) || 0 })}
                        className="w-full rounded-md border border-slate-300 p-2 font-mono"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-600 font-medium mb-1">Total Amount (Paise)</label>
                      <input
                        type="number"
                        value={editForm.total_paise}
                        onChange={(e) => setEditForm({ ...editForm, total_paise: parseInt(e.target.value) || 0 })}
                        className="w-full rounded-md border border-slate-300 p-2 font-mono font-bold text-emerald-800"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Bank Statement Ingest Tab */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-semibold text-slate-900">Upload Bank Statement CSV</h2>
            <p className="text-xs text-slate-500">
              Supports HDFC, ICICI standard CSV exports, or custom statements with automatic column mapping and UTR regex extraction.
            </p>

            <div className="flex gap-3">
              <button
                onClick={loadSampleHdfcCsv}
                disabled={uploading}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                Load Sample HDFC Statement CSV
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
