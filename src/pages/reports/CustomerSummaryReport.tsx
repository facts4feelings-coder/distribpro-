import { useEffect, useState, useCallback } from 'react';
import { Search, Download, Printer, Users, TrendingUp, Wallet, FileText, BookOpen, X } from 'lucide-react';
import { api, partyDtoToLegacy, invoiceDtoToCustomerLegacy, paymentVoucherDtoToLegacy } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate } from '@/lib/utils';
import { printHtml } from '@/lib/reportPrint';
import type { Customer, CustomerInvoice, PaymentVoucher } from '@/lib/types';
import Modal from '@/components/Modal';

interface CustomerSummary {
  customer: Customer;
  invoiceCount: number;
  totalSales: number;
  totalPaid: number;
  totalBalance: number;
  paymentCount: number;
  paymentAmount: number;
}

export default function CustomerSummaryReport() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [loading, setLoading] = useState(true);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [search, setSearch] = useState('');
  const [summaries, setSummaries] = useState<CustomerSummary[]>([]);
  const [ledgerCustomer, setLedgerCustomer] = useState<Customer | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const ds = await api.reports.dataset().catch(() => null);
    const customers = (ds?.customers ?? []).map(partyDtoToLegacy);
    const allInvoices = (ds?.customerInvoices ?? []).map(invoiceDtoToCustomerLegacy);
    const allPayments = (ds?.paymentVouchers ?? []).map(paymentVoucherDtoToLegacy);

    const invoices = allInvoices.filter((i) => {
      if (i.invoice_type !== 'sale') return false;
      if (dateFrom && i.invoice_date < dateFrom) return false;
      if (dateTo && i.invoice_date > dateTo) return false;
      return true;
    });

    const payments = allPayments.filter((p) => {
      if (dateFrom && p.voucher_date < dateFrom) return false;
      if (dateTo && p.voucher_date > dateTo) return false;
      return true;
    });

    const result: CustomerSummary[] = customers.map((customer) => {
      const custInvoices = invoices.filter((i) => i.customer_id === customer.id);
      const custPayments = payments.filter((p) => p.customer_id === customer.id);
      return {
        customer,
        invoiceCount: custInvoices.length,
        totalSales: custInvoices.reduce((s, i) => s + i.total, 0),
        totalPaid: custInvoices.reduce((s, i) => s + i.paid_amount, 0),
        totalBalance: custInvoices.reduce((s, i) => s + i.balance, 0),
        paymentCount: custPayments.length,
        paymentAmount: custPayments.reduce((s, p) => s + p.amount, 0),
      };
    });

    setSummaries(result);
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { load(); }, [load]);

  const filtered = summaries.filter((s) =>
    s.customer.name.toLowerCase().includes(search.toLowerCase()) ||
    (s.customer.phone ?? '').includes(search) ||
    (s.customer.city ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const grandSales = filtered.reduce((s, c) => s + c.totalSales, 0);
  const grandPaid = filtered.reduce((s, c) => s + c.totalPaid, 0);
  const grandBalance = filtered.reduce((s, c) => s + c.totalBalance, 0);
  const grandPayments = filtered.reduce((s, c) => s + c.paymentAmount, 0);

  const exportCSV = () => {
    const headers = ['Customer', 'Phone', 'City', 'Invoices', 'Total Sales', 'Collected (Invoices)', 'Outstanding', 'Payments', 'Payment Amount', 'Current Balance'];
    const rows = filtered.map((s) => [
      s.customer.name,
      s.customer.phone ?? '',
      s.customer.city ?? '',
      s.invoiceCount,
      s.totalSales.toFixed(2),
      s.totalPaid.toFixed(2),
      s.totalBalance.toFixed(2),
      s.paymentCount,
      s.paymentAmount.toFixed(2),
      s.customer.current_balance.toFixed(2),
    ]);
    const csv = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-summary-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    const content = document.getElementById('customer-summary-print')?.innerHTML ?? '';
    printHtml('Customer-wise Summary', `<h1>Customer-wise Summary</h1>${content}`);
  };

  return (
    <div className="space-y-4" id="customer-summary-print">
      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <SummaryCard label="Total Sales" value={formatCurrency(grandSales, sym)} color="bg-emerald-50 text-emerald-600" icon={<TrendingUp size={20} />} />
        <SummaryCard label="Total Collected" value={formatCurrency(grandPaid + grandPayments, sym)} color="bg-emerald-50 text-emerald-600" icon={<Wallet size={20} />} />
        <SummaryCard label="Outstanding" value={formatCurrency(grandBalance, sym)} color="bg-rose-50 text-rose-600" icon={<FileText size={20} />} />
        <SummaryCard label="Active Customers" value={String(filtered.length)} color="bg-amber-50 text-amber-600" icon={<Users size={20} />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex gap-3 flex-wrap">
          <div className="relative flex-1 max-w-xs">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search customers..." className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm" />
          </div>
          <div className="flex items-center gap-2">
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500" />
            <span className="text-slate-400 text-sm">to</span>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-emerald-500" />
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={printReport} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all">
            <Printer size={18} /> Print
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400">No customer data found.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Customer</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Invoices</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Total Sales</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Collected</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Outstanding</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Payments</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Curr. Balance</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Ledger</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((s) => (
                  <tr key={s.customer.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800">{s.customer.name}</p>
                      {(s.customer.phone || s.customer.city) && (
                        <p className="text-xs text-slate-400">{[s.customer.phone, s.customer.city].filter(Boolean).join(' · ')}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center text-sm text-slate-600">{s.invoiceCount}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(s.totalSales, sym)}</td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-600">{formatCurrency(s.totalPaid + s.paymentAmount, sym)}</td>
                    <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(s.totalBalance, sym)}</td>
                    <td className="px-4 py-3 text-right text-sm text-emerald-600">{formatCurrency(s.paymentAmount, sym)}</td>
                    <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(s.customer.current_balance, sym)}</td>
                    <td className="px-4 py-3 text-center">
                      <button
                        onClick={() => setLedgerCustomer(s.customer)}
                        className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-all"
                        title="View Ledger"
                      >
                        <BookOpen size={16} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td className="px-4 py-3 font-bold text-slate-700">Totals:</td>
                  <td className="px-4 py-3 text-center font-bold text-slate-800">{filtered.reduce((s, c) => s + c.invoiceCount, 0)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(grandSales, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(grandPaid + grandPayments, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-rose-600">{formatCurrency(grandBalance, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(grandPayments, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(filtered.reduce((s, c) => s + c.customer.current_balance, 0), sym)}</td>
                  <td></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      {ledgerCustomer && <LedgerModal customer={ledgerCustomer} onClose={() => setLedgerCustomer(null)} sym={sym} />}
    </div>
  );
}

function SummaryCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5">
      <div className="flex items-center gap-3 mb-2">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${color}`}>{icon}</div>
        <span className="text-sm text-slate-500">{label}</span>
      </div>
      <p className="text-2xl font-bold text-slate-800">{value}</p>
    </div>
  );
}

function LedgerModal({ customer, onClose, sym }: { customer: Customer; onClose: () => void; sym: string }) {
  const [entries, setEntries] = useState<{ date: string; description: string; debit: number; credit: number; balance: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [invDtos, payDtos] = await Promise.all([
        api.invoices.listForParty('customer', customer.id).catch(() => []),
        api.paymentVouchers.listForParty('customer', customer.id).catch(() => []),
      ]);
      const invoices = { data: invDtos.map(invoiceDtoToCustomerLegacy) };
      const payments = { data: payDtos.map(paymentVoucherDtoToLegacy) };

      type RawEntry = { date: string; description: string; debit: number; credit: number };
      const raw: RawEntry[] = [];

      raw.push({ date: customer.created_at, description: 'Opening Balance', debit: customer.opening_balance, credit: 0 });

      (invoices.data as CustomerInvoice[] ?? []).forEach((inv) => {
        raw.push({ date: inv.invoice_date, description: `Invoice ${inv.invoice_no}`, debit: inv.total, credit: inv.paid_amount });
      });
      (payments.data as PaymentVoucher[] ?? []).forEach((pv) => {
        raw.push({ date: pv.voucher_date, description: `Payment ${pv.voucher_no}`, debit: 0, credit: pv.amount });
      });

      raw.sort((a, b) => a.date.localeCompare(b.date));

      let bal = 0;
      const withBalance = raw.map((e) => {
        bal += e.debit - e.credit;
        return { ...e, balance: bal };
      });

      setEntries(withBalance);
      setLoading(false);
    })();
  }, [customer]);

  const printLedger = () => {
    const tableHtml = document.getElementById('summary-ledger-table')?.outerHTML ?? '';
    printHtml(`Ledger — ${customer.name}`, `<h1>${customer.name} — Ledger</h1><div class="summary"><p><strong>Current Balance:</strong> ${formatCurrency(customer.current_balance, sym)}</p></div>${tableHtml}`);
  };

  return (
    <Modal open onClose={onClose} title={`Ledger — ${customer.name}`} size="xl">
      <div className="mb-4 p-4 bg-slate-50 rounded-lg flex items-center gap-4">
        <div>
          <p className="text-sm text-slate-500">Current Balance</p>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(customer.current_balance, sym)}</p>
        </div>
        <button onClick={printLedger} className="ml-auto flex items-center gap-1.5 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all">
          <Printer size={16} /> Print
        </button>
        <button onClick={onClose} className="flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-sm font-medium transition-all">
          <X size={16} /> Close
        </button>
      </div>

      {loading ? (
        <p className="text-center text-slate-400 py-8">Loading ledger...</p>
      ) : (
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table id="summary-ledger-table" className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 sticky top-0">
              <tr>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Date</th>
                <th className="text-left px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Description</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Debit</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Credit</th>
                <th className="text-right px-3 py-2 text-xs font-semibold text-slate-600 uppercase">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {entries.map((e, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-3 py-2 text-slate-600">{formatDate(e.date)}</td>
                  <td className="px-3 py-2 text-slate-800">{e.description}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{e.debit > 0 ? formatCurrency(e.debit, sym) : '—'}</td>
                  <td className="px-3 py-2 text-right text-slate-700">{e.credit > 0 ? formatCurrency(e.credit, sym) : '—'}</td>
                  <td className="px-3 py-2 text-right font-bold text-slate-800">{formatCurrency(e.balance, sym)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
