'use client';

import React, { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  FilePlus2,
  Search,
  Eye,
  Download,
  Edit,
  Copy,
  Archive,
  RotateCcw,
  Lock,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Invoice, InvoiceStatus, Profile } from '@/lib/types';
import { formatDate, formatLKR, getStatusBadgeStyle } from '@/lib/utils';
import { downloadInvoicePdf } from '@/lib/pdf/generateInvoicePdf';
import { PdfPreviewModal } from '@/components/pdf/PdfPreviewModal';
import { Notification, NotificationState } from '@/components/ui/Notification';

interface InvoicesClientProps {
  initialInvoices: Invoice[];
  currentProfile: Profile;
}

export function InvoicesClient({
  initialInvoices,
  currentProfile,
}: InvoicesClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [, startTransition] = useTransition();

  const [invoices, setInvoices] = useState<Invoice[]>(initialInvoices);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('All');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [startDateFilter, setStartDateFilter] = useState<string>('');
  const [endDateFilter, setEndDateFilter] = useState<string>('');

  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const isOwnerOrAdmin =
    currentProfile.role === 'Owner' || currentProfile.role === 'Admin';

  const filteredInvoices = invoices.filter((inv) => {
    if (showArchived ? !inv.archived_at : inv.archived_at) {
      return false;
    }

    if (statusFilter !== 'All' && inv.status !== statusFilter) {
      return false;
    }

    if (startDateFilter && new Date(inv.invoice_date) < new Date(startDateFilter)) {
      return false;
    }
    if (endDateFilter && new Date(inv.invoice_date) > new Date(endDateFilter)) {
      return false;
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchNum = inv.invoice_number?.toLowerCase().includes(query);
      const matchCust = inv.customer_name?.toLowerCase().includes(query);
      const matchPhone = inv.customer_phone?.toLowerCase().includes(query);
      const matchVehicle = inv.vehicle_registration_number
        ?.toLowerCase()
        .includes(query);
      const matchModel = inv.vehicle_name?.toLowerCase().includes(query);

      if (!matchNum && !matchCust && !matchPhone && !matchVehicle && !matchModel) {
        return false;
      }
    }

    return true;
  });

  const handlePreview = (inv: Invoice) => {
    setSelectedInvoice(inv);
    setIsPreviewOpen(true);
  };

  const handleDownload = (inv: Invoice) => {
    downloadInvoicePdf(inv);
  };

  const handleDuplicate = async (inv: Invoice) => {
    startTransition(async () => {
      try {
        const year = new Date().getFullYear();
        const { data: seqData } = await supabase.rpc(
          'generate_next_invoice_number',
          { p_year: year }
        );

        const newNumber =
          seqData?.[0]?.new_invoice_number || `TT-IN-${year}-${Math.floor(1000 + Math.random() * 9000)}`;

        const newNet = inv.subtotal + (inv.tax_amount || 0) - (inv.discount || 0) - (inv.deduction || 0) - (inv.advance_payment || 0);

        const duplicatePayload = {
          invoice_number: newNumber,
          invoice_year: year,
          invoice_sequence: 1,
          status: 'Draft' as InvoiceStatus,
          invoice_date: new Date().toISOString().split('T')[0],
          due_date: new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
          payment_terms: inv.payment_terms || '7 Days',
          quotation_reference: inv.quotation_reference,

          customer_name: inv.customer_name,
          customer_phone: inv.customer_phone,
          customer_email: inv.customer_email,
          customer_address: inv.customer_address,
          customer_company: inv.customer_company,
          customer_reference: inv.customer_reference,

          nature_of_invoice: inv.nature_of_invoice,
          vehicle_name: inv.vehicle_name,
          vehicle_registration_number: inv.vehicle_registration_number,
          rental_start_date: inv.rental_start_date,
          rental_end_date: inv.rental_end_date,
          rental_days: inv.rental_days,
          destination: inv.destination,
          pickup_location: inv.pickup_location,
          dropoff_location: inv.dropoff_location,

          subtotal: inv.subtotal,
          discount: inv.discount,
          deduction: inv.deduction,
          tax_amount: inv.tax_amount,
          advance_payment: inv.advance_payment,
          net_amount: Math.max(0, newNet),
          amount_paid: 0,
          balance_due: Math.max(0, newNet),

          special_notes: inv.special_notes,
          important_notes: inv.important_notes,
          internal_notes: `Duplicated from ${inv.invoice_number}`,

          items_snapshot: inv.items_snapshot,
          company_snapshot: inv.company_snapshot,
          bank_snapshot: inv.bank_snapshot,
          qr_snapshot: inv.qr_snapshot,
          prepared_by: currentProfile.full_name,
          prepared_by_snapshot: {
            full_name: currentProfile.full_name,
            designation: currentProfile.designation || 'Executive',
            email: currentProfile.email,
          },

          created_by: currentProfile.id,
          updated_by: currentProfile.id,
        };

        const { data, error } = await supabase
          .from('invoices')
          .insert(duplicatePayload)
          .select('*')
          .single();

        if (error) throw error;

        setInvoices([data as Invoice, ...invoices]);
        setNotification({
          type: 'success',
          message: `Duplicated into new Draft ${newNumber}.`,
        });

        router.push(`/invoices/${data.id}`);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to duplicate invoice.';
        setNotification({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  const handleChangeStatus = async (inv: Invoice, newStatus: InvoiceStatus) => {
    startTransition(async () => {
      try {
        const { error } = await supabase
          .from('invoices')
          .update({ status: newStatus, updated_by: currentProfile.id })
          .eq('id', inv.id);

        if (error) throw error;

        setInvoices(
          invoices.map((item) =>
            item.id === inv.id ? { ...item, status: newStatus } : item
          )
        );

        setNotification({
          type: 'success',
          message: `Status updated to ${newStatus}.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update status.';
        setNotification({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  const handleToggleArchive = async (inv: Invoice, archive: boolean) => {
    startTransition(async () => {
      try {
        const archived_at = archive ? new Date().toISOString() : null;
        const { error } = await supabase
          .from('invoices')
          .update({ archived_at, updated_by: currentProfile.id })
          .eq('id', inv.id);

        if (error) throw error;

        setInvoices(
          invoices.map((item) =>
            item.id === inv.id ? { ...item, archived_at } : item
          )
        );

        setNotification({
          type: 'success',
          message: archive
            ? `Invoice ${inv.invoice_number} archived.`
            : `Invoice ${inv.invoice_number} restored.`,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to update archive status.';
        setNotification({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  return (
    <div className="space-y-6">
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
        <div>
          <h1 className="text-xl font-extrabold text-white">Invoice History</h1>
          <p className="text-xs text-zinc-400">
            Search, filter, edit, duplicate, and manage all saved invoice records
          </p>
        </div>

        <Link
          href="/invoices/new"
          className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 shrink-0"
        >
          <FilePlus2 className="w-4 h-4" />
          <span>New Invoice</span>
        </Link>
      </div>

      {/* Search & Filter Bar */}
      <div className="p-4 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {/* Search */}
          <div className="lg:col-span-2 relative">
            <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search Invoice #, Customer, Phone, Vehicle..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* Status Dropdown */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
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

          {/* Start Date */}
          <div>
            <input
              type="date"
              value={startDateFilter}
              onChange={(e) => setStartDateFilter(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>

          {/* End Date */}
          <div>
            <input
              type="date"
              value={endDateFilter}
              onChange={(e) => setEndDateFilter(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
            />
          </div>
        </div>

        {/* Toggle Archived */}
        {isOwnerOrAdmin && (
          <div className="flex items-center gap-2 pt-2 border-t border-zinc-850">
            <button
              onClick={() => setShowArchived(!showArchived)}
              className={`text-xs px-3 py-1 rounded-md font-semibold border transition-colors ${
                showArchived
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  : 'bg-zinc-950 text-zinc-400 border-zinc-800 hover:text-zinc-200'
              }`}
            >
              {showArchived ? 'Showing Archived Invoices' : 'Show Archived Invoices'}
            </button>
          </div>
        )}
      </div>

      {/* Invoice Records Table */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-850">
              <tr>
                <th className="py-3.5 px-4">Invoice #</th>
                <th className="py-3.5 px-4">Customer</th>
                <th className="py-3.5 px-4">Vehicle</th>
                <th className="py-3.5 px-4">Dates</th>
                <th className="py-3.5 px-4 text-right">Net Amount</th>
                <th className="py-3.5 px-4 text-right">Balance Due</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/60">
              {filteredInvoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-10 text-zinc-500">
                    No matching invoice records found.
                  </td>
                </tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const canStaffEdit =
                    currentProfile.role === 'Staff' && inv.status === 'Draft';
                  const canEdit = isOwnerOrAdmin || canStaffEdit;

                  return (
                    <tr
                      key={inv.id}
                      className="hover:bg-zinc-850/40 transition-colors"
                    >
                      <td className="py-3.5 px-4 font-bold text-amber-400 font-mono">
                        {inv.invoice_number}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-zinc-100">
                          {inv.customer_name}
                        </p>
                        {inv.customer_phone && (
                          <p className="text-[11px] text-zinc-500">
                            {inv.customer_phone}
                          </p>
                        )}
                      </td>

                      <td className="py-3.5 px-4">
                        <p className="text-zinc-300">
                          {inv.vehicle_name || inv.nature_of_invoice || 'Rental'}
                        </p>
                        {inv.vehicle_registration_number && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                            {inv.vehicle_registration_number}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-zinc-400">
                        <p>Inv: {formatDate(inv.invoice_date)}</p>
                        <p className="text-[10px] text-zinc-500">
                          Due: {formatDate(inv.due_date)}
                        </p>
                      </td>

                      <td className="py-3.5 px-4 text-right font-medium text-zinc-200">
                        {formatLKR(inv.net_amount)}
                      </td>

                      <td className="py-3.5 px-4 text-right font-bold text-amber-400">
                        {formatLKR(inv.balance_due)}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        {isOwnerOrAdmin ? (
                          <select
                            value={inv.status}
                            onChange={(e) =>
                              handleChangeStatus(inv, e.target.value as InvoiceStatus)
                            }
                            className={`px-2 py-1 rounded text-[10px] font-semibold border bg-zinc-950 focus:outline-none ${getStatusBadgeStyle(
                              inv.status
                            )}`}
                          >
                            <option value="Draft">Draft</option>
                            <option value="Issued">Issued</option>
                            <option value="Partially Paid">Partially Paid</option>
                            <option value="Paid">Paid</option>
                            <option value="Overdue">Overdue</option>
                            <option value="Cancelled">Cancelled</option>
                          </select>
                        ) : (
                          <span
                            className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold border ${getStatusBadgeStyle(
                              inv.status
                            )}`}
                          >
                            {inv.status}
                          </span>
                        )}
                      </td>

                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <button
                            onClick={() => handlePreview(inv)}
                            title="Preview PDF"
                            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDownload(inv)}
                            title="Download PDF"
                            className="p-1.5 rounded-md hover:bg-zinc-800 text-amber-400 hover:text-amber-300 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                          </button>

                          <button
                            onClick={() => handleDuplicate(inv)}
                            title="Duplicate Invoice"
                            className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors"
                          >
                            <Copy className="w-4 h-4" />
                          </button>

                          {canEdit ? (
                            <Link
                              href={`/invoices/${inv.id}`}
                              title="Edit Invoice"
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-blue-400 hover:text-blue-300 transition-colors"
                            >
                              <Edit className="w-4 h-4" />
                            </Link>
                          ) : (
                            <span
                              title="Paid / Finalized Invoices are locked for Staff"
                              className="p-1.5 text-zinc-600 cursor-not-allowed"
                            >
                              <Lock className="w-4 h-4" />
                            </span>
                          )}

                          {isOwnerOrAdmin && (
                            <button
                              onClick={() =>
                                handleToggleArchive(inv, !inv.archived_at)
                              }
                              title={
                                inv.archived_at ? 'Restore Invoice' : 'Archive Invoice'
                              }
                              className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-amber-400 transition-colors"
                            >
                              {inv.archived_at ? (
                                <RotateCcw className="w-4 h-4 text-amber-400" />
                              ) : (
                                <Archive className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      <PdfPreviewModal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        invoice={selectedInvoice}
      />
    </div>
  );
}
