// Reads table/column/enum definitions straight from supabase/migrations so the converter never
// guesses a column type. It understands exactly the DDL shapes those migrations use.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

export type ColumnKind =
  | { kind: "boolean" }
  | { kind: "timestamptz" }
  | { kind: "date" }
  | { kind: "jsonb" }
  | { kind: "int" }
  | { kind: "numeric" }
  | { kind: "enum"; name: string; labels: readonly string[] }
  | { kind: "text" };

export type Column = {
  name: string;
  type: string;
  kind: ColumnKind;
  /** set when the column is declared `references public.<table> (...)` */
  fkTable: string | null;
};

export type Schema = {
  tables: Map<string, Column[]>;
  enums: Map<string, readonly string[]>;
};

function stripComments(sql: string): string {
  let out = "";
  let i = 0;
  while (i < sql.length) {
    const c = sql[i] ?? "";
    if (c === "'") {
      let j = i + 1;
      for (;;) {
        if (j >= sql.length) break;
        if (sql[j] === "'" && sql[j + 1] === "'") j += 2;
        else if (sql[j] === "'") break;
        else j++;
      }
      out += sql.slice(i, j + 1);
      i = j + 1;
    } else if (c === "$" && sql[i + 1] === "$") {
      const end = sql.indexOf("$$", i + 2);
      const stop = end < 0 ? sql.length : end + 2;
      out += sql.slice(i, stop);
      i = stop;
    } else if (c === "-" && sql[i + 1] === "-") {
      while (i < sql.length && sql[i] !== "\n") i++;
    } else if (c === "/" && sql[i + 1] === "*") {
      const end = sql.indexOf("*/", i + 2);
      i = end < 0 ? sql.length : end + 2;
    } else {
      out += c;
      i++;
    }
  }
  return out;
}

function matchingParen(sql: string, open: number): number {
  let depth = 0;
  for (let i = open; i < sql.length; i++) {
    const c = sql[i];
    if (c === "'") {
      i++;
      while (i < sql.length && !(sql[i] === "'" && sql[i + 1] !== "'")) i += sql[i] === "'" ? 2 : 1;
    } else if (c === "(") depth++;
    else if (c === ")") {
      depth--;
      if (depth === 0) return i;
    }
  }
  throw new Error("unbalanced parentheses in migration DDL");
}

function splitTopLevel(body: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === "'") {
      i++;
      while (i < body.length && !(body[i] === "'" && body[i + 1] !== "'")) i += body[i] === "'" ? 2 : 1;
    } else if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      items.push(body.slice(start, i).trim());
      start = i + 1;
    }
  }
  const last = body.slice(start).trim();
  if (last) items.push(last);
  return items;
}

function kindOf(type: string, enums: Map<string, readonly string[]>): ColumnKind {
  const labels = enums.get(type);
  if (labels) return { kind: "enum", name: type, labels };
  if (type === "boolean" || type === "bool") return { kind: "boolean" };
  if (type === "timestamptz") return { kind: "timestamptz" };
  if (type === "date") return { kind: "date" };
  if (type === "jsonb" || type === "json") return { kind: "jsonb" };
  if (type === "smallint" || type === "integer" || type === "int" || type === "bigint") return { kind: "int" };
  if (type.startsWith("numeric")) return { kind: "numeric" };
  return { kind: "text" };
}

const NON_COLUMN = new Set(["constraint", "primary", "unique", "check", "foreign", "exclude", "like"]);

export function loadSchema(migrationsDir: string): Schema {
  const files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const sql = files.map((f) => stripComments(readFileSync(join(migrationsDir, f), "utf8"))).join("\n");

  const enums = new Map<string, readonly string[]>();
  for (const m of sql.matchAll(/create\s+type\s+public\.([a-z_][a-z0-9_]*)\s+as\s+enum\s*\(([^)]*)\)/gi)) {
    const labels = [...(m[2] ?? "").matchAll(/'((?:[^']|'')*)'/g)].map((x) => (x[1] ?? "").replaceAll("''", "'"));
    enums.set((m[1] ?? "").toLowerCase(), labels);
  }

  const tables = new Map<string, Column[]>();
  const tableRe = /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.([a-z_][a-z0-9_]*)\s*\(/gi;
  for (const m of sql.matchAll(tableRe)) {
    const name = (m[1] ?? "").toLowerCase();
    const open = (m.index ?? 0) + m[0].length - 1;
    const close = matchingParen(sql, open);
    const columns: Column[] = [];
    for (const item of splitTopLevel(sql.slice(open + 1, close))) {
      const head = /^([a-z_][a-z0-9_]*)\s+([\s\S]*)$/i.exec(item);
      if (!head) continue;
      const colName = (head[1] ?? "").toLowerCase();
      if (NON_COLUMN.has(colName)) continue;
      const rest = head[2] ?? "";
      const t = /^((?:[a-z_][a-z0-9_]*\.)?[a-z_][a-z0-9_]*(?:\s*\(\s*\d+\s*(?:,\s*\d+\s*)?\))?)/i.exec(rest);
      if (!t) throw new Error(`cannot read the type of ${name}.${colName}`);
      const type = (t[1] ?? "").replace(/\s+/g, "").toLowerCase().replace(/^public\./, "");
      const ref = /references\s+public\.([a-z_][a-z0-9_]*)\s*\(/i.exec(rest);
      columns.push({ name: colName, type, kind: kindOf(type, enums), fkTable: ref ? (ref[1] ?? "").toLowerCase() : null });
    }
    tables.set(name, columns);
  }
  if (tables.size === 0) throw new Error(`no tables found in ${migrationsDir}`);
  return { tables, enums };
}
