const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECORD_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/i;

export const SHEET_SYNC_MAX_BODY_BYTES = 256 * 1024;
export const SHEET_SYNC_MAX_CLOCK_SKEW_SECONDS = 5 * 60;

const SHEET_ENTITY_MAP = {
  "Controle de Inquéritos": "inquerito",
  "Representações Judiciais": "representacao",
} as const;

const ALLOWED_PAYLOAD_FIELDS = {
  inquerito: new Set([
    "numero_ppe",
    "numero_fisico",
    "numero_bo",
    "tipo",
    "tipificacao",
    "gravidade",
    "prioridade",
    "situacao",
    "status_diligencias",
    "data_fato",
    "data_instauracao",
    "prazo",
    "bairro",
    "distrito",
    "vitima",
    "investigado",
    "reu_preso",
    "elucidado",
    "faccao",
    "nome_faccao",
    "equipe",
    "escrivao",
    "relatorio_enviado",
    "data_envio_relatorio",
    "medida_protetiva",
    "numero_processo_medida",
    "observacoes",
    "motivacao",
    "diligencias_pendentes",
    "representacoes_legais",
    "dias_decorridos",
    "autoria_determinada",
  ]),
  representacao: new Set([
    "numero_ppe",
    "processo_judicial",
    "tipo",
    "data_representacao",
    "responsavel",
    "vitima",
    "investigado",
    "status",
    "data_decisao_judicial",
    "observacoes_decisao",
    "data_cumprimento",
    "equipe_cumprimento",
    "resultado_cumprimento",
    "observacoes_cumprimento",
    "vara_juizo",
    "prazo_concedido_dias",
    "data_vencimento",
    "equipe_responsavel",
    "cumprimento_status",
    "observacoes_internas",
  ]),
} as const;

type SheetEntity = (typeof SHEET_ENTITY_MAP)[keyof typeof SHEET_ENTITY_MAP];

export type SheetSyncRecord = {
  version: 1;
  requestId: string;
  spreadsheetId: string;
  sheetName: keyof typeof SHEET_ENTITY_MAP;
  entity: SheetEntity;
  operation: "upsert" | "delete";
  recordKey: string;
  rowNumber: number | null;
  payloadHash: string | null;
  payload: Record<string, string | number | boolean | null>;
};

export type SheetSyncBootstrapCheck = {
  version: 1;
  mode: "bootstrap_check";
  requestId: string;
  spreadsheetId: string;
  sheets: Array<{
    sheetName: keyof typeof SHEET_ENTITY_MAP;
    rowCount: number;
    keyDigest: string;
  }>;
};

export class SheetSyncValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SheetSyncValidationError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value: unknown, field: string, maxLength: number) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    throw new SheetSyncValidationError(`invalid_${field}`);
  }
  return value.trim();
}

function toHex(bytes: ArrayBuffer) {
  return Array.from(new Uint8Array(bytes), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function fromHex(value: string) {
  if (value.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(value)) return null;
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function constantTimeEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) {
    difference |= left[index] ^ right[index];
  }
  return difference === 0;
}

export async function signSheetSyncBody(secret: string, timestamp: string, body: string) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toHex(await crypto.subtle.sign("HMAC", key, encoder.encode(`${timestamp}.${body}`)));
}

export async function verifySheetSyncSignature(
  secret: string,
  timestamp: string,
  body: string,
  suppliedSignature: string,
) {
  const expected = fromHex(await signSheetSyncBody(secret, timestamp, body));
  const supplied = fromHex(suppliedSignature.trim());
  return Boolean(expected && supplied && constantTimeEqual(expected, supplied));
}

export function validateSheetSyncTimestamp(
  timestamp: string,
  nowMilliseconds = Date.now(),
  maxSkewSeconds = SHEET_SYNC_MAX_CLOCK_SKEW_SECONDS,
) {
  if (!/^\d{10}$/.test(timestamp)) return false;
  const requestMilliseconds = Number(timestamp) * 1000;
  return Math.abs(nowMilliseconds - requestMilliseconds) <= maxSkewSeconds * 1000;
}

