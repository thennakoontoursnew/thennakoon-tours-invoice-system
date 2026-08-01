import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/lib/types';
import { UsersClient } from './users-client';

export const revalidate = 0;

export default async function UsersManagementPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const role = profileData?.role?.trim().toLowerCase();
  if (!profileData || role !== 'owner') {
    redirect('/dashboard');
  }

  const { data: allProfiles } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <UsersClient
      currentOwnerProfile={profileData as Profile}
      initialProfiles={(allProfiles as Profile[]) || []}
    />
  );
}
