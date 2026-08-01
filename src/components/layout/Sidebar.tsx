'use client';

import React from 'react';
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

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.push('/login');
  };

  const navItems = [
    { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
    { label: 'New Invoice', href: '/invoices/new', icon: FilePlus2 },
    { label: 'Invoices', href: '/invoices', icon: Receipt },
    { label: 'Settings', href: '/settings', icon: Settings },
  ];

  if (profile?.role === 'Owner') {
    navItems.push({ label: 'Users', href: '/users', icon: Users });
  }

  return (
    <aside className="w-64 bg-zinc-950 border-r border-zinc-850 flex flex-col h-screen sticky top-0 shrink-0 select-none">
      {/* Brand Logo & Title */}
      <div className="p-5 border-b border-zinc-850 flex items-center gap-3">
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

      {/* Navigation Menu */}
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-xs font-medium transition-all duration-150 ${
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
        <div className="mb-3 px-2 py-1.5 rounded-md bg-zinc-900/60 border border-zinc-850">
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
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:text-red-300 hover:bg-red-950/30 border border-red-900/40 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Logout</span>
        </button>
      </div>
    </aside>
  );
}
