import React from 'react';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { Profile } from '@/lib/types';
import { ReportsClient } from './reports-client';
import { ShieldAlert } from 'lucide-react';

export default async function ReportsPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Retrieve current user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  const role = profile?.role?.trim().toLowerCase();

  // Access Control: Owner and Admin only
  if (role !== 'owner' && role !== 'admin') {
    return (
      <div className="max-w-xl mx-auto my-16 p-8 rounded-2xl bg-zinc-900 border border-zinc-800 text-center space-y-4 shadow-2xl">
        <div className="w-12 h-12 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center mx-auto text-red-400">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h1 className="text-lg font-bold text-white">Access Restricted</h1>
        <p className="text-xs text-zinc-400 leading-relaxed">
          The Monthly Reports module is restricted to Owner and Admin users only. Staff accounts do not have permission to inspect monthly financial statements.
        </p>
      </div>
    );
  }

  return <ReportsClient currentProfile={profile as Profile} />;
}
