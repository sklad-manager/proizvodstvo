import React from 'react';

const Footer = () => {
  return (
    <footer className="pt-4">
      <div className="w-full px-6 mx-auto">
        <div className="flex flex-wrap items-center -mx-3 lg:justify-between">
          <div className="w-full max-w-full px-3 mt-0 mb-6 shrink-0 lg:mb-0 lg:w-1/2 lg:flex-none">
            <div className="text-sm leading-normal text-center text-slate-500 lg:text-left">
              © {new Date().getFullYear()}, Proizvodstvo System.
            </div>
          </div>
          <div className="w-full max-w-full px-3 mt-0 shrink-0 lg:w-1/2 lg:flex-none">
            <ul className="flex flex-wrap justify-center pl-0 mb-0 list-none lg:justify-end">
              <li className="nav-item">
                <a href="#" className="block px-4 pt-0 pb-1 text-sm font-normal transition-colors ease-in-out text-slate-500">О системе</a>
              </li>
              <li className="nav-item">
                <a href="#" className="block px-4 pt-0 pb-1 text-sm font-normal transition-colors ease-in-out text-slate-500">Поддержка</a>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
