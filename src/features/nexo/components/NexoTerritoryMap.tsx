import {
  Building2,
  CarFront,
  Crosshair,
  Eye,
  EyeOff,
  Layers3,
  MapPin,
  MoveUpRight,
  ShieldAlert,
  Siren,
  UserRound,
} from "lucide-react";
import { useMemo, useState, type MouseEvent, type ReactNode } from "react";
import type { NexoMapPoint, NexoOrganizacao, NexoPessoa, NexoTerritorio } from "../nexoTypes";
import { centerOf, findTerritoryOverlaps } from "./nexoTerritoryMapUtils";

const MAP_IMAGE = "https://brasilocal.com/images/m/mapa/itabela.png";

const MAP_BOUNDS = {
  north: -16.55,
  south: -16.59,
  west: -39.59,
  east: -39.54,
};

function positionFromCoordinates(latitude: number, longitude: number): NexoMapPoint | null {
  const x = ((longitude - MAP_BOUNDS.west) / (MAP_BOUNDS.east - MAP_BOUNDS.west)) * 100;
  const y = ((MAP_BOUNDS.north - latitude) / (MAP_BOUNDS.north - MAP_BOUNDS.south)) * 100;
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || x > 100 || y < 0 || y > 100) {
    return null;
  }
  return { x, y };
}

