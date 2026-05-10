import React from 'react';
import Link from 'next/link';

const Sidebar = () => {
  const menuItems = [
    { name: 'Обзор (Dashboard)', icon: 'ni-tv-2', color: 'text-blue-500', href: '/' },
    { name: 'Учет сырья', icon: 'ni-collection', color: 'text-orange-500', href: '/raw-materials' },
    { name: 'Готовая продукция', icon: 'ni-box-2', color: 'text-emerald-500', href: '/products' },
    { name: 'График работы', icon: 'ni-calendar-grid-58', color: 'text-red-600', href: '/schedule' },
    { name: 'Ремонт и ТО', icon: 'ni-settings-gear-65', color: 'text-cyan-500', href: '/maintenance' },
    { name: 'Запланированные траты', icon: 'ni-credit-card', color: 'text-blue-500', href: '/expenses' },
    { name: 'Финансовый отчет', icon: 'ni-money-coins', color: 'text-emerald-500', href: '/finance' },
  ];

  return (
    <aside className="fixed inset-y-0 flex-wrap items-center justify-between block w-full p-0 my-4 overflow-y-auto antialiased transition-transform duration-200 -translate-x-full bg-white border-0 shadow-xl max-w-64 ease-nav-brand z-990 xl:ml-6 rounded-2xl xl:left-0 xl:translate-x-0" aria-expanded="false">
      <div className="h-19">
        <i className="absolute top-0 right-0 p-4 opacity-50 cursor-pointer fas fa-times text-slate-400 xl:hidden" sidenav-close="true"></i>
        <Link className="block px-8 py-6 m-0 text-sm whitespace-nowrap text-slate-700" href="/">
          <img src="/assets/img/logo-ct-dark.png" className="inline h-full max-w-full transition-all duration-200 ease-nav-brand max-h-8" alt="main_logo" />
          <span className="ml-1 font-semibold transition-all duration-200 ease-nav-brand">Sklad MES</span>
        </Link>
      </div>

      <hr className="h-px mt-0 bg-transparent bg-gradient-to-r from-transparent via-black/40 to-transparent" />

      <div className="items-center block w-auto max-h-screen overflow-auto h-sidenav grow basis-full">
        <ul className="flex flex-col pl-0 mb-0">
          {menuItems.map((item) => (
            <li key={item.href} className="mt-0.5 w-full">
              <Link
                className="py-2.7 text-sm ease-nav-brand my-0 mx-2 flex items-center whitespace-nowrap px-4 transition-colors hover:bg-blue-500/10 rounded-lg"
                href={item.href}
              >
                <div className={`mr-2 flex h-8 w-8 items-center justify-center rounded-lg bg-center stroke-0 text-center xl:p-2.5`}>
                  <i className={`relative top-0 text-sm leading-normal ${item.color} ni ${item.icon}`}></i>
                </div>
                <span className="ml-1 duration-300 opacity-100 pointer-events-none ease">{item.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-4 mt-10">
        <div className="relative flex flex-col min-w-0 break-words bg-transparent border-0 shadow-none rounded-2xl bg-clip-border">
          <img className="w-1/2 mx-auto" src="/assets/img/illustrations/icon-documentation.svg" alt="sidebar illustrations" />
          <div className="flex-auto w-full p-4 pt-0 text-center">
            <h6 className="mb-0 text-slate-700">Нужна помощь?</h6>
            <p className="mb-0 text-xs font-semibold leading-tight">Свяжитесь с техподдержкой</p>
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
