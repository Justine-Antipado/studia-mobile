// A real tokenizer for MariaDB/MySQL `INSERT INTO t (cols) VALUES (...),(...);` statements.
// Handles '' and backslash escapes, commas/parentheses/newlines inside strings, NULL, numbers,
// -- / # / block comments (also between row tuples) and CRLF. Anything it does not understand
// throws with a line number instead of guessing.

export type SqlValue =
  | { kind: "null" }
  | { kind: "num"; text: string }
  | { kind: "str"; text: string };

export type InsertStatement = {
  table: string;
  columns: string[];
  rows: SqlValue[][];
  line: number;
};

const ESCAPES: Record<string, string> = {
  n: "\n",
  t: "\t",
  r: "\r",
  "0": "\0",
  b: "\b",
  Z: "\x1a",
  "%": "\\%",
  _: "\\_",
};

const NUMBER = /-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?/y;
const WORD = /[A-Za-z_][A-Za-z0-9_]*/y;

export function parseInserts(input: string): InsertStatement[] {
  const s = input.replace(/\r\n?/g, "\n").replace(/^﻿/, "");
  let i = 0;
  const out: InsertStatement[] = [];

  function lineOf(pos: number): number {
    let n = 1;
    for (let k = 0; k < pos && k < s.length; k++) if (s[k] === "\n") n++;
    return n;
  }

  function fail(message: string, pos: number = i): never {
    throw new Error(`SQL parse error at line ${lineOf(pos)}: ${message}`);
  }

  function skipTrivia(): void {
    for (;;) {
      const c = s[i];
      if (c === undefined) return;
      if (c === " " || c === "\t" || c === "\n") {
        i++;
        continue;
      }
      const dashComment =
        c === "-" && s[i + 1] === "-" && (s[i + 2] === undefined || /\s/.test(s[i + 2] ?? ""));
      if (dashComment || c === "#") {
        while (i < s.length && s[i] !== "\n") i++;
        continue;
      }
      if (c === "/" && s[i + 1] === "*") {
        const end = s.indexOf("*/", i + 2);
        if (end < 0) fail("unterminated /* comment");
        i = end + 2;
        continue;
      }
      return;
    }
  }

  function readQuoted(): string {
    const quote = s[i] ?? "'";
    const start = i;
    i++;
    let value = "";
    for (;;) {
      const c = s[i];
      if (c === undefined) fail("unterminated string", start);
      if (c === "\\") {
        const next = s[i + 1];
        if (next === undefined) fail("dangling backslash", i);
        value += ESCAPES[next] ?? next;
        i += 2;
        continue;
      }
      if (c === quote) {
        if (s[i + 1] === quote) {
          value += quote;
          i += 2;
          continue;
        }
        i++;
        return value;
      }
      value += c;
      i++;
    }
  }

  function readWord(): string | null {
    WORD.lastIndex = i;
    const m = WORD.exec(s);
    if (!m) return null;
    i += m[0].length;
    return m[0];
  }

  function readIdentifier(): string {
    skipTrivia();
    const parts: string[] = [];
    for (;;) {
      if (s[i] === "`") {
        const end = s.indexOf("`", i + 1);
        if (end < 0) fail("unterminated `identifier`");
        parts.push(s.slice(i + 1, end));
        i = end + 1;
      } else {
        const w = readWord();
        if (w === null) fail("expected an identifier");
        parts.push(w);
      }
      if (s[i] === ".") {
        i++;
        continue;
      }
      return parts[parts.length - 1] ?? fail("empty identifier");
    }
  }

  function readValue(): SqlValue {
    const c = s[i];
    if (c === "'" || c === '"') return { kind: "str", text: readQuoted() };
    NUMBER.lastIndex = i;
    const n = NUMBER.exec(s);
    if (n) {
      i += n[0].length;
      return { kind: "num", text: n[0] };
    }
    const w = readWord();
    if (w !== null) {
      const up = w.toUpperCase();
      if (up === "NULL") return { kind: "null" };
      if (up === "TRUE") return { kind: "num", text: "1" };
      if (up === "FALSE") return { kind: "num", text: "0" };
      fail(`unsupported value token "${w}" (functions, hex and _binary literals are not handled)`, i - w.length);
    }
    return fail(`unexpected character ${JSON.stringify(c)}`);
  }

  function skipStatement(): void {
    for (;;) {
      skipTrivia();
      const c = s[i];
      if (c === undefined) return;
      if (c === ";") {
        i++;
        return;
      }
      if (c === "'" || c === '"') {
        readQuoted();
        continue;
      }
      if (c === "`") {
        const end = s.indexOf("`", i + 1);
        if (end < 0) fail("unterminated `identifier`");
        i = end + 1;
        continue;
      }
      i++;
    }
  }

  function expectWord(expected: string): void {
    skipTrivia();
    const at = i;
    const w = readWord();
    if (w === null || w.toUpperCase() !== expected) fail(`expected ${expected}`, at);
  }

  function parseInsert(startPos: number): InsertStatement {
    skipTrivia();
    const save = i;
    const maybeIgnore = readWord();
    if (maybeIgnore === null || maybeIgnore.toUpperCase() !== "IGNORE") i = save;
    expectWord("INTO");
    const table = readIdentifier();
    skipTrivia();

    const columns: string[] = [];
    if (s[i] === "(") {
      i++;
      for (;;) {
        columns.push(readIdentifier());
        skipTrivia();
        if (s[i] === ",") {
          i++;
          continue;
        }
        if (s[i] === ")") {
          i++;
          break;
        }
        fail("expected , or ) in column list");
      }
    } else {
      fail(`INSERT INTO ${table} has no column list; list the columns explicitly`);
    }

    skipTrivia();
    const kw = readWord();
    if (kw === null || (kw.toUpperCase() !== "VALUES" && kw.toUpperCase() !== "VALUE")) fail("expected VALUES");

    const rows: SqlValue[][] = [];
    for (;;) {
      skipTrivia();
      if (s[i] !== "(") fail("expected ( to start a row");
      i++;
      const row: SqlValue[] = [];
      for (;;) {
        skipTrivia();
        row.push(readValue());
        skipTrivia();
        if (s[i] === ",") {
          i++;
          continue;
        }
        if (s[i] === ")") {
          i++;
          break;
        }
        fail("expected , or ) inside a row");
      }
      if (row.length !== columns.length) {
        fail(`row has ${row.length} values but ${table} lists ${columns.length} columns`);
      }
      rows.push(row);
      skipTrivia();
      if (s[i] === ",") {
        i++;
        continue;
      }
      if (s[i] === ";") {
        i++;
        break;
      }
      if (s[i] === undefined) break;
      fail("expected , or ; after a row (ON DUPLICATE KEY is not supported)");
    }
    return { table, columns, rows, line: lineOf(startPos) };
  }

  for (;;) {
    skipTrivia();
    if (i >= s.length) break;
    const start = i;
    const word = readWord();
    if (word !== null && word.toUpperCase() === "INSERT") out.push(parseInsert(start));
    else skipStatement();
  }
  return out;
}
