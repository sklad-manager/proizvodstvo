import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GOOGLE_AI_KEY;

async function callGemini(prompt: string, imageBase64?: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;

  const parts: any[] = [{ text: prompt }];
  if (imageBase64) {
    parts.unshift({ inline_data: { mime_type: "image/jpeg", data: imageBase64 } });
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ contents: [{ parts }] })
  });

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  return text;
}

async function sendTelegramMessage(token: string, chatId: string, text: string, replyMarkup?: any) {
  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
      ...(replyMarkup ? { reply_markup: replyMarkup } : {})
    })
  });
}

async function answerCallbackQuery(token: string, callbackId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text })
  });
}

async function editTelegramMessage(token: string, chatId: string, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' })
  });
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;

  if (!token || !allowedChatId) {
    return NextResponse.json({ ok: true });
  }

  const update = await request.json();

  // Обработка нажатий на кнопки (подтверждение/отмена)
  if (update.callback_query) {
    const cb = update.callback_query;
    const data = cb.data;
    const chatId = cb.message.chat.id.toString();
    const messageId = cb.message.message_id;

    if (chatId !== allowedChatId) {
      await answerCallbackQuery(token, cb.id, 'Нет доступа');
      return NextResponse.json({ ok: true });
    }

    if (data.startsWith('confirm_')) {
      const expenseId = data.replace('confirm_', '');
      const client = await db.connect();
      try {
        await client.sql`UPDATE expenses SET is_confirmed = true WHERE id = ${expenseId}`;
        await answerCallbackQuery(token, cb.id, '✅ Записано!');
        await editTelegramMessage(token, chatId, messageId, '✅ Запись подтверждена и добавлена в систему.');
      } finally { client.release(); }
    } else if (data.startsWith('cancel_')) {
      const expenseId = data.replace('cancel_', '');
      const client = await db.connect();
      try {
        await client.sql`DELETE FROM expenses WHERE id = ${expenseId}`;
        await answerCallbackQuery(token, cb.id, '❌ Отменено');
        await editTelegramMessage(token, chatId, messageId, '❌ Запись удалена.');
      } finally { client.release(); }
    }

    return NextResponse.json({ ok: true });
  }

  // Обработка сообщений (текст или фото)
  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id.toString();
  if (chatId !== allowedChatId) {
    await sendTelegramMessage(token, chatId, '⛔ У вас нет доступа к этому боту.');
    return NextResponse.json({ ok: true });
  }

  let userText = message.text || message.caption || '';
  let imageBase64 = '';

  // Если есть фото — скачиваем
  if (message.photo && message.photo.length > 0) {
    const fileId = message.photo[message.photo.length - 1].file_id;
    const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
    const fileData = await fileRes.json();
    const filePath = fileData.result?.file_path;

    if (filePath) {
      const imageRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
      const buffer = await imageRes.arrayBuffer();
      imageBase64 = Buffer.from(buffer).toString('base64');
    }
  }

  if (!userText && !imageBase64) {
    await sendTelegramMessage(token, chatId, 'Отправьте текст или фото чека.');
    return NextResponse.json({ ok: true });
  }

  // Запрос к ИИ
  const prompt = `
Проанализируй ${imageBase64 ? 'это фото чека и текст' : 'этот текст'} и определи финансовую операцию.

Текст пользователя: "${userText}"

Верни ТОЛЬКО JSON без лишнего текста, в формате:
{
  "type": "expense" или "income",
  "amount": число (только число, без валюты),
  "description": "краткое описание",
  "category": одна из: "materials", "maintenance", "salary", "rent", "small", "sales", "other",
  "paymentMethod": "Ф1" или "Ф2" или "ФОП" (если не указано, ставь "Ф1"),
  "status": "paid"
}

Категории:
- materials = Сырье (вискоза, химия, упаковка)
- maintenance = Ремонт и ТО (запчасти, масло, фильтры)
- salary = Зарплаты
- rent = Аренда / ЖКУ (коммунальные, электричество)
- small = Мелкие траты (канцелярия, перчатки, быт)
- sales = Продажа продукции (это ДОХОД, type=income)
- other = Прочее

Если сообщение содержит знак "+" или слова "оплата от", "получили", "продали", "пришло" — это ДОХОД (type=income, category=sales).
Если непонятно, ставь type=expense, category=other.
`;

  try {
    const aiResponse = await callGemini(prompt, imageBase64 || undefined);

    // Извлекаем JSON из ответа
    const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      await sendTelegramMessage(token, chatId, '❌ Не смог распознать операцию. Попробуйте описать иначе.');
      return NextResponse.json({ ok: true });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const expenseId = Date.now().toString();
    const today = new Date().toISOString().split('T')[0];

    // Сохраняем в БД как неподтвержденную
    const client = await db.connect();
    try {
      await client.sql`
        INSERT INTO expenses (id, category, description, amount, date, status, payment_method, type, is_confirmed)
        VALUES (${expenseId}, ${parsed.category || 'other'}, ${parsed.description}, ${parsed.amount}, ${today}, ${parsed.status || 'paid'}, ${parsed.paymentMethod || 'Ф1'}, ${parsed.type || 'expense'}, false)
      `;
    } finally { client.release(); }

    const typeEmoji = parsed.type === 'income' ? '💰' : '📉';
    const typeText = parsed.type === 'income' ? 'ДОХОД' : 'РАСХОД';
    const catNames: Record<string, string> = {
      materials: 'Сырье', maintenance: 'Ремонт и ТО', salary: 'Зарплаты',
      rent: 'Аренда/ЖКУ', small: 'Мелкие траты', sales: 'Продажа', other: 'Прочее'
    };

    const confirmText = `${typeEmoji} <b>${typeText}</b>\n\n` +
      `📝 ${parsed.description}\n` +
      `💵 ${parsed.amount} грн\n` +
      `📂 ${catNames[parsed.category] || parsed.category}\n` +
      `💳 ${parsed.paymentMethod || 'Ф1'}\n\n` +
      `Записать?`;

    await sendTelegramMessage(token, chatId, confirmText, {
      inline_keyboard: [[
        { text: '✅ Подтвердить', callback_data: `confirm_${expenseId}` },
        { text: '❌ Отменить', callback_data: `cancel_${expenseId}` }
      ]]
    });

  } catch (e: any) {
    await sendTelegramMessage(token, chatId, `⚠️ Ошибка обработки: ${e.message}`);
  }

  return NextResponse.json({ ok: true });
}
