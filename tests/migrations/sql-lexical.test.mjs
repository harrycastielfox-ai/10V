import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { createSqlLexicalTools } from "../../scripts/migrations/sql-lexical.mjs";

const tools = createSqlLexicalTools();
const fp = (sql) => tools.fingerprint(Array.isArray(sql) ? sql : [sql]);

test("ignores whitespace, nested comments, optional terminators and statement-array serialization", () => {
  assert.equal(
    fp("-- preface\r\n SELECT /* outer /* nested */ done */ a,b FROM t; SELECT 2;"),
    fp(["SELECT a , b FROM t", "/* between */ SELECT\t2"]),
  );
});

test("preserves quoted contents, including comment markers, newlines, spaces and delimiters", () => {
  for (const [left, right] of [
    ["SELECT 'a b'", "SELECT 'ab'"],
    ["SELECT 'a--b'", "SELECT 'ab'"],
    ['SELECT "a b"', 'SELECT "ab"'],
    ["SELECT 'a\r\nb'", "SELECT 'a\nb'"],
    ["DO $body$ BEGIN /* x */ NULL; END $body$", "DO $body$ BEGIN NULL; END $body$"],
    ["SELECT $$a--b$$", "SELECT $$ab$$"],
    ["SELECT $one$x$one$", "SELECT $two$x$two$"],
  ])
    assert.notEqual(fp(left), fp(right));
});

test("handles doubled quotes, escape strings, unicode and quoted dollar signs", () => {
  assert.equal(
    fp(String.raw`SELECT E'a\'--b', 'c''/*d*/', U&'d\0061t', "x""--y", $$'/*;*/$$;`),
    fp(String.raw`SELECT /* x */ E'a\'--b' , 'c''/*d*/' , U&'d\0061t' , "x""--y" , $$'/*;*/$$`),
  );
  assert.notEqual(fp("SELECT E'x'"), fp("SELECT E 'x'"));
  assert.notEqual(fp("SELECT U&'x'"), fp("SELECT U & 'x'"));
});

test("does not merge identifiers, operators, numeric tokens or query boundaries", () => {
  for (const [left, right] of [
    ["SELECT a b", "SELECT ab"],
    ["SELECT 1 - - 2", "SELECT 1 -- 2"],
    ["SELECT a ! = b", "SELECT a != b"],
    ["SELECT 1e-2", "SELECT 1e - 2"],
    ["SELECT 1; SELECT 2", "SELECT 1 SELECT 2"],
    ["SELECT foo$bar$", "SELECT foo $bar$$bar$"],
    ["SELECT 1::integer", "SELECT 1: :integer"],
    ["SELECT $1", "SELECT $ 1"],
    ["SELECT 1..2", "SELECT 1. .2"],
    ["SELECT x:=1", "SELECT x: =1"],
  ])
    assert.notEqual(fp(left), fp(right));
});

test("preserves significant newline distinction between adjacent string constants", () => {
  assert.notEqual(fp("SELECT 'a'\n'b'"), fp("SELECT 'a' 'b'"));
  assert.equal(fp("SELECT 'a'\r\n'b'"), fp("SELECT 'a'\n\t'b'"));
  assert.notEqual(fp("SELECT 'a'\n'b'"), fp("SELECT 'ab'"));
  assert.notEqual(fp("SELECT 'a'\n/* comment */'b'"), fp("SELECT 'a'\n'b'"));
  assert.notEqual(fp("SELECT 'a'/*\n comment */'b'"), fp("SELECT 'a'\n'b'"));
  assert.equal(fp("SELECT 'a'-- comment\n'b'"), fp("SELECT 'a'\n'b'"));
  assert.equal(
    fp(String.raw`SELECT E'a'
'b\'c'`),
    fp(String.raw`SELECT E'a'
   'b\'c'`),
  );
});

test("fails closed on malformed quoted tokens/comments and lexical setting changes", () => {
  for (const sql of [
    "SELECT 'oops",
    'SELECT "oops',
    "DO $tag$oops",
    "SELECT /* outer /* inner */",
    "SET standard_conforming_strings = off; SELECT 1",
    'SET "standard_conforming_strings" = off; SELECT 1',
  ]) {
    assert.throws(() => fp(sql), /Unterminated|Unsupported/);
  }
});

test("fingerprints use SHA-256 and match Node crypto for ASCII and Unicode", () => {
  for (const text of ["", "abc", "migrations: ação 𐐀", "a".repeat(1000)]) {
    assert.equal(tools.sha256(text), createHash("sha256").update(text).digest("hex"));
  }
});

test("safe comparison report contains only names, versions, hashes and diff kinds", () => {
  const secret = "synthetic-private-value";
  const local = [{ version: "01", name: "example", statements: [`SELECT '${secret}'`] }];
  const remote = [{ version: "02", name: "example", statements: ["SELECT 'other'"] }];
  const report = tools.compare(local, remote);
  assert.equal(report.pairs[0].status, "different");
  assert.deepEqual(report.pairs[0].differenceKinds, ["quoted-content"]);
  assert.equal(JSON.stringify(report).includes(secret), false);
  assert.equal(report.summary.different, 1);
});

test("line-ending diagnostics inside quoted tokens never turn a difference into equality", () => {
  const report = tools.compare(
    [{ version: "1", name: "body", statements: ["DO $$BEGIN\r\n NULL; END$$"] }],
    [{ version: "1", name: "body", statements: ["DO $$BEGIN\n NULL; END$$"] }],
  );
  assert.equal(report.pairs[0].status, "different");
  assert.equal(report.pairs[0].quotedDifferenceDiagnostic, "crlf-vs-lf-only");
});

test("a remote application marker cannot substantiate executed migration contents", () => {
  const report = tools.compare(
    [{ version: "1", name: "marker", statements: ["SELECT 1"] }],
    [
      {
        version: "1",
        name: "marker",
        statements: ["Applied from repository migration marker.sql"],
      },
    ],
  );
  assert.equal(report.pairs[0].status, "inconclusive");
  assert.equal(report.pairs[0].remoteMetadataKind, "repository-application-marker");
});
