import type { Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { ExternalLink, LoaderCircle, MapPin, Navigation, RefreshCw, Route } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { NexoPessoa } from "../nexoTypes";
import { routeCoordinates, safeNexoNavigationUrl } from "../nexoRouteEligibility";
import { buildMapDirectionsUrl, DEFAULT_ROUTE_ORIGIN } from "@/lib/mapLinks";
import { fetchDrivingRoute } from "@/lib/roadRouting";

function formatDistance(value: number) {
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${Math.round(value)} m`;
}

function formatDuration(value: number) {
  const minutes = Math.max(1, Math.round(value / 60));
  return minutes >= 60 ? `${Math.floor(minutes / 60)}h ${minutes % 60}min` : `${minutes} min`;
}

type RouteState = {
  key: string;
  status: "loading" | "ready" | "unavailable" | "error" | "map_error";
  summary: { distance: number; duration: number } | null;
};

export function NexoRouteMap({ pessoa }: { pessoa: NexoPessoa | null }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const [retry, setRetry] = useState(0);
  const [routeState, setRouteState] = useState<RouteState | null>(null);
  const [tilesUnavailable, setTilesUnavailable] = useState(false);
  const destination = useMemo(() => routeCoordinates(pessoa), [pessoa]);
  const routeKey = destination ? `${destination.latitude}:${destination.longitude}:${retry}` : "";
  const state = routeState?.key === routeKey ? routeState : null;

  useEffect(() => {
    if (!containerRef.current || !destination) return;
    let cancelled = false;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 15000);
    const key = `${destination.latitude}:${destination.longitude}:${retry}`;
    setRouteState({ key, status: "loading", summary: null });
    setTilesUnavailable(false);
    void (async () => {
      try {
        const L = await import("leaflet");
        if (cancelled || !containerRef.current) return;
        mapRef.current?.remove();
        const map = L.map(containerRef.current, {
          zoomControl: true,
          attributionControl: true,
          scrollWheelZoom: false,
        });
        mapRef.current = map;
        let tileErrors = 0;
        let loadedTiles = 0;
        L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
          attribution:
            'Dados © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Renderização © <a href="https://www.openstreetmap.fr/">OSM France</a>',
          subdomains: "abc",
          maxZoom: 20,
        })
          .on("tileerror", () => {
            tileErrors += 1;
            if (!cancelled && !loadedTiles && tileErrors >= 3) setTilesUnavailable(true);
          })
          .on("tileload", () => {
            loadedTiles += 1;
            if (!cancelled) setTilesUnavailable(false);
          })
          .addTo(map);
        const origin: [number, number] = [
          DEFAULT_ROUTE_ORIGIN.latitude!,
          DEFAULT_ROUTE_ORIGIN.longitude!,
        ];
        const target: [number, number] = [destination.latitude, destination.longitude];
        L.circleMarker(origin, {
          radius: 8,
          color: "#67e8f9",
          fillColor: "#0891b2",
          fillOpacity: 1,
          weight: 3,
        })
          .bindTooltip("Delegacia Territorial de Itabela")
          .addTo(map);
        const tooltip = document.createElement("span");
        tooltip.textContent = pessoa?.apelido || pessoa?.nome || "Destino";
        L.circleMarker(target, {
          radius: 9,
          color: "#fecaca",
          fillColor: "#ef4444",
          fillOpacity: 1,
          weight: 3,
        })
          .bindTooltip(tooltip)
          .addTo(map);
        map.fitBounds([origin, target], { padding: [40, 40], maxZoom: 16 });
        requestAnimationFrame(() => {
          if (!cancelled) map.invalidateSize();
        });
        try {
          const route = await fetchDrivingRoute(
            { latitude: origin[0], longitude: origin[1] },
            destination,
            controller.signal,
          );
          if (cancelled) return;
          if (!route) {
            setRouteState({ key, status: "unavailable", summary: null });
            return;
          }
          const line = L.polyline(
            route.points.map((point) => [point.latitude, point.longitude] as [number, number]),
            { color: "#189bb4", weight: 5, opacity: 0.9 },
          ).addTo(map);
          map.fitBounds(line.getBounds(), { padding: [40, 40], maxZoom: 17 });
          setRouteState({
            key,
            status: "ready",
            summary: { distance: route.distanceMeters, duration: route.durationSeconds },
          });
        } catch {
          if (!cancelled) setRouteState({ key, status: "error", summary: null });
        }
      } catch {
        if (!cancelled) setRouteState({ key, status: "map_error", summary: null });
      }
    })();
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
      controller.abort();
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [destination, pessoa?.apelido, pessoa?.nome, retry]);

  if (!pessoa || !destination) {
    const externalNavigationUrl =
      pessoa && !pessoa.usar_local_faccao && !pessoa.em_situacao_rua
        ? safeNexoNavigationUrl(pessoa.endereco?.link_navegacao)
        : null;
    return (
      <div className="flex min-h-[470px] items-center justify-center rounded-[24px] border border-dashed border-[#cbdfe8] bg-[#f3f8fa] p-6 text-center">
        <div>
          <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-[#e4f1f5] text-[#5997ab]">
            <MapPin className="h-7 w-7" />
          </span>
          <p className="mt-4 text-sm font-black text-[#3a6179]">
            {!pessoa
              ? "Escolha um destino com ponto válido"
              : externalNavigationUrl
                ? "Navegação disponível pelo link cadastrado"
                : "Este cadastro ainda não tem um ponto válido"}
          </p>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#8aa2b1]">
            {!pessoa
              ? "Use a lista de pessoas para consultar o trajeto viário e conferir o endereço no dossiê."
              : pessoa.usar_local_faccao
                ? "A pessoa utiliza a referência da facção. Confira o local no dossiê antes de definir um destino individual."
                : "Registre coordenadas válidas no dossiê da pessoa para habilitar o mapa de rota."}
          </p>
          {externalNavigationUrl ? (
            <a
              href={externalNavigationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#173f58] px-4 py-2.5 text-xs font-bold text-white"
            >
              Abrir navegação <ExternalLink className="h-4 w-4" />
            </a>
          ) : null}
        </div>
      </div>
    );
  }

  const mapsUrl = buildMapDirectionsUrl(
    {
      ...destination,
      endereco: pessoa.endereco?.logradouro,
      cidade: [pessoa.endereco?.municipio, pessoa.endereco?.uf].filter(Boolean).join(", "),
    },
    { origin: DEFAULT_ROUTE_ORIGIN },
  );
  const loading = !state || state.status === "loading";
  const failed =
    tilesUnavailable || (state && ["unavailable", "error", "map_error"].includes(state.status));
  return (
    <div className="relative isolate overflow-hidden rounded-[24px] border border-[#d1e2e9] bg-[#eaf2f5]">
      <div
        ref={containerRef}
        role="region"
        aria-label={`Mapa de rota até ${pessoa.nome}`}
        className="h-[510px] w-full"
      />
      <div className="absolute right-3 top-3 z-[500] max-w-[min(290px,calc(100%-64px))] rounded-2xl border border-white/80 bg-white/95 p-4 shadow-xl backdrop-blur">
        <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-[#377d94]">
          <Route className="h-4 w-4" /> Rota viária
        </div>
        <p className="mt-1.5 text-[11px] leading-relaxed text-[#6f8e9f]">
          Delegacia Territorial de Itabela → {pessoa.apelido || pessoa.nome}
        </p>
        <div role="status" aria-live="polite">
          {state?.status === "ready" && state.summary ? (
            <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-[#2b657d]">
              <span className="rounded-lg bg-[#e8f5f8] px-2 py-1.5">
                {state.summary.distance > 0
                  ? formatDistance(state.summary.distance)
                  : "Distância não informada"}
              </span>
              <span className="rounded-lg bg-[#e8f5f8] px-2 py-1.5">
                {state.summary.duration > 0
                  ? `≈ ${formatDuration(state.summary.duration)}`
                  : "Duração não informada"}
              </span>
            </div>
          ) : loading ? (
            <p className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#3b96ad]">
              <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
              Consultando o trajeto…
            </p>
          ) : (
            <p className="mt-3 text-[11px] leading-relaxed text-[#a58149]">
              {state?.status === "unavailable"
                ? "O serviço não encontrou um trajeto viário para estes pontos."
                : state?.status === "map_error"
                  ? "Não foi possível carregar o mapa."
                  : "O serviço de rotas não respondeu. Os pontos permanecem no mapa."}
            </p>
          )}
        </div>
        {tilesUnavailable ? (
          <p className="mt-3 text-[11px] leading-relaxed text-[#a58149]">
            A base cartográfica não carregou. O trajeto retornado pelo serviço pode aparecer sem as
            ruas de fundo.
          </p>
        ) : null}
        {failed ? (
          <button
            type="button"
            onClick={() => setRetry((value) => value + 1)}
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg border border-[#d8e5eb] px-2.5 py-1.5 text-[11px] font-bold text-[#56899e] hover:bg-[#eef7fa]"
          >
            <RefreshCw className="h-3 w-3" />
            Tentar novamente
          </button>
        ) : null}
      </div>
      {mapsUrl ? (
        <a
          href={mapsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute bottom-7 right-3 z-[500] inline-flex items-center gap-2 rounded-xl border border-[#b7d6e1] bg-white/95 px-3 py-2.5 text-[11px] font-bold text-[#2b7f96] shadow-xl hover:bg-[#eef8fa]"
        >
          <Navigation className="h-3.5 w-3.5" />
          Abrir navegação
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : null}
    </div>
  );
}
