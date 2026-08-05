import React from 'react';
import Link from 'next/link';
import {
  FilePlus2,
  Clock,
  CheckCircle2,
  TrendingUp,
  DollarSign,
  AlertCircle,
  PieChart,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { Invoice, Profile } from '@/lib/types';
import { formatLKR } from '@/lib/utils';
import { DashboardClient } from '../dashboard-client';

export const revalidate = 0;

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  if (user) {
    const { data: profData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    if (profData) profile = profData as Profile;
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const startOfMonthStr = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
    .toISOString()
    .split('T')[0];

  const [
    { data: todayPaymentsData },
    { data: monthPaymentsData },
    { data: outstandingData },
    { count: partiallyPaidCount },
    { count: paidCount },
    { data: overdueData },
    { data: recentInvoices },
  ] = await Promise.all([
    supabase
      .from('invoice_payments')
      .select('amount')
      .eq('payment_date', todayStr)
      .eq('is_reversed', false),
    supabase
      .from('invoice_payments')
      .select('amount')
      .gte('payment_date', startOfMonthStr)
      .eq('is_reversed', false),
    supabase
      .from('invoices')
      .select('balance_due')
      .is('archived_at', null)
      .neq('status', 'Cancelled'),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('status', 'Partially Paid'),
    supabase
      .from('invoices')
      .select('*', { count: 'exact', head: true })
      .is('archived_at', null)
      .eq('status', 'Paid'),
    supabase
      .from('invoices')
      .select('balance_due')
      .is('archived_at', null)
      .eq('status', 'Overdue'),
    supabase
      .from('invoices')
      .select('*')
      .is('archived_at', null)
      .order('created_at', { ascending: false })
      .limit(10),
  ]);

  const todayCollections = (todayPaymentsData || []).reduce(
    (acc, curr) => acc + (Number(curr.amount) || 0),
    0
  );

  const monthCollections = (monthPaymentsData || []).reduce(
    (acc, curr) => acc + (Number(curr.amount) || 0),
    0
  );

  const totalOutstanding = (outstandingData || []).reduce(
    (acc, curr) => acc + (Number(curr.balance_due) || 0),
    0
  );

  const overdueAmount = (overdueData || []).reduce(
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
            Real-time status of Thennakoon Tours payments, collections & outstanding invoices
          </p>
        </div>

        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-lg shadow-amber-500/10 active:scale-95 shrink-0"
        >
          <FilePlus2 className="w-4 h-4 text-zinc-950" />
          <span>Create New Invoice</span>
        </Link>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {/* Metric 1: Today's Collections */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-zinc-400">Today&apos;s Collections</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-black text-emerald-400 mt-3">{formatLKR(todayCollections)}</p>
        </div>

        {/* Metric 2: This Month's Collections */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-zinc-400">This Month&apos;s Collections</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400">
              <TrendingUp className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-black text-emerald-400 mt-3">{formatLKR(monthCollections)}</p>
        </div>

        {/* Metric 3: Total Outstanding */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-amber-400">Total Outstanding</span>
            <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
              <DollarSign className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-black text-amber-400 mt-3">{formatLKR(totalOutstanding)}</p>
        </div>

        {/* Metric 4: Partially Paid Invoices */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-zinc-400">Partially Paid</span>
            <div className="p-2 rounded-lg bg-purple-950/80 text-purple-400">
              <PieChart className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-purple-300 mt-3">{partiallyPaidCount || 0}</p>
        </div>

        {/* Metric 5: Paid Invoices */}
        <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl p-4 flex flex-col justify-between hover:border-zinc-700 transition-colors">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-zinc-400">Paid Invoices</span>
            <div className="p-2 rounded-lg bg-emerald-950/80 text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <p className="text-2xl font-black text-emerald-400 mt-3">{paidCount || 0}</p>
        </div>

        {/* Metric 6: Overdue Amount */}
        <div className="bg-gradient-to-br from-red-950/40 via-zinc-900 to-zinc-900 border border-red-500/30 rounded-xl p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase text-red-400">Overdue Amount</span>
            <div className="p-2 rounded-lg bg-red-500/20 text-red-300">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <p className="text-lg font-black text-red-400 mt-3 tracking-tight">
            {formatLKR(overdueAmount)}
          </p>
        </div>
      </div>

      {/* Recent Invoices Client Component */}
      <DashboardClient
        initialInvoices={(recentInvoices as Invoice[]) || []}
        currentProfile={profile}
      />
    </div>
  );
}
