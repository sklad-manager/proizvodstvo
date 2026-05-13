'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/components/AuthProvider';

interface Bale {
  id: string;
  number: string;
  weight: number;
  originalWeight: number | null;
  receivedDate: string;
  isConsumed: boolean;
  consumedDate?: string;
  status: 'warehouse' | 'working' | 'finished';
  comment: string;
}

interface Category {
  id: string;
  name: string;
  bales: Bale[];
}

const STATUS_OPTIONS = [
  { value: 'warehouse', label: 'На складе', emoji: '📦', color: 'bg-blue-500', light: 'bg-blue-50 text-blue-600 border-blue-200' },
  { value: 'working', label: 'В работе', emoji: '⚙️', color: 'bg-orange-500', light: 'bg-orange-50 text-orange-600 border-orange-200' },
  { value: 'returned', label: 'Вернули на склад', emoji: '↩️', color: 'bg-teal-500', light: 'bg-teal-50 text-teal-600 border-teal-200' },
  { value: 'finished', label: 'Закончился', emoji: '✅', color: 'bg-slate-400', light: 'bg-slate-50 text-slate-500 border-slate-200' },
];

export default function RawMaterialsPage() {
  const { role } = useAuth();
  const isAdmin = role === 'admin';
  const canEditOrDelete = isAdmin;

  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCloudMode, setIsCloudMode] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [openedCategoryId, setOpenedCategoryId] = useState<string | null>(null);
  const [newBaleNumber, setNewBaleNumber] = useState('');
  const [newBaleWeight, setNewBaleWeight] = useState('');
  const [editingComment, setEditingComment] = useState<string | null>(null);
  const [commentText, setCommentText] = useState('');
  const [returnWeightBaleId, setReturnWeightBaleId] = useState<string | null>(null);
  const [returnWeight, setReturnWeight] = useState('');
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const loadData = async () => {
    const cloudSynced = localStorage.getItem('proizvodstvo_is_synced') === 'true';
    setIsCloudMode(cloudSynced);
    if (cloudSynced) {
      try {
        const res = await fetch('/api/raw-materials');
        const data = await res.json();
        if (Array.isArray(data)) setCategories(data);
      } catch (e) { console.error(e); }
    } else {
      const saved = localStorage.getItem('proizvodstvo_raw_materials');
      if (saved) { try { setCategories(JSON.parse(saved)); } catch (e) { console.error(e); } }
      else { setCategories([{ id: 'cat1', name: 'Вискоза 1.7 dtex', bales: [] }]); }
    }
    setIsLoaded(true);
  };

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
    loadData();
    const interval = setInterval(() => {
      if (localStorage.getItem('proizvodstvo_is_synced') === 'true') loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (isLoaded && !isCloudMode) localStorage.setItem('proizvodstvo_raw_materials', JSON.stringify(categories));
  }, [categories, isLoaded, isCloudMode]);

  const addCategory = async () => {
    if (!newCategoryName.trim()) return;
    const newCat = { id: Date.now().toString(), name: newCategoryName, bales: [] };
    if (isCloudMode) {
      await fetch('/api/raw-materials', { method: 'POST', body: JSON.stringify({ type: 'category', ...newCat }) });
      loadData();
    } else { setCategories([...categories, newCat]); }
    setNewCategoryName('');
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Удалить эту папку и всё сырье в ней?')) return;
    if (isCloudMode) {
      await fetch(`/api/raw-materials?type=category&id=${id}`, { method: 'DELETE' });
      loadData();
    } else { setCategories(categories.filter(c => c.id !== id)); }
    if (openedCategoryId === id) setOpenedCategoryId(null);
  };

  const addBale = async (catId: string) => {
    if (!newBaleWeight) return;
    const w = parseFloat(newBaleWeight);
    const newBale = {
      id: Date.now().toString(),
      number: newBaleNumber || ((categories.find(c => c.id === catId)?.bales.length || 0) + 1).toString(),
      weight: w,
      receivedDate: selectedDate,
      category_id: catId
    };
    if (isCloudMode) {
      await fetch('/api/raw-materials', { method: 'POST', body: JSON.stringify({ type: 'bale', ...newBale }) });
      loadData();
    } else {
      setCategories(categories.map(cat => cat.id === catId ? {
        ...cat, bales: [{ ...newBale, isConsumed: false, status: 'warehouse' as const, comment: '', originalWeight: w }, ...cat.bales]
      } : cat));
    }
    setNewBaleNumber(''); setNewBaleWeight('');
  };

  const changeStatus = async (catId: string, baleId: string, newStatus: string) => {
    setOpenDropdown(null);
    const cat = categories.find(c => c.id === catId);
    if (!cat) return;

    // Если ставим "В работе" — проверяем, нет ли другого в работе
    if (newStatus === 'working') {
      const currentWorking = cat.bales.find(b => b.status === 'working' && b.id !== baleId);
      if (currentWorking) {
        const shouldFinish = confirm(`Тюк №${currentWorking.number} сейчас "В работе".\nПеревести его в "Закончился"?`);
        if (shouldFinish) {
          if (isCloudMode) {
            await fetch('/api/raw-materials', { method: 'PATCH', body: JSON.stringify({ id: currentWorking.id, status: 'finished' }) });
          } else {
            setCategories(prev => prev.map(c => c.id === catId ? {
              ...c, bales: c.bales.map(b => b.id === currentWorking.id ? { ...b, status: 'finished' as const, isConsumed: true } : b)
            } : c));
          }
        }
      }
    }

    // Если "Вернули на склад" — показываем поле ввода веса
    if (newStatus === 'returned') {
      const bale = cat.bales.find(b => b.id === baleId);
      setReturnWeightBaleId(baleId);
      setReturnWeight(bale?.weight?.toString() || '');
      return;
    }

    if (isCloudMode) {
      await fetch('/api/raw-materials', { method: 'PATCH', body: JSON.stringify({ id: baleId, status: newStatus }) });
      loadData();
    } else {
      const consumedDate = new Date().toISOString().split('T')[0];
      setCategories(categories.map(c => c.id === catId ? {
        ...c, bales: c.bales.map(b => b.id === baleId ? {
          ...b, status: newStatus as any,
          ...(newStatus === 'finished' ? { isConsumed: true, consumedDate } : {})
        } : b)
      } : c));
    }
  };

  const confirmReturn = async (catId: string, baleId: string) => {
    const newW = parseFloat(returnWeight);
    if (isNaN(newW) || newW <= 0) { alert('Введите корректный вес'); return; }

    if (isCloudMode) {
      await fetch('/api/raw-materials', { method: 'PATCH', body: JSON.stringify({ id: baleId, status: 'returned', newWeight: newW }) });
      loadData();
    } else {
      setCategories(categories.map(c => c.id === catId ? {
        ...c, bales: c.bales.map(b => b.id === baleId ? {
          ...b, originalWeight: b.originalWeight || b.weight, weight: newW, status: 'warehouse' as const, isConsumed: false
        } : b)
      } : c));
    }
    setReturnWeightBaleId(null); setReturnWeight('');
  };

  const saveComment = async (baleId: string) => {
    if (isCloudMode) {
      await fetch('/api/raw-materials', { method: 'PATCH', body: JSON.stringify({ id: baleId, comment: commentText }) });
      loadData();
    } else {
      setCategories(categories.map(c => ({ ...c, bales: c.bales.map(b => b.id === baleId ? { ...b, comment: commentText } : b) })));
    }
    setEditingComment(null); setCommentText('');
  };

  const deleteBale = async (catId: string, baleId: string) => {
    if (!confirm('Удалить этот тюк из базы?')) return;
    if (isCloudMode) {
      await fetch(`/api/raw-materials?type=bale&id=${baleId}`, { method: 'DELETE' });
      loadData();
    } else {
      setCategories(categories.map(c => c.id === catId ? { ...c, bales: c.bales.filter(b => b.id !== baleId) } : c));
    }
  };

  const getStats = (bales: Bale[]) => {
    const active = bales.filter(b => b.status !== 'finished');
    const totalWeight = active.reduce((sum, b) => sum + b.weight, 0);
    const working = bales.find(b => b.status === 'working');
    return { count: active.length, weight: totalWeight.toFixed(1), working };
  };

  if (!isLoaded) return <div className="p-10 text-center font-bold text-slate-400 uppercase tracking-widest">Загрузка данных...</div>;

  return (
    <div className="flex flex-col gap-4 md:gap-6 pb-20 max-w-full overflow-x-hidden">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/" className="flex items-center justify-center w-12 h-12 md:w-10 md:h-10 rounded-2xl bg-slate-800 text-white md:bg-gray-50 md:text-slate-600 hover:bg-black md:hover:bg-gray-100 transition-all shadow-lg md:shadow-none">
            <i className="ni ni-bold-left text-sm md:text-xs"></i>
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Учет сырья</h2>
              {isCloudMode && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[8px] font-black uppercase rounded-md tracking-tighter animate-pulse">Cloud</span>}
            </div>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Дата: <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-50 px-2 py-0.5 rounded-lg border-none outline-none text-slate-600 font-bold" />
            </div>
          </div>
        </div>
        {canEditOrDelete && (
          <div className="flex gap-2 w-full md:w-auto items-center">
            <Link href="/ai-assistant" className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center hover:bg-purple-100 transition-all shadow-sm shrink-0">
              <i className="ni ni-bulb-61"></i>
            </Link>
            <input type="text" placeholder="Название папки..." className="flex-1 md:flex-none px-4 py-2.5 rounded-xl border border-gray-200 focus:border-orange-400 outline-none text-sm min-w-0"
              value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addCategory(); }} />
            <button onClick={addCategory} className="px-5 py-2.5 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-black transition-all active:scale-95">+</button>
          </div>
        )}
      </div>

      {/* Список папок */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {categories.map((cat) => {
          const stats = getStats(cat.bales);
          return (
            <div key={cat.id} className={`group relative bg-white rounded-[2rem] shadow-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden
              ${openedCategoryId === cat.id ? 'border-orange-500 ring-4 ring-orange-50' : 'border-transparent hover:border-orange-100'}`}
              onClick={() => setOpenedCategoryId(cat.id)}>
              <div className="p-6 md:p-8">
                <div className="flex items-start justify-between mb-4 md:mb-6">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-yellow-500 flex items-center justify-center text-white shadow-lg">
                    <i className="ni ni-folder-17 text-xl md:text-2xl"></i>
                  </div>
                  {canEditOrDelete && (
                    <button onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }} className="text-slate-300 hover:text-red-500 transition-colors">
                      <i className="ni ni-fat-remove text-xl"></i>
                    </button>
                  )}
                </div>
                <h3 className="text-lg md:text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{cat.name}</h3>
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl md:text-3xl font-black text-orange-500">{stats.count}</span>
                  <span className="text-xs font-bold text-slate-400 uppercase">тюков · {stats.weight} кг</span>
                </div>
                {stats.working && (
                  <div className="mt-2 px-3 py-1.5 bg-orange-50 rounded-lg text-[10px] font-black text-orange-500 uppercase">
                    ⚙️ В работе: №{stats.working.number}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Модальное окно */}
      {openedCategoryId && (
        <div className="fixed inset-0 z-[999] flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in" onClick={() => { setOpenedCategoryId(null); setOpenDropdown(null); }}>
          <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[92vh] md:h-[90vh] overflow-hidden flex flex-col animate-slide-up" onClick={(e) => e.stopPropagation()}>
            {categories.filter(c => c.id === openedCategoryId).map(cat => {
              const stats = getStats(cat.bales);
              const sortedBales = [...cat.bales].sort((a, b) => {
                const order: Record<string, number> = { working: 0, warehouse: 1, finished: 2 };
                return (order[a.status] ?? 1) - (order[b.status] ?? 1);
              });

              return (
                <React.Fragment key={cat.id}>
                  {/* Шапка */}
                  <div className="p-5 md:p-8 bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-3 md:gap-4">
                      <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-orange-400">
                        <i className="ni ni-folder-17 text-2xl"></i>
                      </div>
                      <div>
                        <h2 className="text-lg md:text-2xl font-black mb-0 uppercase tracking-tight">{cat.name}</h2>
                        <div className="text-[10px] font-black uppercase opacity-50">В наличии: {stats.count} · {stats.weight} кг</div>
                      </div>
                    </div>
                    <button onClick={() => { setOpenedCategoryId(null); setOpenDropdown(null); }} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
                      <i className="ni ni-fat-remove text-xl"></i>
                    </button>
                  </div>

                  {/* Форма добавления */}
                  {canEditOrDelete && (
                    <div className="flex flex-wrap md:flex-nowrap items-end gap-2 px-4 md:px-6 py-4 bg-slate-50/50 border-b border-gray-100">
                      <div className="flex-1 min-w-[100px]">
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">№ Тюка</label>
                        <input type="text" placeholder="№" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-orange-400 text-sm" value={newBaleNumber} onChange={(e) => setNewBaleNumber(e.target.value)} />
                      </div>
                      <div className="flex-1 min-w-[70px]">
                        <label className="text-[9px] font-black text-slate-400 uppercase block mb-1">Вес (кг)</label>
                        <input type="number" placeholder="Вес" className="w-full px-3 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-orange-400 text-sm" value={newBaleWeight} onChange={(e) => setNewBaleWeight(e.target.value)} />
                      </div>
                      <button onClick={() => addBale(cat.id)} className="h-[42px] px-6 rounded-xl bg-orange-500 text-white font-black uppercase text-xs hover:bg-orange-600 shadow-lg w-full md:w-auto transition-all active:scale-95">Принять</button>
                    </div>
                  )}

                  {/* Список тюков */}
                  <div className="flex-1 overflow-y-auto" onClick={() => setOpenDropdown(null)}>
                    {sortedBales.map((bale) => {
                      const currentStatus = STATUS_OPTIONS.find(s => s.value === bale.status) || STATUS_OPTIONS[0];
                      const isDropdownOpen = openDropdown === bale.id;
                      const isEditingComment = editingComment === bale.id;
                      const isReturning = returnWeightBaleId === bale.id;
                      const weightChanged = bale.originalWeight && bale.originalWeight !== bale.weight;

                      return (
                        <div key={bale.id} className={`border-b border-gray-50 transition-all ${bale.status === 'finished' ? 'opacity-35 bg-gray-50/50' : ''}`}>
                          <div className="flex items-center gap-2 md:gap-3 p-3 md:px-6 md:py-4">
                            {/* Номер */}
                            <div className={`w-9 h-9 md:w-10 md:h-10 rounded-xl flex items-center justify-center text-white font-black text-sm shrink-0 ${currentStatus.color}`}>
                              {bale.number}
                            </div>

                            {/* Вес + дата */}
                            <div className="flex-1 min-w-0">
                              <div className="font-black text-slate-800 text-sm flex items-center gap-1.5 flex-wrap">
                                {bale.weight} <span className="text-[10px] text-slate-400">кг</span>
                                {weightChanged && (
                                  <span className="text-[9px] text-teal-500 font-bold bg-teal-50 px-1.5 py-0.5 rounded">
                                    было {bale.originalWeight} кг
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-300 font-bold">{new Date(bale.receivedDate).toLocaleDateString('ru-RU')}</div>
                            </div>

                            {/* Выпадающий статус */}
                            <div className="relative shrink-0" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => canEditOrDelete && setOpenDropdown(isDropdownOpen ? null : bale.id)}
                                className={`px-3 py-1.5 md:px-4 md:py-2 rounded-xl border text-[9px] md:text-[10px] font-black uppercase transition-all flex items-center gap-1.5 ${currentStatus.light} ${!canEditOrDelete ? 'cursor-default' : ''}`}
                              >
                                <span>{currentStatus.emoji}</span>
                                <span className="hidden md:inline">{currentStatus.label}</span>
                                {canEditOrDelete && <span className="text-[8px] opacity-50">▼</span>}
                              </button>

                              {isDropdownOpen && bale.status !== 'finished' && canEditOrDelete && (
                                <div className="absolute right-0 top-full mt-1 bg-white rounded-xl shadow-2xl border border-gray-100 z-50 min-w-[180px] py-1 overflow-hidden">
                                  {STATUS_OPTIONS.filter(s => s.value !== bale.status).map(opt => (
                                    <button
                                      key={opt.value}
                                      onClick={() => changeStatus(cat.id, bale.id, opt.value)}
                                      className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center gap-3 transition-colors"
                                    >
                                      <span className="text-base">{opt.emoji}</span>
                                      <span className="text-xs font-bold text-slate-700">{opt.label}</span>
                                    </button>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Комментарий */}
                            {canEditOrDelete ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setEditingComment(isEditingComment ? null : bale.id); setCommentText(bale.comment || ''); }}
                                className={`w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center shrink-0 text-sm transition-all ${bale.comment ? 'bg-amber-50 text-amber-500' : 'bg-gray-50 text-slate-200 hover:text-slate-400'}`}
                              >💬</button>
                            ) : (
                              bale.comment ? <div className="w-8 h-8 md:w-9 md:h-9 rounded-lg flex items-center justify-center shrink-0 text-sm bg-amber-50 text-amber-500">💬</div> : null
                            )}

                            {/* Удалить */}
                            {canEditOrDelete && (
                              <button onClick={() => deleteBale(cat.id, bale.id)} className="text-slate-200 hover:text-red-500 transition-colors shrink-0">
                                <i className="ni ni-fat-remove text-lg"></i>
                              </button>
                            )}
                          </div>

                          {/* Ввод нового веса при возврате */}
                          {isReturning && (
                            <div className="px-4 md:px-6 pb-3 flex gap-2 items-center bg-teal-50/50">
                              <span className="text-xs font-bold text-teal-600 shrink-0">↩️ Новый вес:</span>
                              <input type="number" className="flex-1 px-3 py-2 rounded-lg border border-teal-200 bg-white outline-none text-sm font-bold focus:border-teal-400"
                                value={returnWeight} onChange={(e) => setReturnWeight(e.target.value)} autoFocus placeholder="кг" />
                              <button onClick={() => confirmReturn(cat.id, bale.id)} className="px-4 py-2 rounded-lg bg-teal-500 text-white font-bold text-xs">OK</button>
                              <button onClick={() => setReturnWeightBaleId(null)} className="px-3 py-2 rounded-lg bg-gray-100 text-slate-400 font-bold text-xs">✕</button>
                            </div>
                          )}

                          {/* Комментарий */}
                          {isEditingComment && (
                            <div className="px-4 md:px-6 pb-3 flex gap-2">
                              <input type="text" placeholder="Комментарий..." className="flex-1 px-3 py-2 rounded-lg border border-amber-200 bg-amber-50/50 outline-none text-sm focus:border-amber-400"
                                value={commentText} onChange={(e) => setCommentText(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') saveComment(bale.id); }} autoFocus />
                              <button onClick={() => saveComment(bale.id)} className="px-4 py-2 rounded-lg bg-amber-500 text-white font-bold text-xs">OK</button>
                            </div>
                          )}
                          {!isEditingComment && bale.comment && (
                            <div className="px-4 md:px-6 pb-2 -mt-1">
                              <span className="text-[11px] text-amber-600 italic">💬 {bale.comment}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {cat.bales.length === 0 && (
                      <div className="py-20 text-center opacity-20 flex flex-col items-center uppercase tracking-widest font-black text-xs">
                        <i className="ni ni-archive-2 text-6xl mb-4"></i>
                        Пусто
                      </div>
                    )}
                  </div>
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes fade-in { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slide-up { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-fade-in { animation: fade-in 0.3s ease-out; }
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
