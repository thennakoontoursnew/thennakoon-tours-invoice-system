'use client';

import React, { useState, useEffect, useTransition, useCallback, useMemo } from 'react';
import {
  BarChart3,
  Download,
  FileSpreadsheet,
  Search,
  PieChart,
  User,
  AlertTriangle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Invoice, InvoicePayment, Profile } from '@/lib/types';
import { formatDate, formatLKR, getStatusBadgeStyle } from '@/lib/utils';
import { generateMonthlyInvoiceReportPdf } from '@/lib/pdf/generateMonthlyInvoiceReportPdf';
import { exportMonthlyInvoiceReportCsv } from '@/lib/csv/exportMonthlyInvoiceReportCsv';
import { generateCustomerStatementPdf } from '@/lib/pdf/generateCustomerStatementPdf';
import { Notification, NotificationState } from '@/components/ui/Notification';

interface ReportsClientProps {
  currentProfile: Profile;
}

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'yearly';
type TabType = 'overview' | 'methods' | 'statements' | 'aging';

export function ReportsClient({ currentProfile }: ReportsClientProps) {
  const supabase = createClient();
  const [, startTransition] = useTransition();

  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // Tab State
  const [activeTab, setActiveTab] = useState<TabType>('overview');

  // Period Filter State
  const [period, setPeriod] = useState<PeriodType>('monthly');
  const [selectedDate, setSelectedDate] = useState<string>(todayStr);
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [customerSearch, setCustomerSearch] = useState<string>('');

  // Data State
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [periodPayments, setPeriodPayments] = useState<InvoicePayment[]>([]);
  const [allInvoices, setAllInvoices] = useState<Invoice[]>([]);
  const [allPayments, setAllPayments] = useState<InvoicePayment[]>([]);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // Customer Statement State
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  const years = [2024, 2025, 2026, 2027, 2028];

  // Date Range Calculator
  const getDateRange = useCallback(() => {
    if (period === 'daily') {
      const start = selectedDate;
      const d = new Date(selectedDate);
      d.setDate(d.getDate() + 1);
      const end = d.toISOString().split('T')[0];
      return { start, end };
    }

    if (period === 'weekly') {
      const d = new Date(selectedDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday start
      const monday = new Date(d.setDate(diff));
      const start = monday.toISOString().split('T')[0];
      const nextMon = new Date(monday);
      nextMon.setDate(nextMon.getDate() + 7);
      const end = nextMon.toISOString().split('T')[0];
      return { start, end };
    }

    if (period === 'yearly') {
      const start = `${selectedYear}-01-01`;
      const end = `${selectedYear + 1}-01-01`;
      return { start, end };
    }

    // Monthly default
    const monthStr = String(selectedMonth).padStart(2, '0');
    const start = `${selectedYear}-${monthStr}-01`;
    let nextY = selectedYear;
    let nextM = selectedMonth + 1;
    if (nextM > 12) {
      nextM = 1;
      nextY += 1;
    }
    const end = `${nextY}-${String(nextM).padStart(2, '0')}-01`;
    return { start, end };
  }, [period, selectedDate, selectedMonth, selectedYear]);

  // Main Data Fetcher for Period
  const fetchReportData = useCallback(async () => {
    startTransition(async () => {
      try {
        const { start, end } = getDateRange();

        let invQuery = supabase
          .from('invoices')
          .select('*')
          .is('archived_at', null)
          .gte('invoice_date', start)
          .lt('invoice_date', end)
          .order('invoice_date', { ascending: false });

        if (selectedStatus !== 'All') {
          invQuery = invQuery.eq('status', selectedStatus);
        }

        const [
          { data: invData, error: invErr },
          { data: payData, error: payErr },
          { data: allInvData, error: allInvErr },
          { data: allPayData, error: allPayErr },
        ] = await Promise.all([
          invQuery,
          supabase
            .from('invoice_payments')
            .select('*')
            .gte('payment_date', start)
            .lt('payment_date', end)
            .eq('is_reversed', false),
          supabase.from('invoices').select('*').is('archived_at', null),
          supabase.from('invoice_payments').select('*').eq('is_reversed', false),
        ]);

        if (invErr) throw invErr;
        if (payErr) console.error('Error fetching payments:', payErr);
        if (allInvErr) console.error('Error fetching all invoices:', allInvErr);
        if (allPayErr) console.error('Error fetching all payments:', allPayErr);

        setInvoices((invData as Invoice[]) || []);
        setPeriodPayments((payData as InvoicePayment[]) || []);
        setAllInvoices((allInvData as Invoice[]) || []);
        setAllPayments((allPayData as InvoicePayment[]) || []);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch report data.';
        setNotification({ type: 'error', message: msg });
      }
    });
  }, [getDateRange, selectedStatus, supabase]);

  useEffect(() => {
    fetchReportData();
  }, [fetchReportData]);

  // Unique Customer Names for Statement Lookup
  const customerOptions = useMemo(() => {
    const names = new Set<string>();
    allInvoices.forEach((inv) => {
      if (inv.customer_name?.trim()) names.add(inv.customer_name.trim());
    });
    return Array.from(names).sort();
  }, [allInvoices]);

  // Set default selected customer if none selected
  useEffect(() => {
    if (!selectedCustomerName && customerOptions.length > 0) {
      const timer = setTimeout(() => {
        setSelectedCustomerName(customerOptions[0]);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [customerOptions, selectedCustomerName]);

  // Filtered Invoices by search text
  const filteredInvoices = invoices.filter((inv) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.trim().toLowerCase();
    return (
      (inv.invoice_number || '').toLowerCase().includes(q) ||
      (inv.customer_name || '').toLowerCase().includes(q) ||
      (inv.customer_phone || '').toLowerCase().includes(q) ||
      (inv.vehicle_name || inv.vehicle_registration_number || '').toLowerCase().includes(q)
    );
  });

  // Financial Calculations for Period
  const validFinancialInvoices = filteredInvoices.filter((i) => i.status !== 'Cancelled');
  const totalInvoiceValue = validFinancialInvoices.reduce((sum, i) => sum + (i.net_amount || 0), 0);
  const advancePaymentsReceived = validFinancialInvoices.reduce((sum, i) => sum + (i.advance_payment || 0), 0);
  const totalPaymentsCollectedInPeriod = periodPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
  const totalCollected = advancePaymentsReceived + totalPaymentsCollectedInPeriod;
  const totalOutstandingBalance = validFinancialInvoices.reduce((sum, i) => sum + (i.balance_due || 0), 0);
  const collectionRate = totalInvoiceValue > 0 ? (totalCollected / totalInvoiceValue) * 100 : 0;

  // Status Counts
  const draftCount = filteredInvoices.filter((i) => i.status === 'Draft').length;
  const issuedCount = filteredInvoices.filter((i) => i.status === 'Issued').length;
  const paidCount = filteredInvoices.filter((i) => i.status === 'Paid').length;
  const partialCount = filteredInvoices.filter((i) => i.status === 'Partially Paid').length;
  const overdueCount = filteredInvoices.filter((i) => i.status === 'Overdue').length;
  const cancelledCount = filteredInvoices.filter((i) => i.status === 'Cancelled').length;

  // Payment Method Breakdown Computation
  const paymentMethodsBreakdown = useMemo(() => {
    const methodsMap: Record<string, { count: number; total: number }> = {
      'Cash': { count: 0, total: 0 },
      'Bank Transfer': { count: 0, total: 0 },
      'Online Transfer': { count: 0, total: 0 },
      'Credit Card': { count: 0, total: 0 },
      'Cheque': { count: 0, total: 0 },
      'Other': { count: 0, total: 0 },
    };

    periodPayments.forEach((p) => {
      const m = p.payment_method || 'Other';
      if (!methodsMap[m]) methodsMap[m] = { count: 0, total: 0 };
      methodsMap[m].count += 1;
      methodsMap[m].total += p.amount || 0;
    });

    return Object.entries(methodsMap).map(([method, data]) => ({
      method,
      count: data.count,
      total: data.total,
      percentage: totalPaymentsCollectedInPeriod > 0 ? (data.total / totalPaymentsCollectedInPeriod) * 100 : 0,
    }));
  }, [periodPayments, totalPaymentsCollectedInPeriod]);

  // Aging Analysis Calculations
  const agingData = useMemo(() => {
    const today = new Date();

    const activeUnpaidInvoices = allInvoices.filter(
      (inv) => inv.status !== 'Cancelled' && inv.status !== 'Draft' && (inv.balance_due || 0) > 0
    );

    const bucket0to30 = { count: 0, amount: 0 };
    const bucket31to60 = { count: 0, amount: 0 };
    const bucket61to90 = { count: 0, amount: 0 };
    const bucket90Plus = { count: 0, amount: 0 };

    const items = activeUnpaidInvoices.map((inv) => {
      const due = new Date(inv.due_date);
      const diffTime = today.getTime() - due.getTime();
      const daysOverdue = Math.max(0, Math.floor(diffTime / (1000 * 60 * 60 * 24)));
      const bal = inv.balance_due || 0;

      let bucketLabel = '0–30 Days';
      if (daysOverdue > 90) {
        bucketLabel = '90+ Days';
        bucket90Plus.count++;
        bucket90Plus.amount += bal;
      } else if (daysOverdue >= 61) {
        bucketLabel = '61–90 Days';
        bucket61to90.count++;
        bucket61to90.amount += bal;
      } else if (daysOverdue >= 31) {
        bucketLabel = '31–60 Days';
        bucket31to60.count++;
        bucket31to60.amount += bal;
      } else {
        bucketLabel = '0–30 Days';
        bucket0to30.count++;
        bucket0to30.amount += bal;
      }

      return {
        invoice: inv,
        daysOverdue,
        bucketLabel,
      };
    });

    return {
      bucket0to30,
      bucket31to60,
      bucket61to90,
      bucket90Plus,
      items: items.sort((a, b) => b.daysOverdue - a.daysOverdue),
    };
  }, [allInvoices]);

  // Selected Customer Statement Data
  const customerStatementData = useMemo(() => {
    if (!selectedCustomerName) return { invoices: [], payments: [] };
    const custInvoices = allInvoices.filter(
      (inv) => inv.customer_name?.trim().toLowerCase() === selectedCustomerName.toLowerCase()
    );
    const custInvoiceIds = new Set(custInvoices.map((i) => i.id));
    const custPayments = allPayments.filter((p) => custInvoiceIds.has(p.invoice_id));

    return { invoices: custInvoices, payments: custPayments };
  }, [selectedCustomerName, allInvoices, allPayments]);

  return (
    <div className="space-y-6 max-w-6xl mx-auto pb-16">
      <Notification notification={notification} onClose={() => setNotification(null)} />

      {/* Header & Export Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-extrabold text-white">Financial Reports & Statements</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time revenue collections, payment method breakdowns, customer statements & aging analysis
          </p>
        </div>

        {/* Global Export Triggers */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() =>
              generateMonthlyInvoiceReportPdf(
                filteredInvoices,
                selectedYear,
                selectedMonth,
                currentProfile,
                totalPaymentsCollectedInPeriod
              )
            }
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95 min-h-[44px] sm:min-h-[36px]"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => exportMonthlyInvoiceReportCsv(filteredInvoices, selectedYear, selectedMonth)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors min-h-[44px] sm:min-h-[36px]"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* VIEW TABS */}
      <div className="flex overflow-x-auto gap-2 border-b border-zinc-850 pb-2">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
            activeTab === 'overview'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Financial Overview</span>
        </button>

        <button
          onClick={() => setActiveTab('methods')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
            activeTab === 'methods'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          <PieChart className="w-4 h-4" />
          <span>Payment Methods</span>
        </button>

        <button
          onClick={() => setActiveTab('statements')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
            activeTab === 'statements'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          <User className="w-4 h-4" />
          <span>Customer Statements</span>
        </button>

        <button
          onClick={() => setActiveTab('aging')}
          className={`px-4 py-2.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap min-h-[44px] ${
            activeTab === 'aging'
              ? 'bg-amber-500 text-zinc-950 shadow-md'
              : 'bg-zinc-900 text-zinc-400 hover:text-white border border-zinc-800'
          }`}
        >
          <AlertTriangle className="w-4 h-4" />
          <span>Aging Report</span>
        </button>
      </div>

      {/* FILTER CONTROLS BAR (For Overview & Methods tabs) */}
      {(activeTab === 'overview' || activeTab === 'methods') && (
        <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Period Type */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Report Period
              </label>
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodType)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-amber-400 font-bold focus:outline-none focus:border-amber-500"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>

            {/* Dynamic Date Inputs based on Period */}
            {(period === 'daily' || period === 'weekly') && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  {period === 'daily' ? 'Select Date' : 'Select Week Start Date'}
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  onClick={(e) => e.currentTarget.showPicker?.()}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 [color-scheme:dark]"
                />
              </div>
            )}

            {period === 'monthly' && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Select Month
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  {months.map((m) => (
                    <option key={m.value} value={m.value}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {(period === 'monthly' || period === 'yearly') && (
              <div>
                <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                  Select Year
                </label>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  {years.map((y) => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Status Selector */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Status Filter
              </label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
              >
                <option value="All">All Statuses</option>
                <option value="Draft">Draft</option>
                <option value="Issued">Issued</option>
                <option value="Partially Paid">Partially Paid</option>
                <option value="Paid">Paid</option>
                <option value="Overdue">Overdue</option>
                <option value="Cancelled">Cancelled</option>
              </select>
            </div>

            {/* Customer Search */}
            <div>
              <label className="block text-[11px] font-semibold text-zinc-400 mb-1">
                Search Text
              </label>
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Invoice, Customer..."
                  value={customerSearch}
                  onChange={(e) => setCustomerSearch(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-8 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 1: FINANCIAL OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* 5 Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
              <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                Total Invoice Value
              </p>
              <p className="text-base font-extrabold text-amber-400 mt-1">
                {formatLKR(totalInvoiceValue)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">{filteredInvoices.length} invoices in period</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
              <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                Payments Collected
              </p>
              <p className="text-base font-extrabold text-emerald-400 mt-1">
                {formatLKR(totalPaymentsCollectedInPeriod)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Collected during period</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
              <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                Advance Payments
              </p>
              <p className="text-base font-extrabold text-blue-400 mt-1">
                {formatLKR(advancePaymentsReceived)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Pre-issuance advance deposits</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
              <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                Outstanding Balance
              </p>
              <p className="text-base font-extrabold text-red-400 mt-1">
                {formatLKR(totalOutstandingBalance)}
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Balance due in period</p>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
              <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
                Collection Rate
              </p>
              <p className="text-base font-extrabold text-purple-400 mt-1">
                {collectionRate.toFixed(1)}%
              </p>
              <p className="text-[10px] text-zinc-500 mt-0.5">Total Collected: {formatLKR(totalCollected)}</p>
            </div>
          </div>

          {/* Status Breakdown Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-850 text-center">
              <span className="text-[10px] text-zinc-500 uppercase font-semibold">Draft</span>
              <p className="text-sm font-bold text-zinc-300 mt-0.5">{draftCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-850 text-center">
              <span className="text-[10px] text-blue-400 uppercase font-semibold">Issued</span>
              <p className="text-sm font-bold text-blue-300 mt-0.5">{issuedCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-850 text-center">
              <span className="text-[10px] text-purple-400 uppercase font-semibold">Partial</span>
              <p className="text-sm font-bold text-purple-300 mt-0.5">{partialCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-850 text-center">
              <span className="text-[10px] text-emerald-400 uppercase font-semibold">Paid</span>
              <p className="text-sm font-bold text-emerald-400 mt-0.5">{paidCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-850 text-center">
              <span className="text-[10px] text-amber-400 uppercase font-semibold">Overdue</span>
              <p className="text-sm font-bold text-amber-400 mt-0.5">{overdueCount}</p>
            </div>
            <div className="p-3 rounded-lg bg-zinc-900/80 border border-zinc-850 text-center">
              <span className="text-[10px] text-red-400 uppercase font-semibold">Cancelled</span>
              <p className="text-sm font-bold text-red-400 mt-0.5">{cancelledCount}</p>
            </div>
          </div>

          {/* Statement Invoices Table */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-850 flex items-center justify-between">
              <h2 className="text-xs font-bold text-white uppercase tracking-wider">
                Invoices Issued in Selected Period
              </h2>
              <span className="text-xs text-zinc-500 font-mono">
                {filteredInvoices.length} Record(s)
              </span>
            </div>

            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-850">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Vehicle / Details</th>
                    <th className="py-3 px-4 text-right">Net Amount</th>
                    <th className="py-3 px-4 text-right">Amount Paid</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60">
                  {filteredInvoices.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-8 text-center text-zinc-500">
                        No invoice records found for this period.
                      </td>
                    </tr>
                  ) : (
                    filteredInvoices.map((inv) => (
                      <tr key={inv.id} className="hover:bg-zinc-850/40 transition-colors">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">{inv.invoice_number}</td>
                        <td className="py-3 px-4 font-mono">{formatDate(inv.invoice_date)}</td>
                        <td className="py-3 px-4 font-semibold text-zinc-100">{inv.customer_name}</td>
                        <td className="py-3 px-4 text-zinc-400">
                          {inv.vehicle_name || inv.vehicle_registration_number || '-'}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-semibold text-zinc-200">
                          {formatLKR(inv.net_amount)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-emerald-400">
                          {formatLKR(inv.amount_paid)}
                        </td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">
                          {formatLKR(inv.balance_due)}
                        </td>
                        <td className="py-3 px-4 text-center">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeStyle(inv.status)}`}>
                            {inv.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAYMENT METHODS BREAKDOWN */}
      {activeTab === 'methods' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Payment Collection Methods Distribution
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Breakdown of collections by payment method for the selected period ({formatLKR(totalPaymentsCollectedInPeriod)} Total)
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {paymentMethodsBreakdown.map((item) => (
                <div key={item.method} className="p-4 rounded-xl bg-zinc-950 border border-zinc-850 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-200">{item.method}</span>
                    <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30">
                      {item.percentage.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-lg font-extrabold text-emerald-400 font-mono">
                    {formatLKR(item.total)}
                  </p>
                  <p className="text-[11px] text-zinc-500">
                    {item.count} transaction(s) recorded
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: CUSTOMER STATEMENTS */}
      {activeTab === 'statements' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                  Customer Statement of Account
                </h2>
                <p className="text-xs text-zinc-400 mt-0.5">
                  Select a customer to generate their complete financial ledger and export an official statement PDF
                </p>
              </div>

              {selectedCustomerName && (
                <button
                  type="button"
                  onClick={() =>
                    generateCustomerStatementPdf(
                      selectedCustomerName,
                      customerStatementData.invoices,
                      customerStatementData.payments,
                      currentProfile
                    )
                  }
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 shrink-0 min-h-[44px]"
                >
                  <Download className="w-4 h-4 text-zinc-950" />
                  <span>Export Statement PDF</span>
                </button>
              )}
            </div>

            {/* Customer Selector */}
            <div className="max-w-md">
              <label className="block text-xs font-semibold text-zinc-400 mb-1">
                Select Customer Account
              </label>
              <select
                value={selectedCustomerName}
                onChange={(e) => setSelectedCustomerName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-2.5 text-xs font-semibold text-amber-400 focus:outline-none focus:border-amber-500"
              >
                {customerOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {selectedCustomerName && (
            <div className="space-y-4">
              {/* Customer Ledger Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Total Invoiced</span>
                  <p className="text-lg font-black text-amber-400 mt-1 font-mono">
                    {formatLKR(
                      customerStatementData.invoices.reduce((acc, i) => acc + (i.net_amount || 0), 0)
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Total Collected</span>
                  <p className="text-lg font-black text-emerald-400 mt-1 font-mono">
                    {formatLKR(
                      customerStatementData.payments.reduce((acc, p) => acc + (p.amount || 0), 0) +
                        customerStatementData.invoices.reduce((acc, i) => acc + (i.advance_payment || 0), 0)
                    )}
                  </p>
                </div>

                <div className="p-4 rounded-xl bg-zinc-900 border border-zinc-800">
                  <span className="text-[10px] font-bold text-zinc-400 uppercase">Outstanding Balance</span>
                  <p className="text-lg font-black text-red-400 mt-1 font-mono">
                    {formatLKR(
                      customerStatementData.invoices.reduce((acc, i) => acc + (i.balance_due || 0), 0)
                    )}
                  </p>
                </div>
              </div>

              {/* Customer Invoices Table */}
              <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
                <div className="p-4 border-b border-zinc-850">
                  <h3 className="text-xs font-bold text-zinc-200 uppercase">
                    Account Invoices & Payment Ledger
                  </h3>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs text-zinc-300">
                    <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-850">
                      <tr>
                        <th className="py-3 px-4">Invoice #</th>
                        <th className="py-3 px-4">Date</th>
                        <th className="py-3 px-4">Vehicle</th>
                        <th className="py-3 px-4 text-right">Net Amount</th>
                        <th className="py-3 px-4 text-right">Paid</th>
                        <th className="py-3 px-4 text-right">Balance Due</th>
                        <th className="py-3 px-4 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-850/60">
                      {customerStatementData.invoices.map((inv) => (
                        <tr key={inv.id} className="hover:bg-zinc-850/40">
                          <td className="py-3 px-4 font-mono font-bold text-amber-400">{inv.invoice_number}</td>
                          <td className="py-3 px-4 font-mono">{formatDate(inv.invoice_date)}</td>
                          <td className="py-3 px-4 text-zinc-400">{inv.vehicle_name || '-'}</td>
                          <td className="py-3 px-4 text-right font-mono">{formatLKR(inv.net_amount)}</td>
                          <td className="py-3 px-4 text-right font-mono text-emerald-400">{formatLKR(inv.amount_paid)}</td>
                          <td className="py-3 px-4 text-right font-mono font-bold text-amber-400">{formatLKR(inv.balance_due)}</td>
                          <td className="py-3 px-4 text-center">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getStatusBadgeStyle(inv.status)}`}>
                              {inv.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 4: AGING ANALYSIS REPORT */}
      {activeTab === 'aging' && (
        <div className="space-y-6">
          <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 space-y-4">
            <div>
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Accounts Receivable Aging Analysis
              </h2>
              <p className="text-xs text-zinc-400 mt-0.5">
                Outstanding invoice balance breakdown categorized by days overdue
              </p>
            </div>

            {/* 4 Aging Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] font-bold text-emerald-400 uppercase">Current (0–30 Days)</span>
                <p className="text-xl font-extrabold text-emerald-400 mt-1 font-mono">
                  {formatLKR(agingData.bucket0to30.amount)}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{agingData.bucket0to30.count} invoice(s)</p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] font-bold text-amber-400 uppercase">31–60 Days</span>
                <p className="text-xl font-extrabold text-amber-400 mt-1 font-mono">
                  {formatLKR(agingData.bucket31to60.amount)}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{agingData.bucket31to60.count} invoice(s)</p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
                <span className="text-[10px] font-bold text-orange-400 uppercase">61–90 Days</span>
                <p className="text-xl font-extrabold text-orange-400 mt-1 font-mono">
                  {formatLKR(agingData.bucket61to90.amount)}
                </p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{agingData.bucket61to90.count} invoice(s)</p>
              </div>

              <div className="p-4 rounded-xl bg-zinc-950 border border-red-900/60 bg-red-950/20">
                <span className="text-[10px] font-bold text-red-400 uppercase">90+ Days (Severe Overdue)</span>
                <p className="text-xl font-extrabold text-red-400 mt-1 font-mono">
                  {formatLKR(agingData.bucket90Plus.amount)}
                </p>
                <p className="text-[10px] text-red-400/70 mt-0.5">{agingData.bucket90Plus.count} invoice(s)</p>
              </div>
            </div>
          </div>

          {/* Aging Detailed Table */}
          <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
            <div className="p-4 border-b border-zinc-850 flex items-center justify-between">
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Unpaid & Partially Paid Invoices Aging Breakdown
              </h3>
              <span className="text-xs text-zinc-500 font-mono">
                {agingData.items.length} Pending Invoice(s)
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-850">
                  <tr>
                    <th className="py-3 px-4">Invoice #</th>
                    <th className="py-3 px-4">Customer Name</th>
                    <th className="py-3 px-4">Due Date</th>
                    <th className="py-3 px-4 text-center">Days Overdue</th>
                    <th className="py-3 px-4 text-right">Net Amount</th>
                    <th className="py-3 px-4 text-right">Balance Due</th>
                    <th className="py-3 px-4 text-center">Aging Bucket</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-850/60">
                  {agingData.items.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-zinc-500">
                        No outstanding invoices found. All client balances are fully settled!
                      </td>
                    </tr>
                  ) : (
                    agingData.items.map(({ invoice: inv, daysOverdue, bucketLabel }) => (
                      <tr key={inv.id} className="hover:bg-zinc-850/40">
                        <td className="py-3 px-4 font-mono font-bold text-amber-400">{inv.invoice_number}</td>
                        <td className="py-3 px-4 font-semibold text-zinc-100">{inv.customer_name}</td>
                        <td className="py-3 px-4 font-mono text-zinc-400">{formatDate(inv.due_date)}</td>
                        <td className="py-3 px-4 text-center font-mono font-bold text-zinc-200">
                          {daysOverdue} day(s)
                        </td>
                        <td className="py-3 px-4 text-right font-mono text-zinc-300">{formatLKR(inv.net_amount)}</td>
                        <td className="py-3 px-4 text-right font-mono font-bold text-red-400">{formatLKR(inv.balance_due)}</td>
                        <td className="py-3 px-4 text-center">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                              bucketLabel === '90+ Days'
                                ? 'bg-red-950 text-red-400 border-red-800'
                                : bucketLabel === '61–90 Days'
                                ? 'bg-orange-950 text-orange-400 border-orange-800'
                                : bucketLabel === '31–60 Days'
                                ? 'bg-amber-950 text-amber-400 border-amber-800'
                                : 'bg-emerald-950 text-emerald-400 border-emerald-800'
                            }`}
                          >
                            {bucketLabel}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
