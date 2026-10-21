import {
  activeDirectoryLinks,
  directoryPersonLocation,
  hasDirectoryPhoto,
} from "./nexoDirectoryFilters";
import type {
  NexoOrganizacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoTerritorio,
} from "./nexoTypes";

export interface NexoSummaryLink {
  organization: string;
  status: string;
  confidence: number;
  source: string;
}

export interface NexoSummaryProcedure {
  type: "B.O." | "Inquérito";
  number: string;
  context: string;
}

export interface NexoSummaryTerritory {
  area: string;
  organization: string;
  classification: string;
  confidence: number;
}

export type NexoSummaryTimelineDateType = "registro" | "documento" | "vinculo";

export interface NexoSummaryTimelineEvent {
  id: string;
  date: string;
  dateType: NexoSummaryTimelineDateType;
  label: string;
  detail: string;
  source: string;
}

export interface NexoPersonIntelligenceSummary {
  subject: {
    id: string;
    name: string;
    alias: string;
    photoAvailable: boolean;
    location: string;
  };
  links: NexoSummaryLink[];
  procedures: NexoSummaryProcedure[];
  territories: NexoSummaryTerritory[];
  timeline: NexoSummaryTimelineEvent[];
  documents: string[];
  gaps: string[];
}

function value(input: string | null | undefined, fallback = "Não informado") {
  return input?.trim() || fallback;
}

function procedureKey(record: NexoRegistroVinculado) {
  return record.inquerito_id ? `inquerito:${record.inquerito_id}` : `bo:${record.bo_id}`;
}

function validDate(value: string | null | undefined) {
  return Boolean(value && !Number.isNaN(new Date(value).getTime()));
}

/** Builds a source-aware local summary. It does not infer, classify or call an external service. */
export function buildNexoPersonIntelligenceSummary(
  person: NexoPessoa,
  organizations: NexoOrganizacao[],
  territories: NexoTerritorio[],
  records: NexoRegistroVinculado[],
): NexoPersonIntelligenceSummary {
  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );
  const links = activeDirectoryLinks(person).map((link) => ({
    organization: organizationById.get(link.organizacao_id)?.nome || "Organização não identificada",
    status: link.status.replaceAll("_", " "),
    confidence: link.confianca,
    source: value(link.fonte_resumo, "Fonte não informada"),
  }));
  const linkedOrganizationIds = new Set(
    activeDirectoryLinks(person).map((link) => link.organizacao_id),
  );
  const procedures = new Map<string, NexoSummaryProcedure>();
  for (const record of records.filter((item) => item.pessoa_id === person.id)) {
    const key = procedureKey(record);
    if (procedures.has(key)) continue;
    const inquiry = record.inquerito;
    const bo = record.bo;
    procedures.set(key, {
      type: record.inquerito_id ? "Inquérito" : "B.O.",
      number: record.inquerito_id ? value(inquiry?.numero_ppe) : value(bo?.numero_bo),
      context: value(inquiry?.situacao || bo?.infracao_penal),
    });
  }
  const summaryTerritories = territories
    .filter((territory) => linkedOrganizationIds.has(territory.organizacao_id))
    .map((territory) => ({
      area: value(territory.bairro || territory.ponto_referencia),
      organization:
        organizationById.get(territory.organizacao_id)?.nome || "Organização não identificada",
      classification: territory.classificacao.replaceAll("_", " "),
      confidence: territory.confianca,
    }));
  const timeline: NexoSummaryTimelineEvent[] = [];
  if (validDate(person.created_at)) {
    timeline.push({
      id: `person:${person.id}:created`,
      date: person.created_at,
      dateType: "registro",
      label: "Pessoa cadastrada",
      detail: person.nome,
      source: "Registro cadastral",
    });
  }
  for (const link of activeDirectoryLinks(person)) {
    if (!validDate(link.desde)) continue;
    timeline.push({
      id: `link:${link.id}:since`,
      date: link.desde!,
      dateType: "vinculo",
      label: "Vínculo informado a partir de",
      detail: organizationById.get(link.organizacao_id)?.nome || "Organização não identificada",
      source: value(link.fonte_resumo, "Fonte não informada"),
    });
  }
  for (const territory of territories.filter((item) =>
    linkedOrganizationIds.has(item.organizacao_id),
  )) {
    if (!validDate(territory.created_at)) continue;
    const area = value(territory.bairro || territory.ponto_referencia);
    const organization =
      organizationById.get(territory.organizacao_id)?.nome || "Organização não identificada";
    timeline.push({
      id: `territory:${territory.id}:created`,
      date: territory.created_at,
      dateType: "registro",
      label: "Território relacionado registrado",
      detail: `${area} · ${organization}`,
      source: value(territory.fonte_resumo, "Fonte não informada"),
    });
  }
  for (const record of records.filter((item) => item.pessoa_id === person.id)) {
    if (!validDate(record.created_at)) continue;
    const procedure = record.inquerito_id
      ? `Inquérito · ${value(record.inquerito?.numero_ppe)}`
      : `B.O. · ${value(record.bo?.numero_bo)}`;
    timeline.push({
      id: `record:${record.id}:created`,
      date: record.created_at,
      dateType: "registro",
      label: "Procedimento associado registrado",
      detail: procedure,
      source: "Registro de vínculo do procedimento",
    });
  }
  for (const document of person.documentos_fontes || []) {
    if (!validDate(document.created_at)) continue;
    timeline.push({
      id: `document:${document.id}:created`,
      date: document.created_at,
      dateType: "documento",
      label: "Documento de origem anexado",
      detail: document.original_filename,
      source: `SHA-256 ${document.sha256}`,
    });
  }
  const gaps: string[] = [];
  if (!hasDirectoryPhoto(person)) gaps.push("Fotografia de perfil não disponível");
  if (!person.cpf?.trim() && !person.rg?.trim()) gaps.push("CPF e RG não informados");
  if (directoryPersonLocation(person, territories) === "missing")
    gaps.push("Localização própria ou vinculada não disponível");
  if (activeDirectoryLinks(person).some((link) => !link.fonte_resumo?.trim()))
    gaps.push("Há vínculo atual sem fonte resumida");
  if (activeDirectoryLinks(person).some((link) => link.status !== "confirmado"))
    gaps.push("Há vínculo atual ainda não confirmado");

  return {
    subject: {
      id: person.id,
      name: person.nome,
      alias: value(person.apelido),
      photoAvailable: hasDirectoryPhoto(person),
      location: person.endereco
        ? `${value(person.endereco.logradouro)}, ${value(person.endereco.numero)} — ${value(person.endereco.municipio)}/${value(person.endereco.uf)}`
        : person.usar_local_faccao
          ? "Referência territorial da organização vinculada"
          : "Não informado",
    },
    links,
    procedures: [...procedures.values()],
    territories: summaryTerritories,
    timeline: timeline.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    documents: (person.documentos_fontes || []).map(
      (document) =>
        `${document.original_filename} · SHA-256 ${document.sha256} · ${document.page_count ?? "páginas não informadas"}`,
    ),
    gaps,
  };
}
