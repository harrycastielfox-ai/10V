import {
  ArrowRight,
  Building2,
  Camera,
  ChevronDown,
  Crown,
  FileText,
  FilterX,
  LayoutGrid,
  Link2,
  List,
  MapPin,
  Plus,
  Search,
  SlidersHorizontal,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  activeDirectoryLinks,
  directoryPersonLocation,
  EMPTY_ORGANIZATION_DIRECTORY_FILTERS,
  EMPTY_PEOPLE_DIRECTORY_FILTERS,
  filterDirectoryOrganizations,
  filterDirectoryPeople,
  hasDirectoryPhoto,
  isDirectoryLeadershipLink,
  organizationDirectoryStats,
  uniqueDirectoryProcedureCount,
  type NexoOrganizationDirectoryFilters,
  type NexoPeopleDirectoryFilters,
} from "../nexoDirectoryFilters";
import { getNexoPersonPhotoUrl } from "../nexoSelectors";
import type {
  NexoOrganizacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoTerritorio,
  NexoVinculoStatus,
} from "../nexoTypes";

export interface NexoDirectoryPanelProps {
  kind: "people" | "organizations";
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
  territories: NexoTerritorio[];
  records: NexoRegistroVinculado[];
  onOpen: (target: { kind: "person" | "organization"; id: string }) => void;
  onCreatePerson: () => void;
  onCreateOrganization: () => void;
}

const fieldClass =
  "h-11 w-full rounded-xl border border-[#ccdbe4] bg-[#fbfdfe] px-3 text-xs font-semibold text-[#28485e] outline-none transition hover:border-[#9db8c8] focus:border-[#168aa1] focus:bg-white focus:ring-2 focus:ring-[#168aa1]/15 disabled:cursor-not-allowed disabled:opacity-60";
const STATUS_LABELS: Record<NexoOrganizacao["status"], string> = {
  monitoramento: "Em monitoramento",
  ativa: "Ativa",
  inativa: "Inativa",
  indeterminada: "Indeterminada",
};
const RISK_LABELS: Record<NexoOrganizacao["nivel_risco"], string> = {
  baixo: "Baixo",
  moderado: "Moderado",
  alto: "Alto",
  critico: "Crítico",
};
const LINK_STATUS_LABELS: Record<NexoVinculoStatus, string> = {
  confirmado: "Confirmado",
  provavel: "Provável",
  suspeito: "Suspeito",
  nao_confirmado: "Não confirmado",
  desvinculado: "Desvinculado",
};

function safeColor(value: string) {
  return /^#[\da-f]{6}$/i.test(value) ? value : "#238aa1";
}

function FilterField({
  label,
  children,
  active = false,
}: {
  label: string;
  children: ReactNode;
  active?: boolean;
}) {
  return (
    <label
      className={`block min-w-0 text-[11px] font-bold uppercase tracking-[.07em] ${active ? "text-[#11788c]" : "text-[#567184]"}`}
    >
      {label}
      <span
        className={`mt-1.5 block font-normal normal-case tracking-normal ${active ? "[&_input]:border-[#64aebe] [&_input]:bg-[#f0f9fb] [&_select]:border-[#64aebe] [&_select]:bg-[#f0f9fb]" : ""}`}
      >
        {children}
      </span>
    </label>
  );
}

