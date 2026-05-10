import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const apiKey = "AIzaSyDbek424VzJtKSoXvp3IJ4Jvp8R29y54HQ";
  const { message, history } = await request.json();

  // 1. Сбор контекста из БД
  const client = await db.connect();
  let contextText = "";
  try {
    const materials = await client.sql`SELECT * FROM raw_materials_categories`;
    const bales = await client.sql`SELECT * FROM raw_materials_bales WHERE is_consumed = false`;
    const employees = await client.sql`SELECT * FROM employees`;
    const expenses = await client.sql`SELECT * FROM expenses ORDER BY date DESC LIMIT 20`;

    contextText = `
      Ты - интеллектуальный помощник "Proizvodstvo MES". 
      Твои данные:
      - Склад: ${materials.rowCount} категорий, ${bales.rowCount} активных тюков.
      - Люди: ${employees.rowCount} сотрудников в базе.
      - Траты: Последние записи включают ${expenses.rows.slice(0,5).map(e => `${e.description} (${e.amount} грн)`).join(', ')}.
      
      Отвечай кратко и профессионально на русском или украинском языке.
    `;
  } catch (e) {
    contextText = "Ты помощник производства. Помогай с вопросами управления.";
  } finally {
    client.release();
  }

  // 2. Прямой запрос к Google API (версия v1)
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      { role: "user", parts: [{ text: contextText }] },
      { role: "model", parts: [{ text: "Принято. Я готов помогать." }] },
      ...history.map((h: any) => ({
        role: h.role === 'model' ? 'model' : 'user',
        parts: h.parts
      })),
      { role: "user", parts: [{ text: message }] }
    ]
  };

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (data.error) {
      return NextResponse.json({ error: `Google API Error: ${data.error.message}` }, { status: 500 });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Извините, я не смог сформировать ответ.";
    return NextResponse.json({ text: aiText });

  } catch (error: any) {
    return NextResponse.json({ error: `Fetch Error: ${error.message}` }, { status: 500 });
  }
}
