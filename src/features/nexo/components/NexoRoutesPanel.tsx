import {
  ArrowUpRight,
  Building2,
  ExternalLink,
  MapPin,
  Navigation,
  Search,
  UserRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { DEFAULT_ROUTE_ORIGIN } from "@/lib/mapLinks";
import type { NexoOrganizacao, NexoPessoa } from "../nexoTypes";
import {
  normalizeRouteSearch,
  routeAvailability,
  routeCoordinates,
  safeNexoNavigationUrl,
} from "../nexoRouteEligibility";
import { NexoRouteMap } from "./NexoRouteMap";
import { getNexoPersonPhotoUrl } from "../nexoSelectors";

export function NexoRoutesPanel({
  people,
  organizations,
  onOpenPerson,
}: {
  people: NexoPessoa[];
  organizations: NexoOrganizacao[];
  onOpenPerson: (id: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [faction, setFaction] = useState("");
  const [availability, setAvailability] = useState("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const organizationNames = useMemo(
    () => new Map(organizations.map((item) => [item.id, item.nome])),
    [organizations],
  );
  const destinations = useMemo(
    () =>
      people.map((person) => ({
        person,
        availability: routeAvailability(person),
        factions: person.vinculos
          .filter(
            (link, index, links) =>
              link.status !== "desvinculado" &&
              links.findIndex(
                (candidate) =>
                  candidate.status !== "desvinculado" &&
                  candidate.organizacao_id === link.organizacao_id,
              ) === index,
          )
          .map((link) => ({
            id: link.organizacao_id,
            name:
              organizationNames.get(link.organizacao_id) ||
              link.organizacao?.nome ||
              "Facção não disponível",
          })),
      })),
    [people, organizationNames],
  );
  const filtered = useMemo(() => {
    const search = normalizeRouteSearch(query);
    return destinations
      .filter(
        (item) =>
          (!faction || item.factions.some((link) => link.id === faction)) &&
          (availability === "all" || item.availability === availability) &&
          (!search ||
            normalizeRouteSearch(
              [
                item.person.nome,
                item.person.apelido,
                item.person.endereco?.bairro,
                item.person.endereco?.logradouro,
                item.person.endereco?.municipio,
                ...item.factions.map((link) => link.name),
              ].join(" "),
            ).includes(search)),
      )
      .sort(
        (a, b) =>
          Number(b.availability === "coordinates") - Number(a.availability === "coordinates") ||
          a.person.nome.localeCompare(b.person.nome, "pt-BR"),
      );
  }, [destinations, query, faction, availability]);
  const selected =
    filtered.find((item) => item.person.id === selectedId && item.availability === "coordinates")
      ?.person || null;
  const selectedPoint = routeCoordinates(selected);
  const selectedExternal = safeNexoNavigationUrl(selected?.endereco?.link_navegacao);
  const counts = {
    coordinates: destinations.filter((item) => item.availability === "coordinates").length,
    external: destinations.filter((item) => item.availability === "external").length,
    missing: destinations.filter((item) => item.availability === "missing").length,
  };

  return (
    <section className="pb-16 pt-8 sm:pt-10">
      <div className="nexo-page-heading">
        <div>
          <p className="nexo-eyebrow">Deslocamento operacional</p>
          <h1 className="nexo-title">Rotas e destinos</h1>
          <p className="nexo-description">
            Encontre um cadastro, confira o endereço e consulte o trajeto viário a partir da
            delegacia.
          </p>
        </div>
        <span className="nexo-section-pill">
          <Navigation className="h-4 w-4 text-[#24a0b4]" /> {counts.coordinates} destinos no mapa
        </span>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {[
          {
            key: "coordinates",
            label: "Com ponto válido",
            detail: "Coordenadas aptas à consulta de trajeto",
            color: "text-[#237e94]",
          },
          {
            key: "external",
            label: "Somente link externo",
            detail: "Navegação no endereço cadastrado",
            color: "text-[#5b7998]",
          },
          {
            key: "missing",
            label: "Sem localização utilizável",
            detail: "Completar no dossiê da pessoa",
            color: "text-[#a57639]",
          },
        ].map((item) => (
          <button
            type="button"
            key={item.key}
            onClick={() => setAvailability(availability === item.key ? "all" : item.key)}
            aria-pressed={availability === item.key}
            className={`rounded-2xl border bg-white p-4 text-left transition ${availability === item.key ? "border-[#80bfce] ring-2 ring-[#5badc0]/10" : "border-[#dbe7ed] hover:border-[#a9cfdc]"}`}
          >
            <strong className={`text-2xl font-black ${item.color}`}>
              {counts[item.key as keyof typeof counts]}
            </strong>
            <span className="mt-1 block text-[11px] font-black text-[#365b71]">{item.label}</span>
            <small className="mt-1 block text-[11px] text-[#567184]">{item.detail}</small>
          </button>
        ))}
      </div>
      <div className="mt-5 grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="nexo-surface overflow-hidden">
          <div className="space-y-3 border-b border-[#e4edf2] p-4">
            <label className="relative block">
              <span className="sr-only">Buscar destino por pessoa, apelido, bairro ou facção</span>
              <Search className="absolute left-3 top-3 h-4 w-4 text-[#567184]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Nome, apelido, bairro ou facção…"
                className="h-10 w-full rounded-xl border border-[#d9e6ec] pl-9 pr-3 text-xs text-[#34586f] outline-none focus:border-[#54aec1] focus:ring-2 focus:ring-[#54aec1]/10"
              />
            </label>
            <label className="block">
              <span className="sr-only">Filtrar destinos por facção</span>
              <select
                value={faction}
                onChange={(event) => setFaction(event.target.value)}
                className="h-10 w-full rounded-xl border border-[#d9e6ec] bg-white px-3 text-xs text-[#5c7d91]"
              >
                <option value="">Todas as facções</option>
                {organizations.map((organization) => (
                  <option key={organization.id} value={organization.id}>
                    {organization.nome}
                  </option>
                ))}
              </select>
            </label>
            <div className="flex items-center justify-between gap-2 text-[11px] text-[#567184]">
              <span>
                {filtered.length} de {people.length} cadastros ·{" "}
                {filtered.filter((item) => item.availability === "coordinates").length} aptos no
                recorte
              </span>
              {query || faction || availability !== "all" ? (
                <button
                  type="button"
                  onClick={() => {
                    setQuery("");
                    setFaction("");
                    setAvailability("all");
                  }}
                  className="inline-flex items-center gap-1 font-bold text-[#3d8ba2]"
                >
                  <X className="h-3 w-3" />
                  Limpar
                </button>
              ) : null}
            </div>
          </div>
          <div className="max-h-[620px] space-y-1 overflow-y-auto p-2">
            {filtered.map(({ person, availability: status, factions }) => {
              const external = safeNexoNavigationUrl(person.endereco?.link_navegacao);
              return (
                <div
                  key={person.id}
                  className={`rounded-xl border p-2 ${selected?.id === person.id ? "border-[#afd7e2] bg-[#edf8fa]" : "border-transparent hover:border-[#e0eaf0] hover:bg-[#f8fbfc]"}`}
                >
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={status !== "coordinates"}
                      onClick={() => setSelectedId(person.id)}
                      aria-pressed={selected?.id === person.id}
                      className="flex min-w-0 flex-1 items-center gap-2.5 rounded-lg p-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4b9db2] disabled:cursor-default"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-[#e7f2f6] text-[#3a8ca3]">
                        {getNexoPersonPhotoUrl(person) ? (
                          <img
                            src={getNexoPersonPhotoUrl(person)!}
                            alt=""
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <UserRound className="h-4 w-4" />
                        )}
                      </span>
                      <span className="min-w-0">
                        <strong className="block truncate text-xs text-[#294d64]">
                          {person.nome}
                        </strong>
                        <small className="mt-0.5 block truncate text-[11px] text-[#567184]">
                          {person.apelido || "Sem apelido"} ·{" "}
                          {person.endereco?.bairro || "Sem bairro"}
                        </small>
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label={`Abrir dossiê de ${person.nome}`}
                      title="Abrir dossiê"
                      onClick={() => onOpenPerson(person.id)}
                      className="rounded-lg p-2 text-[#6291a6] hover:bg-white"
                    >
                      <ArrowUpRight className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="ml-12 mt-1 flex flex-wrap gap-1 text-[11px]">
                    <span
                      className={`rounded-full px-2 py-0.5 font-bold ${status === "coordinates" ? "bg-[#dff3eb] text-[#397e64]" : status === "external" ? "bg-[#edf1f8] text-[#6482a0]" : "bg-[#fff5e7] text-[#a5814d]"}`}
                    >
                      {status === "coordinates"
                        ? "Ponto válido"
                        : status === "external"
                          ? "Só navegação externa"
                          : person.usar_local_faccao
                            ? "Usa referência da facção"
                            : person.em_situacao_rua
                              ? "Em situação de rua"
                              : "Sem ponto válido"}
                    </span>
                    {factions.slice(0, 2).map((link) => (
                      <span
                        key={link.id}
                        className="rounded-full bg-[#f0f5f7] px-2 py-0.5 text-[#567184]"
                      >
                        {link.name}
                      </span>
                    ))}
                  </div>
                  {status === "external" && external ? (
                    <a
                      href={external}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-12 mt-2 inline-flex items-center gap-1 text-[11px] font-bold text-[#3d8ba2]"
                    >
                      Abrir link cadastrado <ExternalLink className="h-3 w-3" />
                    </a>
                  ) : null}
                </div>
              );
            })}
            {!filtered.length ? (
              <div className="px-5 py-12 text-center">
                <Search className="mx-auto h-6 w-6 text-[#a4becb]" />
                <p className="mt-3 text-xs font-bold text-[#678699]">
                  Nenhum destino neste recorte
                </p>
                <p className="mt-1 text-[11px] text-[#567184]">
                  Ajuste a busca ou os filtros de localização.
                </p>
              </div>
            ) : null}
          </div>
        </aside>
        <div className="min-w-0 space-y-4">
          {selected ? (
            <section className="rounded-[22px] border border-[#d9e7ee] bg-white p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[.18em] text-[#69a0b1]">
                    Destino selecionado
                  </p>
                  <h2 className="mt-1 text-lg font-black text-[#20445d]">{selected.nome}</h2>
                  <p className="mt-1 text-xs text-[#7794a5]">
                    {[
                      selected.endereco?.logradouro,
                      selected.endereco?.numero,
                      selected.endereco?.bairro,
                    ]
                      .filter(Boolean)
                      .join(", ") || "Logradouro não informado"}
                  </p>
                  <p className="mt-1 text-[11px] text-[#567184]">
                    {[selected.endereco?.municipio, selected.endereco?.uf]
                      .filter(Boolean)
                      .join(" / ")}
                    {selectedPoint
                      ? ` · ${selectedPoint.latitude.toFixed(6)}, ${selectedPoint.longitude.toFixed(6)}`
                      : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpenPerson(selected.id)}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-[#183f58] px-3 py-2.5 text-[11px] font-bold text-white"
                >
                  Abrir dossiê
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {selected.endereco?.ponto_referencia ? (
                <p className="mt-3 rounded-xl bg-[#f3f8fa] px-3 py-2 text-[11px] text-[#6b8b9c]">
                  Referência: {selected.endereco.ponto_referencia}
                </p>
              ) : null}
              {selectedExternal ? (
                <a
                  href={selectedExternal}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-bold text-[#438ba0]"
                >
                  Link de navegação cadastrado
                  <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </section>
          ) : null}
          <NexoRouteMap pessoa={selected} />
          <div className="flex items-start gap-2 rounded-xl border border-[#dce8ee] bg-[#f2f7f9] px-4 py-3 text-[11px] leading-relaxed text-[#7693a4]">
            <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[#4f93a9]" />
            <span>
              Origem: {DEFAULT_ROUTE_ORIGIN.endereco}. Distância e duração aparecem somente quando o
              serviço retorna um trajeto viário.
            </span>
          </div>
        </div>
      </div>
    </section>
  );
}
