import React from 'react';
import Link from 'next/link';
import {
  FilePlus2,
  Receipt,
  Clock,
  CheckCircle2,
  TrendingUp,
  FileText,
  DollarSign,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Invoice } from '@/lib/types';
import { formatLKR } from '@/lib/utils';
import { DashboardClient } from '../dashboard-client';

export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();

  const todayStr = new Date().toISOString().split('T')[0];
  const startOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [
    { count: todayCount },
    { count: monthCount },
    { count: draftCount },
    { count: issuedCount },
    { count: paidCount },
    { data: outstandingData },
    { data: recentInvoices },
  ] = await Promise.all([
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null)
      .gte('created_at', todayStr),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null)
      .gte('created_at', startOfMonthStr),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('status', 'Draft'),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('status', 'Issued'),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('status', 'Paid'),
    supabase
      .from('invoices')
      .select('balance_due')
      .is('archived_at', null)
      .neq('status', 'Cancelled'),
    supabase
      .from('invoices')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const outstandingBalance = (outstandingData || []).reduce(
    (acc, curr) => acc + (Number(curr.balance_due) || 0),
    0
  );

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-zinc-850">
        <div>
          <h1 className="text-2xl font-extrabold text-white tracking-tight">
            Dashboard Overview
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time status of Thennakoon Tours invoices & financial totals
          </p>
        </div>

        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/10 active:scale-95 shrink-0"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>Create New Invoice</span>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Metric 1: Today */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">Created Today</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-3">{todayCount || 0}</p>
        </div>

        {/* Metric 2: This Month */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">This Month</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-white mt-3">{monthCount || 0}</p>
        </div>

        {/* Metric 3: Drafts */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">Draft Invoices</span>
            <div className="p-2 rounded-lg bg-zinc-800 text-zinc-400">
              <FileText className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-zinc-300 mt-3">{draftCount || 0}</p>
        </div>

        {/* Metric 4: Issued */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">Issued</span>
            <div className="p-2 rounded-lg bg-blue-950/80 text-blue-400">
              <Receipt className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-blue-400 mt-3">{issuedCount || 0}</p>
        </div>

        {/* Metric 5: Paid */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-zinc-400">Paid Invoices</span>
            <div className="p-2 rounded-lg bg-emerald-950/80 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-3">{paidCount || 0}</p>
        </div>

        {/* Metric 6: Outstanding Balance */}
        <div className="bg-gradient-to-br from-amber-950/40 via-zinc-900 to-zinc-900 border border-amber-500/30 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-medium text-amber-400">Outstanding</span>
            <div className="p-2 rounded-lg bg-amber-500/20 text-amber-300">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-black text-amber-400 mt-3 tracking-tight">
            {formatLKR(outstandingBalance)}
          </p>
        </div>
      </div>

      {/* Recent Invoices Client Component */}
      <DashboardClient initialInvoices={(recentInvoices as Invoice[]) || []} />
    </div>
  );
}
