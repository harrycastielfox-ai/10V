import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeBoText, type BoRecord } from "@/features/bo/boTypes";

const state = vi.hoisted(() => ({
  rows: [] as BoRecord[],
  failureOnRead: null as number | null,
  reads: 0,
  afterFirstPage: null as (() => void) | null,
  failure: { code: "42501", message: "Lote posterior indisponível" },
}));

vi.mock("@/lib/supabaseClient", () => ({
  supabase: {
    from: () => {
      let to = 999;
      let activeOnly = false;
      let cursor: { updatedAt: string; id: string } | null = null;
      const orders: Array<{ column: keyof BoRecord; ascending: boolean }> = [];
      const builder = {
        select: () => builder,
        is: (column: string, value: unknown) => {
          activeOnly = column === "deleted_at" && value === null;
          return builder;
        },
        order: (column: keyof BoRecord, options: { ascending: boolean }) => {
          orders.push({ column, ascending: options.ascending });
          return builder;
        },
        limit: (limit: number) => {
          to = limit - 1;
          return builder;
        },
        or: (filter: string) => {
          const match = /^updated_at\.lt\.([^,]+),and\(updated_at\.eq\.\1,id\.lt\.([^)]+)\)$/.exec(
            filter,
          );
          if (!match) throw new Error(`Filtro de cursor inválido: ${filter}`);
          cursor = { updatedAt: match[1], id: match[2] };
          return builder;
        },
        abortSignal: async () => {
          state.reads += 1;
          if (state.reads === state.failureOnRead) {
            return { data: null, error: state.failure };
          }
          const rows = state.rows
            .filter((row) => !activeOnly || row.deleted_at === null)
            .filter(
              (row) =>
                !cursor ||
                row.updated_at < cursor.updatedAt ||
                (row.updated_at === cursor.updatedAt && row.id < cursor.id),
            )
            .sort((left, right) => {
              for (const { column, ascending } of orders) {
                const comparison = String(left[column]).localeCompare(String(right[column]));
                if (comparison) return ascending ? comparison : -comparison;
              }
              return 0;
            });
          const data = rows.slice(0, Math.min(to + 1, 1000));
          if (state.reads === 1) state.afterFirstPage?.();
          return { data, error: null };
        },
      };
      return builder;
    },
  },
}));

const { clearSessionCaches } = await import("@/lib/sessionCache");
const { listBos } = await import("./boRepository");

function syntheticBos(count: number): BoRecord[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `bo-${String(index + 1).padStart(5, "0")}`,
    numero_bo: index === 0 ? "BO-ANTIGO-SINTETICO" : `BO-SINTETICO-${index + 1}`,
    infracao_penal: "Infração sintética",
    diligencias_pendentes: null,
    responsavel_nome: null,
    observacao: null,
    status: index === 0 ? "Pendente" : "Concluida",
    inquerito_id: null,
    representacao_id: null,
    origem_registro: "sipi",
    created_at: "2026-01-01T00:00:00Z",
    updated_at: index === 0 ? "2026-01-01T00:00:00Z" : "2026-10-25T00:00:00Z",
    created_by: null,
    updated_by: null,
    deleted_at: null,
  }));
}

describe("listBos", () => {
  beforeEach(() => {
    clearSessionCaches();
    state.rows = syntheticBos(1002);
    state.failureOnRead = null;
    state.reads = 0;
    state.afterFirstPage = null;
  });

  it("inclui B.O. antigo além do primeiro lote na busca e nos indicadores, com desempate por id", async () => {
    state.rows.push({ ...state.rows[0], id: "bo-excluido", deleted_at: "2026-10-25T00:00:00Z" });

    const rows = await listBos();

    expect(rows).toHaveLength(1002);
    expect(new Set(rows.map((row) => row.id)).size).toBe(1002);
    expect(rows[0].id).toBe("bo-01002");
    expect(rows[999].id).toBe("bo-00003");
    expect(rows[1000].id).toBe("bo-00002");
    expect(rows[1001].id).toBe("bo-00001");
    expect(rows.filter((row) => normalizeBoText(row.numero_bo).includes("bo-antigo"))).toHaveLength(
      1,
    );
    expect(rows.filter((row) => row.status === "Pendente")).toHaveLength(1);
    expect(rows.filter((row) => row.status === "Concluida")).toHaveLength(1001);
  });

  it("propaga falha em lote posterior e permite recarregar sem cache de sucesso parcial", async () => {
    state.failureOnRead = 2;

    await expect(listBos()).rejects.toEqual(state.failure);

    state.failureOnRead = null;
    const rows = await listBos();
    expect(rows).toHaveLength(1002);
    expect(rows.at(-1)?.numero_bo).toBe("BO-ANTIGO-SINTETICO");
  });

  it.each(["inserção", "remoção"])(
    "não repete nem omite registros quando ocorre %s antes do cursor entre lotes",
    async (change) => {
      state.afterFirstPage = () => {
        if (change === "inserção") {
          state.rows.push({
            ...state.rows[0],
            id: "bo-99999",
            updated_at: "2026-10-26T00:00:00Z",
          });
        } else {
          state.rows = state.rows.filter((row) => row.id !== "bo-01002");
        }
      };

      const rows = await listBos();

      expect(rows).toHaveLength(1002);
      expect(new Set(rows.map((row) => row.id)).size).toBe(1002);
      expect(rows.at(-2)?.id).toBe("bo-00002");
      expect(rows.at(-1)?.id).toBe("bo-00001");
    },
  );

  it("mantém cache da lista completa e atualiza todos os dados com forceRefresh", async () => {
    await listBos();
    state.rows = [];

    expect(await listBos()).toHaveLength(1002);
    expect(await listBos({ forceRefresh: true })).toEqual([]);
  });
});
