import { Invoice, BankTxn, PayerAlias } from '@/lib/types';
import crypto from 'crypto';

export interface GroundTruthRecord {
  invoice_id: string;
  invoice_number: string;
  txn_id: string;
  txn_dedupe_hash: string;
  expected_method: 'ref_match' | 'fuzzy_composite' | 'short_pay_tds' | 'subset_sum';
  expected_tier: 'high_confidence' | 'review';
  expected_adjustment_paise: number;
  expected_adjustment_kind?: 'tds' | 'bank_charge' | null;
  notes: string;
}

export interface GeneratedDataset {
  invoices: Invoice[];
  txns: BankTxn[];
  aliases: PayerAlias[];
  groundTruth: GroundTruthRecord[];
  adversarialTxns: BankTxn[];
}

/**
 * Seedable PRNG (Mulberry32) for reproducible synthetic dataset generation
 */
function createPrng(seed: number) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const INDIAN_COMPANIES = [
  'Sharma Tech Enterprises',
  'Patel Logistics Private Limited',
  'Reddy Infrastructure Solutions',
  'Mehta Electronics & Supplies',
  'Gupta Industrial Traders LLP',
  'Singh Automotives & Parts',
  'Verma Textile Mills',
  'Kulkarni Engineering Works',
  'Nair Pharmaceutical Distribution',
  'Iyer Software Consulting',
  'Choudhury Agro Products',
  'Joshi Construction Corp',
  'Malhotra Garments Export',
  'Deshmukh Packaging Industries',
  'Bhatt Chemical Formulations',
];

/**
 * Generates synthetic Indian MSME invoice and bank statement data
 */
