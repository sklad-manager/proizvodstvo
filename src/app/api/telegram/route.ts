import { db } from '@vercel/postgres';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GOOGLE_AI_KEY;

// Генерация номера чека: ЧЕК-2026-05-12-001
async function generateReceiptNumber(client: any): Promise<string> {
  const now = new Date();
  const year = now.getFullYear();
  const month = (now.getMonth() + 1).toString().padStart(2, '0');
  const day = now.getDate().toString().padStart(2, '0');
  const prefix = `ЧЕК-${year}-${month}`;

  // Считаем чеки в текущем месяце
  const result = await client.sql`
    SELECT COUNT(*) as cnt FROM receipts 
    WHERE receipt_number LIKE ${prefix + '%'}
  `;
  const seq = (parseInt(result.rows[0].cnt) + 1).toString().padStart(3, '0');
  return `ЧЕК-${year}-${month}-${day}-${seq}`;
}

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
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function sendTelegram(token: string, chatId: string, text: string, replyMarkup?: any) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) })
  });
}

async function editTelegram(token: string, chatId: string, messageId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' })
  });
}

async function answerCallback(token: string, callbackId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: callbackId, text })
  });
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !allowedChatId) return NextResponse.json({ ok: true });

  const update = await request.json();

  // === Обработка кнопок ===
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id.toString();
    const messageId = cb.message.message_id;
    if (chatId !== allowedChatId) { await answerCallback(token, cb.id, 'Нет доступа'); return NextResponse.json({ ok: true }); }

    const data = cb.data;
    const client = await db.connect();
    try {
      if (data.startsWith('confirm_receipt_')) {
        const receiptId = data.replace('confirm_receipt_', '');
        // Подтверждаем все записи этого чека
        await client.sql`UPDATE expenses SET is_confirmed = true WHERE receipt_id = ${receiptId}`;
        await answerCallback(token, cb.id, '✅ Чек подтверждён!');
        await editTelegram(token, chatId, messageId, '✅ Чек подтверждён и записан в систему.');
      } else if (data.startsWith('cancel_receipt_')) {
        const receiptId = data.replace('cancel_receipt_', '');
        await client.sql`DELETE FROM expenses WHERE receipt_id = ${receiptId}`;
        await client.sql`DELETE FROM receipts WHERE id = ${receiptId}`;
        await answerCallback(token, cb.id, '❌ Чек удалён');
        await editTelegram(token, chatId, messageId, '❌ Чек удалён.');
      } else if (data.startsWith('confirm_')) {
        const expenseId = data.replace('confirm_', '');
        await client.sql`UPDATE expenses SET is_confirmed = true WHERE id = ${expenseId}`;
        await answerCallback(token, cb.id, '✅ Записано!');
        await editTelegram(token, chatId, messageId, '✅ Запись подтверждена.');
      } else if (data.startsWith('cancel_')) {
        const expenseId = data.replace('cancel_', '');
        await client.sql`DELETE FROM expenses WHERE id = ${expenseId}`;
        await answerCallback(token, cb.id, '❌ Отменено');
        await editTelegram(token, chatId, messageId, '❌ Запись удалена.');
      }
    } finally { client.release(); }
    return NextResponse.json({ ok: true });
  }

  // === Обработка сообщений ===
  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id.toString();
  if (chatId !== allowedChatId) {
    await sendTelegram(token, chatId, '⛔ У вас нет доступа.');
    return NextResponse.json({ ok: true });
  }

  let userText = message.text || message.caption || '';
  let imageBase64 = '';
  let hasPhoto = false;

  // Скачиваем фото если есть
  if (message.photo && message.photo.length > 0) {
    hasPhoto = true;
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
    await sendTelegram(token, chatId, 'Отправьте текст или фото чека.');
    return NextResponse.json({ ok: true });
  }

  // === ФОТО ЧЕКА — мульти-позиционный разбор ===
  if (hasPhoto && imageBase64) {
    const prompt = `
Проанализируй фото чека. Определи ВСЕ позиции (товары/услуги) в чеке.

${userText ? `Комментарий пользователя: "${userText}"` : ''}

Верни ТОЛЬКО JSON-массив без лишнего текста:
[
  {
    "description": "название товара/услуги",
    "amount": число (цена),
    "category": одна из: "materials", "maintenance", "salary", "rent", "small", "sales", "other",
    "paymentMethod": "Ф1" или "Ф2" или "ФОП"
  }
]

Категории:
- materials = Сырье (вискоза, химия, упаковка)
- maintenance = Ремонт и ТО (запчасти, масло, инструмент)
- salary = Зарплаты
- rent = Аренда / ЖКУ
- small = Мелкие траты (канцелярия, перчатки, быт, продукты)
- other = Прочее

Если в комментарии указана форма оплаты (Ф1, Ф2, ФОП), используй её для всех позиций.
Если не указана — ставь "Ф1".
Если не можешь разобрать текст на чеке, верни хотя бы общую сумму как одну позицию.
`;

    try {
      const aiResponse = await callGemini(prompt, imageBase64);
      const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (!jsonMatch) {
        await sendTelegram(token, chatId, '❌ Не смог распознать чек. Попробуйте сфоткать ближе или описать текстом.');
        return NextResponse.json({ ok: true });
      }

      const items = JSON.parse(jsonMatch[0]);
      if (!Array.isArray(items) || items.length === 0) {
        await sendTelegram(token, chatId, '❌ Не нашёл позиций в чеке.');
        return NextResponse.json({ ok: true });
      }

      const client = await db.connect();
      try {
        // Генерируем номер чека
        const receiptNumber = await generateReceiptNumber(client);
        const receiptId = Date.now().toString();
        const today = new Date().toISOString().split('T')[0];
        const totalAmount = items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);

        // Сохраняем фото в Vercel Blob
        const photoBuffer = Buffer.from(imageBase64, 'base64');
        const blob = await put(`receipts/${receiptNumber}.jpg`, photoBuffer, {
          access: 'public',
          contentType: 'image/jpeg'
        });

        // Сохраняем чек
        await client.sql`
          INSERT INTO receipts (id, receipt_number, photo_url, total_amount, items_count, date)
          VALUES (${receiptId}, ${receiptNumber}, ${blob.url}, ${totalAmount}, ${items.length}, ${today})
        `;

        // Сохраняем все позиции
        const catNames: Record<string, string> = {
          materials: 'Сырье', maintenance: 'Ремонт и ТО', salary: 'Зарплаты',
          rent: 'Аренда/ЖКУ', small: 'Мелкие траты', sales: 'Продажа', other: 'Прочее'
        };

        let itemsList = '';
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const expId = `${receiptId}_${i}`;
          await client.sql`
            INSERT INTO expenses (id, category, description, amount, date, status, payment_method, type, is_confirmed, receipt_id)
            VALUES (${expId}, ${item.category || 'other'}, ${item.description}, ${item.amount}, ${today}, 'paid', ${item.paymentMethod || 'Ф1'}, 'expense', false, ${receiptId})
          `;
          itemsList += `  ${i + 1}. ${item.description} — ${item.amount} грн (${catNames[item.category] || 'Прочее'})\n`;
        }

        const confirmText =
          `🧾 <b>${receiptNumber}</b>\n` +
          `📸 Фото сохранено\n\n` +
          `Найдено позиций: <b>${items.length}</b>\n` +
          `Общая сумма: <b>${totalAmount} грн</b>\n` +
          `Форма: <b>${items[0]?.paymentMethod || 'Ф1'}</b>\n\n` +
          `${itemsList}\n` +
          `Подтвердить?`;

        await sendTelegram(token, chatId, confirmText, {
          inline_keyboard: [[
            { text: '✅ Подтвердить всё', callback_data: `confirm_receipt_${receiptId}` },
            { text: '❌ Отменить', callback_data: `cancel_receipt_${receiptId}` }
          ]]
        });

      } finally { client.release(); }

    } catch (e: any) {
      await sendTelegram(token, chatId, `⚠️ Ошибка: ${e.message}`);
    }

    return NextResponse.json({ ok: true });
  }

  // === ТЕКСТОВОЕ СООБЩЕНИЕ — одна операция ===
  const prompt = `
Проанализируй этот текст и определи финансовую операцию.
Текст: "${userText}"

Верни ТОЛЬКО JSON:
{
  "type": "expense" или "income",
  "amount": число,
  "description": "описание",
  "category": одна из: "materials", "maintenance", "salary", "rent", "small", "sales", "other",
  "paymentMethod": "Ф1" или "Ф2" или "ФОП"
}

Если "+" или "оплата от", "получили", "продали" — это income (type=income).
`;

  try {
    const aiResponse = await callGemini(prompt);
    const jsonMatch = aiResponse.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) {
      await sendTelegram(token, chatId, '❌ Не смог распознать. Попробуйте иначе.');
      return NextResponse.json({ ok: true });
    }

    const parsed = JSON.parse(jsonMatch[0]);
    const expenseId = Date.now().toString();
    const today = new Date().toISOString().split('T')[0];

    const client = await db.connect();
    try {
      await client.sql`
        INSERT INTO expenses (id, category, description, amount, date, status, payment_method, type, is_confirmed)
        VALUES (${expenseId}, ${parsed.category || 'other'}, ${parsed.description}, ${parsed.amount}, ${today}, 'paid', ${parsed.paymentMethod || 'Ф1'}, ${parsed.type || 'expense'}, false)
      `;
    } finally { client.release(); }

    const catNames: Record<string, string> = {
      materials: 'Сырье', maintenance: 'Ремонт и ТО', salary: 'Зарплаты',
      rent: 'Аренда/ЖКУ', small: 'Мелкие траты', sales: 'Продажа', other: 'Прочее'
    };
    const typeEmoji = parsed.type === 'income' ? '💰' : '📉';
    const typeText = parsed.type === 'income' ? 'ДОХОД' : 'РАСХОД';

    await sendTelegram(token, chatId,
      `${typeEmoji} <b>${typeText}</b>\n\n📝 ${parsed.description}\n💵 ${parsed.amount} грн\n📂 ${catNames[parsed.category] || 'Прочее'}\n💳 ${parsed.paymentMethod || 'Ф1'}\n\nЗаписать?`,
      { inline_keyboard: [[ { text: '✅ Подтвердить', callback_data: `confirm_${expenseId}` }, { text: '❌ Отменить', callback_data: `cancel_${expenseId}` } ]] }
    );
  } catch (e: any) {
    await sendTelegram(token, chatId, `⚠️ Ошибка: ${e.message}`);
  }

  return NextResponse.json({ ok: true });
}
