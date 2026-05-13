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
    if (comment !== undefined || date !== undefined) {
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
      } else {
        if (date !== undefined) await client.sql`UPDATE expenses SET date = ${date} WHERE id = ${id}`;
        if (comment !== undefined) await client.sql`UPDATE expenses SET comment = ${comment} WHERE id = ${id}`;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Удалить запись
export async function DELETE(request: Request) {
  const client = await db.connect();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    await client.sql`DELETE FROM expenses WHERE id = ${id}`;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
