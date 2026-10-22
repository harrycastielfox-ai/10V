import { describe, expect, it } from "vitest";
import {
  NEXO_DEMO_ORGANIZACOES,
  NEXO_DEMO_PESSOAS,
  NEXO_DEMO_REGISTROS,
  NEXO_DEMO_TERRITORIOS,
} from "./nexoDemoData";
import { buildNexoPersonIntelligenceSummary } from "./nexoIntelligenceSummary";

describe("síntese estruturada local do NEXO", () => {
  it("preserva vínculos, procedimentos, territórios e documentos sem inferir fatos", () => {
    const person = {
      ...NEXO_DEMO_PESSOAS[0],
      documentos_fontes: [
        {
          id: "doc-1",
          pessoa_id: NEXO_DEMO_PESSOAS[0].id,
          storage_path: "private/doc-1.pdf",
          original_filename: "fonte.pdf",
          mime_type: "application/pdf" as const,
          size_bytes: 100,
          sha256: "abc123",
          page_count: 3,
          extractor_version: "test",
          ocr_status: "nao_aplicado" as const,
          created_at: "2026-10-21T12:00:00Z",
          alegacoes: [
            {
              id: "claim-1",
              documento_id: "doc-1",
              campo: "nome_mae",
              rotulo: "Nome da mãe",
              valor_original: "Maria A",
              valor_normalizado: "maria a",
              pagina: 1,
              fonte: "PDF 1",
              confianca: "alta" as const,
              estado: "aceito" as const,
            },
          ],
        },
        {
          id: "doc-2",
          pessoa_id: NEXO_DEMO_PESSOAS[0].id,
          storage_path: "private/doc-2.pdf",
          original_filename: "fonte-2.pdf",
          mime_type: "application/pdf" as const,
          size_bytes: 100,
          sha256: "def456",
          page_count: 2,
          extractor_version: "test",
          ocr_status: "nao_aplicado" as const,
          created_at: "2026-10-21T12:01:00Z",
          alegacoes: [
            {
              id: "claim-2",
              documento_id: "doc-2",
              campo: "nome_mae",
              rotulo: "Nome da mãe",
              valor_original: "Maria B",
              valor_normalizado: "maria b",
              pagina: 2,
              fonte: "PDF 2",
              confianca: "revisar" as const,
              estado: "aceito" as const,
            },
          ],
        },
      ],
    };
    const summary = buildNexoPersonIntelligenceSummary(
      person,
      NEXO_DEMO_ORGANIZACOES,
      NEXO_DEMO_TERRITORIOS,
      NEXO_DEMO_REGISTROS,
    );
    expect(summary.subject.name).toBe(person.nome);
    expect(summary.links[0]).toMatchObject({
      status: "provavel",
      confidence: expect.any(Number),
      evidence: { kind: "nao_confirmado", label: "Vínculo não confirmado" },
    });
    expect(summary.procedures.length).toBeGreaterThan(0);
    expect(summary.territories.length).toBeGreaterThan(0);
    expect(summary.timeline.some((event) => event.dateType === "vinculo")).toBe(true);
    expect(summary.timeline.some((event) => event.dateType === "documento")).toBe(true);
    expect(summary.timeline.find((event) => event.dateType === "documento")?.evidence.kind).toBe(
      "documento_de_origem",
    );
    expect(summary.documents[0]).toContain("SHA-256 abc123");
    expect(summary.comparisons[0].alternatives).toHaveLength(2);
    expect(summary.gaps).toContain("Há vínculo atual ainda não confirmado");
  });

  it("aponta lacunas cadastrais sem converter ausência em conclusão negativa", () => {
    const person = {
      ...NEXO_DEMO_PESSOAS[0],
      cpf: null,
      rg: null,
      endereco: null,
      fotos: [],
      foto_perfil_url: null,
      foto_perfil_path: null,
      foto_relatorio_url: null,
      foto_relatorio_path: null,
      vinculos: [],
    };
    const summary = buildNexoPersonIntelligenceSummary(person, [], [], []);
    expect(summary.gaps).toEqual([
      "Fotografia de perfil não disponível",
      "CPF e RG não informados",
      "Localização própria ou vinculada não disponível",
    ]);
    expect(summary.subject.location).toBe("Não informado");
  });
});
