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
        consumed_date TEXT,
        status TEXT DEFAULT 'warehouse',
        comment TEXT DEFAULT ''
      );
    `;

    // Миграция тюков: добавляем status, comment, original_weight
    await client.sql`ALTER TABLE raw_materials_bales ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'warehouse'`;
    await client.sql`ALTER TABLE raw_materials_bales ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT ''`;
    await client.sql`ALTER TABLE raw_materials_bales ADD COLUMN IF NOT EXISTS original_weight DECIMAL(10,2)`;

    // 5. Расходы и доходы
    await client.sql`
      CREATE TABLE IF NOT EXISTS expenses (
        id TEXT PRIMARY KEY,
        category TEXT NOT NULL,
        description TEXT,
        amount DECIMAL(12,2) NOT NULL,
        date DATE NOT NULL,
        status TEXT DEFAULT 'planned',
        payment_method TEXT DEFAULT 'Ф1',
        type TEXT DEFAULT 'expense',
        is_confirmed BOOLEAN DEFAULT true,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Миграция: добавляем колонки если их нет (для существующих данных)
    await client.sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'expense'`;
    await client.sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS is_confirmed BOOLEAN DEFAULT true`;
    await client.sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS receipt_id TEXT`;
    await client.sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT ''`;
    await client.sql`ALTER TABLE expenses ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'none'`;

    // 6. Таблица чеков (фото)
    await client.sql`
      CREATE TABLE IF NOT EXISTS receipts (
        id TEXT PRIMARY KEY,
        receipt_number TEXT UNIQUE NOT NULL,
        photo_url TEXT,
        total_amount DECIMAL(12,2) DEFAULT 0,
        items_count INTEGER DEFAULT 0,
        date DATE NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // 7. История действий
    await client.sql`
      CREATE TABLE IF NOT EXISTS action_history (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        action_type TEXT NOT NULL,
        module TEXT NOT NULL,
        description TEXT NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Создаем функцию для логирования расходов/доходов
    await client.sql`
      CREATE OR REPLACE FUNCTION log_expense_history() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO action_history (action_type, module, description) 
          VALUES ('add', 'finance', (CASE WHEN NEW.type = 'income' THEN 'Приход: ' ELSE 'Расход: ' END) || NEW.description || ' (' || NEW.amount || ' грн)');
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO action_history (action_type, module, description) 
          VALUES ('delete', 'finance', (CASE WHEN OLD.type = 'income' THEN 'Приход: ' ELSE 'Расход: ' END) || OLD.description || ' (' || OLD.amount || ' грн)');
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Привязываем триггер к таблице expenses
    await client.sql`DROP TRIGGER IF EXISTS expense_history_trigger ON expenses`;
    await client.sql`
      CREATE TRIGGER expense_history_trigger
      AFTER INSERT OR DELETE ON expenses
      FOR EACH ROW EXECUTE FUNCTION log_expense_history()
    `;

    // Создаем функцию для логирования сырья
    await client.sql`
      CREATE OR REPLACE FUNCTION log_raw_material_history() RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'INSERT' THEN
          INSERT INTO action_history (action_type, module, description) 
          VALUES ('add', 'raw_materials', 'Добавлен тюк #' || NEW.number || ' (' || NEW.weight || ' кг)');
          RETURN NEW;
        ELSIF TG_OP = 'DELETE' THEN
          INSERT INTO action_history (action_type, module, description) 
          VALUES ('delete', 'raw_materials', 'Удален тюк #' || OLD.number || ' (' || OLD.weight || ' кг)');
          RETURN OLD;
        END IF;
        RETURN NULL;
      END;
      $$ LANGUAGE plpgsql;
    `;

    // Привязываем триггер к таблице raw_materials_bales
    await client.sql`DROP TRIGGER IF EXISTS raw_material_history_trigger ON raw_materials_bales`;
    await client.sql`
      CREATE TRIGGER raw_material_history_trigger
      AFTER INSERT OR DELETE ON raw_materials_bales
      FOR EACH ROW EXECUTE FUNCTION log_raw_material_history()
    `;

    await client.sql`COMMIT`;
    return NextResponse.json({ success: true, message: "БД готова (Склад, График, ТО, Финансы, Чеки)" }, { status: 200 });
  } catch (error: any) {
    await client.sql`ROLLBACK`;
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
