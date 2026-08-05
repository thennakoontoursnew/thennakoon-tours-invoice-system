export type UserRole = 'Owner' | 'Admin' | 'Staff';

export type InvoiceStatus = 'Draft' | 'Issued' | 'Partially Paid' | 'Paid' | 'Overdue' | 'Cancelled';

export type PaymentMethod =
  | 'Cash'
  | 'Bank Transfer'
  | 'Online Transfer'
  | 'Card'
  | 'Cheque'
  | 'Other';

export interface InvoicePayment {
  id: string;
  invoice_id: string;
  payment_date: string;
  amount: number;
  payment_method: PaymentMethod;
  reference_number?: string | null;
  notes?: string | null;
  is_reversed?: boolean;
  reversed_at?: string | null;
  reversed_by?: string | null;
  reversal_reason?: string | null;
  created_by?: string | null;
  created_by_name?: string | null;
  running_balance?: number | null;
  created_at: string;
  creator?: Profile | null;
}

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  designation?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface InvoiceItem {
  id?: string;
  invoice_id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  line_total: number;
  sort_order?: number;
}

export interface CompanySnapshot {
  company_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  letterhead_enabled: boolean;
  letterhead_url?: string;
}

export interface BankSnapshot {
  account_name: string;
  account_number: string;
  bank_name: string;
  branch: string;
  swift_code: string;
}

export interface QrSnapshot {
  qr_enabled: boolean;
  qr_image_url?: string;
  qr_label?: string;
}

export interface DeductionItem {
  description: string;
  amount: number;
}

export interface PreparedBySnapshot {
  full_name: string;
  designation: string;
  email: string;
}

export interface Invoice {
  id: string;
  invoice_number: string;
  invoice_year?: number;
  invoice_sequence: number;
  status: InvoiceStatus;
  invoice_date: string;
  due_date: string;
  payment_terms: string;
  quotation_reference?: string;

  // Customer
  customer_name: string;
  customer_phone?: string;
  customer_email?: string;
  customer_address?: string;
  customer_company?: string;
  customer_reference?: string;

  // Rental / Vehicle
  nature_of_invoice: string;
  vehicle_name?: string;
  vehicle_registration_number?: string;
  rental_start_date?: string;
  rental_end_date?: string;
  rental_days: number;
  destination?: string;
  pickup_location?: string;
  dropoff_location?: string;

  // Financials
  subtotal: number;
  discount: number;
  deduction: number;
  tax_amount: number;
  advance_payment: number;
  net_amount: number;
  amount_paid: number;
  balance_due: number;

  // Notes
  special_notes?: string;
  important_notes?: string;
  internal_notes?: string;

  // Snapshots
  items_snapshot: InvoiceItem[];
  deduction_items?: DeductionItem[];
  company_snapshot: CompanySnapshot;
  bank_snapshot: BankSnapshot;
  qr_snapshot: QrSnapshot;
  prepared_by?: string;
  prepared_by_snapshot?: PreparedBySnapshot;

  created_by?: string;
  updated_by?: string;
  created_at: string;
  updated_at: string;
  archived_at?: string | null;
}

export interface CompanySettings {
  id?: number;
  company_name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  letterhead_enabled: boolean;
  letterhead_url: string;
}

export interface BankSettings {
  id?: number;
  account_name: string;
  account_number: string;
  bank_name: string;
  branch: string;
  swift_code: string;
}

export interface InvoiceSettings {
  id?: number;
  prefix: string;
  default_payment_terms: string;
  default_due_days: number;
  default_tax_rate: number;
  default_special_notes: string;
  default_important_notes: string;
  show_qr_code: boolean;
  show_prepared_by: boolean;
}

export interface QrSettings {
  id?: number;
  qr_enabled: boolean;
  qr_image_url: string;
  qr_label: string;
}
