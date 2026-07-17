// Exporta dados para CSV que abre direto no Excel (BOM UTF-8 + separador ";").
export interface CsvColumn<T> {
  label: string;
  value: (row: T) => string | number | null | undefined;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const sep = ';';
  const esc = (raw: string | number | null | undefined) => {
    const s = raw === null || raw === undefined ? '' : String(raw);
    if (s.includes(sep) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  };
  const header = columns.map((column) => esc(column.label)).join(sep);
  const body = rows.map((row) => columns.map((column) => esc(column.value(row))).join(sep)).join('\r\n');
  const bom = String.fromCharCode(0xFEFF); // faz o Excel abrir os acentos corretamente
  return bom + header + '\r\n' + body;
}

export function downloadFile(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const todayStamp = () => new Date().toISOString().slice(0, 10);
