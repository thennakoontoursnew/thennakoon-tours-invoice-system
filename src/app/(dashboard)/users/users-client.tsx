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
        const { error } = await supabase
          .from('profiles')
          .update({
            role: editRole,
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
                  role: editRole,
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
        const msg = err instanceof Error ? err.message : 'Failed to update user profile.';
        setNotification({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  // Handle Add New Staff / Admin User
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail || !newPassword || !newFullName) {
      setNotification({
        type: 'error',
        message: 'Please fill in all required fields.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const { data, error } = await supabase.auth.signUp({
          email: newEmail,
          password: newPassword,
          options: {
            data: {
              full_name: newFullName,
              designation: newDesignation,
            },
          },
        });

        if (error) throw error;

        if (data.user) {
          const { error: profErr } = await supabase
            .from('profiles')
            .update({
              full_name: newFullName,
              role: newRole,
              designation: newDesignation,
            })
            .eq('id', data.user.id);

          if (profErr) {
            console.warn('Profile sync:', profErr);
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
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to create new user account.';
        setNotification({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
        <div>
          <h1 className="text-xl font-extrabold text-white">User Management</h1>
          <p className="text-xs text-zinc-400">
            Owner Access ({currentOwnerProfile.full_name}): Add staff, manage roles, update titles, and toggle active permissions
          </p>
        </div>

        <button
          onClick={() => setIsCreateOpen(true)}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 shrink-0"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add New System User</span>
        </button>
      </div>

      {/* Users Table */}
      <div className="bg-zinc-900/90 border border-zinc-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-zinc-300">
            <thead className="bg-zinc-950/80 text-zinc-400 font-semibold border-b border-zinc-850">
              <tr>
                <th className="py-3.5 px-4">User Name</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">System Role</th>
                <th className="py-3.5 px-4">Designation</th>
                <th className="py-3.5 px-4 text-center">Status</th>
                <th className="py-3.5 px-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-850/60">
              {profiles.map((p) => (
                <tr key={p.id} className="hover:bg-zinc-850/40 transition-colors">
                  <td className="py-3.5 px-4 font-bold text-white">
                    {p.full_name}
                  </td>
                  <td className="py-3.5 px-4 text-zinc-400 font-mono">
                    {p.email}
                  </td>
                  <td className="py-3.5 px-4">
                    <span
                      className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-[10px] font-bold border ${
                        p.role?.trim().toLowerCase() === 'owner'
                          ? 'bg-amber-950/90 text-amber-300 border-amber-800/80'
                          : p.role?.trim().toLowerCase() === 'admin'
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
                  <td className="py-3.5 px-4 text-center">
                    <button
                      onClick={() => {
                        setEditingProfile(p);
                        setEditRole(p.role);
                        setEditDesignation(p.designation || 'Executive');
                        setEditIsActive(p.is_active);
                      }}
                      className="p-1.5 rounded-md hover:bg-zinc-800 text-amber-400 hover:text-amber-300 transition-colors"
                      title="Edit Role & Status"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal */}
      {editingProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-white">
                Edit User — {editingProfile.full_name}
              </h2>
              <button
                onClick={() => setEditingProfile(null)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  System Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="Owner">Owner (Full Control)</option>
                  <option value="Admin">Admin (Full Invoice & Settings)</option>
                  <option value="Staff">Staff (Create & Draft Edits Only)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Designation / Title
                </label>
                <input
                  type="text"
                  value={editDesignation}
                  onChange={(e) => setEditDesignation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="text-xs font-medium text-zinc-300">
                  Account Active Status
                </span>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editIsActive}
                    onChange={(e) => setEditIsActive(e.target.checked)}
                    className="w-4 h-4 accent-amber-500 rounded"
                  />
                  <span className="text-xs font-bold text-amber-400">
                    {editIsActive ? 'Active' : 'Disabled'}
                  </span>
                </label>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setEditingProfile(null)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isPending}
                onClick={handleSaveProfile}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Save Changes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add User Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
          <form
            onSubmit={handleCreateUser}
            className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-md p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h2 className="text-sm font-bold text-white">Create New User Account</h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-zinc-400 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Full Name <span className="text-amber-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Kasun Perera"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Email Address <span className="text-amber-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  placeholder="kasun@thennakoontours.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Password <span className="text-amber-400">*</span>
                </label>
                <input
                  type="password"
                  required
                  placeholder="At least 6 characters"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Assign System Role
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as UserRole)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 font-bold"
                >
                  <option value="Staff">Staff (Create & Draft Edits)</option>
                  <option value="Admin">Admin (Invoice & Settings Control)</option>
                  <option value="Owner">Owner (Full System Access)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Designation / Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. Senior Executive"
                  value={newDesignation}
                  onChange={(e) => setNewDesignation(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="px-4 py-2 rounded-lg bg-zinc-800 text-zinc-300 text-xs font-semibold hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-zinc-950 font-bold text-xs hover:bg-amber-400 disabled:opacity-50"
              >
                {isPending && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Create User</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
