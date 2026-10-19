import type {
  NexoEndereco,
  NexoHierarquiaEvento,
  NexoObservacao,
  NexoOrganizacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoTerritorio,
  NexoVinculo,
} from "./nexoTypes";

/** Stable, reproducible fixtures for the presentation. Not operational intelligence. */
export const NEXO_PRESENTATION_CREATED_AT = "2026-10-18T15:00:00.000Z";
export const NEXO_PRESENTATION_DISCLAIMER =
  "DEMONSTRAÇÃO: pessoas, imagens, facções, vínculos, procedimentos e setores inteiramente fictícios. " +
  "Itabela/BA é apenas uma referência geográfica; os pontos não representam moradias, sedes ou ocorrências reais.";

/** Replace with a preserved administrator's UUID only when inserting author-owned rows. */
export const NEXO_PRESENTATION_AUTHOR_ID = "f0e00000-0000-4000-8000-000000000001";

export function nexoPresentationId(kind: number, index: number): string {
  return `f0e${kind.toString(16).padStart(5, "0")}-0000-4000-8000-${index.toString(16).padStart(12, "0")}`;
}

export function nexoPresentationMapsUrl(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${latitude},${longitude}`)}`;
}

/** Municipality-level anchor published by Itabela's official "Como Chegar" map. */
export const NEXO_PRESENTATION_GEOGRAPHY = {
  municipality: "Itabela",
  state: "BA",
  ibgeCode: "2914653",
  anchor: { latitude: -16.575, longitude: -39.552777777778 },
  municipalSource: "https://www.itabela.ba.gov.br/localizacao",
  ibgeSource: "https://www.ibge.gov.br/cidades-e-estados/ba/itabela.html",
  mapsDocumentation: "https://developers.google.com/maps/documentation/urls/get-started",
  note: "Âncora pública da cidade. Os deslocamentos e polígonos abaixo são cenográficos, não geocodificações de imóveis.",
} as const;

const factionSpecs = [
  {
    nome: "Aliança do Horizonte (Fictícia)",
    sigla: "AH-DEMO",
    cor: "#0f8d9d",
    status: "monitoramento",
    risco: "alto",
    setor: "A",
  },
  {
    nome: "Núcleo Prisma (Fictícia)",
    sigla: "NP-DEMO",
    cor: "#c2416b",
    status: "ativa",
    risco: "moderado",
    setor: "B",
  },
  {
    nome: "Círculo Ônix (Fictícia)",
    sigla: "CO-DEMO",
    cor: "#7c3aed",
    status: "monitoramento",
    risco: "critico",
    setor: "C",
  },
  {
    nome: "Frente Boreal (Fictícia)",
    sigla: "FB-DEMO",
    cor: "#d97706",
    status: "indeterminada",
    risco: "moderado",
    setor: "D",
  },
  {
    nome: "Rede Vértice (Fictícia)",
    sigla: "RV-DEMO",
    cor: "#2563eb",
    status: "ativa",
    risco: "baixo",
    setor: "E",
  },
] as const;

export const NEXO_PRESENTATION_ORGANIZATIONS: NexoOrganizacao[] = factionSpecs.map(
  (spec, index) => ({
    id: nexoPresentationId(1, index + 1),
    nome: spec.nome,
    sigla: spec.sigla,
    status: spec.status,
    cor: spec.cor,
    descricao: `Facção fictícia de apresentação ${index + 1}/5. ${NEXO_PRESENTATION_DISCLAIMER}`,
    area_atuacao: `Setor ${spec.setor} (SIMULADO) · referência geográfica de Itabela/BA`,
    nivel_risco: spec.risco,
    simbolo_path: null,
    created_at: `2026-09-${String(1 + index * 3).padStart(2, "0")}T13:00:00.000Z`,
  }),
);

// Artificial offsets around the public city anchor make map controls demonstrable.
// Neither these sectors nor their vertices claim official neighborhood boundaries.
const sectorOffsets = [
  { latitude: 0.006, longitude: -0.015 },
  { latitude: 0.0035, longitude: -0.006 },
  { latitude: -0.002, longitude: -0.017 },
  { latitude: -0.006, longitude: -0.008 },
  { latitude: -0.008, longitude: 0.002 },
] as const;

function sectorCoordinates(index: number) {
  return {
    latitude: Number(
      (NEXO_PRESENTATION_GEOGRAPHY.anchor.latitude + sectorOffsets[index].latitude).toFixed(6),
    ),
    longitude: Number(
      (NEXO_PRESENTATION_GEOGRAPHY.anchor.longitude + sectorOffsets[index].longitude).toFixed(6),
    ),
  };
}

