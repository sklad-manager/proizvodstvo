import React from 'react';
import Link from 'next/link';

export default function Home() {
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
      <div className="mb-8 bg-white/90 backdrop-blur-sm rounded-2xl p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-800 mb-2">Добро пожаловать в учет производства</h2>
        <p className="text-slate-500 mb-0">Выберите необходимый модуль для начала работы</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {menuItems.map((item, index) => (
          <Link href={item.href} key={index} className="group block h-full outline-none">
            <div className={`relative flex flex-col items-center text-center h-full bg-white rounded-3xl border border-gray-100 p-8 transition-all duration-500 ease-out hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(0,0,0,0.1)] hover:border-transparent z-10 ${item.hoverBg}`}>
              
              {/* Блок иконки */}
              <div className={`relative flex items-center justify-center w-20 h-20 mb-6 rounded-2xl ${item.gradient} shadow-lg group-hover:scale-110 transition-transform duration-500 ease-out`}>
                <i className={`ni ${item.icon} text-3xl text-white`}></i>
                {/* Мягкая тень под иконкой */}
                <div className={`absolute -bottom-2 w-14 h-4 ${item.gradient} blur-xl opacity-60 group-hover:opacity-100 transition-opacity duration-500`}></div>
              </div>

              {/* Текстовый блок */}
              <div className="relative z-10">
                <h3 className={`mb-3 text-xl font-bold text-slate-800 transition-colors duration-300 ${item.textColor}`}>
                  {item.name}
                </h3>
                <p className="text-sm leading-relaxed text-slate-500 mb-0 font-medium">
                  {item.description}
                </p>
              </div>

              {/* Декоративная линия снизу */}
              <div className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-1 rounded-t-full ${item.line} group-hover:w-1/2 transition-all duration-500 ease-out opacity-80`}></div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
