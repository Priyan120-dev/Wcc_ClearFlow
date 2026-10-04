'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Upload,
  CheckSquare,
  Send,
  Download,
  BarChart2,
  Shield,
  Menu,
  X,
  Database,
  RefreshCw,
} from 'lucide-react';
import { useToast } from '@/components/toast';

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

const navGroups: NavGroup[] = [
  {
    title: 'Reconciliation',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/upload', label: 'Upload', icon: Upload },
      { href: '/review', label: 'Review', icon: CheckSquare },
    ],
  },
  {
    title: 'Actions',
    items: [
      { href: '/reminders', label: 'Reminders', icon: Send },
      { href: '/export', label: 'Export', icon: Download },
    ],
  },
  {
    title: 'Operations',
    items: [
      { href: '/evaluation', label: 'Accuracy', icon: BarChart2 },
      { href: '/audit', label: 'Trust', icon: Shield },
    ],
  },
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
          title: 'Demo dataset loaded',
          message: '60 invoices and 80 bank transactions populated.',
        });
        setTimeout(() => {
          window.location.reload();
        }, 500);
      } else {
        showToast({
          type: 'error',
          title: 'Seed failed',
          message: 'Could not write sample data to database.',
        });
      }
    } catch {
      showToast({
        type: 'error',
        title: 'Network error',
        message: 'Unable to reach backend service.',
      });
    } finally {
      setLoadingSeed(false);
    }
  };

  const navContent = (
    <div className="flex h-full flex-col justify-between p-4">
      <div className="space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-between px-2">
          <Link href="/" className="flex items-center gap-2">
            <span className="text-base font-semibold tracking-tight text-gray-900">
              ClearFlow
            </span>
            <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
              MSME
            </span>
          </Link>
          {mobileOpen && (
            <button
              onClick={() => setMobileOpen(false)}
              className="rounded p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-900 lg:hidden"
              aria-label="Close menu"
            >
              <X className="h-4 w-4 stroke-[1.5]" />
            </button>
          )}
        </div>

        {/* Grouped Navigation */}
        <nav className="space-y-6">
          {navGroups.map((group) => (
            <div key={group.title} className="space-y-1">
              <h3 className="px-2 text-[11px] font-medium uppercase tracking-wider text-gray-400">
                {group.title}
              </h3>
              <div className="space-y-0.5 pt-1">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex h-9 items-center gap-2.5 rounded px-2.5 text-sm transition-colors ${
                        isActive
                          ? 'bg-gray-100 font-medium text-gray-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 stroke-[1.5] ${
                          isActive ? 'text-emerald-700' : 'text-gray-500'
                        }`}
                      />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>

      {/* Footer Utility Actions */}
      <div className="space-y-2 border-t border-gray-200 pt-4">
        <button
          onClick={() => handleSeed('A')}
          disabled={loadingSeed}
          className="flex h-10 w-full items-center justify-center gap-2 rounded border border-gray-200 bg-white px-3 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          {loadingSeed ? (
            <RefreshCw className="h-4 w-4 stroke-[1.5] animate-spin text-gray-500" />
          ) : (
            <Database className="h-4 w-4 stroke-[1.5] text-gray-500" />
          )}
          <span>Load demo data</span>
        </button>

        <div className="flex items-center justify-between px-2 pt-1 text-[11px] text-gray-400">
          <span>v0.1.0</span>
          <span>Zero-LLM Math</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile Top Bar */}
      <div className="sticky top-0 z-40 flex h-14 w-full items-center justify-between border-b border-gray-200 bg-white px-4 lg:hidden">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-base font-semibold tracking-tight text-gray-900">
            ClearFlow
          </span>
          <span className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">
            MSME
          </span>
        </Link>
        <button
          onClick={() => setMobileOpen(true)}
          className="flex h-10 w-10 items-center justify-center rounded border border-gray-200 text-gray-600 hover:bg-gray-50"
          aria-label="Open menu"
        >
          <Menu className="h-4 w-4 stroke-[1.5]" />
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="fixed inset-0 bg-gray-900/30 backdrop-blur-sm transition-opacity"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed inset-y-0 left-0 w-[240px] bg-white border-r border-gray-200 shadow-xl">
            {navContent}
          </div>
        </div>
      )}

      {/* Desktop Fixed Left Sidebar */}
      <aside className="hidden h-screen w-[240px] shrink-0 border-r border-gray-200 bg-white sticky top-0 lg:block">
        {navContent}
      </aside>
    </>
  );
}
