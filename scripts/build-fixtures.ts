import { generateSyntheticDataset } from '../lib/seed/data-generator';
import fs from 'fs';
import path from 'path';

const outDir = path.resolve(__dirname, '../lib/seed');

// Dataset A (Tuning seed 1001)
const datasetA = generateSyntheticDataset(1001, 'demo-user-001');
fs.writeFileSync(path.join(outDir, 'dataset-a.json'), JSON.stringify(datasetA, null, 2));

// Dataset B (Evaluation seed 2002)
const datasetB = generateSyntheticDataset(2002, 'demo-user-001');
fs.writeFileSync(path.join(outDir, 'dataset-b.json'), JSON.stringify(datasetB, null, 2));

// Sample invoice files (10 samples, including 1 with corrupted line item total)
const sampleInvoices = [
  {
    id: 'sample-inv-1',
    number: 'INV-2026-001',
    customer_name: 'Sharma Tech Enterprises',
    customer_phone: '9876543210',
    customer_email: 'accounts@sharmatech.in',
    issue_date: '2026-09-02',
    due_date: '2026-09-17',
    subtotal_paise: 5000000,
    gst_paise: 900000,
    round_off_paise: 0,
    total_paise: 5900000, // ₹59,000.00
    confidence: 0.98,
    needs_review: false,
    line_items: [
      { description: 'Cloud Consulting Services', amount_paise: 5000000 }
    ],
    is_cached_sample: true,
  },
  {
    id: 'sample-inv-2',
    number: 'INV-2026-002',
    customer_name: 'Patel Logistics Private Limited',
    customer_phone: '9822334455',
    customer_email: 'finance@patellogistics.in',
    issue_date: '2026-09-05',
    due_date: '2026-09-20',
    subtotal_paise: 12000000,
    gst_paise: 2160000,
    round_off_paise: 0,
    total_paise: 14160000, // ₹1,41,600.00
    confidence: 0.96,
    needs_review: false,
    line_items: [
      { description: 'Freight Logistics Delhi-Mumbai', amount_paise: 12000000 }
    ],
    is_cached_sample: true,
  },
  {
    id: 'sample-inv-3-corrupted',
    number: 'INV-2026-003',
    customer_name: 'Reddy Infrastructure Solutions',
    customer_phone: '9811223344',
    customer_email: 'billing@reddyinfra.in',
    issue_date: '2026-09-08',
    due_date: '2026-09-23',
    subtotal_paise: 8000000, // ₹80,000
    gst_paise: 1440000,     // ₹14,400 -> Math sum should be ₹94,400 (9440000)
    round_off_paise: 0,
    total_paise: 9999900,   // Corrupted total: ₹99,999.00 -> Difference > 100 paise!
    confidence: 0.88,
    needs_review: true,     // Triggers math-check catch!
    line_items: [
      { description: 'Civil Construction Materials', amount_paise: 8000000 }
    ],
    is_cached_sample: true,
  },
  {
    id: 'sample-inv-4',
    number: 'INV-2026-004',
    customer_name: 'Mehta Electronics & Supplies',
    customer_phone: '9833445566',
    customer_email: 'accounts@mehtaelectronics.in',
    issue_date: '2026-09-10',
    due_date: '2026-09-25',
    subtotal_paise: 3500000,
    gst_paise: 630000,
    round_off_paise: 0,
    total_paise: 4130000,
    confidence: 0.97,
    needs_review: false,
    line_items: [
      { description: 'Semiconductor Components', amount_paise: 3500000 }
    ],
    is_cached_sample: true,
  },
  {
    id: 'sample-inv-5',
    number: 'INV-2026-005',
    customer_name: 'Gupta Industrial Traders LLP',
    customer_phone: '9844556677',
    customer_email: 'sales@guptatraders.in',
    issue_date: '2026-09-12',
    due_date: '2026-09-27',
    subtotal_paise: 4500000,
    gst_paise: 810000,
    round_off_paise: 0,
    total_paise: 5310000,
    confidence: 0.95,
    needs_review: false,
    line_items: [
      { description: 'Hardware Consumables', amount_paise: 4500000 }
    ],
    is_cached_sample: true,
  }
];

fs.writeFileSync(path.join(outDir, 'sample-invoices.json'), JSON.stringify(sampleInvoices, null, 2));

console.log('Fixtures generated successfully.');