function LayerToggle({
  active,
  disabled,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  icon: ReactNode;
  label: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={active}
      title={disabled ? `${label}: nenhum item com localização disponível` : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left text-[11px] font-bold transition ${
        disabled
          ? "cursor-not-allowed text-[#aab6c0]"
          : active
            ? "bg-[#e9f5f7] text-[#176f85]"
            : "text-[#667d8e] hover:bg-[#f2f6f8]"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1">{label}</span>
      <span className="rounded-full bg-white px-1.5 py-0.5 text-[9px] shadow-sm">{count}</span>
      {active && !disabled ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
    </button>
  );
}

export function NexoTerritoryMap({
  territories,
  organizations,
  selectedId,
  onSelect,
  people = [],
  onPersonSelect,
  drawingPoints = [],
  onMapClick,
}: {
  territories: NexoTerritorio[];
  organizations: NexoOrganizacao[];
  selectedId: string | null;
  onSelect: (territory: NexoTerritorio) => void;
  people?: NexoPessoa[];
  onPersonSelect?: (person: NexoPessoa) => void;
  drawingPoints?: NexoMapPoint[];
  onMapClick?: (point: NexoMapPoint) => void;
}) {
  const [layers, setLayers] = useState({
    territories: true,
    organizations: true,
    people: true,
    occurrences: false,
    vehicles: false,
  });
  const organizationById = new Map(
    organizations.map((organization) => [organization.id, organization]),
  );
  const positionedPeople = useMemo(
    () =>
      people.flatMap((person) => {
        const address = person.endereco;
        if (address?.latitude == null || address.longitude == null) return [];
        const position = positionFromCoordinates(address.latitude, address.longitude);
        return position ? [{ person, position }] : [];
      }),
    [people],
  );
  const overlaps = useMemo(() => findTerritoryOverlaps(territories), [territories]);

  function toggleLayer(layer: keyof typeof layers) {
    setLayers((current) => ({ ...current, [layer]: !current[layer] }));
  }

  function handleMapClick(event: MouseEvent<HTMLDivElement>) {
    if (!onMapClick) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    onMapClick({
      x: Math.round(((event.clientX - bounds.left) / bounds.width) * 1000) / 10,
      y: Math.round(((event.clientY - bounds.top) / bounds.height) * 1000) / 10,
    });
  }

  return (
    <div className="overflow-hidden rounded-[26px] border border-[#dbe4ef] bg-[#e7edf2] shadow-[0_24px_80px_-45px_rgba(14,36,64,.45)]">
      <div className="relative h-[470px] w-full overflow-hidden sm:h-[550px]">
        <img
          src={MAP_IMAGE}
          alt="Base cartográfica de ruas de Itabela, Bahia"
          className="absolute inset-0 h-full w-full object-cover grayscale contrast-110"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/35 via-transparent to-[#d9e7f3]/55" />
        <div className="pointer-events-none absolute inset-0 opacity-35 [background-image:linear-gradient(rgba(46,88,124,.14)_1px,transparent_1px),linear-gradient(90deg,rgba(46,88,124,.14)_1px,transparent_1px)] [background-size:54px_54px]" />

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 h-full w-full"
          aria-label="Áreas de influência registradas"
        >
          {layers.territories &&
            territories
              .filter((territory) => territory.pontos.length >= 3)
              .map((territory) => {
                const organization = organizationById.get(territory.organizacao_id);
                const color = organization?.cor || "#3578a7";
                const selected = selectedId === territory.id;
                return (
                  <polygon
                    key={territory.id}
                    points={territory.pontos.map((point) => `${point.x},${point.y}`).join(" ")}
                    fill={color}
                    fillOpacity={selected ? 0.44 : 0.22}
                    stroke={color}
                    strokeWidth={selected ? 0.55 : 0.35}
                    strokeDasharray={
                      territory.classificacao === "confirmado" ? undefined : "1.1 .65"
                    }
                    className="cursor-pointer transition-opacity hover:opacity-80"
                    onClick={() => onSelect(territory)}
                  >
                    <title>{`${territory.bairro} — ${organization?.nome || "Organização"}`}</title>
                  </polygon>
                );
              })}
          {drawingPoints.length ? (
            <>
              <polyline
                points={drawingPoints.map((point) => `${point.x},${point.y}`).join(" ")}
                fill="none"
                stroke="#174d83"
                strokeWidth=".55"
                strokeDasharray="1 .5"
              />
              {drawingPoints.map((point, index) => (
                <circle
                  key={index}
                  cx={point.x}
                  cy={point.y}
                  r=".65"
                  fill="#174d83"
                  stroke="white"
                  strokeWidth=".35"
                />
              ))}
            </>
          ) : null}
        </svg>

        {!onMapClick &&
          layers.organizations &&
          territories
            .filter((territory) => territory.pontos.length >= 3)
            .map((territory) => {
              const organization = organizationById.get(territory.organizacao_id);
              const center = centerOf(territory.pontos);
              return (
                <button
                  key={territory.id}
                  type="button"
                  onClick={() => onSelect(territory)}
                  style={{
                    left: `${center.x}%`,
                    top: `${center.y}%`,
                    borderColor: organization?.cor || "#3578a7",
                  }}
                  className={`absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-xl border-2 bg-white/95 px-3 py-2 text-left shadow-[0_8px_30px_rgba(22,42,70,.2)] backdrop-blur transition-transform hover:scale-105 ${selectedId === territory.id ? "scale-105 ring-4 ring-white/60" : ""}`}
                >
                  <span className="block whitespace-nowrap text-xs font-black text-[#18334d]">
                    {territory.bairro}
                  </span>
                  <span className="mt-0.5 block max-w-[125px] truncate text-[10px] font-bold text-[#63758a]">
                    {organization?.nome || "Sem grupo"}
                  </span>
                </button>
              );
            })}

        {!onMapClick &&
          layers.people &&
          positionedPeople.map(({ person, position }) => {
            const link = person.vinculos.find((item) => organizationById.has(item.organizacao_id));
            const color = link ? organizationById.get(link.organizacao_id)?.cor : undefined;
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onPersonSelect?.(person)}
                title={`${person.nome} — ${person.endereco?.logradouro || "Endereço cadastrado"}`}
                style={{
                  left: `${position.x}%`,
                  top: `${position.y}%`,
                  borderColor: color || "#237e97",
                }}
                className="absolute z-[12] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1.5 rounded-full border-2 bg-white px-2 py-1.5 text-[10px] font-black text-[#24465d] shadow-[0_7px_22px_rgba(18,45,67,.26)] transition-transform hover:scale-105"
              >
                <UserRound className="h-3.5 w-3.5" style={{ color: color || "#237e97" }} />
                <span className="max-w-[110px] truncate">{person.apelido || person.nome}</span>
              </button>
            );
          })}

        {!onMapClick &&
          layers.territories &&
          overlaps.map((overlap) => (
            <div
              key={overlap.id}
              style={{ left: `${overlap.center.x}%`, top: `${overlap.center.y}%` }}
              title={`${overlap.first.bairro} × ${overlap.second.bairro}`}
              className="pointer-events-none absolute z-[13] flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-[#d98327] bg-[#fff5df]/95 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-[#9b5719] shadow-lg backdrop-blur"
            >
              <ShieldAlert className="h-3.5 w-3.5" /> Área sobreposta
            </div>
          ))}

        {onMapClick ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Posicionar os vértices da área no mapa"
            className="absolute inset-0 z-20 cursor-crosshair"
            onClick={handleMapClick}
            onKeyDown={(event) => {
              if (event.key === "Escape") event.currentTarget.blur();
            }}
          />
        ) : null}

        <div className="pointer-events-none absolute left-5 top-5 z-20 flex items-center gap-3 rounded-2xl border border-white/80 bg-white/90 px-4 py-3 shadow-lg backdrop-blur">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#e4f2f7] text-[#137e96]">
            <MapPin className="h-5 w-5" />
          </span>
          <span>
            <strong className="block text-xs font-black uppercase tracking-[.12em] text-[#173c57]">
              Itabela · BA
            </strong>
            <small className="block text-[10px] text-[#72869b]">
              Leitura territorial demonstrativa
            </small>
          </span>
        </div>
        {!onMapClick ? (
          <div className="absolute right-4 top-4 z-30 w-[190px] rounded-2xl border border-white/80 bg-white/95 p-2.5 shadow-[0_14px_40px_rgba(20,49,72,.22)] backdrop-blur">
            <div className="mb-1.5 flex items-center gap-2 px-2 py-1 text-[10px] font-black uppercase tracking-[.13em] text-[#31566d]">
              <Layers3 className="h-4 w-4 text-[#1b8ca3]" /> Camadas do mapa
            </div>
            <LayerToggle
              active={layers.territories}
              icon={<MapPin className="h-3.5 w-3.5" />}
              label="Territórios"
              count={territories.length}
              onClick={() => toggleLayer("territories")}
            />
            <LayerToggle
              active={layers.organizations}
              icon={<Building2 className="h-3.5 w-3.5" />}
              label="Facções"
              count={organizations.length}
              onClick={() => toggleLayer("organizations")}
            />
            <LayerToggle
              active={layers.people}
              disabled={!positionedPeople.length}
              icon={<UserRound className="h-3.5 w-3.5" />}
              label="Endereços de membros"
              count={positionedPeople.length}
              onClick={() => toggleLayer("people")}
            />
            <LayerToggle
              active={layers.occurrences}
              disabled
              icon={<Siren className="h-3.5 w-3.5" />}
              label="Ocorrências"
              count={0}
              onClick={() => toggleLayer("occurrences")}
            />
            <LayerToggle
              active={layers.vehicles}
              disabled
              icon={<CarFront className="h-3.5 w-3.5" />}
              label="Veículos"
              count={0}
              onClick={() => toggleLayer("vehicles")}
            />
          </div>
        ) : null}
        {onMapClick ? (
          <div className="pointer-events-none absolute bottom-5 left-5 z-20 rounded-xl bg-[#153a59] px-4 py-2 text-xs font-bold text-white shadow-xl">
            <Crosshair className="mr-1.5 inline h-4 w-4" /> Clique para marcar os limites da área
          </div>
        ) : null}
        {!territories.length && !onMapClick ? (
          <div className="absolute bottom-5 left-5 z-20 rounded-xl border border-white/80 bg-white/95 px-4 py-3 text-xs font-semibold text-[#5d7084] shadow-lg">
            Nenhuma área cadastrada. Adicione a primeira marcação territorial.
          </div>
        ) : null}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#d5e0eb] bg-white px-5 py-3 text-[10px] text-[#698097]">
        <span>
          <MoveUpRight className="mr-1 inline h-3 w-3" /> Áreas desenhadas manualmente; a imagem não
          define limites oficiais.
        </span>
        <a
          href="https://brasilocal.com/bahia/porto-seguro/itabela/"
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-[#3578a7] hover:underline"
        >
          Base: Portal Itabela
        </a>
      </div>
    </div>
  );
}
