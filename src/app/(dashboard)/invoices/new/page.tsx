import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { InvoiceForm } from '@/components/invoices/InvoiceForm';
import {
  Profile,
  CompanySettings,
  BankSettings,
  InvoiceSettings,
  QrSettings,
} from '@/lib/types';

export const revalidate = 0;

export default async function NewInvoicePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch Profile & System Settings concurrently
  const [
    { data: profileData },
    { data: companyData },
    { data: bankData },
    { data: invoiceSettingsData },
    { data: qrData },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('company_settings').select('*').eq('id', 1).single(),
    supabase.from('bank_settings').select('*').eq('id', 1).single(),
    supabase.from('invoice_settings').select('*').eq('id', 1).single(),
    supabase.from('qr_settings').select('*').eq('id', 1).single(),
  ]);

  const profile: Profile = profileData || {
    id: user.id,
    email: user.email || '',
    full_name: user.user_metadata?.full_name || 'Staff User',
    role: 'Staff',
    designation: 'Executive',
    is_active: true,
  };

  const companySettings: CompanySettings = companyData || {
    company_name: 'Thennakoon Tours (Pvt) Ltd',
    address: 'No. 123, Galle Road, Colombo 03, Sri Lanka',
    phone: '+94 77 123 4567 / +94 11 234 5678',
    email: 'info@thennakoontours.com',
    website: 'www.thennakoontours.com',
    letterhead_enabled: true,
    letterhead_url: '/documents/thennakoon-tours-letterhead.png',
  };

  const bankSettings: BankSettings = bankData || {
    account_name: 'Thennakoon Tours (Pvt) Ltd',
    account_number: '1234567890',
    bank_name: 'Commercial Bank of Ceylon',
    branch: 'Colombo Main Branch',
    swift_code: 'CCBCEKLX',
  };

  const invoiceSettings: InvoiceSettings = invoiceSettingsData || {
    prefix: 'TT-IN',
    default_payment_terms: '7 Days',
    default_due_days: 7,
    default_tax_rate: 0,
    default_special_notes: 'Thank you for choosing Thennakoon Tours for your travel needs.',
    default_important_notes:
      'Payment is due within the agreed payment terms. Please quote the invoice number when making payments. Refundable deposit will be returned upon vehicle inspection after completion of rental.',
    show_qr_code: true,
    show_prepared_by: true,
  };

  const qrSettings: QrSettings = qrData || {
    qr_enabled: true,
    qr_image_url: '',
    qr_label: 'Scan to Pay via Bank App',
  };

  return (
    <InvoiceForm
      currentProfile={profile}
      companySettings={companySettings}
      bankSettings={bankSettings}
      invoiceSettings={invoiceSettings}
      qrSettings={qrSettings}
    />
  );
}
