import assert from "node:assert/strict";
import { test } from "node:test";
import { parseCsv, writeCsv } from "./lib/csv.ts";
import { parseInserts } from "./lib/sql-tokenizer.ts";

const text = (v: { kind: string; text?: string } | undefined): string | null => (v && v.kind !== "null" ? (v.text ?? null) : null);

test("quotes, escapes, commas, parentheses, newlines and CRLF inside strings", () => {
  const sql =
    "INSERT INTO t (a, b, c) VALUES\r\n" +
    "('it''s, (fine)', 'say \\'hi\\'\\n\\\\ok', 'line1\r\nline2'),\r\n" +
    "-- a comment with an apostrophe: don't break\r\n" +
    "('x', NULL, 12.50);";
  const [st] = parseInserts(sql);
  assert.ok(st);
  assert.equal(st.table, "t");
  assert.deepEqual(st.columns, ["a", "b", "c"]);
  assert.equal(text(st.rows[0]?.[0]), "it's, (fine)");
  assert.equal(text(st.rows[0]?.[1]), "say 'hi'\n\\ok");
  assert.equal(text(st.rows[0]?.[2]), "line1\nline2");
  assert.equal(text(st.rows[1]?.[1]), null);
  assert.equal(text(st.rows[1]?.[2]), "12.50");
});

test("JSON strings survive and non-INSERT statements with ; inside strings are skipped", () => {
  const sql =
    "CREATE TABLE x (a VARCHAR(5) DEFAULT 'a;b'); -- ; in a comment\n" +
    "INSERT INTO `db`.`j` (`id`, `data`) VALUES ('1', '[\"a\",\"b\"]'), ('2', '{\"x\":1,\"y\":\"(z)\"}');";
  const [st] = parseInserts(sql);
  assert.ok(st);
  assert.equal(st.table, "j");
  assert.deepEqual(JSON.parse(text(st.rows[0]?.[1]) ?? ""), ["a", "b"]);
  assert.deepEqual(JSON.parse(text(st.rows[1]?.[1]) ?? ""), { x: 1, y: "(z)" });
});

test("a row with the wrong number of values fails loudly", () => {
  assert.throws(() => parseInserts("INSERT INTO t (a, b) VALUES ('1');"), /1 values but t lists 2 columns/);
});

test("an unsupported token fails loudly with a line number", () => {
  assert.throws(() => parseInserts("\n\nINSERT INTO t (a) VALUES (NOW());"), /line 3.*NOW/);
});

test("csv: NULL is unquoted empty, empty string is quoted, round trip keeps both", () => {
  const out = writeCsv(["a", "b", "c"], [["x,y", null, ""], ['q"r', "l1\nl2", "z"]]);
  const back = parseCsv(out);
  assert.deepEqual(back.header, ["a", "b", "c"]);
  assert.deepEqual(back.rows, [
    ["x,y", null, ""],
    ['q"r', "l1\nl2", "z"],
  ]);
});
