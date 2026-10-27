import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ObjectPayload, ObjectRecord } from "@/features/objects/objectTypes";

const state = vi.hoisted(() => ({
  row: null as (ObjectRecord & { deleted_at: string | null }) | null,
  nextUpdatedAt: "2026-10-25T12:02:00.000Z",
  error: null as { code: string; message: string } | null,
  requests: 0,
}));

// Keep the real Supabase query builder and mutation wrapper. Only the HTTP
// boundary is replaced, so missing filters really change the stored fixture.
vi.mock("@/lib/supabaseClient", async () => {
  const { createClient } = await import("@supabase/supabase-js");
  return {
    supabase: createClient("https://objects.test", "synthetic-publishable-key", {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
      global: {
        fetch: async (input, init) => {
          state.requests += 1;
          const headers = { "Content-Type": "application/json" };
          if (state.error) {
            return new Response(JSON.stringify(state.error), { status: 403, headers });
          }

          const url = new URL(String(input));
          const id = url.searchParams.get("id")?.slice(3);
          const version = url.searchParams.get("updated_at")?.slice(3);
          const row = state.row;
          const matches =
            row !== null &&
            row.id === id &&
            row.deleted_at === null &&
            (!version || row.updated_at === version);

          if (matches && init?.method === "PATCH") {
            state.row = {
              ...row,
              ...JSON.parse(String(init.body)),
              updated_at: state.nextUpdatedAt,
            };
          }

          const singular = new Headers(init?.headers).get("Accept")?.includes("object+json");
          if (!matches && singular) {
            return new Response(
              JSON.stringify({
                code: "PGRST116",
                message: "Cannot coerce the result to a single JSON object",
                details: "The result contains 0 rows",
              }),
              { status: 406, headers },
            );
          }
          return new Response(JSON.stringify(singular ? state.row : matches ? [state.row] : []), {
            status: 200,
            headers,
          });
        },
      },
    }),
  };
});

const { getObjectById, updateObject } = await import("./objectsRepository");

function objectFixture(): ObjectRecord & { deleted_at: string | null } {
  return {
    id: "object-1",
    internal_id: "OBJ-SYNTHETIC-1",
    object_type: "arma_fogo",
    description: "Objeto sintético",
    brand_model: null,
    serial_number: null,
    caliber: null,
    color: null,
    quantity: 1,
    measurement_unit: null,
    weight_or_value: null,
    situation: "apreendido",
    occurrence_type: null,
    status: null,
    pending_identification: false,
    procedure_type: null,
    procedure_number: null,
    police_report_number: null,
    court_process_number: null,
    involved_people: null,
    document_holder_name: null,
    document_issuing_authority: null,
    document_number: null,
    inquerito_id: null,
    seizure_date: null,
    seizure_location: null,
    custody_location: "Depósito sintético",
    storage_location: null,
    custody_responsible: null,
    custody_observations: null,
    observations: null,
    expertise_date: null,
    release_status: "nao_liberado",
    release_date: null,
    released_to: null,
    release_document: null,
    release_authority: null,
    delivery_term: null,
    release_observations: null,
    created_at: "2026-10-25T12:00:00.000Z",
    updated_at: "2026-10-25T12:00:00.000Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
  };
}

const payload: ObjectPayload = {
  object_type: "arma_fogo",
  description: "Descrição revisada",
  situation: "apreendido",
  release_status: "nao_liberado",
  release_date: null,
  released_to: null,
};

describe("updateObject optimistic concurrency", () => {
  beforeEach(() => {
    state.row = objectFixture();
    state.nextUpdatedAt = "2026-10-25T12:02:00.000Z";
    state.error = null;
    state.requests = 0;
  });

  it("rejects a stale edit without undoing a release recorded after the object was loaded", async () => {
    const loaded = await getObjectById("object-1");
    state.row = {
      ...objectFixture(),
      situation: "liberado",
      release_status: "liberado",
      release_date: "2026-10-25",
      released_to: "Destinatário sintético",
      updated_at: "2026-10-25T12:01:00.000Z",
    };

    await expect(updateObject("object-1", payload, loaded!.updated_at)).rejects.toThrow(
      /recarregue/i,
    );

    expect(state.row).toMatchObject({
      description: "Objeto sintético",
      situation: "liberado",
      release_status: "liberado",
      release_date: "2026-10-25",
      released_to: "Destinatário sintético",
      updated_at: "2026-10-25T12:01:00.000Z",
    });
  });

  it("returns a valid update and accepts its returned version for another save", async () => {
    const saved = await updateObject("object-1", payload, "2026-10-25T12:00:00.000Z");

    expect(saved).toMatchObject({
      id: "object-1",
      description: "Descrição revisada",
      updated_at: "2026-10-25T12:02:00.000Z",
    });

    state.nextUpdatedAt = "2026-10-25T12:03:00.000Z";
    const savedAgain = await updateObject(
      "object-1",
      { ...payload, description: "Segunda revisão" },
      saved.updated_at,
    );
    expect(savedAgain).toMatchObject({
      description: "Segunda revisão",
      updated_at: "2026-10-25T12:03:00.000Z",
    });
  });

  it("does not mistake a database error for an optimistic concurrency conflict", async () => {
    state.error = { code: "42501", message: "permission denied" };

    await expect(
      updateObject("object-1", payload, "2026-10-25T12:00:00.000Z"),
    ).rejects.toMatchObject({ code: "42501", message: "permission denied" });
    expect(state.row?.description).toBe("Objeto sintético");
  });

  it("refuses to write without a version loaded from the object", async () => {
    await expect(updateObject("object-1", payload, "")).rejects.toThrow(/recarregue/i);

    expect(state.row?.description).toBe("Objeto sintético");
    expect(state.requests).toBe(0);
  });
});
