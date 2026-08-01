'use client';

import React, { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Car, Lock, Mail, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Notification, NotificationState } from '@/components/ui/Notification';

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setNotification({
        type: 'error',
        message: 'Please enter both email and password.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          const { data: profile } = await supabase
            .from('profiles')
            .select('is_active')
            .eq('id', data.user.id)
            .single();

          if (profile && profile.is_active === false) {
            await supabase.auth.signOut();
            setNotification({
              type: 'error',
              message: 'Your account has been disabled. Please contact system Owner.',
            });
            return;
          }
        }

        setNotification({
          type: 'success',
          message: 'Signed in successfully! Redirecting...',
        });

        setTimeout(() => {
          router.push('/');
          router.refresh();
        }, 800);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Invalid email or password.';
        setNotification({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-4">
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />

      <div className="w-full max-w-md bg-zinc-900/90 border border-zinc-800 rounded-2xl p-8 shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 shadow-inner">
            <Car className="w-7 h-7" />
          </div>
          <h1 className="text-2xl font-black text-white tracking-tight">
            Thennakoon Tours
          </h1>
          <p className="text-xs text-amber-400 font-medium tracking-wide">
            Invoice Generator Portal
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Email Address
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-zinc-500 absolute left-3 top-3" />
              <input
                type="email"
                required
                placeholder="staff@thennakoontours.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-4 py-2.5 text-xs text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-400 mb-1.5">
              Password
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

          <button
            type="submit"
            disabled={isPending}
            className="w-full py-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-extrabold text-xs transition-all shadow-lg shadow-amber-500/10 active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            <span>Sign In to System</span>
          </button>
        </form>

        <div className="text-center pt-2 border-t border-zinc-850">
          <p className="text-[11px] text-zinc-500">
            Authorized Thennakoon Tours Staff Only
          </p>
        </div>
      </div>
    </div>
  );
}
