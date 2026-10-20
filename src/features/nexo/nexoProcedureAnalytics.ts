import type { BoRecord } from "@/features/bo/boTypes";
import type { InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import { isCvliRecord } from "@/lib/cvliMetrics";
import type { NexoOrganizacao, NexoPessoa, NexoRegistroVinculado } from "./nexoTypes";

export interface NexoProcedureContext {
  id: string;
  inquerito_id: string | null;
  bo_id: string | null;
  data_fato: string | null;
  hora_fato: string | null;
  bairro: string | null;
  latitude: number | null;
  longitude: number | null;
  fonte: string;
  updated_at: string;
}

export interface NexoProcedureRow {
  id: string;
  kind: "inquerito" | "bo";
  procedureId: string;
  incidentId: string;
  number: string;
  nature: string;
  status: string;
  neighborhood: string | null;
  factDate: string | null;
  factTime: string | null;
  sourceFactDate?: string | null;
  sourceNeighborhood?: string | null;
  latitude: number | null;
  longitude: number | null;
  factions: string[];
  cvli: boolean;
  linkedToNexo: boolean;
  context: NexoProcedureContext | null;
}

export interface NexoProcedureFilters {
  query: string;
  faction: string;
  kind: "todos" | "inquerito" | "bo";
  classification: "todos" | "cvli" | "outros";
  from: string;
  to: string;
}

export interface RankedValue {
  key: string;
  label: string;
  count: number;
}

export const EMPTY_PROCEDURE_FILTERS: NexoProcedureFilters = {
  query: "",
  faction: "",
  kind: "todos",
  classification: "todos",
  from: "",
  to: "",
};

export function normalizeProcedureText(value: string | null | undefined) {
  return (value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function meaningfulFactionName(value: string | null | undefined) {
  const normalized = normalizeProcedureText(value);
  return Boolean(
    normalized &&
    !["nao", "sim", "a definir", "nao informado", "nao informada", "nenhuma", "ignorado"].includes(
      normalized,
    ),
  );
}

function cvliFromBo(bo: BoRecord) {
  return isCvliRecord({
    categoria_criminal: null,
    gravidade: null,
    tipificacao: bo.infracao_penal,
  } as InqueritoRecord);
}

function validDate(value: string | null | undefined) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : null;
}

function validTime(value: string | null | undefined) {
  return value && /^([01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d+)?)?$/.test(value)
    ? value.slice(0, 5)
    : null;
}

export function validProcedureCoordinates(
  latitude: number | null | undefined,
  longitude: number | null | undefined,
) {
  if (
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  )
    return null;
  return { latitude, longitude };
}

export function buildNexoProcedureRows(input: {
  inquiries: InqueritoRecord[];
  reports: BoRecord[];
  links: NexoRegistroVinculado[];
  contexts: NexoProcedureContext[];
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
}): NexoProcedureRow[] {
  const { inquiries, reports, links, contexts, organizations, people } = input;
  const inquiryById = new Map(inquiries.map((item) => [item.id, item]));
  const contextByInquiry = new Map(
    contexts.filter((item) => item.inquerito_id).map((item) => [item.inquerito_id!, item]),
  );
  const contextByBo = new Map(
    contexts.filter((item) => item.bo_id).map((item) => [item.bo_id!, item]),
  );
  const linksByInquiry = new Map<string, NexoRegistroVinculado[]>();
  const linksByBo = new Map<string, NexoRegistroVinculado[]>();
  for (const link of links) {
    const bucket = link.inquerito_id ? linksByInquiry : linksByBo;
    const id = link.inquerito_id || link.bo_id;
    if (id) bucket.set(id, [...(bucket.get(id) || []), link]);
  }

  function linkFactions(procedureLinks: NexoRegistroVinculado[]) {
    const names = procedureLinks.flatMap((link) => {
      const direct = organizations.find((org) => org.id === link.organizacao_id);
      if (direct) return [direct.nome];
      const person = people.find((item) => item.id === link.pessoa_id);
      return (
        person?.vinculos
          .filter((vinculo) => vinculo.status !== "desvinculado")
          .flatMap((vinculo) => {
            const organization = organizations.find((org) => org.id === vinculo.organizacao_id);
            return organization ? [organization.nome] : [];
          }) || []
      );
    });
    return [...new Set(names)];
  }

  const inquiryRows = inquiries.flatMap((inquiry): NexoProcedureRow[] => {
    const procedureLinks = linksByInquiry.get(inquiry.id) || [];
    const namedFaction = meaningfulFactionName(inquiry.nome_faccao)
      ? inquiry.nome_faccao!.trim()
      : null;
    const factionFlag = normalizeProcedureText(inquiry.faccao);
    const markedFaction = factionFlag === "sim";
    const namedWithoutFlag = !factionFlag && Boolean(namedFaction);
    if (!markedFaction && !namedWithoutFlag && !procedureLinks.length) return [];
    const context = contextByInquiry.get(inquiry.id) || null;
    const coordinates = validProcedureCoordinates(context?.latitude, context?.longitude);
    const linkedNames = linkFactions(procedureLinks);
    return [
      {
        id: `inquerito:${inquiry.id}`,
        kind: "inquerito",
        procedureId: inquiry.id,
        incidentId: inquiry.id,
        number:
          inquiry.numero_ppe ||
          inquiry.numero_fisico ||
          inquiry.codigo_interno ||
          "Inquérito sem número",
        nature: inquiry.tipificacao || inquiry.categoria_criminal || "Natureza não informada",
        status: inquiry.situacao || "Situação não informada",
        neighborhood: context?.bairro?.trim() || inquiry.bairro?.trim() || null,
        factDate: validDate(context?.data_fato) || validDate(inquiry.data_fato),
        factTime: validTime(context?.hora_fato),
        sourceFactDate: validDate(inquiry.data_fato),
        sourceNeighborhood: inquiry.bairro?.trim() || null,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        factions: linkedNames.length
          ? linkedNames
          : namedFaction
            ? [namedFaction]
            : ["Facção não identificada"],
        cvli: isCvliRecord(inquiry),
        linkedToNexo: procedureLinks.length > 0,
        context,
      },
    ];
  });

  const includedInquiryIds = new Set(inquiryRows.map((item) => item.procedureId));
  const eligibleInquiryByBoNumber = new Map(
    inquiries
      .filter((inquiry) => includedInquiryIds.has(inquiry.id) && inquiry.numero_bo)
      .map((inquiry) => [normalizeProcedureText(inquiry.numero_bo), inquiry] as const),
  );
  const rows = reports.flatMap((bo): NexoProcedureRow[] => {
    const procedureLinks = linksByBo.get(bo.id) || [];
    const parent = bo.inquerito_id
      ? inquiryById.get(bo.inquerito_id)
      : eligibleInquiryByBoNumber.get(normalizeProcedureText(bo.numero_bo));
    const includedParent = parent && includedInquiryIds.has(parent.id);
    if (!procedureLinks.length && !includedParent) return [];
    const context = contextByBo.get(bo.id) || null;
    const linkedNames = linkFactions(procedureLinks);
    const parentRow = includedParent
      ? inquiryRows.find((item) => item.procedureId === parent.id)
      : null;
    const coordinates = validProcedureCoordinates(context?.latitude, context?.longitude);
    return [
      {
        id: `bo:${bo.id}`,
        kind: "bo",
        procedureId: bo.id,
        incidentId: includedParent ? parent!.id : `bo:${bo.id}`,
        number: bo.numero_bo || "B.O. sem número",
        nature: bo.infracao_penal || "Natureza não informada",
        status: bo.status || "Situação não informada",
        neighborhood:
          context?.bairro?.trim() || bo.local_bairro?.trim() || parentRow?.neighborhood || null,
        factDate: validDate(context?.data_fato) || parentRow?.factDate || null,
        factTime: validTime(context?.hora_fato) || parentRow?.factTime || null,
        sourceFactDate: parentRow?.sourceFactDate ?? null,
        sourceNeighborhood: bo.local_bairro?.trim() || parentRow?.sourceNeighborhood || null,
        latitude: coordinates?.latitude ?? null,
        longitude: coordinates?.longitude ?? null,
        factions: linkedNames.length
          ? linkedNames
          : parentRow?.factions || ["Facção não identificada"],
        cvli: parentRow?.cvli ?? cvliFromBo(bo),
        linkedToNexo: procedureLinks.length > 0,
        context,
      },
    ];
  });

  return [...inquiryRows, ...rows].sort(
    (a, b) =>
      (b.factDate || "").localeCompare(a.factDate || "") ||
      a.number.localeCompare(b.number, "pt-BR"),
  );
}

export function geocodedProcedureIncidents(rows: NexoProcedureRow[]) {
  const byIncident = new Map<string, NexoProcedureRow>();
  for (const row of rows) {
    if (!validProcedureCoordinates(row.latitude, row.longitude)) continue;
    const current = byIncident.get(row.incidentId);
    if (!current) byIncident.set(row.incidentId, row);
  }
  return [...byIncident.values()];
}

export function filterNexoProcedureRows(rows: NexoProcedureRow[], filters: NexoProcedureFilters) {
  const query = normalizeProcedureText(filters.query);
  return rows.filter((row) => {
    if (filters.kind !== "todos" && row.kind !== filters.kind) return false;
    if (filters.classification === "cvli" && !row.cvli) return false;
    if (filters.classification === "outros" && row.cvli) return false;
    if (
      filters.faction &&
      !row.factions.some(
        (name) => normalizeProcedureText(name) === normalizeProcedureText(filters.faction),
      )
    )
      return false;
    if (filters.from && (!row.factDate || row.factDate < filters.from)) return false;
    if (filters.to && (!row.factDate || row.factDate > filters.to)) return false;
    if (
      query &&
      !normalizeProcedureText(
        [row.number, row.nature, row.neighborhood, ...row.factions].join(" "),
      ).includes(query)
    )
      return false;
    return true;
  });
}

function rank(values: Array<string | null>, labels?: (value: string) => string): RankedValue[] {
  const counts = new Map<string, { label: string; count: number }>();
  for (const value of values) {
    if (!value) continue;
    const key = normalizeProcedureText(value);
    if (!key) continue;
    const current = counts.get(key);
    counts.set(key, {
      label: current?.label || (labels ? labels(value) : value.trim()),
      count: (current?.count || 0) + 1,
    });
  }
  return [...counts]
    .map(([key, item]) => ({ key, ...item }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label, "pt-BR"))
    .slice(0, 10);
}

export function summarizeNexoProcedures(rows: NexoProcedureRow[]) {
  const cvliByIncident = new Map<string, NexoProcedureRow>();
  for (const row of rows) {
    if (!row.cvli) continue;
    const current = cvliByIncident.get(row.incidentId);
    if (!current) cvliByIncident.set(row.incidentId, row);
    else
      cvliByIncident.set(row.incidentId, {
        ...current,
        neighborhood: current.neighborhood || row.neighborhood,
        factDate: current.factDate || row.factDate,
        factTime: current.factTime || row.factTime,
      });
  }
  const incidents = [...cvliByIncident.values()];
  return {
    total: rows.length,
    inquiries: rows.filter((row) => row.kind === "inquerito").length,
    reports: rows.filter((row) => row.kind === "bo").length,
    cvli: incidents.length,
    knownNeighborhoods: incidents.filter((row) => row.neighborhood).length,
    knownDates: incidents.filter((row) => row.factDate).length,
    knownTimes: incidents.filter((row) => row.factTime).length,
    neighborhoods: rank(incidents.map((row) => row.neighborhood)),
    dates: rank(
      incidents.map((row) => row.factDate),
      (value) => new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR"),
    ),
    hours: rank(
      incidents.map((row) => row.factTime?.slice(0, 2) || null),
      (value) => `${value}h–${value}h59`,
    ),
  };
}
