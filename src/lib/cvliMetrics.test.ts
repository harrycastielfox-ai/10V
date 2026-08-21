import { describe, expect, it } from "vitest";
import { buildCvliMonthlyComparison, isCvliElucidado, isCvliRecord } from "./cvliMetrics";
import type { InqueritoRecord } from "@/lib/repositories/inqueritosRepository";

function makeInquerito(overrides: Partial<InqueritoRecord> = {}): InqueritoRecord {
  return {
    id: "inq-1",
    codigo_interno: null,
    numero_ppe: null,
    numero_fisico: null,
    numero_bo: null,
    origem_registro: null,
    visibilidade: null,
    tipo: null,
    tipo_procedimento_normalizado: null,
    tipificacao: null,
    gravidade: null,
    categoria_criminal: null,
    prioridade: null,
    prioridade_operacional: null,
    situacao: null,
    status_diligencias: null,
    data_fato: null,
    data_instauracao: null,
    prazo: null,
    dias_decorridos: null,
    bairro: null,
    distrito: null,
    vitima: null,
    investigado: null,
    reu_preso: null,
    reu_preso_normalizado: null,
    elucidado: null,
    autoria_determinada: null,
    cvli_elucidado: null,
    data_elucidacao: null,
    remessa_final_status: null,
    data_remessa_final: null,
    houve_arma_fogo: null,
    arma_utilizada: null,
    faccao: null,
    nome_faccao: null,
    equipe: null,
    equipe_responsavel: null,
    escrivao: null,
    escrivao_responsavel_id: null,
    relatorio_enviado: null,
    relatorio_status: null,
    data_envio_relatorio: null,
    data_relatorio: null,
    medida_protetiva: null,
    medida_protetiva_normalizada: null,
    numero_processo_medida: null,
    representacoes_legais: null,
    diligencias_pendentes: null,
    delegado_responsavel: null,
    motivacao: null,
    observacoes: null,
    created_at: null,
    updated_at: null,
    deleted_at: null,
    ...overrides,
  };
}

describe("isCvliRecord", () => {
  it("matches an explicit CVLI categoria_criminal", () => {
    expect(isCvliRecord(makeInquerito({ categoria_criminal: "CVLI" }))).toBe(true);
  });

  it("matches by tipificação when categoria_criminal is not set", () => {
    expect(isCvliRecord(makeInquerito({ tipificacao: "Homicídio qualificado" }))).toBe(true);
    expect(isCvliRecord(makeInquerito({ tipificacao: "Latrocínio" }))).toBe(true);
    expect(isCvliRecord(makeInquerito({ tipificacao: "Feminicídio" }))).toBe(true);
  });

  it("ignores free text: motivação e observações não classificam crime", () => {
    expect(isCvliRecord(makeInquerito({ motivacao: "Latrocínio" }))).toBe(false);
    expect(
      isCvliRecord(makeInquerito({ observacoes: "O autor também responde por homicídio" })),
    ).toBe(false);
  });

  it("excludes tentativa e culposo, que não são letais intencionais", () => {
    expect(
      isCvliRecord(
        makeInquerito({ tipificacao: "Tentativa de homicídio (art. 121 c/c art. 14, II)" }),
      ),
    ).toBe(false);
    expect(
      isCvliRecord(
        makeInquerito({ tipificacao: "Homicídio culposo na direção de veículo (art. 302 do CTB)" }),
      ),
    ).toBe(false);
  });

  it("keeps the official category above the tipificação", () => {
    expect(
      isCvliRecord(
        makeInquerito({ categoria_criminal: "CVLI", tipificacao: "Tentativa de furto" }),
      ),
    ).toBe(true);
  });

  it("does not match unrelated procedures", () => {
    expect(isCvliRecord(makeInquerito({ tipificacao: "Furto simples" }))).toBe(false);
    expect(isCvliRecord(makeInquerito({}))).toBe(false);
  });
});

