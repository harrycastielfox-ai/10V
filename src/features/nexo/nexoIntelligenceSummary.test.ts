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
    });
    expect(summary.procedures.length).toBeGreaterThan(0);
    expect(summary.territories.length).toBeGreaterThan(0);
    expect(summary.documents[0]).toContain("SHA-256 abc123");
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
