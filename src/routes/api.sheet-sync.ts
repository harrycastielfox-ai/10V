import { createFileRoute } from "@tanstack/react-router";

import {
  parseSheetSyncBootstrapCheck,
  parseSheetSyncRecord,
  SHEET_SYNC_MAX_BODY_BYTES,
  SheetSyncValidationError,
  validateSheetSyncTimestamp,
  verifySheetSyncSignature,
} from "@/lib/server/sheetSync";
import { parseTipificacoes } from "@/lib/tipificacaoParser";

type SupabaseTagRow = { id: string; name: string; slug: string };

function supabaseHeaders(secretKey: string, extra?: HeadersInit) {
  return {
    apikey: secretKey,
    Authorization: `Bearer ${secretKey}`,
    "Content-Type": "application/json",
    "X-Client-Info": "sipi-sheet-sync/1.0",
    ...extra,
  };
}

async function readSupabaseJson<T>(response: Response, operation: string): Promise<T> {
  const body = (await response.json().catch(() => null)) as T | null;
  if (!response.ok || body === null) {
    throw new Error(`${operation}_failed_${response.status}`);
  }
  return body;
}

async function assertSupabaseOk(response: Response, operation: string) {
  if (response.ok) return;
  throw new Error(`${operation}_failed_${response.status}`);
}

async function indexInqueritoTipificacoes({
  supabaseUrl,
  supabaseSecretKey,
  inqueritoId,
  rawTipificacao,
}: {
  supabaseUrl: string;
  supabaseSecretKey: string;
  inqueritoId: string;
  rawTipificacao: string | null | undefined;
}) {
  const catalogResponse = await fetch(
    `${supabaseUrl}/rest/v1/procedural_tags?scope=eq.tipificacao&select=id,name,slug`,
    { headers: supabaseHeaders(supabaseSecretKey) },
  );
  const catalog = await readSupabaseJson<SupabaseTagRow[]>(
    catalogResponse,
    "sheet_sync_tipificacao_catalog",
  );
  const existingBySlug = new Map(catalog.map((tag) => [tag.slug, tag]));
  const items = parseTipificacoes(
    rawTipificacao,
    catalog.map((tag) => tag.name),
  );
  const tagIds: string[] = [];

  for (const item of items) {
    const existing = existingBySlug.get(item.slug);
    if (existing) {
      tagIds.push(existing.id);
      continue;
    }

    const createResponse = await fetch(`${supabaseUrl}/rest/v1/procedural_tags`, {
      method: "POST",
      headers: supabaseHeaders(supabaseSecretKey, { Prefer: "return=representation" }),
      body: JSON.stringify({
        scope: "tipificacao",
        name: item.rotulo,
        slug: item.slug,
        color: "purple",
        is_system: true,
      }),
    });

    if (createResponse.status === 409) {
      const retryResponse = await fetch(
        `${supabaseUrl}/rest/v1/procedural_tags?scope=eq.tipificacao&slug=eq.${encodeURIComponent(item.slug)}&select=id,name,slug&limit=1`,
        { headers: supabaseHeaders(supabaseSecretKey) },
      );
      const [concurrent] = await readSupabaseJson<SupabaseTagRow[]>(
        retryResponse,
        "sheet_sync_tipificacao_refetch",
      );
      if (!concurrent) throw new Error("sheet_sync_tipificacao_conflict_without_tag");
      tagIds.push(concurrent.id);
      existingBySlug.set(concurrent.slug, concurrent);
      continue;
    }

    const [created] = await readSupabaseJson<SupabaseTagRow[]>(
      createResponse,
      "sheet_sync_tipificacao_create",
    );
    if (!created) throw new Error("sheet_sync_tipificacao_create_empty");
    tagIds.push(created.id);
    existingBySlug.set(created.slug, created);
  }

  const tipificacaoTagIds = [...new Set([...catalog.map((tag) => tag.id), ...tagIds])];
  if (tipificacaoTagIds.length > 0) {
    const deleteResponse = await fetch(
      `${supabaseUrl}/rest/v1/inquerito_tag_links?inquerito_id=eq.${encodeURIComponent(inqueritoId)}&tag_id=in.(${tipificacaoTagIds.join(",")})`,
      { method: "DELETE", headers: supabaseHeaders(supabaseSecretKey) },
    );
    await assertSupabaseOk(deleteResponse, "sheet_sync_tipificacao_clear");
  }

  if (tagIds.length > 0) {
    const insertResponse = await fetch(`${supabaseUrl}/rest/v1/inquerito_tag_links`, {
      method: "POST",
      headers: supabaseHeaders(supabaseSecretKey),
      body: JSON.stringify(tagIds.map((tagId) => ({ inquerito_id: inqueritoId, tag_id: tagId }))),
    });
    await assertSupabaseOk(insertResponse, "sheet_sync_tipificacao_link");
  }
}

