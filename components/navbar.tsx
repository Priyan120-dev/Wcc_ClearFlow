'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileCheck2,
  UploadCloud,
  CheckCircle,
  Clock,
  DownloadCloud,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

export function Navbar() {
  const pathname = usePathname();
  const [loadingSeed, setLoadingSeed] = useState(false);

  const handleSeed = async (dataset: 'A' | 'B' = 'A') => {
    try {
      setLoadingSeed(true);
      const res = await fetch('/api/demo/seed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        alert('Failed to load demo data');
      }
    } catch (e) {
      alert('Network error loading demo data');
    } finally {
      setLoadingSeed(false);
    }
  };

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: FileCheck2 },
    { href: '/upload', label: 'Upload & Ingest', icon: UploadCloud },
    { href: '/review', label: 'Review Queue', icon: Clock },
    { href: '/reminders', label: 'Reminders', icon: CheckCircle },
    { href: '/export', label: 'Export Books', icon: DownloadCloud },
    { href: '/evaluation', label: 'Benchmark Eval', icon: BarChart3 },
    { href: '/audit', label: 'Audit & Trust', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-lg shadow-sm">
              CF
            </div>
            <div>
              <span className="font-bold text-slate-900 tracking-tight text-lg">ClearFlow</span>
              <span className="ml-1.5 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 uppercase tracking-wide">
                WCC
              </span>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="hidden md:flex items-center space-x-1">
            {navLinks.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleSeed('A')}
            disabled={loadingSeed}
            className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-all"
            title="Loads synthetic Dataset A (60 MSME Invoices, 80 Bank Txns)"
          >
            {loadingSeed ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
            )}
            Load Demo Data
          </button>
        </div>
      </div>
    </header>
  );
}