function schematicPoint(latitude: number, longitude: number) {
  // Same reference extent as the current NEXO schematic map, not geographic degrees.
  return {
    x: Number((((longitude + 39.59) / 0.05) * 100).toFixed(3)),
    y: Number((((-16.55 - latitude) / 0.04) * 100).toFixed(3)),
  };
}

export const NEXO_PRESENTATION_TERRITORIES: NexoTerritorio[] = NEXO_PRESENTATION_ORGANIZATIONS.map(
  (organization, index) => {
    const coordinate = sectorCoordinates(index);
    const center = schematicPoint(coordinate.latitude, coordinate.longitude);
    return {
      id: nexoPresentationId(2, index + 1),
      organizacao_id: organization.id,
      bairro: `Setor ${factionSpecs[index].setor} (SIMULADO)`,
      categoria: "outro",
      classificacao: index === 2 ? "disputado" : index === 3 ? "em_analise" : "indicativo",
      confianca: [85, 72, 58, 35, 91][index],
      fonte_resumo:
        "Roteiro sintético da apresentação; não é fonte investigativa ou constatação de domínio territorial.",
      observacoes: NEXO_PRESENTATION_DISCLAIMER,
      logradouro: "Referência geográfica hipotética — sem endereço residencial",
      numero: null,
      complemento: "Polígono cenográfico, sem valor cadastral ou probatório",
      municipio: "Itabela",
      uf: "BA",
      ponto_referencia: `Mapa de Itabela/BA · setor ${factionSpecs[index].setor} criado para demonstração`,
      link_navegacao: nexoPresentationMapsUrl(coordinate.latitude, coordinate.longitude),
      pontos: [
        { x: center.x - 4, y: center.y - 4 },
        { x: center.x + 4, y: center.y - 4 },
        { x: center.x + 5, y: center.y + 2 },
        { x: center.x, y: center.y + 5 },
        { x: center.x - 5, y: center.y + 2 },
      ],
      created_at: "2026-09-15T13:00:00.000Z",
      updated_at: "2026-10-17T16:30:00.000Z",
    };
  },
);

// Names are invented compositions, explicitly suffixed DEMO to prevent confusion.
const personNames = [
  "Caio Valença Duarte",
  "Lívia Monteiro Amaral",
  "Breno Azevedo Reis",
  "Mirela Paiva Nascimento",
  "Davi Serpa Moreira",
  "Nádia Fontes Almeida",
  "Ícaro Tavares Lima",
  "Raquel Nobre Vieira",
  "Hugo Alencar Matos",
  "Tainá Vilar Costa",
  "Artur Lacerda Farias",
  "Bianca Sarmento Leal",
  "Enzo Portela Sá",
  "Cecília Moura Dantas",
  "Noel Varela Pinto",
  "Elisa Prado Queirós",
  "Otávio Lira Castro",
  "Flávia Sampaio Neves",
  "Samuel Brito Menezes",
  "Débora Luz Peixoto",
  "Guilherme Pires Vidal",
  "Helena Vasconcelos Maia",
  "Murilo Freitas Teles",
  "Isadora Arantes Melo",
  "Ruan Teixeira Bastos",
  "Joana Falcão Assis",
  "Nicolas Rezende Ramos",
  "Laura Seixas Cardoso",
  "Vitor Galvão Pereira",
  "Sofia Barros Machado",
  "Danilo Guedes Aquino",
  "Manuela Dias Salles",
  "Rafael Muniz Andrade",
  "Letícia Motta Xavier",
  "Alan Bezerra Coelho",
  "Camila Aguiar Lopes",
  "Diego Linhares Braga",
  "Marina Sales Ribeiro",
  "Felipe Viana Torres",
  "Juliana Campos Rocha",
  "Vinícius Veloso Sena",
  "Aline Mesquita Brites",
  "Leonardo Pacheco Vale",
  "Renata Chaves Figueira",
  "Pedro Amarantes Campos",
  "Bruna Carvalho Gama",
  "Eduardo Silveira Moraes",
  "Natália Correia Luz",
  "Thiago Pedrosa Cruz",
  "Priscila Gomes Malta",
] as const;

const aliases = [
  "Farol",
  "Aurora",
  "Mosaico",
  "Brisa",
  "Cedro",
  "Órbita",
  "Delta",
  "Íris",
  "Lume",
  "Maré",
] as const;
const roles = [
  "Líder",
  "Vice-líder",
  "Coordenador de núcleo",
  "Coordenadora de núcleo",
  "Integrante",
  "Integrante",
  "Integrante",
  "Integrante",
  "Integrante",
  "Integrante",
] as const;

