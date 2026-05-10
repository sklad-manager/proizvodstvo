'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  date: string;
  status: 'planned' | 'paid';
}

const CATEGORIES = [
  { id: 'materials', name: 'Сырье', icon: 'ni-box-2', color: 'bg-orange-500' },
  { id: 'maintenance', name: 'Ремонт и ТО', icon: 'ni-settings', color: 'bg-blue-500' },
  { id: 'salary', name: 'Зарплаты', icon: 'ni-badge', color: 'bg-emerald-500' },
  { id: 'rent', name: 'Аренда / ЖКУ', icon: 'ni-building', color: 'bg-indigo-500' },
  { id: 'small', name: 'Мелкие траты', icon: 'ni-cart', color: 'bg-rose-500' },
  { id: 'other', name: 'Прочее', icon: 'ni-tag', color: 'bg-slate-500' },
];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  
  // Состояния для формы
  const [showAddForm, setShowAddForm] = useState(false);
  const [newAmount, setNewAmount] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newCat, setNewCat] = useState('small');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);

  const loadData = async () => {
    try {
      const res = await fetch('/api/expenses');
      const data = await res.json();
      if (Array.isArray(data)) {
        setExpenses(data);
      }
    } catch (e) {
      console.error("Ошибка загрузки расходов", e);
    }
    setIsLoaded(true);
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000);
    return () => clearInterval(interval);
  }, []);

  const addExpense = async (status: 'planned' | 'paid' = 'planned') => {
    if (!newAmount || !newDesc) return;

    const expense = {
      id: Date.now().toString(),
      category: newCat,
      description: newDesc,
      amount: parseFloat(newAmount),
      date: newDate,
      status: status
    };

    try {
      await fetch('/api/expenses', {
        method: 'POST',
        body: JSON.stringify(expense)
      });
      setNewAmount('');
      setNewDesc('');
      setShowAddForm(false);
      loadData();
    } catch (e) {
      alert('Ошибка при сохранении');
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'planned' ? 'paid' : 'planned';
    try {
      await fetch('/api/expenses', {
        method: 'PATCH',
        body: JSON.stringify({ id, status: newStatus })
      });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const deleteExpense = async (id: string) => {
    if (!confirm('Удалить эту запись?')) return;
    try {
      await fetch(`/api/expenses?id=${id}`, { method: 'DELETE' });
      loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const stats = {
    totalPlanned: expenses.filter(e => e.status === 'planned').reduce((sum, e) => sum + e.amount, 0),
    totalPaid: expenses.filter(e => e.status === 'paid').reduce((sum, e) => sum + e.amount, 0)
  };

  if (!isLoaded) return <div className="p-10 text-center font-black text-slate-300 uppercase tracking-widest animate-pulse">Финансовый радар загружается...</div>;

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-full overflow-x-hidden">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-800 text-white hover:bg-black transition-all shadow-lg">
            <i className="ni ni-bold-left text-sm"></i>
          </Link>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Расходы</h2>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-emerald-500 tracking-widest">
              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              Облачная синхронизация
            </div>
          </div>
        </div>
        <button 
          onClick={() => setShowAddForm(!showAddForm)}
          className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-lg ${showAddForm ? 'bg-slate-100 text-slate-500' : 'bg-rose-500 text-white shadow-rose-200'}`}
        >
          {showAddForm ? 'Отмена' : '+ Добавить расход'}
        </button>
      </div>

      {/* Финансовая сводка */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50 flex items-center justify-between overflow-hidden relative group">
          <div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2">Запланировано</div>
            <div className="text-3xl font-black text-slate-800">{stats.totalPlanned.toLocaleString()} ₽</div>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-slate-50 flex items-center justify-center text-slate-300">
            <i className="ni ni-time-alarm text-2xl"></i>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-slate-200 w-full"></div>
        </div>
        <div className="bg-white p-8 rounded-[2.5rem] shadow-xl border border-gray-50 flex items-center justify-between overflow-hidden relative group">
          <div>
            <div className="text-[10px] font-black uppercase text-emerald-400 tracking-widest mb-2">Оплачено</div>
            <div className="text-3xl font-black text-emerald-500">{stats.totalPaid.toLocaleString()} ₽</div>
          </div>
          <div className="w-16 h-16 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-500">
            <i className="ni ni-check-bold text-2xl"></i>
          </div>
          <div className="absolute bottom-0 left-0 h-1 bg-emerald-500 w-full"></div>
        </div>
      </div>

      {/* Форма добавления */}
      {showAddForm && (
        <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl border-2 border-rose-100 animate-slide-up">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 px-2">Категория</label>
              <select 
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none outline-none font-bold text-sm text-slate-700"
                value={newCat}
                onChange={(e) => setNewCat(e.target.value)}
              >
                {CATEGORIES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 px-2">Что купили / Планируем</label>
              <input 
                type="text" 
                placeholder="Описание..." 
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none outline-none font-bold text-sm"
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 px-2">Сумма (₽)</label>
              <input 
                type="number" 
                placeholder="0" 
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none outline-none font-black text-sm text-rose-500"
                value={newAmount}
                onChange={(e) => setNewAmount(e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-2">
              <label className="text-[10px] font-black uppercase text-slate-400 px-2">Дата</label>
              <input 
                type="date" 
                className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none outline-none font-bold text-sm"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
              />
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <button onClick={() => addExpense('planned')} className="flex-1 py-4 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all">В план</button>
            <button onClick={() => addExpense('paid')} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-600 shadow-lg shadow-emerald-100 transition-all">Оплачено сейчас</button>
          </div>
        </div>
      )}

      {/* Список трат */}
      <div className="flex flex-col gap-4">
        <h3 className="text-sm font-black uppercase text-slate-400 tracking-[0.2em] px-4">История и планы</h3>
        {expenses.length === 0 && (
          <div className="py-20 text-center bg-white rounded-[3rem] border-2 border-dashed border-slate-100">
             <div className="text-slate-200 text-6xl mb-4"><i className="ni ni-money-coins"></i></div>
             <p className="font-black uppercase text-xs text-slate-300 tracking-widest">Трат пока нет. Самое время что-нибудь запланировать!</p>
          </div>
        )}
        {expenses.map((exp) => {
          const category = CATEGORIES.find(c => c.id === exp.category) || CATEGORIES[5];
          return (
            <div 
              key={exp.id} 
              className={`bg-white p-5 md:p-6 rounded-3xl shadow-sm border-l-8 transition-all hover:shadow-md flex items-center justify-between gap-4
                ${exp.status === 'paid' ? 'border-emerald-500' : 'border-slate-200'}
              `}
            >
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-md ${category.color}`}>
                  <i className={`ni ${category.icon} text-xl`}></i>
                </div>
                <div>
                  <div className="font-black text-slate-800 text-sm md:text-base leading-tight">{exp.description}</div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-tighter">{category.name}</span>
                    <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                    <span className="text-[10px] font-bold text-slate-400">{new Date(exp.date).toLocaleDateString('ru-RU')}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-4 md:gap-8">
                <div className="text-right">
                  <div className={`text-base md:text-xl font-black ${exp.status === 'paid' ? 'text-emerald-500' : 'text-slate-800'}`}>
                    {exp.amount.toLocaleString()} ₽
                  </div>
                  <button 
                    onClick={() => toggleStatus(exp.id, exp.status)}
                    className={`text-[9px] font-black uppercase tracking-widest mt-1 underline decoration-2 underline-offset-4 ${exp.status === 'paid' ? 'text-emerald-400' : 'text-rose-400'}`}
                  >
                    {exp.status === 'paid' ? 'Оплачено' : 'Нужно оплатить'}
                  </button>
                </div>
                <button onClick={() => deleteExpense(exp.id)} className="w-10 h-10 rounded-xl bg-gray-50 text-slate-200 hover:text-red-500 transition-colors">
                  <i className="ni ni-fat-remove text-xl"></i>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <style jsx>{`
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
