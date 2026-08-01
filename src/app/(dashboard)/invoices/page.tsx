import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Invoice, Profile } from '@/lib/types';
import { InvoicesClient } from './invoices-client';

export const revalidate = 0;

export default async function InvoicesHistoryPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const [{ data: profileData }, { data: invoicesData }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase
      .from('invoices')
      .select('*')
      .order('created_at', { ascending: false }),
  ]);

  const profile: Profile = profileData || {
    id: user.id,
    email: user.email || '',
    full_name: 'Staff User',
    role: 'Staff',
    designation: 'Executive',
    is_active: true,
  };

  return (
    <InvoicesClient
      initialInvoices={(invoicesData as Invoice[]) || []}
      currentProfile={profile}
    />
  );
}