function jsonResponse(body: unknown, status: number) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function handleSheetSync(request: Request) {
  // Com nodejs_compat e compatibility_date atual, os bindings do Worker sao
  // expostos em process.env no runtime. Isso tambem mantem o bundle SSR
  // compativel com o preset Cloudflare usado pelo TanStack Start neste projeto.
  const runtimeEnv = process.env;
  const configuration = {
    sharedSecret: runtimeEnv.SHEET_SYNC_SECRET?.trim(),
    spreadsheetId: runtimeEnv.SHEET_SYNC_DOCUMENT_ID?.trim(),
    inqueritosBootstrap: runtimeEnv.SHEET_SYNC_BOOTSTRAP_INQUERITOS?.trim(),
    representacoesBootstrap: runtimeEnv.SHEET_SYNC_BOOTSTRAP_REPRESENTACOES?.trim(),
    supabaseUrl: runtimeEnv.SUPABASE_URL?.trim().replace(/\/$/, ""),
    supabaseSecretKey: runtimeEnv.SUPABASE_SECRET_KEY?.trim(),
  };

  if (Object.values(configuration).some((value) => !value)) {
    console.error("sheet_sync_configuration_missing");
    return jsonResponse({ error: "integration_unavailable" }, 503);
  }

  const contentType = request.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.startsWith("application/json")) {
    return jsonResponse({ error: "content_type_required" }, 415);
  }

  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (Number.isFinite(declaredLength) && declaredLength > SHEET_SYNC_MAX_BODY_BYTES) {
    return jsonResponse({ error: "request_too_large" }, 413);
  }

  const body = await request.text();
  if (new TextEncoder().encode(body).byteLength > SHEET_SYNC_MAX_BODY_BYTES) {
    return jsonResponse({ error: "request_too_large" }, 413);
  }

  const timestamp = request.headers.get("x-sipi-timestamp")?.trim() ?? "";
  const signature = request.headers.get("x-sipi-signature")?.trim() ?? "";
  if (
    !timestamp ||
    !signature ||
    !validateSheetSyncTimestamp(timestamp) ||
    !(await verifySheetSyncSignature(configuration.sharedSecret!, timestamp, body, signature))
  ) {
    console.warn("sheet_sync_authentication_failed");
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  let parsedBody: unknown;
  try {
    parsedBody = JSON.parse(body);
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400);
  }

  try {
    if (
      parsedBody &&
      typeof parsedBody === "object" &&
      !Array.isArray(parsedBody) &&
      "mode" in parsedBody &&
      parsedBody.mode === "bootstrap_check"
    ) {
      const check = parseSheetSyncBootstrapCheck(parsedBody, configuration.spreadsheetId!);
      const expected = new Map([
        ["Controle de Inquéritos", configuration.inqueritosBootstrap!],
        ["Representações Judiciais", configuration.representacoesBootstrap!],
      ]);
      const matches = check.sheets.every(
        (sheet) => expected.get(sheet.sheetName) === `${sheet.rowCount}:${sheet.keyDigest}`,
      );
      if (!matches) {
        console.warn("sheet_sync_bootstrap_mismatch", { requestId: check.requestId });
        return jsonResponse({ error: "bootstrap_mismatch", requestId: check.requestId }, 409);
      }
      console.info("sheet_sync_bootstrap_verified", { requestId: check.requestId });
      return jsonResponse({ requestId: check.requestId, status: "verified" }, 200);
    }

    const record = parseSheetSyncRecord(parsedBody, configuration.spreadsheetId!);
    const response = await fetch(
      `${configuration.supabaseUrl}/rest/v1/rpc/apply_sheet_sync_record`,
      {
        method: "POST",
        headers: {
          apikey: configuration.supabaseSecretKey!,
          Authorization: `Bearer ${configuration.supabaseSecretKey}`,
          "Content-Type": "application/json",
          "X-Client-Info": "sipi-sheet-sync/1.0",
        },
        body: JSON.stringify({
          p_request_id: record.requestId,
          p_source_document_id: record.spreadsheetId,
          p_source_sheet_name: record.sheetName,
          p_source_record_key: record.recordKey,
          p_entity: record.entity,
          p_operation: record.operation,
          p_payload: record.payload,
          p_payload_hash: record.payloadHash,
          p_sheet_row_number: record.rowNumber,
          p_existing_codigo_interno: null,
        }),
      },
    );

    const result = (await response.json().catch(() => null)) as {
      action?: string;
      status?: string;
      entityId?: string;
      requestId?: string;
      code?: string;
      message?: string;
    } | null;

    if (!response.ok) {
      console.error("sheet_sync_database_rejected", {
        requestId: record.requestId,
        entity: record.entity,
        operation: record.operation,
        status: response.status,
        databaseCode: result?.code,
        databaseMessage: result?.message,
      });
      return jsonResponse(
        {
          error: "database_rejected",
          requestId: record.requestId,
          databaseCode: result?.code || `HTTP_${response.status}`,
        },
        502,
      );
    }

    if (record.entity === "inquerito" && record.operation === "upsert" && result?.entityId) {
      try {
        await indexInqueritoTipificacoes({
          supabaseUrl: configuration.supabaseUrl!,
          supabaseSecretKey: configuration.supabaseSecretKey!,
          inqueritoId: result.entityId,
          rawTipificacao:
            typeof record.payload.tipificacao === "string"
              ? record.payload.tipificacao
              : record.payload.tipificacao == null
                ? null
                : String(record.payload.tipificacao),
        });
      } catch (error) {
        console.error("sheet_sync_tipificacao_index_failed", {
          requestId: record.requestId,
          entityId: result.entityId,
          message: error instanceof Error ? error.message : "unknown",
        });
        return jsonResponse(
          { error: "tipificacao_index_failed", requestId: record.requestId },
          502,
        );
      }
    }

    console.info("sheet_sync_applied", {
      requestId: record.requestId,
      entity: record.entity,
      operation: record.operation,
      action: result?.action,
      status: result?.status,
    });

    return jsonResponse(
      {
        requestId: record.requestId,
        entity: record.entity,
        action: result?.action,
        status: result?.status,
      },
      200,
    );
  } catch (error) {
    if (error instanceof SheetSyncValidationError) {
      return jsonResponse({ error: error.message }, 400);
    }
    console.error("sheet_sync_unexpected_error", {
      message: error instanceof Error ? error.message : "unknown",
    });
    return jsonResponse({ error: "internal_error" }, 500);
  }
}

export const Route = createFileRoute("/api/sheet-sync")({
  server: {
    handlers: {
      POST: ({ request }) => handleSheetSync(request),
    },
  },
});
