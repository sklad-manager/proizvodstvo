import { db } from '@vercel/postgres';
import { NextResponse } from 'next/server';
import JSZip from 'jszip';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const month = searchParams.get('month'); // формат: 2026-05

  if (!month) {
    return NextResponse.json({ error: 'Укажите месяц: ?month=2026-05' }, { status: 400 });
  }

  const client = await db.connect();
  try {
    // Получаем все расходы за месяц
    const expenses = await client.sql`
      SELECT e.*, r.receipt_number, r.photo_url 
      FROM expenses e
      LEFT JOIN receipts r ON e.receipt_id = r.id
      WHERE TO_CHAR(e.date, 'YYYY-MM') = ${month}
        AND e.is_confirmed = true
      ORDER BY e.date ASC, e.created_at ASC
    `;

    // Получаем уникальные чеки за месяц
    const receipts = await client.sql`
      SELECT * FROM receipts
      WHERE TO_CHAR(date, 'YYYY-MM') = ${month}
      ORDER BY date ASC
    `;

    const zip = new JSZip();

    // Формируем CSV
    const catNames: Record<string, string> = {
      materials: 'Сырье', maintenance: 'Ремонт и ТО', salary: 'Зарплаты',
      rent: 'Аренда/ЖКУ', small: 'Мелкие траты', sales: 'Продажа', other: 'Прочее'
    };

    let csv = '\uFEFF'; // BOM для корректного отображения кириллицы в Excel
    csv += 'Дата;Чек;Описание;Категория;Сумма;Тип;Форма оплаты\n';

    for (const row of expenses.rows) {
      const date = new Date(row.date).toLocaleDateString('ru-RU');
      const receipt = row.receipt_number || '';
      const desc = (row.description || '').replace(/;/g, ',');
      const cat = catNames[row.category] || row.category;
      const amount = Number(row.amount);
      const type = row.type === 'income' ? 'Доход' : 'Расход';
      const pay = row.payment_method || 'Ф1';
      csv += `${date};${receipt};${desc};${cat};${amount};${type};${pay}\n`;
    }

    zip.file(`Отчет_${month}.csv`, csv);

    // Скачиваем и добавляем фото чеков
    const photosFolder = zip.folder('photos');
    for (const receipt of receipts.rows) {
      if (receipt.photo_url) {
        try {
          const photoRes = await fetch(receipt.photo_url);
          if (photoRes.ok) {
            const photoBuffer = await photoRes.arrayBuffer();
            photosFolder!.file(`${receipt.receipt_number}.jpg`, photoBuffer);
          }
        } catch (e) {
          console.error(`Не удалось скачать фото: ${receipt.receipt_number}`, e);
        }
      }
    }

    // Генерируем ZIP
    const zipBuffer = await zip.generateAsync({ type: 'uint8array' });

    return new NextResponse(Buffer.from(zipBuffer), {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="Финансы_${month}.zip"`,
      }
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  } finally {
    client.release();
  }
}
