'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface HistoryRecord {
  id: string;
  action_type: 'add' | 'delete';
  module: 'finance' | 'raw_materials';
  description: string;
  created_at: string;
}

export default function HistoryPage() {
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetch('/api/history')
      .then(res => res.json())
      .then(data => {
        setHistory(data);
        setIsLoading(false);
      })
      .catch(err => {
        console.error(err);
        setIsLoading(false);
      });
  }, []);

  const formatDate = (isoString: string) => {
    const d = new Date(isoString);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const hours = d.getHours().toString().padStart(2, '0');
    const mins = d.getMinutes().toString().padStart(2, '0');
    return `${day}.${month} в ${hours}:${mins}`;
  };

  return (
    <div className="flex flex-col gap-6 pb-24 max-w-full overflow-x-hidden">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 md:p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center justify-center w-12 h-12 rounded-2xl bg-slate-800 text-white hover:bg-black transition-all shadow-lg">
            <i className="ni ni-bold-left text-sm"></i>
          </Link>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">История</h2>
            <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
              Последние 100 действий
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 md:p-8">
        {isLoading ? (
          <div className="p-10 text-center font-black text-slate-300 uppercase tracking-widest animate-pulse">Загрузка истории...</div>
        ) : history.length === 0 ? (
          <div className="p-10 text-center font-black text-slate-400 uppercase tracking-widest">История пуста</div>
        ) : (
          <div className="flex flex-col gap-3">
            {history.map(record => (
              <div key={record.id} className="flex items-start md:items-center justify-between gap-4 p-4 rounded-2xl border border-slate-50 hover:bg-slate-50 transition-colors">
                <div className="flex items-start md:items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white shadow-md ${record.action_type === 'add' ? 'bg-emerald-500 shadow-emerald-200' : 'bg-rose-500 shadow-rose-200'}`}>
                    <i className={`ni ${record.action_type === 'add' ? 'ni-fat-add' : 'ni-fat-remove'} text-xl`}></i>
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-800 flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] uppercase tracking-widest text-white font-black ${record.module === 'finance' ? 'bg-indigo-500' : 'bg-orange-500'}`}>
                        {record.module === 'finance' ? 'Финансы' : 'Сырье'}
                      </span>
                      {record.action_type === 'add' ? 'Добавлено' : 'Удалено'}
                    </div>
                    <div className="text-xs text-slate-500 mt-1.5">{record.description}</div>
                  </div>
                </div>
                <div className="text-[10px] md:text-xs font-black text-slate-400 text-right shrink-0">
                  {formatDate(record.created_at)}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
