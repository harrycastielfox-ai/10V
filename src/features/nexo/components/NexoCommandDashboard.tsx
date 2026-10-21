import { useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Filter,
  MapPinned,
  Network,
  Plus,
  Search,
  UsersRound,
} from "lucide-react";
import { activeDirectoryLinks } from "../nexoDirectoryFilters";
import { getNexoPersonPhotoUrl } from "../nexoSelectors";
import {
  filterNexoPendingItems,
  listNexoPendingCategories,
  type NexoPendingCategory,
} from "../nexoPendencias";
import {
  uniqueNexoProcedureRecords,
  type NexoWorkspaceSearchData,
  type NexoWorkspaceView,
} from "../nexoWorkspaceSearch";

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
  const [selectedPendingCategory, setSelectedPendingCategory] =
    useState<NexoPendingCategory>("foto_perfil");
  const [pendingQuery, setPendingQuery] = useState("");
  const uniqueRecords = uniqueNexoProcedureRecords(records);
  const activeLinks = people.flatMap(activeDirectoryLinks);
  const pendingCategories = useMemo(
    () => listNexoPendingCategories(people, territories),
    [people, territories],
  );
  const selectedPending =
    pendingCategories.find((item) => item.category === selectedPendingCategory) ||
    pendingCategories[0];
  const filteredPendingItems = selectedPending
    ? filterNexoPendingItems(selectedPending.items, pendingQuery)
    : [];
  const pendingTotal = pendingCategories.reduce((total, item) => total + item.items.length, 0);
  const recent = [
    ...people.map((person) => ({
      id: person.id,
      name: person.nome,
      detail: person.apelido || "Ficha individual",
      date: person.created_at,
      kind: "person" as const,
      photo: getNexoPersonPhotoUrl(person),
      color: "#1a8a9e",
    })),
    ...organizations.map((org) => ({
      id: org.id,
      name: org.nome,
      detail: org.sigla || "Dossiê de facção",
      date: org.created_at,
      kind: "organization" as const,
      photo: null,
      color: org.cor,
    })),
  ]
    .sort((a, b) => (Date.parse(b.date) || 0) - (Date.parse(a.date) || 0))
    .slice(0, 6);
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
              <button
                type="button"
                onClick={() => onNavigate("relatorios")}
                className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-3 text-xs font-bold text-[#cae7ef] transition hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cyan-200"
              >
                Configurar relatório <ArrowUpRight className="h-4 w-4" />
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

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <section className="nexo-surface rounded-[22px] p-5 sm:p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="nexo-eyebrow">Acesso rápido</p>
              <h2 className="mt-1.5 text-[17px] font-extrabold tracking-[-.02em] text-[#12334a]">
                Cadastros recentes
              </h2>
            </div>
            <span className="rounded-lg bg-[#f0f5f8] px-2.5 py-1.5 text-[11px] text-[#567184]">
              Por data de criação
            </span>
          </div>
          <div className="mt-4 divide-y divide-[#edf2f5]">
            {recent.map((item) => (
              <button
                type="button"
                key={`${item.kind}:${item.id}`}
                onClick={() => onOpen({ kind: item.kind, id: item.id })}
                className="group flex w-full items-center gap-3 rounded-xl px-2 py-3.5 text-left transition hover:bg-[#f0f6f8]"
              >
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-[#dbe9ef] bg-[#edf5f8]"
                  style={{ color: item.color }}
                >
                  {item.photo ? (
                    <img src={item.photo} alt="" className="h-full w-full object-cover" />
                  ) : item.kind === "person" ? (
                    <UsersRound className="h-5 w-5" />
                  ) : (
                    <Building2 className="h-5 w-5" />
                  )}
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block truncate text-[13px] font-bold text-[#23465e]">
                    {item.name}
                  </strong>
                  <span className="mt-1 block truncate text-xs text-[#567184]">{item.detail}</span>
                </span>
                {Number.isFinite(Date.parse(item.date)) ? (
                  <time
                    dateTime={item.date}
                    className="hidden text-[11px] tabular-nums text-[#567184] sm:block"
                  >
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      timeZone: "America/Sao_Paulo",
                    }).format(new Date(item.date))}
                  </time>
                ) : null}
                <ArrowRight className="h-4 w-4 text-[#8ea8b7] transition group-hover:translate-x-0.5 group-hover:text-[#168aa1]" />
              </button>
            ))}
            {!recent.length ? (
              <div className="nexo-empty-state py-10 text-center text-sm text-[#567184]">
                Nenhum cadastro ainda. Comece por uma pessoa ou facção.
              </div>
            ) : null}
          </div>
        </section>
        <div className="space-y-5">
          <section className="nexo-surface rounded-[22px] p-5 sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="nexo-eyebrow">Cobertura cadastral</p>
                <h2 className="mt-1.5 flex items-center gap-2 text-[17px] font-extrabold tracking-[-.02em] text-[#12334a]">
                  <ClipboardCheck className="h-4 w-4 text-[#168aa1]" aria-hidden />
                  Pendências cadastrais
                </h2>
              </div>
              <span className="rounded-full bg-[#eef7f8] px-2.5 py-1 text-[11px] font-bold tabular-nums text-[#1e6076]">
                {pendingTotal} item(ns)
              </span>
            </div>
            <p className="mt-2 text-xs leading-6 text-[#567184]">
              Ausência de informação é apresentada como revisão ou recomendação, nunca como fato
              negativo.
            </p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {pendingCategories.map((category) => (
                <button
                  key={category.category}
                  type="button"
                  onClick={() => {
                    setSelectedPendingCategory(category.category);
                    setPendingQuery("");
                  }}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                    selectedPendingCategory === category.category
                      ? "border-[#78b8c6] bg-[#edf7f9]"
                      : "border-[#e4edf2] bg-[#f6f9fb] hover:border-[#c7dfe7] hover:bg-[#edf6f8]"
                  }`}
                >
                  <strong className="min-w-7 text-lg font-extrabold tabular-nums text-[#1e6076]">
                    {category.items.length}
                  </strong>
                  <span className="min-w-0 flex-1 text-xs font-semibold leading-5 text-[#385c73]">
                    {category.label}
                  </span>
                  {category.items.length ? (
                    <Filter className="h-3.5 w-3.5 text-[#7a9eac]" aria-hidden />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                  )}
                </button>
              ))}
            </div>
            {selectedPending ? (
              <div className="mt-4 border-t border-[#edf2f5] pt-4">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs leading-5 text-[#567184]">{selectedPending.description}</p>
                  <label className="sr-only" htmlFor="nexo-pending-search">
                    Pesquisar pendências
                  </label>
                  <input
                    id="nexo-pending-search"
                    value={pendingQuery}
                    onChange={(event) => setPendingQuery(event.target.value)}
                    placeholder="Pesquisar"
                    className="h-9 w-32 rounded-lg border border-[#d9e5ed] bg-white px-2.5 text-xs text-[#18384f] outline-none focus:border-[#33a0b4] sm:w-40"
                  />
                </div>
                <div className="mt-3 max-h-56 space-y-2 overflow-y-auto pr-1">
                  {filteredPendingItems.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onOpen({ kind: "person", id: item.personId })}
                      className="group flex w-full items-start gap-3 rounded-xl border border-[#e4edf2] bg-white px-3 py-2.5 text-left transition hover:border-[#9bc8d2] hover:bg-[#f5fbfc]"
                    >
                      <span className="mt-0.5 shrink-0 text-[#168aa1]">
                        <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-bold text-[#23465e]">
                          {item.title}
                        </span>
                        <span className="mt-1 block text-[11px] leading-4 text-[#698294]">
                          {item.detail}
                        </span>
                      </span>
                      <span
                        className={`shrink-0 rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wide ${
                          item.severity === "obrigatoria"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-[#edf4f7] text-[#567184]"
                        }`}
                      >
                        {item.severity === "obrigatoria" ? "Revisar" : "Recomendação"}
                      </span>
                    </button>
                  ))}
                  {!filteredPendingItems.length ? (
                    <div className="flex items-center gap-2 rounded-xl bg-[#f6f9fb] px-3 py-4 text-xs text-[#567184]">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />
                      Nenhuma pendência nesta categoria para a pesquisa atual.
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
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
                {activeLinks.length} vínculos atuais registrados. Status e fontes permanecem
                visíveis.
              </span>
            </span>
            <ArrowUpRight className="h-4 w-4 text-[#438ba0]" />
          </button>
        </div>
      </div>
      <p className="mt-5 max-w-5xl text-[11px] leading-6 text-[#567184]">
        Contagens limitadas aos registros disponíveis neste ambiente. Procedimentos são deduplicados
        pelo identificador de B.O. ou inquérito; não representam o total de crimes.
      </p>
    </section>
  );
}
