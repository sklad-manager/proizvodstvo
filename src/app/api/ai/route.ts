import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
  const apiKey = process.env.GOOGLE_AI_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "API ключ не настроен" }, { status: 500 });
  }

  const { message, history } = await request.json();

  // 1. Полный сбор данных из всех таблиц
  const client = await db.connect();
  let contextText = "";
  try {
    // Склад: категории
    const categories = await client.sql`SELECT * FROM raw_materials_categories`;
    // Склад: все тюки (активные и списанные)
    const bales = await client.sql`SELECT b.*, c.name as category_name FROM raw_materials_bales b LEFT JOIN raw_materials_categories c ON b.category_id = c.id ORDER BY b.received_date DESC`;
    // Сотрудники
    const employees = await client.sql`SELECT * FROM employees`;
    // Посещаемость (последние 60 дней)
    const attendance = await client.sql`SELECT a.*, e.name as employee_name FROM attendance a LEFT JOIN employees e ON a.employee_id = e.id WHERE a.date >= CURRENT_DATE - INTERVAL '60 days' ORDER BY a.date DESC`;
    // Все расходы
    const expenses = await client.sql`SELECT * FROM expenses ORDER BY date DESC`;

    // Формируем детальный отчет по складу
    const activeBales = bales.rows.filter(b => !b.is_consumed);
    const consumedBales = bales.rows.filter(b => b.is_consumed);
    const totalWeight = activeBales.reduce((sum, b) => sum + Number(b.weight || 0), 0);

    const categoryDetails = categories.rows.map(cat => {
      const catBales = activeBales.filter(b => b.category_id === cat.id);
      const catWeight = catBales.reduce((sum, b) => sum + Number(b.weight || 0), 0);
      return `  - "${cat.name}": ${catBales.length} тюков, общий вес ${catWeight} кг`;
    }).join('\n');

    // Формируем отчет по сотрудникам
    const employeeDetails = employees.rows.map(emp => {
      const empAtt = attendance.rows.filter(a => a.employee_id === emp.id);
      return `  - ${emp.name} (${emp.is_active ? 'активен' : 'в архиве'}): ${empAtt.length} смен за 60 дней`;
    }).join('\n');

    // Формируем отчет по расходам
    const plannedExpenses = expenses.rows.filter(e => e.status === 'planned');
    const paidExpenses = expenses.rows.filter(e => e.status === 'paid');
    const totalPlanned = plannedExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const totalPaid = paidExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);

    const expenseDetails = expenses.rows.slice(0, 30).map(e => {
      return `  - [${e.status === 'paid' ? 'ОПЛАЧЕНО' : 'ПЛАН'}] ${e.description}: ${e.amount} грн (${e.category}, ${e.payment_method || 'Ф1'}, ${e.date})`;
    }).join('\n');

    contextText = `
Ты - интеллектуальный помощник производства "Proizvodstvo MES". 
Ты видишь ВСЕ актуальные данные системы в реальном времени. Отвечай кратко и профессионально.

=== СКЛАД СЫРЬЯ ===
Всего категорий: ${categories.rowCount}
Активных тюков на складе: ${activeBales.length} (общий вес: ${totalWeight} кг)
Списано тюков: ${consumedBales.length}
Детали по категориям:
${categoryDetails || '  Пусто'}

=== ПЕРСОНАЛ ===
Всего сотрудников: ${employees.rowCount}
Активных: ${employees.rows.filter(e => e.is_active).length}
В архиве: ${employees.rows.filter(e => !e.is_active).length}
Детали:
${employeeDetails || '  Нет сотрудников'}

=== ФИНАНСЫ (РАСХОДЫ) ===
Всего записей: ${expenses.rowCount}
Запланировано к оплате: ${totalPlanned} грн (${plannedExpenses.length} позиций)
Уже оплачено: ${totalPaid} грн (${paidExpenses.length} позиций)
Последние записи:
${expenseDetails || '  Нет трат'}

=== ИНСТРУКЦИИ ===
- Отвечай на русском или украинском языке
- Если спрашивают про конкретного сотрудника или категорию, ищи по имени в данных выше
- Можешь считать статистику, делать прогнозы, давать рекомендации
- Если данных для ответа недостаточно, скажи прямо
    `;
  } catch (e) {
    console.error("Ошибка сбора контекста:", e);
    contextText = "Ты помощник производства. База данных временно недоступна, но ты можешь отвечать на общие вопросы управления.";
  } finally {
    client.release();
  }

  // 2. Запрос к Google Gemini API
  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      { role: "user", parts: [{ text: contextText }] },
      { role: "model", parts: [{ text: "Принято. У меня полный доступ к данным. Готов помогать." }] },
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
      return NextResponse.json({ error: `${data.error.message}` }, { status: 500 });
    }

    const aiText = data.candidates?.[0]?.content?.parts?.[0]?.text || "Извините, не смог сформировать ответ.";
    return NextResponse.json({ text: aiText });

  } catch (error: any) {
    return NextResponse.json({ error: `Ошибка связи: ${error.message}` }, { status: 500 });
  }
}
