import { Invoice } from '@/lib/types';
import { formatDate } from '@/lib/utils';

export function exportMonthlyInvoiceReportCsv(
  invoices: Invoice[],
  year: number,
  month: number
): void {
  const monthStr = String(month).padStart(2, '0');
  const filename = `TT-Monthly-Invoice-Report-${year}-${monthStr}.csv`;

  // CSV Headers
  const headers = [
    'Invoice Number',
    'Invoice Date',
    'Customer Name',
    'Phone',
    'Vehicle',
    'Net Amount (LKR)',
    'Amount Paid (LKR)',
    'Balance Due (LKR)',
    'Status',
  ];

  // Format CSV Rows
  const rows = invoices.map((inv) => {
    const vehicle = inv.vehicle_name || inv.vehicle_registration_number || 'N/A';
    return [
      `"${inv.invoice_number.replace(/"/g, '""')}"`,
      `"${formatDate(inv.invoice_date)}"`,
      `"${(inv.customer_name || '').replace(/"/g, '""')}"`,
      `"${(inv.customer_phone || '').replace(/"/g, '""')}"`,
      `"${vehicle.replace(/"/g, '""')}"`,
      (inv.net_amount || 0).toFixed(2),
      (inv.amount_paid || 0).toFixed(2),
      (inv.balance_due || 0).toFixed(2),
      `"${(inv.status || '').replace(/"/g, '""')}"`,
    ];
  });

  // Include UTF-8 BOM for Microsoft Excel compatibility
  const csvContent =
    '\uFEFF' +
    headers.join(',') +
    '\n' +
    rows.map((r) => r.join(',')).join('\n');

  // Trigger file download
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
