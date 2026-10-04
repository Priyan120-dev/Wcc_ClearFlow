'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  FileCheck2,
  UploadCloud,
  CheckCircle2,
  Clock,
  DownloadCloud,
  BarChart3,
  ShieldCheck,
  RefreshCw,
  Database,
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
      }
    } catch {
      // ignore
    } finally {
      setLoadingSeed(false);
    }
  };

  const navLinks = [
    { href: '/', label: 'Dashboard', icon: FileCheck2 },
    { href: '/upload', label: 'Upload', icon: UploadCloud },
    { href: '/review', label: 'Review', icon: Clock },
    { href: '/reminders', label: 'Reminders', icon: CheckCircle2 },
    { href: '/export', label: 'Export', icon: DownloadCloud },
    { href: '/evaluation', label: 'Accuracy', icon: BarChart3 },
    { href: '/audit', label: 'Trust', icon: ShieldCheck },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-6">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-600 text-white font-semibold text-[12px]">
              CF
            </div>
            <span className="font-semibold text-gray-900 tracking-tight text-[16px]">ClearFlow</span>
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
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[14px] font-medium transition-colors ${
                    isActive
                      ? 'bg-gray-100 text-gray-900'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 stroke-[1.5] ${isActive ? 'text-emerald-700' : 'text-gray-500'}`} />
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
            className="min-h-[40px] flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3.5 py-1.5 text-[12px] font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600 focus-visible:ring-offset-2"
          >
            {loadingSeed ? (
              <RefreshCw className="h-3.5 w-3.5 stroke-[1.5] animate-spin" />
            ) : (
              <Database className="h-3.5 w-3.5 stroke-[1.5] text-gray-500" />
            )}
            Load demo data
          </button>
        </div>
      </div>
    </header>
  );
}
