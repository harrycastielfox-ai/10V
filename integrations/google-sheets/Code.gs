const SIPI_SYNC = Object.freeze({
  VERSION: 1,
  SPREADSHEET_ID: "1YTA8z0kxnQCxCpV9uMzsjIzYJ-MZ_BEks6j_20L3tMU",
  DEFAULT_API_URL: "https://sipi-dt-itabela.sipi-dt-itabela.workers.dev/api/sheet-sync",
  KEY_HEADER: "SIPI_SYNC_ID",
  LEDGER_SHEET: "_SIPI_SYNC_LEDGER",
  MISSING_SCANS_BEFORE_DELETE: 2,
  INITIAL_NEW_KEYS: new Set([
    "sipi-3a08bdd5faee852fe7779752f00227ae-01",
    "sipi-f11bc21b64301ff90479ea7ca963963a-01",
  ]),
  SOURCES: Object.freeze({
    "Controle de Inquéritos": Object.freeze({ entity: "inquerito", minimumColumns: 31 }),
    "Representações Judiciais": Object.freeze({
      entity: "representacao",
      minimumColumns: 20,
    }),
  }),
});

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu("SIPI")
    .addItem("Configurar conexão", "configureSipiSync")
    .addItem("Instalar e validar sincronização", "setupSipiSync")
    .addSeparator()
    .addItem("Sincronizar agora", "syncSipiChanges")
    .addItem("Ver status", "showSipiSyncStatus")
    .addToUi();
}

