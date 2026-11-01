import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, Route as RouteIcon, Calendar, Users, X, Check, Search, Store, ChevronDown, ChevronRight } from 'lucide-react';
import { api, routeDtoToLegacy, customerRouteDtoToLegacy, partyDtoToLegacy } from '@/lib/api';
import { dayName, DAYS_OF_WEEK } from '@/lib/utils';
import type { Route, Customer, CustomerRoute } from '@/lib/types';
import Modal from '@/components/Modal';

export default function Routes() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerRoutes, setCustomerRoutes] = useState<CustomerRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [form, setForm] = useState({ name: '', description: '', day_of_week: '1', sort_order: '0' });
  const [assignRoute, setAssignRoute] = useState<Route | null>(null);
  const [expandedRoute, setExpandedRoute] = useState<string | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(null);
  const [shopSearch, setShopSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const [r, c, cr] = await Promise.all([
      api.routes.list().catch(() => []),
      api.customers.list().catch(() => []),
      api.customerRoutes.list().catch(() => []),
    ]);
    setRoutes(r.map(routeDtoToLegacy));
    setCustomers(c.map(partyDtoToLegacy));
    setCustomerRoutes(cr.map(customerRouteDtoToLegacy));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openNew = () => {
    setEditing(null);
    setForm({ name: '', description: '', day_of_week: '1', sort_order: String(routes.length + 1) });
    setModalOpen(true);
  };

  const openEdit = (r: Route) => {
    setEditing(r);
    setForm({ name: r.name, description: r.description ?? '', day_of_week: String(r.day_of_week), sort_order: String(r.sort_order) });
    setModalOpen(true);
  };

  const save = async () => {
    const payload = {
      name: form.name,
      description: form.description || null,
      day_of_week: parseInt(form.day_of_week),
      sort_order: parseInt(form.sort_order),
    };
    const input = {
      name: payload.name, description: payload.description,
      dayOfWeek: payload.day_of_week, sortOrder: payload.sort_order,
    };
    if (editing) {
      await api.routes.update(editing.id, input);
    } else {
      await api.routes.create(input);
    }
    setModalOpen(false);
    load();
  };

  const remove = async (id: string) => {
    if (!confirm('Delete this route? Shop assignments will also be removed.')) return;
    await api.routes.delete(id);
    load();
  };

  const toggleCustomer = async (routeId: string, customerId: string) => {
    const existing = customerRoutes.find((cr) => cr.route_id === routeId && cr.customer_id === customerId);
    if (existing) {
      await api.customerRoutes.unassign(existing.id);
    } else {
      await api.customerRoutes.assign(routeId, customerId);
    }
    load();
  };

  const getRouteCustomers = (routeId: string) => {
    const ids = customerRoutes.filter((cr) => cr.route_id === routeId).map((cr) => cr.customer_id);
    return customers.filter((c) => ids.includes(c.id));
  };

  const filteredAssignCustomers = (routeId: string) => {
    const term = shopSearch.toLowerCase();
    return customers.filter((c) => {
      const matchesSearch = !term ||
        c.name.toLowerCase().includes(term) ||
        (c.phone ?? '').toLowerCase().includes(term) ||
        (c.city ?? '').toLowerCase().includes(term);
      if (!matchesSearch) return false;
      const assigned = customerRoutes.some((cr) => cr.route_id === routeId && cr.customer_id === c.id);
      return assigned;
    });
  };

  const filteredUnassigned = () => {
    const term = shopSearch.toLowerCase();
    const assignedIds = new Set(customerRoutes.map((cr) => cr.customer_id));
    return customers.filter((c) => {
      if (assignedIds.has(c.id)) return false;
      if (!term) return true;
      return c.name.toLowerCase().includes(term) ||
        (c.phone ?? '').toLowerCase().includes(term) ||
        (c.city ?? '').toLowerCase().includes(term);
    });
  };

  // Build 7-day schedule view
  const schedule = DAYS_OF_WEEK.map((day, idx) => ({
    day,
    dayNum: idx,
    routes: routes.filter((r) => r.day_of_week === idx),
  }));

  const totalShops = customers.length;
  const assignedShops = new Set(customerRoutes.map((cr) => cr.customer_id)).size;

  const toggleExpand = (routeId: string) => {
    setExpandedRoute(expandedRoute === routeId ? null : routeId);
    setShopSearch('');
  };

  const toggleDayExpand = (dayNum: number) => {
    setExpandedDay(expandedDay === dayNum ? null : dayNum);
    setShopSearch('');
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
            <Store size={20} className="text-emerald-600" />
            Routes & Shops
          </h2>
          <p className="text-sm text-slate-600 mt-0.5">
            {totalShops} shops total · {assignedShops} assigned · {totalShops - assignedShops} unassigned
          </p>
        </div>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-emerald-600/20">
          <Plus size={18} /> Add Route
        </button>
      </div>

      {/* Route cards with expandable shop lists */}
      {loading ? (
        <div className="p-8 text-center text-slate-400">Loading routes...</div>
      ) : routes.length === 0 ? (
        <div className="p-8 text-center text-slate-400 bg-white rounded-xl border border-slate-200">
          No routes found. Click "Add Route" to create one.
        </div>
      ) : (
        <div className="space-y-3">
          {routes.map((r) => {
            const routeShops = getRouteCustomers(r.id);
            const isExpanded = expandedRoute === r.id;
            const filteredShops = isExpanded ? filteredAssignCustomers(r.id) : routeShops;
            return (
              <div key={r.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                {/* Route header */}
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <button onClick={() => toggleExpand(r.id)} className="flex items-center gap-3 flex-1 text-left">
                    {isExpanded ? <ChevronDown size={20} className="text-slate-400" /> : <ChevronRight size={20} className="text-slate-400" />}
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                      <RouteIcon size={18} className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">{r.name}</p>
                      <p className="text-xs text-slate-500">
                        {dayName(r.day_of_week)}{r.description ? ` · ${r.description}` : ''}
                      </p>
                    </div>
                  </button>
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-bold">
                      {routeShops.length} shops
                    </span>
                    <div className="flex gap-1">
                      <button onClick={() => setAssignRoute(r)} className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-600 rounded-lg text-xs font-medium transition-all">
                        <Users size={14} /> Assign
                      </button>
                      <button onClick={() => openEdit(r)} className="p-1.5 text-slate-500 hover:bg-slate-200 rounded-lg transition-all" title="Edit">
                        <Pencil size={14} />
                      </button>
                      <button onClick={() => remove(r.id)} className="p-1.5 text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>

                {/* Expanded shop list */}
                {isExpanded && (
                  <div className="border-t border-slate-200">
                    {/* Search bar */}
                    <div className="p-3 bg-slate-50 border-b border-slate-200">
                      <div className="relative max-w-sm">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          value={shopSearch}
                          onChange={(e) => setShopSearch(e.target.value)}
                          placeholder="Search shops by name, phone, city..."
                          className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
                        />
                      </div>
                    </div>

                    {/* Shop list - scrollable for 50+ shops */}
                    {filteredShops.length === 0 ? (
                      <div className="p-6 text-center text-slate-400 text-sm">
                        {shopSearch ? 'No shops match your search.' : 'No shops assigned to this route. Click "Assign" to add shops.'}
                      </div>
                    ) : (
                      <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {filteredShops.map((c, idx) => (
                          <div key={c.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                            <span className="text-xs text-slate-400 font-mono w-8">#{idx + 1}</span>
                            <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                              <Store size={14} className="text-slate-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                              <p className="text-xs text-slate-500">
                                {[c.phone, c.city].filter(Boolean).join(' · ') || 'No contact info'}
                              </p>
                            </div>
                            {c.balance_type === 'receivable' && c.current_balance > 0 && (
                              <span className="text-xs font-medium text-rose-600">Bal: {c.current_balance.toFixed(0)}</span>
                            )}
                            <button
                              onClick={() => toggleCustomer(r.id, c.id)}
                              className="p-1 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition-all"
                              title="Remove from route"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Unassigned shops section */}
                    {filteredUnassigned().length > 0 && (
                      <div className="border-t-2 border-dashed border-slate-200">
                        <div className="px-4 py-2 bg-amber-50/50 flex items-center gap-2">
                          <span className="text-xs font-semibold text-amber-700 uppercase">Unassigned Shops</span>
                          <span className="text-xs text-amber-600">({filteredUnassigned().length})</span>
                        </div>
                        <div className="max-h-48 overflow-y-auto divide-y divide-slate-100">
                          {filteredUnassigned().map((c) => (
                            <div key={c.id} className="px-4 py-2.5 flex items-center gap-3 hover:bg-slate-50 transition-colors">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                                <Store size={14} className="text-slate-400" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium text-slate-800 truncate">{c.name}</p>
                                <p className="text-xs text-slate-500">
                                  {[c.phone, c.city].filter(Boolean).join(' · ') || 'No contact info'}
                                </p>
                              </div>
                              <button
                                onClick={() => toggleCustomer(r.id, c.id)}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-emerald-600 hover:bg-emerald-50 rounded transition-all"
                                title="Add to this route"
                              >
                                <Plus size={12} /> Add
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Weekly schedule grid */}
      <div className="mt-6">
        <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
          <Calendar size={18} className="text-emerald-600" />
          Weekly Schedule Overview
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
          {schedule.map(({ day, dayNum, routes: dayRoutes }) => {
            const dayOpen = expandedDay === dayNum;
            return (
            <div key={dayNum} className={`bg-white rounded-xl border p-3 transition-colors ${dayOpen ? 'border-emerald-300' : 'border-slate-200'}`}>
              <button onClick={() => toggleDayExpand(dayNum)} className="w-full flex items-center gap-2 mb-2 text-left">
                {dayOpen ? <ChevronDown size={14} className="text-slate-400" /> : <ChevronRight size={14} className="text-slate-400" />}
                <Calendar size={14} className="text-emerald-600" />
                <h4 className="font-bold text-sm text-slate-800">{day}</h4>
                {dayRoutes.length === 0 && <span className="text-xs text-slate-400 ml-auto">No routes</span>}
              </button>
              <div className="space-y-1.5">
                {dayRoutes.map((r) => {
                  const routeShops = getRouteCustomers(r.id);
                  return (
                  <div key={r.id} className="bg-slate-50 rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-slate-800">{r.name}</span>
                      <span className="text-xs text-emerald-600 font-medium">{routeShops.length} shops</span>
                    </div>
                    {r.description && <p className="text-xs text-slate-500 mt-0.5">{r.description}</p>}
                    {dayOpen && (
                      <>
                        {routeShops.length > 0 ? (
                          <div className="mt-2 max-h-40 overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
                            {routeShops.map((c) => (
                              <div key={c.id} className="px-2.5 py-1.5 flex items-center gap-2">
                                <Store size={12} className="text-slate-400 flex-shrink-0" />
                                <span className="text-xs text-slate-700 truncate flex-1">{c.name}</span>
                                <button
                                  onClick={() => toggleCustomer(r.id, c.id)}
                                  className="p-0.5 text-red-400 hover:bg-red-50 hover:text-red-600 rounded transition-all"
                                  title="Remove from route"
                                >
                                  <X size={12} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-xs text-slate-400 mt-2">No shops on this route yet.</p>
                        )}
                        <button
                          onClick={() => setAssignRoute(r)}
                          className="mt-2 w-full flex items-center justify-center gap-1 py-1.5 text-xs font-medium text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-all"
                        >
                          <Plus size={12} /> Add Shops
                        </button>
                      </>
                    )}
                  </div>
                  );
                })}
              </div>
            </div>
            );
          })}
        </div>
      </div>

      {/* Add/Edit Route Modal */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editing ? 'Edit Route' : 'Add Route'}>
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Route Name *</label>
            <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="input" placeholder="e.g. Route 1 - North Area" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1.5 block">Description</label>
            <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input" placeholder="Area covered" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Day of Week</label>
              <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })} className="input">
                {DAYS_OF_WEEK.map((d, i) => <option key={i} value={i}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1.5 block">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="input" />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button onClick={save} className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-lg font-medium transition-all">Save</button>
            <button onClick={() => setModalOpen(false)} className="px-6 bg-slate-100 hover:bg-slate-200 text-slate-600 py-2.5 rounded-lg font-medium transition-all">Cancel</button>
          </div>
        </div>
      </Modal>

      {/* Customer Assignment Modal */}
      {assignRoute && (
        <Modal open onClose={() => setAssignRoute(null)} title={`Assign Shops — ${assignRoute.name}`} size="lg">
          <div className="space-y-3">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                value={shopSearch}
                onChange={(e) => setShopSearch(e.target.value)}
                placeholder="Search shops..."
                className="w-full pl-9 pr-4 py-2 rounded-lg border border-slate-200 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none text-sm"
              />
            </div>
            <div className="max-h-96 overflow-y-auto space-y-1.5">
              {customers.length === 0 ? (
                <p className="text-center text-slate-400 py-4">No shops available. Add customers first.</p>
              ) : (
                customers
                  .filter((c) => {
                    const term = shopSearch.toLowerCase();
                    if (!term) return true;
                    return c.name.toLowerCase().includes(term) ||
                      (c.phone ?? '').toLowerCase().includes(term) ||
                      (c.city ?? '').toLowerCase().includes(term);
                  })
                  .map((c) => {
                    const assigned = customerRoutes.some((cr) => cr.route_id === assignRoute.id && cr.customer_id === c.id);
                    return (
                      <button
                        key={c.id}
                        onClick={() => toggleCustomer(assignRoute.id, c.id)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-all ${
                          assigned ? 'bg-emerald-50 border border-emerald-200' : 'bg-slate-50 hover:bg-slate-100 border border-transparent'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                            <Store size={14} className="text-slate-600" />
                          </div>
                          <div className="text-left">
                            <span className="text-sm font-medium text-slate-800 block">{c.name}</span>
                            <span className="text-xs text-slate-500">{[c.phone, c.city].filter(Boolean).join(' · ') || 'No contact'}</span>
                          </div>
                        </div>
                        {assigned ? <Check size={16} className="text-emerald-600" /> : <Plus size={16} className="text-slate-300" />}
                      </button>
                    );
                  })
              )}
            </div>
            <div className="text-xs text-slate-500 text-center pt-2">
              {getRouteCustomers(assignRoute.id).length} shops assigned to this route
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