describe("isCvliElucidado", () => {
  it("uses final remittance as the operational elucidation rule when available", () => {
    expect(
      isCvliElucidado(
        makeInquerito({
          categoria_criminal: "CVLI",
          remessa_final_status: "remetido",
          cvli_elucidado: false,
        }),
      ),
    ).toBe(true);
    expect(
      isCvliElucidado(
        makeInquerito({
          categoria_criminal: "CVLI",
          remessa_final_status: "em_andamento",
          cvli_elucidado: true,
        }),
      ),
    ).toBe(false);
  });

  it("keeps authorship as the fallback outside CVLI", () => {
    expect(
      isCvliElucidado(
        makeInquerito({
          categoria_criminal: "PATRIMONIAL",
          remessa_final_status: "em_andamento",
          elucidado: "sim",
        }),
      ),
    ).toBe(true);
  });

  it("prefers the explicit boolean field when present", () => {
    expect(isCvliElucidado(makeInquerito({ cvli_elucidado: true, elucidado: "nao" }))).toBe(true);
    expect(isCvliElucidado(makeInquerito({ cvli_elucidado: false, elucidado: "sim" }))).toBe(false);
  });

  it("falls back to elucidado/autoria_determinada text when no boolean is set", () => {
    expect(isCvliElucidado(makeInquerito({ elucidado: "sim" }))).toBe(true);
    expect(isCvliElucidado(makeInquerito({ elucidado: "autoria determinada" }))).toBe(true);
    expect(isCvliElucidado(makeInquerito({ autoria_determinada: "indeterminada" }))).toBe(false);
  });

  it("is false when there is no signal at all", () => {
    expect(isCvliElucidado(makeInquerito({}))).toBe(false);
  });
});

describe("buildCvliMonthlyComparison", () => {
  it("only counts CVLI records with a resolvable reference date", () => {
    const records = [
      makeInquerito({
        categoria_criminal: "CVLI",
        data_fato: "2026-01-15",
        remessa_final_status: "remetido",
        data_remessa_final: "2026-01-20",
      }),
      makeInquerito({ categoria_criminal: "CVLI", data_fato: "2026-01-20" }),
      makeInquerito({ categoria_criminal: "PATRIMONIAL", data_fato: "2026-01-10" }),
      makeInquerito({ categoria_criminal: "CVLI", data_fato: null, data_instauracao: null }),
    ];

    const result = buildCvliMonthlyComparison(records);

    expect(result.years).toEqual([2026]);
    const january = result.rows[0];
    expect(january.month).toBe("Janeiro");
    expect(january.byYear[2026]).toEqual({ registros: 2, elucidados: 1 });
    expect(result.totals[2026]).toEqual({ registros: 2, elucidados: 1 });
  });

  it("prefers data_fato, then data_instauracao, then created_at for the reference date", () => {
    const record = makeInquerito({
      categoria_criminal: "CVLI",
      data_fato: null,
      data_instauracao: "2025-06-01",
      created_at: "2026-01-01",
    });

    const result = buildCvliMonthlyComparison([record]);
    expect(result.years).toEqual([2025]);
  });

  it("returns an empty-but-well-formed comparison when there are no CVLI records", () => {
    const result = buildCvliMonthlyComparison([
      makeInquerito({ categoria_criminal: "PATRIMONIAL", data_fato: "2026-01-01" }),
    ]);
    expect(result.years).toEqual([]);
    expect(result.rows).toHaveLength(12);
    expect(result.rows[0].byYear).toEqual({});
  });

  it("splits registros across different years for the same month", () => {
    const records = [
      makeInquerito({ categoria_criminal: "CVLI", data_fato: "2025-03-05" }),
      makeInquerito({
        categoria_criminal: "CVLI",
        data_fato: "2026-03-10",
        remessa_final_status: "remetido",
        data_remessa_final: "2026-03-20",
      }),
    ];
    const result = buildCvliMonthlyComparison(records);
    const march = result.rows[2];
    expect(march.byYear[2025]).toEqual({ registros: 1, elucidados: 0 });
    expect(march.byYear[2026]).toEqual({ registros: 1, elucidados: 1 });
  });

  it("counts the record by fact date and the elucidation by final remittance date", () => {
    const result = buildCvliMonthlyComparison([
      makeInquerito({
        categoria_criminal: "CVLI",
        data_fato: "2023-02-10",
        remessa_final_status: "remetido",
        data_remessa_final: "2026-08-21",
      }),
    ]);

    expect(result.years).toEqual([2023, 2026]);
    expect(result.rows[1].byYear[2023]).toEqual({ registros: 1, elucidados: 0 });
    expect(result.rows[7].byYear[2026]).toEqual({ registros: 0, elucidados: 1 });
  });
});
