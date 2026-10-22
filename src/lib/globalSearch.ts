import { canViewBos, canViewRepresentacoes, canViewVehicles } from "@/lib/authz";
import type { UserProfile } from "@/lib/authz";
import { searchBos } from "@/lib/repositories/boRepository";
import { searchInqueritosForLink } from "@/lib/repositories/inqueritosRepository";
import { searchRepresentacoesForLink } from "@/lib/repositories/representacoesRepository";
import { listVehiclesPage } from "@/lib/repositories/vehiclesRepository";

export type GlobalSearchGroup = "procedimentos" | "boletins" | "veiculos" | "representacoes";

export type GlobalSearchHit = {
  key: string;
  group: GlobalSearchGroup;
  title: string;
  subtitle: string;
  to: string;
  params: Record<string, string>;
};

export const GLOBAL_SEARCH_GROUP_LABELS: Record<GlobalSearchGroup, string> = {
  procedimentos: "Procedimentos",
  boletins: "Boletins de ocorrência",
  veiculos: "Veículos",
  representacoes: "Representações",
};

// A ordem dos grupos no resultado. Procedimento e B.O. primeiro porque são o
// que mais se procura no atendimento.
export const GLOBAL_SEARCH_GROUP_ORDER: GlobalSearchGroup[] = [
  "procedimentos",
  "boletins",
  "veiculos",
  "representacoes",
];

export const GLOBAL_SEARCH_MIN_LENGTH = 2;

function detalhe(...partes: Array<string | null | undefined>) {
  return partes
    .map((parte) => parte?.trim())
    .filter(Boolean)
    .join(" · ");
}

/**
 * Busca o mesmo termo em todos os módulos que o usuário pode ver.
 *
 * Cada módulo responde por si: um erro ou uma permissão negada no Supabase
 * derruba só aquele grupo, e o resto do resultado continua aparecendo. O sigilo
 * dos procedimentos continua com as policies do banco — nada é filtrado aqui.
 */
export async function searchEverywhere(
  query: string,
  profile: UserProfile | null,
  limitPorGrupo = 4,
): Promise<GlobalSearchHit[]> {
  const termo = query.trim();
  if (termo.length < GLOBAL_SEARCH_MIN_LENGTH) return [];

  const buscas: Array<Promise<GlobalSearchHit[]>> = [
    searchInqueritosForLink(termo, limitPorGrupo).then((itens) =>
      itens.map((item) => ({
        key: `procedimento-${item.id}`,
        group: "procedimentos" as const,
        title: item.numero_ppe?.trim() || "Sem número PPE",
        subtitle: detalhe(item.tipo_procedimento_normalizado || item.tipo, item.situacao),
        to: "/inqueritos/$caseId",
        params: { caseId: item.id },
      })),
    ),
  ];

  if (canViewBos(profile)) {
    buscas.push(
      searchBos(termo, limitPorGrupo).then((itens) =>
        itens.map((item) => ({
          key: `bo-${item.id}`,
          group: "boletins" as const,
          title: item.numero_bo,
          subtitle: detalhe(item.infracao_penal, item.responsavel_nome),
          to: "/bo/$boId",
          params: { boId: item.id },
        })),
      ),
    );
  }

  if (canViewVehicles(profile)) {
    buscas.push(
      listVehiclesPage({ search: termo, limit: limitPorGrupo }).then((itens) =>
        itens.map((item) => ({
          key: `veiculo-${item.id}`,
          group: "veiculos" as const,
          title: item.plate?.trim() || item.internal_id || "Sem placa",
          subtitle: detalhe(item.brand_model, item.color, item.situation),
          to: "/veiculos/$vehicleId",
          params: { vehicleId: item.id },
        })),
      ),
    );
  }

  if (canViewRepresentacoes(profile)) {
    buscas.push(
      searchRepresentacoesForLink(termo, limitPorGrupo).then((itens) =>
        itens.map((item) => ({
          key: `representacao-${item.id}`,
          group: "representacoes" as const,
          title: item.processo_judicial?.trim() || item.numero_ppe?.trim() || "Sem número",
          subtitle: detalhe(item.tipo, item.status),
          to: "/representacoes/$representacaoId",
          params: { representacaoId: item.id },
        })),
      ),
    );
  }

  const respostas = await Promise.allSettled(buscas);
  const encontrados = respostas.flatMap((resposta) =>
    resposta.status === "fulfilled" ? resposta.value : [],
  );

  return GLOBAL_SEARCH_GROUP_ORDER.flatMap((grupo) =>
    encontrados.filter((item) => item.group === grupo),
  );
}
