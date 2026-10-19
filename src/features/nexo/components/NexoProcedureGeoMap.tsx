import type { LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { Focus, Layers3 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_ROUTE_ORIGIN } from "@/lib/mapLinks";
import { groupProcedureMapPoints } from "../nexoProcedureMapGroups";

export interface ProcedureMapPoint {
  id: string;
  number: string;
  latitude: number;
  longitude: number;
  cvli: boolean;
}

export interface ProcedureMapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export function NexoProcedureGeoMap({
  points,
  selectedId = null,
  onSelect,
  onSelectGroup,
  onBoundsChange,
  focusId = null,
  focusRequest = 0,
  requestedView = null,
  onPick,
  compact = false,
}: {
  points: ProcedureMapPoint[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  onSelectGroup?: (ids: string[]) => void;
  onBoundsChange?: (bounds: ProcedureMapBounds) => void;
  focusId?: string | null;
  focusRequest?: number;
  requestedView?: { bounds: ProcedureMapBounds; request: number } | null;
  onPick?: (latitude: number, longitude: number) => void;
  compact?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markersRef = useRef<LayerGroup | null>(null);
  const onSelectRef = useRef(onSelect);
  const onSelectGroupRef = useRef(onSelectGroup);
  const onBoundsChangeRef = useRef(onBoundsChange);
  const onPickRef = useRef(onPick);
  const fittedPointsRef = useRef("");
  const focusedPointRef = useRef("");
  const restoredViewRef = useRef("");
  const [ready, setReady] = useState(false);
  const [zoom, setZoom] = useState(13);
  const groups = useMemo(() => groupProcedureMapPoints(points, zoom), [points, zoom]);
  const selectedGroup = groups.find((group) =>
    group.points.some((point) => point.id === selectedId),
  );

  onSelectRef.current = onSelect;
  onSelectGroupRef.current = onSelectGroup;
  onBoundsChangeRef.current = onBoundsChange;
  onPickRef.current = onPick;

  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;
      const map = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
        scrollWheelZoom: false,
      }).setView([DEFAULT_ROUTE_ORIGIN.latitude!, DEFAULT_ROUTE_ORIGIN.longitude!], 13);
      L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
        attribution:
          'Dados &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · Renderização &copy; <a href="https://www.openstreetmap.fr/">OSM France</a>',
        subdomains: "abc",
        maxZoom: 20,
      }).addTo(map);
      map.on("click", (event) => {
        onPickRef.current?.(
          Number(event.latlng.lat.toFixed(6)),
          Number(event.latlng.lng.toFixed(6)),
        );
      });
      const reportView = () => {
        setZoom(map.getZoom());
        const bounds = map.getBounds();
        onBoundsChangeRef.current?.({
          north: bounds.getNorth(),
          south: bounds.getSouth(),
          east: bounds.getEast(),
          west: bounds.getWest(),
        });
      };
      map.on("moveend", reportView);
      mapRef.current = map;
      markersRef.current = L.layerGroup().addTo(map);
      setReady(true);
      requestAnimationFrame(() => {
        if (!cancelled) {
          map.invalidateSize();
          reportView();
        }
      });
    });
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready || !mapRef.current || !markersRef.current) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      if (cancelled || !mapRef.current || !markersRef.current) return;
      const focusedMarker = document.activeElement?.getAttribute("data-map-group");
      markersRef.current.clearLayers();
      if (compact) {
        for (const point of points) {
          const active = selectedId === point.id;
          const marker = L.circleMarker([point.latitude, point.longitude], {
            radius: active ? 11 : 8,
            color: "#ffffff",
            weight: active ? 3 : 2,
            fillColor: active ? "#143d58" : point.cvli ? "#d35c4f" : "#2395a8",
            fillOpacity: 0.95,
          });
          const tooltip = document.createElement("span");
          tooltip.textContent = point.number;
          marker.bindTooltip(tooltip, { direction: "top" });
          marker.on("click", () => onSelectRef.current?.(point.id));
          marker.addTo(markersRef.current);
        }
      } else {
        for (const group of groups) {
          const active = group.points.some((point) => point.id === selectedId);
          const count = group.points.length;
          const label =
            count === 1
              ? `${group.points[0].number} · ${group.cvliCount ? "CVLI" : "Outro fato"}`
              : `${count} fatos neste grupo · ${group.cvliCount} CVLI · ${count - group.cvliCount} outros. Selecione para consultar.`;
          const icon = document.createElement("span");
          icon.className = `nexo-procedure-map-dot${active ? " is-active" : ""}`;
          icon.style.background = `conic-gradient(#d35c4f 0 ${(group.cvliCount / count) * 100}%, #2395a8 0 100%)`;
          const value = document.createElement("span");
          value.textContent = String(count);
          icon.append(value);
          const marker = L.marker([group.latitude, group.longitude], {
            keyboard: true,
            title: label,
            alt: label,
            zIndexOffset: active ? 1000 : count,
            icon: L.divIcon({
              className: "nexo-procedure-map-marker",
              html: icon,
              iconSize: [40, 40],
              iconAnchor: [20, 20],
            }),
          });
          const tooltip = document.createElement("span");
          tooltip.textContent = label;
          marker.bindTooltip(tooltip, { direction: "top", offset: [0, -20] });
          const activate = () => {
            const ids = group.points.map((point) => point.id);
            onSelectGroupRef.current?.(ids);
            onSelectRef.current?.(selectedId && ids.includes(selectedId) ? selectedId : ids[0]);
          };
          marker.on("click", activate);
          marker.on("add", () => {
            const element = marker.getElement();
            if (!element) return;
            element.setAttribute("aria-label", label);
            element.setAttribute("aria-pressed", String(active));
            element.setAttribute("data-map-group", group.id);
            element.addEventListener("keydown", (event) => {
              if (event.key === " ") {
                event.preventDefault();
                activate();
              }
            });
            if (focusedMarker === group.id) element.focus({ preventScroll: true });
          });
          marker.addTo(markersRef.current);
        }
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, points, selectedId, groups, compact]);

  useEffect(() => {
    if (!ready || !mapRef.current) return;
    const key = points.map((point) => `${point.id}:${point.latitude}:${point.longitude}`).join("|");
    if (key === fittedPointsRef.current) return;
    fittedPointsRef.current = key;
    if (points.length === 1) {
      mapRef.current.setView([points[0].latitude, points[0].longitude], 15);
    } else if (points.length > 1) {
      mapRef.current.fitBounds(
        points.map((point) => [point.latitude, point.longitude]),
        {
          padding: [48, 48],
          maxZoom: 15,
        },
      );
    } else {
      mapRef.current.setView([DEFAULT_ROUTE_ORIGIN.latitude!, DEFAULT_ROUTE_ORIGIN.longitude!], 13);
    }
  }, [ready, points]);

  useEffect(() => {
    if (!focusId) focusedPointRef.current = "";
    if (!ready || !focusId || !mapRef.current || compact) return;
    const point = points.find((candidate) => candidate.id === focusId);
    if (point) {
      const key = `${focusId}:${focusRequest}:${point.latitude}:${point.longitude}`;
      if (focusedPointRef.current === key) return;
      focusedPointRef.current = key;
      mapRef.current.setView(
        [point.latitude, point.longitude],
        Math.max(16, mapRef.current.getZoom()),
      );
    }
  }, [focusId, focusRequest, ready, compact, points]);

  useEffect(() => {
    if (!requestedView) restoredViewRef.current = "";
    if (!ready || compact || !requestedView || !mapRef.current) return;
    const { north, south, east, west } = requestedView.bounds;
    if (![north, south, east, west].every(Number.isFinite) || north <= south || east <= west)
      return;
    const pointKey = points
      .map((point) => `${point.id}:${point.latitude}:${point.longitude}`)
      .sort()
      .join("|");
    const requestKey = `${requestedView.request}:${pointKey}`;
    if (restoredViewRef.current === requestKey) return;
    restoredViewRef.current = requestKey;
    mapRef.current.fitBounds(
      [
        [south, west],
        [north, east],
      ],
      { maxZoom: 19, padding: [0, 0], animate: false },
    );
  }, [requestedView, points, ready, compact]);

  function fitAllPoints() {
    const map = mapRef.current;
    if (!map) return;
    if (points.length === 1) {
      map.setView([points[0].latitude, points[0].longitude], 15);
    } else if (points.length) {
      map.fitBounds(
        points.map((point) => [point.latitude, point.longitude]),
        {
          padding: [48, 48],
          maxZoom: 15,
        },
      );
    }
  }

  return (
    <div
      className={`nexo-procedure-map relative isolate w-full overflow-hidden bg-[#e8f0f2] ${compact ? "h-64" : "h-[400px] sm:h-[470px]"}`}
    >
      <style>{`
        .nexo-procedure-map .nexo-procedure-map-marker { background: transparent; border: 0; }
        .nexo-procedure-map .nexo-procedure-map-dot { display: grid; place-items: center; width: 40px; height: 40px; padding: 4px; border: 2px solid white; border-radius: 999px; box-shadow: 0 3px 10px #153c5740; }
        .nexo-procedure-map .nexo-procedure-map-dot > span { display: grid; place-items: center; width: 28px; height: 28px; border-radius: 999px; background: white; color: #163d55; font: 800 12px/1 system-ui, sans-serif; }
        .nexo-procedure-map .nexo-procedure-map-dot.is-active { outline: 3px solid #163d55; outline-offset: 3px; }
        .nexo-procedure-map .nexo-procedure-map-marker:focus-visible { outline: 3px solid #163d55; outline-offset: 5px; border-radius: 999px; }
        .nexo-procedure-map .leaflet-control-attribution { max-width: 80%; font-size: 9px; }
        .nexo-procedure-map .leaflet-tooltip { max-width: 260px; white-space: normal; font-family: inherit; }
      `}</style>
      <div
        ref={containerRef}
        role={onPick ? "application" : "region"}
        aria-label={
          onPick ? "Mapa para marcar o local do fato" : "Mapa dos procedimentos georreferenciados"
        }
        className="h-full w-full"
      />
      {!compact ? (
        <>
          <button
            type="button"
            onClick={fitAllPoints}
            disabled={!ready || !points.length}
            className="absolute right-3 top-3 z-[500] inline-flex items-center gap-2 rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-xs font-bold text-[#214962] shadow-md backdrop-blur transition hover:bg-[#f0f8fa] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#143d58] disabled:opacity-50"
            aria-label="Enquadrar todos os fatos no mapa"
          >
            <Focus size={15} /> Enquadrar fatos
          </button>
          <div
            aria-live="polite"
            aria-atomic="true"
            className="pointer-events-none absolute bottom-6 left-3 z-[500] flex max-w-[calc(100%-24px)] items-center gap-2 rounded-xl border border-white/80 bg-white/95 px-3 py-2 text-[10px] font-semibold text-[#41647a] shadow-md backdrop-blur"
          >
            <Layers3 size={13} className="shrink-0 text-[#178ca0]" />
            <span>
              {selectedGroup
                ? `${selectedGroup.points.length} ${selectedGroup.points.length === 1 ? "fato selecionado" : "fatos no grupo"} · ${selectedGroup.cvliCount} CVLI`
                : `${groups.length} ${groups.length === 1 ? "ponto" : "pontos"} · aproxime para separar`}
            </span>
            <span className="shrink-0 border-l border-[#d8e5eb] pl-2 tabular-nums">
              Zoom {zoom}
            </span>
          </div>
        </>
      ) : null}
    </div>
  );
}
