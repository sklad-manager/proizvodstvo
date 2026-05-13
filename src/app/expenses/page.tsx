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
  review_status?: 'none' | 'approved' | 'issue';
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

export default function ExpensesPage() {
  const [records, setRecords] = useState<FinRecord[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');
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

  const setReviewStatus = async (id: string, status: 'approved' | 'issue' | 'none') => {
    await fetch('/api/expenses', { method: 'PATCH', body: JSON.stringify({ id, review_status: status }) });
    loadData();
  };

  const changeMonth = (delta: number) => {
    let m = calMonth + delta, y = calYear;
    if (m < 0) { m = 11; y--; } else if (m > 11) { m = 0; y++; }
    setCalMonth(m); setCalYear(y); setSelectedDate(null);
  };

  // Суммы по дням для календаря
  const dayTotals = useMemo(() => {
    const map: Record<string, { expense: number; income: number; reviewStatus?: 'approved' | 'issue' | 'none' }> = {};
    const conf = records.filter(r => r.is_confirmed);
    conf.forEach(r => {
      const d = r.date?.split('T')[0];
      if (!d) return;
      if (!map[d]) map[d] = { expense: 0, income: 0, reviewStatus: 'none' };
      if (r.type === 'income') map[d].income += r.amount;
      else map[d].expense += r.amount;
    });

    Object.keys(map).forEach(d => {
      const dayRecords = conf.filter(r => r.date?.split('T')[0] === d);
      if (dayRecords.some(r => r.review_status === 'issue')) {
        map[d].reviewStatus = 'issue';
      } else if (dayRecords.length > 0 && dayRecords.every(r => r.review_status === 'approved')) {
        map[d].reviewStatus = 'approved';
      }
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
    const d = r.date?.split('T')[0];
    if (filterStartDate && d < filterStartDate) return false;
    if (filterEndDate && d > filterEndDate) return false;
    if (!filterStartDate && !filterEndDate && selectedDate && d !== selectedDate) return false;
    return true;
  });

  // Итоги — по выбранной дате или интервалу
  const scopeRecords = (!filterStartDate && !filterEndDate && selectedDate) ? confirmed.filter(r => r.date?.split('T')[0] === selectedDate) : filtered;
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
        </div>
      </div>

      {/* Календарь */}
      <FinanceCalendar
        year={calYear} month={calMonth}
        selectedDate={selectedDate}
        dayTotals={dayTotals}
        onSelectDate={(d) => { setSelectedDate(d); setFilterStartDate(''); setFilterEndDate(''); }}
        onChangeMonth={changeMonth}
      />

      {/* Финансовый пульс */}
      {(selectedDate || filterStartDate || filterEndDate) && (
        <div className="px-3 py-2 bg-slate-800 text-white rounded-2xl text-center text-[10px] md:text-xs font-black uppercase tracking-widest">
          📅 {selectedDate 
                ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', weekday: 'short' }) 
                : `${filterStartDate ? new Date(filterStartDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '...'} — ${filterEndDate ? new Date(filterEndDate + 'T12:00:00').toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }) : '...'}`
             }
        </div>
      )}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-xl border border-gray-50 relative overflow-hidden">
          <div className="text-[9px] md:text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-1 md:mb-2">{(selectedDate || filterStartDate || filterEndDate) ? 'Приход' : 'Доходы'}</div>
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


      {/* Фильтры */}
      <div className="flex flex-wrap items-center gap-2 px-1">
        <div className="flex gap-2 mr-2">
          {[{ key: 'all', label: 'Все' }, { key: 'income', label: '💰 Доходы' }, { key: 'expense', label: '📉 Расходы' }].map(f => (
            <button key={f.key} onClick={() => setFilterType(f.key as any)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${filterType === f.key ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border border-gray-100'}`}>{f.label}</button>
          ))}
        </div>
        <div className="hidden md:block w-px h-6 bg-gray-200"></div>
        <div className="flex items-center gap-2 bg-white rounded-xl border border-gray-100 p-1">
          <input type="date" value={filterStartDate} onChange={e => { setFilterStartDate(e.target.value); setSelectedDate(null); }} className="px-2 py-1 bg-transparent text-xs font-bold text-slate-600 outline-none w-[110px]" />
          <span className="text-slate-300 text-xs font-black">—</span>
          <input type="date" value={filterEndDate} onChange={e => { setFilterEndDate(e.target.value); setSelectedDate(null); }} className="px-2 py-1 bg-transparent text-xs font-bold text-slate-600 outline-none w-[110px]" />
          {(filterStartDate || filterEndDate) && (
            <button onClick={() => { setFilterStartDate(''); setFilterEndDate(''); }} className="px-2 py-1 text-xs text-rose-400 font-black hover:bg-rose-50 rounded-lg transition-all">✕</button>
          )}
        </div>
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
              const revStatus = group.items[0].review_status;
              const bgClass = revStatus === 'approved' ? 'bg-emerald-50/50 border-emerald-400' : revStatus === 'issue' ? 'bg-rose-50/50 border-rose-500' : 'bg-white border-rose-400';
              return (
                <div key={gi} className={`${bgClass} rounded-2xl shadow-sm border-l-[6px] overflow-hidden transition-all`}>
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
                          {new Date(group.items[0].date).toLocaleDateString('ru-RU')}
                          {group.items[0]?.comment && <span className="ml-1 text-slate-500">· {group.items[0].comment}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center shrink-0">
                      <div className="w-[70px] md:w-[100px] text-right shrink-0 mr-2 md:mr-4">
                        <span className="text-sm md:text-lg font-black text-rose-500">-{total.toLocaleString()} <span className="text-[9px]">грн</span></span>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); setReviewStatus(group.items[0].id, group.items[0].review_status === 'approved' ? 'none' : 'approved'); }} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all ${group.items[0].review_status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-400 hover:bg-emerald-100 active:bg-emerald-200'}`}>✅</button>
                        <button onClick={(e) => { e.stopPropagation(); setReviewStatus(group.items[0].id, group.items[0].review_status === 'issue' ? 'none' : 'issue'); }} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all ${group.items[0].review_status === 'issue' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-400 hover:bg-rose-100 active:bg-rose-200'}`}>❓</button>
                        <button onClick={(e) => { e.stopPropagation(); editingId === group.receiptId ? setEditingId(null) : startEditing({...group.items[0], id: group.receiptId!}); }} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all ${editingId === group.receiptId ? 'bg-slate-800 text-white' : 'bg-blue-50 text-blue-400 active:bg-blue-100'}`}>✏️</button>
                        <button onClick={(e) => { e.stopPropagation(); deleteReceipt(group.receiptId!); }} className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all bg-rose-50 text-rose-400 hover:bg-rose-100 active:bg-rose-200">❌</button>
                      </div>
                      <div className="w-6 md:w-8 flex justify-center shrink-0 ml-1 md:ml-2">
                        <span className={`text-slate-300 text-lg transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
                      </div>
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
                                    <div className="text-[9px] text-slate-300">{new Date(rec.date).toLocaleDateString('ru-RU')}</div>
                                  </div>
                                  {rec.comment && !isEditing && (
                                    <div className="text-[9px] text-slate-400 mt-0.5 italic">💬 {rec.comment}</div>
                                  )}
                                </div>
                              </div>
                              <div className="flex items-center shrink-0">
                                <div className="w-[70px] md:w-[100px] text-right shrink-0 mr-2 md:mr-4">
                                  <span className="text-sm md:text-base font-black text-rose-400">-{rec.amount.toLocaleString()}</span>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <div className="w-7 h-7 md:w-8 md:h-8"></div>
                                  <div className="w-7 h-7 md:w-8 md:h-8"></div>
                                  <button onClick={() => isEditing ? setEditingId(null) : startEditing(rec)} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all ${isEditing ? 'bg-slate-800 text-white' : 'bg-blue-50 text-blue-400 active:bg-blue-100'}`}>✏️</button>
                                  <button onClick={() => deleteRecord(rec.id)} className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all bg-rose-50 text-rose-400 hover:bg-rose-100 active:bg-rose-200">❌</button>
                                </div>
                                <div className="w-6 md:w-8 shrink-0 ml-1 md:ml-2"></div>
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
            const revStatus = rec.review_status;
            let bgClass = 'bg-white border-rose-400';
            if (revStatus === 'approved') bgClass = 'bg-emerald-50/50 border-emerald-400';
            else if (revStatus === 'issue') bgClass = 'bg-rose-50/50 border-rose-500';
            else if (isIncome) bgClass = 'bg-white border-emerald-500';

            return (
              <div key={rec.id} className={`${bgClass} rounded-2xl shadow-sm border-l-[6px] transition-all hover:shadow-md overflow-hidden`}>
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
                        <span className="text-[10px] text-slate-300">{new Date(rec.date).toLocaleDateString('ru-RU')}</span>
                      </div>
                      {rec.comment && !isEditing && (
                        <div className="text-[10px] text-slate-400 mt-1 italic">💬 {rec.comment}</div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center shrink-0">
                    <div className="w-[70px] md:w-[100px] text-right shrink-0 mr-2 md:mr-4">
                      <span className={`text-sm md:text-lg font-black ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {isIncome ? '+' : '-'}{rec.amount.toLocaleString()} <span className="text-[9px]">грн</span>
                      </span>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => setReviewStatus(rec.id, rec.review_status === 'approved' ? 'none' : 'approved')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all ${rec.review_status === 'approved' ? 'bg-emerald-500 text-white' : 'bg-emerald-50 text-emerald-400 hover:bg-emerald-100 active:bg-emerald-200'}`}>✅</button>
                      <button onClick={() => setReviewStatus(rec.id, rec.review_status === 'issue' ? 'none' : 'issue')} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all ${rec.review_status === 'issue' ? 'bg-rose-500 text-white' : 'bg-rose-50 text-rose-400 hover:bg-rose-100 active:bg-rose-200'}`}>❓</button>
                      <button onClick={() => isEditing ? setEditingId(null) : startEditing(rec)} className={`w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all ${isEditing ? 'bg-slate-800 text-white' : 'bg-blue-50 text-blue-400 active:bg-blue-100'}`}>✏️</button>
                      <button onClick={() => deleteRecord(rec.id)} className="w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center text-xs transition-all bg-rose-50 text-rose-400 hover:bg-rose-100 active:bg-rose-200">❌</button>
                    </div>
                    <div className="w-6 md:w-8 shrink-0 ml-1 md:ml-2"></div>
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
