# WCC ClearFlow: 3-Minute Video Demo Script 🎬

**Track:** Everyday Automation (WCC Launchpad 30)  
**Total Duration:** 3 minutes (180 seconds)

---

### [0:00 – 0:30] Hook & The Core MSME Problem
- **Visual:** ClearFlow Dashboard showing ₹ totals for Reconciled, Needs Review, and Unpaid.
- **Narrator Voiceover:**
  > *"Every month, millions of Indian small businesses face the same frustrating headache: chasing payments and reconciling bank credits against GST invoices.
  > Customers pay via UPI with random UTR codes, deduct 2% or 10% TDS without telling anyone, or short-pay by ₹20 due to bank charges. Accounts teams spend 5 minutes per invoice doing manual cross-checks.
  > Meet ClearFlow — an intelligent, explainable reconciliation engine where an LLM reads invoices, pure deterministic algorithms match payments down to the integer paise, and a human approves every uncertain step."*

---

### [0:30 – 1:15] Ingestion & Document AI Extraction (Split Screen)
- **Visual:** Click **Upload & Ingest** tab. Click sample invoice fixture (e.g. `INV-2026-003`).
- **Narrator Voiceover:**
  > *"ClearFlow processes both bank statement CSVs and invoice documents.
  > Let's look at invoice extraction. We upload the document directly from browser to private storage using signed URLs.
  > Google Gemini Flash extracts the key fields into strict JSON. But here is the critical rule: the AI NEVER does arithmetic.
  > ClearFlow executes a deterministic mathematical check: line items plus GST plus round-off must equal the total.
  > Here on invoice 003, our math check caught an error — the extracted total differed from the line item sum.
  > With our Split Review Screen, the document is on the left, and editable fields are on the right. You correct the total, hit Save & Verify, the math check passes, and the invoice is verified."*

---

### [1:15 – 2:00] Deterministic Matching Engine & Review Queue
- **Visual:** Click **Load Demo Data** $\to$ Click **Review Queue**.
- **Narrator Voiceover:**
  > *"Now let's run ClearFlow's 3-pass matching engine.
  > In Pass 1, it finds direct invoice numbers or UTRs in bank narrations — reaching high confidence.
  > In Pass 2, it matches exact amounts, date proximity, and fuzzy customer names.
  > And look at Pass 2b: ClearFlow calculates standard Indian TDS rates on the pre-GST base. It explains clearly: 'Amount ₹45,900 matches ₹50,000 invoice minus 10% TDS on pre-GST base'.
  > When two invoices have similar amounts and dates, our ambiguity guard forces them into the Review Queue.
  > For high-confidence matches, you can confirm all in one click — with a 10-second Undo toast if you change your mind.
  > When you confirm a match, ClearFlow automatically learns the customer's bank alias for future statements."*

---

### [2:00 – 2:30] Payment Reminders & UPI Deep-Link
- **Visual:** Click **Reminders** tab.
- **Narrator Voiceover:**
  > *"What about unpaid invoices? ClearFlow dynamically derives invoice statuses from confirmed allocations.
  > In the Reminders view, every unpaid invoice shows its exact outstanding balance.
  > By entering your UPI ID, ClearFlow generates a direct UPI payment link encoded with the invoice number as the transaction note.
  > There are no raw bank account or IFSC numbers in the copy.
  > Most importantly: ClearFlow NEVER auto-dispatches messages. A human explicitly reviews the draft, clicks Approve, and opens WhatsApp Web via wa.me to send it with one tap."*

---

### [2:30 – 3:00] Accountant Export, Benchmark & Closing
- **Visual:** Click **Export Books** $\to$ show the downloaded 4-sheet Excel file. Then switch to **Benchmark Eval**.
- **Narrator Voiceover:**
  > *"At month-end, click 'Export Books' to download a clean, 4-sheet Excel workbook: Matched, Unmatched Bank Credits, Unpaid Invoices, and GST Summary ready for your CA.
  > Finally, let's look at our scientific evaluation benchmark. Evaluated against out-of-sample ground truth and 15 adversarial test cases, ClearFlow achieved our most important KPI:
  > Exactly ZERO wrong auto-confirms, 100% precision in the high-confidence tier, and a 35% review queue reduction through alias learning.
  > ClearFlow gives small businesses the speed of AI with the certainty of clean accounting.
  > Thank you!"*