function superiorIndex(index: number): number | null {
  if (index === 0) return null;
  if (index === 1) return 0;
  if (index < 4) return 1;
  return index < 7 ? 2 : 3;
}

function makeAddress(index: number, factionIndex: number): NexoEndereco {
  const coordinate = sectorCoordinates(factionIndex);
  return {
    id: nexoPresentationId(5, index + 1),
    logradouro: "Referência de mapa (SIMULADA) — não é moradia",
    numero: null,
    bairro: `Setor ${factionSpecs[factionIndex].setor} (SIMULADO)`,
    municipio: "Itabela",
    uf: "BA",
    ponto_referencia:
      "Ponto cenográfico relativo à âncora pública de Itabela; sem associação com imóvel ou morador.",
    como_chegar:
      "Use o Google Maps apenas para demonstrar a navegação geográfica. Este não é um endereço operacional.",
    link_navegacao: nexoPresentationMapsUrl(coordinate.latitude, coordinate.longitude),
    latitude: coordinate.latitude,
    longitude: coordinate.longitude,
  };
}

export const NEXO_PRESENTATION_PEOPLE: NexoPessoa[] = personNames.map((name, index) => {
  const number = index + 1;
  const factionIndex = Math.floor(index / 10);
  const localIndex = index % 10;
  const organization = NEXO_PRESENTATION_ORGANIZATIONS[factionIndex];
  const superior = superiorIndex(localIndex);
  const personId = nexoPresentationId(3, number);
  const portraitNumber = String(number).padStart(2, "0");
  const portraitPath = `demo-public/person-${portraitNumber}.png`;
  const portraitUrl = `/nexo-demo/portraits/person-${portraitNumber}.png`;
  const address = makeAddress(index, factionIndex);
  const status: NexoVinculo["status"] =
    localIndex < 3
      ? "confirmado"
      : localIndex < 6
        ? "provavel"
        : localIndex < 8
          ? "suspeito"
          : "nao_confirmado";
  const approximateAge = localIndex === 8;
  return {
    id: personId,
    nome: `${name} · DEMO`,
    apelido: `${aliases[localIndex]} ${factionIndex + 1}`,
    cpf: null,
    rg: `DEMO-${String(number).padStart(3, "0")}`,
    data_nascimento: approximateAge
      ? null
      : `${1981 + (index % 22)}-${String((index % 12) + 1).padStart(2, "0")}-${String((index % 25) + 1).padStart(2, "0")}`,
    naturalidade: "Dado sintético — Itabela/BA como cenário",
    nome_mae:
      localIndex % 3 === 0
        ? "NÃO CONSTA"
        : `Filiação fictícia M-${String(number).padStart(3, "0")}`,
    nome_pai:
      localIndex % 2 === 0
        ? "NÃO CONSTA"
        : `Filiação fictícia P-${String(number).padStart(3, "0")}`,
    nome_social: null,
    sexo: index % 2 === 0 ? "Masculino" : "Feminino",
    raca_cor: null,
    estado_civil: "Não informado",
    nacionalidade: "Brasileira (dado sintético)",
    escolaridade: "Não informado",
    profissao: "Não informada",
    idade_aproximada: approximateAge,
    idade_aproximada_valor: approximateAge ? 29 + factionIndex : null,
    em_situacao_rua: false,
    usa_tornozeleira: false,
    altura_cm: 158 + (index % 30),
    tipo_fisico: ["Mediano", "Magro", "Robusto"][index % 3],
    estado_aparente: "Sem avaliação — cadastro de demonstração",
    sinais_particulares: "Nenhum sinal real registrado; imagem e identidade sintéticas.",
    documentos_extras: [
      {
        id: nexoPresentationId(9, number),
        tipo: "Outro",
        numero: `DOCUMENTO-DEMO-${String(number).padStart(3, "0")}`,
      },
    ],
    contatos: [
      {
        id: nexoPresentationId(10, number),
        tipo: "E-mail",
        valor: `pessoa-${String(number).padStart(3, "0")}@example.invalid`,
        whatsapp: false,
      },
    ],
    telefone: null,
    observacoes: NEXO_PRESENTATION_DISCLAIMER,
    foto_perfil_path: portraitPath,
    foto_relatorio_path: portraitPath,
    foto_perfil_url: portraitUrl,
    foto_relatorio_url: portraitUrl,
    endereco_id: address.id,
    endereco: address,
    usar_local_faccao: false,
    vinculos: [
      {
        id: nexoPresentationId(4, number),
        pessoa_id: personId,
        organizacao_id: organization.id,
        status,
        funcao: roles[localIndex],
        confianca: [98, 92, 87, 78, 71, 65, 52, 43, 24, 18][localIndex],
        fonte_resumo:
          "Roteiro fictício da apresentação; status e confiança apenas ilustram os controles do sistema.",
        desde: `2026-09-${String(1 + localIndex).padStart(2, "0")}`,
        ate: null,
        superior_vinculo_id:
          superior === null ? null : nexoPresentationId(4, factionIndex * 10 + superior + 1),
        organizacao: organization,
      },
    ],
    fotos: [
      {
        id: nexoPresentationId(6, number),
        pessoa_id: personId,
        storage_path: portraitPath,
        legenda: `Retrato sintético ${String(number).padStart(2, "0")} — personagem fictício criado para demonstração.`,
        categoria: "perfil",
        capturada_em: "2026-10-18",
        url: portraitUrl,
      },
    ],
    created_at: `2026-09-${String(1 + (index % 28)).padStart(2, "0")}T${String(8 + (index % 10)).padStart(2, "0")}:00:00.000Z`,
  };
});

