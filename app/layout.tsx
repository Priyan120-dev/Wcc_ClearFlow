import type { Metadata } from 'next';
import './globals.css';
import { Navbar } from '@/components/navbar';

export const metadata: Metadata = {
  title: 'WCC ClearFlow — Automated Invoice & Payment Reconciliation',
  description:
    'Upload invoices and a bank statement. ClearFlow matches payments, chases unpaid ones, and exports clean books with human approval at every uncertain step.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50/50 text-slate-900 antialiased">
        <Navbar />
        <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-6 text-center text-xs text-slate-500">
          <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
            <p>WCC ClearFlow • Everyday Automation Track (WCC Launchpad 30)</p>
            <p className="font-mono text-slate-400">Strictly Integer Paise • Zero Arithmetic LLM Invariant</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
