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
      const res = await client.sql`SELECT receipt_id FROM expenses WHERE id = ${id}`;
      const receiptId = res.rows[0]?.receipt_id;

      if (receiptId) {
        if (date !== undefined) {
          await client.sql`UPDATE expenses SET date = ${date} WHERE receipt_id = ${receiptId}`;
          await client.sql`UPDATE receipts SET date = ${date} WHERE id = ${receiptId}`;
        }
        if (comment !== undefined) {
          await client.sql`UPDATE expenses SET comment = ${comment} WHERE receipt_id = ${receiptId}`;
        }
        if (body.review_status !== undefined) {
          await client.sql`UPDATE expenses SET review_status = ${body.review_status} WHERE receipt_id = ${receiptId}`;
        }
      } else {
        if (date !== undefined) await client.sql`UPDATE expenses SET date = ${date} WHERE id = ${id}`;
        if (comment !== undefined) await client.sql`UPDATE expenses SET comment = ${comment} WHERE id = ${id}`;
        if (body.review_status !== undefined) await client.sql`UPDATE expenses SET review_status = ${body.review_status} WHERE id = ${id}`;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
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
