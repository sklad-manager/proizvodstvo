'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import FinanceCalendar from '@/components/FinanceCalendar';

interface FinRecord {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: 'planned' | 'paid';
  payment_method: string;
  type: 'expense' | 'income';
  is_confirmed: boolean;
  receipt_id?: string;
  receipt_number?: string;
  photo_url?: string;
  comment?: string;
  created_at?: string;
}

const CATEGORIES: Record<string, { name: string; color: string }> = {
  materials: { name: 'Сырье', color: 'bg-orange-500' },
  maintenance: { name: 'Ремонт и ТО', color: 'bg-blue-500' },
  salary: { name: 'Зарплаты', color: 'bg-emerald-500' },
  rent: { name: 'Аренда / ЖКУ', color: 'bg-indigo-500' },
  small: { name: 'Мелкие траты', color: 'bg-rose-500' },
  sales: { name: 'Продажа', color: 'bg-teal-500' },
  other: { name: 'Прочее', color: 'bg-slate-500' },
};
const PAY_METHODS = ['Ф1', 'Ф2', 'ФОП'];

export default function ExpensesPage() {
  const [records, setRecords] = useState<FinRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'expense' | 'income'>('expense');
  const [newAmount, setNewAmount] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('small');
  const [newPay, setNewPay] = useState('Ф1');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterPay, setFilterPay] = useState('all');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [expandedReceipts, setExpandedReceipts] = useState<Set<string>>(new Set());
  const [calYear, setCalYear] = useState(new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(new Date().getMonth());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editComment, setEditComment] = useState('');
  const [editDate, setEditDate] = useState('');

  const startEditing = (rec: FinRecord) => {
    setEditingId(rec.id); setEditComment(rec.comment || ''); setEditDate(rec.date?.split('T')[0] || '');
  };

  const saveEdit = async (id: string) => {
    await fetch('/api/expenses', { method: 'PATCH', body: JSON.stringify({ id, comment: editComment, date: editDate }) });
    setEditingId(null); loadData();
  };

  const changeMonth = (delta: number) => {
    let m = calMonth + delta, y = calYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setCalMonth(m); setCalYear(y); setSelectedDate(null);
  };

  // Суммы по дням для календаря
  const dayTotals = useMemo(() => {
    const map: Record<string, { expense: number; income: number }> = {};
    records.filter(r => r.is_confirmed).forEach(r => {
      const d = r.date?.split('T')[0];
      if (!d) return;
      if (!map[d]) map[d] = { expense: 0, income: 0 };
      if (r.type === 'income') map[d].income += r.amount;
      else map[d].expense += r.amount;
    });
    return map;
  }, [records]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      if (Array.isArray(data)) setRecords(data);
    } catch (e) { console.error(e); }
    setIsLoaded(true);
  };

  useEffect(() => { loadData(); const i = setInterval(loadData, 10000); return () => clearInterval(i); }, []);

  const addRecord = async () => {
    if (!newAmount || !newDesc) return;
    await fetch('/api/expenses', { method: 'POST', body: JSON.stringify({
      id: Date.now().toString(), category: newCat, description: newDesc,
      amount: parseFloat(newAmount), date: newDate, status: 'paid',
      paymentMethod: newPay, type: formType, isConfirmed: true
    })});
    setNewAmount(''); setNewDesc(''); setShowForm(false); loadData();
  };

  const confirmRecord = async (id: string) => {
    await fetch('/api/expenses', { method: 'PATCH', body: JSON.stringify({ id, isConfirmed: true }) });
    loadData();
  };

  const confirmReceipt = async (receiptId: string) => {
    // Подтверждаем все записи чека
    const items = pending.filter(r => r.receipt_id === receiptId);
    for (const item of items) {
      await fetch('/api/expenses', { method: 'PATCH', body: JSON.stringify({ id: item.id, isConfirmed: true }) });
    }
    loadData();
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('Удалить запись?')) return;
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' }); loadData();
  };

  const deleteReceipt = async (receiptId: string) => {
    if (!confirm('Удалить все записи этого чека?')) return;
    const items = records.filter(r => r.receipt_id === receiptId);
    for (const item of items) {
      await fetch(`/api/expenses?id=${item.id}`, { method: 'DELETE' });
    }
    loadData();
  };

  const exportMonth = async () => {
    setIsExporting(true);
    const month = `${calYear}-${(calMonth + 1).toString().padStart(2, '0')}`;
    try {
      const res = await fetch(`/api/export?month=${month}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url;
        a.download = `Финансы_${month}.zip`; a.click();
        URL.revokeObjectURL(url);
      } else { alert('Ошибка экспорта'); }
    } catch (e) { alert('Ошибка экспорта'); }
    setIsExporting(false);
  };

  const confirmed = records.filter(r => r.is_confirmed);
  const pending = records.filter(r => !r.is_confirmed);

  // Группируем pending по receipt_id
  const pendingGroups: { receiptId: string | null; items: FinRecord[]; receiptNumber?: string; photoUrl?: string }[] = [];
  const pendingWithReceipt = pending.filter(r => r.receipt_id);
  const pendingWithout = pending.filter(r => !r.receipt_id);
  const receiptIds = [...new Set(pendingWithReceipt.map(r => r.receipt_id))];
  receiptIds.forEach(rid => {
    const items = pendingWithReceipt.filter(r => r.receipt_id === rid);
    pendingGroups.push({ receiptId: rid!, items, receiptNumber: items[0]?.receipt_number, photoUrl: items[0]?.photo_url });
  });
  pendingWithout.forEach(r => pendingGroups.push({ receiptId: null, items: [r] }));

  const filtered = confirmed.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterPay !== 'all' && r.payment_method !== filterPay) return false;
    if (selectedDate && r.date?.split('T')[0] !== selectedDate) return false;
    return true;
  });

  // Итоги — по выбранной дате или по всем
  const scopeRecords = selectedDate ? confirmed.filter(r => r.date?.split('T')[0] === selectedDate) : confirmed;
  const totalIncome = scopeRecords.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = scopeRecords.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
  const balance = totalIncome - totalExpense;

  if (!isLoaded) return <div className="p-10 text-center font-black text-slate-300 uppercase tracking-widest animate-pulse">Загрузка финансов...</div>;

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-full overflow-x-hidden">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-800 text-white hover:bg-black transition-all shadow-lg">
            <i className="ni ni-bold-left text-sm"></i>
          </Link>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Финансы</h2>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-500 tracking-widest">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Облако + Телеграм-бот
            </div>
          </div>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          <Link href="/ai-assistant" className="w-11 h-11 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition-all shadow-sm shrink-0">
            <i className="ni ni-bulb-61 text-lg"></i>
          </Link>
          <button onClick={exportMonth} disabled={isExporting}
            className="px-4 py-2.5 rounded-2xl bg-slate-100 text-slate-600 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-1.5">
            {isExporting ? '⏳' : '📥'} <span className="hidden md:inline">Экспорт</span>
          </button>
          <button onClick={() => setShowForm(!showForm)}
            className={`px-5 py-2.5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg ${showForm ? 'bg-slate-100 text-slate-500' : 'bg-rose-500 text-white shadow-rose-200'}`}>
            {showForm ? 'Отмена' : '+ Запись'}
          </button>
        </div>
      </div>

      {/* Календарь */}
      <FinanceCalendar
        year={calYear} month={calMonth}
        selectedDate={selectedDate}
        dayTotals={dayTotals}
        onSelectDate={(d) => { setSelectedDate(d); if (d) setNewDate(d); }}
        onChangeMonth={changeMonth}
      />

      {/* Финансовый пульс */}
      {selectedDate && (
        <div className="px-3 py-2 bg-slate-800 text-white rounded-2xl text-center text-xs font-black uppercase tracking-widest">
          📅 {new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' })}
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-xl border border-gray-50 relative overflow-hidden">
          <div className="text-[9px] md:text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-1 md:mb-2">{selectedDate ? 'Приход' : 'Доходы'}</div>
          <div className="text-lg md:text-3xl font-black text-emerald-500">+{totalIncome.toLocaleString()}</div>
          <div className="text-[10px] md:text-xs font-bold text-slate-300 mt-1">грн</div>
          <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 w-full"></div>
        </div>
        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-xl border border-gray-50 relative overflow-hidden">
          <div className="text-[9px] md:text-[10px] font-black uppercase text-rose-400 tracking-widest mb-1 md:mb-2">Расходы</div>
          <div className="text-lg md:text-3xl font-black text-rose-500">-{totalExpense.toLocaleString()}</div>
          <div className="text-[10px] md:text-xs font-bold text-slate-300 mt-1">грн</div>
          <div className="absolute bottom-0 left-0 h-1 bg-rose-500 w-full"></div>
        </div>
        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-xl border border-gray-50 relative overflow-hidden">
          <div className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 md:mb-2">Баланс</div>
          <div className={`text-lg md:text-3xl font-black ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString()}
          </div>
          <div className="text-[10px] md:text-xs font-bold text-slate-300 mt-1">грн</div>
          <div className={`absolute bottom-0 left-0 h-1 w-full ${balance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
        </div>
      </div>

      {/* Ожидают подтверждения */}
      {pendingGroups.length > 0 && (
        <div className="bg-amber-50 p-5 md:p-6 rounded-[2rem] border-2 border-amber-200">
          <h3 className="text-xs font-black uppercase text-amber-600 tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
            Ожидают подтверждения ({pending.length})
          </h3>
          <div className="flex flex-col gap-4">
            {pendingGroups.map((group, gi) => (
              <div key={gi} className="bg-white rounded-2xl border border-amber-100 overflow-hidden">
                {/* Шапка чека */}
                {group.receiptId && (
                  <div className="px-4 py-3 bg-slate-50 flex items-center justify-between border-b border-gray-100">
                    <div className="flex items-center gap-3">
                      {group.photoUrl && (
                        <button onClick={() => setPreviewPhoto(group.photoUrl!)} className="w-10 h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 hover:ring-2 ring-amber-400 transition-all">
                          <img src={group.photoUrl} alt="чек" className="w-full h-full object-cover" />
                        </button>
                      )}
                      <div>
                        <div className="text-xs font-black text-slate-700">🧾 {group.receiptNumber}</div>
                        <div className="text-[10px] text-slate-400 font-bold">{group.items.length} поз. · {group.items.reduce((s, i) => s + i.amount, 0)} грн</div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button onClick={() => confirmReceipt(group.receiptId!)} className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white text-[10px] font-black">✓ Всё</button>
                      <button onClick={() => deleteReceipt(group.receiptId!)} className="px-3 py-1.5 rounded-lg bg-red-50 text-red-400 text-[10px] font-black">✕</button>
                    </div>
                  </div>
                )}
                {/* Позиции */}
                {group.items.map(rec => {
                  const cat = CATEGORIES[rec.category] || CATEGORIES.other;
                  return (
                    <div key={rec.id} className="px-4 py-3 flex items-center justify-between gap-2 border-b border-gray-50 last:border-0">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white text-xs shrink-0 ${cat.color}`}>
                          {rec.type === 'income' ? '💰' : '📉'}
                        </div>
                        <div className="min-w-0">
                          <div className="font-bold text-sm text-slate-700 truncate">{rec.description}</div>
                          <div className="text-[9px] text-slate-400 font-bold">{cat.name} · {rec.payment_method}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-sm font-black ${rec.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {rec.type === 'income' ? '+' : '-'}{rec.amount.toLocaleString()}
                        </span>
                        {!group.receiptId && <>
                          <button onClick={() => confirmRecord(rec.id)} className="w-8 h-8 rounded-lg bg-emerald-500 text-white flex items-center justify-center text-xs">✓</button>
                          <button onClick={() => deleteRecord(rec.id)} className="w-8 h-8 rounded-lg bg-red-50 text-red-400 flex items-center justify-center text-xs">✕</button>
                        </>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Форма добавления */}
      {showForm && (
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-2xl border-2 border-slate-100">
          <div className="flex gap-2 mb-6">
            <button onClick={() => setFormType('expense')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${formType === 'expense' ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Расход</button>
            <button onClick={() => setFormType('income')} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${formType === 'income' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>Деньги под отчёт</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 px-2">Описание</label>
              <input type="text" placeholder="Что..." className="w-full px-4 py-3 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400 px-2">Сумма</label>
                <input type="number" placeholder="0" className="w-full px-4 py-3 rounded-xl bg-slate-50 outline-none font-black text-sm" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
              </div>
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400 px-2">Дата</label>
                <input type="date" className="w-full px-4 py-3 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 px-2">Категория</label>
              <select className="w-full px-4 py-3 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={newCat} onChange={(e) => setNewCat(e.target.value)}>
                {Object.entries(CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 px-2">Форма оплаты</label>
              <div className="flex gap-2">
                {PAY_METHODS.map(m => (
                  <button key={m} onClick={() => setNewPay(m)} className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${newPay === m ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>{m}</button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={addRecord} className="w-full mt-6 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all">Записать</button>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2 px-1">
        {[{ key: 'all', label: 'Все' }, { key: 'income', label: '💰 Доходы' }, { key: 'expense', label: '📉 Расходы' }].map(f => (
          <button key={f.key} onClick={() => setFilterType(f.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${filterType === f.key ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border border-gray-100'}`}>{f.label}</button>
        ))}
        <div className="w-px bg-gray-100 mx-1"></div>
        <button onClick={() => setFilterPay('all')} className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${filterPay === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border border-gray-100'}`}>Все</button>
        {PAY_METHODS.map(m => (
          <button key={m} onClick={() => setFilterPay(m)}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${filterPay === m ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border border-gray-100'}`}>{m}</button>
        ))}
      </div>

      {/* Таблица операций */}
      <div className="flex flex-col gap-2.5">
        <h3 className="text-sm font-black uppercase text-slate-400 tracking-[0.15em] px-2">Операции ({filtered.length})</h3>
        {filtered.length === 0 && (
          <div className="py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
            <p className="font-black uppercase text-xs text-slate-300 tracking-widest">Нет записей</p>
          </div>
        )}
        {(() => {
          // Группируем по receipt_id
          const groups: { receiptId: string | null; items: FinRecord[]; photoUrl?: string; receiptNumber?: string }[] = [];
          const byReceipt: Record<string, FinRecord[]> = {};
          const standalone: FinRecord[] = [];
          filtered.forEach(r => {
            if (r.receipt_id) {
              if (!byReceipt[r.receipt_id]) byReceipt[r.receipt_id] = [];
              byReceipt[r.receipt_id].push(r);
            } else {
              standalone.push(r);
            }
          });
          Object.entries(byReceipt).forEach(([rid, items]) => {
            groups.push({ receiptId: rid, items, photoUrl: items[0]?.photo_url, receiptNumber: items[0]?.receipt_number });
          });
          standalone.forEach(r => groups.push({ receiptId: null, items: [r] }));

          // Сортируем по дате, затем по дате добавления (последнее добавление сверху)
          groups.sort((a, b) => {
            const dateDiff = new Date(b.items[0].date).getTime() - new Date(a.items[0].date).getTime();
            if (dateDiff !== 0) return dateDiff;
            return new Date(b.items[0].created_at || 0).getTime() - new Date(a.items[0].created_at || 0).getTime();
          });

          return groups.map((group, gi) => {
            // Чек с несколькими позициями — свёрнутый
            if (group.receiptId && group.items.length > 1) {
              const total = group.items.reduce((s, r) => s + r.amount, 0);
              const isExpanded = expandedReceipts.has(group.receiptId);
              const toggleExpand = () => {
                setExpandedReceipts(prev => {
                  const next = new Set(prev);
                  if (next.has(group.receiptId!)) next.delete(group.receiptId!); else next.add(group.receiptId!);
                  return next;
                });
              };
              return (
                <div key={gi} className="bg-white rounded-2xl shadow-sm border-l-[6px] border-rose-400 overflow-hidden">
                  {/* Свёрнутая шапка чека */}
                  <div className="p-3.5 md:p-4 flex items-center justify-between gap-2 cursor-pointer hover:bg-slate-50/50 transition-all" onClick={toggleExpand}>
                    <div className="flex items-center gap-2.5 min-w-0">
                      {group.photoUrl && (
                        <button onClick={(e) => { e.stopPropagation(); setPreviewPhoto(group.photoUrl!); }} className="w-9 h-9 md:w-10 md:h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 hover:ring-2 ring-blue-400 transition-all">
                          <img src={group.photoUrl} alt="чек" className="w-full h-full object-cover" />
                        </button>
                      )}
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-black text-slate-800 text-sm">🧾 {group.receiptNumber || 'Чек'}</span>
                          <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-500">{group.items.length} поз.</span>
                        </div>
                        <div className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[200px]">
                          {group.items[0]?.payment_method || 'Ф1'} · {new Date(group.items[0].date).toLocaleDateString('ru-RU')}
                          {group.items[0]?.comment && <span className="ml-1 text-slate-500">· {group.items[0].comment}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <div className="flex flex-col items-end gap-1">
                        <span className="text-sm md:text-lg font-black text-rose-500">-{total.toLocaleString()} <span className="text-[9px]">грн</span></span>
                        <button onClick={(e) => { e.stopPropagation(); editingId === group.receiptId ? setEditingId(null) : startEditing({...group.items[0], id: group.receiptId!}); }} className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs transition-all ${editingId === group.receiptId ? 'bg-slate-800 text-white' : 'bg-blue-50 text-blue-400 active:bg-blue-100'}`}>✏️</button>
                      </div>
                      <span className={`text-slate-300 text-lg transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                    </div>
                  </div>
                  {/* Панель редактирования для всего чека */}
                  {editingId === group.receiptId && (
                    <div className="px-4 pb-4 flex flex-col gap-2 border-t border-gray-50 bg-slate-50/50 pt-3">
                      <div className="flex gap-2">
                        <div className="flex flex-col gap-1 flex-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Дата всего чека</label>
                          <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-bold outline-none" />
                        </div>
                        <div className="flex flex-col gap-1 flex-[2]">
                          <label className="text-[9px] font-black text-slate-400 uppercase">Комментарий ко всему чеку</label>
                          <input type="text" placeholder="Добавить заметку..." value={editComment} onChange={e => setEditComment(e.target.value)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm outline-none" />
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => saveEdit(group.items[0].id)} className="flex-1 py-2 rounded-lg bg-slate-800 text-white text-xs font-black">💾 Сохранить для всех</button>
                        <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg bg-gray-100 text-slate-400 text-xs font-black">Отмена</button>
                      </div>
                    </div>
                  )}
                  {/* Развёрнутые позиции */}
                  {isExpanded && (
                    <div className="border-t border-gray-50">
                      {group.items.map(rec => {
                        const cat = CATEGORIES[rec.category] || CATEGORIES.other;
                        const isEditing = editingId === rec.id;
                        return (
                          <div key={rec.id} className="flex flex-col border-b border-gray-50 last:border-0 bg-slate-50/30">
                            <div className="px-4 md:px-6 py-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                <div className={`w-6 h-6 rounded-md flex items-center justify-center text-white text-[10px] shrink-0 ${cat.color}`}>📉</div>
                                <div className="min-w-0">
                                  <div className="text-sm font-bold text-slate-600 truncate">{rec.description}</div>
                                  <div className="flex items-center gap-1.5 mt-0.5">
                                    <div className="text-[9px] text-slate-400">{cat.name}</div>
                                    <div className="text-[9px] text-slate-300">{new Date(rec.date).toLocaleDateString('ru-RU')}</div>
                                  </div>
                                  {rec.comment && !isEditing && (
                                    <div className="text-[9px] text-slate-400 mt-0.5 italic">💬 {rec.comment}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                <span className="text-sm font-black text-rose-400">-{rec.amount.toLocaleString()}</span>
                                <button onClick={() => isEditing ? setEditingId(null) : startEditing(rec)} className={`w-6 h-6 rounded flex items-center justify-center text-[10px] transition-all ${isEditing ? 'bg-slate-800 text-white' : 'bg-blue-50 text-blue-400 active:bg-blue-100'}`}>✏️</button>
                                <button onClick={() => deleteRecord(rec.id)} className="w-6 h-6 rounded bg-gray-50 text-slate-200 hover:text-red-500 active:text-red-500 transition-colors flex items-center justify-center text-xs">✕</button>
                              </div>
                            </div>
                            {/* Панель редактирования */}
                            {isEditing && (
                              <div className="px-4 pb-3 flex flex-col gap-2 bg-slate-100/50 pt-2 border-t border-gray-100">
                                <div className="flex gap-2">
                                  <div className="flex flex-col gap-1 flex-1">
                                    <label className="text-[8px] font-black text-slate-400 uppercase">Дата</label>
                                    <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="px-2 py-1.5 rounded-md bg-white border border-gray-200 text-xs font-bold outline-none" />
                                  </div>
                                  <div className="flex flex-col gap-1 flex-[2]">
                                    <label className="text-[8px] font-black text-slate-400 uppercase">Комментарий</label>
                                    <input type="text" placeholder="Добавить заметку..." value={editComment} onChange={e => setEditComment(e.target.value)} className="px-2 py-1.5 rounded-md bg-white border border-gray-200 text-xs outline-none" />
                                  </div>
                                </div>
                                <div className="flex gap-2">
                                  <button onClick={() => saveEdit(rec.id)} className="flex-1 py-1.5 rounded-md bg-slate-800 text-white text-[10px] font-black">💾 Сохранить</button>
                                  <button onClick={() => setEditingId(null)} className="px-3 py-1.5 rounded-md bg-gray-200 text-slate-500 text-[10px] font-black">Отмена</button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            // Одиночная запись
            const rec = group.items[0];
            const cat = CATEGORIES[rec.category] || CATEGORIES.other;
            const isIncome = rec.type === 'income';
            const isEditing = editingId === rec.id;
            return (
              <div key={rec.id} className={`bg-white rounded-2xl shadow-sm border-l-[6px] transition-all hover:shadow-md overflow-hidden ${isIncome ? 'border-emerald-500' : 'border-rose-400'}`}>
                <div className="p-3.5 md:p-5 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 md:gap-4 min-w-0">
                    {rec.photo_url && (
                      <button onClick={() => setPreviewPhoto(rec.photo_url!)} className="w-9 h-9 md:w-10 md:h-10 rounded-lg overflow-hidden bg-gray-100 shrink-0 active:ring-2 ring-blue-400 transition-all">
                        <img src={rec.photo_url} alt="чек" className="w-full h-full object-cover" />
                      </button>
                    )}
                    <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white text-sm shrink-0 ${cat.color} ${rec.photo_url ? 'hidden md:flex' : ''}`}>
                      {isIncome ? '💰' : '📉'}
                    </div>
                    <div className="min-w-0">
                      <div className="font-black text-slate-800 text-sm leading-tight truncate">
                        {isIncome ? 'Деньги под отчёт' : rec.description}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                        {rec.receipt_number && <span className="px-1.5 py-0.5 bg-blue-50 rounded text-[8px] font-black text-blue-500">{rec.receipt_number}</span>}
                        {!isIncome && <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-600">{rec.payment_method || 'Ф1'}</span>}
                        {!isIncome && <span className="text-[10px] font-bold text-slate-400">{cat.name}</span>}
                        <span className="text-[10px] text-slate-300">{new Date(rec.date).toLocaleDateString('ru-RU')}</span>
                      </div>
                      {rec.comment && !isEditing && (
                        <div className="text-[10px] text-slate-400 mt-1 italic">💬 {rec.comment}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`text-sm md:text-lg font-black ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {isIncome ? '+' : '-'}{rec.amount.toLocaleString()} <span className="text-[9px]">грн</span>
                    </span>
                    <button onClick={() => isEditing ? setEditingId(null) : startEditing(rec)} className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center text-sm transition-all ${isEditing ? 'bg-slate-800 text-white' : 'bg-blue-50 text-blue-400 active:bg-blue-100'}`}>✏️</button>
                    <button onClick={() => deleteRecord(rec.id)} className="w-8 h-8 md:w-9 md:h-9 rounded-lg bg-gray-50 text-slate-200 hover:text-red-500 active:text-red-500 transition-colors flex items-center justify-center text-sm">✕</button>
                  </div>
                </div>
                {/* Панель редактирования */}
                {isEditing && (
                  <div className="px-4 pb-4 flex flex-col gap-2 border-t border-gray-50 bg-slate-50/50 pt-3">
                    <div className="flex gap-2">
                      <div className="flex flex-col gap-1 flex-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Дата</label>
                        <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm font-bold outline-none" />
                      </div>
                      <div className="flex flex-col gap-1 flex-[2]">
                        <label className="text-[9px] font-black text-slate-400 uppercase">Комментарий</label>
                        <input type="text" placeholder="Добавить заметку..." value={editComment} onChange={e => setEditComment(e.target.value)} className="px-3 py-2 rounded-lg bg-white border border-gray-200 text-sm outline-none" />
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => saveEdit(rec.id)} className="flex-1 py-2 rounded-lg bg-slate-800 text-white text-xs font-black">💾 Сохранить</button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-2 rounded-lg bg-gray-100 text-slate-400 text-xs font-black">Отмена</button>
                    </div>
                  </div>
                )}
              </div>
            );
          });
        })()}
      </div>

      {/* Превью фото чека */}
      {previewPhoto && (
        <div className="fixed inset-0 z-[999] flex items-start justify-center bg-black/90 backdrop-blur-sm overflow-y-auto" onClick={() => setPreviewPhoto(null)}>
          <div className="py-8 px-4 min-h-screen flex items-center justify-center">
            <img src={previewPhoto} alt="Чек" className="max-w-full md:max-w-2xl rounded-2xl shadow-2xl" style={{ maxHeight: 'none' }} />
          </div>
          <button onClick={() => setPreviewPhoto(null)} className="fixed top-4 right-4 w-12 h-12 rounded-full bg-white/20 text-white flex items-center justify-center text-2xl hover:bg-white/30 transition-all">✕</button>
        </div>
      )}
    </div>
  );
}
