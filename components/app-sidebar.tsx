'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  UploadCloud,
  Clock,
  Send,
  DownloadCloud,
  BarChart3,
  ShieldCheck,
  Menu,
  X,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { PrivacyBanner } from '@/components/privacy-banner';
import { useToast } from '@/components/toast';

export const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/upload', label: 'Upload', icon: UploadCloud },
  { href: '/review', label: 'Review', icon: Clock },
  { href: '/reminders', label: 'Reminders', icon: Send },
  { href: '/export', label: 'Export', icon: DownloadCloud },
  { href: '/evaluation', label: 'Accuracy', icon: BarChart3 },
  { href: '/audit', label: 'Trust', icon: ShieldCheck },
];

export function AppSidebar() {
  const pathname = usePathname();
  const { showToast } = useToast();
  const [mobileOpen, setMobileOpen] = useState(false);
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
        showToast({
          type: 'success',
          title: 'Demo Data Loaded',
          message: 'Loaded 60 MSME invoices and 80 bank transactions.',
        });
        setTimeout(() => {
          window.location.reload();
        }, 600);
      } else {
        showToast({
          type: 'error',
          title: 'Seed Failed',
          message: 'Could not load demo data into storage.',
        });
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Network Error',
        message: 'Unable to reach backend API.',
      });
    } finally {
      setLoadingSeed(false);
    }
  };

  return (
    <>
      {/* Mobile Top Header */}
      <header className="lg:hidden sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-sm">
            CF
          </div>
          <span className="font-bold text-slate-900 tracking-tight text-base">ClearFlow</span>
          <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 uppercase">
            WCC
          </span>
        </Link>

        <div className="flex items-center gap-2">
          <PrivacyBanner variant="compact" />
          <button
            onClick={() => setMobileOpen(!mobileOpen)}
            className="rounded-lg p-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            aria-label="Toggle navigation menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Mobile Drawer Backdrop & Menu */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-3/4 max-w-xs bg-white p-5 shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-white font-bold text-sm shadow-sm">
                    CF
                  </div>
                  <div>
                    <span className="font-bold text-slate-900 tracking-tight text-base">ClearFlow</span>
                    <span className="ml-1 rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-800 uppercase">
                      WCC
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="rounded-lg p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Navigation Links */}
              <nav className="space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                        isActive
                          ? 'bg-emerald-50 text-emerald-800 font-semibold'
                          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                      {item.label}
                    </Link>
                  );
                })}
              </nav>
            </div>

            <div className="pt-4 border-t border-slate-100 space-y-3">
              <button
                onClick={() => handleSeed('A')}
                disabled={loadingSeed}
                className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 min-h-[40px] px-3.5 py-2 text-xs font-semibold text-white shadow hover:bg-emerald-700 disabled:opacity-50 transition-all"
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
        </div>
      )}

      {/* Desktop Left Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col justify-between border-r border-slate-200 bg-white min-h-screen p-5 sticky top-0 h-screen overflow-y-auto">
        <div className="space-y-6">
          {/* Brand */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-600 text-white font-bold text-base shadow-sm">
              CF
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-bold text-slate-900 tracking-tight text-lg">ClearFlow</span>
                <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-800 uppercase tracking-wide">
                  WCC
                </span>
              </div>
              <p className="text-[11px] text-slate-400 font-medium">Reconciliation & Cash Flow</p>
            </div>
          </Link>

          {/* Navigation Links */}
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-emerald-50 text-emerald-800 font-semibold border-r-2 border-emerald-600'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Sidebar Footer Actions */}
        <div className="pt-4 border-t border-slate-200 space-y-3">
          <button
            onClick={() => handleSeed('A')}
            disabled={loadingSeed}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-emerald-600 min-h-[40px] px-3.5 py-2 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
            title="Loads synthetic Dataset A (60 Invoices, 80 Bank Txns)"
          >
            {loadingSeed ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5 text-emerald-200" />
            )}
            Load Demo Data
          </button>

          <div className="flex items-center justify-between px-1 pt-1">
            <PrivacyBanner variant="compact" />
            <span className="text-[10px] text-slate-400 font-medium">v0.1.0</span>
          </div>
        </div>
      </aside>
    </>
  );
}
