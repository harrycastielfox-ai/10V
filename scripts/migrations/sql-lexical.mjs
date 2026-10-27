/**
 * Conservative PostgreSQL lexical comparison, not proof of semantic equivalence.
 * Removes comments and insignificant gaps only outside quoted tokens. Quoted
 * bodies (including PL/pgSQL dollar quotes) remain byte-for-byte significant.
 * Assumes standard_conforming_strings=on and refuses SET of that parameter.
 * Query-array boundaries are command boundaries; final semicolons are optional.
 * No SQL is executed. Reports never contain tokens or quoted contents.
 * Reference: https://www.postgresql.org/docs/current/sql-syntax-lexical.html
 * The factory is self-contained so remote metadata can be compared in memory
 * in a restricted JS runtime without exporting SQL or requiring Node APIs.
 */
export function createSqlLexicalTools() {
  const constants = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ];
  const rotate = (x, n) => (x >>> n) | (x << (32 - n));
  function sha256(text) {
    const bytes = [];
    for (const char of text) {
      let cp = char.codePointAt(0);
      if (cp >= 0xd800 && cp <= 0xdfff) cp = 0xfffd;
      if (cp < 128) bytes.push(cp);
      else if (cp < 2048) bytes.push(192 | (cp >>> 6), 128 | (cp & 63));
      else if (cp < 65536) bytes.push(224 | (cp >>> 12), 128 | ((cp >>> 6) & 63), 128 | (cp & 63));
      else
        bytes.push(
          240 | (cp >>> 18),
          128 | ((cp >>> 12) & 63),
          128 | ((cp >>> 6) & 63),
          128 | (cp & 63),
        );
    }
    const bitLength = bytes.length * 8;
    bytes.push(128);
    while (bytes.length % 64 !== 56) bytes.push(0);
    const high = Math.floor(bitLength / 0x100000000);
    for (const word of [high, bitLength >>> 0]) {
      bytes.push((word >>> 24) & 255, (word >>> 16) & 255, (word >>> 8) & 255, word & 255);
    }
    const state = [
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab,
      0x5be0cd19,
    ];
    for (let offset = 0; offset < bytes.length; offset += 64) {
      const w = new Array(64);
      for (let i = 0; i < 16; i++) {
        const p = offset + i * 4;
        w[i] = (bytes[p] << 24) | (bytes[p + 1] << 16) | (bytes[p + 2] << 8) | bytes[p + 3];
      }
      for (let i = 16; i < 64; i++) {
        const a = w[i - 15],
          b = w[i - 2];
        w[i] =
          (w[i - 16] +
            (rotate(a, 7) ^ rotate(a, 18) ^ (a >>> 3)) +
            w[i - 7] +
            (rotate(b, 17) ^ rotate(b, 19) ^ (b >>> 10))) |
          0;
      }
      let [a, b, c, d, e, f, g, h] = state;
      for (let i = 0; i < 64; i++) {
        const t1 =
          (h +
            (rotate(e, 6) ^ rotate(e, 11) ^ rotate(e, 25)) +
            ((e & f) ^ (~e & g)) +
            constants[i] +
            w[i]) |
          0;
        const t2 =
          ((rotate(a, 2) ^ rotate(a, 13) ^ rotate(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        h = g;
        g = f;
        f = e;
        e = (d + t1) | 0;
        d = c;
        c = b;
        b = a;
        a = (t1 + t2) | 0;
      }
      [a, b, c, d, e, f, g, h].forEach((value, i) => {
        state[i] = (state[i] + value) | 0;
      });
    }
    return state.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
  }

  const isWordStart = (c) => !!c && /[A-Za-z_\u0080-\uFFFF]/.test(c);
  const isWordPart = (c) => !!c && /[A-Za-z_0-9$\u0080-\uFFFF]/.test(c);
  const isOperator = (c) => !!c && /[+\-*/<>=~!@#%^&|`?]/.test(c);
  const quotedKinds = new Set(["string", "identifier", "dollar"]);

  function tokenize(sql) {
    if (typeof sql !== "string" || sql.includes("\0")) throw new Error("Unsupported SQL input");
    const statements = [];
    let current = [],
      i = 0,
      newline = false,
      blockCommentGap = false,
      previousString = null;
    const push = (kind, raw, escape = false) => {
      if (kind === "string" && previousString)
        current.push([
          "string-gap",
          blockCommentGap ? "block-comment" : newline ? "newline" : "horizontal",
        ]);
      current.push([kind, raw]);
      previousString = kind === "string" ? { escape } : null;
      newline = false;
      blockCommentGap = false;
    };
    const finish = () => {
      if (current.length) statements.push(current);
      current = [];
      previousString = null;
      newline = false;
      blockCommentGap = false;
    };
    const readQuoted = (quoteAt, quote, escape) => {
      let end = quoteAt + 1;
      while (end < sql.length) {
        if (escape && sql[end] === "\\") {
          end += 2;
          continue;
        }
        if (sql[end] === quote) {
          if (sql[end + 1] === quote) {
            end += 2;
            continue;
          }
          return end + 1;
        }
        end++;
      }
      throw new Error(`Unterminated quoted token at offset ${quoteAt}`);
    };
    while (i < sql.length) {
      const start = i,
        c = sql[i];
      if (/[ \t\r\n\f\v]/.test(c) || (i === 0 && c === "\uFEFF")) {
        if (c === "\r" || c === "\n") newline = true;
        i++;
        continue;
      }
      if (sql.startsWith("--", i)) {
        i += 2;
        while (i < sql.length && sql[i] !== "\r" && sql[i] !== "\n") i++;
        continue;
      }
      if (sql.startsWith("/*", i)) {
        blockCommentGap = true;
        let depth = 1;
        i += 2;
        while (i < sql.length && depth) {
          if (sql.startsWith("/*", i)) {
            depth++;
            i += 2;
          } else if (sql.startsWith("*/", i)) {
            depth--;
            i += 2;
          } else {
            if (sql[i] === "\n" || sql[i] === "\r") newline = true;
            i++;
          }
        }
        if (depth) throw new Error(`Unterminated block comment at offset ${start}`);
        continue;
      }
      if (c === ";") {
        finish();
        i++;
        continue;
      }
      let prefixLength = 0,
        quote = c;
      if (/[eEbBxXnN]/.test(c) && sql[i + 1] === "'") {
        prefixLength = 1;
        quote = "'";
      } else if (/[uU]/.test(c) && sql[i + 1] === "&" && ["'", '"'].includes(sql[i + 2])) {
        prefixLength = 2;
        quote = sql[i + 2];
      }
      if (quote === "'" || quote === '"') {
        const escape =
          quote === "'" &&
          ((prefixLength === 1 && /e/i.test(c)) ||
            (prefixLength === 0 && newline && !blockCommentGap && previousString?.escape === true));
        i = readQuoted(i + prefixLength, quote, escape);
        push(quote === "'" ? "string" : "identifier", sql.slice(start, i), escape);
        continue;
      }
      if (c === "$") {
        const tag = sql
          .slice(i)
          .match(/^\$(?:[A-Za-z_\u0080-\uFFFF][A-Za-z_0-9\u0080-\uFFFF]*)?\$/)?.[0];
        if (tag) {
          const end = sql.indexOf(tag, i + tag.length);
          if (end < 0) throw new Error(`Unterminated dollar quote at offset ${i}`);
          i = end + tag.length;
          push("dollar", sql.slice(start, i));
          continue;
        }
        const parameter = sql.slice(i).match(/^\$[0-9]+/)?.[0];
        if (parameter) {
          i += parameter.length;
          push("parameter", parameter);
          continue;
        }
      }
      if (isWordStart(c)) {
        i++;
        while (isWordPart(sql[i])) i++;
        push("word", sql.slice(start, i));
        continue;
      }
      const number = sql
        .slice(i)
        .match(
          /^(?:0[xX][0-9a-fA-F_]+|0[oO][0-7_]+|0[bB][01_]+|(?:[0-9][0-9_]*(?:\.(?!\.)[0-9_]*)?|\.[0-9][0-9_]*)(?:[eE][+-]?[0-9_]+)?)/,
        )?.[0];
      if (number) {
        i += number.length;
        push("number", number);
        continue;
      }
      const compound = ["::", ":=", ".."].find((token) => sql.startsWith(token, i));
      if (compound) {
        i += compound.length;
        push("punctuation", compound);
        continue;
      }
      if (isOperator(c)) {
        i++;
        while (isOperator(sql[i]) && !sql.startsWith("--", i) && !sql.startsWith("/*", i)) i++;
        push("operator", sql.slice(start, i));
        continue;
      }
      i++;
      push("punctuation", c);
    }
    finish();
    for (const statement of statements) {
      if (
        statement[0]?.[0] === "word" &&
        /^set$/i.test(statement[0][1]) &&
        statement.some(
          ([kind, raw]) =>
            (kind === "word" && /^standard_conforming_strings$/i.test(raw)) ||
            (kind === "identifier" && /^"standard_conforming_strings"$/i.test(raw)),
        )
      ) {
        throw new Error("Unsupported lexical setting change: standard_conforming_strings");
      }
    }
    return statements;
  }

  function tokensFrom(statements) {
    if (!Array.isArray(statements) || statements.some((x) => typeof x !== "string"))
      throw new Error("Unsupported missing statement metadata");
    return statements.flatMap(tokenize);
  }
  function describe(statements) {
    const commands = tokensFrom(statements);
    return {
      fingerprint: sha256(JSON.stringify(commands)),
      textFingerprint: sha256(statements.join("\n")),
      structureFingerprint: sha256(
        JSON.stringify(
          commands.map((command) =>
            command.map(([kind, raw]) => [kind, quotedKinds.has(kind) ? "<quoted>" : raw]),
          ),
        ),
      ),
      quotedFingerprint: sha256(
        JSON.stringify(
          commands.map((command) => command.filter(([kind]) => quotedKinds.has(kind))),
        ),
      ),
      // Diagnostic only: never used by the equality decision. CRLF inside a
      // quoted token is significant and remains different in fingerprint.
      quotedLfDiagnosticFingerprint: sha256(
        JSON.stringify(
          commands.map((command) =>
            command
              .filter(([kind]) => quotedKinds.has(kind))
              .map(([kind, raw]) => [kind, raw.replace(/\r\n/g, "\n")]),
          ),
        ),
      ),
      statementCount: commands.length,
      tokenCount: commands.reduce((total, command) => total + command.length, 0),
    };
  }
  const fingerprint = (statements) => describe(statements).fingerprint;
  function commandManifest(statements) {
    const operations = new Set([
      "ALTER",
      "CREATE",
      "DROP",
      "GRANT",
      "REVOKE",
      "COMMENT",
      "INSERT",
      "UPDATE",
      "DELETE",
      "SELECT",
      "DO",
      "WITH",
      "SET",
      "RESET",
      "NOTIFY",
      "BEGIN",
      "COMMIT",
      "ROLLBACK",
      "TRUNCATE",
    ]);
    return tokensFrom(statements).map((command) => ({
      fingerprint: sha256(JSON.stringify(command)),
      operation:
        command[0]?.[0] === "word" && operations.has(command[0][1].toUpperCase())
          ? command[0][1].toUpperCase()
          : "unrecognized",
      quoted: command.flatMap(([kind, raw], position) =>
        quotedKinds.has(kind)
          ? [{ position, kind, fingerprint: sha256(raw), length: raw.length }]
          : [],
      ),
    }));
  }
  function summarize(rows) {
    return rows.map(({ version, name, statements }) => {
      try {
        const metadataKind =
          statements?.length === 1 && /^\s*Applied from repository migration\b/i.test(statements[0])
            ? "repository-application-marker"
            : "sql-statements";
        return { version, name, metadataKind, ...describe(statements) };
      } catch (error) {
        return { version, name, error: error.message };
      }
    });
  }
  function compareSummaries(local, remote) {
    const localMap = new Map();
    for (const row of local) {
      if (localMap.has(row.name)) throw new Error("Unsupported duplicate local migration name");
      localMap.set(row.name, row);
    }
    if (new Set(remote.map((row) => row.name)).size !== remote.length)
      throw new Error("Unsupported duplicate remote migration name");
    const pairs = remote.map((right) => {
      const left = localMap.get(right.name);
      const base = {
        name: right.name,
        localVersion: left?.version ?? null,
        remoteVersion: right.version,
      };
      if (!left) return { ...base, status: "remote-only" };
      if (left.error || right.error)
        return {
          ...base,
          status: "inconclusive",
          localError: left.error ?? null,
          remoteError: right.error ?? null,
        };
      if (
        left.metadataKind === "repository-application-marker" ||
        right.metadataKind === "repository-application-marker"
      ) {
        return {
          ...base,
          status: "inconclusive",
          localMetadataKind: left.metadataKind,
          remoteMetadataKind: right.metadataKind,
          localFingerprint: left.fingerprint,
          remoteFingerprint: right.fingerprint,
          localStatementCount: left.statementCount,
          remoteStatementCount: right.statementCount,
        };
      }
      const differenceKinds = [];
      if (left.structureFingerprint !== right.structureFingerprint)
        differenceKinds.push("token-stream");
      if (left.quotedFingerprint !== right.quotedFingerprint)
        differenceKinds.push("quoted-content");
      if (left.statementCount !== right.statementCount) differenceKinds.push("statement-count");
      return {
        ...base,
        status: left.fingerprint === right.fingerprint ? "lexically-equal" : "different",
        differenceKinds,
        quotedDifferenceDiagnostic:
          left.quotedFingerprint !== right.quotedFingerprint &&
          left.quotedLfDiagnosticFingerprint === right.quotedLfDiagnosticFingerprint
            ? "crlf-vs-lf-only"
            : null,
        rawTextEqual: left.textFingerprint === right.textFingerprint,
        localFingerprint: left.fingerprint,
        remoteFingerprint: right.fingerprint,
        localStatementCount: left.statementCount,
        remoteStatementCount: right.statementCount,
        localTokenCount: left.tokenCount,
        remoteTokenCount: right.tokenCount,
      };
    });
    const remoteNames = new Set(remote.map((row) => row.name));
    const localOnly = local
      .filter((row) => !remoteNames.has(row.name))
      .map(({ name, version }) => ({ name, version }));
    const summary = {
      local: local.length,
      remote: remote.length,
      paired: pairs.filter((pair) => pair.localVersion !== null).length,
      lexicallyEqual: 0,
      different: 0,
      inconclusive: 0,
      remoteOnly: 0,
      localOnly: localOnly.length,
    };
    for (const pair of pairs)
      summary[
        { "lexically-equal": "lexicallyEqual", "remote-only": "remoteOnly" }[pair.status] ??
          pair.status
      ]++;
    return {
      algorithm: "postgresql-lexical-v1-sha256",
      assumptions: [
        "standard_conforming_strings=on",
        "metadata array elements are independent SQL commands",
        "quoted content and letter case remain significant",
        "lexical equality does not prove semantic equivalence or catalog effects",
      ],
      summary,
      pairs,
      localOnly,
    };
  }
  const compare = (local, remote) => compareSummaries(summarize(local), summarize(remote));
  return {
    sha256,
    tokenize,
    fingerprint,
    describe,
    commandManifest,
    summarize,
    compareSummaries,
    compare,
  };
}
