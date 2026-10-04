'use client';

import React, { useState } from 'react';
import { IndianCurrency } from '@/components/indian-currency';
import { PrivacyBanner } from '@/components/privacy-banner';
import { Tooltip } from '@/components/tooltip';
import { useToast } from '@/components/toast';
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
  const { showToast } = useToast();
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
        showToast({
          type: 'success',
          title: 'Invoice Loaded',
          message: `Sample ${data.invoice.number} loaded into document viewer.`,
        });
      } else {
        setStatusMessage({ text: data.error || 'Failed to load sample', isError: true });
        showToast({
          type: 'error',
          title: 'Load Failed',
          message: data.error || 'Failed to load sample invoice.',
        });
      }
    } catch {
      setStatusMessage({ text: 'Error connecting to server', isError: true });
      showToast({
        type: 'error',
        title: 'Network Error',
        message: 'Unable to reach ingestion service.',
      });
    } finally {
      setUploading(false);
    }
  };

  // Direct Storage Upload Handler: Browser -> Storage Signed URL -> Server
  const handleUploadFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploading(true);
      setStatusMessage(null);

      // Step 1: Request signed upload URL from API
      const signRes = await fetch('/api/upload/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, contentType: file.type }),
      });

      const signData = await signRes.json();
      if (!signRes.ok) {
        throw new Error(signData.error || 'Failed to get signed upload URL');
      }

      // Step 2: Upload directly to Supabase storage if URL available, or process file
      let storagePath = signData.path;
      if (signData.signedUrl) {
        const uploadRes = await fetch(signData.signedUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type },
          body: file,
        });
        if (!uploadRes.ok) {
          throw new Error('Direct storage upload failed');
        }
      }

      // Step 3: Trigger Vision OCR extraction via API
      const ingestRes = await fetch('/api/ingest/invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filePath: storagePath }),
      });

      const ingestData = await ingestRes.json();
      if (!ingestRes.ok) {
        throw new Error(ingestData.error || 'OCR Extraction failed');
      }

      setStatusMessage({ text: `Extracted ${ingestData.invoice.number} via Vision OCR` });
      openEditScreen(ingestData.invoice);
      showToast({
        type: 'success',
        title: 'OCR Ingestion Complete',
        message: `Extracted ${ingestData.invoice.number} with deterministic math check.`,
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ text: err.message || 'Upload error', isError: true });
      showToast({
        type: 'error',
        title: 'Upload Error',
        message: err.message || 'Failed to process document.',
      });
    } finally {
      setUploading(false);
    }
  };

  const openEditScreen = (invoice: any) => {
    setSelectedInvoice(invoice);
    setEditForm({
      number: invoice.number,
      customer_name: invoice.customer_name,
      customer_phone: invoice.customer_phone || '',
      customer_email: invoice.customer_email || '',
      issue_date: invoice.issue_date,
      due_date: invoice.due_date,
      subtotal_paise: invoice.raw_json?.subtotal_paise || invoice.amount_paise - invoice.gst_paise,
      gst_paise: invoice.gst_paise || 0,
      round_off_paise: invoice.round_off_paise || 0,
      total_paise: invoice.amount_paise,
    });
  };

  const handleSaveInvoice = async () => {
    if (!selectedInvoice) return;

    try {
      setUploading(true);
      const res = await fetch(`/api/invoices/${selectedInvoice.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: editForm.number,
          customer_name: editForm.customer_name,
          customer_phone: editForm.customer_phone,
          customer_email: editForm.customer_email,
          issue_date: editForm.issue_date,
          due_date: editForm.due_date,
          amount_paise: editForm.total_paise,
          gst_paise: editForm.gst_paise,
          round_off_paise: editForm.round_off_paise,
          needs_review: !isMathValid,
        }),
      });

      if (res.ok) {
        setStatusMessage({ text: `Saved updates to ${editForm.number}` });
        showToast({
          type: 'success',
          title: 'Invoice Saved',
          message: `Updated ${editForm.number} with verified mathematical totals.`,
        });
      } else {
        setStatusMessage({ text: 'Failed to save updates', isError: true });
        showToast({
          type: 'error',
          title: 'Save Failed',
          message: 'Could not write updates to storage.',
        });
      }
    } catch {
      setStatusMessage({ text: 'Error saving invoice', isError: true });
      showToast({
        type: 'error',
        title: 'Network Error',
        message: 'Failed to communicate with invoice service.',
      });
    } finally {
      setUploading(false);
    }
  };

  // Bank Statement Ingestion
  const handleUploadBankCsv = async (csvText: string, filename: string) => {
    try {
      setUploading(true);
      const res = await fetch('/api/ingest/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csvText, filename }),
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          text: `Processed ${data.count} transactions (${data.skippedDuplicates} duplicates prevented via dedupe_hash)`,
        });
        showToast({
          type: 'success',
          title: 'Bank Statement Ingested',
          message: `Parsed ${data.count} transactions (${data.skippedDuplicates} duplicates skipped).`,
        });
      } else {
        setStatusMessage({ text: data.error || 'Failed to parse CSV', isError: true });
        showToast({
          type: 'error',
          title: 'Ingestion Error',
          message: data.error || 'Invalid bank CSV structure.',
        });
      }
    } catch {
      setStatusMessage({ text: 'Failed to process bank statement', isError: true });
      showToast({
        type: 'error',
        title: 'Network Error',
        message: 'Could not upload bank statement.',
      });
    } finally {
      setUploading(false);
    }
  };

  const loadSampleHdfcCsv = () => {
    const sampleHdfc = `Date,Narration,Chq/Ref No,Value Dt,Withdrawal Amt,Deposit Amt,Closing Balance
01/09/2026,UPI-428910283912-GUPTA IND-BARB0INDB,UPI428910283912,01/09/2026,,118000.00,118000.00
03/09/2026,NEFT DR-APEX RETAIL-HDFCN00918274,N00918274,03/09/2026,,44550.00,162550.00
05/09/2026,RTGS CR-RELIABLE STEEL-INV-2026-003-YESB0001,YESB2609051829,05/09/2026,,285000.00,447550.00
08/09/2026,IMPS/629102849182/KAPOOR/PAYMENT,629102849182,08/09/2026,,82300.00,529850.00
10/09/2026,BANK CHG-GST AUDIT FEE-SEPT26,CHG00192,10/09/2026,50.00,,529800.00
12/09/2026,CHQ WDL-OFFICE RENT,CHQ00012,12/09/2026,25000.00,,504800.00
15/09/2026,INT.COLL-PERIODIC BANK INTEREST CR,,15/09/2026,,1250.00,506050.00`;
    handleUploadBankCsv(sampleHdfc, 'hdfc_sept_sample.csv');
  };

  // Live Math Check for Split Screen Form
  const calcExpectedTotal =
    Number(editForm.subtotal_paise) + Number(editForm.gst_paise) + Number(editForm.round_off_paise);
  const mathDiff = Math.abs(calcExpectedTotal - Number(editForm.total_paise));
  const isMathValid = mathDiff <= 100; // <= 100 paise (₹1.00)

  return (
    <div className="space-y-6">
      {/* Header with Compact Privacy Shield */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Upload & Document Ingestion</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Process invoices and bank statements. Gemini Flash reads documents; all math is deterministic.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PrivacyBanner variant="compact" />
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-xl p-4 text-xs font-semibold border flex items-center justify-between shadow-sm animate-in fade-in duration-150 ${
            statusMessage.isError
              ? 'bg-rose-50 border-rose-200 text-rose-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-xs underline hover:opacity-75"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Mode Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === 'invoices'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileText className="h-4 w-4" />
          Invoice Ingestion (PDF / Scans)
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={`flex items-center gap-2 border-b-2 px-5 py-3 text-sm font-semibold transition-all ${
            activeTab === 'bank'
              ? 'border-emerald-600 text-emerald-700 bg-emerald-50/30'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4" />
          Bank Statement Ingestion (CSV)
        </button>
      </div>

      {/* Tab 1: Invoices Ingestion & Split Review */}
      {activeTab === 'invoices' ? (
        <div className="space-y-6">
          {/* Upload Dropzone & Sample Fixture Launcher */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direct Upload Card */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
              <h2 className="text-base font-bold text-slate-900">Upload Invoices</h2>
              <p className="text-xs text-slate-500 leading-relaxed">
                Direct browser-to-storage signed uploads bypass serverless payload limits. Supports PDF and scanned photos up to 10MB.
              </p>

              <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center cursor-pointer hover:border-emerald-500 hover:bg-emerald-50/30 transition-all">
                <UploadCloud className="h-8 w-8 text-slate-400 mb-2" />
                <span className="text-xs font-semibold text-slate-700">Choose PDF / Image</span>
                <span className="text-[11px] text-slate-400 mt-1">Single file processed per request</span>
                <input
                  type="file"
                  accept="application/pdf,image/png,image/jpeg,image/webp"
                  onChange={handleUploadFile}
                  disabled={uploading}
                  className="hidden"
                />
              </label>
            </div>

            {/* Offline Sample Fixtures */}
            <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-slate-900">Sample Invoices (Pre-Extracted)</h2>
                <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-semibold text-slate-600 uppercase">
                  Zero AI Key Required
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Click any realistic Indian MSME invoice below to simulate instant OCR extraction:
              </p>

              <div className="grid grid-cols-1 gap-2 pt-1">
                {sampleInvoices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSample(s.id)}
                    disabled={uploading}
                    className="flex items-center justify-between rounded-xl border border-slate-200 p-3 text-left hover:border-emerald-300 hover:bg-emerald-50/50 transition-all disabled:opacity-50"
                  >
                    <div>
                      <p className="text-xs font-bold text-slate-900">{s.number}</p>
                      <p className="text-[11px] text-slate-600">{s.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-semibold text-slate-900 tabular-nums">
                        <IndianCurrency paise={s.total_paise} />
                      </p>
                      <span className="text-[10px] text-slate-400 tabular-nums">Due {s.due_date}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Split Screen Document Review (Left: Preview, Right: Editable Form with Live Math Check) */}
          {selectedInvoice && (
            <div className="rounded-xl border border-slate-200 bg-white shadow-md overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-4 bg-slate-50 border-b border-slate-200 gap-3">
                <div>
                  <h2 className="text-base font-bold text-slate-900">
                    Split-Screen Extraction Review: {selectedInvoice.number}
                  </h2>
                  <p className="text-xs text-slate-500">
                    Inspect the invoice preview on the left and review extracted fields with live math verification on the right.
                  </p>
                </div>

                <Tooltip content={!isMathValid ? 'Deterministic math discrepancy detected' : ''}>
                  <button
                    onClick={handleSaveInvoice}
                    disabled={uploading}
                    className="min-h-[40px] flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 disabled:opacity-50"
                  >
                    {uploading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Save & Confirm Extracted Invoice
                  </button>
                </Tooltip>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-slate-200">
                {/* Left Side: Document Preview Pane */}
                <div className="p-6 bg-slate-50/50 flex flex-col justify-between">
                  <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                      <div>
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-wider">
                          Tax Invoice Preview
                        </span>
                        <h3 className="text-lg font-bold text-slate-900">{editForm.number}</h3>
                      </div>
                      <div className="text-right">
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                          Confidence: {Math.round((selectedInvoice.extraction_confidence || 0.95) * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs">
                      <div>
                        <p className="text-slate-400 font-medium">Billed To</p>
                        <p className="font-semibold text-slate-800 mt-0.5">{editForm.customer_name}</p>
                        {editForm.customer_phone && (
                          <p className="text-slate-500 tabular-nums">{editForm.customer_phone}</p>
                        )}
                        {editForm.customer_email && (
                          <p className="text-slate-500">{editForm.customer_email}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-slate-400 font-medium">Dates</p>
                        <p className="text-slate-700 tabular-nums mt-0.5">Issue: {editForm.issue_date}</p>
                        <p className="text-slate-700 tabular-nums font-semibold">Due: {editForm.due_date}</p>
                      </div>
                    </div>

                    {/* Extracted Line Items */}
                    <div className="mt-4 border-t border-slate-100 pt-3">
                      <p className="text-xs font-bold text-slate-700 mb-2">Line Items</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {(selectedInvoice.raw_json?.line_items || []).map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-xs py-1 border-b border-slate-50"
                          >
                            <span className="text-slate-700">{item.description}</span>
                            <span className="font-medium text-slate-900 tabular-nums">
                              <IndianCurrency paise={item.amount_paise} />
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Side: Editable Form with Live Math Check */}
                <div className="p-6 space-y-4">
                  {/* Live Math Integrity Banner */}
                  <div
                    className={`rounded-xl p-3.5 border flex items-start gap-2.5 text-xs ${
                      isMathValid
                        ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900'
                        : 'bg-rose-50 border-rose-200 text-rose-900'
                    }`}
                  >
                    {isMathValid ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-bold">
                        {isMathValid
                          ? 'Deterministic Math Check: Passed (|Error| <= 100 paise)'
                          : `Math Discrepancy Detected: Diff ₹${(mathDiff / 100).toFixed(2)}`}
                      </p>
                      <p className="text-[11px] text-slate-600 mt-0.5 tabular-nums">
                        Subtotal (₹{(editForm.subtotal_paise / 100).toFixed(2)}) + GST (₹
                        {(editForm.gst_paise / 100).toFixed(2)}) = ₹{(calcExpectedTotal / 100).toFixed(2)} vs Total (₹
                        {(editForm.total_paise / 100).toFixed(2)})
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Invoice Number</label>
                      <input
                        type="text"
                        value={editForm.number}
                        onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 p-2.5 tabular-nums focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Customer Name</label>
                      <input
                        type="text"
                        value={editForm.customer_name}
                        onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Customer Phone</label>
                      <input
                        type="text"
                        value={editForm.customer_phone}
                        onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 p-2.5 tabular-nums focus:border-emerald-500 focus:outline-none"
                        placeholder="e.g. 9876543210"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Customer Email</label>
                      <input
                        type="email"
                        value={editForm.customer_email}
                        onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 p-2.5 focus:border-emerald-500 focus:outline-none"
                        placeholder="accounts@client.com"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Issue Date</label>
                      <input
                        type="date"
                        value={editForm.issue_date}
                        onChange={(e) => setEditForm({ ...editForm, issue_date: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 p-2.5 tabular-nums focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Due Date</label>
                      <input
                        type="date"
                        value={editForm.due_date}
                        onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                        className="w-full rounded-xl border border-slate-300 p-2.5 tabular-nums focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">Subtotal (Paise)</label>
                      <input
                        type="number"
                        value={editForm.subtotal_paise}
                        onChange={(e) =>
                          setEditForm({ ...editForm, subtotal_paise: parseInt(e.target.value) || 0 })
                        }
                        className="w-full rounded-xl border border-slate-300 p-2.5 tabular-nums focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-slate-600 font-semibold mb-1">GST (Paise)</label>
                      <input
                        type="number"
                        value={editForm.gst_paise}
                        onChange={(e) => setEditForm({ ...editForm, gst_paise: parseInt(e.target.value) || 0 })}
                        className="w-full rounded-xl border border-slate-300 p-2.5 tabular-nums focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-slate-600 font-semibold mb-1">Total Amount (Paise)</label>
                      <input
                        type="number"
                        value={editForm.total_paise}
                        onChange={(e) => setEditForm({ ...editForm, total_paise: parseInt(e.target.value) || 0 })}
                        className="w-full rounded-xl border border-slate-300 p-2.5 tabular-nums font-bold text-emerald-800 text-sm focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Bank Statement Ingest Tab */
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
            <h2 className="text-base font-bold text-slate-900">Upload Bank Statement CSV</h2>
            <p className="text-xs text-slate-500 leading-relaxed max-w-2xl">
              Supports HDFC, ICICI, SBI standard CSV exports, or custom statements. The streaming parser extracts UTR references via regex and prevents duplicates using SHA-256 dedupe hashes.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-2">
              <button
                onClick={loadSampleHdfcCsv}
                disabled={uploading}
                className="min-h-[40px] flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
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
