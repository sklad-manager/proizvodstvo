import React from 'react';

const Navbar = ({ title }: { title: string }) => {
  return (
    <nav className="relative flex flex-wrap items-center justify-between px-0 py-2 mx-6 transition-all ease-in shadow-none duration-250 rounded-2xl lg:flex-nowrap lg:justify-start" navbar-main="true" navbar-scroll="false">
      <div className="flex items-center justify-between w-full px-4 py-1 mx-auto flex-wrap-inherit">
        <nav>
          <ol className="flex flex-wrap pt-1 mr-12 bg-transparent rounded-lg sm:mr-16">
            <li className="text-sm leading-normal">
              <a className="text-white opacity-50" href="#">Страницы</a>
            </li>
            <li className="text-sm pl-2 capitalize leading-normal text-white before:float-left before:pr-2 before:text-white before:content-['/']" aria-current="page">
              {title}
            </li>
          </ol>
          <h6 className="mb-0 font-bold text-white capitalize">{title}</h6>
        </nav>

        <div className="flex items-center mt-2 grow sm:mt-0 sm:mr-6 md:mr-0 lg:flex lg:basis-auto">
          <div className="flex items-center md:ml-auto md:pr-4">
            <div className="relative flex flex-wrap items-stretch w-full transition-all rounded-lg ease">
              <span className="text-sm ease leading-5.6 absolute z-50 -ml-px flex h-full items-center whitespace-nowrap rounded-lg rounded-tr-none rounded-br-none border border-r-0 border-transparent bg-transparent py-2 px-2.5 text-center font-normal text-slate-500 transition-all">
                <i className="fas fa-search"></i>
              </span>
              <input type="text" className="pl-9 text-sm focus:shadow-primary-outline ease w-1/100 leading-5.6 relative -ml-px block min-w-0 flex-auto rounded-lg border border-solid border-gray-300 bg-white bg-clip-padding py-2 pr-3 text-gray-700 transition-all placeholder:text-gray-500 focus:border-blue-500 focus:outline-none focus:transition-shadow" placeholder="Поиск..." />
            </div>
          </div>
          <ul className="flex flex-row justify-end pl-0 mb-0 list-none md-max:w-full">
            <li className="flex items-center">
              <a href="#" className="block px-0 py-2 text-sm font-semibold text-white transition-all ease-nav-brand">
                <i className="fa fa-user sm:mr-1"></i>
                <span className="hidden sm:inline">Войти</span>
              </a>
            </li>
            <li className="flex items-center pl-4 xl:hidden">
              <a href="#" className="block p-0 text-sm text-white transition-all ease-nav-brand" sidenav-trigger="true">
                <div className="w-4.5 overflow-hidden">
                  <i className="ease mb-0.75 relative block h-0.5 rounded-sm bg-white transition-all"></i>
                  <i className="ease mb-0.75 relative block h-0.5 rounded-sm bg-white transition-all"></i>
                  <i className="ease relative block h-0.5 rounded-sm bg-white transition-all"></i>
                </div>
              </a>
            </li>
            <li className="flex items-center px-4">
              <a href="#" className="p-0 text-sm text-white transition-all ease-nav-brand">
                <i className="cursor-pointer fa fa-cog"></i>
              </a>
            </li>
            <li className="relative flex items-center pr-2">
              <a href="#" className="block p-0 text-sm text-white transition-all ease-nav-brand">
                <i className="cursor-pointer fa fa-bell"></i>
              </a>
            </li>
          </ul>
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
