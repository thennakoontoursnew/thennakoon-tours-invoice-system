import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { InvoiceStatus } from './types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatLKR(amount: number): string {
  if (isNaN(amount) || amount === null || amount === undefined) {
    return 'LKR 0.00';
  }
  const formatted = new Intl.NumberFormat('en-LK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
  return `LKR ${formatted}`;
}

export function formatDate(dateString?: string | null): string {
  if (!dateString) return '-';
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString;
    return new Intl.DateTimeFormat('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(d);
  } catch {
    return dateString;
  }
}

export function getStatusBadgeStyle(status: InvoiceStatus): string {
  switch (status) {
    case 'Draft':
      return 'bg-zinc-800 text-zinc-300 border-zinc-700';
    case 'Issued':
      return 'bg-blue-950/80 text-blue-400 border-blue-800/60';
    case 'Partially Paid':
      return 'bg-amber-950/80 text-amber-400 border-amber-800/60';
    case 'Paid':
      return 'bg-emerald-950/80 text-emerald-400 border-emerald-800/60';
    case 'Overdue':
      return 'bg-red-950/80 text-red-400 border-red-800/60';
    case 'Cancelled':
      return 'bg-zinc-900 text-zinc-500 border-zinc-800 line-through';
    default:
      return 'bg-zinc-800 text-zinc-300 border-zinc-700';
  }
}
