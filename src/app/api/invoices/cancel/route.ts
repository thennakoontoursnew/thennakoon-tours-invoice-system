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

    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return NextResponse.json(
        { error: 'Cancellation reason is required (minimum 5 characters).' },
        { status: 400 }
      );
    }

    const trimmedReason = reason.trim();

    // 2. Fetch current profile & verify role
    const { data: profile, error: profileErr } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .eq('id', user.id)
      .single();

    if (profileErr || !profile) {
      console.error('[CANCEL_INVOICE_ERROR] Profile fetch failed:', profileErr);
      return NextResponse.json(
        { error: profileErr ? extractErrorMessage(profileErr) : 'User profile not found.' },
        { status: 403 }
      );
    }

    const role = (profile.role || '').trim().toLowerCase();
    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json(
        { error: 'Only Owner or Admin can cancel invoices.' },
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
      console.error('[CANCEL_INVOICE_ERROR] Invoice fetch failed:', invoiceErr);
      return NextResponse.json(
        { error: invoiceErr ? extractErrorMessage(invoiceErr) : 'Invoice not found.' },
        { status: 404 }
      );
    }

    if (invoice.status === 'Cancelled') {
      return NextResponse.json(
        { error: 'Invoice already cancelled.' },
        { status: 400 }
      );
    }

    if (invoice.status === 'Paid') {
      return NextResponse.json(
        { error: 'Paid invoices cannot be cancelled.' },
        { status: 400 }
      );
    }

    // 4. Verify active payments
    const { count: activePaymentsCount, error: payCountErr } = await supabase
      .from('invoice_payments')
      .select('*', { count: 'exact', head: true })
      .eq('invoice_id', invoice_id)
      .eq('is_reversed', false);

    if (payCountErr) {
      console.error('[CANCEL_INVOICE_ERROR] Active payments count failed:', payCountErr);
      return NextResponse.json(
        { error: extractErrorMessage(payCountErr) },
        { status: 500 }
      );
    }

    if (activePaymentsCount && activePaymentsCount > 0) {
      return NextResponse.json(
        { error: 'Reverse all active payments before cancelling this invoice.' },
        { status: 400 }
      );
    }

    // 5. Attempt RPC Function cancellation
    const { data: rpcData, error: rpcErr } = await supabase.rpc('cancel_invoice', {
      p_invoice_id: invoice_id,
      p_reason: trimmedReason,
      p_user_id: user.id,
      p_user_name: profile.full_name || 'System User',
    });

    if (!rpcErr && rpcData?.success) {
      return NextResponse.json({
        success: true,
        message: `Invoice ${invoice.invoice_number} cancelled successfully.`,
      });
    }

    if (rpcErr) {
      console.warn('[CANCEL_INVOICE_RPC_WARN] RPC failed, trying fallback direct update:', rpcErr);
    }

    // 6. Direct fallback update if RPC failed (e.g. function not deployed yet)
    const { error: updateErr } = await supabase
      .from('invoices')
      .update({
        status: 'Cancelled',
        cancelled_at: new Date().toISOString(),
        cancelled_by: user.id,
        cancellation_reason: trimmedReason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', invoice_id);

    if (updateErr) {
      console.error('[CANCEL_INVOICE_ERROR] Direct status update failed:', updateErr);
      const combinedMsg = extractErrorMessage(updateErr);
      return NextResponse.json(
        { error: `Failed to update invoice status: ${combinedMsg}` },
        { status: 500 }
      );
    }

    // 7. Insert audit activity log
    const { error: logErr } = await supabase.from('invoice_activity_logs').insert({
      invoice_id: invoice_id,
      user_id: user.id,
      user_name: profile.full_name || 'System User',
      action: 'invoice_cancelled',
      details: { reason: trimmedReason },
    });

    if (logErr) {
      console.warn('[CANCEL_INVOICE_WARN] Activity log insertion failed:', logErr);
    }

    return NextResponse.json({
      success: true,
      message: `Invoice ${invoice.invoice_number} cancelled successfully.`,
    });
  } catch (err: unknown) {
    console.error('[CANCEL_INVOICE_UNCAUGHT_ERROR]:', err);
    const message = extractErrorMessage(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
