import { selectNexoPeople, selectNexoRecords } from "./nexoSelectors";
import type {
  NexoObservacao,
  NexoOrganizacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoReportScope,
  NexoTerritorio,
} from "./nexoTypes";

export const NEXO_REPORT_SECTIONS = [
  {
    key: "identification",
    label: "Identificação",
    detail: "Dados pessoais, documentos e contatos",
  },
  { key: "links", label: "Vínculos", detail: "Organizações, funções, status e fontes" },
  { key: "procedures", label: "B.O.s e inquéritos", detail: "Procedimentos associados ao recorte" },
  {
    key: "locations",
    label: "Endereços e territórios",
    detail: "Localização e referências cadastradas",
  },
  { key: "observations", label: "Observações", detail: "Sínteses e anotações datadas do dossiê" },
  {
    key: "photographs",
    label: "Fotografias",
    detail: "Escolha imagens e escreva legendas para esta emissão",
  },
] as const;

export type NexoReportSection = (typeof NEXO_REPORT_SECTIONS)[number]["key"];

export interface NexoReportConfig {
  sections: Record<NexoReportSection, boolean>;
  excludedPhotoPersonIds: string[];
  photoOverrides: Record<string, { included?: boolean; caption?: string }>;
  excludedObservationKeys: string[];
}

export interface NexoReportData {
  organizacoes: NexoOrganizacao[];
  pessoas: NexoPessoa[];
  territorios?: NexoTerritorio[];
  registros?: NexoRegistroVinculado[];
  observacoes?: NexoObservacao[];
}

export interface NexoReportPhoto {
  key: string;
  personId: string;
  url: string;
  caption: string;
  kind: "principal" | "album";
}

export function createNexoReportConfig(): NexoReportConfig {
  return {
    sections: {
      identification: true,
      links: true,
      procedures: true,
      locations: true,
      observations: true,
      photographs: true,
    },
    excludedPhotoPersonIds: [],
    photoOverrides: {},
    excludedObservationKeys: [],
  };
}

/** Runtime defaults also tolerate missing new options in older in-memory drafts. */
export function normalizeNexoReportConfig(config?: NexoReportConfig): NexoReportConfig {
  const defaults = createNexoReportConfig();
  if (!config || typeof config !== "object") return defaults;
  for (const { key } of NEXO_REPORT_SECTIONS) {
    if (typeof config.sections?.[key] === "boolean") defaults.sections[key] = config.sections[key];
  }
  defaults.excludedPhotoPersonIds = Array.isArray(config.excludedPhotoPersonIds)
    ? config.excludedPhotoPersonIds.filter((id): id is string => typeof id === "string")
    : [];
  defaults.excludedObservationKeys = Array.isArray(config.excludedObservationKeys)
    ? config.excludedObservationKeys.filter((key): key is string => typeof key === "string")
    : [];
  if (config.photoOverrides && typeof config.photoOverrides === "object") {
    for (const [key, override] of Object.entries(config.photoOverrides)) {
      if (!override || typeof override !== "object") continue;
      defaults.photoOverrides[key] = {
        ...(typeof override.included === "boolean" ? { included: override.included } : {}),
        ...(typeof override.caption === "string"
          ? { caption: override.caption.slice(0, 4_000) }
          : {}),
      };
    }
  }
  return defaults;
}

export function listNexoReportPhotos(person: NexoPessoa): NexoReportPhoto[] {
  const photos: NexoReportPhoto[] = [];
  const seen = new Set<string>();
  const seenPaths = new Set<string>();
  const principal = person.foto_relatorio_url || person.foto_perfil_url;
  if (principal) {
    const principalPath = person.foto_relatorio_url
      ? person.foto_relatorio_path
      : person.foto_perfil_path;
    const principalPhoto = person.fotos.find(
      (photo) => (principalPath && photo.storage_path === principalPath) || photo.url === principal,
    );
    seen.add(principal);
    if (principalPath) seenPaths.add(principalPath);
    if (principalPhoto?.storage_path) seenPaths.add(principalPhoto.storage_path);
    photos.push({
      key: `${person.id}:principal`,
      personId: person.id,
      url: principal,
      caption: principalPhoto?.legenda || "Fotografia de referência",
      kind: "principal",
    });
  }
  for (const photo of person.fotos) {
    if (!photo.url || seen.has(photo.url) || seenPaths.has(photo.storage_path)) continue;
    seen.add(photo.url);
    if (photo.storage_path) seenPaths.add(photo.storage_path);
    photos.push({
      key: `${person.id}:foto:${photo.id}`,
      personId: person.id,
      url: photo.url,
      caption: photo.legenda || "",
      kind: "album",
    });
  }
  if (
    person.foto_perfil_url &&
    !seen.has(person.foto_perfil_url) &&
    !(person.foto_perfil_path && seenPaths.has(person.foto_perfil_path))
  ) {
    photos.push({
      key: `${person.id}:perfil`,
      personId: person.id,
      url: person.foto_perfil_url,
      caption: "Fotografia de perfil",
      kind: "album",
    });
  }
  return photos;
}

