import type { NexoVinculo } from "./nexoTypes";

export function formatNexoLinkRoleLocation(link: NexoVinculo) {
  const role = link.funcao?.trim() || "Função não informada";
  const municipality = link.municipio_atuacao?.trim() || "";
  const state = link.uf_atuacao?.trim().toUpperCase() || "";
  const location = municipality && state ? `${municipality}/${state}` : municipality || state;
  return location ? `${role} · ${location}` : role;
}
