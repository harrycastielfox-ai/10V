import { useCallback, useEffect, useRef, useState, type ComponentProps } from "react";
import type { FeatureGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";
import { NexoLegacyTerritoryMap } from "./NexoLegacyTerritoryMap";
import { circleArea, geographicPoint, isGeographicArea } from "../nexoTerritoryCoordinates";
import { scheduleRigidMapRecentering } from "../mapRecentering";
import { territoryPolygons } from "../nexoTerritoryGeometry";
import type { NexoMapPoint } from "../nexoTypes";

type Props = ComponentProps<typeof NexoLegacyTerritoryMap> & {
  onDrawingChange?: (points: NexoMapPoint[]) => void;
  drawingAreas?: NexoMapPoint[][];
  labelMode?: "territory" | "organization";
  fitTerritories?: boolean;
  heightClassName?: string;
  mapAriaLabel?: string;
  readOnlyDescription?: string;
  recenterIntervalMs?: number;
};

const ITABELA_CENTER: [number, number] = [-16.575, -39.559];
const ITABELA_ZOOM = 15;

export function NexoTerritoryMap(props: Props) {
  const legacy = props.territories.filter(
    (area) => area.pontos.length > 0 && !isGeographicArea(area.pontos),
  );
  const [showLegacy, setShowLegacy] = useState(false);
  const legacyDraft = Boolean(
    props.drawingPoints?.length && !isGeographicArea(props.drawingPoints),
  );
  return (
    <div>
      {legacy.length > 0 && !props.onMapClick ? (
        <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-[#567184]">
          <button
            type="button"
            className="rounded-lg border bg-white px-3 py-2 font-bold"
            onClick={() => setShowLegacy(!showLegacy)}
          >
            {showLegacy ? "Ver mapa de ruas" : `Ver marcações antigas (${legacy.length})`}
          </button>
          <span>Marcações antigas permanecem na imagem em que foram desenhadas.</span>
        </div>
      ) : null}
      {showLegacy || legacyDraft ? (
        <NexoLegacyTerritoryMap {...props} territories={legacy} />
      ) : (
        <StreetMap {...props} />
      )}
    </div>
  );
}

function StreetMap(props: Props) {
  const container = useRef<HTMLDivElement>(null);
  const map = useRef<LeafletMap | null>(null);
  const shapes = useRef<FeatureGroup | null>(null);
  const current = useRef(props);
  current.current = props;
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [showPeople, setShowPeople] = useState(false);
  const [mode, setMode] = useState<"polygon" | "circle">("polygon");
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const center = useRef<[number, number] | null>(null);
  const [hasCenter, setHasCenter] = useState(false);
  const [automaticRecenterCount, setAutomaticRecenterCount] = useState(0);
  const [visibleView, setVisibleView] = useState<{ center: string; zoom: number } | null>(null);
  const drawing = Boolean(props.onMapClick);
  const recenterCity = useCallback((automatic = false) => {
    const instance = map.current;
    if (!instance) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      instance.setView(ITABELA_CENTER, ITABELA_ZOOM, { animate: false });
    } else {
      instance.flyTo(ITABELA_CENTER, ITABELA_ZOOM, { duration: 0.45 });
    }
    if (automatic) setAutomaticRecenterCount((count) => count + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let resize: ResizeObserver | undefined;
    void import("leaflet")
      .then((L) => {
        if (cancelled || !container.current) return;
        const instance = L.map(container.current, {
          minZoom: 10,
          maxZoom: 19,
          scrollWheelZoom: false,
        }).setView(ITABELA_CENTER, ITABELA_ZOOM);
        map.current = instance;
        const reportVisibleView = () => {
          const visibleCenter = instance.getCenter();
          setVisibleView({
            center: `${visibleCenter.lat.toFixed(6)},${visibleCenter.lng.toFixed(6)}`,
            zoom: instance.getZoom(),
          });
        };
        instance.on("moveend zoomend", reportVisibleView);
        reportVisibleView();
        L.tileLayer("https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png", {
          attribution:
            'Dados &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> · &copy; <a href="https://www.openstreetmap.fr/">OSM France</a>',
          maxZoom: 19,
          subdomains: "abc",
        })
          .on("tileerror", () => setFailed(true))
          .addTo(instance);
        shapes.current = L.featureGroup().addTo(instance);
        instance.on("click", ({ latlng }) => {
          if (!current.current.onMapClick) return;
          if (modeRef.current === "circle" && current.current.onDrawingChange) {
            if (!center.current) {
              center.current = [latlng.lat, latlng.lng];
              setHasCenter(true);
            } else {
              const radius = instance.distance(center.current, latlng);
              if (radius < 5) return;
              current.current.onDrawingChange(
                circleArea(center.current[0], center.current[1], radius),
              );
              center.current = null;
              setHasCenter(false);
            }
          } else current.current.onMapClick(geographicPoint(latlng.lat, latlng.lng));
        });
        resize = new ResizeObserver(() => instance.invalidateSize());
        resize.observe(container.current);
        setReady(true);
      })
      .catch(() => setFailed(true));
    return () => {
      cancelled = true;
      resize?.disconnect();
      map.current?.remove();
      map.current = null;
      shapes.current = null;
    };
  }, []);

  useEffect(
    () =>
      scheduleRigidMapRecentering({
        drawing: drawing || !ready,
        recenter: () => recenterCity(true),
        intervalMs: props.recenterIntervalMs,
      }),
    [drawing, ready, recenterCity, props.recenterIntervalMs],
  );

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void import("leaflet").then((L) => {
      const layer = shapes.current;
      if (cancelled || !layer) return;
      layer.clearLayers();
      if (showPeople && !drawing) {
        for (const person of props.people || []) {
          const address = person.endereco;
          if (address?.latitude == null || address.longitude == null) continue;
          const marker = L.circleMarker([address.latitude, address.longitude], {
            radius: 6,
            color: "#247e93",
            fillOpacity: 0.8,
          }).addTo(layer);
          const label = document.createElement("span");
          label.textContent = person.apelido || person.nome;
          marker.bindTooltip(label).on("click", () => props.onPersonSelect?.(person));
        }
      }
      for (const area of props.territories) {
        const organization = props.organizations.find((org) => org.id === area.organizacao_id);
        const color = organization?.cor || "#16879b";
        for (const areaPolygon of territoryPolygons(area).filter(isGeographicArea)) {
          const polygon = L.polygon(
            areaPolygon.map((point) => [point.y, point.x]),
            {
              color,
              weight: props.selectedId === area.id ? 4 : 2,
              fillOpacity: 0.18,
              interactive: !drawing,
            },
          ).addTo(layer);
          const label = document.createElement("span");
          if (props.labelMode === "organization") {
            const title = document.createElement("strong");
            title.textContent = organization?.sigla?.trim() || organization?.nome || "Facção";
            const detail = document.createElement("small");
            detail.textContent = area.bairro;
            label.className = "nexo-territory-organization-label__content";
            label.append(title, detail);
          } else label.textContent = area.bairro;
          polygon
            .bindTooltip(label, {
              permanent: props.labelMode === "organization",
              direction: "top",
              className:
                props.labelMode === "organization"
                  ? "nexo-territory-organization-label"
                  : undefined,
              opacity: 1,
            })
            .on("click", () => props.onSelect(area));
        }
      }
      for (const [index, completedArea] of (props.drawingAreas || []).entries()) {
        if (!isGeographicArea(completedArea)) continue;
        const completedPolygon = L.polygon(
          completedArea.map((point) => [point.y, point.x]),
          {
            color: "#059669",
            weight: 3,
            fillOpacity: 0.16,
            interactive: false,
          },
        ).addTo(layer);
        completedPolygon.bindTooltip(`Área ${index + 1} concluída`);
      }
      const points = props.drawingPoints || [];
      if (isGeographicArea(points)) {
        const coordinates = points.map((point): [number, number] => [point.y, point.x]);
        if (points.length >= 3)
          L.polygon(coordinates, {
            color: "#d97706",
            weight: 3,
            fillOpacity: 0.18,
            interactive: false,
          }).addTo(layer);
        else L.polyline(coordinates, { color: "#d97706", interactive: false }).addTo(layer);
        for (const coordinate of coordinates)
          L.circleMarker(coordinate, { radius: 3, color: "#d97706", interactive: false }).addTo(
            layer,
          );
      }
      if (hasCenter && center.current)
        L.circleMarker(center.current, { radius: 6, color: "#d97706", interactive: false }).addTo(
          layer,
        );
      if (props.fitTerritories && !drawing) {
        const bounds = layer.getBounds();
        if (bounds.isValid()) map.current?.fitBounds(bounds, { padding: [34, 34], maxZoom: 16 });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [ready, props, drawing, hasCenter, showPeople]);

  return (
    <div className="overflow-hidden rounded-2xl border border-[#cbdde5] bg-white">
      <div className="flex flex-wrap items-center gap-2 border-b p-3 text-xs text-[#31566d]">
        <strong className="mr-auto">Itabela · mapa de ruas</strong>
        {!drawing && props.people?.length ? (
          <button
            type="button"
            aria-pressed={showPeople}
            onClick={() => setShowPeople(!showPeople)}
            className="rounded-lg border px-3 py-2 aria-pressed:bg-[#e4f2f7]"
          >
            Endereços de membros
          </button>
        ) : null}
        {drawing ? (
          <>
            <button
              type="button"
              aria-pressed={mode === "polygon"}
              onClick={() => {
                setMode("polygon");
                center.current = null;
                setHasCenter(false);
              }}
              className="rounded-lg border px-3 py-2 aria-pressed:bg-[#e4f2f7]"
            >
              Contornar área
            </button>
            {props.onDrawingChange ? (
              <button
                type="button"
                aria-pressed={mode === "circle"}
                onClick={() => {
                  setMode("circle");
                  center.current = null;
                  setHasCenter(false);
                }}
                className="rounded-lg border px-3 py-2 aria-pressed:bg-[#e4f2f7]"
              >
                Circular área
              </button>
            ) : null}
          </>
        ) : null}
        <button
          type="button"
          className="rounded-lg border px-3 py-2"
          onClick={() => recenterCity()}
        >
          Centralizar cidade
        </button>
      </div>
      {automaticRecenterCount ? (
        <span role="status" className="sr-only">
          Mapa recentralizado automaticamente · {automaticRecenterCount}
        </span>
      ) : null}
      {failed ? (
        <p role="status" className="bg-amber-50 p-3 text-xs text-amber-900">
          Não foi possível carregar parte do mapa. Verifique a conexão e recarregue antes de marcar
          a área.
        </p>
      ) : null}
      <div
        ref={container}
        aria-label={props.mapAriaLabel || "Mapa de ruas para marcação territorial"}
        data-map-center={visibleView?.center}
        data-map-zoom={visibleView?.zoom}
        className={`relative z-0 w-full ${props.heightClassName || "h-[550px]"}`}
      />
      <p className="border-t px-4 py-3 text-xs text-[#567184]">
        {drawing
          ? mode === "circle"
            ? hasCenter
              ? "Clique na borda desejada para definir o tamanho do círculo (mínimo 5 metros)."
              : "Clique no centro e depois na borda para circular a área. Depois, use Concluir área e iniciar outra."
            : "Clique em três ou mais pontos para contornar a área. Arraste o mapa para navegar."
          : props.readOnlyDescription ||
            "Amplie para ver as ruas. Use Adicionar local para contornar ou circular uma área."}
        {drawing ? " O desenho só é salvo ao confirmar o cadastro." : ""}
      </p>
    </div>
  );
}
