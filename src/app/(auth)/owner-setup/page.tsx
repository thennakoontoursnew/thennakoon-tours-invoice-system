'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Mail, Lock, User, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Notification, NotificationState } from '@/components/ui/Notification';

export default function OwnerSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [checking, setChecking] = useState(true);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [designation, setDesignation] = useState('Managing Director');
  const [notification, setNotification] = useState<NotificationState | null>(null);

  useEffect(() => {
    async function checkExistingProfiles() {
      try {
        const { count, error } = await supabase
          .from('profiles')
          .select('*', { count: 'exact', head: true });

        if (!error && count && count > 0) {
          router.replace('/login');
        } else {
          setChecking(false);
        }
      } catch {
        setChecking(false);
      }
    }
    checkExistingProfiles();
  }, [router, supabase]);

  const handleCreateOwner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !email || !password) {
      setNotification({
        type: 'error',
        message: 'Please fill in all required fields.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
              designation: designation || 'Managing Director',
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          await supabase
            .from('profiles')
            .update({
              full_name: fullName,
              role: 'Owner',
              designation,
            })
            .eq('id', data.user.id);
        }

        setNotification({
          type: 'success',
          message: 'Initial Owner account created successfully! Redirecting to login...',
        });

        setTimeout(() => {
          router.replace('/login');
        }, 1200);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create Owner account.';
        setNotification({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  if (checking) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center text-zinc-400">
        <Loader2 className="w-8 h-8 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />

      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <ShieldCheck className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-white tracking-tight">
            Initial Owner Account Setup
          </h1>
          <p className="text-xs text-zinc-400">
            Create the primary Owner administrator account for Thennakoon Tours Invoice Generator
          </p>
        </div>

        <form onSubmit={handleCreateOwner} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Full Name <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <User className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="text"
                required
                placeholder="Owner Full Name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Owner Email Address <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="owner@thennakoontours.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Owner Password <span className="text-amber-400">*</span>
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="password"
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1">
              Designation
            </label>
            <input
              type="text"
              value={designation}
              onChange={(e) => setDesignation(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs transition-all shadow-lg shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
            <span>Initialize Owner Account</span>
          </button>
        </form>
      </div>
    </div>
  );
}
