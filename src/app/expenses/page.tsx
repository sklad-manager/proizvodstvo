'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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

  // Форма
  const [showForm, setShowForm] = useState(false);
  const [formType, setFormType] = useState<'expense' | 'income'>('expense');
  const [newAmount, setNewAmount] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('small');
  const [newPay, setNewPay] = useState('Ф1');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  // Фильтры
  const [filterType, setFilterType] = useState<'all' | 'expense' | 'income'>('all');
  const [filterPay, setFilterPay] = useState('all');

  const loadData = async () => {
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      if (Array.isArray(data)) setRecords(data);
    } catch (e) { console.error(e); }
    setIsLoaded(true);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, []);

  const addRecord = async () => {
    if (!newAmount || !newDesc) return;
    const record = {
      id: Date.now().toString(),
      category: newCat,
      description: newDesc,
      amount: parseFloat(newAmount),
      date: newDate,
      status: 'paid',
      paymentMethod: newPay,
      type: formType,
      isConfirmed: true
    };
    await fetch('/api/expenses', { method: 'POST', body: JSON.stringify(record) });
    setNewAmount(''); setNewDesc(''); setShowForm(false);
    loadData();
  };

  const confirmRecord = async (id: string) => {
    await fetch('/api/expenses', { method: 'PATCH', body: JSON.stringify({ id, isConfirmed: true }) });
    loadData();
  };

  const deleteRecord = async (id: string) => {
    if (!confirm('Удалить запись?')) return;
    await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
    loadData();
  };

  // Данные
  const confirmed = records.filter(r => r.is_confirmed);
  const pending = records.filter(r => !r.is_confirmed);

  const filtered = confirmed.filter(r => {
    if (filterType !== 'all' && r.type !== filterType) return false;
    if (filterPay !== 'all' && r.payment_method !== filterPay) return false;
    return true;
  });

  const totalIncome = confirmed.filter(r => r.type === 'income').reduce((s, r) => s + r.amount, 0);
  const totalExpense = confirmed.filter(r => r.type === 'expense').reduce((s, r) => s + r.amount, 0);
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
        <div className="flex gap-2 items-center">
          <Link href="/ai-assistant" className="w-12 h-12 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition-all shadow-sm shrink-0">
            <i className="ni ni-bulb-61 text-lg"></i>
          </Link>
          <button onClick={() => setShowForm(!showForm)}
            className={`px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg ${showForm ? 'bg-slate-100 text-slate-500' : 'bg-rose-500 text-white shadow-rose-200'}`}>
            {showForm ? 'Отмена' : '+ Запись'}
          </button>
        </div>
      </div>

      {/* Финансовый пульс */}
      <div className="grid grid-cols-3 gap-3 md:gap-6">
        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-xl border border-gray-50 relative overflow-hidden">
          <div className="text-[9px] md:text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-1 md:mb-2">Доходы</div>
          <div className="text-xl md:text-3xl font-black text-emerald-500">+{totalIncome.toLocaleString()}</div>
          <div className="text-[10px] md:text-xs font-bold text-slate-300 mt-1">грн</div>
          <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 w-full"></div>
        </div>
        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-xl border border-gray-50 relative overflow-hidden">
          <div className="text-[9px] md:text-[10px] font-black uppercase text-rose-400 tracking-widest mb-1 md:mb-2">Расходы</div>
          <div className="text-xl md:text-3xl font-black text-rose-500">-{totalExpense.toLocaleString()}</div>
          <div className="text-[10px] md:text-xs font-bold text-slate-300 mt-1">грн</div>
          <div className="absolute bottom-0 left-0 h-1 bg-rose-500 w-full"></div>
        </div>
        <div className="bg-white p-5 md:p-8 rounded-[2rem] shadow-xl border border-gray-50 relative overflow-hidden">
          <div className="text-[9px] md:text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1 md:mb-2">Баланс</div>
          <div className={`text-xl md:text-3xl font-black ${balance >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
            {balance >= 0 ? '+' : ''}{balance.toLocaleString()}
          </div>
          <div className="text-[10px] md:text-xs font-bold text-slate-300 mt-1">грн</div>
          <div className={`absolute bottom-0 left-0 h-1 w-full ${balance >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></div>
        </div>
      </div>

      {/* Ожидают подтверждения */}
      {pending.length > 0 && (
        <div className="bg-amber-50 p-6 rounded-[2rem] border-2 border-amber-200">
          <h3 className="text-xs font-black uppercase text-amber-600 tracking-widest mb-4 flex items-center gap-2">
            <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse"></span>
            Ожидают подтверждения ({pending.length})
          </h3>
          <div className="flex flex-col gap-3">
            {pending.map(rec => {
              const cat = CATEGORIES[rec.category] || CATEGORIES.other;
              return (
                <div key={rec.id} className="bg-white p-4 rounded-2xl border border-amber-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white text-sm ${cat.color}`}>
                      {rec.type === 'income' ? '💰' : '📉'}
                    </div>
                    <div>
                      <div className="font-black text-sm text-slate-800">{rec.description}</div>
                      <div className="text-[10px] text-slate-400 font-bold">{cat.name} · {rec.payment_method} · {new Date(rec.date).toLocaleDateString('ru-RU')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-base font-black ${rec.type === 'income' ? 'text-emerald-500' : 'text-rose-500'}`}>
                      {rec.type === 'income' ? '+' : '-'}{rec.amount.toLocaleString()} грн
                    </span>
                    <button onClick={() => confirmRecord(rec.id)} className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center hover:bg-emerald-600 text-sm">✓</button>
                    <button onClick={() => deleteRecord(rec.id)} className="w-9 h-9 rounded-xl bg-red-50 text-red-400 flex items-center justify-center hover:bg-red-100 text-sm">✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Форма добавления */}
      {showForm && (
        <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-2xl border-2 border-slate-100">
          <div className="flex gap-2 mb-6">
            <button onClick={() => setFormType('expense')}
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${formType === 'expense' ? 'bg-rose-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
              Расход
            </button>
            <button onClick={() => setFormType('income')}
              className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${formType === 'income' ? 'bg-emerald-500 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
              Доход
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 px-2">Описание</label>
              <input type="text" placeholder="Что..." className="w-full px-4 py-3 rounded-xl bg-slate-50 outline-none font-bold text-sm" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <label className="text-[10px] font-black uppercase text-slate-400 px-2">Сумма (грн)</label>
                <input type="number" placeholder="0" className="w-full px-4 py-3 rounded-xl bg-slate-50 outline-none font-black text-sm text-rose-500" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} />
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
                  <button key={m} onClick={() => setNewPay(m)}
                    className={`flex-1 py-3 rounded-xl font-black text-xs transition-all ${newPay === m ? 'bg-slate-800 text-white shadow-md' : 'bg-slate-50 text-slate-400'}`}>
                    {m}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <button onClick={addRecord} className="w-full mt-6 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all">
            Записать
          </button>
        </div>
      )}

      {/* Фильтры */}
      <div className="flex flex-wrap gap-2 px-1">
        {[{ key: 'all', label: 'Все' }, { key: 'income', label: '💰 Доходы' }, { key: 'expense', label: '📉 Расходы' }].map(f => (
          <button key={f.key} onClick={() => setFilterType(f.key as any)}
            className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${filterType === f.key ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border border-gray-100'}`}>
            {f.label}
          </button>
        ))}
        <div className="w-px bg-gray-100 mx-1"></div>
        <button onClick={() => setFilterPay('all')} className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${filterPay === 'all' ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border border-gray-100'}`}>Все</button>
        {PAY_METHODS.map(m => (
          <button key={m} onClick={() => setFilterPay(m)}
            className={`px-3 py-2 rounded-xl text-xs font-black transition-all ${filterPay === m ? 'bg-slate-800 text-white' : 'bg-white text-slate-400 border border-gray-100'}`}>
            {m}
          </button>
        ))}
      </div>

      {/* Таблица операций */}
      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-black uppercase text-slate-400 tracking-[0.15em] px-2">Операции ({filtered.length})</h3>
        {filtered.length === 0 && (
          <div className="py-16 text-center bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100">
            <p className="font-black uppercase text-xs text-slate-300 tracking-widest">Нет записей</p>
          </div>
        )}
        {filtered.map(rec => {
          const cat = CATEGORIES[rec.category] || CATEGORIES.other;
          const isIncome = rec.type === 'income';
          return (
            <div key={rec.id} className={`bg-white p-4 md:p-5 rounded-2xl shadow-sm border-l-[6px] transition-all hover:shadow-md flex items-center justify-between gap-3 ${isIncome ? 'border-emerald-500' : 'border-rose-400'}`}>
              <div className="flex items-center gap-3 md:gap-4 min-w-0">
                <div className={`w-10 h-10 md:w-11 md:h-11 rounded-xl flex items-center justify-center text-white text-sm shrink-0 ${cat.color}`}>
                  {isIncome ? '💰' : '📉'}
                </div>
                <div className="min-w-0">
                  <div className="font-black text-slate-800 text-sm leading-tight truncate">{rec.description}</div>
                  <div className="flex flex-wrap items-center gap-1.5 mt-1">
                    <span className="px-1.5 py-0.5 bg-slate-100 rounded text-[9px] font-black text-slate-600">{rec.payment_method || 'Ф1'}</span>
                    <span className="text-[10px] font-bold text-slate-400">{cat.name}</span>
                    <span className="text-[10px] text-slate-300">{new Date(rec.date).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className={`text-base md:text-lg font-black ${isIncome ? 'text-emerald-500' : 'text-rose-500'}`}>
                  {isIncome ? '+' : '-'}{rec.amount.toLocaleString()} <span className="text-[10px]">грн</span>
                </span>
                <button onClick={() => deleteRecord(rec.id)} className="w-8 h-8 rounded-lg bg-gray-50 text-slate-200 hover:text-red-500 transition-colors flex items-center justify-center">✕</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
