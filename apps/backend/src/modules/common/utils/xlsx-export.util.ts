import * as XLSX from 'xlsx';

export interface XlsxSheetPayload {
  name: string;
  columns: Array<string | number>;
  rows: Array<Array<string | number | boolean | null | undefined>>;
}

function normalizeSheetName(name: string, index: number): string {
  const fallback = `Sheet${index + 1}`;
  const text = String(name || '').trim() || fallback;
  return text.slice(0, 31);
}

export function buildXlsxBase64(sheets: XlsxSheetPayload[]): string {
  const workbook = XLSX.utils.book_new();
  const targets = Array.isArray(sheets) ? sheets : [];

  targets.forEach((sheet, index) => {
    const columns = Array.isArray(sheet?.columns) ? sheet.columns : [];
    const rows = Array.isArray(sheet?.rows) ? sheet.rows : [];
    const worksheet = XLSX.utils.aoa_to_sheet([columns, ...rows]);
    XLSX.utils.book_append_sheet(
      workbook,
      worksheet,
      normalizeSheetName(sheet?.name || '', index),
    );
  });

  const output = XLSX.write(workbook, {
    type: 'buffer',
    bookType: 'xlsx',
    compression: true,
  });
  return Buffer.from(output).toString('base64');
}
