import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AppSidebar } from '@/components/app-sidebar';
import { ToastProvider } from '@/components/toast';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
});

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
      <body className={`${inter.className} min-h-screen bg-slate-50/70 text-slate-900 antialiased flex flex-col lg:flex-row`}>
        <ToastProvider>
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              {children}
            </main>
            <footer className="border-t border-slate-200 bg-white py-4 px-6 text-xs text-slate-500">
              <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
                <p>WCC ClearFlow • Everyday Automation Track (WCC Launchpad 30)</p>
                <p className="tabular-nums text-slate-400">Strictly Integer Paise • Zero Arithmetic LLM Invariant</p>
              </div>
            </footer>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