export function parseSheetSyncRecord(raw: unknown, expectedSpreadsheetId: string): SheetSyncRecord {
  if (!isPlainObject(raw)) throw new SheetSyncValidationError("invalid_body");
  if (raw.version !== 1) throw new SheetSyncValidationError("unsupported_version");

  const requestId = requiredString(raw.requestId, "request_id", 36);
  if (!UUID_PATTERN.test(requestId)) throw new SheetSyncValidationError("invalid_request_id");

  const spreadsheetId = requiredString(raw.spreadsheetId, "spreadsheet_id", 128);
  if (spreadsheetId !== expectedSpreadsheetId) {
    throw new SheetSyncValidationError("unexpected_spreadsheet");
  }

  const sheetName = requiredString(raw.sheetName, "sheet_name", 80);
  if (!(sheetName in SHEET_ENTITY_MAP)) {
    throw new SheetSyncValidationError("unsupported_sheet");
  }

  const expectedEntity = SHEET_ENTITY_MAP[sheetName as keyof typeof SHEET_ENTITY_MAP];
  if (raw.entity !== expectedEntity) throw new SheetSyncValidationError("sheet_entity_mismatch");

  if (raw.operation !== "upsert" && raw.operation !== "delete") {
    throw new SheetSyncValidationError("invalid_operation");
  }

  const recordKey = requiredString(raw.recordKey, "record_key", 128);
  if (!RECORD_KEY_PATTERN.test(recordKey)) {
    throw new SheetSyncValidationError("invalid_record_key");
  }

  const rowNumber = raw.rowNumber === null || raw.rowNumber === undefined ? null : raw.rowNumber;
  if (
    rowNumber !== null &&
    (typeof rowNumber !== "number" ||
      !Number.isInteger(rowNumber) ||
      rowNumber < 2 ||
      rowNumber > 100_000)
  ) {
    throw new SheetSyncValidationError("invalid_row_number");
  }

  const payloadHash =
    raw.payloadHash === null || raw.payloadHash === undefined ? null : raw.payloadHash;
  if (
    payloadHash !== null &&
    (typeof payloadHash !== "string" || !SHA256_PATTERN.test(payloadHash))
  ) {
    throw new SheetSyncValidationError("invalid_payload_hash");
  }

  const payloadSource = raw.payload ?? {};
  if (!isPlainObject(payloadSource)) throw new SheetSyncValidationError("invalid_payload");
  if (raw.operation === "upsert" && Object.keys(payloadSource).length === 0) {
    throw new SheetSyncValidationError("empty_upsert_payload");
  }

  const payload: SheetSyncRecord["payload"] = {};
  const allowedFields = ALLOWED_PAYLOAD_FIELDS[expectedEntity];
  for (const [key, value] of Object.entries(payloadSource)) {
    if (!allowedFields.has(key)) throw new SheetSyncValidationError("unknown_payload_field");
    if (
      value !== null &&
      typeof value !== "string" &&
      typeof value !== "number" &&
      typeof value !== "boolean"
    ) {
      throw new SheetSyncValidationError("invalid_payload_value");
    }
    if (typeof value === "string" && value.length > 50_000) {
      throw new SheetSyncValidationError("payload_value_too_large");
    }
    payload[key] = value;
  }

  return {
    version: 1,
    requestId,
    spreadsheetId,
    sheetName: sheetName as keyof typeof SHEET_ENTITY_MAP,
    entity: expectedEntity,
    operation: raw.operation,
    recordKey,
    rowNumber: rowNumber as number | null,
    payloadHash: payloadHash as string | null,
    payload,
  };
}

export function parseSheetSyncBootstrapCheck(
  raw: unknown,
  expectedSpreadsheetId: string,
): SheetSyncBootstrapCheck {
  if (!isPlainObject(raw)) throw new SheetSyncValidationError("invalid_body");
  if (raw.version !== 1 || raw.mode !== "bootstrap_check") {
    throw new SheetSyncValidationError("unsupported_version");
  }

  const requestId = requiredString(raw.requestId, "request_id", 36);
  if (!UUID_PATTERN.test(requestId)) throw new SheetSyncValidationError("invalid_request_id");

  const spreadsheetId = requiredString(raw.spreadsheetId, "spreadsheet_id", 128);
  if (spreadsheetId !== expectedSpreadsheetId) {
    throw new SheetSyncValidationError("unexpected_spreadsheet");
  }
  if (!Array.isArray(raw.sheets) || raw.sheets.length !== 2) {
    throw new SheetSyncValidationError("invalid_bootstrap_sheets");
  }

  const seen = new Set<string>();
  const sheets: SheetSyncBootstrapCheck["sheets"] = raw.sheets.map((sheet) => {
    if (!isPlainObject(sheet)) throw new SheetSyncValidationError("invalid_bootstrap_sheet");
    const sheetName = requiredString(sheet.sheetName, "sheet_name", 80);
    if (!(sheetName in SHEET_ENTITY_MAP) || seen.has(sheetName)) {
      throw new SheetSyncValidationError("invalid_bootstrap_sheet");
    }
    seen.add(sheetName);
    if (
      typeof sheet.rowCount !== "number" ||
      !Number.isInteger(sheet.rowCount) ||
      sheet.rowCount < 0
    ) {
      throw new SheetSyncValidationError("invalid_bootstrap_count");
    }
    if (typeof sheet.keyDigest !== "string" || !SHA256_PATTERN.test(sheet.keyDigest)) {
      throw new SheetSyncValidationError("invalid_bootstrap_digest");
    }
    return {
      sheetName: sheetName as keyof typeof SHEET_ENTITY_MAP,
      rowCount: sheet.rowCount,
      keyDigest: sheet.keyDigest.toLowerCase(),
    };
  });

  return { version: 1, mode: "bootstrap_check", requestId, spreadsheetId, sheets };
}
