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
  title: 'ClearFlow — Invoice & Payment Reconciliation',
  description:
    'Automated invoice-to-payment reconciliation and cash collection platform for Indian MSMEs.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${inter.className} min-h-screen bg-gray-50 text-gray-900 flex flex-col lg:flex-row`}>
        <ToastProvider>
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <main className="flex-1 w-full max-w-[1200px] mx-auto p-6">
              {children}
            </main>
          </div>
        </ToastProvider>
      </body>
    </html>
  );
}
