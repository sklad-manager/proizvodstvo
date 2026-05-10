import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';

// Получить всех сотрудников и их выходы
export async function GET() {
  const client = await db.connect();
  try {
    const employeesResult = await client.sql`SELECT * FROM employees ORDER BY name ASC`;
    const attendanceResult = await client.sql`SELECT * FROM attendance`;

    const employees = employeesResult.rows.map(emp => ({
      ...emp,
      isActive: emp.is_active,
      attendance: attendanceResult.rows
        .filter(a => a.employee_id === emp.id)
        .map(a => a.date)
    }));

    return NextResponse.json(employees);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Добавить сотрудника или отметить смену
export async function POST(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { type, ...data } = body;

    if (type === 'employee') {
      await client.sql`
        INSERT INTO employees (id, name, is_active)
        VALUES (${data.id}, ${data.name}, ${data.isActive !== false})
      `;
    } else if (type === 'attendance') {
      await client.sql`
        INSERT INTO attendance (employee_id, date)
        VALUES (${data.employee_id}, ${data.date})
        ON CONFLICT (employee_id, date) DO NOTHING
      `;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Удалить сотрудника или убрать отметку о смене
export async function DELETE(request: Request) {
  const client = await db.connect();
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const type = searchParams.get('type');
    const date = searchParams.get('date');

    if (type === 'employee') {
      await client.sql`DELETE FROM employees WHERE id = ${id}`;
    } else if (type === 'attendance') {
      await client.sql`DELETE FROM attendance WHERE employee_id = ${id} AND date = ${date}`;
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}

// Изменить статус сотрудника (активен/уволен)
export async function PATCH(request: Request) {
  const client = await db.connect();
  try {
    const body = await request.json();
    const { id, isActive } = body;

    await client.sql`
      UPDATE employees
      SET is_active = ${isActive}
      WHERE id = ${id}
    `;

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
