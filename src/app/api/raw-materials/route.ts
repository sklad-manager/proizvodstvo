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
          originalWeight: bale.original_weight ? Number(bale.original_weight) : null,
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
        INSERT INTO raw_materials_bales (id, category_id, number, weight, received_date, is_consumed, status, comment, original_weight)
        VALUES (${data.id}, ${data.category_id}, ${data.number}, ${data.weight}, ${data.receivedDate}, false, 'warehouse', '', ${data.weight})
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Обновить тюк (статус, комментарий, вес при возврате)
export async function PATCH(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { id, status, comment, isConsumed, consumedDate, newWeight } = body;

    // Обновляем статус
    if (status !== undefined) {
      await client.sql`UPDATE raw_materials_bales SET status = ${status} WHERE id = ${id}`;

      if (status === 'finished') {
        const finishDate = consumedDate || new Date().toISOString().split('T')[0];
        await client.sql`UPDATE raw_materials_bales SET is_consumed = true, consumed_date = ${finishDate} WHERE id = ${id}`;
      }

      // Возврат на склад — сохраняем текущий вес как original_weight, ставим новый вес
      if (status === 'returned') {
        // Сначала сохраняем текущий вес как оригинальный (если ещё не сохранён)
        await client.sql`
          UPDATE raw_materials_bales 
          SET original_weight = COALESCE(original_weight, weight),
              status = 'warehouse',
              is_consumed = false,
              consumed_date = NULL
          WHERE id = ${id}
        `;
        // Если передан новый вес — обновляем
        if (newWeight !== undefined && newWeight !== null) {
          await client.sql`UPDATE raw_materials_bales SET weight = ${newWeight} WHERE id = ${id}`;
        }
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

export async function DELETE(request: Request) {
  const client = await db.connect();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');

    if (type === 'category') {
      const cat = await client.sql`SELECT name FROM raw_materials_categories WHERE id = ${id}`;
      if (cat.rows.length > 0) {
        await sendTgNotification(`🗑 <b>Удалена категория сырья:</b>\n${cat.rows[0].name}`);
      }
      await client.sql`DELETE FROM raw_materials_categories WHERE id = ${id}`;
    } else {
      const bale = await client.sql`
        SELECT b.*, c.name as cat_name 
        FROM raw_materials_bales b 
        LEFT JOIN raw_materials_categories c ON b.category_id = c.id 
        WHERE b.id = ${id}
      `;
      if (bale.rows.length > 0) {
        const b = bale.rows[0];
        await sendTgNotification(`🗑 <b>Удален рулон/сырье:</b>\nКатегория: ${b.cat_name || 'Без категории'}\nЦвет: ${b.color || '-'}\nВес: ${b.weight} кг`);
      }
      await client.sql`DELETE FROM raw_materials_bales WHERE id = ${id}`;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
