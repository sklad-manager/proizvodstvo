'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

interface Employee {
  id: string;
  name: string;
  isActive: boolean;
  attendance: string[]; // Массив дат типа "2024-05-10"
}

export default function SchedulePage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isCloudMode, setIsCloudMode] = useState(false);
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [selectedEmployeeForModal, setSelectedEmployeeForModal] = useState<Employee | null>(null);

  const loadData = async () => {
    const cloudSynced = localStorage.getItem('proizvodstvo_is_synced') === 'true';
    setIsCloudMode(cloudSynced);

    if (cloudSynced) {
      try {
        const res = await fetch('/api/schedule');
        const data = await res.json();
        if (Array.isArray(data)) {
          setEmployees(data);
        }
      } catch (e) {
        console.error("Ошибка загрузки графика из облака", e);
      }
    } else {
      const saved = localStorage.getItem('proizvodstvo_employees');
      if (saved) {
        try {
          setEmployees(JSON.parse(saved));
        } catch (e) {
          console.error("Ошибка загрузки графика", e);
        }
      }
    }
    setIsLoaded(true);
  };

  useEffect(() => {
    loadData();
    // Автообновление для облака
    const interval = setInterval(() => {
      const cloudSynced = localStorage.getItem('proizvodstvo_is_synced') === 'true';
      if (cloudSynced) loadData();
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Сохранение в локал (только если НЕ в облаке)
  useEffect(() => {
    if (isLoaded && !isCloudMode) {
      localStorage.setItem('proizvodstvo_employees', JSON.stringify(employees));
    }
  }, [employees, isLoaded, isCloudMode]);

  const addEmployee = async () => {
    if (newEmployeeName.trim()) {
      const newEmp = { id: Date.now().toString(), name: newEmployeeName, isActive: true, attendance: [] };
      
      if (isCloudMode) {
        await fetch('/api/schedule', {
          method: 'POST',
          body: JSON.stringify({ type: 'employee', ...newEmp })
        });
        loadData();
      } else {
        setEmployees([...employees, newEmp]);
      }
      setNewEmployeeName('');
    }
  };

  const toggleAttendance = async (empId: string, date: string) => {
    const emp = employees.find(e => e.id === empId);
    if (!emp) return;

    const isMarked = emp.attendance.includes(date);

    if (isCloudMode) {
      if (isMarked) {
        await fetch(`/api/schedule?type=attendance&id=${empId}&date=${date}`, { method: 'DELETE' });
      } else {
        await fetch('/api/schedule', {
          method: 'POST',
          body: JSON.stringify({ type: 'attendance', employee_id: empId, date })
        });
      }
      loadData();
    } else {
      setEmployees(employees.map(e => {
        if (e.id === empId) {
          const newAttendance = isMarked
            ? e.attendance.filter(d => d !== date)
            : [...e.attendance, date];
          return { ...e, attendance: newAttendance };
        }
        return e;
      }));
    }
  };

  const deleteEmployee = async (id: string) => {
    if (confirm('Удалить сотрудника из базы?')) {
      if (isCloudMode) {
        await fetch(`/api/schedule?type=employee&id=${id}`, { method: 'DELETE' });
        loadData();
      } else {
        setEmployees(employees.filter(e => e.id !== id));
      }
      setSelectedEmployeeForModal(null);
    }
  };

  const toggleStatus = async (id: string) => {
    const emp = employees.find(e => e.id === id);
    if (!emp) return;
    const newStatus = !emp.isActive;

    if (isCloudMode) {
      await fetch('/api/schedule', {
        method: 'PATCH',
        body: JSON.stringify({ id, isActive: newStatus })
      });
      loadData();
    } else {
      setEmployees(employees.map(e => e.id === id ? { ...e, isActive: newStatus } : e));
    }
  };

  // Получаем текущие 7 дней для табеля
  const getDays = () => {
    const days = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toISOString().split('T')[0]);
    }
    return days;
  };

  const days = getDays();

  if (!isLoaded) return <div className="p-10 text-center font-bold text-slate-400">Загрузка персонала...</div>;

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
              <h2 className="text-xl md:text-2xl font-bold text-slate-800 tracking-tight">График</h2>
              {isCloudMode && <span className="px-2 py-0.5 bg-emerald-100 text-emerald-600 text-[8px] font-black uppercase rounded-md tracking-tighter animate-pulse">Cloud</span>}
            </div>
            <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Управление сменами</div>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
           <input type="text" placeholder="ФИО сотрудника..." className="flex-1 md:flex-none px-4 py-2 rounded-xl border border-gray-200 focus:border-red-400 outline-none text-sm min-w-0 md:min-w-48" value={newEmployeeName} onChange={(e) => setNewEmployeeName(e.target.value)} />
           <button onClick={addEmployee} className="px-4 md:px-5 py-2 rounded-xl bg-slate-800 text-white font-bold text-sm hover:bg-black transition-all">+</button>
        </div>
      </div>

      {/* Список сотрудников */}
      <div className="bg-white rounded-[2rem] shadow-xl border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-100">
                <th className="p-6 text-left text-[10px] font-black uppercase text-slate-400 tracking-widest">Сотрудник</th>
                {days.map(day => (
                  <th key={day} className="p-4 text-center text-[10px] font-black uppercase text-slate-400 tracking-widest min-w-[60px]">
                    {new Date(day).toLocaleDateString('ru-RU', { weekday: 'short', day: 'numeric' })}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {employees.map(emp => (
                <tr key={emp.id} className={`group hover:bg-slate-50 transition-colors ${!emp.isActive ? 'opacity-50' : ''}`}>
                  <td className="p-6">
                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => setSelectedEmployeeForModal(emp)}>
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-white font-black text-xs ${emp.isActive ? 'bg-slate-800' : 'bg-slate-300'}`}>
                        {emp.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-slate-800 group-hover:text-red-600 transition-colors">{emp.name}</div>
                        <div className="text-[9px] font-black uppercase text-slate-400">{emp.isActive ? 'В штате' : 'Уволен'}</div>
                      </div>
                    </div>
                  </td>
                  {days.map(day => (
                    <td key={day} className="p-2 text-center">
                      <button 
                        onClick={() => toggleAttendance(emp.id, day)}
                        disabled={!emp.isActive}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center mx-auto transition-all ${
                          emp.attendance.includes(day) 
                            ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100 scale-110' 
                            : 'bg-slate-100 text-slate-300 hover:bg-slate-200'
                        }`}
                      >
                        <i className={`ni ${emp.attendance.includes(day) ? 'ni-check-bold' : 'ni-fat-add'} text-xs`}></i>
                      </button>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Модальное окно личного календаря */}
      {selectedEmployeeForModal && (
        <div className="fixed inset-0 z-999 flex items-end md:items-center justify-center p-0 md:p-4 bg-slate-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-t-[2.5rem] md:rounded-[2.5rem] shadow-2xl w-full max-w-lg overflow-hidden animate-slide-up border border-white/20 h-[85vh] md:h-auto flex flex-col">
             <div className="p-6 md:p-8 flex items-center justify-between bg-slate-800 text-white shrink-0">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center text-2xl font-black">
                    {selectedEmployeeForModal.name.charAt(0)}
                  </div>
                  <div>
                    <h2 className="text-xl font-black mb-0">{selectedEmployeeForModal.name}</h2>
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-60">Статистика смен</p>
                  </div>
                </div>
                <button onClick={() => setSelectedEmployeeForModal(null)} className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center"><i className="ni ni-fat-remove text-xl"></i></button>
             </div>
             <div className="p-8 flex-1 overflow-y-auto">
                <div className="grid grid-cols-2 gap-4 mb-8">
                  <div className="p-6 bg-slate-50 rounded-3xl text-center">
                    <div className="text-3xl font-black text-slate-800 mb-1">{selectedEmployeeForModal.attendance.length}</div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Всего смен</div>
                  </div>
                  <div className="p-6 bg-slate-50 rounded-3xl text-center">
                    <div className="text-3xl font-black text-slate-800 mb-1">
                      {selectedEmployeeForModal.attendance.filter(d => d.startsWith(new Date().toISOString().slice(0, 7))).length}
                    </div>
                    <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest">В этом месяце</div>
                  </div>
                </div>
                <div className="flex flex-col gap-3">
                  <button onClick={() => toggleStatus(selectedEmployeeForModal.id)} className={`w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest transition-all ${selectedEmployeeForModal.isActive ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-emerald-100 text-emerald-600 hover:bg-emerald-200'}`}>
                    {selectedEmployeeForModal.isActive ? 'Отправить в архив (Уволить)' : 'Восстановить в штате'}
                  </button>
                  <button onClick={() => deleteEmployee(selectedEmployeeForModal.id)} className="w-full py-4 bg-red-50 text-red-500 rounded-2xl font-black uppercase text-xs tracking-widest hover:bg-red-500 hover:text-white transition-all">Удалить из базы навсегда</button>
                </div>
             </div>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes slide-up { from { transform: translateY(40px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
