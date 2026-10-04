import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateSessionId } from '@/lib/session';
import { db } from '@/lib/db/repo';
import { supabaseAdmin, isSupabaseAdminConfigured } from '@/lib/supabase/admin';
import { extractInvoiceWithGemini, isGeminiConfigured } from '@/lib/ai/gemini';
import sampleInvoices from '@/lib/seed/sample-invoices.json';
import { Invoice } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const res = new NextResponse();
    const userId = getOrCreateSessionId(req, res);

    const body = await req.json().catch(() => ({}));
    const { storagePath, sampleId, manualData } = body;

    let invoiceToSave: Invoice;

    // 1. Load from cached sample fixture (if selected by user)
    if (sampleId) {
      const sample = sampleInvoices.find((s) => s.id === sampleId);
      if (!sample) {
        return NextResponse.json({ error: 'Sample fixture not found' }, { status: 404 });
      }

      invoiceToSave = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        user_id: userId,
        number: sample.number,
        customer_name: sample.customer_name,
        customer_phone: sample.customer_phone,
        customer_email: sample.customer_email,
        amount_paise: sample.total_paise,
        gst_paise: sample.gst_paise,
        round_off_paise: sample.round_off_paise || 0,
        issue_date: sample.issue_date,
        due_date: sample.due_date,
        needs_review: sample.needs_review,
        file_path: `/samples/${sample.id}.pdf`,
        extraction_confidence: sample.confidence,
        raw_json: {
          ...sample,
          is_cached_sample: true,
          review_reason: sample.needs_review ? 'Corrupted line items total math check mismatch' : undefined,
        },
      };
    }
    // 2. Direct manual creation or fallback
    else if (manualData) {
      invoiceToSave = {
        id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
        user_id: userId,
        number: manualData.number || `INV-${Date.now()}`,
        customer_name: manualData.customer_name || 'Customer',
        customer_phone: manualData.customer_phone,
        customer_email: manualData.customer_email,
        amount_paise: Number(manualData.amount_paise) || 0,
        gst_paise: Number(manualData.gst_paise) || 0,
        round_off_paise: Number(manualData.round_off_paise) || 0,
        issue_date: manualData.issue_date || new Date().toISOString().split('T')[0],
        due_date: manualData.due_date || new Date().toISOString().split('T')[0],
        needs_review: false,
        file_path: storagePath || null,
        extraction_confidence: 1.0,
        raw_json: { manual: true },
      };
    }
    // 3. Live extraction via Google Gemini Vision
    else if (storagePath) {
      if (!isGeminiConfigured) {
        // Fallback when GEMINI_API_KEY is not configured: flag as needs_review for manual entry
        invoiceToSave = {
          id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
          user_id: userId,
          number: `INV-PENDING-${Date.now()}`,
          customer_name: 'Manual Verification Required',
          amount_paise: 0,
          gst_paise: 0,
          round_off_paise: 0,
          issue_date: new Date().toISOString().split('T')[0],
          due_date: new Date().toISOString().split('T')[0],
          needs_review: true,
          file_path: storagePath,
          extraction_confidence: 0,
          raw_json: { error: 'Gemini API key not configured; requires manual field entry' },
        };
      } else {
        try {
          // Download file from private Supabase Storage
          if (!isSupabaseAdminConfigured || !supabaseAdmin) {
            throw new Error('Supabase Storage is not configured for document retrieval');
          }

          const { data: fileBlob, error: downloadError } = await supabaseAdmin.storage
            .from('invoices')
            .download(storagePath);

          if (downloadError || !fileBlob) {
            throw new Error(`Failed to download invoice from storage: ${downloadError?.message}`);
          }

          const buffer = Buffer.from(await fileBlob.arrayBuffer());
          const base64 = buffer.toString('base64');
          const mimeType = storagePath.toLowerCase().endsWith('.png')
            ? 'image/png'
            : storagePath.toLowerCase().endsWith('.jpg') || storagePath.toLowerCase().endsWith('.jpeg')
            ? 'image/jpeg'
            : 'application/pdf';

          const extracted = await extractInvoiceWithGemini(base64, mimeType);

          invoiceToSave = {
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            user_id: userId,
            number: extracted.number,
            customer_name: extracted.customer_name,
            customer_phone: extracted.customer_phone,
            customer_email: extracted.customer_email,
            amount_paise: extracted.total_paise,
            gst_paise: extracted.gst_paise,
            round_off_paise: extracted.round_off_paise,
            issue_date: extracted.issue_date,
            due_date: extracted.due_date,
            needs_review: extracted.needs_review,
            file_path: storagePath,
            extraction_confidence: extracted.confidence,
            raw_json: {
              ...extracted,
              review_reason: extracted.review_reason,
            },
          };
        } catch (extractError: any) {
          // Rule: On provider failure, mark needs_review with a clear message and route to manual edit
          invoiceToSave = {
            id: `inv-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
            user_id: userId,
            number: `INV-REVIEW-${Date.now()}`,
            customer_name: 'Unverified Invoice',
            amount_paise: 0,
            gst_paise: 0,
            round_off_paise: 0,
            issue_date: new Date().toISOString().split('T')[0],
            due_date: new Date().toISOString().split('T')[0],
            needs_review: true,
            file_path: storagePath,
            extraction_confidence: 0,
            raw_json: { error: extractError.message || 'AI Extraction failed; please enter fields manually' },
          };
        }
      }
    } else {
      return NextResponse.json({ error: 'Must provide storagePath, sampleId, or manualData' }, { status: 400 });
    }

    await db.saveInvoices(userId, [invoiceToSave]);

    await db.addAuditLog(userId, {
      actor: 'user',
      action: 'INVOICE_INGESTED',
      entity: 'invoices',
      entity_id: invoiceToSave.id,
      after: {
        number: invoiceToSave.number,
        customer_name: invoiceToSave.customer_name,
        amount_paise: invoiceToSave.amount_paise,
        needs_review: invoiceToSave.needs_review,
      },
    });

    return NextResponse.json({ success: true, invoice: invoiceToSave }, { headers: res.headers });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Failed to ingest invoice' }, { status: 500 });
  }
}
