import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { extractErrorMessage } from '@/lib/utils';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    // 1. Verify authenticated session
    const {
      data: { user },
      error: authErr,
    } = await supabase.auth.getUser();

    if (authErr || !user) {
      return NextResponse.json(
        { error: 'Authentication required. Please log in.' },
        { status: 401 }
      );
    }

    // Parse body
    const body = await req.json().catch(() => ({}));
    const { invoice_id, reason } = body;

    if (!invoice_id) {
      return NextResponse.json(
        { error: 'Invoice ID is required.' },
        { status: 400 }
      );
    }

    if (!reason || typeof reason !== 'string' || !reason.trim()) {
      return NextResponse.json(
        { error: 'Reopen reason is required.' },
        { status: 400 }
      );
    }

    const trimmedReason = reason.trim();

    // 2. Fetch current profile & verify role is OWNER
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      console.error('[REOPEN_INVOICE_ERROR] Profile fetch failed:', profileErr);
      return NextResponse.json(
        { error: profileErr ? extractErrorMessage(profileErr) : 'User profile not found.' },
        { status: 403 }
      );
    }

    const role = (profile.role || '').trim().toLowerCase();
    if (role !== 'owner') {
      return NextResponse.json(
        { error: 'Only Owner users can reopen cancelled invoices.' },
        { status: 403 }
      );
    }

    // 3. Fetch target invoice
    const { data: invoice, error: invoiceErr } = await supabase
      .from('invoices')
      .select('id, invoice_number, status')
      .eq('id', invoice_id)
      .single();

    if (invoiceErr || !invoice) {
      console.error('[REOPEN_INVOICE_ERROR] Invoice fetch failed:', invoiceErr);
      return NextResponse.json(
        { error: invoiceErr ? extractErrorMessage(invoiceErr) : 'Invoice not found.' },
        { status: 404 }
      );
    }

    if (invoice.status !== 'Cancelled') {
      return NextResponse.json(
        { error: 'Only cancelled invoices can be reopened.' },
        { status: 400 }
      );
    }

    // 4. Attempt RPC reopening
    const { data: rpcData, error: rpcErr } = await supabase.rpc('reopen_invoice', {
      p_invoice_id: invoice_id,
      p_reason: trimmedReason,
      p_user_id: user.id,
      p_user_name: profile.full_name || 'System User',
    });

    if (!rpcErr && rpcData?.success) {
      return NextResponse.json({
        success: true,
        message: `Invoice ${invoice.invoice_number} reopened to Draft successfully.`,
      });
    }

    if (rpcErr) {
      console.warn('[REOPEN_INVOICE_RPC_WARN] RPC failed, trying fallback direct update:', rpcErr);
    }

    // 5. Direct fallback update if RPC failed
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        status: 'Draft',
        cancelled_at: null,
        cancelled_by: null,
        cancellation_reason: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice_id);

    if (updateErr) {
      console.error('[REOPEN_INVOICE_ERROR] Direct status update failed:', updateErr);
      const combinedMsg = extractErrorMessage(updateErr);
      return NextResponse.json(
        { error: `Failed to reopen invoice: ${combinedMsg}` },
        { status: 500 }
      );
    }

    // 6. Insert audit activity log
    const { error: logErr } = await supabase.from('invoice_activity_logs').insert({
      invoice_id: invoice_id,
      user_id: user.id,
      user_name: profile.full_name || 'System User',
      action: 'invoice_reopened',
      details: { reason: trimmedReason },
    });

    if (logErr) {
      console.warn('[REOPEN_INVOICE_WARN] Activity log insertion failed:', logErr);
    }

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} reopened to Draft successfully.`,
    });
  } catch (err: unknown) {
    console.error('[REOPEN_INVOICE_UNCAUGHT_ERROR]:', err);
    const message = extractErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
