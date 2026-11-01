import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, Pencil, Trash2, Users, Calendar, Banknote } from 'lucide-react';
import { api, employeeDtoToLegacy, salaryPaymentDtoToLegacy } from '@/lib/api';
import { useSettings } from '@/hooks/useSettings';
import { formatCurrency, formatDate, todayISO, formatDateInput } from '@/lib/utils';
import type { Employee, SalaryPaymentWithEmployee } from '@/lib/types';
import Modal from '@/components/Modal';

export default function Salaries() {
  const { settings } = useSettings();
  const sym = settings?.currency_symbol ?? 'Rs';
  const [tab, setTab] = useState<'employees' | 'payments'>('employees');
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [payments, setPayments] = useState<SalaryPaymentWithEmployee[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [empModal, setEmpModal] = useState(false);
  const [payModal, setPayModal] = useState(false);
  const [editingEmp, setEditingEmp] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({ name: '', phone: '', address: '', position: '', salary: '0', hire_date: todayISO() });
  const [payForm, setPayForm] = useState({ employee_id: '', payment_date: todayISO(), amount: '0', month: new Date().toISOString().slice(0, 7), payment_method: 'cash', notes: '' });

  const load = useCallback(async () => {
    setLoading(true);
    const [e, p] = await Promise.all([
      api.employees.list().catch(() => []),
      api.salaryPayments.list().catch(() => []),
    ]);
    setEmployees(e.map(employeeDtoToLegacy));
    setPayments(p.map(salaryPaymentDtoToLegacy));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filteredEmps = employees.filter((e) =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    (e.position ?? '').toLowerCase().includes(search.toLowerCase())
  );
  const filteredPays = payments.filter((p) =>
    (p.employees?.name ?? '').toLowerCase().includes(search.toLowerCase()) ||
    p.month.includes(search)
  );

  const openNewEmp = () => {
    setEditingEmp(null);
    setEmpForm({ name: '', phone: '', address: '', position: '', salary: '0', hire_date: todayISO() });
    setEmpModal(true);
  };

  const openEditEmp = (e: Employee) => {
    setEditingEmp(e);
    setEmpForm({ name: e.name, phone: e.phone ?? '', address: e.address ?? '', position: e.position ?? '', salary: String(e.salary), hire_date: formatDateInput(e.hire_date) });
    setEmpModal(true);
  };

  const saveEmp = async () => {
    const payload = {
      name: empForm.name, phone: empForm.phone || null, address: empForm.address || null,
      position: empForm.position || null, salary: parseFloat(empForm.salary) || 0,
      hire_date: empForm.hire_date,
    };
    const input = {
      name: payload.name, phone: payload.phone, address: payload.address,
      position: payload.position, salary: payload.salary, hireDate: payload.hire_date,
    };
    if (editingEmp) {
      await api.employees.update(editingEmp.id, input);
    } else {
      await api.employees.create(input);
    }
    setEmpModal(false);
    load();
  };

  const removeEmp = async (id: string) => {
    if (!confirm('Delete this employee?')) return;
    await api.employees.delete(id);
    load();
  };

  const openNewPay = () => {
    setPayForm({ employee_id: '', payment_date: todayISO(), amount: '0', month: new Date().toISOString().slice(0, 7), payment_method: 'cash', notes: '' });
    setPayModal(true);
  };

  const onPayEmpSelect = (id: string) => {
    const emp = employees.find((e) => e.id === id);
    setPayForm((prev) => ({ ...prev, employee_id: id, amount: emp ? String(emp.salary) : prev.amount }));
  };

  const savePay = async () => {
    const payload = {
      employee_id: payForm.employee_id, payment_date: payForm.payment_date,
      amount: parseFloat(payForm.amount) || 0, month: payForm.month,
      payment_method: payForm.payment_method, notes: payForm.notes || null,
    };
    await api.salaryPayments.create({
      employeeId: payload.employee_id, paymentDate: payload.payment_date,
      amount: payload.amount, month: payload.month,
      paymentMethod: payload.payment_method, notes: payload.notes,
    });
    setPayModal(false);
    load();
  };

  const removePay = async (id: string) => {
    if (!confirm('Delete this salary payment?')) return;
    await api.salaryPayments.delete(id);
    load();
  };

  const totalMonthlySalaries = employees.filter((e) => e.is_active).reduce((s, e) => s + e.salary, 0);
  const totalPaidThisMonth = payments.filter((p) => p.month === new Date().toISOString().slice(0, 7)).reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 bg-slate-100 rounded-lg p-1 w-fit">
        <button onClick={() => setTab('employees')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'employees' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Employees</button>
        <button onClick={() => setTab('payments')} className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${tab === 'payments' ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500'}`}>Salary Payments</button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center"><Users size={20} className="text-blue-600" /></div><span className="text-sm text-slate-500">Active Employees</span></div>
          <p className="text-2xl font-bold text-slate-800">{employees.filter((e) => e.is_active).length}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center"><Banknote size={20} className="text-emerald-600" /></div><span className="text-sm text-slate-500">Monthly Salary Total</span></div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalMonthlySalaries, sym)}</p>
        </div>
        <div className="bg-white rounded-xl border border-slate-200 p-5">
          <div className="flex items-center gap-3 mb-2"><div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center"><Calendar size={20} className="text-amber-600" /></div><span className="text-sm text-slate-500">Paid This Month</span></div>
          <p className="text-2xl font-bold text-slate-800">{formatCurrency(totalPaidThisMonth, sym)}</p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between">
        <div className="relative flex-1 max-w-sm">
          <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tab === 'employees' ? 'Search employees...' : 'Search payments...'} className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm" />
        </div>
        {tab === 'employees' ? (
          <button onClick={openNewEmp} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-600/20"><Plus size={18} /> Add Employee</button>
        ) : (
          <button onClick={openNewPay} className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-600/20"><Plus size={18} /> Record Payment</button>
        )}
      </div>

      {/* Tables */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        {loading ? <div className="p-8 text-center text-slate-400">Loading...</div> : tab === 'employees' ? (
          filteredEmps.length === 0 ? <div className="p-8 text-center text-slate-400">No employees found.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Position</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Phone</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Hire Date</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Salary</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Status</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredEmps.map((e) => (
                    <tr key={e.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{e.name}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.position ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{e.phone ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(e.hire_date)}</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800">{formatCurrency(e.salary, sym)}</td>
                      <td className="px-4 py-3 text-center"><span className={`px-2 py-1 rounded-full text-xs font-medium ${e.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>{e.is_active ? 'Active' : 'Inactive'}</span></td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => openEditEmp(e)} className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-all"><Pencil size={16} /></button>
                          <button onClick={() => removeEmp(e.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          filteredPays.length === 0 ? <div className="p-8 text-center text-slate-400">No salary payments recorded.</div> : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Employee</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Month</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Pay Date</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Method</th>
                    <th className="text-right px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Amount</th>
                    <th className="text-center px-4 py-3 text-xs font-semibold text-slate-600 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredPays.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{p.employees?.name ?? '—'}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{p.month}</td>
                      <td className="px-4 py-3 text-sm text-slate-600">{formatDate(p.payment_date)}</td>
                      <td className="px-4 py-3 text-sm text-slate-600 uppercase">{p.payment_method}</td>
                      <td className="px-4 py-3 text-right font-bold text-emerald-600">{formatCurrency(p.amount, sym)}</td>
                      <td className="px-4 py-3 text-center"><button onClick={() => removePay(p.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all"><Trash2 size={16} /></button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        )}
      </div>

      {/* Employee Modal */}
      <Modal open={empModal} onClose={() => setEmpModal(false)} title={editingEmp ? 'Edit Employee' : 'Add Employee'}>
        <div className="space-y-4">
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Name *</label><input value={empForm.name} onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })} className="input" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Position</label><input value={empForm.position} onChange={(e) => setEmpForm({ ...empForm, position: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Phone</label><input value={empForm.phone} onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })} className="input" /></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Address</label><input value={empForm.address} onChange={(e) => setEmpForm({ ...empForm, address: e.target.value })} className="input" /></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Monthly Salary *</label><input type="number" step="0.01" value={empForm.salary} onChange={(e) => setEmpForm({ ...empForm, salary: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Hire Date</label><input type="date" value={empForm.hire_date} onChange={(e) => setEmpForm({ ...empForm, hire_date: e.target.value })} className="input" /></div>
          </div>
          <div className="flex gap-3 pt-2"><button onClick={saveEmp} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button><button onClick={() => setEmpModal(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button></div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal open={payModal} onClose={() => setPayModal(false)} title="Record Salary Payment">
        <div className="space-y-4">
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Employee *</label><select value={payForm.employee_id} onChange={(e) => onPayEmpSelect(e.target.value)} className="input"><option value="">Select employee...</option>{employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Month *</label><input type="month" value={payForm.month} onChange={(e) => setPayForm({ ...payForm, month: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Payment Date</label><input type="date" value={payForm.payment_date} onChange={(e) => setPayForm({ ...payForm, payment_date: e.target.value })} className="input" /></div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Amount *</label><input type="number" step="0.01" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} className="input" /></div>
            <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Payment Method</label><select value={payForm.payment_method} onChange={(e) => setPayForm({ ...payForm, payment_method: e.target.value })} className="input"><option value="cash">Cash</option><option value="bank">Bank Transfer</option><option value="cheque">Cheque</option></select></div>
          </div>
          <div><label className="text-sm font-medium text-slate-700 mb-1.5 block">Notes</label><input value={payForm.notes} onChange={(e) => setPayForm({ ...payForm, notes: e.target.value })} className="input" /></div>
          <div className="flex gap-3 pt-2"><button onClick={savePay} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button><button onClick={() => setPayModal(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button></div>
        </div>
      </Modal>
    </div>
  );
}
