import { createClient } from '@/lib/supabase/client';

export async function logInvoiceActivity(
  invoiceId: string,
  userId: string,
  userName: string,
  action: string,
  details: Record<string, unknown> = {}
): Promise<void> {
  try {
    const supabase = createClient();
    await supabase.from('invoice_activity_logs').insert({
      invoice_id: invoiceId,
      user_id: userId,
      user_name: userName,
      action,
      details,
    });
  } catch (err) {
    console.error('Failed to log invoice activity:', err);
  }
}
