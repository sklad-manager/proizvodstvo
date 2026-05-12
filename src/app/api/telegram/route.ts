import { db } from '@vercel/postgres';
import { put } from '@vercel/blob';
import { NextResponse } from 'next/server';

const GEMINI_KEY = process.env.GOOGLE_AI_KEY;

// Генерация номера чека: ЧЕК-2026-05-12-NNN
async function generateReceiptNumber(client: any, manualNum?: number): Promise<string> {
  const now = new Date();
  const y = now.getFullYear();
  const m = (now.getMonth() + 1).toString().padStart(2, '0');
  const d = now.getDate().toString().padStart(2, '0');

  if (manualNum) {
    return `ЧЕК-${y}-${m}-${d}-${manualNum.toString().padStart(3, '0')}`;
  }

  // Берём максимальный номер за месяц, чтобы не было коллизий
  const prefix = `ЧЕК-${y}-${m}`;
  const result = await client.sql`SELECT receipt_number FROM receipts WHERE receipt_number LIKE ${prefix + '%'} ORDER BY receipt_number DESC LIMIT 1`;
  let seq = 1;
  if (result.rows.length > 0) {
    const last = result.rows[0].receipt_number;
    const lastNum = parseInt(last.split('-').pop() || '0');
    seq = lastNum + 1;
  }
  return `ЧЕК-${y}-${m}-${d}-${seq.toString().padStart(3, '0')}`;
}

// Проверка существования номера чека
async function receiptNumberExists(client: any, num: string): Promise<boolean> {
  const r = await client.sql`SELECT id FROM receipts WHERE receipt_number = ${num}`;
  return (r.rowCount ?? 0) > 0;
}

async function callGemini(prompt: string, imageBase64?: string) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`;
  const parts: any[] = [{ text: prompt }];
  if (imageBase64) parts.unshift({ inline_data: { mime_type: "image/jpeg", data: imageBase64 } });
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts }] }) });
  const data = await res.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || '';
}

async function sendTg(token: string, chatId: string, text: string, markup?: any) {
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', ...(markup ? { reply_markup: markup } : {}) })
  });
}

async function editTg(token: string, chatId: string, msgId: number, text: string, markup?: any) {
  await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, message_id: msgId, text, parse_mode: 'HTML', ...(markup ? { reply_markup: markup } : {}) })
  });
}

async function answerCb(token: string, cbId: string, text: string) {
  await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ callback_query_id: cbId, text })
  });
}

// Скачать фото и загрузить в Blob
async function downloadAndUploadPhoto(token: string, fileId: string, receiptNumber: string): Promise<{ base64: string; blobUrl: string }> {
  const fileRes = await fetch(`https://api.telegram.org/bot${token}/getFile?file_id=${fileId}`);
  const fileData = await fileRes.json();
  const filePath = fileData.result?.file_path;
  if (!filePath) throw new Error('Не удалось получить файл');

  const imageRes = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);
  const buffer = await imageRes.arrayBuffer();
  const base64 = Buffer.from(buffer).toString('base64');

  const blob = await put(`receipts/${receiptNumber}.jpg`, Buffer.from(buffer), { access: 'public', contentType: 'image/jpeg' });
  return { base64, blobUrl: blob.url };
}