/** One procedure may have separate links to several people and organizations. */
export function groupNexoReportProcedures(records: NexoRegistroVinculado[]) {
  const grouped = new Map<
    string,
    { key: string; record: NexoRegistroVinculado; links: NexoRegistroVinculado[] }
  >();
  for (const record of records) {
    const key = record.inquerito_id
      ? `ip:${record.inquerito_id}`
      : record.bo_id
        ? `bo:${record.bo_id}`
        : `link:${record.id}`;
    const existing = grouped.get(key);
    if (existing) existing.links.push(record);
    else grouped.set(key, { key, record, links: [record] });
  }
  return [...grouped.values()];
}

export function selectedNexoReportPhotos(person: NexoPessoa, config?: NexoReportConfig) {
  const options = normalizeNexoReportConfig(config);
  if (!options.sections.photographs || options.excludedPhotoPersonIds.includes(person.id))
    return [];
  return listNexoReportPhotos(person)
    .filter((photo) => options.photoOverrides[photo.key]?.included !== false)
    .map((photo) => ({
      ...photo,
      caption: options.photoOverrides[photo.key]?.caption ?? photo.caption,
    }));
}

export function selectNexoReportData(scope: NexoReportScope, data: NexoReportData) {
  const people = selectNexoPeople(scope, data.pessoas);
  const personIds = new Set(people.map((person) => person.id));
  const organizations =
    scope.kind === "geral"
      ? data.organizacoes
      : scope.kind === "organizacao"
        ? data.organizacoes.filter((org) => org.id === scope.organizacaoId)
        : [];
  const territories =
    scope.kind === "geral"
      ? data.territorios || []
      : scope.kind === "organizacao"
        ? (data.territorios || []).filter(
            (territory) => territory.organizacao_id === scope.organizacaoId,
          )
        : [];
  const observations = (data.observacoes || [])
    .filter(
      (observation) =>
        observation.conteudo.trim() &&
        (scope.kind === "geral"
          ? true
          : scope.kind === "pessoa"
            ? observation.pessoa_id === scope.pessoaId
            : observation.organizacao_id === scope.organizacaoId ||
              (observation.pessoa_id !== null && personIds.has(observation.pessoa_id))),
    )
    .sort((a, b) => {
      const first = Date.parse(a.created_at);
      const second = Date.parse(b.created_at);
      return (Number.isFinite(first) ? first : 0) - (Number.isFinite(second) ? second : 0);
    });
  return {
    people,
    organizations,
    territories,
    records: selectNexoRecords(scope, data.pessoas, data.registros || []),
    observations,
  };
}

export function listNexoReportObservations(scope: NexoReportScope, data: NexoReportData) {
  const selected = selectNexoReportData(scope, data);
  return [
    ...selected.organizations
      .filter((org) => org.descricao?.trim())
      .map((org) => ({
        key: `organization:${org.id}`,
        title: `Descrição de ${org.nome}`,
        content: org.descricao!,
      })),
    ...selected.people
      .filter((person) => person.observacoes?.trim())
      .map((person) => ({
        key: `person:${person.id}`,
        title: `Observação de ${person.nome}`,
        content: person.observacoes!,
      })),
    ...selected.observations.map((note) => ({
      key: `note:${note.id}`,
      title: note.pessoa_id
        ? `Anotação de ${selected.people.find((person) => person.id === note.pessoa_id)?.nome || "pessoa"}`
        : `Anotação de ${selected.organizations.find((org) => org.id === note.organizacao_id)?.nome || "organização"}`,
      content: note.conteudo,
    })),
  ];
}

export function summarizeNexoReport(
  scope: NexoReportScope,
  data: NexoReportData,
  config?: NexoReportConfig,
) {
  const options = normalizeNexoReportConfig(config);
  const selected = selectNexoReportData(scope, data);
  return {
    people: selected.people.length,
    organizations: selected.organizations.length,
    sections: NEXO_REPORT_SECTIONS.filter(({ key }) => options.sections[key]).length,
    links: options.sections.links
      ? selected.people
          .flatMap((person) => person.vinculos)
          .filter((link) =>
            scope.kind === "organizacao" ? link.organizacao_id === scope.organizacaoId : true,
          ).length
      : 0,
    procedures: options.sections.procedures
      ? groupNexoReportProcedures(selected.records).length
      : 0,
    territories: options.sections.locations ? selected.territories.length : 0,
    addresses: options.sections.locations
      ? selected.people.filter((person) => person.endereco).length
      : 0,
    observations: options.sections.observations
      ? listNexoReportObservations(scope, data).filter(
          (entry) => !options.excludedObservationKeys.includes(entry.key),
        ).length
      : 0,
    photos: selected.people.reduce(
      (count, person) => count + selectedNexoReportPhotos(person, options).length,
      0,
    ),
  };
}
