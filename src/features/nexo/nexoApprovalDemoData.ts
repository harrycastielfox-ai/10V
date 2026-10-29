import { NEXO_PRESENTATION_DATA, nexoPresentationId } from "./nexoPresentationData";
import type { NexoFoto, NexoObservacao } from "./nexoTypes";
import toyImageUrl from "./brinquedos-ilustracao.webp";

// Local-only approval scenario: names of organizations are real, all records are invented.
const disclaimer =
  "DEMONSTRAÇÃO: nomes das organizações são referências públicas; pessoas, vínculos e demais dados são fictícios. Não indica atuação em Itabela/BA.";

const names = [
  { nome: "Comando Vermelho — DEMONSTRAÇÃO", sigla: "CV · DEMO", cor: "#dc2626" },
  { nome: "Primeiro Comando da Capital — DEMONSTRAÇÃO", sigla: "PCC · DEMO", cor: "#334155" },
  { nome: "Bonde do Maluco — DEMONSTRAÇÃO", sigla: "BDM · DEMO", cor: "#d97706" },
];

const toyPhoto = (
  id: string,
  personId: string | null,
  organizationId: string | null,
): NexoFoto => ({
  id,
  pessoa_id: personId,
  organizacao_id: organizationId,
  storage_path: "demo-public/brinquedos-ilustracao.webp",
  url: toyImageUrl,
  legenda: "Imagem gerada para demonstração: armas de brinquedo coloridas; não é evidência real.",
  categoria: "album",
  capturada_em: null,
});

const organizations = NEXO_PRESENTATION_DATA.organizations.slice(0, 3).map((org, index) => ({
  ...org,
  ...names[index],
  descricao: `Ficha cenográfica para demonstrar pessoas vinculadas, hierarquia, galeria e observações. ${disclaimer}`,
  area_atuacao: "Não informada — cenário de demonstração",
  fotos: [toyPhoto(nexoPresentationId(11, index + 1), null, org.id)],
}));

const people = organizations.flatMap((organization, index) =>
  NEXO_PRESENTATION_DATA.people.slice(index * 10, index * 10 + 8).map((person, personIndex) => {
    // Use only the synthetic portrait ranges that are versioned in public/nexo-demo/portraits.
    const portraitNumber = String([1, 35, 26][index] + personIndex).padStart(2, "0");
    const portraitPath = `demo-public/person-${portraitNumber}.webp`;
    const portraitUrl = `/nexo-demo/portraits/person-${portraitNumber}.webp`;
    return {
      ...person,
      nome: `Pessoa fictícia ${organization.sigla.split(" ")[0]} ${String(personIndex + 1).padStart(2, "0")}`,
      apelido: `Personagem ${String(index * 3 + personIndex + 1).padStart(2, "0")} (fictício)`,
      escolaridade: [
        "Ensino médio (fictício)",
        "Ensino fundamental (fictício)",
        "Ensino superior (fictício)",
      ][personIndex % 3],
      profissao: ["Comerciante (fictício)", "Motorista (fictício)", "Estudante (fictício)"][
        personIndex % 3
      ],
      estado_civil: ["Solteiro(a) (fictício)", "Casado(a) (fictício)", "Solteiro(a) (fictício)"][
        personIndex % 3
      ],
      foto_perfil_path: portraitPath,
      foto_relatorio_path: portraitPath,
      foto_perfil_url: portraitUrl,
      foto_relatorio_url: portraitUrl,
      observacoes: `Ficha de demonstração ${personIndex + 1}: dados pessoais e fotografia sintéticos. ${disclaimer}`,
      fotos: [
        ...person.fotos.map((photo) => ({
          ...photo,
          storage_path: portraitPath,
          url: portraitUrl,
        })),
        toyPhoto(nexoPresentationId(12, index * 3 + personIndex + 1), person.id, null),
      ],
      vinculos: person.vinculos.map((link) => ({
        ...link,
        organizacao: organization,
        fonte_resumo:
          "Vínculo inteiramente fictício para demonstração; não representa pessoa ou investigação real.",
      })),
    };
  }),
);

