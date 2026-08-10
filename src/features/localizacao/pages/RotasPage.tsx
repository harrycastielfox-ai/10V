import { Clock3, MapPin, Navigation, Route as RouteIcon, Search, Trash2, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { deleteRotaSalva, listRotasSalvas } from "@/lib/repositories/localizacaoRepository";
import type { RotaSalvaRecord } from "../localizacaoTypes";

function formatDistance(value: number | null) {
  if (value === null) return "Não informada";
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value} m`;
}

function formatDuration(value: number | null) {
  if (value === null) return "Não informada";
  return `${Math.round(value / 60)} min`;
}

export default function RotasPage() {
  const [routes, setRoutes] = useState<RotaSalvaRecord[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [routeToDelete, setRouteToDelete] = useState<RotaSalvaRecord | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let cancelled = false;
    void listRotasSalvas()
      .then((records) => {
        if (!cancelled) setRoutes(records);
      })
      .catch((cause) => {
        console.error("[RotasPage] Falha ao carregar rotas salvas", cause);
        if (!cancelled) setError("Não foi possível carregar as rotas salvas.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("pt-BR");
    return routes.filter((route) => !term || route.nome.toLocaleLowerCase("pt-BR").includes(term));
  }, [routes, search]);

  async function confirmDeleteRoute() {
    if (!routeToDelete || deletingId) return;
    setDeletingId(routeToDelete.id);
    setError("");
    setDeleteError("");
    try {
      await deleteRotaSalva(routeToDelete.id);
      setRoutes((current) => current.filter((route) => route.id !== routeToDelete.id));
      setRouteToDelete(null);
    } catch (cause) {
      console.error("[RotasPage] Falha ao excluir rota salva", cause);
      setDeleteError(
        cause instanceof Error ? cause.message : "Não foi possível excluir a rota salva.",
      );
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div>
      {error ? (
        <p className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <header className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-operational">
            Cadastros operacionais
          </p>
          <h1 className="mt-1 text-2xl font-black sm:text-3xl">Rotas salvas</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Trajetos frequentes e pontos de passagem para apoio às equipes.
          </p>
        </div>
        <span className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-operational/30 bg-operational/10 px-4 py-2.5 text-xs font-bold text-operational">
          <Navigation className="h-4 w-4" /> Origem: Delegacia de Itabela
        </span>
      </header>

      <section className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="border-b border-border p-4">
          <label className="flex min-h-11 max-w-xl items-center gap-2 rounded-lg border border-border bg-background px-3 focus-within:border-operational/50">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar rota pelo nome"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>
        {loading ? (
          <div className="py-24 text-center text-sm text-muted-foreground">Carregando rotas...</div>
        ) : filtered.length ? (
          <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-3">
            {filtered.map((route) => (
              <article key={route.id} className="rounded-xl border border-border bg-background p-4">
                <div className="flex items-start gap-3">
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-operational/30 bg-operational/10 text-operational">
                    <RouteIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-sm font-black">{route.nome}</h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {route.paradas.length} ponto(s) intermediário(s)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDeleteError("");
                      setRouteToDelete(route);
                    }}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive transition hover:border-destructive/55 hover:bg-destructive/15"
                    title="Excluir rota salva"
                    aria-label={`Excluir rota ${route.nome}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-2">
                  <span className="rounded-lg border border-border p-2 text-xs text-muted-foreground">
                    <MapPin className="mb-1 h-4 w-4 text-operational" />
                    {formatDistance(route.distancia_metros)}
                  </span>
                  <span className="rounded-lg border border-border p-2 text-xs text-muted-foreground">
                    <Clock3 className="mb-1 h-4 w-4 text-operational" />
                    {formatDuration(route.duracao_segundos)}
                  </span>
                </div>
                {route.google_maps_url || route.waze_url ? (
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {route.google_maps_url ? (
                      <a
                        href={route.google_maps_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-operational px-3 text-xs font-bold text-[var(--operational-contrast)] transition hover:-translate-y-0.5"
                      >
                        <Navigation className="h-4 w-4" /> Google Maps
                      </a>
                    ) : null}
                    {route.waze_url ? (
                      <a
                        href={route.waze_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-info/35 bg-info/10 px-3 text-xs font-bold text-info transition hover:-translate-y-0.5"
                      >
                        <RouteIcon className="h-4 w-4" /> Waze
                      </a>
                    ) : null}
                  </div>
                ) : null}
              </article>
            ))}
          </div>
        ) : (
          <div className="flex min-h-64 flex-col items-center justify-center p-6 text-center">
            <RouteIcon className="h-9 w-9 text-muted-foreground" />
            <h2 className="mt-3 text-sm font-black">Nenhuma rota salva</h2>
            <p className="mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">
              Marque “salvar rota” ao cadastrar uma pessoa ou endereço vinculado.
            </p>
          </div>
        )}
      </section>

      {routeToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl border border-destructive/30 bg-card p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-destructive">
                  Excluir rota
                </p>
                <h2 className="mt-1 text-xl font-black">Remover rota salva?</h2>
              </div>
              <button
                type="button"
                onClick={() => setRouteToDelete(null)}
                className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition hover:text-foreground"
                aria-label="Cancelar exclusão"
                disabled={deletingId !== null}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              A rota <strong className="text-foreground">{routeToDelete.nome}</strong> será removida
              da lista de trajetos salvos. Endereços e pessoas vinculadas permanecem cadastrados.
            </p>
            {deleteError ? (
              <div className="mt-4 rounded-xl border border-destructive/35 bg-destructive/10 p-3 text-xs font-semibold leading-relaxed text-destructive">
                {deleteError}
              </div>
            ) : null}
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setRouteToDelete(null)}
                className="min-h-11 rounded-lg border border-border px-4 text-sm font-bold text-muted-foreground transition hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
                disabled={deletingId !== null}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmDeleteRoute}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-destructive/45 bg-destructive/15 px-4 text-sm font-black text-destructive transition hover:bg-destructive/20 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={deletingId !== null}
              >
                <Trash2 className="h-4 w-4" />
                {deletingId ? "Excluindo..." : "Excluir rota"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
