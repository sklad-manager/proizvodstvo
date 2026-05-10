'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Bale {
  id: string;
  number: string;
  weight: number;
  receivedDate: string;
  isConsumed: boolean;
  consumedDate?: string;
}

interface Category {
  id: string;
  name: string;
  bales: Bale[];
}

export default function RawMaterialsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [selectedDate, setSelectedDate] = useState('');
  const [newCategoryName, setNewCategoryName] = useState('');
  const [openedCategoryId, setOpenedCategoryId] = useState<string | null>(null);

  // Состояние для нового тюка
  const [newBaleNumber, setNewBaleNumber] = useState('');
  const [newBaleWeight, setNewBaleWeight] = useState('');

  useEffect(() => {
    const now = new Date();
    setSelectedDate(now.toISOString().split('T')[0]);

    const saved = localStorage.getItem('proizvodstvo_raw_materials');
    if (saved) {
      try {
        setCategories(JSON.parse(saved));
      } catch (e) {
        console.error("Ошибка загрузки сырья", e);
      }
    } else {
      setCategories([{ id: 'cat1', name: 'Вискоза 1.7 dtex', bales: [] }]);
    }
    setIsLoaded(true);
  }, []);

  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('proizvodstvo_raw_materials', JSON.stringify(categories));
    }
  }, [categories, isLoaded]);

  const addCategory = () => {
    if (newCategoryName.trim()) {
      const newCat = { id: Date.now().toString(), name: newCategoryName, bales: [] };
      setCategories([...categories, newCat]);
      setNewCategoryName('');
    }
  };

  const deleteCategory = (id: string) => {
    if (confirm('Удалить эту папку и всё сырье в ней?')) {
      setCategories(categories.filter(c => c.id !== id));
      if (openedCategoryId === id) setOpenedCategoryId(null);
    }
  };

  const addBale = (catId: string) => {
    if (newBaleWeight) {
      setCategories(categories.map(cat => {
        if (cat.id === catId) {
          const newBale: Bale = {
            id: Date.now().toString(),
            number: newBaleNumber || (cat.bales.length + 1).toString(),
            weight: parseFloat(newBaleWeight),
            receivedDate: selectedDate,
            isConsumed: false
          };
          return { ...cat, bales: [newBale, ...cat.bales] };
        }
        return cat;
      }));
      setNewBaleNumber('');
      setNewBaleWeight('');
    }
  };

  const consumeBale = (catId: string, baleId: string) => {
    setCategories(categories.map(cat => {
      if (cat.id === catId) {
        return {
          ...cat,
          bales: cat.bales.map(bale => 
            bale.id === baleId ? { ...bale, isConsumed: true, consumedDate: new Date().toISOString().split('T')[0] } : bale
          )
        };
      }
      return cat;
    }));
  };

  const deleteBale = (catId: string, baleId: string) => {
    if (confirm('Удалить этот тюк из базы?')) {
      setCategories(categories.map(cat => {
        if (cat.id === catId) {
          return { ...cat, bales: cat.bales.filter(b => b.id !== baleId) };
        }
        return cat;
      }));
    }
  };

  const getStats = (bales: Bale[]) => {
    const active = bales.filter(b => !b.isConsumed);
    const totalWeight = active.reduce((sum, b) => sum + b.weight, 0);
    return { count: active.length, weight: totalWeight.toFixed(1) };
  };

  if (!isLoaded) return <div className="p-10 text-center font-bold text-slate-400 uppercase tracking-widest">Загрузка склада...</div>;

  return (
    <div className="flex flex-col gap-4 md:gap-6 pb-20 max-w-full overflow-x-hidden">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/" className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-slate-600 hover:bg-gray-100 transition-colors">
            <i className="ni ni-bold-left text-xs"></i>
          </Link>
          <div>
            <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">Учет сырья</h2>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Дата: <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="bg-slate-50 px-2 py-0.5 rounded-lg border-none outline-none text-slate-600 font-bold" />
            </div>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <input type="text" placeholder="Название папки..." className="flex-1 md:flex-none px-4 py-2 rounded-xl border border-gray-200 focus:border-orange-400 outline-none text-sm min-w-0" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
           <button onClick={addCategory} className="px-4 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-black transition-all">+</button>
        </div>
      </div>

      {/* Список папок */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {categories.map((cat) => {
          const stats = getStats(cat.bales);
          return (
            <div 
              key={cat.id} 
              className={`group relative bg-white rounded-[2rem] shadow-xl border-2 transition-all duration-300 cursor-pointer overflow-hidden
                ${openedCategoryId === cat.id ? 'border-orange-500 ring-4 ring-orange-50' : 'border-transparent hover:border-orange-100'}
              `}
              onClick={() => setOpenedCategoryId(cat.id)}
            >
              <div className="p-6 md:p-8">
                <div className="flex items-start justify-between mb-4 md:mb-6">
                  <div className="w-12 h-12 md:w-14 md:h-14 rounded-2xl bg-gradient-to-br from-orange-400 to-yellow-500 flex items-center justify-center text-white shadow-lg">
                    <i className="ni ni-folder-17 text-xl md:text-2xl"></i>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); deleteCategory(cat.id); }} className="text-slate-300 hover:text-red-500 transition-colors">
                    <i className="ni ni-fat-remove text-xl"></i>
                  </button>
                </div>
                <h3 className="text-lg md:text-xl font-black text-slate-800 mb-2 uppercase tracking-tight">{cat.name}</h3>
                <div className="flex flex-col gap-1">
                  <div className="text-[10px] font-black text-slate-300 uppercase tracking-widest">На складе:</div>
                  <div className="flex items-baseline gap-2">
                    <span className="text-2xl md:text-3xl font-black text-orange-500">{stats.count}</span>
                    <span className="text-xs font-bold text-slate-400 uppercase">тюков</span>
                  </div>
                  <div className="text-sm font-black text-slate-600 mt-1">
                    Вес: <span className="text-orange-600">{stats.weight} кг</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Модальное окно */}
      {openedCategoryId && (
        <div className="fixed inset-0 z-999 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/70 backdrop-blur-md animate-fade-in">
          <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-5xl h-[92vh] md:h-[90vh] overflow-hidden flex flex-col animate-slide-up border border-white/20">
            {categories.filter(c => c.id === openedCategoryId).map(cat => {
              const stats = getStats(cat.bales);
              return (
                <React.Fragment key={cat.id}>
                  <div className="p-6 md:p-8 bg-gradient-to-br from-slate-800 to-slate-900 text-white flex items-center justify-between shrink-0 shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 md:w-16 md:h-16 bg-white/10 rounded-2xl flex items-center justify-center text-orange-400">
                        <i className="ni ni-folder-17 text-2xl md:text-3xl"></i>
                      </div>
                      <div>
                        <h2 className="text-lg md:text-2xl font-black mb-0 uppercase tracking-tight">{cat.name}</h2>
                        <div className="flex items-center gap-3 text-[10px] font-black uppercase tracking-tighter opacity-50">
                          <span>В наличии: {stats.count}</span>
                          <span className="w-1 h-1 bg-white/30 rounded-full"></span>
                          <span>Вес: {stats.weight} кг</span>
                        </div>
                      </div>
                    </div>
                    <button onClick={() => setOpenedCategoryId(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
                      <i className="ni ni-fat-remove text-xl"></i>
                    </button>
                  </div>

                  <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50 flex flex-wrap items-end gap-3 md:gap-4 shrink-0">
                    <div className="flex-1 min-w-[100px]">
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">№ Тюка</label>
                      <input type="text" placeholder="Номер" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-orange-400" value={newBaleNumber} onChange={(e) => setNewBaleNumber(e.target.value)} />
                    </div>
                    <div className="flex-1 min-w-[100px]">
                      <label className="text-[10px] font-black text-slate-400 uppercase block mb-1">Вес (кг)</label>
                      <input type="number" placeholder="Вес" className="w-full px-4 py-2.5 rounded-xl border border-gray-200 outline-none focus:border-orange-400" value={newBaleWeight} onChange={(e) => setNewBaleWeight(e.target.value)} />
                    </div>
                    <button onClick={() => addBale(cat.id)} className="h-[42px] px-8 rounded-xl bg-orange-500 text-white font-black uppercase text-xs tracking-widest hover:bg-orange-600 shadow-lg shadow-orange-100 w-full md:w-auto transition-all active:scale-95">Принять</button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-4 md:p-8 pt-0">
                    <table className="w-full border-collapse">
                      <thead className="sticky top-0 bg-white z-10 shadow-[0_1px_0_0_rgba(0,0,0,0.05)]">
                        <tr className="text-left">
                          <th className="py-6 px-2 text-[10px] font-black uppercase text-slate-300 w-16">№</th>
                          <th className="py-6 px-2 text-[10px] font-black uppercase text-slate-300">Вес</th>
                          <th className="py-6 px-2 text-[10px] font-black uppercase text-slate-300 hidden md:table-cell">Дата</th>
                          <th className="py-6 px-2 text-[10px] font-black uppercase text-slate-300 text-center">Статус</th>
                          <th className="py-6 px-2 text-[10px] font-black uppercase text-slate-300 text-right">Уд.</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {cat.bales.map((bale) => (
                          <tr key={bale.id} className={`group transition-all ${bale.isConsumed ? 'opacity-40 grayscale bg-gray-50' : 'hover:bg-orange-50/30'}`}>
                            <td className="py-4 px-2">
                              <span className="font-black text-slate-800">{bale.number}</span>
                            </td>
                            <td className="py-4 px-2 font-black text-slate-700">{bale.weight} <span className="text-[10px] text-slate-400">кг</span></td>
                            <td className="py-4 px-2 text-[10px] font-bold text-slate-400 hidden md:table-cell">{new Date(bale.receivedDate).toLocaleDateString('ru-RU')}</td>
                            <td className="py-4 px-2 text-center">
                              {bale.isConsumed ? (
                                <span className="text-[9px] font-black text-slate-400 uppercase px-2 py-1 bg-gray-100 rounded-lg">Списано {new Date(bale.consumedDate!).toLocaleDateString('ru-RU')}</span>
                              ) : (
                                <button onClick={() => consumeBale(cat.id, bale.id)} className="px-4 py-2 rounded-xl bg-white border border-gray-200 text-slate-500 text-[9px] font-black uppercase hover:bg-orange-500 hover:text-white transition-all shadow-sm">В работу</button>
                              )}
                            </td>
                            <td className="py-4 px-2 text-right">
                              <button onClick={() => deleteBale(cat.id, bale.id)} className="text-slate-200 hover:text-red-500 transition-colors">
                                <i className="ni ni-fat-remove text-xl"></i>
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
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
