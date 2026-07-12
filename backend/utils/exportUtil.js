const escapeCsv = (value) => {
  if (value == null) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
};

export const toCsv = (rows, columns) => {
  const header = columns.map((c) => escapeCsv(c.label)).join(',');
  const body = rows.map((row) =>
    columns.map((c) => escapeCsv(c.accessor ? c.accessor(row) : row[c.key])).join(',')
  ).join('\n');
  return `${header}\n${body}`;
};

export const sendCsv = (res, filename, rows, columns) => {
  const csv = toCsv(rows, columns);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  return res.send(`\uFEFF${csv}`);
};

export const sendExcel = async (res, filename, sheetName, rows, columns) => {
  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sheetName);
  sheet.addRow(columns.map((c) => c.label));
  rows.forEach((row) => {
    sheet.addRow(columns.map((c) => (c.accessor ? c.accessor(row) : row[c.key] ?? '')));
  });
  sheet.getRow(1).font = { bold: true };
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await workbook.xlsx.write(res);
  res.end();
};

export const sendPdf = async (res, filename, title, rows, columns) => {
  const PDFDocument = (await import('pdfkit')).default;
  const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);
  doc.fontSize(16).text(title, { align: 'center' });
  doc.moveDown();
  doc.fontSize(8);

  const colWidth = (doc.page.width - 80) / columns.length;
  let y = doc.y;
  columns.forEach((col, i) => {
    doc.text(col.label, 40 + i * colWidth, y, { width: colWidth, continued: false });
  });
  y += 14;
  doc.moveTo(40, y).lineTo(doc.page.width - 40, y).stroke();
  y += 6;

  rows.slice(0, 40).forEach((row) => {
    if (y > doc.page.height - 50) {
      doc.addPage({ layout: 'landscape' });
      y = 40;
    }
    columns.forEach((col, i) => {
      const val = col.accessor ? col.accessor(row) : row[col.key];
      doc.text(String(val ?? ''), 40 + i * colWidth, y, { width: colWidth, height: 12 });
    });
    y += 14;
  });

  doc.end();
};

export const dispatchExport = async (res, { format, filename, title, sheetName, rows, columns }) => {
  switch (format) {
    case 'csv':
      return sendCsv(res, `${filename}.csv`, rows, columns);
    case 'excel':
    case 'xlsx':
      return sendExcel(res, `${filename}.xlsx`, sheetName || 'Report', rows, columns);
    case 'pdf':
      return sendPdf(res, `${filename}.pdf`, title || 'Report', rows, columns);
    default:
      return sendCsv(res, `${filename}.csv`, rows, columns);
  }
};
