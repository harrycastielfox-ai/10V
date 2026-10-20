import { describe, expect, it } from "vitest";
import {
  NEXO_DEMO_ORGANIZACOES,
  NEXO_DEMO_PESSOAS,
  NEXO_DEMO_REGISTROS,
  NEXO_DEMO_TERRITORIOS,
} from "./nexoDemoData";
import {
  createNexoReportConfig,
  groupNexoReportProcedures,
  listNexoReportPhotos,
  normalizeNexoReportConfig,
  selectedNexoReportPhotos,
  selectNexoReportData,
  summarizeNexoReport,
} from "./nexoReportConfig";
import type { NexoObservacao, NexoPessoa } from "./nexoTypes";

const person: NexoPessoa = {
  ...NEXO_DEMO_PESSOAS[0],
  foto_relatorio_url: "/reference.jpg",
  foto_perfil_url: "/profile.jpg",
  fotos: [
    {
      id: "reference",
      pessoa_id: "pessoa-1",
      storage_path: "reference",
      categoria: "relatorio",
      legenda: "Imagem principal",
      capturada_em: null,
      url: "/reference.jpg",
    },
    {
      id: "extra",
      pessoa_id: "pessoa-1",
      storage_path: "extra",
      categoria: "album",
      legenda: "Imagem complementar",
      capturada_em: null,
      url: "/extra.jpg",
    },
  ],
};

const note = (overrides: Partial<NexoObservacao> = {}): NexoObservacao => ({
  id: "note-1",
  pessoa_id: person.id,
  organizacao_id: null,
  conteudo: "Anotação",
  created_at: "2026-10-18T15:00:00Z",
  created_by: "author",
  ...overrides,
});

const data = {
  organizacoes: NEXO_DEMO_ORGANIZACOES,
  pessoas: [person],
  territorios: NEXO_DEMO_TERRITORIOS,
  registros: NEXO_DEMO_REGISTROS,
};

describe("configuração de relatórios NEXO", () => {
  it("cria configurações independentes e mantém compatibilidade com opções ausentes", () => {
    const first = createNexoReportConfig();
    first.sections.photographs = false;
    first.excludedPhotoPersonIds.push(person.id);
    expect(createNexoReportConfig().sections.photographs).toBe(true);
    expect(createNexoReportConfig().excludedPhotoPersonIds).toEqual([]);
    const normalized = normalizeNexoReportConfig({ sections: { links: false } } as never);
    expect(normalized.sections.links).toBe(false);
    expect(normalized.sections.identification).toBe(true);
  });

  it("não duplica a foto principal e inclui o perfil quando é uma imagem distinta", () => {
    expect(listNexoReportPhotos(person).map((photo) => photo.url)).toEqual([
      "/reference.jpg",
      "/extra.jpg",
      "/profile.jpg",
    ]);
  });

  it("reconhece a mesma imagem pelo arquivo quando seus links assinados são diferentes", () => {
    const signedPerson: NexoPessoa = {
      ...person,
      foto_relatorio_path: "reference",
      foto_relatorio_url: "/reference.jpg?token=report",
      foto_perfil_path: "reference",
      foto_perfil_url: "/reference.jpg?token=profile",
      fotos: [
        { ...person.fotos[0], url: "/reference.jpg?token=album" },
        person.fotos[1],
        { ...person.fotos[1], id: "duplicate", url: "/extra.jpg?token=renewed" },
      ],
    };
    expect(listNexoReportPhotos(signedPerson)).toEqual([
      {
        key: `${person.id}:principal`,
        personId: person.id,
        url: "/reference.jpg?token=report",
        caption: "Imagem principal",
        kind: "principal",
      },
      {
        key: `${person.id}:foto:extra`,
        personId: person.id,
        url: "/extra.jpg",
        caption: "Imagem complementar",
        kind: "album",
      },
    ]);
    const config = createNexoReportConfig();
    config.photoOverrides[`${person.id}:principal`] = { included: false };
    expect(selectedNexoReportPhotos(signedPerson, config).map((photo) => photo.url)).toEqual([
      "/extra.jpg",
    ]);
  });

  it("respeita exclusão individual, legenda vazia e exclusão de todas as fotos da pessoa", () => {
    const config = createNexoReportConfig();
    config.photoOverrides[`${person.id}:principal`] = { included: false };
    config.photoOverrides[`${person.id}:foto:extra`] = { caption: "" };
    expect(selectedNexoReportPhotos(person, config).map((photo) => photo.caption)).toEqual([
      "",
      "Fotografia de perfil",
    ]);
    expect(person.fotos[1].legenda).toBe("Imagem complementar");
    config.excludedPhotoPersonIds = [person.id];
    expect(selectedNexoReportPhotos(person, config)).toEqual([]);
    config.excludedPhotoPersonIds = [];
    config.sections.photographs = false;
    expect(selectedNexoReportPhotos(person, config)).toEqual([]);
  });

  it("filtra anotações pelo recorte, ignora vazias e ordena sem alterar a lista de origem", () => {
    const observations = [
      note({ id: "later" }),
      note({ id: "other", pessoa_id: "pessoa-2" }),
      note({ id: "empty", conteudo: "  " }),
      note({ id: "earlier", created_at: "2026-10-17T15:00:00Z" }),
      note({ id: "organization", pessoa_id: null, organizacao_id: "org-atlas" }),
    ];
    const selected = selectNexoReportData(
      { kind: "pessoa", pessoaId: person.id },
      { ...data, observacoes: observations },
    );
    expect(selected.observations.map((entry) => entry.id)).toEqual(["earlier", "later"]);
    expect(observations[0].id).toBe("later");
    expect(
      selectNexoReportData(
        { kind: "organizacao", organizacaoId: "org-atlas" },
        { ...data, observacoes: observations },
      ).observations.map((entry) => entry.id),
    ).toEqual(["earlier", "later", "organization"]);
  });

  it("conta procedimentos únicos sem perder os seus vínculos", () => {
    const records = [
      NEXO_DEMO_REGISTROS[0],
      { ...NEXO_DEMO_REGISTROS[0], id: "same-procedure", pessoa_id: person.id },
    ];
    expect(groupNexoReportProcedures(records)).toHaveLength(1);
    expect(groupNexoReportProcedures(records)[0].links).toHaveLength(2);
    expect(summarizeNexoReport({ kind: "geral" }, { ...data, registros: records }).procedures).toBe(
      1,
    );
  });

  it("a prévia zera as seções desmarcadas", () => {
    const config = createNexoReportConfig();
    for (const key of Object.keys(config.sections) as (keyof typeof config.sections)[])
      config.sections[key] = false;
    const summary = summarizeNexoReport({ kind: "geral" }, data, config);
    expect(summary).toMatchObject({
      sections: 0,
      links: 0,
      procedures: 0,
      territories: 0,
      addresses: 0,
      observations: 0,
      photos: 0,
    });
  });
});
