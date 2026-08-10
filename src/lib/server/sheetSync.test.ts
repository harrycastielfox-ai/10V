import { describe, expect, it } from "vitest";

import {
  parseSheetSyncBootstrapCheck,
  parseSheetSyncRecord,
  signSheetSyncBody,
  validateSheetSyncTimestamp,
  verifySheetSyncSignature,
} from "@/lib/server/sheetSync";

const documentId = "1YTA8z0kxnQCxCpV9uMzsjIzYJ-MZ_BEks6j_20L3tMU";

const validRecord = {
  version: 1,
  requestId: "81ecc10a-332e-45d1-91d4-fbcf30fc8df5",
  spreadsheetId: documentId,
  sheetName: "Controle de Inquéritos",
  entity: "inquerito",
  operation: "upsert",
  recordKey: "49ca9271-c0db-43d3-82f0-657fda73982d",
  rowNumber: 2,
  payloadHash: "a".repeat(64),
  payload: { numero_ppe: "123/2026", tipo: "IP" },
};

describe("sheet sync authentication", () => {
  it("validates an HMAC signature and rejects a changed body", async () => {
    const timestamp = "1786388400";
    const body = JSON.stringify(validRecord);
    const signature = await signSheetSyncBody("a-strong-shared-secret", timestamp, body);

    await expect(
      verifySheetSyncSignature("a-strong-shared-secret", timestamp, body, signature),
    ).resolves.toBe(true);
    await expect(
      verifySheetSyncSignature("a-strong-shared-secret", timestamp, `${body} `, signature),
    ).resolves.toBe(false);
  });

  it("rejects stale timestamps", () => {
    expect(validateSheetSyncTimestamp("1786388400", 1_786_388_400_000)).toBe(true);
    expect(validateSheetSyncTimestamp("1786388000", 1_786_388_400_000)).toBe(false);
    expect(validateSheetSyncTimestamp("not-a-time", 1_786_388_400_000)).toBe(false);
  });
});

describe("sheet sync payload validation", () => {
  it("accepts a known sheet and its matching entity", () => {
    expect(parseSheetSyncRecord(validRecord, documentId)).toMatchObject({
      entity: "inquerito",
      operation: "upsert",
      rowNumber: 2,
    });
  });

  it("rejects another spreadsheet even when the payload looks valid", () => {
    expect(() =>
      parseSheetSyncRecord({ ...validRecord, spreadsheetId: "another-document" }, documentId),
    ).toThrow("unexpected_spreadsheet");
  });

  it("rejects a sheet/entity mismatch and unknown database fields", () => {
    expect(() =>
      parseSheetSyncRecord({ ...validRecord, entity: "representacao" }, documentId),
    ).toThrow("sheet_entity_mismatch");
    expect(() =>
      parseSheetSyncRecord(
        { ...validRecord, payload: { numero_ppe: "123/2026", deleted_at: "2026-08-10" } },
        documentId,
      ),
    ).toThrow("unknown_payload_field");
  });

  it("accepts only one bootstrap digest for each supported source sheet", () => {
    const bootstrap = {
      version: 1,
      mode: "bootstrap_check",
      requestId: validRecord.requestId,
      spreadsheetId: documentId,
      sheets: [
        {
          sheetName: "Controle de Inquéritos",
          rowCount: 767,
          keyDigest: "a".repeat(64),
        },
        {
          sheetName: "Representações Judiciais",
          rowCount: 12,
          keyDigest: "b".repeat(64),
        },
      ],
    };
    expect(parseSheetSyncBootstrapCheck(bootstrap, documentId).sheets).toHaveLength(2);
    expect(() =>
      parseSheetSyncBootstrapCheck(
        { ...bootstrap, sheets: [bootstrap.sheets[0], bootstrap.sheets[0]] },
        documentId,
      ),
    ).toThrow("invalid_bootstrap_sheet");
  });
});
