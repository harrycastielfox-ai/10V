import { NEXO_PRESENTATION_DATA, nexoPresentationId } from "./nexoPresentationData";
import type { NexoProcedureRow } from "./nexoProcedureAnalytics";
import type { NexoOrganizacao, NexoPessoa, NexoRegistroVinculado } from "./nexoTypes";

/** Presentation-only adapter. Leaves the original analytics fixtures untouched. */
export function createNexoPresentationProcedureRows(
  organizations: NexoOrganizacao[] = NEXO_PRESENTATION_DATA.organizations,
  people: NexoPessoa[] = NEXO_PRESENTATION_DATA.people,
  records: NexoRegistroVinculado[] = NEXO_PRESENTATION_DATA.records,
): NexoProcedureRow[] {
  return NEXO_PRESENTATION_DATA.procedures.map((procedure, index) => {
    const procedureLinks = records.filter((record) =>
      procedure.type === "bo"
        ? record.bo_id === procedure.id
        : record.inquerito_id === procedure.id,
    );
    const factionIds = new Set(
      procedureLinks.flatMap((record) =>
        record.organizacao_id
          ? [record.organizacao_id]
          : (people
              .find((person) => person.id === record.pessoa_id)
              ?.vinculos.filter((link) => link.status !== "desvinculado")
              .map((link) => link.organizacao_id) ?? []),
      ),
    );
    return {
      id: `${procedure.type}:${procedure.id}`,
      kind: procedure.type,
      procedureId: procedure.id,
      incidentId: procedure.incidentKey,
      number: procedure.number,
      nature: procedure.nature,
      status: procedure.status,
      neighborhood: procedure.neighborhood,
      factDate: procedure.date,
      factTime: procedure.time,
      sourceFactDate: procedure.date,
      sourceNeighborhood: procedure.neighborhood,
      latitude: procedure.latitude,
      longitude: procedure.longitude,
      factions: organizations
        .filter((organization) => factionIds.has(organization.id))
        .map((organization) => organization.nome),
      cvli: procedure.cvli,
      linkedToNexo: procedureLinks.length > 0,
      context: {
        id: nexoPresentationId(23, index + 1),
        inquerito_id: procedure.type === "inquerito" ? procedure.id : null,
        bo_id: procedure.type === "bo" ? procedure.id : null,
        data_fato: procedure.date,
        hora_fato: procedure.time,
        bairro: procedure.neighborhood,
        latitude: procedure.latitude,
        longitude: procedure.longitude,
        fonte: "Contexto inteiramente fictício da apresentação. Sem ocorrência real nesses pontos.",
        updated_at: NEXO_PRESENTATION_DATA.createdAt,
      },
    };
  });
}