export async function POST(request: Request) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const allowedChatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !allowedChatId) return NextResponse.json({ ok: true });

  const update = await request.json();

  // === КНОПКИ ===
  if (update.callback_query) {
    const cb = update.callback_query;
    const chatId = cb.message.chat.id.toString();
    const msgId = cb.message.message_id;
    if (chatId !== allowedChatId) { await answerCb(token, cb.id, 'Нет доступа'); return NextResponse.json({ ok: true }); }

    const data = cb.data;
    const client = await db.connect();
    try {
      // --- Подтвердить чек ---
      if (data.startsWith('confirm_receipt_')) {
        const rid = data.replace('confirm_receipt_', '');
        await client.sql`UPDATE expenses SET is_confirmed = true WHERE receipt_id = ${rid}`;
        await answerCb(token, cb.id, '✅ Подтверждено');
        await editTg(token, chatId, msgId, '✅ Чек подтверждён и записан.');

      // --- Отменить чек ---
      } else if (data.startsWith('cancel_receipt_')) {
        const rid = data.replace('cancel_receipt_', '');
        await client.sql`DELETE FROM expenses WHERE receipt_id = ${rid}`;
        await client.sql`DELETE FROM receipts WHERE id = ${rid}`;
        await answerCb(token, cb.id, '❌ Удалено');
        await editTg(token, chatId, msgId, '❌ Чек удалён.');

      // --- Анализ ИИ ---
      } else if (data.startsWith('analyze_')) {
        const rid = data.replace('analyze_', '');
        await answerCb(token, cb.id, '🤖 Анализирую...');
        await editTg(token, chatId, msgId, '🤖 Анализирую чек...');

        // Получаем данные чека
        const receiptRow = await client.sql`SELECT * FROM receipts WHERE id = ${rid}`;
        if (receiptRow.rowCount === 0) { await editTg(token, chatId, msgId, '❌ Чек не найден.'); return NextResponse.json({ ok: true }); }
        const receipt = receiptRow.rows[0];

        // Скачиваем фото из Blob и отправляем в Gemini
        const photoRes = await fetch(receipt.photo_url);
        const photoBuffer = await photoRes.arrayBuffer();
        const base64 = Buffer.from(photoBuffer).toString('base64');

        const prompt = `
Ты — бухгалтер. Проанализируй фото кассового чека. 

ВАЖНЫЕ ПРАВИЛА:
1. Для каждого товара бери ИТОГОВУЮ ЦЕНУ (после умножения количества на цену за единицу). Если написано "2 x 45.00 = 90.00", amount = 90.
2. Сумма всех amount ДОЛЖНА совпадать со строкой ИТОГО/ВСЕГО/СУМА на чеке.
3. Если видишь строку "ИТОГО: 150.00", проверь что сумма всех позиций = 150.
4. НЕ путай цену за единицу с итоговой ценой за позицию.
5. Если на фото есть обведённая в кружок цифра от руки — это номер чека (receiptNum).

Верни ТОЛЬКО JSON без markdown:
{
  "receiptNum": число или null,
  "items": [
    { "description": "точное название товара", "amount": итоговая цена позиции (число), "category": "...", "paymentMethod": "Ф1" }
  ]
}

Категории: materials (сырье, вискоза, химия), maintenance (ремонт, запчасти, масло, инструмент), salary (зарплаты), rent (аренда, ЖКУ, коммуналка), small (перчатки, маски, канцелярия, продукты, бытовое), other (всё остальное).
`;

        const aiText = await callGemini(prompt, base64);
        const jsonMatch = aiText.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { await editTg(token, chatId, msgId, '❌ Не удалось распознать чек.'); return NextResponse.json({ ok: true }); }

        const parsed = JSON.parse(jsonMatch[0]);
        const items = parsed.items || [];
        if (items.length === 0) { await editTg(token, chatId, msgId, '❌ Позиций не найдено.'); return NextResponse.json({ ok: true }); }

        // Обновляем номер чека, если ИИ нашёл цифру
        let receiptNumber = receipt.receipt_number;
        if (parsed.receiptNum) {
          const newNum = await generateReceiptNumber(client, parsed.receiptNum);
          if (await receiptNumberExists(client, newNum)) {
            await editTg(token, chatId, msgId, `⚠️ Внимание! Чек с номером <b>${newNum}</b> уже существует в базе.\nПроверьте — возможно этот чек уже был добавлен.`);
            return NextResponse.json({ ok: true });
          }
          receiptNumber = newNum;
          await client.sql`UPDATE receipts SET receipt_number = ${receiptNumber} WHERE id = ${rid}`;
        }

        const totalAmount = items.reduce((s: number, i: any) => s + (Number(i.amount) || 0), 0);
        await client.sql`UPDATE receipts SET total_amount = ${totalAmount}, items_count = ${items.length} WHERE id = ${rid}`;

        const catNames: Record<string, string> = { materials: 'Сырье', maintenance: 'Ремонт', salary: 'Зарплаты', rent: 'Аренда', small: 'Мелкие траты', other: 'Прочее' };
        let itemsList = '';
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const expId = `${rid}_${i}`;
          await client.sql`
            INSERT INTO expenses (id, category, description, amount, date, status, payment_method, type, is_confirmed, receipt_id)
            VALUES (${expId}, ${item.category || 'other'}, ${item.description}, ${item.amount}, ${receipt.date}, 'paid', ${item.paymentMethod || 'Ф1'}, 'expense', false, ${rid})
          `;
          itemsList += `  ${i + 1}. ${item.description} — ${item.amount} грн\n`;
        }

        await editTg(token, chatId, msgId,
          `🧾 <b>${receiptNumber}</b>\n\nПозиций: <b>${items.length}</b>\nСумма: <b>${totalAmount} грн</b>\n\n${itemsList}\nПодтвердить?`,
          { inline_keyboard: [[ { text: '✅ Подтвердить', callback_data: `confirm_receipt_${rid}` }, { text: '❌ Отменить', callback_data: `cancel_receipt_${rid}` } ]] }
        );

      // --- Ручной ввод (без анализа) ---
      } else if (data.startsWith('manual_')) {
        const rid = data.replace('manual_', '');
        // Помечаем чек как ожидающий ручного ввода суммы
        await client.sql`UPDATE receipts SET items_count = -1 WHERE id = ${rid}`;
        await answerCb(token, cb.id, '');
        await editTg(token, chatId, msgId, '💵 Введите сумму чека (просто число):');

      // --- Подтвердить/отменить одну запись ---
      } else if (data.startsWith('confirm_')) {
        const eid = data.replace('confirm_', '');
        await client.sql`UPDATE expenses SET is_confirmed = true WHERE id = ${eid}`;
        await answerCb(token, cb.id, '✅');
        await editTg(token, chatId, msgId, '✅ Записано.');
      } else if (data.startsWith('cancel_')) {
        const eid = data.replace('cancel_', '');
        await client.sql`DELETE FROM expenses WHERE id = ${eid}`;
        await answerCb(token, cb.id, '❌');
        await editTg(token, chatId, msgId, '❌ Удалено.');
      }
    } catch (e: any) {
      await sendTg(token, chatId, `⚠️ Ошибка: ${e.message}`);
    } finally { client.release(); }
    return NextResponse.json({ ok: true });
  }

  // === СООБЩЕНИЯ ===
  const message = update.message;
  if (!message) return NextResponse.json({ ok: true });

  const chatId = message.chat.id.toString();
  if (chatId !== allowedChatId) { await sendTg(token, chatId, '⛔ Нет доступа.'); return NextResponse.json({ ok: true }); }

  const userText = message.text || message.caption || '';
  const hasPhoto = message.photo && message.photo.length > 0;

  // === ФОТО — сохраняем и спрашиваем ===
  if (hasPhoto) {
    const client = await db.connect();
    try {
      const receiptId = Date.now().toString();
      const receiptNumber = await generateReceiptNumber(client);
      const today = new Date().toISOString().split('T')[0];
      const fileId = message.photo[message.photo.length - 1].file_id;

      const { blobUrl } = await downloadAndUploadPhoto(token, fileId, receiptNumber);

      await client.sql`
        INSERT INTO receipts (id, receipt_number, photo_url, total_amount, items_count, date)
        VALUES (${receiptId}, ${receiptNumber}, ${blobUrl}, 0, 0, ${today})
      `;

      await sendTg(token, chatId,
        `📸 Фото сохранено: <b>${receiptNumber}</b>\n\nЧто делать?`,
        { inline_keyboard: [[
          { text: '🤖 Анализ ИИ', callback_data: `analyze_${receiptId}` },
          { text: '✍️ Вручную', callback_data: `manual_${receiptId}` }
        ]]}
      );
    } catch (e: any) {
      await sendTg(token, chatId, `⚠️ Ошибка: ${e.message}`);
    } finally { client.release(); }
    return NextResponse.json({ ok: true });
  }

  // === ТЕКСТ — проверяем, ждёт ли чек ручного ввода ===
  if (userText) {
    const client = await db.connect();
    try {
      // Ищем чек, ожидающий ввода суммы (items_count = -1)
      const pendingReceipt = await client.sql`
        SELECT * FROM receipts WHERE items_count = -1 ORDER BY created_at DESC LIMIT 1
      `;

      if (pendingReceipt.rowCount && pendingReceipt.rowCount > 0) {
        const receipt = pendingReceipt.rows[0];
        const amount = parseFloat(userText.replace(/[^\d.,]/g, '').replace(',', '.'));

        if (isNaN(amount) || amount <= 0) {
          await sendTg(token, chatId, '❌ Введите число (сумму чека).');
          return NextResponse.json({ ok: true });
        }

        const expId = `${receipt.id}_manual`;
        await client.sql`
          INSERT INTO expenses (id, category, description, amount, date, status, payment_method, type, is_confirmed, receipt_id)
          VALUES (${expId}, 'other', ${`Чек ${receipt.receipt_number}`}, ${amount}, ${receipt.date}, 'paid', 'Ф1', 'expense', false, ${receipt.id})
        `;
        await client.sql`UPDATE receipts SET total_amount = ${amount}, items_count = 1 WHERE id = ${receipt.id}`;

        await sendTg(token, chatId,
          `🧾 <b>${receipt.receipt_number}</b>\n💵 ${amount} грн\n📸 Фото сохранено\n\nПодтвердить?`,
          { inline_keyboard: [[ { text: '✅ Подтвердить', callback_data: `confirm_receipt_${receipt.id}` }, { text: '❌ Отменить', callback_data: `cancel_receipt_${receipt.id}` } ]] }
        );
        return NextResponse.json({ ok: true });
      }

      // Обычный текст — распознаём как трату/доход
      const prompt = `Проанализируй текст и определи финансовую операцию: "${userText}"\nВерни ТОЛЬКО JSON: {"type":"expense" или "income","amount":число,"description":"описание","category":"materials/maintenance/salary/rent/small/sales/other","paymentMethod":"Ф1/Ф2/ФОП"}`;
      const aiText = await callGemini(prompt);
      const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
      if (!jsonMatch) { await sendTg(token, chatId, '❌ Не понял. Попробуйте иначе.'); return NextResponse.json({ ok: true }); }

      const parsed = JSON.parse(jsonMatch[0]);
      const expenseId = Date.now().toString();
      const today = new Date().toISOString().split('T')[0];
      await client.sql`INSERT INTO expenses (id,category,description,amount,date,status,payment_method,type,is_confirmed) VALUES (${expenseId},${parsed.category||'other'},${parsed.description},${parsed.amount},${today},'paid',${parsed.paymentMethod||'Ф1'},${parsed.type||'expense'},false)`;

      const catNames: Record<string, string> = { materials:'Сырье', maintenance:'Ремонт', salary:'Зарплаты', rent:'Аренда', small:'Мелкие', sales:'Продажа', other:'Прочее' };
      const emoji = parsed.type === 'income' ? '💰' : '📉';
      await sendTg(token, chatId,
        `${emoji} <b>${parsed.type === 'income' ? 'ДОХОД' : 'РАСХОД'}</b>\n📝 ${parsed.description}\n💵 ${parsed.amount} грн\n📂 ${catNames[parsed.category]||'Прочее'}\n💳 ${parsed.paymentMethod||'Ф1'}\n\nЗаписать?`,
        { inline_keyboard: [[ { text: '✅ Да', callback_data: `confirm_${expenseId}` }, { text: '❌ Нет', callback_data: `cancel_${expenseId}` } ]] }
      );
    } catch (e: any) {
      await sendTg(token, chatId, `⚠️ Ошибка: ${e.message}`);
    } finally { client.release(); }
  }

  return NextResponse.json({ ok: true });
}
