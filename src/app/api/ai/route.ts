import { GoogleGenerativeAI } from "@google/generative-ai";
import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const apiKey = "AIzaSyDbek424VzJtKSoXvp3IJ4Jvp8R29y54HQ"; // Ключ исправлен
  if (!apiKey) {
    return NextResponse.json({ error: "API Ключ не настроен. Пожалуйста, добавьте GOOGLE_AI_KEY в Vercel." }, { status: 500 });
  }

  const { message, history } = await request.json();

  // 1. Собираем данные из базы для контекста ИИ
  const client = await db.connect();
  let context = "";
  try {
    const materials = await client.sql`SELECT * FROM raw_materials_categories`;
    const bales = await client.sql`SELECT * FROM raw_materials_bales WHERE is_consumed = false`;
    const employees = await client.sql`SELECT * FROM employees`;
    const expenses = await client.sql`SELECT * FROM expenses ORDER BY date DESC LIMIT 20`;

    context = `
      Ты - интеллектуальный помощник производства "Proizvodstvo MES". 
      У тебя есть доступ к актуальным данным системы:
      - Склад: ${materials.rowCount} категорий сырья. Активных тюков на складе: ${bales.rowCount}.
      - Персонал: В базе ${employees.rowCount} сотрудников.
      - Финансы: Последние 20 записей о тратах включают категории: ${Array.from(new Set(expenses.rows.map(r => r.category))).join(', ')}.
      
      Отвечай кратко, профессионально и по делу. Если пользователь спрашивает о данных, которых нет в этом кратком отчете, скажи, что тебе нужно время на глубокий анализ.
      Используй данные для ответов на вопросы о производстве.
    `;
  } catch (e) {
    console.error("Ошибка сбора контекста", e);
    context = "Ты помощник производства. Данные базы временно недоступны.";
  } finally {
    client.release();
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: "gemini-pro" });

  try {
    const chat = model.startChat({
      history: [
        { role: "user", parts: [{ text: context }] },
        { role: "model", parts: [{ text: "Принято. Я готов помогать с управлением производством Proizvodstvo MES." }] },
        ...history
      ],
    });

    const result = await chat.sendMessage(message);
    const response = await result.response;
    return NextResponse.json({ text: response.text() });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