export function generateSyntheticDataset(seed: number, userId: string = 'demo-user-001'): GeneratedDataset {
  const rand = createPrng(seed);
  const invoices: Invoice[] = [];
  const txns: BankTxn[] = [];
  const aliases: PayerAlias[] = [];
  const groundTruth: GroundTruthRecord[] = [];

  // Generate 60 Invoices
  for (let i = 1; i <= 60; i++) {
    const invNum = `INV-2024-${i.toString().padStart(3, '0')}`;
    const compIndex = Math.floor(rand() * INDIAN_COMPANIES.length);
    const customerName = INDIAN_COMPANIES[compIndex];

    // Amounts between ₹5,000 and ₹2,50,000 in integer paise
    const basePaise = Math.round(5000 + rand() * 245000) * 100;
    const gstRate = 0.18; // 18% standard Indian GST
    const gstPaise = Math.round(basePaise * gstRate);
    const totalPaise = basePaise + gstPaise;

    // Dates between Sept 01 and Sept 25, 2026
    const day = 1 + Math.floor(rand() * 24);
    const issueDate = `2026-09-${day.toString().padStart(2, '0')}`;
    const dueDate = `2026-09-${Math.min(30, day + 15).toString().padStart(2, '0')}`;

    invoices.push({
      id: `inv-${seed}-${i}`,
      user_id: userId,
      number: invNum,
      customer_name: customerName,
      customer_phone: `98${Math.floor(10000000 + rand() * 89999999)}`,
      customer_email: `accounts@${customerName.toLowerCase().replace(/[^a-z]/g, '').substring(0, 10)}.in`,
      amount_paise: totalPaise,
      gst_paise: gstPaise,
      round_off_paise: 0,
      issue_date: issueDate,
      due_date: dueDate,
      needs_review: false,
      file_path: `/invoices/sample_${i}.pdf`,
      extraction_confidence: 0.95,
      raw_json: { line_items_total: basePaise, gst: gstPaise, total: totalPaise },
    });
  }

  // Pre-seed some payer aliases
  aliases.push(
    {
      id: `alias-${seed}-1`,
      user_id: userId,
      raw_alias: 'SHARMA TECH ENTP',
      customer_name: 'Sharma Tech Enterprises',
    },
    {
      id: `alias-${seed}-2`,
      user_id: userId,
      raw_alias: 'PATEL LOGISTICS PL',
      customer_name: 'Patel Logistics Private Limited',
    }
  );

  let txnCounter = 1;

  // Helper to generate a dedupe hash
  const buildDedupeHash = (date: string, amount: number, narration: string, idx: number) => {
    return crypto
      .createHash('sha256')
      .update(`${date}|${amount}|${narration.toUpperCase().trim()}|${idx}`)
      .digest('hex');
  };

  // Category 1: Pass 1 Reference Matches (20 invoices matched via invoice number or UTR)
  for (let i = 0; i < 20; i++) {
    const inv = invoices[i];
    const utr = `428${Math.floor(100000000 + rand() * 899999999)}`;
    const payDay = Math.min(30, parseInt(inv.issue_date.slice(8)) + Math.floor(rand() * 5));
    const txnDate = `2026-09-${payDay.toString().padStart(2, '0')}`;
    const narration = `UPI/${utr}/Payment for ${inv.number}/${inv.customer_name.slice(0, 12)}/HDFC`;

    const txnId = `txn-${seed}-${txnCounter++}`;
    const hash = buildDedupeHash(txnDate, inv.amount_paise, narration, 1);

    const txn: BankTxn = {
      id: txnId,
      user_id: userId,
      date: txnDate,
      amount_paise: inv.amount_paise,
      direction: 'credit',
      narration,
      utr_ref: utr,
      dedupe_hash: hash,
      source_file: 'bank_statement_sept_2026.csv',
    };

    txns.push(txn);
    groundTruth.push({
      invoice_id: inv.id,
      invoice_number: inv.number,
      txn_id: txnId,
      txn_dedupe_hash: hash,
      expected_method: 'ref_match',
      expected_tier: 'high_confidence',
      expected_adjustment_paise: 0,
      notes: 'Pass 1 direct reference match',
    });
  }

  // Category 2: Pass 2 Fuzzy Composite Matches (15 invoices matched via exact amount + fuzzy name + date proximity)
  for (let i = 20; i < 35; i++) {
    const inv = invoices[i];
    const cleanName = inv.customer_name.replace(/Private Limited|LLP|Enterprises|Solutions/gi, '').trim().toUpperCase();
    const payDay = Math.min(30, parseInt(inv.issue_date.slice(8)) + 3 + Math.floor(rand() * 8));
    const txnDate = `2026-09-${payDay.toString().padStart(2, '0')}`;
    const narration = `NEFT-CR-AXIS0001-${cleanName}-SALES REC`;

    const txnId = `txn-${seed}-${txnCounter++}`;
    const hash = buildDedupeHash(txnDate, inv.amount_paise, narration, 1);

    const txn: BankTxn = {
      id: txnId,
      user_id: userId,
      date: txnDate,
      amount_paise: inv.amount_paise,
      direction: 'credit',
      narration,
      utr_ref: null,
      dedupe_hash: hash,
      source_file: 'bank_statement_sept_2026.csv',
    };

    txns.push(txn);
    groundTruth.push({
      invoice_id: inv.id,
      invoice_number: inv.number,
      txn_id: txnId,
      txn_dedupe_hash: hash,
      expected_method: 'fuzzy_composite',
      expected_tier: 'high_confidence',
      expected_adjustment_paise: 0,
      notes: 'Pass 2 composite match (exact amount + fuzzy name)',
    });
  }

  // Category 3: Pass 2b Short-Pay TDS (10 invoices with 10% or 2% TDS on pre-GST base)
  for (let i = 35; i < 45; i++) {
    const inv = invoices[i];
    const preGst = inv.amount_paise - inv.gst_paise;
    const rate = i % 2 === 0 ? 10 : 2; // 10% or 2% TDS
    const tdsPaise = Math.round(preGst * (rate / 100));
    const payPaise = inv.amount_paise - tdsPaise;

    const payDay = Math.min(30, parseInt(inv.issue_date.slice(8)) + 4);
    const txnDate = `2026-09-${payDay.toString().padStart(2, '0')}`;
    const narration = `IMPS/P2A/${inv.customer_name.slice(0, 14).toUpperCase()}/TDS ${rate}PCT DEDUCTED`;

    const txnId = `txn-${seed}-${txnCounter++}`;
    const hash = buildDedupeHash(txnDate, payPaise, narration, 1);

    const txn: BankTxn = {
      id: txnId,
      user_id: userId,
      date: txnDate,
      amount_paise: payPaise,
      direction: 'credit',
      narration,
      utr_ref: null,
      dedupe_hash: hash,
      source_file: 'bank_statement_sept_2026.csv',
    };

    txns.push(txn);
    groundTruth.push({
      invoice_id: inv.id,
      invoice_number: inv.number,
      txn_id: txnId,
      txn_dedupe_hash: hash,
      expected_method: 'short_pay_tds',
      expected_tier: 'review',
      expected_adjustment_paise: tdsPaise,
      expected_adjustment_kind: 'tds',
      notes: `Pass 2b TDS shortfall on pre-GST base (${rate}%)`,
    });
  }

  // Category 4: Pass 3 Combined Payment (1 txn covering 2 invoices of the same customer)
  const combInv1 = invoices[45];
  const combInv2 = invoices[46];
  // Ensure same customer
  combInv2.customer_name = combInv1.customer_name;
  const combinedTotal = combInv1.amount_paise + combInv2.amount_paise;
  const combDate = '2026-09-22';
  const combNarration = `RTGS-${combInv1.customer_name.slice(0, 15).toUpperCase()}-BULK SETTLEMENT`;
  const combTxnId = `txn-${seed}-${txnCounter++}`;
  const combHash = buildDedupeHash(combDate, combinedTotal, combNarration, 1);

  txns.push({
    id: combTxnId,
    user_id: userId,
    date: combDate,
    amount_paise: combinedTotal,
    direction: 'credit',
    narration: combNarration,
    utr_ref: null,
    dedupe_hash: combHash,
    source_file: 'bank_statement_sept_2026.csv',
  });

  groundTruth.push(
    {
      invoice_id: combInv1.id,
      invoice_number: combInv1.number,
      txn_id: combTxnId,
      txn_dedupe_hash: combHash,
      expected_method: 'subset_sum',
      expected_tier: 'high_confidence',
      expected_adjustment_paise: 0,
      notes: 'Pass 3 combined payment item 1',
    },
    {
      invoice_id: combInv2.id,
      invoice_number: combInv2.number,
      txn_id: combTxnId,
      txn_dedupe_hash: combHash,
      expected_method: 'subset_sum',
      expected_tier: 'high_confidence',
      expected_adjustment_paise: 0,
      notes: 'Pass 3 combined payment item 2',
    }
  );

  // Remaining invoices (invoices[47..59]) are intentionally UNPAID (for Reminders & Unpaid Export)

  // Remaining transactions up to 80 (non-matching bank credits: interest, loan, personal transfer, refunds)
  while (txns.length < 80) {
    const dummyDate = `2026-09-${Math.min(30, 1 + Math.floor(rand() * 28)).toString().padStart(2, '0')}`;
    const dummyPaise = Math.round(1000 + rand() * 80000) * 100;
    const dummyNarration = rand() > 0.5
      ? `INT.COLL-PERIODIC BANK INTEREST CR-${dummyDate}`
      : `NEFT-CR-INCOME TAX REFUND-CPC BANGALORE`;

    const dummyTxnId = `txn-${seed}-${txnCounter++}`;
    const dummyHash = buildDedupeHash(dummyDate, dummyPaise, dummyNarration, 1);

    txns.push({
      id: dummyTxnId,
      user_id: userId,
      date: dummyDate,
      amount_paise: dummyPaise,
      direction: 'credit',
      narration: dummyNarration,
      utr_ref: null,
      dedupe_hash: dummyHash,
      source_file: 'bank_statement_sept_2026.csv',
    });
  }

  // 15 Adversarial Edge Cases
  const adversarialTxns: BankTxn[] = [
    // 1. Identical amount same day from totally different customer
    {
      id: `adv-${seed}-1`,
      user_id: userId,
      date: invoices[0].issue_date,
      amount_paise: invoices[0].amount_paise,
      direction: 'credit',
      narration: 'UPI/9999999999/UNUSUAL TRADER PRIVATE LIMITED/RANDOM TRANSFER',
      utr_ref: '9999999999',
      dedupe_hash: buildDedupeHash(invoices[0].issue_date, invoices[0].amount_paise, 'UNUSUAL TRADER', 1),
    },
    // 2. Flipped debit transaction (must never match invoices!)
    {
      id: `adv-${seed}-2`,
      user_id: userId,
      date: invoices[1].issue_date,
      amount_paise: invoices[1].amount_paise,
      direction: 'debit',
      narration: `CHQ WDL-PAID TO VENDOR-${invoices[1].number}`,
      utr_ref: null,
      dedupe_hash: buildDedupeHash(invoices[1].issue_date, invoices[1].amount_paise, 'CHQ WDL', 1),
    },
    // 3. Deceptive narration containing old invoice number but wrong amount
    {
      id: `adv-${seed}-3`,
      user_id: userId,
      date: '2026-09-18',
      amount_paise: 1234500,
      direction: 'credit',
      narration: `UPI/Payment reference for ${invoices[2].number} partial advance`,
      utr_ref: null,
      dedupe_hash: buildDedupeHash('2026-09-18', 1234500, 'DECEPTIVE ADVANCE', 1),
    },
  ];

  return {
    invoices,
    txns,
    aliases,
    groundTruth,
    adversarialTxns,
  };
}
