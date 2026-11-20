// CSV for Postgres COPY ... CSV HEADER: NULL is an UNQUOTED empty field, an empty string is "".

export function csvField(value: string | null): string {
  if (value === null) return "";
  if (value === "") return '""';
  if (/[",\n\r]/.test(value) || value !== value.trim()) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

export function csvLine(values: readonly (string | null)[]): string {
  return values.map(csvField).join(",");
}

export function writeCsv(header: readonly string[], rows: readonly (readonly (string | null)[])[]): string {
  return [csvLine(header), ...rows.map(csvLine)].join("\n") + "\n";
}

export type ParsedCsv = { header: string[]; rows: (string | null)[][] };

export function parseCsv(input: string): ParsedCsv {
  const text = input.replace(/^﻿/, "");
  const records: (string | null)[][] = [];
  let row: (string | null)[] = [];
  let field = "";
  let quoted = false; // current field was quoted
  let inQuotes = false;
  let i = 0;

  const endField = (): void => {
    row.push(!quoted && field === "" ? null : field);
    field = "";
    quoted = false;
  };
  const endRow = (): void => {
    endField();
    records.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += c;
      i++;
      continue;
    }
    if (c === '"' && field === "") {
      inQuotes = true;
      quoted = true;
      i++;
    } else if (c === ",") {
      endField();
      i++;
    } else if (c === "\r") {
      i++;
    } else if (c === "\n") {
      endRow();
      i++;
    } else {
      field += c;
      i++;
    }
  }
  if (field !== "" || quoted || row.length > 0) endRow();

  const header = (records.shift() ?? []).map((h) => h ?? "");
  return { header, rows: records };
}
