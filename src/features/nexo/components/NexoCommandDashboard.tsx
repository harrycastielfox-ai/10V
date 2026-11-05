import {
  ArrowUpRight,
  Building2,
  FileText,
  MapPinned,
  Network,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { activeDirectoryLinks } from "../nexoDirectoryFilters";
import {
  uniqueNexoProcedureRecords,
  type NexoWorkspaceSearchData,
  type NexoWorkspaceView,
} from "../nexoWorkspaceSearch";
import { NexoTerritoryMap } from "./NexoTerritoryMap";

type Target = { kind: "person" | "organization"; id: string };

export function NexoCommandDashboard({
  data,
  onCreatePerson,
  onCreateOrganization,
  onNavigate,
  onOpen,
  onSearch,
}: {
  data: NexoWorkspaceSearchData;
  onCreatePerson: () => void;
  onCreateOrganization: () => void;
  onNavigate: (view: NexoWorkspaceView) => void;
  onOpen: (target: Target) => void;
  onSearch: () => void;
}) {
  const { organizations, people, territories, records } = data;
  const uniqueRecords = uniqueNexoProcedureRecords(records);
  const activeLinks = people.flatMap(activeDirectoryLinks);
  const mappedOrganizationIds = new Set(territories.map((territory) => territory.organizacao_id));
  const mappedOrganizations = organizations.filter((organization) =>
    mappedOrganizationIds.has(organization.id),
  );
  const indicators = [
    {
      label: "Pessoas",
      value: people.length,
      hint: "fichas individuais",
      view: "pessoas" as const,
      icon: UsersRound,
    },
    {
      label: "Facções",
      value: organizations.length,
      hint: "dossiês cadastrados",
      view: "organizacoes" as const,
      icon: Building2,
    },
    {
      label: "Áreas",
      value: territories.length,
      hint: "locais registrados",
      view: "inteligencia" as const,
      icon: MapPinned,
    },
    {
      label: "Procedimentos",
      value: uniqueRecords.length,
      hint: "B.O.s e inquéritos vinculados",
      view: "procedimentos" as const,
      icon: FileText,
    },
  ];

  return (
    <section className="pb-14 pt-8 sm:pt-10">
      <div className="relative isolate overflow-hidden rounded-[26px] border border-[#234d62] bg-[#12334a] p-6 text-white shadow-[0_16px_42px_-24px_#12334a80] sm:p-8 lg:p-9">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-[.07] [background-image:linear-gradient(#9edbe3_1px,transparent_1px),linear-gradient(90deg,#9edbe3_1px,transparent_1px)] [background-size:38px_38px] [mask-image:linear-gradient(90deg,transparent,black)]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-48 -z-10 h-[520px] w-[520px] rounded-full bg-[#168aa1]/15 blur-3xl"
        />
        <div className="grid items-center gap-7 lg:grid-cols-[1fr_310px] xl:grid-cols-[1fr_390px]">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2.5 text-[11px] font-bold uppercase tracking-[.22em] text-[#8ed9e3]">
              <span className="h-1.5 w-1.5 rounded-full bg-[#6dd8df]" aria-hidden />
              Central NEXO
            </p>
            <h1 className="mt-4 text-[29px] font-extrabold leading-[1.18] tracking-[-.035em] sm:text-[36px]">
              Informação conectada.
              <br />
              <span className="text-[#a1dce4]">Consulta mais direta.</span>
            </h1>
            <p className="mt-4 max-w-xl text-sm leading-7 text-[#c1d5df]">
              Pessoas, facções e procedimentos em um único panorama. Abra um dossiê, retome um
              cadastro ou aprofunde a análise.
            </p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <button
                type="button"
                onClick={onCreatePerson}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#a3e5eb] px-4 py-3 text-xs font-bold text-[#12334a] transition hover:bg-[#c4f2f5] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
              >
                <Plus className="h-4 w-4" /> Cadastrar pessoa
              </button>
              <button
                type="button"
                onClick={onCreateOrganization}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-white/[.035] px-4 py-3 text-xs font-bold text-[#e0edf3] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
              >
                <Building2 className="h-4 w-4" /> Cadastrar facção
              </button>
            </div>
          </div>
          <div className="space-y-4">
            <div
              aria-hidden
              className="relative hidden h-[158px] overflow-hidden rounded-2xl border border-[#89bdcf]/20 bg-[#0a2539]/35 lg:block"
            >
              <svg
                className="absolute inset-0 h-full w-full"
                viewBox="0 0 360 158"
                fill="none"
                preserveAspectRatio="xMidYMid meet"
              >
                <path
                  d="M72 50L180 82L290 40M180 82L275 125M180 82L75 125"
                  stroke="#61b8c6"
                  strokeOpacity=".55"
                  strokeWidth="1.5"
                />
                <circle
                  cx="180"
                  cy="82"
                  r="41"
                  stroke="#6ab7c6"
                  strokeOpacity=".12"
                  strokeDasharray="3 6"
                />
                <circle cx="180" cy="82" r="65" stroke="#6ab7c6" strokeOpacity=".1" />
                <circle cx="72" cy="50" r="5" fill="#91dde5" />
                <circle cx="290" cy="40" r="5" fill="#91dde5" />
                <circle cx="275" cy="125" r="5" fill="#91dde5" />
                <circle cx="75" cy="125" r="5" fill="#91dde5" />
              </svg>
              <span className="absolute left-1/2 top-[82px] flex h-14 w-14 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-2xl border border-[#a1e0e8]/40 bg-[#21546a] shadow-[0_0_35px_#168aa130]">
                <Network className="h-7 w-7 text-[#b1e8ed]" />
              </span>
              <span className="absolute left-[15%] top-[24px] flex h-10 w-10 items-center justify-center rounded-xl border border-[#8dc4d4]/20 bg-[#173f54]">
                <UsersRound className="h-4 w-4 text-[#9ed8e2]" />
              </span>
              <span className="absolute right-[13%] top-[14px] flex h-10 w-10 items-center justify-center rounded-xl border border-[#8dc4d4]/20 bg-[#173f54]">
                <Building2 className="h-4 w-4 text-[#9ed8e2]" />
              </span>
              <span className="absolute bottom-[14px] right-[17%] flex h-9 w-9 items-center justify-center rounded-xl border border-[#8dc4d4]/20 bg-[#173f54]">
                <FileText className="h-4 w-4 text-[#9ed8e2]" />
              </span>
            </div>
            <button
              type="button"
              onClick={onSearch}
              className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-white/20 bg-[#0b293d]/65 px-4 py-3 text-left text-sm font-semibold transition hover:border-[#96d6e2]/50 hover:bg-[#1c4a61] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
            >
              <Search className="h-4 w-4 text-[#8ae3ec]" />{" "}
              <span className="flex-1">Buscar no NEXO</span>{" "}
              <kbd className="hidden rounded-md border border-white/20 bg-white/5 px-2 py-1 text-[11px] font-medium text-[#c8e1e9] sm:inline">
                Ctrl K
              </kbd>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
        {indicators.map(({ label, value, hint, view, icon: Icon }) => (
          <button
            type="button"
            key={label}
            onClick={() => onNavigate(view)}
            className="nexo-surface nexo-metric group relative flex flex-col items-start gap-3 overflow-hidden rounded-2xl p-4 text-left transition hover:-translate-y-0.5 hover:border-[#8bbac7] sm:flex-row sm:p-5"
          >
            <span className="rounded-xl border border-[#d5e9ee] bg-[#edf7f9] p-2.5 text-[#168aa1]">
              <Icon className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
              <strong className="text-[30px] font-extrabold leading-none tracking-[-.035em] text-[#12334a]">
                {value}
              </strong>
              <span className="mt-2 block text-xs font-bold text-[#385c73]">{label}</span>
              <small className="mt-1.5 block text-[11px] leading-5 text-[#567184]">{hint}</small>
            </span>
            <ArrowUpRight className="hidden h-4 w-4 text-[#9bb8c6] transition group-hover:text-[#277d96] sm:block" />
          </button>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        <section className="nexo-surface overflow-hidden rounded-[22px]">
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-start sm:justify-between sm:p-6">
            <div>
              <p className="nexo-eyebrow">Leitura territorial</p>
              <h2 className="mt-1.5 flex items-center gap-2 text-[17px] font-extrabold tracking-[-.02em] text-[#12334a]">
                <MapPinned className="h-4 w-4 text-[#168aa1]" aria-hidden />
                Mapa territorial
              </h2>
              <p className="mt-2 text-xs leading-6 text-[#567184]">
                Áreas registradas por facção, conforme os limites informados no NEXO.
              </p>
            </div>
            <div
              className="flex max-w-full flex-wrap gap-2"
              aria-label="Legenda das facções no mapa"
            >
              {mappedOrganizations.map((organization) => (
                <button
                  key={organization.id}
                  type="button"
                  onClick={() => onOpen({ kind: "organization", id: organization.id })}
                  title={`Abrir dossiê de ${organization.nome}`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full border border-[#d8e5eb] bg-[#f7fafb] px-3 py-2 text-[10px] font-black uppercase tracking-[.08em] text-[#385c73] transition hover:border-[#8dbbc7] hover:bg-white"
                >
                  <span
                    aria-hidden
                    className="h-2.5 w-2.5 rounded-full shadow-[0_0_0_3px_white]"
                    style={{ backgroundColor: organization.cor }}
                  />
                  <span>{organization.sigla?.trim() || organization.nome}</span>
                  {organization.sigla?.trim() ? (
                    <span className="sr-only">{organization.nome}</span>
                  ) : null}
                </button>
              ))}
              {!mappedOrganizations.length ? (
                <span className="inline-flex min-h-9 items-center rounded-full border border-[#d8e5eb] bg-[#f7fafb] px-3 py-2 text-[10px] font-bold text-[#668194]">
                  0 áreas registradas
                </span>
              ) : null}
            </div>
          </div>
          <div className="border-t border-[#dce8ed] bg-[#f4f8fa] p-2 sm:p-3">
            <NexoTerritoryMap
              territories={territories}
              organizations={organizations}
              people={[]}
              selectedId={null}
              onSelect={(territory) =>
                onOpen({ kind: "organization", id: territory.organizacao_id })
              }
              labelMode="organization"
              fitTerritories
              heightClassName="h-[460px] sm:h-[540px] lg:h-[580px]"
              mapAriaLabel="Mapa territorial da Central NEXO"
              readOnlyDescription="As áreas registradas nos dossiês aparecem aqui com a cor e a identificação da facção relacionada."
              recenterIntervalMs={10_000}
            />
          </div>
        </section>
        <button
          type="button"
          onClick={() => onNavigate("inteligencia")}
          className="flex w-full items-center gap-4 rounded-[22px] border border-[#c9dfe7] bg-[#e8f2f6] p-5 text-left transition hover:border-[#7fb8c8] hover:bg-[#deeff3]"
        >
          <Network className="h-7 w-7 shrink-0 text-[#2d8a9e]" />
          <span className="flex-1">
            <strong className="block text-sm text-[#244d64]">Explorar conexões</strong>
            <span className="mt-1 block text-xs leading-5 text-[#58778b]">
              {activeLinks.length} vínculos atuais registrados. Status e fontes permanecem visíveis.
            </span>
          </span>
          <ArrowUpRight className="h-4 w-4 text-[#438ba0]" />
        </button>
      </div>
      <p className="mt-5 max-w-5xl text-[11px] leading-6 text-[#567184]">
        Contagens limitadas aos registros disponíveis neste ambiente. Procedimentos são deduplicados
        pelo identificador de B.O. ou inquérito; não representam o total de crimes.
      </p>
    </section>
  );
}
