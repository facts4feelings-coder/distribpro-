import { useEffect, useState, useCallback, useRef } from 'react';
import { Printer, Download, Target, TrendingUp, Users, Percent, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, todayISO } from '@/lib/utils';
import { printHtml } from '@/lib/reportPrint';
import { exportToCSV } from '@/lib/csv';
import Modal from '@/components/Modal';

interface TargetRow {
  id: string;
  salesman_name: string;
  route_id: string | null;
  target_month: string;
  target_amount: number;
  routes?: { name: string } | null;
}

interface Achievement {
  id: string;
  salesman: string;
  target: number;
  achieved: number;
  routeName: string;
}

interface Route {
  id: string;
  name: string;
}

export default function SalesmanTargetReport() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [rows, setRows] = useState<Achievement[]>([]);
  const [routes, setRoutes] = useState<Route[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TargetRow | null>(null);
  const [form, setForm] = useState({ salesman_name: '', route_id: '', target_month: new Date().toISOString().slice(0, 7), target_amount: '0' });

  const [targetsCache, setTargetsCache] = useState<TargetRow[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    const [targetsRes, invoicesRes, routesRes] = await Promise.all([
      supabase.from('salesman_targets').select('*, routes(name)').eq('target_month', month).order('salesman_name'),
      supabase.from('customer_invoices').select('total, invoice_date, customer_id, invoice_type')
        .gte('invoice_date', `${month}-01`).lt('invoice_date', nextMonth(month))
        .in('invoice_type', ['sale', 'sales-return']),
      supabase.from('routes').select('id, name').order('name'),
    ]);
    const targets = (targetsRes.data ?? []) as TargetRow[];
    setTargetsCache(targets);
    const invoices = (invoicesRes.data ?? []) as { total: number; customer_id: string; invoice_type: string }[];
    setRoutes((routesRes.data ?? []) as Route[]);

    const { data: crData } = await supabase.from('customer_routes').select('customer_id, route_id');
    const custRoute = new Map<string, string>((crData ?? []).map((cr) => [cr.customer_id, cr.route_id]));

    const routeNames = new Map<string, string>(targets.map((t) => [t.route_id ?? '', t.routes?.name ?? '']));

    // Sales credited per route: sale invoices add, sales returns subtract
    const achievedByRoute = new Map<string, number>();
    for (const inv of invoices) {
      const rid = custRoute.get(inv.customer_id);
      if (!rid) continue;
      const signed = inv.invoice_type === 'sales-return' ? -inv.total : inv.total;
      achievedByRoute.set(rid, (achievedByRoute.get(rid) ?? 0) + signed);
    }

    const list: Achievement[] = targets.map((t) => ({
      id: t.id,
      salesman: t.salesman_name,
      target: t.target_amount,
      achieved: t.route_id ? Math.max(0, achievedByRoute.get(t.route_id) ?? 0) : 0,
      routeName: routeNames.get(t.route_id ?? '') ?? 'All Routes',
    }));
    setRows(list);
    setLoading(false);
  }, [month]);

  useEffect(() => { load(); }, [load]);

  const generateMonth = () => month;

  const openNew = () => {
    setEditing(null);
    setForm({ salesman_name: '', route_id: '', target_month: generateMonth(), target_amount: '0' });
    setModalOpen(true);
  };

  const openEdit = (r: Achievement) => {
    const target = targetsCache.find((t) => t.id === r.id);
    if (!target) return;
    setEditing(target);
    setForm({ salesman_name: target.salesman_name, route_id: target.route_id ?? '', target_month: target.target_month, target_amount: String(target.target_amount) });
    setModalOpen(true);
  };

  const save = async () => {
    const amount = parseFloat(form.target_amount) || 0;
    if (!form.salesman_name.trim()) { alert('Salesman name is required'); return; }
    const payload = {
      salesman_name: form.salesman_name.trim(),
      route_id: form.route_id || null,
      target_month: form.target_month,
      target_amount: amount,
    };
    if (editing) {
      await supabase.from('salesman_targets').update(payload).eq('id', editing.id);
    } else {
      await supabase.from('salesman_targets').insert(payload);
    }
    setModalOpen(false);
    load();
  };

  const removeTarget = async (id: string) => {
    if (!confirm('Delete this target?')) return;
    await supabase.from('salesman_targets').delete().eq('id', id);
    load();
  };

  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const totalAchieved = rows.reduce((s, r) => s + r.achieved, 0);
  const overallPct = totalTarget > 0 ? (totalAchieved / totalTarget) * 100 : 0;

  const exportCSV = () => {
    exportToCSV(
      `salesman-target-vs-achievement-${month}.csv`,
      rows,
      [
        { header: 'Salesman', key: 'salesman' },
        { header: 'Route', key: 'routeName' },
        { header: 'Target', key: (r: Achievement) => String(r.target) },
        { header: 'Achieved', key: (r: Achievement) => String(r.achieved) },
        { header: 'Achievement %', key: (r: Achievement) => pct(r.target, r.achieved).toFixed(1) },
      ]
    );
  };

  const printReport = () => {
    const content = document.getElementById('salesman-target-print')?.innerHTML ?? '';
    printHtml('Salesman Target vs Achievement', `<h1>Salesman Target vs Achievement — ${month}</h1>${content}`);
  };

  return (
    <div className="space-y-4" id="salesman-target-print">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Salesmen" value={String(rows.length)} color="bg-blue-50 text-blue-600" icon={<Users size={20} />} />
        <StatCard label="Total Target" value={formatCurrency(totalTarget, sym)} color="bg-amber-50 text-amber-600" icon={<Target size={20} />} />
        <StatCard label="Total Achieved" value={formatCurrency(totalAchieved, sym)} color="bg-emerald-50 text-emerald-600" icon={<TrendingUp size={20} />} />
        <StatCard label="Overall Achievement" value={`${overallPct.toFixed(1)}%`} color={overallPct >= 100 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'} icon={<Percent size={20} />} />
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="flex items-center gap-2">
          <label className="text-sm text-slate-500">Month:</label>
          <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-blue-500" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-600/20">
            <Plus size={18} /> Set Target
          </button>
          <button onClick={printReport} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all">
            <Printer size={18} /> Print
          </button>
          <button onClick={exportCSV} className="flex items-center gap-2 px-4 py-2.5 bg-slate-700 hover:bg-slate-800 text-white rounded-lg text-sm font-medium transition-all">
            <Download size={18} /> Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-slate-400">Loading...</div>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center text-slate-400">
            No targets set for {month}. Click <span className="font-semibold text-emerald-600">Set Target</span> to add one.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Salesman</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Route</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Target</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Achieved</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Achievement %</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Progress</th>
                  <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => {
                  const pctVal = pct(r.target, r.achieved);
                  const barColor = pctVal >= 100 ? 'bg-emerald-500' : pctVal >= 60 ? 'bg-blue-500' : 'bg-rose-500';
                  return (
                    <tr key={r.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{r.salesman}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{r.routeName}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-600">{formatCurrency(r.target, sym)}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(r.achieved, sym)}</td>
                      <td className={`px-4 py-3 text-right font-bold ${pctVal >= 100 ? 'text-emerald-600' : pctVal >= 60 ? 'text-blue-600' : 'text-rose-600'}`}>{pctVal.toFixed(1)}%</td>
                      <td className="px-4 py-3 w-48">
                        <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${Math.min(100, pctVal)}%` }} />
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1 print:hidden">
                          <button onClick={() => openEdit(r)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all" title="Edit"><Pencil size={16} /></button>
                          <button onClick={() => removeTarget(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50 border-t-2 border-slate-200">
                <tr>
                  <td colSpan={2} className="px-4 py-3 font-bold text-slate-700">Totals:</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(totalTarget, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(totalAchieved, sym)}</td>
                  <td className="px-4 py-3 text-right font-bold text-slate-800">{overallPct.toFixed(1)}%</td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>

      <p className="text-xs text-slate-400">
        Achievement = sales of the selected month credited to the salesman's route (sales returns are deducted). Assign shops to routes in Routes &amp; Shops so sales can be credited.
      </p>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Target' : 'Set Target'}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Salesman Name *</label>
            <input value={form.salesman_name} onChange={(e) => setForm({ ...form, salesman_name: e.target.value })} className="input" placeholder="e.g. Ahmed Ali" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Route</label>
            <select value={form.route_id} onChange={(e) => setForm({ ...form, route_id: e.target.value })} className="input">
              <option value="">No route (manual)</option>
              {routes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
            <p className="text-xs text-slate-400 mt-1">Sales from shops on this route count towards the target.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Month *</label>
              <input type="month" value={form.target_month} onChange={(e) => setForm({ ...form, target_month: e.target.value })} className="input" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Target Amount *</label>
              <input type="number" step="0.01" value={form.target_amount} onChange={(e) => setForm({ ...form, target_amount: e.target.value })} className="input" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={save} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button>
            <button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function pct(target: number, achieved: number): number {
  if (target <= 0) return 0;
  return (achieved / target) * 100;
}

function nextMonth(month: string): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

function StatCard({ label, value, color, icon }: { label: string; value: string; color: string; icon: React.ReactNode }) {
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
