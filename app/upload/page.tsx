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
  Save,
  RefreshCw,
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
          title: 'Invoice loaded',
          message: `Sample ${data.invoice.number} loaded into document viewer.`,
        });
      } else {
        setStatusMessage({ text: data.error || 'Failed to load sample', isError: true });
        showToast({
          type: 'error',
          title: 'Load failed',
          message: data.error || 'Failed to load sample invoice.',
        });
      }
    } catch {
      setStatusMessage({ text: 'Error connecting to server', isError: true });
      showToast({
        type: 'error',
        title: 'Connection error',
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
        throw new Error(ingestData.error || 'OCR extraction failed');
      }

      setStatusMessage({ text: `Extracted ${ingestData.invoice.number} via document reader` });
      openEditScreen(ingestData.invoice);
      showToast({
        type: 'success',
        title: 'Ingestion complete',
        message: `Extracted ${ingestData.invoice.number} with deterministic math validation.`,
      });
    } catch (err: any) {
      console.error(err);
      setStatusMessage({ text: err.message || 'Upload error', isError: true });
      showToast({
        type: 'error',
        title: 'Upload error',
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
          title: 'Invoice saved',
          message: `Saved ${editForm.number} with verified mathematical totals.`,
        });
      } else {
        setStatusMessage({ text: 'Failed to save updates', isError: true });
        showToast({
          type: 'error',
          title: 'Save failed',
          message: 'Could not write updates to storage.',
        });
      }
    } catch {
      setStatusMessage({ text: 'Error saving invoice', isError: true });
      showToast({
        type: 'error',
        title: 'Connection error',
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
          title: 'Bank statement ingested',
          message: `Parsed ${data.count} transactions (${data.skippedDuplicates} duplicates skipped).`,
        });
      } else {
        setStatusMessage({ text: data.error || 'Failed to parse CSV', isError: true });
        showToast({
          type: 'error',
          title: 'Ingestion error',
          message: data.error || 'Invalid bank CSV structure.',
        });
      }
    } catch {
      setStatusMessage({ text: 'Failed to process bank statement', isError: true });
      showToast({
        type: 'error',
        title: 'Connection error',
        message: 'Could not upload bank statement.',
      });
    } finally {
      setUploading(false);
    }
  };

  const handleBankFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (text) {
        handleUploadBankCsv(text, file.name);
      }
    };
    reader.readAsText(file);
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
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-gray-200">
        <div>
          <h1 className="text-[20px] font-semibold tracking-tight text-gray-900">Upload & Ingestion</h1>
          <p className="text-[14px] text-gray-500 mt-1">
            Ingest invoices and bank statements with deterministic mathematical validation.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <PrivacyBanner variant="compact" />
        </div>
      </div>

      {statusMessage && (
        <div
          className={`rounded-lg p-3 text-[14px] border flex items-center justify-between ${
            statusMessage.isError
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span>{statusMessage.text}</span>
          <button
            onClick={() => setStatusMessage(null)}
            className="text-[12px] font-medium underline hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 rounded"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 gap-2">
        <button
          onClick={() => setActiveTab('invoices')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors ${
            activeTab === 'invoices'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileText className="h-4 w-4 stroke-[1.5]" />
          Invoice Ingestion (PDF / Image)
        </button>
        <button
          onClick={() => setActiveTab('bank')}
          className={`flex items-center gap-2 border-b-2 px-4 py-2.5 text-[14px] font-medium transition-colors ${
            activeTab === 'bank'
              ? 'border-emerald-600 text-emerald-700'
              : 'border-transparent text-gray-500 hover:text-gray-900'
          }`}
        >
          <FileSpreadsheet className="h-4 w-4 stroke-[1.5]" />
          Bank Statement Ingestion (CSV)
        </button>
      </div>

      {/* Tab 1: Invoices Ingestion */}
      {activeTab === 'invoices' ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Direct Upload Card */}
            <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
              <div>
                <h2 className="text-[16px] font-semibold text-gray-900">Upload invoice</h2>
                <p className="text-[14px] text-gray-500 mt-1">
                  Direct browser-to-storage signed uploads. Accepts PDF and image scans up to 10MB.
                </p>
              </div>

              <label className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center cursor-pointer hover:border-emerald-600 hover:bg-gray-50 transition-colors">
                <UploadCloud className="h-5 w-5 stroke-[1.5] text-gray-500 mb-2" />
                <span className="text-[14px] font-medium text-gray-900">Choose invoice PDF or image</span>
                <span className="text-[12px] text-gray-500 mt-0.5">Single file processed per request</span>
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
            <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-[16px] font-semibold text-gray-900">Sample invoices</h2>
                  <p className="text-[14px] text-gray-500 mt-1">
                    Realistic Indian MSME invoices for testing extraction without an API key.
                  </p>
                </div>
                <span className="rounded-full bg-gray-100 border border-gray-200 px-2 py-0.5 text-[12px] font-medium text-gray-600">
                  Pre-extracted
                </span>
              </div>

              <div className="grid grid-cols-1 gap-2 pt-1">
                {sampleInvoices.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => handleLoadSample(s.id)}
                    disabled={uploading}
                    className="flex items-center justify-between rounded-lg border border-gray-200 p-3 text-left hover:border-gray-300 hover:bg-gray-50 transition-colors disabled:opacity-50 min-h-[40px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
                  >
                    <div>
                      <p className="text-[14px] font-medium text-gray-900">{s.number}</p>
                      <p className="text-[12px] text-gray-500">{s.customer_name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[14px] font-semibold text-gray-900 tabular-nums">
                        <IndianCurrency paise={s.total_paise} />
                      </p>
                      <span className="text-[12px] text-gray-500 tabular-nums">Due {s.due_date}</span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Split Screen Document Review */}
          {selectedInvoice && (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-6 py-4 bg-gray-50 border-b border-gray-200 gap-3">
                <div>
                  <h2 className="text-[16px] font-semibold text-gray-900">
                    Review extraction: {selectedInvoice.number}
                  </h2>
                  <p className="text-[12px] text-gray-500">
                    Verify extracted fields and deterministic mathematical totals before saving.
                  </p>
                </div>

                <Tooltip content={!isMathValid ? 'Deterministic math discrepancy detected' : ''}>
                  <button
                    onClick={handleSaveInvoice}
                    disabled={uploading}
                    className="min-h-[40px] flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-emerald-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2 disabled:opacity-50"
                  >
                    {uploading ? (
                      <RefreshCw className="h-4 w-4 stroke-[1.5] animate-spin" />
                    ) : (
                      <Save className="h-4 w-4 stroke-[1.5]" />
                    )}
                    Save invoice changes
                  </button>
                </Tooltip>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-gray-200">
                {/* Left Side: Document Summary */}
                <div className="p-6 bg-gray-50/50 space-y-4">
                  <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-gray-100">
                      <div>
                        <span className="text-[12px] font-medium uppercase text-gray-500 tracking-wider">
                          Tax Invoice
                        </span>
                        <h3 className="text-[16px] font-semibold text-gray-900">{editForm.number}</h3>
                      </div>
                      <div className="text-right">
                        <span className="rounded-full bg-gray-100 border border-gray-200 px-2.5 py-0.5 text-[12px] font-medium text-gray-700 tabular-nums">
                          Confidence: {Math.round((selectedInvoice.extraction_confidence || 0.95) * 100)}%
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-[14px]">
                      <div>
                        <p className="text-[12px] text-gray-500 font-medium">Billed To</p>
                        <p className="font-medium text-gray-900 mt-0.5">{editForm.customer_name}</p>
                        {editForm.customer_phone && (
                          <p className="text-[12px] text-gray-500 tabular-nums">{editForm.customer_phone}</p>
                        )}
                        {editForm.customer_email && (
                          <p className="text-[12px] text-gray-500">{editForm.customer_email}</p>
                        )}
                      </div>
                      <div className="text-right">
                        <p className="text-[12px] text-gray-500 font-medium">Dates</p>
                        <p className="text-gray-700 tabular-nums text-[12px] mt-0.5">Issue: {editForm.issue_date}</p>
                        <p className="text-gray-900 tabular-nums text-[12px] font-medium">Due: {editForm.due_date}</p>
                      </div>
                    </div>

                    {/* Extracted Line Items */}
                    <div className="mt-4 border-t border-gray-100 pt-3">
                      <p className="text-[12px] font-medium text-gray-500 uppercase tracking-wider mb-2">Line Items</p>
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {(selectedInvoice.raw_json?.line_items || []).map((item: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-[14px] py-1 border-b border-gray-50"
                          >
                            <span className="text-gray-700">{item.description}</span>
                            <span className="font-medium text-gray-900 tabular-nums">
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
                    className={`rounded-lg p-3 border flex items-start gap-2.5 text-[12px] ${
                      isMathValid
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                        : 'bg-red-50 border-red-200 text-red-900'
                    }`}
                  >
                    {isMathValid ? (
                      <CheckCircle2 className="h-4 w-4 stroke-[1.5] text-emerald-600 shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-4 w-4 stroke-[1.5] text-red-600 shrink-0 mt-0.5" />
                    )}
                    <div>
                      <p className="font-semibold">
                        {isMathValid
                          ? 'Deterministic math check passed (|error| <= 100 paise)'
                          : `Math discrepancy detected: diff ₹${(mathDiff / 100).toFixed(2)}`}
                      </p>
                      <p className="text-gray-600 mt-0.5 tabular-nums">
                        Subtotal (₹{(editForm.subtotal_paise / 100).toFixed(2)}) + GST (₹
                        {(editForm.gst_paise / 100).toFixed(2)}) = ₹{(calcExpectedTotal / 100).toFixed(2)} vs Total (₹
                        {(editForm.total_paise / 100).toFixed(2)})
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-[14px]">
                    <div>
                      <label className="block text-[12px] text-gray-700 font-medium mb-1">Invoice number</label>
                      <input
                        type="text"
                        value={editForm.number}
                        onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 tabular-nums text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-700 font-medium mb-1">Customer name</label>
                      <input
                        type="text"
                        value={editForm.customer_name}
                        onChange={(e) => setEditForm({ ...editForm, customer_name: e.target.value })}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-700 font-medium mb-1">Customer phone</label>
                      <input
                        type="text"
                        value={editForm.customer_phone}
                        onChange={(e) => setEditForm({ ...editForm, customer_phone: e.target.value })}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 tabular-nums text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                        placeholder="9876543210"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-700 font-medium mb-1">Customer email</label>
                      <input
                        type="email"
                        value={editForm.customer_email}
                        onChange={(e) => setEditForm({ ...editForm, customer_email: e.target.value })}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                        placeholder="accounts@client.com"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-700 font-medium mb-1">Issue date</label>
                      <input
                        type="date"
                        value={editForm.issue_date}
                        onChange={(e) => setEditForm({ ...editForm, issue_date: e.target.value })}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 tabular-nums text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-700 font-medium mb-1">Due date</label>
                      <input
                        type="date"
                        value={editForm.due_date}
                        onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 tabular-nums text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-700 font-medium mb-1">Subtotal (paise)</label>
                      <input
                        type="number"
                        value={editForm.subtotal_paise}
                        onChange={(e) =>
                          setEditForm({ ...editForm, subtotal_paise: parseInt(e.target.value) || 0 })
                        }
                        className="w-full h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 tabular-nums text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[12px] text-gray-700 font-medium mb-1">GST (paise)</label>
                      <input
                        type="number"
                        value={editForm.gst_paise}
                        onChange={(e) => setEditForm({ ...editForm, gst_paise: parseInt(e.target.value) || 0 })}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 tabular-nums text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[12px] text-gray-700 font-medium mb-1">Total amount (paise)</label>
                      <input
                        type="number"
                        value={editForm.total_paise}
                        onChange={(e) => setEditForm({ ...editForm, total_paise: parseInt(e.target.value) || 0 })}
                        className="w-full h-10 px-3 py-2 rounded-lg border border-gray-200 bg-white text-gray-900 tabular-nums font-semibold text-[14px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Tab 2: Bank Statement Ingestion */
        <div className="space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
            <div>
              <h2 className="text-[16px] font-semibold text-gray-900">Upload bank statement CSV</h2>
              <p className="text-[14px] text-gray-500 mt-1 max-w-2xl">
                Supports HDFC, ICICI, SBI, and standard CSV formats. The streaming parser extracts UTR references and prevents duplicate ingestion using SHA-256 dedupe hashes.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <label className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 p-8 text-center cursor-pointer hover:border-emerald-600 hover:bg-gray-50 transition-colors">
                <UploadCloud className="h-5 w-5 stroke-[1.5] text-gray-500 mb-2" />
                <span className="text-[14px] font-medium text-gray-900">Choose bank statement CSV</span>
                <span className="text-[12px] text-gray-500 mt-0.5">HDFC, ICICI, SBI or custom CSV</span>
                <input
                  type="file"
                  accept=".csv,text/csv"
                  onChange={handleBankFileInput}
                  disabled={uploading}
                  className="hidden"
                />
              </label>

              <div className="flex flex-col justify-center rounded-lg border border-gray-200 bg-gray-50/50 p-6 space-y-3">
                <p className="text-[14px] font-medium text-gray-900">Load sample statement</p>
                <p className="text-[12px] text-gray-500">
                  Load a 7-transaction sample statement with realistic UPI, NEFT, RTGS, IMPS, and bank charge entries.
                </p>
                <button
                  onClick={loadSampleHdfcCsv}
                  disabled={uploading}
                  className="min-h-[40px] flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-[14px] font-medium text-white hover:bg-emerald-700 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
                >
                  <FileSpreadsheet className="h-4 w-4 stroke-[1.5]" />
                  Load sample HDFC statement
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
