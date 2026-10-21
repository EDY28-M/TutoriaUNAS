export function encodeCsv(rows: readonly (readonly string[])[]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          // Prevent spreadsheet formula execution, including leading whitespace/control characters.
          const safe = /^[\s]*[=+@-]/u.test(cell) || /^[\t\r\n]/u.test(cell) ? `'${cell}` : cell;
          return `"${safe.replaceAll('"', '""')}"`;
        })
        .join(','),
    )
    .join('\r\n');
}

export function downloadCsv(rows: readonly (readonly string[])[], filename: string): void {
  const url = URL.createObjectURL(
    new Blob(['\uFEFF', encodeCsv(rows)], { type: 'text/csv;charset=utf-8' }),
  );
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
