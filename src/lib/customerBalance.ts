import { supabase } from '@/lib/supabase';

export async function recalcCustomerBalance(customerId: string) {
  const { data } = await supabase
    .from('customer_invoices')
    .select('invoice_type, balance')
    .eq('customer_id', customerId);
  let balance = 0;
  for (const inv of (data ?? []) as { invoice_type: string; balance: number }[]) {
    if (inv.invoice_type === 'sale') balance += inv.balance;
    else if (inv.invoice_type === 'sales-return') balance -= inv.balance;
  }
  await supabase.from('customers').update({ current_balance: balance }).eq('id', customerId);
}

export async function recalcSupplierBalance(supplierId: string) {
  const { data } = await supabase
    .from('supplier_invoices')
    .select('invoice_type, balance')
    .eq('supplier_id', supplierId);
  let balance = 0;
  for (const inv of (data ?? []) as { invoice_type: string; balance: number }[]) {
    if (inv.invoice_type === 'purchase') balance += inv.balance;
    else if (inv.invoice_type === 'purchase-return') balance -= inv.balance;
  }
  await supabase.from('suppliers').update({ current_balance: balance }).eq('id', supplierId);
}
