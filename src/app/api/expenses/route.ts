import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Получить все расходы
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

// Добавить расход (крупный или мелкий)
export async function POST(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { id, category, description, amount, date, status } = body;

    await client.sql`
      INSERT INTO expenses (id, category, description, amount, date, status)
      VALUES (${id}, ${category}, ${description}, ${amount}, ${date}, ${status || 'planned'})
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Изменить статус (Оплачено / Планируется)
export async function PATCH(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { id, status } = body;

    await client.sql`
      UPDATE expenses
      SET status = ${status}
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Удалить расход
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