export interface NexoPresentationProcedure {
  id: string;
  type: "bo" | "inquerito";
  number: string;
  organizationId: string;
  personIds: string[];
  /** Shared between a B.O. and its inquiry so the dashboard can deduplicate incidents. */
  incidentKey: string;
  relatedBoId: string | null;
  relatedBoNumber: string | null;
  nature: string;
  cvli: boolean;
  date: string;
  time: string;
  neighborhood: string;
  latitude: number;
  longitude: number;
  mapsUrl: string;
  status: string;
  narrative: string;
  isFictional: true;
}

const factDates = [
  "2026-09-07",
  "2026-09-14",
  "2026-09-21",
  "2026-09-28",
  "2026-10-05",
  "2026-10-06",
  "2026-10-10",
  "2026-10-12",
  "2026-10-14",
  "2026-10-17",
];
const factTimes = [
  "20:30",
  "21:15",
  "20:45",
  "19:10",
  "22:20",
  "08:35",
  "14:20",
  "21:50",
  "10:10",
  "18:40",
];
const natures = [
  "Homicídio doloso",
  "Homicídio doloso",
  "Latrocínio",
  "Homicídio doloso",
  "Feminicídio",
  "Furto",
  "Roubo",
  "Homicídio doloso",
  "Dano",
  "Ameaça",
];

const presentationBos: NexoPresentationProcedure[] = Array.from({ length: 10 }, (_, index) => {
  const factionIndex = index % 5;
  const coordinate = sectorCoordinates(factionIndex);
  return {
    id: nexoPresentationId(20, index + 1),
    type: "bo",
    number: `DEMO-BO-${String(index + 1).padStart(4, "0")}/2026`,
    organizationId: NEXO_PRESENTATION_ORGANIZATIONS[factionIndex].id,
    personIds: [NEXO_PRESENTATION_PEOPLE[factionIndex * 10 + (index < 5 ? 0 : 4)].id],
    incidentKey: `SIMULACAO-${String(index + 1).padStart(3, "0")}`,
    relatedBoId: null,
    relatedBoNumber: null,
    nature: `${natures[index]} — SIMULAÇÃO`,
    cvli: [0, 1, 2, 3, 4, 7].includes(index),
    date: factDates[index],
    time: factTimes[index],
    neighborhood: `Setor ${factionSpecs[factionIndex].setor} (SIMULADO)`,
    ...coordinate,
    mapsUrl: nexoPresentationMapsUrl(coordinate.latitude, coordinate.longitude),
    status: index % 3 === 0 ? "Concluído" : "Em andamento",
    narrative: `Cenário didático ${index + 1}: permite demonstrar vínculos, contexto do fato, filtros e indicadores. ${NEXO_PRESENTATION_DISCLAIMER}`,
    isFictional: true,
  };
});

export const NEXO_PRESENTATION_PROCEDURES: NexoPresentationProcedure[] = [
  ...presentationBos,
  ...presentationBos.slice(0, 5).map((bo, index): NexoPresentationProcedure => ({
    ...bo,
    id: nexoPresentationId(21, index + 1),
    type: "inquerito",
    number: `DEMO-IP-${String(index + 1).padStart(4, "0")}/2026`,
    relatedBoId: bo.id,
    relatedBoNumber: bo.number,
    status: index === 0 ? "Relatado" : "Em andamento",
  })),
];

