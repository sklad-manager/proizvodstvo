'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

export default function Home() {
  const [isCloudSynced, setIsCloudSynced] = useState(false);
  const [hasLocalData, setHasLocalData] = useState(false);
  const [syncStatus, setSyncStatus] = useState('idle');

  useEffect(() => {
    // Проверка статуса синхронизации
    const synced = localStorage.getItem('proizvodstvo_is_synced') === 'true';
    setIsCloudSynced(synced);

    // Проверка наличия локальных данных
    const employees = localStorage.getItem('proizvodstvo_employees');
    const materials = localStorage.getItem('proizvodstvo_raw_materials');
    const maintenance = localStorage.getItem('proizvodstvo_maintenance');
    
    if (employees || materials || maintenance) {
      setHasLocalData(true);
    }
  }, []);

  const syncToCloud = async () => {
    if (!confirm('Перенести все текущие данные в облако? После этого они будут доступны на всех устройствах.')) return;
    
    setSyncStatus('syncing');
    try {
      // 1. Инициализация базы
      await fetch('/api/setup-db');
      
      // 2. Миграция Сырья
      const localMaterials = localStorage.getItem('proizvodstvo_raw_materials');
      if (localMaterials) {
        const categories = JSON.parse(localMaterials);
        for (const cat of categories) {
          // Создаем категорию
          await fetch('/api/raw-materials', {
            method: 'POST',
            body: JSON.stringify({ type: 'category', id: cat.id, name: cat.name })
          });
          // Создаем тюки
          for (const bale of cat.bales) {
            await fetch('/api/raw-materials', {
              method: 'POST',
              body: JSON.stringify({ type: 'bale', category_id: cat.id, ...bale })
            });
          }
        }
      }

      // Запоминаем статус
      localStorage.setItem('proizvodstvo_is_synced', 'true');
      setSyncStatus('done');
      setIsCloudSynced(true);
      alert('Данные успешно перенесены в облако!');
    } catch (e) {
      console.error(e);
      alert('Ошибка при синхронизации. Проверьте интернет.');
      setSyncStatus('idle');
    }
  };

  const menuItems = [
    { 
      name: 'Учет сырья', 
      description: 'Прием, списание и остатки вискозы на складе', 
      icon: 'ni-collection', 
      gradient: 'bg-gradient-to-br from-orange-500 to-yellow-500',
      shadow: 'shadow-orange-500/40',
      hoverBg: 'hover:bg-orange-50/50',
      textColor: 'group-hover:text-orange-600',
      line: 'bg-gradient-to-r from-orange-500 to-yellow-500',
      href: '/raw-materials' 
    },
    { 
      name: 'Готовая продукция', 
      description: 'Учет рулонов, фасовка и отгрузка', 
      icon: 'ni-box-2', 
      gradient: 'bg-gradient-to-br from-emerald-500 to-teal-400',
      shadow: 'shadow-emerald-500/40',
      hoverBg: 'hover:bg-emerald-50/50',
      textColor: 'group-hover:text-emerald-600',
      line: 'bg-gradient-to-r from-emerald-500 to-teal-400',
      href: '/products' 
    },
    { 
      name: 'График работы', 
      description: 'Смены, сотрудники и учет рабочего времени', 
      icon: 'ni-calendar-grid-58', 
      gradient: 'bg-gradient-to-br from-red-600 to-rose-400',
      shadow: 'shadow-red-500/40',
      hoverBg: 'hover:bg-red-50/50',
      textColor: 'group-hover:text-red-600',
      line: 'bg-gradient-to-r from-red-600 to-rose-400',
      href: '/schedule' 
    },
    { 
      name: 'Ремонт и ТО', 
      description: 'График обслуживания оборудования и фильтров', 
      icon: 'ni-settings-gear-65', 
      gradient: 'bg-gradient-to-br from-cyan-500 to-blue-500',
      shadow: 'shadow-cyan-500/40',
      hoverBg: 'hover:bg-cyan-50/50',
      textColor: 'group-hover:text-cyan-600',
      line: 'bg-gradient-to-r from-cyan-500 to-blue-500',
      href: '/maintenance' 
    },
    { 
      name: 'Запланированные траты', 
      description: 'Учет и планирование расходов на производство', 
      icon: 'ni-credit-card', 
      gradient: 'bg-gradient-to-br from-indigo-500 to-purple-500',
      shadow: 'shadow-indigo-500/40',
      hoverBg: 'hover:bg-indigo-50/50',
      textColor: 'group-hover:text-indigo-600',
      line: 'bg-gradient-to-r from-indigo-500 to-purple-500',
      href: '/expenses' 
    },
    { 
      name: 'Финансовый отчет', 
      description: 'Аналитика, себестоимость и общие итоги', 
      icon: 'ni-money-coins', 
      gradient: 'bg-gradient-to-br from-slate-700 to-slate-900',
      shadow: 'shadow-slate-500/40',
      hoverBg: 'hover:bg-slate-50/50',
      textColor: 'group-hover:text-slate-800',
      line: 'bg-gradient-to-r from-slate-700 to-slate-900',
      href: '/finance' 
    },
  ];

  return (
    <div className="pt-6 pb-8">
      {/* Верхняя панель со статусом */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8 bg-white/80 backdrop-blur-md p-6 rounded-[2rem] border border-white/20 shadow-xl animate-fade-in">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${isCloudSynced ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-400'}`}>
            <i className={`ni ${isCloudSynced ? 'ni-cloud-upload-96' : 'ni-cloud-download-95'} text-xl animate-pulse`}></i>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black text-slate-800 tracking-tight mb-0">Proizvodstvo</h1>
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isCloudSynced ? 'bg-emerald-500' : 'bg-orange-500'}`}></span>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {isCloudSynced ? 'Данные в облаке' : 'Локальный режим'}
              </span>
            </div>
          </div>
        </div>

        {hasLocalData && !isCloudSynced && (
          <button 
            onClick={syncToCloud}
            disabled={syncStatus === 'syncing'}
            className="group relative flex items-center gap-3 px-6 py-3 bg-slate-800 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-200 active:scale-95 overflow-hidden"
          >
            {syncStatus === 'syncing' ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                Синхронизация...
              </>
            ) : (
              <>
                <i className="ni ni-curved-next text-xs group-hover:translate-x-1 transition-transform"></i>
                Перейти в облако
              </>
            )}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-8">
        {menuItems.map((item, index) => (
          <Link href={item.href} key={index} className="group block outline-none">
            <div className={`relative flex items-center md:flex-col md:text-center gap-4 md:gap-0 bg-white rounded-2xl md:rounded-3xl border border-gray-100 p-4 md:p-8 transition-all hover:shadow-lg ${item.hoverBg}`}>
              
              {/* Блок иконки */}
              <div className={`flex items-center justify-center w-12 h-12 md:w-20 md:h-20 md:mb-6 rounded-xl md:rounded-2xl shrink-0 ${item.gradient} shadow-lg text-white`}>
                <i className={`ni ${item.icon} text-lg md:text-3xl`}></i>
              </div>

              {/* Текстовый блок */}
              <div className="flex-1">
                <h3 className={`text-base md:text-xl font-bold text-slate-800 mb-0 md:mb-3 ${item.textColor}`}>
                  {item.name}
                </h3>
                <p className="text-xs md:text-sm text-slate-500 mb-0 font-medium line-clamp-1 md:line-clamp-none">
                  {item.description}
                </p>
              </div>

              {/* Стрелочка для мобилок */}
              <i className="ni ni-bold-right text-[10px] text-slate-300 md:hidden"></i>

              {/* Декоративная линия (только для десктопа) */}
              <div className={`hidden md:block absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 rounded-t-full ${item.line} group-hover:w-1/2 transition-all duration-500 opacity-80`}></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
