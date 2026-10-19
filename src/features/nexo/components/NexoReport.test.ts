import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  NEXO_DEMO_ORGANIZACOES,
  NEXO_DEMO_PESSOAS,
  NEXO_DEMO_REGISTROS,
  NEXO_DEMO_TERRITORIOS,
} from "../nexoDemoData";
import { NexoReport } from "./NexoReport";
import { createNexoReportConfig } from "../nexoReportConfig";
import type { NexoObservacao, NexoPessoa } from "../nexoTypes";

function render(
  scope: { kind: "pessoa"; pessoaId: string } | { kind: "organizacao"; organizacaoId: string },
) {
  return renderToStaticMarkup(
    createElement(NexoReport, {
      scope,
      organizacoes: NEXO_DEMO_ORGANIZACOES,
      pessoas: NEXO_DEMO_PESSOAS,
      territorios: NEXO_DEMO_TERRITORIOS,
      registros: NEXO_DEMO_REGISTROS,
    }),
  );
}

describe("conteúdo dos PDFs do NEXO", () => {
  it("não inclui procedimento exclusivo da facção na ficha individual", () => {
    const html = render({ kind: "pessoa", pessoaId: "pessoa-1" });
    expect(html).toContain("BO 0187/2026");
    expect(html).not.toContain("IP 0042/2026");
  });

  it("inclui integrantes e procedimentos próprios e diretos no relatório da facção", () => {
    const html = render({ kind: "organizacao", organizacaoId: "org-atlas" });
    expect(html).toContain("Pessoa Demonstrativa A");
    expect(html).toContain("BO 0187/2026");
    expect(html).toContain("IP 0042/2026");
    expect(html).not.toContain("Pessoa Demonstrativa B");
  });

  const person: NexoPessoa = {
    ...NEXO_DEMO_PESSOAS[0],
    cpf: "CPF-EXCLUSIVO",
    observacoes: "OBSERVAÇÃO-EXCLUSIVA",
    foto_relatorio_url: "/foto-principal-exclusiva.jpg",
    fotos: [
      {
        id: "extra",
        pessoa_id: "pessoa-1",
        storage_path: "extra",
        categoria: "album",
        legenda: "LEGENDA-ORIGINAL",
        capturada_em: null,
        url: "/foto-extra-exclusiva.jpg",
      },
    ],
  };
  const observation: NexoObservacao = {
    id: "note",
    pessoa_id: person.id,
    organizacao_id: null,
    conteudo: "ANOTAÇÃO-DATADA-EXCLUSIVA",
    created_at: "2026-10-18T15:00:00Z",
    created_by: "author",
    autor: { nome: "AUTORIA-EXCLUSIVA" },
  };
  function renderConfigured(config = createNexoReportConfig(), notes = [observation]) {
    return renderToStaticMarkup(
      createElement(NexoReport, {
        scope: { kind: "pessoa", pessoaId: person.id },
        organizacoes: NEXO_DEMO_ORGANIZACOES,
        pessoas: [person],
        registros: NEXO_DEMO_REGISTROS,
        observacoes: notes,
        config,
      }),
    );
  }

  it("remove as seções desmarcadas do DOM impresso, não apenas da aparência", () => {
    const config = createNexoReportConfig();
    for (const key of Object.keys(config.sections) as (keyof typeof config.sections)[])
      config.sections[key] = false;
    const html = renderConfigured(config);
    expect(html).toContain(person.nome);
    for (const excluded of [
      "CPF-EXCLUSIVO",
      "OBSERVAÇÃO-EXCLUSIVA",
      "ANOTAÇÃO-DATADA-EXCLUSIVA",
      "AUTORIA-EXCLUSIVA",
      "LEGENDA-ORIGINAL",
      "/foto-principal-exclusiva.jpg",
      "/foto-extra-exclusiva.jpg",
      "BO 0187/2026",
      "Rua Demo Operacional",
      "Liderança local",
      "Informações convergentes",
    ])
      expect(html).not.toContain(excluded);
  });

  it("permite excluir uma foto e imprimir a legenda específica de outra sem alterar o cadastro", () => {
    const config = createNexoReportConfig();
    config.photoOverrides[`${person.id}:principal`] = { included: false };
    config.photoOverrides[`${person.id}:foto:extra`] = {
      caption: "Contexto <registrado>\nLinha 2",
    };
    const html = renderConfigured(config);
    expect(html).not.toContain("/foto-principal-exclusiva.jpg");
    expect(html).toContain("/foto-extra-exclusiva.jpg");
    expect(html).toContain("Contexto &lt;registrado&gt;\nLinha 2");
    expect(html).not.toContain("LEGENDA-ORIGINAL");
    expect(person.fotos[0].legenda).toBe("LEGENDA-ORIGINAL");
  });

  it("excluir as fotografias da pessoa não remove identificação ou anotações", () => {
    const config = createNexoReportConfig();
    config.excludedPhotoPersonIds = [person.id];
    const html = renderConfigured(config);
    expect(html).not.toContain("/foto-extra-exclusiva.jpg");
    expect(html).not.toContain("/foto-principal-exclusiva.jpg");
    expect(html).toContain("CPF-EXCLUSIVO");
    expect(html).toContain("ANOTAÇÃO-DATADA-EXCLUSIVA");
    expect(html).toContain("18/10/2026, 12:00");
    expect(html).toContain("AUTORIA-EXCLUSIVA");
  });

  it("uma data inválida de anotação não impede a geração do relatório", () => {
    const html = renderConfigured(createNexoReportConfig(), [
      { ...observation, created_at: "invalid" },
    ]);
    expect(html).toContain("ANOTAÇÃO-DATADA-EXCLUSIVA");
    expect(html).toContain("Data não informada");
  });

  it("consolida procedimentos repetidos no quadro geral e preserva os destinos do vínculo", () => {
    const config = createNexoReportConfig();
    config.sections.identification = false;
    config.sections.links = false;
    config.sections.locations = false;
    config.sections.observations = false;
    config.sections.photographs = false;
    const record = NEXO_DEMO_REGISTROS.find((entry) => entry.bo_id)!;
    const html = renderToStaticMarkup(
      createElement(NexoReport, {
        scope: { kind: "geral" },
        organizacoes: NEXO_DEMO_ORGANIZACOES,
        pessoas: [],
        registros: [
          { ...record, pessoa_id: null, organizacao_id: "org-atlas" },
          {
            ...record,
            id: "second-link",
            pessoa_id: null,
            organizacao_id: NEXO_DEMO_ORGANIZACOES[1].id,
          },
        ],
        config,
      }),
    );
    expect(html.match(/BO 0187\/2026/g)).toHaveLength(1);
    expect(html).toContain(NEXO_DEMO_ORGANIZACOES[0].nome);
    expect(html).toContain(NEXO_DEMO_ORGANIZACOES[1].nome);
  });

  it("identifica vínculos históricos sem apresentar a pessoa como integrante atual", () => {
    const html = renderToStaticMarkup(
      createElement(NexoReport, {
        scope: { kind: "organizacao", organizacaoId: "org-atlas" },
        organizacoes: NEXO_DEMO_ORGANIZACOES,
        pessoas: [
          {
            ...person,
            vinculos: [{ ...person.vinculos[0], status: "desvinculado" }],
          },
        ],
      }),
    );
    expect(html).toContain("Somente vínculos históricos neste recorte");
    expect(html).toContain("não indica participação atual");
    expect(html).toContain("Desvinculado");
  });
});
