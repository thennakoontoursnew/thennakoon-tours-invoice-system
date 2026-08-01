'use client';

import React, { useState, useTransition } from 'react';
import {
  UserPlus,
  Edit2,
  Shield,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Profile, UserRole } from '@/lib/types';
import { Notification, NotificationState } from '@/components/ui/Notification';

interface UsersClientProps {
  currentOwnerProfile: Profile;
  initialProfiles: Profile[];
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof error.message === 'string'
  ) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'Unable to process user operation. Please try again.';
}

export function UsersClient({
  currentOwnerProfile,
  initialProfiles,
}: UsersClientProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [profiles, setProfiles] = useState<Profile[]>(initialProfiles);
  const [notification, setNotification] = useState<NotificationState | null>(null);

  // Edit Modal State
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('Staff');
  const [editDesignation, setEditDesignation] = useState<string>('Executive');
  const [editIsActive, setEditIsActive] = useState<boolean>(true);

  // New User Form State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('Staff');
  const [newDesignation, setNewDesignation] = useState('Executive');

  // Handle Edit User Save
  const handleSaveProfile = async () => {
    if (!editingProfile) return;

    startTransition(async () => {
      try {
        const normalizedEditRole = editRole.trim().toLowerCase();

        const { error } = await supabase
          .from('profiles')
          .update({
            role: normalizedEditRole,
            designation: editDesignation,
            is_active: editIsActive,
          })
          .eq('id', editingProfile.id);

        if (error) throw error;

        setProfiles(
          profiles.map((p) =>
            p.id === editingProfile.id
              ? {
                  ...p,
                  role: normalizedEditRole as UserRole,
                  designation: editDesignation,
                  is_active: editIsActive,
                }
              : p
          )
        );

        setEditingProfile(null);
        setNotification({
          type: 'success',
          message: `User ${editingProfile.full_name} updated successfully!`,
        });
      } catch (err: unknown) {
        setNotification({
          type: 'error',
          message: getErrorMessage(err),
        });
      }
    });
  };

  // Handle Add New Staff / Admin User via Secure Server Endpoint
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim() || !newFullName.trim()) {
      setNotification({
        type: 'error',
        message: 'Please fill in all required fields.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const response = await fetch('/api/admin/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: newEmail,
            password: newPassword,
            full_name: newFullName,
            role: newRole,
            designation: newDesignation,
          }),
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Failed to create user account.');
        }

        const { data: updatedList } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: true });

        if (updatedList) setProfiles(updatedList as Profile[]);

        setIsCreateOpen(false);
        setNewEmail('');
        setNewPassword('');
        setNewFullName('');
        setNotification({
          type: 'success',
          message: `User ${newFullName} created successfully!`,
        });
      } catch (err: unknown) {
        setNotification({
          type: 'error',
          message: getErrorMessage(err),
        });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-16">
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* Header & Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
        <div>
          <h1 className="text-xl font-extrabold text-white">User Administration</h1>
          <p className="text-xs text-zinc-400">
            Manage Thennakoon Tours staff accounts, assign roles, update titles, and grant access
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New User</span>
        </button>
      </div>

      {/* Profile List Card */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/60 flex items-center justify-between">
          <div className="flex items-center gap-2 text-zinc-300 text-xs font-semibold">
            <Shield className="w-4 h-4 text-amber-400" />
            <span>
              Owner Access ({currentOwnerProfile.full_name}): Add staff, manage roles, update titles, and toggle active permissions
            </span>
          </div>
          <span className="text-[11px] text-zinc-500 font-mono">
            Total Users: {profiles.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 uppercase text-[10px] font-bold tracking-wider border-b border-zinc-800">
              <tr>
                <th className="py-3.5 px-4">Full Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">System Role</th>
                <th className="py-3.5 px-4">Designation</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/60">
              {profiles.map((p) => {
                const userRole = p.role?.trim().toLowerCase();
                return (
                  <tr key={p.id} className="hover:bg-zinc-850/40 transition-colors">
                    <td className="py-3.5 px-4 font-bold text-white">
                      {p.full_name}
                    </td>
                    <td className="py-3.5 px-4 text-zinc-400 font-mono">
                      {p.email}
                    </td>
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border capitalize ${
                          userRole === 'owner'
                            ? 'bg-amber-950/90 text-amber-300 border-amber-800/80'
                            : userRole === 'admin'
                            ? 'bg-blue-950/90 text-blue-300 border-blue-800/80'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}
                      >
                        <Shield className="w-3 h-3" />
                        <span>{p.role}</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-zinc-300">
                      {p.designation || 'Executive'}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      {p.is_active ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 text-[10px] font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Active</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-red-400 text-[10px] font-semibold">
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Disabled</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => {
                          setEditingProfile(p);
                          setEditRole((p.role?.trim().toLowerCase() === 'owner' ? 'Owner' : p.role?.trim().toLowerCase() === 'admin' ? 'Admin' : 'Staff') as UserRole);
                          setEditDesignation(p.designation || 'Executive');
                          setEditIsActive(p.is_active !== false);
                        }}
                        className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-amber-400 border border-zinc-700 transition-colors"
                        title="Edit Role & Status"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* EDIT USER MODAL */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white">
                  Edit User — {editingProfile.full_name}
                </h2>
                <p className="text-xs text-zinc-400">{editingProfile.email}</p>
              </div>
              <button
                onClick={() => setEditingProfile(null)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  System Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-amber-400 focus:outline-none focus:border-amber-500"
                >
                  <option value="Staff">Staff (Invoice Creator)</option>
                  <option value="Admin">Admin (Full Invoice & Settings Manager)</option>
                  <option value="Owner">Owner (System Director & User Admin)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Job Designation
                </label>
                <input
                  type="text"
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Account Access Status
                </label>
                <select
                  value={editIsActive ? 'active' : 'disabled'}
                  onChange={(e) => setEditIsActive(e.target.value === 'active')}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-zinc-200 focus:outline-none focus:border-amber-500"
                >
                  <option value="active">Active (Access Granted)</option>
                  <option value="disabled">Disabled (Access Revoked)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveProfile}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW USER MODAL */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <div>
                <h2 className="text-sm font-bold text-white">Create New User Account</h2>
                <p className="text-xs text-zinc-400">
                  Securely add a new staff or admin user to Thennakoon Tours
                </p>
              </div>
              <button
                onClick={() => setIsCreateOpen(false)}
                className="p-1 text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Full Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kasun Kalhara"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Email Address <span className="text-amber-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="kasun@thennakoontours.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Initial Password <span className="text-amber-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  minLength={6}
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Assign System Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs font-semibold text-amber-400 focus:outline-none focus:border-amber-500"
                >
                  <option value="Staff">Staff (Invoice Creation Only)</option>
                  <option value="Admin">Admin (Invoice & Settings Manager)</option>
                  <option value="Owner">Owner (Full System Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                  Designation / Job Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Reservation Executive"
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs shadow-md disabled:opacity-50"
                >
                  {isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Create Account</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
