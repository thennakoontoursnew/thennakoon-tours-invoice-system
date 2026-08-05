'use client';

import React, { useState, useEffect, useTransition, useCallback } from 'react';
import {
  BarChart3,
  Calendar,
  Filter,
  Download,
  FileSpreadsheet,
  Printer,
  RotateCcw,
  Search,
  Loader2,
  HelpCircle,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Invoice, Profile } from '@/lib/types';
import { formatDate, formatLKR, getStatusBadgeStyle } from '@/lib/utils';
import { generateMonthlyInvoiceReportPdf } from '@/lib/pdf/generateMonthlyInvoiceReportPdf';
import { exportMonthlyInvoiceReportCsv } from '@/lib/csv/exportMonthlyInvoiceReportCsv';
import { Notification, NotificationState } from '@/components/ui/Notification';

interface ReportsClientProps {
  currentProfile: Profile;
}

export function ReportsClient({ currentProfile }: ReportsClientProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [selectedStatus, setSelectedStatus] = useState<string>('All');
  const [customerSearch, setCustomerSearch] = useState<string>('');

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [monthlyPayments, setMonthlyPayments] = useState<number>(0);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // Month names helper
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

  // Fetch Invoices and Monthly Collections for Selected Month Range
  const fetchMonthlyInvoices = useCallback(async () => {
    startTransition(async () => {
      try {
        const monthStr = String(selectedMonth).padStart(2, '0');
        const startDate = `${selectedYear}-${monthStr}-01`;

        // Calculate next month start date
        let nextYear = selectedYear;
        let nextMonth = selectedMonth + 1;
        if (nextMonth > 12) {
          nextMonth = 1;
          nextYear += 1;
        }
        const nextMonthStr = String(nextMonth).padStart(2, '0');
        const endDate = `${nextYear}-${nextMonthStr}-01`;

        // Query invoices created in month
        let query = supabase
          .from('invoices')
          .select(
            'id, invoice_number, invoice_date, due_date, customer_name, customer_phone, vehicle_name, vehicle_registration_number, subtotal, discount, deduction, tax_amount, advance_payment, net_amount, amount_paid, balance_due, status, archived_at'
          )
          .is('archived_at', null)
          .gte('invoice_date', startDate)
          .lt('invoice_date', endDate)
          .order('invoice_date', { ascending: false });

        if (selectedStatus !== 'All') {
          query = query.eq('status', selectedStatus);
        }

        const [{ data: invData, error: invErr }, { data: payData, error: payErr }] = await Promise.all([
          query,
          supabase
            .from('invoice_payments')
            .select('amount')
            .gte('payment_date', startDate)
            .lt('payment_date', endDate)
            .eq('is_reversed', false),
        ]);

        if (invErr) throw invErr;
        if (payErr) console.error('Error fetching payments for report:', payErr);

        setInvoices((invData as Invoice[]) || []);

        const totalPaymentsInMonth = (payData || []).reduce((sum, p) => sum + (p.amount || 0), 0);
        setMonthlyPayments(totalPaymentsInMonth);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to fetch report data.';
        setNotification({ type: 'error', message: msg });
      }
    });
  }, [selectedMonth, selectedYear, selectedStatus, supabase]);

  useEffect(() => {
    fetchMonthlyInvoices();
  }, [fetchMonthlyInvoices]);

  const handleResetFilters = () => {
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
    setSelectedStatus('All');
    setCustomerSearch('');
  };

  // Filter by customer search text locally
  const filteredInvoices = invoices.filter((inv) => {
    if (!customerSearch.trim()) return true;
    const q = customerSearch.trim().toLowerCase();
    const num = (inv.invoice_number || '').toLowerCase();
    const cust = (inv.customer_name || '').toLowerCase();
    const phone = (inv.customer_phone || '').toLowerCase();
    const vehicle = (inv.vehicle_name || inv.vehicle_registration_number || '').toLowerCase();
    return num.includes(q) || cust.includes(q) || phone.includes(q) || vehicle.includes(q);
  });

  // Financial calculations excluding Cancelled and Archived
  const validFinancialInvoices = filteredInvoices.filter((i) => i.status !== 'Cancelled');
  const totalInvoiceValue = validFinancialInvoices.reduce((sum, i) => sum + (i.net_amount || 0), 0);
  const advancePaymentsReceived = validFinancialInvoices.reduce((sum, i) => sum + (i.advance_payment || 0), 0);
  const totalCollected = advancePaymentsReceived + monthlyPayments;
  const totalOutstandingBalance = validFinancialInvoices.reduce((sum, i) => sum + (i.balance_due || 0), 0);
  const collectionRate = totalInvoiceValue > 0 ? (totalCollected / totalInvoiceValue) * 100 : 0;

  // Counts by status
  const draftCount = filteredInvoices.filter((i) => i.status === 'Draft').length;
  const issuedCount = filteredInvoices.filter((i) => i.status === 'Issued').length;
  const paidCount = filteredInvoices.filter((i) => i.status === 'Paid').length;
  const partialCount = filteredInvoices.filter((i) => i.status === 'Partially Paid').length;
  const overdueCount = filteredInvoices.filter((i) => i.status === 'Overdue').length;
  const cancelledCount = filteredInvoices.filter((i) => i.status === 'Cancelled').length;

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      <Notification notification={notification} onClose={() => setNotification(null)} />

      {/* Action Bar & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-400" />
            <h1 className="text-xl font-extrabold text-white">Monthly Reports</h1>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Financial summaries, monthly invoice statements, PDF & CSV exports for Thennakoon Tours
          </p>
        </div>

        {/* Action Buttons (Hidden during Print) */}
        <div className="flex flex-wrap items-center gap-2 print:hidden">
          <button
            type="button"
            onClick={() => generateMonthlyInvoiceReportPdf(filteredInvoices, selectedYear, selectedMonth, currentProfile, monthlyPayments)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 text-xs font-bold transition-all shadow-md active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Download PDF</span>
          </button>

          <button
            type="button"
            onClick={() => exportMonthlyInvoiceReportCsv(filteredInvoices, selectedYear, selectedMonth)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            <span>Export CSV</span>
          </button>

          <button
            type="button"
            onClick={() => window.print()}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold border border-zinc-700 transition-colors"
          >
            <Printer className="w-4 h-4 text-amber-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* FILTER SECTION (Hidden during Print) */}
      <div className="p-5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-xl space-y-4 print:hidden">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-850">
          <Filter className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Report Date & Search Filters
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Month Selector */}
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

          {/* Year Selector */}
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
          <div className="sm:col-span-2 md:col-span-1">
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

          {/* Reset Button */}
          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={fetchMonthlyInvoices}
              disabled={isPending}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-xs font-semibold transition-colors disabled:opacity-50"
            >
              {isPending ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Calendar className="w-3.5 h-3.5" />
              )}
              <span>Apply</span>
            </button>

            <button
              type="button"
              onClick={handleResetFilters}
              className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white border border-zinc-700 transition-colors"
              title="Reset Filters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 10 SUMMARY CARDS */}
      <div className="space-y-4">
        {/* Main Financial Totals (Row 1) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
            <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
              Total Invoice Value
            </p>
            <p className="text-base font-extrabold text-amber-400 mt-1">
              {formatLKR(totalInvoiceValue)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">{filteredInvoices.length} invoices created</p>
          </div>

          <div className="p-3.5 rounded-xl bg-zinc-900 border border-zinc-800 shadow-md">
            <p className="text-[10px] font-bold uppercase text-zinc-400 tracking-wider">
              Payments in Month
            </p>
            <p className="text-base font-extrabold text-emerald-400 mt-1">
              {formatLKR(monthlyPayments)}
            </p>
            <p className="text-[10px] text-zinc-500 mt-0.5">Collected during selected month</p>
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
            <p className="text-[10px] text-zinc-500 mt-0.5">Current balance due</p>
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

        {/* Status Breakdown Cards (Row 2) */}
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
      </div>

      {/* MONTHLY INVOICE STATEMENT (DESKTOP TABLE VIEW) */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            Monthly Invoice Statement — {months.find((m) => m.value === selectedMonth)?.label} {selectedYear}
          </h2>
          <span className="text-[11px] text-zinc-400 font-mono">
            Showing {filteredInvoices.length} invoices
          </span>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">Invoice No</th>
                <th className="py-3.5 px-4">Date</th>
                <th className="py-3.5 px-4">Customer Name</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Vehicle</th>
                <th className="py-3.5 px-4 text-right">Net Amount</th>
                <th className="py-3.5 px-4 text-right">Amount Paid</th>
                <th className="py-3.5 px-4 text-right">Balance Due</th>
                <th className="py-3.5 px-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/60">
              {isPending ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-400 mb-2" />
                    <p className="text-xs">Loading monthly report records...</p>
                  </td>
                </tr>
              ) : filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-zinc-500">
                    <HelpCircle className="w-8 h-8 mx-auto text-zinc-600 mb-2" />
                    <p className="text-xs font-semibold text-zinc-400">No invoices found for this month.</p>
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const statusStyle = getStatusBadgeStyle(inv.status);
                  const isCancelled = inv.status === 'Cancelled';

                  return (
                    <tr
                      key={inv.id}
                      className={`transition-colors ${
                        isCancelled ? 'bg-red-950/20 hover:bg-red-950/30' : 'hover:bg-zinc-850/40'
                      }`}
                    >
                      <td className="py-3.5 px-4 font-bold text-amber-400 font-mono">
                        {inv.invoice_number}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300">
                        {formatDate(inv.invoice_date)}
                      </td>
                      <td className="py-3.5 px-4 font-semibold text-zinc-100">
                        {inv.customer_name || 'N/A'}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-400 font-mono">
                        {inv.customer_phone || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-zinc-300">
                        {inv.vehicle_name || inv.vehicle_registration_number || '-'}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-semibold text-zinc-200">
                        {formatLKR(inv.net_amount || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono text-emerald-400">
                        {formatLKR(inv.amount_paid || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-red-400">
                        {formatLKR(inv.balance_due || 0)}
                      </td>
                      <td className="py-3.5 px-4 text-center">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusStyle}`}>
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile Card View */}
        <div className="md:hidden p-3 space-y-3">
          {isPending ? (
            <div className="py-8 text-center text-zinc-400">
              <Loader2 className="w-5 h-5 animate-spin mx-auto text-amber-400 mb-1" />
              <p className="text-xs">Loading records...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="p-6 text-center text-zinc-500 text-xs">
              No invoices found for this month.
            </div>
          ) : (
            filteredInvoices.map((inv) => (
              <div
                key={inv.id}
                className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-850 space-y-2.5 shadow-md"
              >
                <div className="flex items-center justify-between border-b border-zinc-850 pb-2">
                  <div>
                    <span className="font-bold text-amber-400 font-mono text-xs">
                      {inv.invoice_number}
                    </span>
                    <p className="text-[10px] text-zinc-400">{formatDate(inv.invoice_date)}</p>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${getStatusBadgeStyle(inv.status)}`}>
                    {inv.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-500">Customer</p>
                    <p className="font-semibold text-zinc-100 truncate">{inv.customer_name || 'N/A'}</p>
                    {inv.customer_phone && <p className="text-[10px] text-zinc-400 font-mono">{inv.customer_phone}</p>}
                  </div>
                  <div>
                    <p className="text-[10px] uppercase font-bold text-zinc-500">Vehicle</p>
                    <p className="text-zinc-300 truncate">{inv.vehicle_name || inv.vehicle_registration_number || '-'}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg bg-zinc-900 border border-zinc-850 text-xs">
                  <div>
                    <span className="text-[10px] text-zinc-500">Net Amount:</span>
                    <p className="font-semibold text-zinc-200 font-mono">{formatLKR(inv.net_amount || 0)}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-zinc-500">Balance Due:</span>
                    <p className="font-bold text-red-400 font-mono">{formatLKR(inv.balance_due || 0)}</p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
