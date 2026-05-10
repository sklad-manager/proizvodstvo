'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Employee {
  id: number;
  name: string;
  position: string;
  isActive: boolean;
  attendance: string[]; // 'YYYY-MM-DD'
}

export default function SchedulePage() {
  // Загрузка начальных данных из localStorage или использование пустых/демо
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);

  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState<Employee | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [viewDate, setViewDate] = useState(new Date(2026, 4, 1)); 

  // 1. Инициализация даты и загрузка данных
  useEffect(() => {
    const now = new Date();
    setSelectedDate(now.toISOString().split('T')[0]);
    setViewDate(new Date(now.getFullYear(), now.getMonth(), 1));

    const saved = localStorage.getItem('proizvodstvo_employees');
    if (saved) {
      try {
        setEmployees(JSON.parse(saved));
      } catch (e) {
        console.error("Ошибка загрузки данных", e);
      }
    } else {
      // Демо-данные только если база пуста
      setEmployees([
        { id: 1, name: 'Иванов Иван', position: 'Оператор линии', isActive: true, attendance: ['2026-05-01', '2026-05-10'] },
      ]);
    }
    setIsLoaded(true);
  }, []);

  // 2. Автоматическое сохранение при любом изменении списка
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('proizvodstvo_employees', JSON.stringify(employees));
    }
  }, [employees, isLoaded]);

  const changeMonth = (offset: number) => {
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + offset, 1));
  };

  const addEmployee = () => {
    if (newEmployeeName.trim()) {
      setEmployees([...employees, {
        id: Date.now(),
        name: newEmployeeName,
        position: 'Сотрудник',
        isActive: true,
        attendance: [],
      }]);
      setNewEmployeeName('');
    }
  };

  const toggleAttendanceOnDate = (id: number, date: string) => {
    setEmployees(employees.map(emp => {
      if (emp.id === id) {
        const hasWorked = emp.attendance.includes(date);
        return { ...emp, attendance: hasWorked ? emp.attendance.filter(d => d !== date) : [...emp.attendance, date] };
      }
      return emp;
    }));
  };

  const deleteEmployee = (id: number) => {
    if (confirm('Удалить сотрудника полностью?')) {
      setEmployees(employees.filter(e => e.id !== id));
      setSelectedEmployeeForModal(null);
    }
  };

  const archiveEmployee = (id: number) => {
    if (confirm('Отправить сотрудника в архив?')) {
      setEmployees(employees.map(e => e.id === id ? { ...e, isActive: false } : e));
      setSelectedEmployeeForModal(null);
    }
  };

  const restoreEmployee = (id: number) => {
    setEmployees(employees.map(e => e.id === id ? { ...e, isActive: true } : e));
    setSelectedEmployeeForModal(null);
  };

  const daysInMonth = (date: Date) => new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  const firstDay = (date: Date) => (new Date(date.getFullYear(), date.getMonth(), 1).getDay() + 6) % 7;

  const getAttendanceForDate = (dateStr: string) => {
    return employees.filter(e => e.isActive && e.attendance.includes(dateStr)).length;
  };

  if (!isLoaded) return <div className="p-10 text-center font-bold text-slate-400">Загрузка базы...</div>;

  return (
    <div className="flex flex-col gap-4 md:gap-6 pb-20 max-w-full overflow-x-hidden">
      {/* Шапка страницы */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 md:p-6 rounded-[1.5rem] md:rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-3 md:gap-4">
          <Link href="/" className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-slate-600 hover:bg-gray-100 transition-colors">
            <i className="ni ni-bold-left text-xs"></i>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Proizvodstvo</h2>
            <div className="text-xs font-bold uppercase text-slate-400">График и табель персонала</div>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <input 
              type="text" 
              placeholder="ФИО сотрудника..."
              className="flex-1 md:flex-none px-4 py-2 rounded-xl border border-gray-200 focus:border-red-400 outline-none text-sm min-w-0 md:min-w-48"
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
            />
            <button onClick={addEmployee} className="px-4 md:px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-black transition-all">
              +
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* КАЛЕНДАРЬ */}
        <div className="lg:col-span-5 xl:col-span-4">
          <div className="bg-white rounded-[2.5rem] shadow-xl p-8 border border-gray-50 h-full">
            <div className="flex items-center justify-between mb-8">
              <div className="flex flex-col">
                <span className="text-2xl font-black text-slate-800 capitalize">
                  {viewDate.toLocaleString('ru-RU', { month: 'long' })}
                </span>
                <span className="text-sm font-bold text-slate-300">{viewDate.getFullYear()} год</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => changeMonth(-1)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 transition-all">
                  <i className="ni ni-bold-left text-[10px]"></i>
                </button>
                <button onClick={() => changeMonth(1)} className="w-10 h-10 rounded-xl bg-gray-50 flex items-center justify-center hover:bg-emerald-50 hover:text-emerald-500 transition-all">
                  <i className="ni ni-bold-right text-[10px]"></i>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1">
              {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                <div key={day} className="text-[10px] font-black text-slate-300 uppercase py-3 text-center">{day}</div>
              ))}
              {Array.from({ length: firstDay(viewDate) }).map((_, i) => <div key={`empty-${i}`} className="aspect-square"></div>)}
              {Array.from({ length: daysInMonth(viewDate) }).map((_, i) => {
                const d = i + 1;
                const ds = `${viewDate.getFullYear()}-${(viewDate.getMonth() + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                const isSel = selectedDate === ds;
                const count = getAttendanceForDate(ds);

                return (
                  <button 
                    key={d} 
                    onClick={() => setSelectedDate(ds)}
                    className={`aspect-square flex flex-col items-center justify-center rounded-2xl transition-all relative
                      ${isSel ? 'bg-slate-800 text-white shadow-2xl scale-110 z-10' : 'hover:bg-emerald-50 text-slate-600'}
                    `}
                  >
                    <span className={`text-sm ${isSel ? 'font-black' : 'font-bold text-slate-700'}`}>{d}</span>
                    <div className="flex gap-0.5 mt-1 h-1 items-center justify-center w-full px-1">
                      {Array.from({ length: Math.min(count, 5) }).map((_, dot) => (
                        <div key={dot} className={`w-1 h-1 rounded-full ${isSel ? 'bg-emerald-400' : 'bg-emerald-500'}`}></div>
                      ))}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* ТАБЛИЦА */}
        <div className="lg:col-span-7 xl:col-span-8">
          <div className="bg-white rounded-[2.5rem] shadow-xl border border-gray-50 overflow-hidden min-h-[500px]">
            <div className="p-8 border-b border-gray-50 flex items-center justify-between bg-gray-50/20">
              <div>
                <h3 className="text-lg font-black text-slate-800 mb-0">Смена на {new Date(selectedDate).toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' })}</h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-1 mb-0 italic">Кликните на имя для управления</p>
              </div>
              <div className="px-4 py-2 bg-emerald-500 text-white text-xs font-black rounded-xl shadow-lg">
                В СМЕНЕ: {getAttendanceForDate(selectedDate)}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-gray-50">
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-300">Сотрудник</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-300 text-center">Статус</th>
                    <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-300 text-right">История</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {employees.filter(e => e.isActive).map((emp) => {
                    const isWorked = emp.attendance.includes(selectedDate);
                    return (
                      <tr key={emp.id} className="hover:bg-gray-50/50 transition-colors">
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-4 cursor-pointer group" onClick={() => setSelectedEmployeeForModal(emp)}>
                            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black transition-all ${isWorked ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-200' : 'bg-gray-100 text-slate-400'}`}>
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <div className="text-sm font-black text-slate-800 group-hover:text-emerald-500 transition-colors">{emp.name}</div>
                              <div className="text-[10px] text-slate-400 font-bold uppercase">В смене</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <button 
                            onClick={() => toggleAttendanceOnDate(emp.id, selectedDate)}
                            className={`px-6 py-2.5 rounded-2xl text-[11px] font-black transition-all
                              ${isWorked ? 'bg-emerald-500 text-white shadow-md' : 'bg-white border border-gray-100 text-slate-400 hover:text-emerald-500'}
                            `}
                          >
                            {isWorked ? 'РАБОТАЛ' : 'ОТМЕТИТЬ'}
                          </button>
                        </td>
                        <td className="px-8 py-5 text-right font-black text-slate-400 text-xs">
                          {emp.attendance.length} дн.
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* СЕКЦИЯ АРХИВА */}
            {employees.some(e => !e.isActive) && (
              <div className="p-8 bg-slate-50/50 border-t border-gray-50">
                <h6 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">В архиве</h6>
                <div className="flex flex-wrap gap-3">
                  {employees.filter(e => !e.isActive).map(emp => (
                    <div 
                      key={emp.id} 
                      onClick={() => setSelectedEmployeeForModal(emp)}
                      className="px-4 py-2 bg-white border border-gray-100 rounded-xl text-xs font-bold text-slate-500 cursor-pointer hover:border-slate-300 transition-all flex items-center gap-2"
                    >
                      <div className="w-2 h-2 rounded-full bg-slate-300"></div>
                      {emp.name}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* КАРТОЧКА СОТРУДНИКА */}
      {selectedEmployeeForModal && (
        <div className="fixed inset-0 z-999 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-white/20 h-[85vh] md:h-auto flex flex-col">
             <div className="p-6 md:p-8 flex items-center justify-between bg-slate-800 text-white shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black">
                    {selectedEmployeeForModal.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-black mb-0">{selectedEmployeeForModal.name}</h3>
                    <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-0">
                      {selectedEmployeeForModal.isActive ? 'Активен' : 'В архиве'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmployeeForModal(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center hover:bg-white/20">
                  <i className="ni ni-fat-remove text-white text-xl"></i>
                </button>
             </div>
             
             <div className="p-8">
                <div className="mb-8">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-xs font-black text-slate-400 uppercase tracking-widest">История выходов</span>
                    <span className="text-sm font-black text-emerald-500">{selectedEmployeeForModal.attendance.length} смен</span>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5 text-center">
                    {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(day => (
                      <div key={day} className="text-[10px] font-black text-slate-200 uppercase py-2">{day}</div>
                    ))}
                    {Array.from({ length: firstDay(viewDate) }).map((_, i) => <div key={`mod-empty-${i}`} className="aspect-square"></div>)}
                    {Array.from({ length: daysInMonth(viewDate) }).map((_, i) => {
                      const d = i + 1;
                      const ds = `${viewDate.getFullYear()}-${(viewDate.getMonth() + 1).toString().padStart(2, '0')}-${d.toString().padStart(2, '0')}`;
                      const hasWorked = selectedEmployeeForModal.attendance.includes(ds);
                      return (
                        <div key={`mod-day-${d}`} className={`aspect-square flex items-center justify-center text-xs rounded-xl font-bold ${hasWorked ? 'bg-emerald-500 text-white shadow-lg' : 'text-slate-300 bg-gray-50/50'}`}>
                          {d}
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  {selectedEmployeeForModal.isActive ? (
                    <button 
                      onClick={() => archiveEmployee(selectedEmployeeForModal.id)}
                      className="py-4 rounded-2xl bg-orange-50 text-orange-600 font-black text-[10px] uppercase tracking-widest hover:bg-orange-100 transition-all border border-orange-100"
                    >
                      Отправить в архив
                    </button>
                  ) : (
                    <button 
                      onClick={() => restoreEmployee(selectedEmployeeForModal.id)}
                      className="py-4 rounded-2xl bg-emerald-50 text-emerald-600 font-black text-[10px] uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100"
                    >
                      Вернуть в смену
                    </button>
                  )}
                  <button 
                    onClick={() => deleteEmployee(selectedEmployeeForModal.id)}
                    className="py-4 rounded-2xl bg-red-50 text-red-600 font-black text-[10px] uppercase tracking-widest hover:bg-red-100 transition-all border border-red-100"
                  >
                    Удалить полностью
                  </button>
                </div>
             </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slide-up { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
      `}</style>
    </div>
  );
}
