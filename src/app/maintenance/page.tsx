'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

// Структура данных оборудования (на основе Google Script)
const initialSections = [
  {
    id: 'prep',
    title: 'Участок подготовки сырья',
    generalComment: '',
    equipment: [
      { id: 'p1', name: 'Разрыхлитель 1', status: 'Работает', comment: '' },
      { id: 'p2', name: 'Разрыхлитель 2', status: 'Работает', comment: '' },
      { id: 'p3', name: 'Разрыхлитель 3', status: 'Работает', comment: '' },
      { id: 'p4', name: 'Транспортировочный узел', status: 'Работает', comment: '' },
      { id: 'p5', name: 'Шкаф управления - Улитка', status: 'Работает', comment: '' },
    ]
  },
  {
    id: 'acc',
    title: 'Участок накопления сырья',
    generalComment: '',
    equipment: [
      { id: 'a1', name: 'Лабаз', status: 'Работает', comment: '' },
      { id: 'a2', name: 'Пульт управления лабаза', status: 'Работает', comment: '' },
    ]
  },
  {
    id: 'card',
    title: 'Участок чесания',
    generalComment: '',
    equipment: [
      { id: 'c1', name: 'Питатель', status: 'Работает', comment: '' },
      { id: 'c2', name: 'Чесальная линия', status: 'Работает', comment: '' },
      { id: 'c3', name: 'Съёмные валы', status: 'Работает', comment: '' },
    ]
  },
  {
    id: 'web',
    title: 'Участок формирования холста',
    generalComment: '',
    equipment: [
      { id: 'w1', name: 'Холстоукладчик', status: 'Работает', comment: '' },
      { id: 'w2', name: 'Транспортер', status: 'Работает', comment: '' },
    ]
  },
  {
    id: 'bond',
    title: 'Участок физического скрепления',
    generalComment: '',
    equipment: [
      { id: 'b1', name: 'Иглопробивная машина 1', status: 'Работает', comment: '' },
      { id: 'b2', name: 'Иглопробивная машина 2', status: 'Работает', comment: '' },
    ]
  },
  {
    id: 'therm',
    title: 'Участок термического скрепления',
    generalComment: '',
    equipment: [
      { id: 't1', name: 'Печь', status: 'Работает', comment: '' },
    ]
  },
  {
    id: 'wind',
    title: 'Участок намотки',
    generalComment: '',
    equipment: [
      { id: 'wn1', name: 'Намотчик', status: 'Работает', comment: '' },
      { id: 'wn2', name: 'Резательная машина', status: 'Работает', comment: '' },
    ]
  },
  {
    id: 'pack',
    title: 'Участок упаковки',
    generalComment: '',
    equipment: [
      { id: 'pk1', name: 'Упаковщик', status: 'Работает', comment: '' },
    ]
  },
  {
    id: 'other',
    title: 'Прочее / Коммуникации',
    generalComment: '',
    equipment: [
      { id: 'o1', name: 'Компрессорная', status: 'Работает', comment: '' },
      { id: 'o2', name: 'Вентиляция', status: 'Работает', comment: '' },
      { id: 'o3', name: 'Освещение', status: 'Работает', comment: '' },
      { id: 'o4', name: 'Водоснабжение', status: 'Работает', comment: '' },
      { id: 'o5', name: 'Отопление', status: 'Работает', comment: '' },
    ]
  }
];

