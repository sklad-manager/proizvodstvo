import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Получить все данные склада
export async function GET() {
  const client = await db.connect();
  try {
    const categoriesResult = await client.sql`SELECT * FROM raw_materials_categories ORDER BY name ASC`;
    const balesResult = await client.sql`SELECT * FROM raw_materials_bales`;

    const categories = categoriesResult.rows.map(cat => ({
      ...cat,
      bales: balesResult.rows
        .filter(bale => bale.category_id === cat.id)
        .map(bale => ({
          ...bale,
          receivedDate: bale.received_date,
          isConsumed: bale.is_consumed,
          consumedDate: bale.consumed_date,
          weight: Number(bale.weight)
        }))
    }));

    return NextResponse.json(categories);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Создать категорию или добавить тюк
export async function POST(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'category') {
      await client.sql`
        INSERT INTO raw_materials_categories (id, name)
        VALUES (${data.id}, ${data.name})
      `;
    } else if (type === 'bale') {
      await client.sql`
        INSERT INTO raw_materials_bales (id, category_id, number, weight, received_date, is_consumed)
        VALUES (${data.id}, ${data.category_id}, ${data.number}, ${data.weight}, ${data.receivedDate}, false)
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Обновить (списать) тюк или удалить
export async function PATCH(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { id, isConsumed, consumedDate } = body;

    await client.sql`
      UPDATE raw_materials_bales
      SET is_consumed = ${isConsumed}, consumed_date = ${consumedDate}
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request) {
  const client = await db.connect();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (type === 'category') {
      await client.sql`DELETE FROM raw_materials_categories WHERE id = ${id}`;
    } else {
      await client.sql`DELETE FROM raw_materials_bales WHERE id = ${id}`;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
