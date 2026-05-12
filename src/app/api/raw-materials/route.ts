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
          weight: Number(bale.weight),
          status: bale.status || 'warehouse',
          comment: bale.comment || ''
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
        INSERT INTO raw_materials_bales (id, category_id, number, weight, received_date, is_consumed, status, comment)
        VALUES (${data.id}, ${data.category_id}, ${data.number}, ${data.weight}, ${data.receivedDate}, false, 'warehouse', '')
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Обновить тюк (статус, комментарий, списание)
export async function PATCH(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { id, status, comment, isConsumed, consumedDate } = body;

    // Обновляем статус
    if (status !== undefined) {
      await client.sql`UPDATE raw_materials_bales SET status = ${status} WHERE id = ${id}`;
      // Если статус "finished" — помечаем как списанный
      if (status === 'finished') {
        const finishDate = consumedDate || new Date().toISOString().split('T')[0];
        await client.sql`UPDATE raw_materials_bales SET is_consumed = true, consumed_date = ${finishDate} WHERE id = ${id}`;
      }
    }

    // Обновляем комментарий
    if (comment !== undefined) {
      await client.sql`UPDATE raw_materials_bales SET comment = ${comment} WHERE id = ${id}`;
    }

    // Прямое списание (обратная совместимость)
    if (isConsumed !== undefined && status === undefined) {
      await client.sql`UPDATE raw_materials_bales SET is_consumed = ${isConsumed}, consumed_date = ${consumedDate} WHERE id = ${id}`;
    }

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