export default function MaintenancePage() {
  const [sections, setSections] = useState(initialSections);
  const [isLoaded, setIsLoaded] = useState(false);
  const [expandedSection, setExpandedSection] = useState<string | null>('prep');

  // Загрузка данных
  useEffect(() => {
    const saved = localStorage.getItem('proizvodstvo_maintenance');
    if (saved) {
      try {
        setSections(JSON.parse(saved));
      } catch (e) {
        console.error("Ошибка загрузки ТО", e);
      }
    }
    setIsLoaded(true);
  }, []);

  // Сохранение данных
  useEffect(() => {
    if (isLoaded) {
      localStorage.setItem('proizvodstvo_maintenance', JSON.stringify(sections));
    }
  }, [sections, isLoaded]);

  const updateEquipment = (sectionId: string, equipId: string, field: string, value: string) => {
    setSections(prev => prev.map(section => {
      if (section.id === sectionId) {
        return {
          ...section,
          equipment: section.equipment.map(e => e.id === equipId ? { ...e, [field]: value } : e)
        };
      }
      return section;
    }));
  };

  const updateGeneralComment = (sectionId: string, value: string) => {
    setSections(prev => prev.map(section => 
      section.id === sectionId ? { ...section, generalComment: value } : section
    ));
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'В ремонте': return 'bg-red-500 text-white';
      case 'Требует ТО': return 'bg-orange-500 text-white';
      default: return 'bg-emerald-500 text-white';
    }
  };

  if (!isLoaded) return <div className="p-10 text-center font-bold text-slate-400 uppercase">Загрузка журнала ТО...</div>;

  return (
    <div className="flex flex-col gap-6 pb-20 max-w-6xl mx-auto">
      {/* Шапка */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center justify-center w-10 h-10 rounded-xl bg-gray-50 text-slate-600 hover:bg-gray-100 transition-colors">
            <i className="ni ni-bold-left text-xs"></i>
          </Link>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Ремонт и ТО</h2>
            <div className="text-xs font-bold uppercase text-slate-400">Технический журнал оборудования</div>
          </div>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-slate-800 text-white rounded-xl shadow-lg">
           <i className="ni ni-settings text-xs"></i>
           <span className="text-[10px] font-black uppercase tracking-widest">Линия активна</span>
        </div>
      </div>

      {/* Список участков */}
      <div className="flex flex-col gap-4">
        {sections.map((section) => (
          <div key={section.id} className="bg-white rounded-[2rem] shadow-xl border border-gray-50 overflow-hidden transition-all duration-300">
            {/* Заголовок участка */}
            <div 
              className={`p-6 flex items-center justify-between cursor-pointer transition-colors ${expandedSection === section.id ? 'bg-slate-800 text-white' : 'hover:bg-gray-50'}`}
              onClick={() => setExpandedSection(expandedSection === section.id ? null : section.id)}
            >
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${expandedSection === section.id ? 'bg-white/20' : 'bg-slate-100 text-slate-400'}`}>
                  {section.title.charAt(0)}
                </div>
                <h3 className="text-lg font-black mb-0">{section.title}</h3>
              </div>
              <div className="flex items-center gap-4">
                 <span className={`text-[10px] font-black uppercase px-3 py-1 rounded-lg ${expandedSection === section.id ? 'bg-white/10 text-white' : 'bg-gray-100 text-slate-400'}`}>
                    {section.equipment.length} ед.
                 </span>
                 <i className={`ni ni-bold-down transition-transform duration-300 ${expandedSection === section.id ? 'rotate-180' : ''}`}></i>
              </div>
            </div>

            {/* Контент участка */}
            {expandedSection === section.id && (
              <div className="p-8 animate-slide-down">
                <div className="grid grid-cols-1 gap-6">
                  {/* Список оборудования */}
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                      <thead>
                        <tr className="text-left border-b border-gray-50">
                          <th className="pb-4 text-[10px] font-black uppercase text-slate-300 tracking-widest w-1/3">Наименование станка</th>
                          <th className="pb-4 text-[10px] font-black uppercase text-slate-300 tracking-widest w-1/4">Состояние</th>
                          <th className="pb-4 text-[10px] font-black uppercase text-slate-300 tracking-widest">Технический комментарий</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {section.equipment.map((item) => (
                          <tr key={item.id} className="group">
                            <td className="py-4">
                              <span className="text-sm font-black text-slate-700 group-hover:text-blue-600 transition-colors">{item.name}</span>
                            </td>
                            <td className="py-4 px-2">
                               <select 
                                 value={item.status} 
                                 onChange={(e) => updateEquipment(section.id, item.id, 'status', e.target.value)}
                                 className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border-none outline-none cursor-pointer shadow-sm ${getStatusColor(item.status)}`}
                               >
                                 <option value="Работает">Работает</option>
                                 <option value="Требует ТО">Требует ТО</option>
                                 <option value="В ремонте">В ремонте</option>
                               </select>
                            </td>
                            <td className="py-4">
                              <textarea 
                                placeholder="Напишите замечание..."
                                className="w-full px-4 py-2 rounded-xl border border-gray-100 focus:border-blue-400 outline-none text-xs min-h-[40px] resize-none transition-all"
                                value={item.comment}
                                onChange={(e) => updateEquipment(section.id, item.id, 'comment', e.target.value)}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Общий комментарий по участку */}
                  <div className="mt-4 pt-6 border-t border-gray-50">
                    <div className="flex items-center gap-2 mb-3">
                       <i className="ni ni-chat-round text-blue-500 text-xs"></i>
                       <h6 className="text-[10px] font-black uppercase text-slate-400 mb-0 tracking-widest">Общий комментарий по участку</h6>
                    </div>
                    <textarea 
                      placeholder="Опишите состояние всего участка или общие задачи..."
                      className="w-full p-6 rounded-[1.5rem] bg-gray-50 border-none focus:ring-2 focus:ring-blue-100 outline-none text-sm min-h-[120px] transition-all"
                      value={section.generalComment}
                      onChange={(e) => updateGeneralComment(section.id, e.target.value)}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <style jsx>{`
        @keyframes slide-down { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }
        .animate-slide-down { animation: slide-down 0.4s ease-out; }
      `}</style>
    </div>
  );
}
