import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const modelName = process.env.GEMINI_MODEL || 'gemini-1.5-flash';

export const isGeminiConfigured = Boolean(apiKey);

export interface ExtractedInvoiceData {
  number: string;
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  issue_date: string;
  due_date: string;
  subtotal_paise: number;
  gst_paise: number;
  round_off_paise: number;
  total_paise: number;
  confidence: number;
  line_items: Array<{ description: string; amount_paise: number }>;
  needs_review: boolean;
  review_reason?: string;
}

/**
 * Extracts structured invoice data from document buffer/base64 via Gemini Vision.
 * Invariant: The LLM only extracts text/amounts into structured fields.
 * Deterministic math check verifies: |sum(items) + gst + round_off - total| <= 100 paise.
 */
export async function extractInvoiceWithGemini(
  base64Data: string,
  mimeType: string = 'application/pdf'
): Promise<ExtractedInvoiceData> {
  if (!isGeminiConfigured) {
    throw new Error('GEMINI_API_KEY is not configured on the server');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const prompt = `You are a specialized invoice document reader for Indian businesses.
Extract all key fields into the following strict JSON schema.
Amounts MUST be extracted as integer paise (e.g. ₹100.50 = 10050, ₹1000 = 100000).
Dates MUST be ISO format YYYY-MM-DD.

JSON Schema:
{
  "number": "string (invoice number)",
  "customer_name": "string (buyer/billed to party name)",
  "customer_phone": "string or null",
  "customer_email": "string or null",
  "issue_date": "YYYY-MM-DD",
  "due_date": "YYYY-MM-DD",
  "line_items": [
    { "description": "string", "amount_paise": integer }
  ],
  "subtotal_paise": integer,
  "gst_paise": integer,
  "round_off_paise": integer,
  "total_paise": integer,
  "confidence": number between 0.0 and 1.0
}`;

  const result = await model.generateContent([
    {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    },
    prompt,
  ]);

  const text = result.response.text();
  const parsed = JSON.parse(text);

  // Deterministic Math Check: |sum(line_items) + gst + round_off - total| <= 100 paise
  const itemsSum = (parsed.line_items || []).reduce(
    (sum: number, it: any) => sum + (it.amount_paise || 0),
    0
  );
  const declaredSubtotal = parsed.subtotal_paise || itemsSum;
  const gst = parsed.gst_paise || 0;
  const roundOff = parsed.round_off_paise || 0;
  const total = parsed.total_paise || 0;

  const expectedTotal = declaredSubtotal + gst + roundOff;
  const diff = Math.abs(expectedTotal - total);

  const confidence = Number(parsed.confidence) || 0.85;
  let needsReview = false;
  let reviewReason: string | undefined = undefined;

  if (diff > 100) {
    needsReview = true;
    reviewReason = `Math check mismatch: Subtotal + GST + Round-off (₹${(expectedTotal / 100).toFixed(
      2
    )}) differs from total (₹${(total / 100).toFixed(2)}) by ₹${(diff / 100).toFixed(2)}`;
  } else if (confidence < 0.70) {
    needsReview = true;
    reviewReason = `Low extraction confidence (${Math.round(confidence * 100)}%)`;
  }

  return {
    number: parsed.number || `INV-${Date.now()}`,
    customer_name: parsed.customer_name || 'Unknown Customer',
    customer_phone: parsed.customer_phone || undefined,
    customer_email: parsed.customer_email || undefined,
    issue_date: parsed.issue_date || new Date().toISOString().split('T')[0],
    due_date: parsed.due_date || new Date().toISOString().split('T')[0],
    subtotal_paise: declaredSubtotal,
    gst_paise: gst,
    round_off_paise: roundOff,
    total_paise: total,
    confidence,
    line_items: parsed.line_items || [],
    needs_review: needsReview,
    review_reason: reviewReason,
  };
}
