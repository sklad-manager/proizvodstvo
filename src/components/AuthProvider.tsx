'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

export type Role = 'admin' | 'observer' | 'operator' | null;

interface AuthContextType {
  role: Role;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({ role: null, logout: () => {} });

export const useAuth = () => useContext(AuthContext);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<Role>(null);
  const [isClient, setIsClient] = useState(false);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    setIsClient(true);
    const saved = localStorage.getItem('app_role') as Role;
    if (saved) setRole(saved);
  }, []);

  useEffect(() => {
    if (role === 'operator' && pathname !== '/expenses') {
       router.push('/expenses');
    }
  }, [role, pathname, router]);

  const login = (e: React.FormEvent) => {
    e.preventDefault();
    let r: Role = null;
    if (pin === '9999') r = 'admin';
    else if (pin === '0000') r = 'observer';
    else if (pin === '1111') r = 'operator';

    if (r) {
      setRole(r);
      localStorage.setItem('app_role', r);
      setError('');
      if (r === 'operator' && pathname !== '/expenses') router.push('/expenses');
    } else {
      setError('Неверный пароль');
      setPin('');
    }
  };

  const logout = () => {
    setRole(null);
    localStorage.removeItem('app_role');
  };

  if (!isClient) return null;

  if (!role) {
    return (
      <div className="fixed inset-0 bg-slate-900 z-[9999] flex items-center justify-center p-4">
        <form onSubmit={login} className="bg-white p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center">
          <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-6">
            🔒
          </div>
          <h1 className="text-2xl font-black text-slate-800 mb-2">Вход в систему</h1>
          <p className="text-slate-500 text-sm mb-6">Введите пароль для доступа</p>
          <input 
            type="password" 
            value={pin} 
            onChange={e => setPin(e.target.value)}
            className="w-full text-center text-3xl tracking-[0.5em] font-black py-4 rounded-xl bg-slate-50 border border-slate-200 outline-none focus:border-blue-500 focus:ring-4 focus:ring-blue-500/20 transition-all mb-4"
            maxLength={4}
            autoFocus
          />
          {error && <div className="text-rose-500 text-sm font-bold mb-4 bg-rose-50 py-2 rounded-lg">{error}</div>}
          <button type="submit" className="w-full bg-blue-500 hover:bg-blue-600 active:scale-95 text-white font-black py-4 rounded-xl transition-all shadow-lg shadow-blue-500/30">
            Войти
          </button>
        </form>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ role, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
