import { beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({
  from: vi.fn(),
  runQuery: vi.fn(),
  runMutation: vi.fn(),
}));

vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: state.from } }));
vi.mock("@/lib/repositories/supabaseQuery", () => ({
  runSupabaseQuery: state.runQuery,
  runSupabaseMutation: state.runMutation,
}));

const { listNexoRegistrosVinculados, listNexoObservacoesForReport } =
  await import("./nexoIntegrationsRepository");

interface Page {
  data: unknown;
  error?: unknown;
}

function pages(...responses: Page[]) {
  const builders = responses.map((response) => {
    const builder = {
      select: vi.fn(),
      order: vi.fn(),
      range: vi.fn(),
      eq: vi.fn(),
      abortSignal: vi.fn(async () => ({ data: response.data, error: response.error || null })),
    };
    builder.select.mockReturnValue(builder);
    builder.order.mockReturnValue(builder);
    builder.range.mockReturnValue(builder);
    builder.eq.mockReturnValue(builder);
    state.from.mockReturnValueOnce(builder);
    return builder;
  });
  return builders;
}

function linkedRecord(index: number) {
  return {
    id: `record-${index}`,
    pessoa_id: "person-a",
    organizacao_id: null,
    inquerito_id: null,
    bo_id: `bo-${index}`,
    observacao: null,
    created_at: "2026-10-18T12:00:00.000Z",
  };
}

function note(index: number, autor: unknown = { nome: "Equipe de teste" }) {
  return {
    id: `note-${index}`,
    pessoa_id: "person-a",
    organizacao_id: null,
    conteudo: `Anotação ${index}`,
    created_at: "2026-10-18T12:00:00.000Z",
    created_by: "author-a",
    autor,
  };
}

describe("NEXO integrations report reads", () => {
  beforeEach(() => {
    state.from.mockReset();
    state.runQuery.mockReset();
    state.runMutation.mockReset();
    state.runQuery.mockImplementation(async (_label, execute) => {
      const result = await execute(new AbortController().signal);
      if (result.error) throw result.error;
      return result.data;
    });
  });

  it("loads more than 1000 procedure links with stable, inclusive range offsets", async () => {
    const first = Array.from({ length: 1000 }, (_, index) => linkedRecord(index));
    const next = [linkedRecord(1000), linkedRecord(1001), linkedRecord(1002)];
    const builders = pages({ data: first }, { data: next });

    await expect(listNexoRegistrosVinculados()).resolves.toEqual([...first, ...next]);

    expect(state.from).toHaveBeenNthCalledWith(1, "nexo_registros_vinculados");
    expect(state.from).toHaveBeenCalledTimes(2);
    expect(builders[0].range).toHaveBeenCalledWith(0, 999);
    expect(builders[1].range).toHaveBeenCalledWith(1000, 1999);
    for (const builder of builders) {
      expect(builder.order.mock.calls).toEqual([["created_at", { ascending: false }], ["id"]]);
      expect(builder.select).toHaveBeenCalledWith(expect.stringContaining("inquerito:inqueritos"));
      expect(builder.select).toHaveBeenCalledWith(
        expect.stringContaining("bo:boletins_ocorrencia"),
      );
      expect(builder.abortSignal).toHaveBeenCalledWith(expect.any(AbortSignal));
      expect(builder.eq).not.toHaveBeenCalled();
    }
  });

  it("preserves entity scope on every page and terminates after a full final page followed by empty data", async () => {
    const first = Array.from({ length: 1000 }, (_, index) => linkedRecord(index));
    const builders = pages({ data: first }, { data: [] });

    await expect(listNexoRegistrosVinculados("person-a", "organization-a")).resolves.toHaveLength(
      1000,
    );

    expect(state.from).toHaveBeenCalledTimes(2);
    for (const builder of builders) {
      expect(builder.eq.mock.calls).toEqual([
        ["pessoa_id", "person-a"],
        ["organizacao_id", "organization-a"],
      ]);
    }
  });

  it("returns empty arrays when no readable records are returned", async () => {
    pages({ data: null }, { data: null });
    await expect(listNexoRegistrosVinculados()).resolves.toEqual([]);
    await expect(listNexoObservacoesForReport()).resolves.toEqual([]);
    expect(state.from).toHaveBeenCalledTimes(2);
  });

  it("paginates observations independently without accidentally filtering them to an empty entity ID", async () => {
    const first = Array.from({ length: 1000 }, (_, index) => note(index));
    const next = [note(1000)];
    const builders = pages({ data: first }, { data: next });

    const result = await listNexoObservacoesForReport();

    expect(result).toHaveLength(1001);
    expect(result[0].id).toBe("note-0");
    expect(result.at(-1)?.id).toBe("note-1000");
    expect(state.from.mock.calls).toEqual([["nexo_observacoes"], ["nexo_observacoes"]]);
    expect(builders[1].range).toHaveBeenCalledWith(1000, 1999);
    for (const builder of builders) {
      expect(builder.order.mock.calls).toEqual([["created_at", { ascending: false }], ["id"]]);
      expect(builder.eq).not.toHaveBeenCalled();
      expect(builder.select).toHaveBeenCalledWith(
        expect.stringContaining("autor:profiles!nexo_observacoes_created_by_fkey(nome)"),
      );
    }
  });

  it("normalizes author joins returned as an object, one-row array or missing profile", async () => {
    pages({
      data: [note(0, { nome: "Ana" }), note(1, [{ nome: "Bruno" }]), note(2, []), note(3, null)],
    });

    const result = await listNexoObservacoesForReport();

    expect(result.map((item) => item.autor)).toEqual([
      { nome: "Ana" },
      { nome: "Bruno" },
      null,
      null,
    ]);
    expect(result.map((item) => item.conteudo)).toEqual([
      "Anotação 0",
      "Anotação 1",
      "Anotação 2",
      "Anotação 3",
    ]);
  });

  it.each(["procedure links", "observations"])(
    "rejects partial %s if a later page fails instead of silently using an incomplete report",
    async (kind) => {
      const first = Array.from({ length: 1000 }, (_, index) =>
        kind === "procedure links" ? linkedRecord(index) : note(index),
      );
      const failure = new Error("Read denied on next page");
      pages({ data: first }, { data: null, error: failure });

      const read =
        kind === "procedure links" ? listNexoRegistrosVinculados : listNexoObservacoesForReport;
      await expect(read()).rejects.toBe(failure);
      expect(state.from).toHaveBeenCalledTimes(2);
      expect(state.runMutation).not.toHaveBeenCalled();
    },
  );
});
