'use client';

import React, { useState, useTransition } from 'react';
import {
  Building2,
  Landmark,
  FileCheck,
  QrCode,
  Save,
  Loader2,
  Image as ImageIcon,
  AlertCircle,
  Eye,
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  CompanySettings,
  BankSettings,
  InvoiceSettings,
  QrSettings,
  Profile,
} from '@/lib/types';
import { Notification, NotificationState } from '@/components/ui/Notification';

interface SettingsClientProps {
  currentProfile: Profile;
  initialCompany: CompanySettings;
  initialBank: BankSettings;
  initialInvoice: InvoiceSettings;
  initialQr: QrSettings;
}

export function SettingsClient({
  currentProfile,
  initialCompany,
  initialBank,
  initialInvoice,
  initialQr,
}: SettingsClientProps) {
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();
  const [notification, setNotification] = useState<NotificationState | null>(null);

  const canEdit =
    currentProfile.role === 'Owner' || currentProfile.role === 'Admin';

  const [company, setCompany] = useState<CompanySettings>(initialCompany);
  const [bank, setBank] = useState<BankSettings>(initialBank);
  const [invoice, setInvoice] = useState<InvoiceSettings>(initialInvoice);
  const [qr, setQr] = useState<QrSettings>(initialQr);

  const handleFileUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    callback: (url: string) => void
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 3 * 1024 * 1024) {
      setNotification({
        type: 'error',
        message: 'Image size should be less than 3MB.',
      });
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      callback(reader.result as string);
      setNotification({
        type: 'success',
        message: 'Image loaded successfully.',
      });
    };
    reader.readAsDataURL(file);
  };

  const handleSaveAllSettings = async () => {
    if (!canEdit) {
      setNotification({
        type: 'error',
        message: 'Staff members cannot update system settings.',
      });
      return;
    }

    startTransition(async () => {
      try {
        const [res1, res2, res3, res4] = await Promise.all([
          supabase.from('company_settings').upsert({ id: 1, ...company }),
          supabase.from('bank_settings').upsert({ id: 1, ...bank }),
          supabase.from('invoice_settings').upsert({ id: 1, ...invoice }),
          supabase.from('qr_settings').upsert({ id: 1, ...qr }),
        ]);

        if (res1.error) throw res1.error;
        if (res2.error) throw res2.error;
        if (res3.error) throw res3.error;
        if (res4.error) throw res4.error;

        setNotification({
          type: 'success',
          message: 'System settings saved successfully!',
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Failed to save settings.';
        setNotification({
          type: 'error',
          message: msg,
        });
      }
    });
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto pb-16">
      <Notification
        notification={notification}
        onClose={() => setNotification(null)}
      />

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-zinc-850">
        <div>
          <h1 className="text-xl font-extrabold text-white">System Settings</h1>
          <p className="text-xs text-zinc-400">
            Configure company branding, letterhead graphics, bank account details, and invoice defaults
          </p>
        </div>

        {canEdit && (
          <button
            onClick={handleSaveAllSettings}
            disabled={isPending}
            className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold text-xs transition-all shadow-md active:scale-95 disabled:opacity-50 shrink-0"
          >
            {isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            <span>Save All Settings</span>
          </button>
        )}
      </div>

      {!canEdit && (
        <div className="p-4 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-300 text-xs flex items-center gap-3">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>Viewing Mode: Staff users can inspect system settings, but only Owner and Admin can save changes.</span>
        </div>
      )}

      {/* SECTION 1: COMPANY & LETTERHEAD */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Building2 className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            1. Company Profile & Official Letterhead
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Company Legal Name
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={company.company_name}
              onChange={(e) => setCompany({ ...company, company_name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Official Email Address
            </label>
            <input
              type="email"
              disabled={!canEdit}
              value={company.email}
              onChange={(e) => setCompany({ ...company, email: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Phone / Hotline
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={company.phone}
              onChange={(e) => setCompany({ ...company, phone: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Website URL
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={company.website}
              onChange={(e) => setCompany({ ...company, website: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Company Physical Address
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={company.address}
              onChange={(e) => setCompany({ ...company, address: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>
        </div>

        {/* Letterhead Settings */}
        <div className="pt-4 border-t border-zinc-850 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white">Full-Page Letterhead Artwork</h3>
              <p className="text-[11px] text-zinc-400">
                Official Thennakoon Tours letterhead background template used for PDF generation
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={company.letterhead_enabled}
                onChange={(e) =>
                  setCompany({ ...company, letterhead_enabled: e.target.checked })
                }
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span className="text-xs font-semibold text-amber-400">
                Enable Letterhead Background
              </span>
            </label>
          </div>

          {canEdit && (
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept="image/*"
                id="letterhead-upload"
                className="hidden"
                onChange={(e) =>
                  handleFileUpload(e, (url) =>
                    setCompany({ ...company, letterhead_url: url })
                  )
                }
              />
              <label
                htmlFor="letterhead-upload"
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-medium border border-zinc-700 cursor-pointer"
              >
                <ImageIcon className="w-4 h-4 text-amber-400" />
                <span>Upload / Replace Letterhead Image</span>
              </label>

              {company.letterhead_url && (
                <a
                  href={company.letterhead_url}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 text-xs text-amber-400 hover:underline"
                >
                  <Eye className="w-3.5 h-3.5" />
                  <span>Preview Current Image</span>
                </a>
              )}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2: BANK DETAILS */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <Landmark className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            2. Company Bank Details
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Account Name
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={bank.account_name}
              onChange={(e) => setBank({ ...bank, account_name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Account Number
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={bank.account_number}
              onChange={(e) => setBank({ ...bank, account_number: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Bank Name
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={bank.bank_name}
              onChange={(e) => setBank({ ...bank, bank_name: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Branch Name
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={bank.branch}
              onChange={(e) => setBank({ ...bank, branch: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              SWIFT / BIC Code
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={bank.swift_code}
              onChange={(e) => setBank({ ...bank, swift_code: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* SECTION 3: QR CODE SETTINGS */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <QrCode className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            3. Payment QR Code Settings
          </h2>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-bold text-white">
                Show Payment QR Code on Invoice PDF
              </h3>
              <p className="text-[11px] text-zinc-400">
                Display a payment QR code alongside bank details on generated PDFs
              </p>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                disabled={!canEdit}
                checked={qr.qr_enabled}
                onChange={(e) => setQr({ ...qr, qr_enabled: e.target.checked })}
                className="w-4 h-4 accent-amber-500 rounded"
              />
              <span className="text-xs font-semibold text-amber-400">Enable QR</span>
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                QR Label
              </label>
              <input
                type="text"
                disabled={!canEdit}
                value={qr.qr_label}
                onChange={(e) => setQr({ ...qr, qr_label: e.target.value })}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
              />
            </div>

            {canEdit && (
              <div>
                <label className="block text-xs font-medium text-zinc-400 mb-1">
                  Upload QR Image
                </label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) =>
                    handleFileUpload(e, (url) => setQr({ ...qr, qr_image_url: url }))
                  }
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-xs text-zinc-400 file:bg-zinc-800 file:border-0 file:text-zinc-200 file:px-2 file:py-1 file:rounded file:text-xs"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 4: DEFAULT INVOICE SETTINGS */}
      <div className="p-6 rounded-xl bg-zinc-900/90 border border-zinc-800 space-y-5">
        <div className="flex items-center gap-2 pb-2 border-b border-zinc-800">
          <FileCheck className="w-4 h-4 text-amber-400" />
          <h2 className="text-xs font-bold text-zinc-200 uppercase tracking-wider">
            4. Default Invoice Terms & Notes
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Invoice Prefix
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={invoice.prefix}
              onChange={(e) => setInvoice({ ...invoice, prefix: e.target.value })}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs font-mono font-bold text-amber-400 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Default Payment Terms
            </label>
            <input
              type="text"
              disabled={!canEdit}
              value={invoice.default_payment_terms}
              onChange={(e) =>
                setInvoice({ ...invoice, default_payment_terms: e.target.value })
              }
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Default Due Days
            </label>
            <input
              type="number"
              min={1}
              disabled={!canEdit}
              value={invoice.default_due_days}
              onChange={(e) =>
                setInvoice({
                  ...invoice,
                  default_due_days: Number(e.target.value) || 7,
                })
              }
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Default Special Notes
            </label>
            <textarea
              rows={2}
              disabled={!canEdit}
              value={invoice.default_special_notes}
              onChange={(e) =>
                setInvoice({ ...invoice, default_special_notes: e.target.value })
              }
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>

          <div className="md:col-span-3">
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Default Important Note (Terms & Conditions)
            </label>
            <textarea
              rows={3}
              disabled={!canEdit}
              value={invoice.default_important_notes}
              onChange={(e) =>
                setInvoice({ ...invoice, default_important_notes: e.target.value })
              }
              className="w-full bg-zinc-950 border border-zinc-800 rounded-lg p-3 text-xs text-zinc-200 focus:outline-none focus:border-amber-500 disabled:opacity-60"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