function configureSipiSync() {
  const ui = SpreadsheetApp.getUi();
  const properties = PropertiesService.getScriptProperties();
  const currentUrl = properties.getProperty("SIPI_API_URL") || SIPI_SYNC.DEFAULT_API_URL;
  const urlPrompt = ui.prompt(
    "SIPI · endpoint protegido",
    `Confirme a URL do endpoint:\n${currentUrl}`,
    ui.ButtonSet.OK_CANCEL,
  );
  if (urlPrompt.getSelectedButton() !== ui.Button.OK) return;
  const apiUrl = urlPrompt.getResponseText().trim() || currentUrl;
  if (!/^https:\/\//i.test(apiUrl)) throw new Error("A URL precisa usar HTTPS.");

  const secretPrompt = ui.prompt(
    "SIPI · segredo compartilhado",
    "Cole o segredo fornecido para esta integração. Ele será guardado nas propriedades do script, nunca em uma célula.",
    ui.ButtonSet.OK_CANCEL,
  );
  if (secretPrompt.getSelectedButton() !== ui.Button.OK) return;
  const secret = secretPrompt.getResponseText().trim();
  if (secret.length < 32) throw new Error("O segredo precisa ter pelo menos 32 caracteres.");

  properties.setProperties({ SIPI_API_URL: apiUrl, SIPI_SHARED_SECRET: secret }, false);
  ui.alert("Conexão salva. Agora use “Instalar e validar sincronização”.");
}

function setupSipiSync() {
  const lock = LockService.getDocumentLock();
  lock.waitLock(30_000);
  try {
    const spreadsheet = requireOfficialSpreadsheet_();
    requireConnection_();

    // Calcula e valida todas as chaves antes de alterar a planilha oficial.
    const bootstrap = Object.keys(SIPI_SYNC.SOURCES).map((sheetName) =>
      buildBootstrapSheet_(spreadsheet.getSheetByName(sheetName), sheetName),
    );
    verifyBootstrap_(bootstrap);

    bootstrap.forEach((source) => writeBootstrapKeys_(source));
    const ledger = ensureLedgerSheet_(spreadsheet);
    const previous = readLedger_(ledger);
    const initialRows = [];

    bootstrap.forEach((source) => {
      source.rows.forEach((row) => {
        const payload = payloadForRow_(source.sheetName, row.values, spreadsheet.getSpreadsheetTimeZone());
        const payloadHash = sha256Hex_(JSON.stringify(payload));
        if (SIPI_SYNC.INITIAL_NEW_KEYS.has(row.recordKey)) {
          sendRecord_({
            sheetName: source.sheetName,
            entity: SIPI_SYNC.SOURCES[source.sheetName].entity,
            operation: "upsert",
            recordKey: row.recordKey,
            rowNumber: row.rowNumber,
            payload,
            payloadHash,
          });
        }
        initialRows.push({
          recordKey: row.recordKey,
          sheetName: source.sheetName,
          payloadHash,
          state: "active",
          missingScans: 0,
          lastSeenAt: new Date(),
        });
      });
    });

    // Recria apenas o ledger técnico; nenhuma aba operacional é reformatada.
    writeLedger_(ledger, mergeLedger_(previous, initialRows));
    installTriggers_();
    PropertiesService.getScriptProperties().setProperty("SIPI_SYNC_ACTIVE", "true");
    SpreadsheetApp.getUi().alert(
      `Sincronização validada e instalada. ${initialRows.length} registros rastreados; ` +
        `${SIPI_SYNC.INITIAL_NEW_KEYS.size} novos registros enviados ao SIPI.`,
    );
  } finally {
    lock.releaseLock();
  }
}

function syncSipiChanges() {
  const lock = LockService.getDocumentLock();
  if (!lock.tryLock(5_000)) return;
  try {
    if (PropertiesService.getScriptProperties().getProperty("SIPI_SYNC_ACTIVE") !== "true") {
      throw new Error("A sincronização ainda não foi instalada e validada.");
    }
    const spreadsheet = requireOfficialSpreadsheet_();
    requireConnection_();
    const ledgerSheet = ensureLedgerSheet_(spreadsheet);
    const ledger = readLedger_(ledgerSheet);
    const currentKeys = new Set();
    let sent = 0;
    let deleted = 0;

    Object.keys(SIPI_SYNC.SOURCES).forEach((sheetName) => {
      const sheet = spreadsheet.getSheetByName(sheetName);
      if (!sheet) throw new Error(`Aba obrigatória ausente: ${sheetName}`);
      const keyColumn = ensureKeyColumn_(sheet);
      const lastRow = sheet.getLastRow();
      if (lastRow < 2) return;
      const width = SIPI_SYNC.SOURCES[sheetName].minimumColumns;
      const values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
      const keys = sheet.getRange(2, keyColumn, lastRow - 1, 1).getDisplayValues();

      values.forEach((rowValues, index) => {
        if (!rowHasData_(rowValues)) return;
        const rowNumber = index + 2;
        let recordKey = String(keys[index][0] || "").trim();
        if (!recordKey) {
          recordKey = `sipi-${Utilities.getUuid()}`;
          sheet.getRange(rowNumber, keyColumn).setValue(recordKey);
        }
        if (currentKeys.has(recordKey)) throw new Error(`Chave SIPI repetida na linha ${rowNumber}.`);
        currentKeys.add(recordKey);

        const payload = payloadForRow_(sheetName, rowValues, spreadsheet.getSpreadsheetTimeZone());
        const payloadHash = sha256Hex_(JSON.stringify(payload));
        const previous = ledger.get(recordKey);
        if (!previous || previous.payloadHash !== payloadHash || previous.state !== "active") {
          sendRecord_({
            sheetName,
            entity: SIPI_SYNC.SOURCES[sheetName].entity,
            operation: "upsert",
            recordKey,
            rowNumber,
            payload,
            payloadHash,
          });
          sent += 1;
        }
        ledger.set(recordKey, {
          recordKey,
          sheetName,
          payloadHash,
          state: "active",
          missingScans: 0,
          lastSeenAt: new Date(),
        });
      });
    });

    ledger.forEach((entry, recordKey) => {
      if (currentKeys.has(recordKey) || entry.state === "deleted") return;
      entry.missingScans += 1;
      if (entry.missingScans >= SIPI_SYNC.MISSING_SCANS_BEFORE_DELETE) {
        sendRecord_({
          sheetName: entry.sheetName,
          entity: SIPI_SYNC.SOURCES[entry.sheetName].entity,
          operation: "delete",
          recordKey,
          rowNumber: null,
          payload: {},
          payloadHash: null,
        });
        entry.state = "deleted";
        deleted += 1;
      }
      ledger.set(recordKey, entry);
    });

    writeLedger_(ledgerSheet, ledger);
    PropertiesService.getScriptProperties().setProperties(
      {
        SIPI_LAST_SYNC_AT: new Date().toISOString(),
        SIPI_LAST_SYNC_RESULT: JSON.stringify({ sent, deleted }),
      },
      false,
    );
  } finally {
    lock.releaseLock();
  }
}

function handleSipiEdit(event) {
  if (!event || !event.range || event.range.getRow() < 2) return;
  const sheetName = event.range.getSheet().getName();
  if (!SIPI_SYNC.SOURCES[sheetName]) return;
  syncSipiChanges();
}

function handleSipiChange(event) {
  if (!event || !["INSERT_ROW", "REMOVE_ROW"].includes(event.changeType)) return;
  syncSipiChanges();
}

function showSipiSyncStatus() {
  const properties = PropertiesService.getScriptProperties();
  const active = properties.getProperty("SIPI_SYNC_ACTIVE") === "true" ? "Ativa" : "Não instalada";
  const lastSync = properties.getProperty("SIPI_LAST_SYNC_AT") || "Ainda não executada";
  const result = properties.getProperty("SIPI_LAST_SYNC_RESULT") || "{}";
  SpreadsheetApp.getUi().alert(
    `SIPI · Sincronização\n\nSituação: ${active}\nÚltima execução: ${lastSync}\nResultado: ${result}`,
  );
}

function buildBootstrapSheet_(sheet, sheetName) {
  if (!sheet) throw new Error(`Aba obrigatória ausente: ${sheetName}`);
  const width = SIPI_SYNC.SOURCES[sheetName].minimumColumns;
  const lastRow = sheet.getLastRow();
  const values = lastRow >= 2 ? sheet.getRange(2, 1, lastRow - 1, width).getValues() : [];
  const occurrences = new Map();
  const rows = [];
  values.forEach((rowValues, index) => {
    if (!rowHasData_(rowValues)) return;
    const signature = bootstrapSignature_(sheetName, rowValues, sheet.getParent().getSpreadsheetTimeZone());
    const canonical = JSON.stringify(signature);
    const occurrence = (occurrences.get(canonical) || 0) + 1;
    occurrences.set(canonical, occurrence);
    const digest = sha256Hex_(`${SIPI_SYNC.SPREADSHEET_ID}:${sheetName}:${canonical}`).slice(0, 32);
    rows.push({
      rowNumber: index + 2,
      values: rowValues,
      recordKey: `sipi-${digest}-${String(occurrence).padStart(2, "0")}`,
    });
  });
  return { sheet, sheetName, rows };
}

function verifyBootstrap_(bootstrap) {
  const body = {
    version: SIPI_SYNC.VERSION,
    mode: "bootstrap_check",
    requestId: Utilities.getUuid(),
    spreadsheetId: SIPI_SYNC.SPREADSHEET_ID,
    sheets: bootstrap.map((source) => ({
      sheetName: source.sheetName,
      rowCount: source.rows.length,
      keyDigest: sha256Hex_(
        source.rows
          .map((row) => row.recordKey)
          .sort()
          .join("\n"),
      ),
    })),
  };
  sendSignedRequest_(body);
}

function writeBootstrapKeys_(source) {
  const keyColumn = ensureKeyColumn_(source.sheet);
  if (!source.rows.length) return;
  const firstDataRow = 2;
  const lastDataRow = Math.max(...source.rows.map((row) => row.rowNumber));
  const keyValues = Array.from({ length: lastDataRow - firstDataRow + 1 }, () => [""]);
  source.rows.forEach((row) => {
    keyValues[row.rowNumber - firstDataRow][0] = row.recordKey;
  });
  source.sheet.getRange(firstDataRow, keyColumn, keyValues.length, 1).setValues(keyValues);
  source.sheet.hideColumns(keyColumn);
}

function ensureKeyColumn_(sheet) {
  const lastColumn = Math.max(sheet.getLastColumn(), SIPI_SYNC.SOURCES[sheet.getName()].minimumColumns);
  const headers = sheet.getRange(1, 1, 1, lastColumn).getDisplayValues()[0];
  let index = headers.findIndex((header) => String(header).trim() === SIPI_SYNC.KEY_HEADER);
  if (index === -1) {
    index = lastColumn;
    sheet.getRange(1, index + 1).setValue(SIPI_SYNC.KEY_HEADER);
  }
  sheet.hideColumns(index + 1);
  return index + 1;
}

function ensureLedgerSheet_(spreadsheet) {
  let sheet = spreadsheet.getSheetByName(SIPI_SYNC.LEDGER_SHEET);
  if (!sheet) sheet = spreadsheet.insertSheet(SIPI_SYNC.LEDGER_SHEET);
  sheet.getRange(1, 1, 1, 6).setValues([
    ["record_key", "sheet_name", "payload_hash", "state", "missing_scans", "last_seen_at"],
  ]);
  sheet.hideSheet();
  return sheet;
}

function readLedger_(sheet) {
  const ledger = new Map();
  if (sheet.getLastRow() < 2) return ledger;
  sheet
    .getRange(2, 1, sheet.getLastRow() - 1, 6)
    .getValues()
    .forEach((row) => {
      const recordKey = String(row[0] || "").trim();
      if (!recordKey) return;
      ledger.set(recordKey, {
        recordKey,
        sheetName: String(row[1] || ""),
        payloadHash: String(row[2] || ""),
        state: String(row[3] || "active"),
        missingScans: Number(row[4] || 0),
        lastSeenAt: row[5] || new Date(),
      });
    });
  return ledger;
}

function mergeLedger_(existing, rows) {
  const merged = new Map(existing);
  rows.forEach((row) => merged.set(row.recordKey, row));
  return merged;
}

function writeLedger_(sheet, ledger) {
  if (sheet.getLastRow() > 1) sheet.getRange(2, 1, sheet.getLastRow() - 1, 6).clearContent();
  const rows = Array.from(ledger.values())
    .sort((left, right) => left.recordKey.localeCompare(right.recordKey))
    .map((entry) => [
      entry.recordKey,
      entry.sheetName,
      entry.payloadHash,
      entry.state,
      entry.missingScans,
      entry.lastSeenAt,
    ]);
  if (rows.length) sheet.getRange(2, 1, rows.length, 6).setValues(rows);
  sheet.hideSheet();
}

function installTriggers_() {
  const handlers = new Set(["handleSipiEdit", "handleSipiChange", "syncSipiChanges"]);
  ScriptApp.getProjectTriggers().forEach((trigger) => {
    if (handlers.has(trigger.getHandlerFunction())) ScriptApp.deleteTrigger(trigger);
  });
  const spreadsheet = SpreadsheetApp.getActive();
  ScriptApp.newTrigger("handleSipiEdit").forSpreadsheet(spreadsheet).onEdit().create();
  ScriptApp.newTrigger("handleSipiChange").forSpreadsheet(spreadsheet).onChange().create();
  ScriptApp.newTrigger("syncSipiChanges").timeBased().everyMinutes(5).create();
}

function sendRecord_(record) {
  return sendSignedRequest_({
    version: SIPI_SYNC.VERSION,
    requestId: Utilities.getUuid(),
    spreadsheetId: SIPI_SYNC.SPREADSHEET_ID,
    sheetName: record.sheetName,
    entity: record.entity,
    operation: record.operation,
    recordKey: record.recordKey,
    rowNumber: record.rowNumber,
    payloadHash: record.payloadHash,
    payload: record.payload,
  });
}

function sendSignedRequest_(body) {
  const connection = requireConnection_();
  const serialized = JSON.stringify(body);
  const timestamp = String(Math.floor(Date.now() / 1000));
  const signature = bytesToHex_(
    Utilities.computeHmacSha256Signature(`${timestamp}.${serialized}`, connection.secret),
  );
  const response = UrlFetchApp.fetch(connection.apiUrl, {
    method: "post",
    contentType: "application/json",
    payload: serialized,
    headers: { "X-SIPI-Timestamp": timestamp, "X-SIPI-Signature": signature },
    muteHttpExceptions: true,
  });
  const status = response.getResponseCode();
  const parsed = JSON.parse(response.getContentText() || "{}");
  if (status < 200 || status >= 300) {
    throw new Error(`O SIPI recusou a sincronização (${status}: ${parsed.error || "erro"}).`);
  }
  return parsed;
}

function requireConnection_() {
  const properties = PropertiesService.getScriptProperties();
  const apiUrl = properties.getProperty("SIPI_API_URL") || "";
  const secret = properties.getProperty("SIPI_SHARED_SECRET") || "";
  if (!apiUrl || secret.length < 32) {
    throw new Error("Use o menu SIPI > Configurar conexão antes de instalar.");
  }
  return { apiUrl, secret };
}

function requireOfficialSpreadsheet_() {
  const spreadsheet = SpreadsheetApp.getActive();
  if (spreadsheet.getId() !== SIPI_SYNC.SPREADSHEET_ID) {
    throw new Error("Este script só pode operar na planilha oficial autorizada.");
  }
  return spreadsheet;
}

function bootstrapSignature_(sheetName, row, timezone) {
  if (sheetName === "Controle de Inquéritos") {
    return [
      cleanText_(row[0]),
      cleanText_(row[1]),
      dateText_(row[4], timezone),
      cleanText_(row[10]),
      cleanText_(row[8]),
      cleanText_(row[12]),
      cleanText_(row[13]),
    ];
  }
  return [
    cleanText_(row[1]),
    cleanText_(row[7]),
    dateText_(row[4], timezone),
    cleanText_(row[5]),
    cleanText_(row[2]),
    cleanText_(row[3]),
  ];
}

function payloadForRow_(sheetName, row, timezone) {
  if (sheetName === "Controle de Inquéritos") {
    return compactPayload_({
      numero_ppe: nullableText_(row[0]),
      numero_fisico: nullableText_(row[1]),
      prioridade: nullableText_(row[2]),
      data_fato: nullableDate_(row[3], timezone),
      data_instauracao: nullableDate_(row[4], timezone),
      prazo: nullableDate_(row[6], timezone),
      dias_decorridos: nullableText_(row[7]),
      tipificacao: nullableText_(row[8]),
      gravidade: nullableText_(row[9]),
      tipo: nullableText_(row[10]),
      reu_preso: nullableText_(row[11]),
      vitima: nullableText_(row[12]),
      investigado: nullableText_(row[13]),
      autoria_determinada: nullableText_(row[14]),
      faccao: nullableText_(row[15]),
      nome_faccao: nullableText_(row[16]),
      bairro: nullableText_(row[17]),
      motivacao: nullableText_(row[18]),
      equipe: nullableText_(row[19]),
      escrivao: nullableText_(row[20]),
      situacao: nullableText_(row[21]),
      status_diligencias: nullableText_(row[22]),
      diligencias_pendentes: nullableText_(row[23]),
      medida_protetiva: nullableText_(row[25]),
      numero_processo_medida: nullableText_(row[26]),
      relatorio_enviado: nullableText_(row[27]),
      data_envio_relatorio: nullableDate_(row[28], timezone),
      observacoes: nullableText_(row[29]),
      representacoes_legais: nullableText_(row[30]),
    });
  }
  return compactPayload_({
    numero_ppe: nullableText_(row[1]),
    vitima: nullableText_(row[2]),
    investigado: nullableText_(row[3]),
    data_representacao: nullableDate_(row[4], timezone),
    tipo: nullableText_(row[5]),
    processo_judicial: nullableText_(row[7]),
    vara_juizo: nullableText_(row[8]),
    data_decisao_judicial: nullableDate_(row[10], timezone),
    prazo_concedido_dias: nullableInteger_(row[11]),
    data_vencimento: nullableDate_(row[12], timezone),
    cumprimento_status: nullableText_(row[13]),
    data_cumprimento: nullableDate_(row[14], timezone),
    equipe_cumprimento: nullableText_(row[15]),
    equipe_responsavel: nullableText_(row[15]),
    resultado_cumprimento: nullableText_(row[16]),
    observacoes_cumprimento: nullableText_(row[17]),
    status: nullableText_(row[18]),
  });
}

function compactPayload_(payload) {
  // Mantem null para que apagar uma celula tambem limpe o campo correspondente no SIPI.
  return payload;
}

function rowHasData_(row) {
  return row.some((value) => value !== "" && value !== null);
}

function cleanText_(value) {
  if (value === null || value === undefined) return "";
  return String(value).normalize("NFKC").replace(/\s+/g, " ").trim().toLowerCase();
}

function nullableText_(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text || null;
}

function nullableInteger_(value) {
  if (value === "" || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) ? Math.trunc(number) : null;
}

function nullableDate_(value, timezone) {
  const result = dateText_(value, timezone);
  return result || null;
}

function dateText_(value, timezone) {
  if (value === "" || value === null || value === undefined) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !Number.isNaN(value.getTime())) {
    return Utilities.formatDate(value, timezone || "America/Bahia", "yyyy-MM-dd");
  }
  const text = String(value).trim();
  const match = text.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  return "";
}

function sha256Hex_(value) {
  return bytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, value));
}

function bytesToHex_(bytes) {
  return bytes.map((byte) => (byte < 0 ? byte + 256 : byte).toString(16).padStart(2, "0")).join("");
}
