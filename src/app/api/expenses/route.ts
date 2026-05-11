import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Получить все записи (расходы + доходы)
export async function GET() {
  const client = await db.connect();
  try {
    const result = await client.sql`
      SELECT * FROM expenses 
      ORDER BY date DESC, created_at DESC
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
    const { id, category, description, amount, date, status, paymentMethod, type, isConfirmed } = body;

    await client.sql`
      INSERT INTO expenses (id, category, description, amount, date, status, payment_method, type, is_confirmed)
      VALUES (${id}, ${category}, ${description}, ${amount}, ${date}, ${status || 'planned'}, ${paymentMethod || 'Ф1'}, ${type || 'expense'}, ${isConfirmed !== false})
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Изменить статус или подтвердить запись
export async function PATCH(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { id, status, isConfirmed } = body;

    if (isConfirmed !== undefined) {
      await client.sql`UPDATE expenses SET is_confirmed = ${isConfirmed} WHERE id = ${id}`;
    }
    if (status !== undefined) {
      await client.sql`UPDATE expenses SET status = ${status} WHERE id = ${id}`;
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