// Explicit demo reporting lines: a city leader can report to another leader.
// City labels belong to this scenario's recorded role, never to a person's address.
const regionalOrganization = organizations[2];
const regionalRoot = people.find((person) =>
  person.vinculos.some((link) => link.organizacao_id === regionalOrganization.id),
)!;
const regionalRoles = [
  { role: "Líder · Cidade A", parent: regionalRoot.vinculos[0].id },
  { role: "Líder · Cidade B", parent: regionalRoot.vinculos[0].id },
  { role: "Líder · Cidade C", parent: nexoPresentationId(31, 1) },
  { role: "Vice-líder · Cidade A", parent: nexoPresentationId(31, 1) },
  { role: "Vice-líder · Cidade B", parent: nexoPresentationId(31, 2) },
];
regionalRoles.forEach(({ role, parent }, index) => {
  const personId = nexoPresentationId(30, index + 1);
  const portrait = String(index + 9).padStart(2, "0");
  const portraitPath = `demo-public/person-${portrait}.webp`;
  const portraitUrl = `/nexo-demo/portraits/person-${portrait}.webp`;
  people.push({
    ...regionalRoot,
    id: personId,
    nome: `Pessoa fictícia BDM ${String(index + 9).padStart(2, "0")}`,
    apelido: `Personagem regional ${index + 1} (fictício)`,
    documentos_extras: [],
    contatos: [],
    endereco_id: null,
    endereco: null,
    foto_perfil_path: portraitPath,
    foto_relatorio_path: portraitPath,
    foto_perfil_url: portraitUrl,
    foto_relatorio_url: portraitUrl,
    fotos: [
      {
        ...regionalRoot.fotos[0],
        id: nexoPresentationId(32, index + 1),
        pessoa_id: personId,
        storage_path: portraitPath,
        url: portraitUrl,
        legenda: "Retrato sintético de personagem regional fictício.",
      },
    ],
    vinculos: [
      {
        ...regionalRoot.vinculos[0],
        id: nexoPresentationId(31, index + 1),
        pessoa_id: personId,
        funcao: role,
        superior_vinculo_id: parent,
        fonte_resumo:
          "Cenário fictício: cargo, cidade e subordinação definidos manualmente para demonstração. Cidades A, B e C são fictícias.",
      },
    ],
  });
});

const observations: NexoObservacao[] = [
  ...organizations.map((org, index) => ({
    id: nexoPresentationId(13, index + 1),
    pessoa_id: null,
    organizacao_id: org.id,
    conteudo: `CENÁRIO FICTÍCIO — ficha de ${org.sigla}. Personagens foram vinculados para demonstrar a consulta de perfis e uma hierarquia ramificada. A imagem no álbum mostra brinquedos ilustrativos, não uma apreensão. ${disclaimer}`,
    created_at: "2026-10-18T14:00:00.000Z",
    created_by: "demo",
    autor: { nome: "Equipe de demonstração" },
  })),
  ...people.map((person, index) => ({
    id: nexoPresentationId(14, index + 1),
    pessoa_id: person.id,
    organizacao_id: null,
    conteudo: `REGISTRO FICTÍCIO — personagem criado exclusivamente para apresentação. O retrato é sintético e o álbum contém imagem ilustrativa de brinquedos. Não corresponde a pessoa, investigação ou fato real. ${disclaimer}`,
    created_at: "2026-10-18T15:00:00.000Z",
    created_by: "demo",
    autor: { nome: "Equipe de demonstração" },
  })),
];

export const NEXO_APPROVAL_DEMO_DATA = {
  ...NEXO_PRESENTATION_DATA,
  disclaimer,
  organizations,
  people,
  territories: [],
  procedures: [],
  records: [],
  observations,
  hierarchyEvents: [],
};
