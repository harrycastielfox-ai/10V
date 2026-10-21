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
  documents: string[];
  gaps: string[];
}

function value(input: string | null | undefined, fallback = "Não informado") {
  return input?.trim() || fallback;
}

function procedureKey(record: NexoRegistroVinculado) {
  return record.inquerito_id ? `inquerito:${record.inquerito_id}` : `bo:${record.bo_id}`;
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
    documents: (person.documentos_fontes || []).map(
      (document) =>
        `${document.original_filename} · SHA-256 ${document.sha256} · ${document.page_count ?? "páginas não informadas"}`,
    ),
    gaps,
  };
}
