'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';

interface Message {
  role: 'user' | 'model';
  text: string;
}

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    { role: 'model', text: 'Привет! Я ваш ИИ-помощник Proizvodstvo. Я вижу ваши данные по складу, кадрам и финансам. Чем могу помочь сегодня?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMessage }]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMessage,
          history: messages.map(m => ({
            role: m.role,
            parts: [{ text: m.text }]
          }))
        })
      });

      const data = await res.json();
      if (data.text) {
        setMessages(prev => [...prev, { role: 'model', text: data.text }]);
      } else if (data.error) {
        setMessages(prev => [...prev, { role: 'model', text: `⚠️ Ошибка: ${data.error}` }]);
      }
    } catch (e) {
      setMessages(prev => [...prev, { role: 'model', text: '❌ Не удалось связаться с ИИ. Проверьте настройки ключа.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-120px)] max-w-4xl mx-auto bg-white rounded-[2.5rem] shadow-2xl border border-gray-100 overflow-hidden animate-slide-up">
      {/* Шапка чата */}
      <div className="p-6 bg-slate-800 text-white flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-purple-500/20">
            <i className="ni ni-bulb-61 text-2xl"></i>
          </div>
          <div>
            <h2 className="text-xl font-black mb-0 tracking-tight">ИИ Помощник</h2>
            <div className="flex items-center gap-1.5 text-[9px] font-black uppercase text-emerald-400 tracking-widest">
              <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse"></span>
              Online / Gemini 1.5
            </div>
          </div>
        </div>
        <Link href="/" className="px-4 py-2 bg-white/10 rounded-xl text-xs font-bold hover:bg-white/20 transition-all">Закрыть</Link>
      </div>

      {/* Окно сообщений */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 bg-slate-50/30">
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-4 rounded-[1.5rem] shadow-sm text-sm font-medium leading-relaxed
              ${m.role === 'user' 
                ? 'bg-slate-800 text-white rounded-tr-none' 
                : 'bg-white text-slate-700 border border-gray-100 rounded-tl-none'}
            `}>
              {m.text}
            </div>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white p-4 rounded-[1.5rem] rounded-tl-none border border-gray-100 shadow-sm flex gap-1">
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]"></div>
              <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]"></div>
            </div>
          </div>
        )}
      </div>

      {/* Поле ввода */}
      <div className="p-6 bg-white border-t border-gray-50 flex gap-3 shrink-0">
        <input 
          type="text" 
          placeholder="Спросите что-нибудь о производстве..." 
          className="flex-1 px-6 py-4 rounded-2xl bg-slate-50 border-none outline-none focus:ring-2 ring-purple-500/20 font-medium text-sm transition-all"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
        />
        <button 
          onClick={sendMessage}
          disabled={isLoading}
          className="w-14 h-14 rounded-2xl bg-slate-800 text-white flex items-center justify-center hover:bg-black transition-all shadow-lg active:scale-95 disabled:opacity-50"
        >
          <i className="ni ni-send text-xl"></i>
        </button>
      </div>

      <style jsx>{`
        @keyframes slide-up { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
        .animate-slide-up { animation: slide-up 0.5s cubic-bezier(0.16, 1, 0.3, 1); }
      `}</style>
    </div>
  );
}
