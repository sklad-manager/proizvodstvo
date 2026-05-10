import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  const client = await db.connect();

  try {
    await client.sql`BEGIN`;

    // 1. Таблица сотрудников
    await client.sql`
      CREATE TABLE IF NOT EXISTS employees (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true
      );
    `;

    // 2. Таблица посещаемости (смен)
    await client.sql`
      CREATE TABLE IF NOT EXISTS attendance (
        employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
        date TEXT NOT NULL,
        PRIMARY KEY (employee_id, date)
      );
    `;

    // 3. Таблица ТО и ремонта (общий статус участка хранится здесь же с префиксом section_)
    await client.sql`
      CREATE TABLE IF NOT EXISTS maintenance (
        id TEXT PRIMARY KEY,
        status TEXT,
        comment TEXT
      );
    `;

    // 4. Таблица категорий сырья
    await client.sql`
      CREATE TABLE IF NOT EXISTS raw_materials_categories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      );
    `;

    // 5. Таблица тюков
    await client.sql`
      CREATE TABLE IF NOT EXISTS raw_materials_bales (
        id TEXT PRIMARY KEY,
        category_id TEXT REFERENCES raw_materials_categories(id) ON DELETE CASCADE,
        number TEXT,
        weight DECIMAL(10, 2),
        received_date TEXT,
        is_consumed BOOLEAN DEFAULT false,
        consumed_date TEXT
      );
    `;

    await client.sql`COMMIT`;
    return NextResponse.json({ message: "База данных успешно инициализирована" }, { status: 200 });
  } catch (error: any) {
    await client.sql`ROLLBACK`;
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
