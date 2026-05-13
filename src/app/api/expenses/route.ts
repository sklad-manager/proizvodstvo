import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Получить все записи (расходы + доходы) с информацией о чеках
export async function GET() {
  const client = await db.connect();
  try {
    const result = await client.sql`
      SELECT e.*, r.receipt_number, r.photo_url
      FROM expenses e
      LEFT JOIN receipts r ON e.receipt_id = r.id
      ORDER BY e.date DESC, e.created_at DESC
    `;
    
    const expenses = result.rows.map(row => ({
      ...row,
      amount: Number(row.amount)
    }));

    return NextResponse.json(expenses);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Добавить запись
export async function POST(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { id, category, description, amount, date, status, paymentMethod, type, isConfirmed, receiptId } = body;

    await client.sql`
      INSERT INTO expenses (id, category, description, amount, date, status, payment_method, type, is_confirmed, receipt_id)
      VALUES (${id}, ${category}, ${description}, ${amount}, ${date}, ${status || 'planned'}, ${paymentMethod || 'Ф1'}, ${type || 'expense'}, ${isConfirmed !== false}, ${receiptId || null})
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Изменить запись
export async function PATCH(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { id, status, isConfirmed, comment, date } = body;

    if (isConfirmed !== undefined) {
      await client.sql`UPDATE expenses SET is_confirmed = ${isConfirmed} WHERE id = ${id}`;
    }
    if (status !== undefined) {
      await client.sql`UPDATE expenses SET status = ${status} WHERE id = ${id}`;
    }
    if (comment !== undefined || date !== undefined || body.review_status !== undefined) {
      const res = await client.sql`SELECT * FROM expenses WHERE id = ${id}`;
      if (res.rows.length === 0) return NextResponse.json({ success: true });
      const oldItem = res.rows[0];
      const receiptId = oldItem.receipt_id;
      const desc = oldItem.description || 'Операция';

      const oldDateStr = oldItem.date ? new Date(oldItem.date).toISOString().split('T')[0] : '';
      const dateChanged = date !== undefined && date !== oldDateStr;
      const commentChanged = comment !== undefined && (comment || '') !== (oldItem.comment || '');

      if (receiptId) {
        if (dateChanged) {
          const newReceiptNumber = await generateReceiptNumberForDate(client, date);
          await client.sql`UPDATE expenses SET date = ${date} WHERE receipt_id = ${receiptId}`;
          await client.sql`UPDATE receipts SET date = ${date}, receipt_number = ${newReceiptNumber} WHERE id = ${receiptId}`;
          
          await client.sql`INSERT INTO action_history (action_type, module, description) VALUES ('edit', 'finance', 'Перемещение чека ' || ${desc} || ' на дату ' || ${date})`;
          await sendTgNotification(`📅 <b>Чек перемещен:</b>\nНовая дата: ${date}\nНовый номер: ${newReceiptNumber}\nОперация: ${desc}`);
        }
        if (commentChanged) {
          await client.sql`UPDATE expenses SET comment = ${comment} WHERE receipt_id = ${receiptId}`;
          await client.sql`INSERT INTO action_history (action_type, module, description) VALUES ('edit', 'finance', 'Изменен комментарий для ' || ${desc} || ': ' || ${comment})`;
          await sendTgNotification(`💬 <b>Изменен комментарий (чек):</b>\nОперация: ${desc}\nНовый комментарий: ${comment || 'удален'}`);
        }
        if (body.review_status !== undefined) {
          await client.sql`UPDATE expenses SET review_status = ${body.review_status} WHERE receipt_id = ${receiptId}`;
        }
      } else {
        if (dateChanged) {
          await client.sql`UPDATE expenses SET date = ${date} WHERE id = ${id}`;
          await client.sql`INSERT INTO action_history (action_type, module, description) VALUES ('edit', 'finance', 'Перемещение записи ' || ${desc} || ' на дату ' || ${date})`;
          await sendTgNotification(`📅 <b>Запись перемещена:</b>\nНовая дата: ${date}\nОперация: ${desc}`);
        }
        if (commentChanged) {
          await client.sql`UPDATE expenses SET comment = ${comment} WHERE id = ${id}`;
          await client.sql`INSERT INTO action_history (action_type, module, description) VALUES ('edit', 'finance', 'Изменен комментарий для ' || ${desc} || ': ' || ${comment})`;
          await sendTgNotification(`💬 <b>Изменен комментарий:</b>\nОперация: ${desc}\nНовый комментарий: ${comment || 'удален'}`);
        }
        if (body.review_status !== undefined) {
          await client.sql`UPDATE expenses SET review_status = ${body.review_status} WHERE id = ${id}`;
        }
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

async function generateReceiptNumberForDate(client: any, dateString: string): Promise<string> {
  const dObj = new Date(dateString);
  const y = dObj.getFullYear().toString().slice(-2);
  const m = (dObj.getMonth() + 1).toString().padStart(2, '0');
  const d = dObj.getDate().toString().padStart(2, '0');
  const datePrefix = `${d}${m}${y}`;
  const prefix = `${datePrefix}-`;
  
  const result = await client.sql`SELECT receipt_number FROM receipts WHERE receipt_number LIKE ${prefix + '%'} ORDER BY receipt_number DESC LIMIT 1`;
  let seq = 1;
  if (result.rows.length > 0) {
    const last = result.rows[0].receipt_number;
    const lastNum = parseInt(last.split('-').pop() || '0');
    seq = lastNum + 1;
  }
  return `${datePrefix}-${seq}`;
}
// Отправка уведомления в Telegram
async function sendTgNotification(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' })
    });
  } catch (e) {}
}

// Удалить запись
export async function DELETE(request: Request) {
  const client = await db.connect();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // Получаем информацию перед удалением для уведомления
    const item = await client.sql`SELECT * FROM expenses WHERE id = ${id}`;
    if (item.rows.length > 0) {
      const row = item.rows[0];
      const desc = row.description || 'Без описания';
      const amount = row.amount || 0;
      await sendTgNotification(`🗑 <b>Удалена операция:</b>\n${desc}\nСумма: ${amount} грн.`);
    }

    await client.sql`DELETE FROM expenses WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
