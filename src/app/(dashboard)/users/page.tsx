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

  // Verify current user is Owner
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profileData || profileData.role !== 'Owner') {
    redirect('/');
  }

  // Fetch all user profiles
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
