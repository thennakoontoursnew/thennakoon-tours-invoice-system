'use client';

import React from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface NotificationState {
  type: 'success' | 'error' | 'info';
  message: string;
}

interface NotificationProps {
  notification: NotificationState | null;
  onClose: () => void;
}

export function Notification({ notification, onClose }: NotificationProps) {
  if (!notification) return null;

  const isSuccess = notification.type === 'success';
  const isError = notification.type === 'error';

  return (
    <div
      className={`fixed top-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-xl backdrop-blur-md transition-all duration-200 text-sm max-w-md ${
        isSuccess
          ? 'bg-emerald-950/90 text-emerald-200 border-emerald-800'
          : isError
          ? 'bg-red-950/90 text-red-200 border-red-800'
          : 'bg-amber-950/90 text-amber-200 border-amber-800'
      }`}
    >
      {isSuccess && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
      {isError && <AlertCircle className="w-5 h-5 text-red-400 shrink-0" />}
      {!isSuccess && !isError && <Info className="w-5 h-5 text-amber-400 shrink-0" />}
      <span className="flex-1 font-medium">{notification.message}</span>
      <button
        onClick={onClose}
        className="text-zinc-400 hover:text-white transition-colors p-1 rounded-md"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