export const NEXO_PRESENTATION_RECORDS: NexoRegistroVinculado[] =
  NEXO_PRESENTATION_PROCEDURES.flatMap((procedure, index) => {
    const common = {
      inquerito_id: procedure.type === "inquerito" ? procedure.id : null,
      bo_id: procedure.type === "bo" ? procedure.id : null,
      observacao: "Vínculo sintético de demonstração; não representa envolvimento de pessoa real.",
      created_at: `${procedure.date}T15:30:00.000Z`,
      ...(procedure.type === "bo"
        ? {
            bo: {
              numero_bo: procedure.number,
              infracao_penal: procedure.nature,
              status: procedure.status,
            },
          }
        : { inquerito: { numero_ppe: procedure.number, tipo: "IP", situacao: procedure.status } }),
    };
    return [
      {
        ...common,
        id: nexoPresentationId(22, index * 2 + 1),
        organizacao_id: procedure.organizationId,
        pessoa_id: null,
      },
      {
        ...common,
        id: nexoPresentationId(22, index * 2 + 2),
        organizacao_id: null,
        pessoa_id: procedure.personIds[0],
      },
    ];
  });

export const NEXO_PRESENTATION_OBSERVATIONS: NexoObservacao[] = [
  ...NEXO_PRESENTATION_ORGANIZATIONS.map((organization, index): NexoObservacao => ({
    id: nexoPresentationId(7, index + 1),
    pessoa_id: null,
    organizacao_id: organization.id,
    conteudo: `NOTA DEMONSTRATIVA — ${organization.nome}\n\nSíntese de apresentação: dez personagens sintéticos, liderança e coordenação em três níveis, mapa cenográfico e procedimentos de exemplo. Esta anotação demonstra o registro cronológico de informações.\n\n${NEXO_PRESENTATION_DISCLAIMER}`,
    created_at: `2026-10-${String(12 + index).padStart(2, "0")}T14:00:00.000Z`,
    created_by: NEXO_PRESENTATION_AUTHOR_ID,
    autor: { nome: "Equipe de demonstração" },
  })),
  ...NEXO_PRESENTATION_PEOPLE.map((person, index): NexoObservacao => ({
    id: nexoPresentationId(7, index + 6),
    pessoa_id: person.id,
    organizacao_id: null,
    conteudo: `ANOTAÇÃO FICTÍCIA — atualização de ficha ${String(index + 1).padStart(3, "0")}.\n\nO retrato é sintético, a filiação não é real e o ponto de mapa é somente cenográfico. Vínculo e cargo foram incluídos para demonstrar edição, transferência e consulta da hierarquia. ${NEXO_PRESENTATION_DISCLAIMER}`,
    created_at: `2026-10-${String(10 + (index % 8)).padStart(2, "0")}T${String(10 + (index % 8)).padStart(2, "0")}:20:00.000Z`,
    created_by: NEXO_PRESENTATION_AUTHOR_ID,
    autor: { nome: "Equipe de demonstração" },
  })),
];

export const NEXO_PRESENTATION_HIERARCHY_EVENTS: NexoHierarquiaEvento[] =
  NEXO_PRESENTATION_PEOPLE.map((person, index) => {
    const link = person.vinculos[0];
    const superiorPerson = NEXO_PRESENTATION_PEOPLE.find(
      (candidate) => candidate.vinculos[0].id === link.superior_vinculo_id,
    );
    return {
      id: nexoPresentationId(8, index + 1),
      organizacao_id: link.organizacao_id,
      pessoa_id: person.id,
      vinculo_id: link.id,
      tipo: "entrada",
      funcao_anterior: null,
      funcao_nova: link.funcao,
      superior_anterior_nome: null,
      superior_novo_nome: superiorPerson?.nome ?? null,
      status_anterior: null,
      status_novo: link.status,
      pessoa_nome: person.nome,
      justificativa:
        "Inclusão cenográfica para demonstrar o histórico de hierarquia, sem fato ou vínculo real.",
      ocorrido_em: `${link.desde}T13:00:00.000Z`,
      autor: { nome: "Equipe de demonstração" },
    };
  });

export const NEXO_PRESENTATION_DATA = {
  isFictional: true as const,
  createdAt: NEXO_PRESENTATION_CREATED_AT,
  disclaimer: NEXO_PRESENTATION_DISCLAIMER,
  geography: NEXO_PRESENTATION_GEOGRAPHY,
  organizations: NEXO_PRESENTATION_ORGANIZATIONS,
  people: NEXO_PRESENTATION_PEOPLE,
  territories: NEXO_PRESENTATION_TERRITORIES,
  procedures: NEXO_PRESENTATION_PROCEDURES,
  records: NEXO_PRESENTATION_RECORDS,
  observations: NEXO_PRESENTATION_OBSERVATIONS,
  hierarchyEvents: NEXO_PRESENTATION_HIERARCHY_EVENTS,
};
