'use client';
import React from 'react';

interface CalendarProps {
  year: number;
  month: number; // 0-indexed
  selectedDate: string | null;
  dayTotals: Record<string, { expense: number; income: number }>;
  onSelectDate: (date: string | null) => void;
  onChangeMonth: (delta: number) => void;
}

const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

export default function FinanceCalendar({ year, month, selectedDate, dayTotals, onSelectDate, onChangeMonth }: CalendarProps) {
  const firstDay = new Date(year, month, 1);
  let startDay = firstDay.getDay() - 1;
  if (startDay < 0) startDay = 6;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = new Date().toISOString().split('T')[0];

  const cells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  return (
    <div className="bg-white rounded-[2rem] shadow-xl border border-gray-50 overflow-hidden">
      {/* Шапка месяца */}
      <div className="flex items-center justify-between px-6 py-4 bg-gradient-to-r from-slate-800 to-slate-900 text-white">
        <button onClick={() => onChangeMonth(-1)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-lg">‹</button>
        <div className="text-center">
          <div className="font-black text-lg tracking-tight">{MONTHS[month]}</div>
          <div className="text-[10px] opacity-50 font-bold">{year}</div>
        </div>
        <button onClick={() => onChangeMonth(1)} className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center hover:bg-white/20 transition-all text-lg">›</button>
      </div>

      <div className="p-4">
        {/* Дни недели */}
        <div className="grid grid-cols-7 mb-2">
          {DAYS.map(d => <div key={d} className="text-center text-[9px] font-black text-slate-300 uppercase">{d}</div>)}
        </div>

        {/* Сетка дней */}
        <div className="grid grid-cols-7 gap-1">
          {cells.map((day, i) => {
            if (day === null) return <div key={i} />;
            const dateStr = `${year}-${(month+1).toString().padStart(2,'0')}-${day.toString().padStart(2,'0')}`;
            const totals = dayTotals[dateStr];
            const isToday = dateStr === today;
            const isSelected = dateStr === selectedDate;
            const hasExpense = totals && totals.expense > 0;
            const hasIncome = totals && totals.income > 0;

            return (
              <button
                key={i}
                onClick={() => onSelectDate(isSelected ? null : dateStr)}
                className={`relative flex flex-col items-center py-1.5 rounded-xl transition-all text-sm
                  ${isSelected ? 'bg-slate-800 text-white shadow-lg scale-105' : isToday ? 'bg-blue-50 text-blue-600 font-black' : 'hover:bg-gray-50 text-slate-600'}
                `}
              >
                <span className={`font-bold text-xs ${isSelected ? 'text-white' : ''}`}>{day}</span>
                {(hasExpense || hasIncome) && (
                  <div className="flex gap-0.5 mt-0.5">
                    {hasExpense && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-rose-300' : 'bg-rose-400'}`} />}
                    {hasIncome && <div className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-emerald-300' : 'bg-emerald-400'}`} />}
                  </div>
                )}
                {hasExpense && !isSelected && (
                  <span className="text-[7px] font-black text-rose-400 mt-0.5 leading-none">-{totals.expense > 999 ? Math.round(totals.expense/1000)+'k' : totals.expense}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Кнопка сброса */}
        {selectedDate && (
          <button onClick={() => onSelectDate(null)} className="w-full mt-3 py-2 rounded-xl bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all">
            Показать все
          </button>
        )}
      </div>
    </div>
  );
}
