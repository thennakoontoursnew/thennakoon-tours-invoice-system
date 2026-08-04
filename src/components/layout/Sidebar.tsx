'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  FilePlus2,
  Receipt,
  Settings,
  Users,
  LogOut,
  Car,
  BarChart3,
  Menu,
  X,
  Plus,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile } from '@/lib/types';

interface SidebarProps {
  profile?: Profile | null;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'New Invoice', href: '/invoices/new', icon: FilePlus2 },
    { label: 'Invoices', href: '/invoices', icon: Receipt },
  ];

  const role = profile?.role?.trim().toLowerCase();
  if (role === 'owner' || role === 'admin') {
    navItems.push({ label: 'Reports', href: '/reports', icon: BarChart3 });
  }

  navItems.push({ label: 'Settings', href: '/settings', icon: Settings });

  if (role === 'owner') {
    navItems.push({ label: 'Users', href: '/users', icon: Users });
  }

  return (
    <>
      {/* MOBILE TOP HEADER BAR (Hidden on desktop) */}
      <div className="md:hidden fixed top-0 left-0 right-0 h-16 bg-zinc-950/95 border-b border-zinc-850 z-40 px-4 flex items-center justify-between backdrop-blur-md print:hidden">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold">
            <Car className="w-4 h-4" />
          </div>
          <div>
            <h1 className="font-bold text-xs text-white tracking-tight leading-tight">
              Thennakoon Tours
            </h1>
            <p className="text-[10px] text-amber-400 font-medium">Invoice Generator</p>
          </div>
        </div>

        <button
          onClick={() => setIsMobileOpen(!isMobileOpen)}
          className="p-2.5 rounded-lg text-zinc-300 hover:text-white bg-zinc-900 border border-zinc-800 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center"
          aria-label="Toggle navigation menu"
        >
          {isMobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>
      </div>

      {/* MOBILE BACKDROP OVERLAY */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm z-40 md:hidden print:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* SIDEBAR DRAWER (Slide-out on mobile, sticky sidebar on desktop) */}
      <aside
        className={`w-64 bg-zinc-950 border-r border-zinc-850 flex flex-col h-screen fixed inset-y-0 left-0 z-50 transition-transform duration-300 md:translate-x-0 md:sticky md:top-0 shrink-0 select-none print:hidden ${
          isMobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Logo & Title */}
        <div className="p-5 border-b border-zinc-850 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 font-bold shadow-inner">
              <Car className="w-5 h-5" />
            </div>
            <div>
              <h1 className="font-bold text-sm text-white tracking-tight leading-tight">
                Thennakoon Tours
              </h1>
              <p className="text-[11px] text-amber-400/90 font-medium tracking-wide">
                Invoice Generator
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsMobileOpen(false)}
            className="md:hidden p-1.5 text-zinc-400 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Menu */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              (item.href !== '/dashboard' && pathname.startsWith(item.href));

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className={`flex items-center gap-3 px-3.5 py-3 rounded-lg text-xs font-medium transition-all duration-150 min-h-[44px] ${
                  isActive
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30 shadow-sm'
                    : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-900/80 border border-transparent'
                }`}
              >
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-amber-400' : 'text-zinc-500'
                  }`}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Profile & Logout Section */}
        <div className="p-3.5 border-t border-zinc-850 bg-zinc-950/60">
          <div className="mb-3 px-2.5 py-2 rounded-md bg-zinc-900/60 border border-zinc-850">
            <p className="text-xs font-semibold text-zinc-200 truncate">
              {profile?.full_name || 'Staff User'}
            </p>
            <div className="flex items-center justify-between mt-1">
              <span className="text-[10px] text-zinc-400 truncate">
                {profile?.email}
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30">
                {profile?.role || 'Staff'}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/40 transition-colors min-h-[44px]"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      {/* FLOATING ACTION BUTTON (FAB) FOR MOBILE (+ New Invoice) */}
      <Link
        href="/invoices/new"
        className="fixed bottom-6 right-6 md:hidden z-40 bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs px-4 py-3 rounded-full shadow-2xl flex items-center gap-2 border border-amber-400/80 active:scale-95 transition-all min-h-[44px] print:hidden"
        title="Create New Invoice"
      >
        <Plus className="w-4 h-4 stroke-[3]" />
        <span>New Invoice</span>
      </Link>
    </>
  );
}