function DirectoryMetric({
  label,
  value,
  icon,
}: {
  label: string;
  value: number;
  icon: ReactNode;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-[#d5e1e9] bg-white px-4 py-4 shadow-[0_2px_3px_-2px_#12334a0a]">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-[#d6eaf0] bg-[#eff8fa] text-[#168aa1]">
        {icon}
      </span>
      <div>
        <strong className="block text-2xl font-black leading-none tracking-tight text-[#12334a]">
          {value}
        </strong>
        <span className="mt-1.5 block text-xs font-medium text-[#567184]">{label}</span>
      </div>
    </div>
  );
}

function PersonPhoto({ person }: { person: NexoPessoa }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const url = getNexoPersonPhotoUrl(person);
  return (
    <span className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-[#c7dce6] bg-[#edf5f8] text-[#168aa1] shadow-[0_2px_4px_-2px_#12334a24]">
      {url && url !== failedUrl ? (
        <img
          src={url}
          alt={`Fotografia de ${person.nome}`}
          className="h-full w-full object-cover"
          loading="lazy"
          onError={() => setFailedUrl(url)}
        />
      ) : (
        <UserRound className="h-6 w-6" />
      )}
    </span>
  );
}

function PersonCard({
  person,
  organizations,
  territories,
  procedureCount,
  compact,
  onOpen,
}: {
  person: NexoPessoa;
  organizations: NexoOrganizacao[];
  territories: NexoTerritorio[];
  procedureCount: number;
  compact: boolean;
  onOpen: () => void;
}) {
  const links = activeDirectoryLinks(person);
  const leadership = links.some(isDirectoryLeadershipLink);
  const location = directoryPersonLocation(person, territories);
  const linksWithOrganizations = links.map((link) => ({
    link,
    organization: organizations.find((organization) => organization.id === link.organizacao_id),
  }));
  const locationLabel =
    location === "own"
      ? [person.endereco?.bairro, person.endereco?.municipio, person.endereco?.uf]
          .filter(Boolean)
          .join(" · ") || "Endereço cadastrado"
      : location === "organization"
        ? "Usa local da facção"
        : "Sem local cadastrado";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative w-full overflow-hidden rounded-[20px] border bg-white text-left transition duration-200 hover:-translate-y-0.5 hover:border-[#6fa8ba] hover:shadow-[0_10px_24px_-16px_#12334a50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] focus-visible:ring-offset-2 ${leadership ? "border-[#a8ccd6] shadow-[0_3px_10px_-7px_#168aa150]" : "border-[#d5e1e9] shadow-[0_2px_3px_-2px_#12334a0a]"} ${compact ? "p-4" : "p-5"}`}
      aria-label={`Abrir ficha de ${person.nome}`}
    >
      {leadership ? (
        <span className="absolute inset-y-5 left-0 w-[3px] rounded-r-full bg-[#168aa1]" />
      ) : null}
      <span
        className={`flex gap-3 ${compact ? "flex-wrap sm:flex-nowrap sm:items-center" : "items-start"}`}
      >
        <PersonPhoto person={person} />
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <strong className="break-words text-[15px] font-bold leading-snug tracking-[-.015em] text-[#12334a] group-hover:text-[#11788c]">
              {person.nome}
            </strong>
            {leadership ? (
              <span className="inline-flex items-center gap-1 rounded-md border border-[#c2e1e8] bg-[#eaf7fa] px-2 py-1 text-[11px] font-bold leading-none text-[#11788c]">
                <Crown className="h-3 w-3" /> Função de liderança
              </span>
            ) : null}
          </span>
          <span className="mt-1.5 block text-xs text-[#567184]">
            {person.apelido
              ? `“${person.apelido}”`
              : person.nome_social || "Sem alcunha registrada"}
          </span>
          <span className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[11px] leading-relaxed text-[#567184]">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3 w-3" /> {locationLabel}
            </span>
            {hasDirectoryPhoto(person) ? (
              <span className="inline-flex items-center gap-1.5">
                <Camera className="h-3 w-3" /> Foto registrada
              </span>
            ) : null}
          </span>
        </span>
        {compact ? (
          <span className="hidden shrink-0 rounded-lg bg-[#f1f5f8] px-2.5 py-1.5 text-[11px] font-semibold text-[#567184] sm:block">
            {procedureCount} procedimento(s)
          </span>
        ) : null}
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[#7192a4] transition group-hover:translate-x-0.5 group-hover:text-[#168aa1]" />
      </span>
      <span
        className={`mt-4 block border-t border-[#e6edf2] pt-3 ${compact ? "sm:ml-[76px]" : ""}`}
      >
        {linksWithOrganizations.length ? (
          <span className="flex flex-wrap gap-1.5">
            {linksWithOrganizations.slice(0, compact ? 3 : 2).map(({ link, organization }) => (
              <span
                key={link.id}
                className="inline-flex max-w-full items-center gap-1.5 rounded-lg border border-[#e0e9ef] bg-[#f5f8fa] px-2 py-1.5 text-[11px] font-medium text-[#36586c]"
                title={`${organization?.nome || "Facção vinculada"} · ${LINK_STATUS_LABELS[link.status]}${link.funcao ? ` · ${link.funcao}` : ""}`}
              >
                <i
                  className="h-2 w-2 shrink-0 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: safeColor(organization?.cor || "#238aa1") }}
                />
                <span className="truncate">
                  {organization?.nome || link.organizacao?.nome || "Facção vinculada"}
                </span>
                <span className="text-[#567184]">· {LINK_STATUS_LABELS[link.status]}</span>
              </span>
            ))}
            {linksWithOrganizations.length > (compact ? 3 : 2) ? (
              <span className="px-1 py-1.5 text-[11px] text-[#567184]">
                +{linksWithOrganizations.length - (compact ? 3 : 2)} vínculo(s)
              </span>
            ) : null}
          </span>
        ) : (
          <span className="text-[11px] text-[#567184]">Sem vínculo atual com facção</span>
        )}
        {!compact ? (
          <span className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="inline-flex items-center gap-1.5 text-[#567184]">
              <FileText className="h-3 w-3" /> {procedureCount} procedimento(s) vinculado(s)
            </span>
            <span className="font-bold text-[#11788c]">Abrir ficha</span>
          </span>
        ) : null}
      </span>
    </button>
  );
}

export function NexoDirectoryPanel({
  kind,
  organizations,
  people,
  territories,
  records,
  onOpen,
  onCreatePerson,
  onCreateOrganization,
}: NexoDirectoryPanelProps) {
  const [personFilters, setPersonFilters] = useState<NexoPeopleDirectoryFilters>({
    ...EMPTY_PEOPLE_DIRECTORY_FILTERS,
  });
  const [organizationFilters, setOrganizationFilters] = useState<NexoOrganizationDirectoryFilters>({
    ...EMPTY_ORGANIZATION_DIRECTORY_FILTERS,
  });
  const [layout, setLayout] = useState<"cards" | "list">("cards");
  const [visibleCount, setVisibleCount] = useState(18);
  const isPeople = kind === "people";
  const listedPeople = useMemo(
    () => filterDirectoryPeople(people, territories, personFilters),
    [people, territories, personFilters],
  );
  const listedOrganizations = useMemo(
    () => filterDirectoryOrganizations(organizations, people, organizationFilters),
    [organizations, people, organizationFilters],
  );
  const organizationStats = useMemo(
    () =>
      new Map(
        organizations.map((organization) => [
          organization.id,
          organizationDirectoryStats(organization.id, people, territories, records),
        ]),
      ),
    [organizations, people, territories, records],
  );
  const linkedPeople = people.filter((person) => activeDirectoryLinks(person).length > 0).length;
  const leaders = people.filter((person) =>
    activeDirectoryLinks(person).some(isDirectoryLeadershipLink),
  ).length;
  const photoCount = people.filter(hasDirectoryPhoto).length;
  const resultCount = isPeople ? listedPeople.length : listedOrganizations.length;
  const totalCount = isPeople ? people.length : organizations.length;
  const query = isPeople ? personFilters.query : organizationFilters.query;
  const create = isPeople ? onCreatePerson : onCreateOrganization;
  const activeFilterCount = isPeople
    ? Object.entries(personFilters).filter(
        ([key, value]) =>
          value !== EMPTY_PEOPLE_DIRECTORY_FILTERS[key as keyof NexoPeopleDirectoryFilters],
      ).length
    : Object.entries(organizationFilters).filter(
        ([key, value]) =>
          value !==
          EMPTY_ORGANIZATION_DIRECTORY_FILTERS[key as keyof NexoOrganizationDirectoryFilters],
      ).length;

  function updatePerson<K extends keyof NexoPeopleDirectoryFilters>(
    key: K,
    value: NexoPeopleDirectoryFilters[K],
  ) {
    setPersonFilters((current) => ({ ...current, [key]: value }));
    setVisibleCount(18);
  }

  function updateOrganization<K extends keyof NexoOrganizationDirectoryFilters>(
    key: K,
    value: NexoOrganizationDirectoryFilters[K],
  ) {
    setOrganizationFilters((current) => ({ ...current, [key]: value }));
    setVisibleCount(18);
  }

  function clear() {
    if (isPeople) setPersonFilters({ ...EMPTY_PEOPLE_DIRECTORY_FILTERS });
    else setOrganizationFilters({ ...EMPTY_ORGANIZATION_DIRECTORY_FILTERS });
    setVisibleCount(18);
  }

  return (
    <section
      className="space-y-5 pb-12 pt-8 sm:pt-10"
      aria-label={isPeople ? "Diretório de pessoas" : "Diretório de facções"}
    >
      <div className="relative overflow-hidden rounded-[24px] border border-[#d1dfe8] bg-white px-5 py-6 shadow-[0_3px_12px_-10px_#12334a30] sm:px-7 sm:py-7">
        <div className="absolute inset-y-7 left-0 w-1 rounded-r-full bg-[#168aa1]" />
        <div className="relative flex flex-wrap items-start justify-between gap-5">
          <div className="max-w-2xl">
            <p className="text-[11px] font-bold uppercase tracking-[.18em] text-[#168aa1]">
              NEXO / Diretório
            </p>
            <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-.035em] text-[#12334a] sm:text-[32px]">
              {isPeople ? "Pessoas e vínculos" : "Facções cadastradas"}
            </h1>
            <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-[#567184]">
              {isPeople
                ? "Encontre uma ficha por nome, alcunha ou documento. Refine por vínculo atual, função, fotografia e local cadastrado."
                : "Consulte os grupos, seus integrantes atuais e os registros associados. A classificação de risco exibida é a informada no cadastro."}
            </p>
          </div>
          <button
            type="button"
            onClick={create}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#12334a] bg-[#12334a] px-4 py-3 text-xs font-bold text-white shadow-[0_4px_9px_-5px_#12334a70] transition hover:border-[#1b536b] hover:bg-[#1b536b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" /> {isPeople ? "Cadastrar pessoa" : "Cadastrar facção"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <DirectoryMetric
          icon={isPeople ? <UsersRound className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
          value={totalCount}
          label={isPeople ? "Pessoas cadastradas" : "Facções cadastradas"}
        />
        <DirectoryMetric
          icon={isPeople ? <Link2 className="h-4 w-4" /> : <UsersRound className="h-4 w-4" />}
          value={
            isPeople
              ? linkedPeople
              : organizations.filter(
                  (organization) => organizationStats.get(organization.id)!.members > 0,
                ).length
          }
          label={isPeople ? "Com vínculo atual" : "Com integrantes atuais"}
        />
        <DirectoryMetric
          icon={isPeople ? <Camera className="h-4 w-4" /> : <MapPin className="h-4 w-4" />}
          value={isPeople ? photoCount : new Set(territories.map((territory) => territory.id)).size}
          label={isPeople ? "Com fotografia registrada" : "Territórios registrados"}
        />
      </div>

      {isPeople ? (
        <div className="overflow-hidden rounded-[20px] border border-[#d1dfe8] bg-white shadow-[0_2px_3px_-2px_#12334a0a]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#e1e9ef] bg-[#f8fafc] px-4 py-3.5 sm:px-5">
            <div className="flex items-center gap-2 text-xs font-bold text-[#28485e]">
              <SlidersHorizontal className="h-4 w-4 text-[#168aa1]" />
              Busca e filtros
              {activeFilterCount > 0 ? (
                <span className="rounded-md border border-[#c5e2e9] bg-[#eaf7fa] px-2 py-1 text-[11px] font-semibold text-[#11788c]">
                  {activeFilterCount} ativo(s)
                </span>
              ) : null}
            </div>
            <button
              type="button"
              onClick={clear}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-[#d5e1e9] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#36586c] transition hover:border-[#9db8c8] hover:text-[#11788c] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1]"
            >
              <FilterX className="h-3.5 w-3.5" /> Limpar filtros
            </button>
          </div>
          <div className="p-4 sm:p-5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[200px] flex-1">
                <FilterField label="Busca no diretório" active={query !== ""}>
                  <span className="relative block">
                    <Search className="pointer-events-none absolute left-3 top-3.5 h-4 w-4 text-[#567184]" />
                    <input
                      value={query}
                      onChange={(event) =>
                        isPeople
                          ? updatePerson("query", event.target.value)
                          : updateOrganization("query", event.target.value)
                      }
                      placeholder={
                        isPeople ? "Nome, alcunha, CPF, RG..." : "Nome, sigla ou área de atuação..."
                      }
                      className={`${fieldClass} pl-9`}
                    />
                  </span>
                </FilterField>
              </div>
            </div>
            {isPeople ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                <FilterField
                  label="Facção do vínculo atual"
                  active={personFilters.organizationId !== ""}
                >
                  <select
                    value={personFilters.organizationId}
                    onChange={(event) => updatePerson("organizationId", event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">Todas as facções</option>
                    {[...organizations]
                      .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))
                      .map((organization) => (
                        <option key={organization.id} value={organization.id}>
                          {organization.nome}
                        </option>
                      ))}
                  </select>
                </FilterField>
                <FilterField label="Vínculo com facção" active={personFilters.link !== "all"}>
                  <select
                    value={personFilters.link}
                    onChange={(event) =>
                      updatePerson("link", event.target.value as NexoPeopleDirectoryFilters["link"])
                    }
                    className={fieldClass}
                  >
                    <option value="all">Todos</option>
                    <option value="linked">Com vínculo atual</option>
                    <option value="unlinked">Sem vínculo atual</option>
                  </select>
                </FilterField>
                <FilterField label="Fotografia" active={personFilters.photo !== "all"}>
                  <select
                    value={personFilters.photo}
                    onChange={(event) =>
                      updatePerson(
                        "photo",
                        event.target.value as NexoPeopleDirectoryFilters["photo"],
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="all">Todas</option>
                    <option value="with">Com foto registrada</option>
                    <option value="without">Sem foto registrada</option>
                  </select>
                </FilterField>
                <FilterField label="Local cadastrado" active={personFilters.location !== "all"}>
                  <select
                    value={personFilters.location}
                    onChange={(event) =>
                      updatePerson(
                        "location",
                        event.target.value as NexoPeopleDirectoryFilters["location"],
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="all">Todos</option>
                    <option value="own">Endereço próprio</option>
                    <option value="organization">Usa local da facção</option>
                    <option value="missing">Sem local cadastrado</option>
                  </select>
                </FilterField>
                <FilterField label="Ordenação" active={personFilters.sort !== "name"}>
                  <select
                    value={personFilters.sort}
                    onChange={(event) =>
                      updatePerson("sort", event.target.value as NexoPeopleDirectoryFilters["sort"])
                    }
                    className={fieldClass}
                  >
                    <option value="name">Nome · A–Z</option>
                    <option value="recent">Cadastros recentes</option>
                  </select>
                </FilterField>
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                <FilterField
                  label="Situação registrada"
                  active={organizationFilters.status !== "all"}
                >
                  <select
                    value={organizationFilters.status}
                    onChange={(event) =>
                      updateOrganization(
                        "status",
                        event.target.value as NexoOrganizationDirectoryFilters["status"],
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="all">Todas</option>
                    {Object.entries(STATUS_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField
                  label="Risco informado no cadastro"
                  active={organizationFilters.risk !== "all"}
                >
                  <select
                    value={organizationFilters.risk}
                    onChange={(event) =>
                      updateOrganization(
                        "risk",
                        event.target.value as NexoOrganizationDirectoryFilters["risk"],
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="all">Todos</option>
                    {Object.entries(RISK_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </FilterField>
                <FilterField label="Ordenação" active={organizationFilters.sort !== "name"}>
                  <select
                    value={organizationFilters.sort}
                    onChange={(event) =>
                      updateOrganization(
                        "sort",
                        event.target.value as NexoOrganizationDirectoryFilters["sort"],
                      )
                    }
                    className={fieldClass}
                  >
                    <option value="name">Nome · A–Z</option>
                    <option value="members">Mais integrantes atuais</option>
                    <option value="recent">Cadastros recentes</option>
                  </select>
                </FilterField>
              </div>
            )}
            {isPeople ? (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-[#e6edf2] pt-4">
                <button
                  type="button"
                  aria-pressed={personFilters.leadership}
                  onClick={() => updatePerson("leadership", !personFilters.leadership)}
                  className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 py-2 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] focus-visible:ring-offset-2 ${personFilters.leadership ? "border-[#168aa1] bg-[#168aa1] text-white shadow-[0_2px_5px_-3px_#168aa190]" : "border-[#ccdbe4] bg-white text-[#36586c] hover:border-[#64aebe] hover:bg-[#f0f9fb]"}`}
                >
                  <Crown className="h-3.5 w-3.5" /> Funções de liderança{" "}
                  <span
                    className={`rounded px-1.5 py-0.5 ${personFilters.leadership ? "bg-white/15" : "bg-[#edf3f7]"}`}
                  >
                    {leaders}
                  </span>
                </button>
                <p className="text-[11px] text-[#567184]">
                  Considera a função informada em vínculos atuais.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p role="status" className="text-xs text-[#567184]">
          <strong className="font-bold text-[#12334a]">{resultCount}</strong> de {totalCount}{" "}
          {isPeople ? "pessoa(s)" : "facção(ões)"}
        </p>
        {isPeople ? (
          <div
            className="inline-flex rounded-xl border border-[#ccdbe4] bg-white p-1"
            role="group"
            aria-label="Apresentação dos resultados"
          >
            {(
              [
                { key: "cards", label: "Cartões", icon: LayoutGrid },
                { key: "list", label: "Lista", icon: List },
              ] as const
            ).map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                aria-pressed={layout === key}
                onClick={() => setLayout(key)}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] ${layout === key ? "bg-[#12334a] text-white shadow-sm" : "text-[#567184] hover:bg-[#edf3f7]"}`}
              >
                <Icon className="h-3.5 w-3.5" /> {label}
              </button>
            ))}
          </div>
        ) : (
          <span className="text-[11px] text-[#567184]">
            Contagens de procedimentos sem repetir o mesmo registro
          </span>
        )}
      </div>

      {resultCount ? (
        <div
          className={
            isPeople && layout === "list"
              ? "space-y-3"
              : "grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {isPeople
            ? listedPeople
                .slice(0, visibleCount)
                .map((person) => (
                  <PersonCard
                    key={person.id}
                    person={person}
                    organizations={organizations}
                    territories={territories}
                    procedureCount={uniqueDirectoryProcedureCount(
                      records.filter((record) => record.pessoa_id === person.id),
                    )}
                    compact={layout === "list"}
                    onOpen={() => onOpen({ kind: "person", id: person.id })}
                  />
                ))
            : listedOrganizations.slice(0, visibleCount).map((organization) => {
                const stats = organizationStats.get(organization.id)!;
                const color = safeColor(organization.cor);
                return (
                  <button
                    key={organization.id}
                    type="button"
                    onClick={() => onOpen({ kind: "organization", id: organization.id })}
                    className="group flex h-full w-full flex-col overflow-hidden rounded-[20px] border border-[#d1dfe8] bg-white text-left shadow-[0_2px_3px_-2px_#12334a0a] transition duration-200 hover:-translate-y-0.5 hover:border-[#6fa8ba] hover:shadow-[0_10px_24px_-16px_#12334a50] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] focus-visible:ring-offset-2"
                    aria-label={`Abrir dossiê de ${organization.nome}`}
                  >
                    <span
                      className="relative block w-full border-b border-[#e5edf2] px-5 py-5"
                      style={{ background: `linear-gradient(115deg, ${color}1c, ${color}06)` }}
                    >
                      <span
                        className="absolute inset-x-0 top-0 h-1.5"
                        style={{ backgroundColor: color }}
                      />
                      <span className="flex items-start justify-between gap-3">
                        <span className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-[#d5e1e9] bg-white text-[#12334a] shadow-[0_3px_8px_-5px_#12334a40]">
                          <Building2 className="h-6 w-6" />
                          <i
                            className="absolute -bottom-1 -right-1 h-3.5 w-3.5 rounded-full border-2 border-white ring-1 ring-black/10"
                            style={{ backgroundColor: color }}
                          />
                        </span>
                        <span className="rounded-md border border-[#d1dfe8] bg-white/95 px-2.5 py-1.5 text-[11px] font-semibold leading-none text-[#36586c]">
                          {STATUS_LABELS[organization.status]}
                        </span>
                      </span>
                      <strong className="mt-4 block text-lg font-bold leading-snug tracking-[-.02em] text-[#12334a] group-hover:text-[#11788c]">
                        {organization.nome}
                      </strong>
                      <span className="mt-1.5 block text-[11px] font-medium leading-relaxed text-[#567184]">
                        {organization.sigla || "Sem sigla"} · Risco registrado:{" "}
                        {RISK_LABELS[organization.nivel_risco]}
                      </span>
                    </span>
                    <span className="flex flex-1 flex-col px-5 pb-5 pt-4">
                      <span className="mb-4 line-clamp-2 min-h-10 text-xs leading-relaxed text-[#567184]">
                        {organization.area_atuacao ||
                          organization.descricao ||
                          "Área de atuação ainda não informada."}
                      </span>
                      <span className="grid grid-cols-3 gap-2 rounded-xl border border-[#e1e9ef] bg-[#f7f9fb] px-3 py-3.5">
                        <span>
                          <strong className="block text-xl font-bold leading-none text-[#12334a]">
                            {stats.members}
                          </strong>
                          <span className="mt-1.5 block text-[11px] leading-snug text-[#567184]">
                            Integrantes atuais
                          </span>
                        </span>
                        <span>
                          <strong className="block text-xl font-bold leading-none text-[#12334a]">
                            {stats.territories}
                          </strong>
                          <span className="mt-1.5 block text-[11px] leading-snug text-[#567184]">
                            Territórios
                          </span>
                        </span>
                        <span title="Procedimentos associados diretamente à facção ou aos integrantes atuais">
                          <strong className="block text-xl font-bold leading-none text-[#12334a]">
                            {stats.procedures}
                          </strong>
                          <span className="mt-1.5 block text-[11px] leading-snug text-[#567184]">
                            Procedimentos
                          </span>
                        </span>
                      </span>
                      <span className="mt-4 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t border-[#e6edf2] pt-3 text-[11px]">
                        <span className="inline-flex items-center gap-1.5 text-[#567184]">
                          <Crown className="h-3.5 w-3.5" /> {stats.leaders} função(ões) de liderança
                        </span>
                        <span className="inline-flex items-center gap-1.5 font-bold text-[#11788c]">
                          Abrir dossiê{" "}
                          <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
                        </span>
                      </span>
                    </span>
                  </button>
                );
              })}
        </div>
      ) : (
        <div className="rounded-[20px] border border-dashed border-[#b9cdd9] bg-white px-5 py-12 text-center">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#d1e6ed] bg-[#edf7fa] text-[#168aa1]">
            {isPeople ? <UsersRound className="h-6 w-6" /> : <Building2 className="h-6 w-6" />}
          </span>
          <h2 className="mt-4 text-base font-bold tracking-[-.01em] text-[#12334a]">
            {totalCount
              ? "Nenhum resultado neste recorte"
              : isPeople
                ? "Nenhuma pessoa cadastrada"
                : "Nenhuma facção cadastrada"}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-xs leading-relaxed text-[#567184]">
            {totalCount
              ? "Ajuste os filtros ou limpe a busca para consultar os demais registros."
              : "Comece um cadastro para organizar os vínculos e acessar o dossiê."}
          </p>
          <button
            type="button"
            onClick={totalCount ? clear : create}
            className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-[#12334a] px-4 py-2.5 text-xs font-bold text-white transition hover:bg-[#1b536b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] focus-visible:ring-offset-2"
          >
            {totalCount ? <FilterX className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {totalCount ? "Limpar filtros" : isPeople ? "Cadastrar pessoa" : "Cadastrar facção"}
          </button>
        </div>
      )}
      {resultCount > visibleCount ? (
        <div className="text-center">
          <button
            type="button"
            onClick={() => setVisibleCount((count) => count + 18)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[#ccdbe4] bg-white px-5 py-2.5 text-xs font-semibold text-[#36586c] transition hover:border-[#64aebe] hover:bg-[#f0f9fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#168aa1] focus-visible:ring-offset-2"
          >
            Mostrar mais {Math.min(18, resultCount - visibleCount)}{" "}
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}
    </section>
  );
}
