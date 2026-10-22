import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FileText,
  FilterX,
  Link2,
  Network,
  ShieldCheck,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import {
  activeDirectoryLinks,
  hasDirectoryPhoto,
  normalizeDirectoryText,
  uniqueDirectoryProcedureCount,
} from "../nexoDirectoryFilters";
import { getNexoPersonPhotoUrl } from "../nexoSelectors";
import {
  buildNexoPersonIntelligenceSummary,
  type NexoPersonIntelligenceSummary,
} from "../nexoIntelligenceSummary";
import type {
  NexoOrganizacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoTerritorio,
  NexoVinculoStatus,
} from "../nexoTypes";

type DossierTarget = { kind: "person"; id: string } | { kind: "organization"; id: string };

const STATUS_LABELS = {
  confirmado: "Confirmado",
  provavel: "Provável",
  suspeito: "Suspeito",
  nao_confirmado: "Não confirmado",
  desvinculado: "Desvinculado",
};

const TIMELINE_DATE_LABELS = {
  registro: "Data de registro",
  documento: "Data do documento",
  vinculo: "Data do vínculo",
} as const;

export function NexoIntelligenceBoard({
  organizations,
  people,
  territories,
  records,
  onOpen,
}: {
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
  territories: NexoTerritorio[];
  records: NexoRegistroVinculado[];
  onOpen: (target: DossierTarget) => void;
}) {
  const [query, setQuery] = useState("");
  const [faction, setFaction] = useState("");
  const [status, setStatus] = useState<"all" | Exclude<NexoVinculoStatus, "desvinculado">>("all");
  const [focusedPersonId, setFocusedPersonId] = useState<string | null>(null);
  const [summaryPersonId, setSummaryPersonId] = useState<string | null>(null);
  const links = people.flatMap((person) =>
    activeDirectoryLinks(person).map((link) => ({ ...link, person })),
  );
  const search = normalizeDirectoryText(query);
  const network = useMemo(
    () =>
      organizations
        .filter((organization) => !faction || organization.id === faction)
        .map((organization) => {
          const organizationMatches = normalizeDirectoryText(
            `${organization.nome} ${organization.sigla || ""}`,
          ).includes(search);
          const members = people
            .filter((person) => {
              const related = activeDirectoryLinks(person).filter(
                (link) =>
                  link.organizacao_id === organization.id &&
                  (status === "all" || link.status === status),
              );
              return (
                related.length > 0 &&
                (!search ||
                  organizationMatches ||
                  normalizeDirectoryText(
                    [
                      person.nome,
                      person.apelido,
                      person.nome_social,
                      ...related.map((link) => link.funcao),
                    ].join(" "),
                  ).includes(search))
              );
            })
            .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
          return { organization, members, organizationMatches };
        })
        .filter(
          (item) =>
            item.members.length > 0 ||
            (!search && status === "all") ||
            (item.organizationMatches && status === "all"),
        ),
    [organizations, people, faction, search, status],
  );
  const scopedLinks = links.filter(
    (link) =>
      network.some(
        (item) =>
          item.organization.id === link.organizacao_id &&
          item.members.some((member) => member.id === link.person.id),
      ) &&
      (status === "all" || link.status === status),
  );
  const focusedPerson = people.find(
    (person) =>
      person.id === focusedPersonId &&
      network.some((item) => item.members.some((member) => member.id === person.id)),
  );
  const unlinkedPeople = people.filter((person) => !activeDirectoryLinks(person).length);
  const pendingLinks = links.filter(
    (link) => link.status !== "confirmado" && link.status !== "desvinculado",
  );
  const lowConfidenceTerritories = territories.filter((territory) => territory.confianca < 70);
  const averageConfidence = scopedLinks.length
    ? `${Math.round(scopedLinks.reduce((total, link) => total + link.confianca, 0) / scopedLinks.length)}%`
    : "—";

  const events = [
    ...organizations.map((item) => ({
      id: `org-${item.id}`,
      date: item.created_at,
      title: `Facção cadastrada: ${item.nome}`,
      kind: "Facção",
    })),
    ...people.map((item) => ({
      id: `person-${item.id}`,
      date: item.created_at,
      title: `Pessoa cadastrada: ${item.nome}`,
      kind: "Pessoa",
    })),
    ...territories.map((item) => ({
      id: `territory-${item.id}`,
      date: item.created_at,
      title: `Território relacionado: ${item.bairro || item.ponto_referencia || "sem identificação"}`,
      kind: "Território",
    })),
    ...records.map((item) => ({
      id: `record-${item.id}`,
      date: item.created_at,
      title: item.inquerito_id
        ? `Inquérito vinculado: ${item.inquerito?.numero_ppe || "sem número"}`
        : `B.O. vinculado: ${item.bo?.numero_bo || "sem número"}`,
      kind: item.inquerito_id ? "Inquérito" : "B.O.",
    })),
  ]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 8);

  return (
    <section className="pb-16 pt-8 sm:pt-10">
      <div className="nexo-page-heading">
        <div>
          <p className="nexo-eyebrow">Leitura integrada</p>
          <h1 className="nexo-title">Inteligência relacional</h1>
          <p className="nexo-description">
            Panorama dos vínculos conhecidos, lacunas de informação e registros associados aos
            núcleos monitorados.
          </p>
        </div>
        <span className="nexo-section-pill">
          <ShieldCheck className="h-4 w-4 text-[#24a0b4]" /> Leitura operacional
        </span>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <IntelligenceMetric
          icon={Link2}
          label="Vínculos no recorte"
          value={scopedLinks.length}
          detail="Vínculos atuais, inclusive não confirmados"
        />
        <IntelligenceMetric
          icon={ShieldCheck}
          label="Confiança média"
          value={averageConfidence}
          detail="Percentual informado nos vínculos do recorte"
        />
        <IntelligenceMetric
          icon={AlertTriangle}
          label="Em validação"
          value={pendingLinks.length}
          detail="Vínculos ainda não confirmados"
          warning
        />
        <IntelligenceMetric
          icon={UserRound}
          label="Sem vínculo atual"
          value={unlinkedPeople.length}
          detail="Na base completa, não só neste recorte"
          warning={unlinkedPeople.length > 0}
        />
      </div>

      <div className="nexo-filter-panel mt-5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_240px_210px_auto]">
          <label className="relative block">
            <span className="sr-only">Buscar pessoa, função ou facção na rede</span>
            <Search className="absolute left-3 top-3 h-4 w-4 text-[#567184]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Pessoa, alcunha, função ou facção…"
              className="h-10 w-full rounded-xl border border-[#d9e6ec] pl-9 pr-3 text-xs text-[#34586f] outline-none focus:border-[#54aec1] focus:ring-2 focus:ring-[#54aec1]/10"
            />
          </label>
          <select
            aria-label="Filtrar rede por facção"
            value={faction}
            onChange={(event) => setFaction(event.target.value)}
            className="h-10 rounded-xl border border-[#d9e6ec] bg-white px-3 text-xs text-[#5c7d91]"
          >
            <option value="">Todas as facções</option>
            {organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.nome}
              </option>
            ))}
          </select>
          <select
            aria-label="Filtrar situação do vínculo"
            value={status}
            onChange={(event) => setStatus(event.target.value as typeof status)}
            className="h-10 rounded-xl border border-[#d9e6ec] bg-white px-3 text-xs text-[#5c7d91]"
          >
            <option value="all">Todos os vínculos atuais</option>
            {Object.entries(STATUS_LABELS)
              .filter(([value]) => value !== "desvinculado")
              .map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setFaction("");
              setStatus("all");
              setFocusedPersonId(null);
              setSummaryPersonId(null);
            }}
            className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#d9e6ec] px-3 text-[11px] font-bold text-[#5c7d91] hover:bg-[#eff8fa]"
          >
            <FilterX className="h-3.5 w-3.5" /> Limpar
          </button>
        </div>
        <p role="status" className="mt-3 text-[11px] text-[#567184]">
          {network.length} facção(ões) · {new Set(scopedLinks.map((link) => link.person.id)).size}{" "}
          pessoa(s) no recorte. Os vínculos desvinculados permanecem no histórico do dossiê e não
          compõem esta rede.
        </p>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="nexo-surface p-5 sm:p-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#5a9eb0]">
                Rede conhecida
              </p>
              <h2 className="mt-1 text-xl font-black text-[#17364e]">Facções e integrantes</h2>
            </div>
            <Network className="h-6 w-6 text-[#65a9b9]" />
          </div>

          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            {network.map(({ organization, members }) => {
              const memberIds = new Set(members.map((member) => member.id));
              const relatedRecords = records.filter(
                (record) =>
                  record.organizacao_id === organization.id ||
                  (record.pessoa_id ? memberIds.has(record.pessoa_id) : false),
              );
              return (
                <article
                  key={organization.id}
                  className="relative overflow-hidden rounded-2xl border border-[#dce7ed] bg-[#fbfdfe] p-4"
                >
                  <span
                    className="absolute inset-y-0 left-0 w-1"
                    style={{ backgroundColor: organization.cor }}
                  />
                  <div className="flex items-start gap-3 pl-1">
                    <button
                      type="button"
                      onClick={() => onOpen({ kind: "organization", id: organization.id })}
                      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl"
                      style={{ backgroundColor: `${organization.cor}18`, color: organization.cor }}
                      aria-label={`Abrir ${organization.nome}`}
                    >
                      <Building2 className="h-5 w-5" />
                    </button>
                    <div className="min-w-0 flex-1">
                      <button
                        type="button"
                        onClick={() => onOpen({ kind: "organization", id: organization.id })}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span>
                          <strong className="block truncate text-sm text-[#193a52]">
                            {organization.nome}
                          </strong>
                          <small className="text-[11px] uppercase tracking-wide text-[#567184]">
                            {members.length} integrante(s) no recorte ·{" "}
                            {uniqueDirectoryProcedureCount(relatedRecords)} procedimento(s)
                          </small>
                        </span>
                        <ArrowUpRight className="h-4 w-4 text-[#567184]" />
                      </button>
                    </div>
                  </div>

                  <div className="relative ml-6 mt-4 space-y-2 border-l border-dashed border-[#bdd3dd] pl-5">
                    {members.slice(0, faction || search ? 50 : 5).map((member) => {
                      const link = activeDirectoryLinks(member).find(
                        (item) =>
                          item.organizacao_id === organization.id &&
                          (status === "all" || item.status === status),
                      );
                      return (
                        <button
                          key={member.id}
                          type="button"
                          onClick={() => {
                            setFocusedPersonId(member.id);
                            setSummaryPersonId(null);
                          }}
                          aria-pressed={focusedPerson?.id === member.id}
                          className={`relative flex w-full items-center gap-3 rounded-xl border bg-white p-2.5 text-left hover:border-[#8fc3d0] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#55a9bc] ${focusedPerson?.id === member.id ? "border-[#55a9bc] ring-2 ring-[#55a9bc]/20" : "border-[#e3ebef]"}`}
                        >
                          <span className="absolute -left-[26px] h-2.5 w-2.5 rounded-full border-2 border-white bg-[#55b8ca] shadow" />
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#eaf4f6] text-[#2a8297]">
                            {getNexoPersonPhotoUrl(member) ? (
                              <img
                                src={getNexoPersonPhotoUrl(member)!}
                                alt=""
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <UserRound className="h-4 w-4" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <strong className="block truncate text-xs text-[#29495f]">
                              {member.nome}
                            </strong>
                            <small className="block truncate text-[11px] text-[#567184]">
                              {link?.funcao || "Função não informada"} ·{" "}
                              {link ? STATUS_LABELS[link.status] : ""}
                            </small>
                          </span>
                          <span className="text-[11px] font-black text-[#337f95]">
                            {link?.confianca || 0}%
                          </span>
                        </button>
                      );
                    })}
                    {members.length > (faction || search ? 50 : 5) ? (
                      <button
                        type="button"
                        onClick={() => onOpen({ kind: "organization", id: organization.id })}
                        className="rounded-lg px-2 py-2 text-[11px] font-bold text-[#46899c]"
                      >
                        +{members.length - (faction || search ? 50 : 5)} integrante(s) · Ver no
                        dossiê
                      </button>
                    ) : null}
                    {!members.length ? (
                      <p className="rounded-xl border border-dashed border-[#dce6eb] p-3 text-xs text-[#567184]">
                        Nenhum integrante relacionado.
                      </p>
                    ) : null}
                  </div>
                </article>
              );
            })}
            {!network.length ? (
              <p className="rounded-2xl border border-dashed border-[#d5e1e8] p-8 text-center text-sm text-[#567184] lg:col-span-2">
                {organizations.length
                  ? "Nenhum vínculo neste recorte. Ajuste os filtros para consultar a rede."
                  : "Cadastre uma facção e seus integrantes para formar a rede."}
              </p>
            ) : null}
          </div>
        </section>

        <aside className="space-y-5">
          {focusedPerson ? (
            <section
              className="rounded-[26px] border border-[#abd4df] bg-[#eff9fb] p-5"
              aria-label="Pessoa selecionada na rede"
            >
              <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#5a9eb0]">
                Nó selecionado
              </p>
              <h2 className="mt-2 text-lg font-black text-[#17364e]">{focusedPerson.nome}</h2>
              <p className="mt-1 text-xs text-[#567184]">
                {focusedPerson.apelido || "Sem alcunha registrada"}
              </p>
              <p className="mt-3 text-[11px] leading-relaxed text-[#6e8a9c]">
                {activeDirectoryLinks(focusedPerson).length} vínculo(s) atual(is). Confira a fonte,
                a situação e o histórico no dossiê antes de concluir uma associação.
              </p>
              <button
                type="button"
                onClick={() => onOpen({ kind: "person", id: focusedPerson.id })}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[#173f58] px-4 py-2.5 text-[11px] font-bold text-white"
              >
                Abrir dossiê <ArrowUpRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setSummaryPersonId(focusedPerson.id)}
                className="mt-2 inline-flex items-center gap-2 rounded-xl border border-[#9bcbd6] bg-white px-4 py-2.5 text-[11px] font-bold text-[#286b7d] transition hover:bg-[#e5f5f8]"
              >
                <Sparkles className="h-3.5 w-3.5" /> Gerar síntese local
              </button>
            </section>
          ) : null}
          {focusedPerson && summaryPersonId === focusedPerson.id ? (
            <LocalSummaryCard
              summary={buildNexoPersonIntelligenceSummary(
                focusedPerson,
                organizations,
                territories,
                records,
              )}
            />
          ) : null}
          <section className="rounded-[26px] border border-[#d8e5eb] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#b27c35]">
              Fila de análise
            </p>
            <h2 className="mt-1 text-lg font-black text-[#17364e]">Qualidade do cadastro</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-[#567184]">
              Contagens da base completa. Não representam suspeita, prioridade ou risco calculado.
            </p>
            <div className="mt-4 space-y-2">
              <PendingItem
                label="Pessoas sem vínculo atual"
                value={unlinkedPeople.length}
                urgent={unlinkedPeople.length > 0}
              />
              <PendingItem
                label="Vínculos aguardando validação"
                value={pendingLinks.length}
                urgent={pendingLinks.length > 0}
              />
              <PendingItem
                label="Territórios abaixo de 70%"
                value={lowConfidenceTerritories.length}
                urgent={lowConfidenceTerritories.length > 0}
              />
              <PendingItem
                label="Pessoas sem fotografia"
                value={people.filter((person) => !hasDirectoryPhoto(person)).length}
                urgent={false}
              />
            </div>
          </section>

          <section className="rounded-[26px] border border-[#d8e5eb] bg-white p-5">
            <p className="text-[11px] font-black uppercase tracking-[.2em] text-[#5a9eb0]">
              Atividade catalogada
            </p>
            <h2 className="mt-1 text-lg font-black text-[#17364e]">Linha do tempo</h2>
            <p className="mt-2 text-[11px] leading-relaxed text-[#567184]">
              Atividades de cadastro e vinculação em toda a base, não datas dos fatos.
            </p>
            <div className="mt-4 space-y-3">
              {events.map((event, index) => (
                <div key={event.id} className="relative flex gap-3 pl-1">
                  <span className="relative mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-[#56b9cb] ring-4 ring-[#ebf6f8]" />
                  {index < events.length - 1 ? (
                    <span className="absolute bottom-[-14px] left-[5px] top-4 w-px bg-[#dbe8ed]" />
                  ) : null}
                  <span className="min-w-0">
                    <strong className="block text-xs leading-relaxed text-[#345166]">
                      {event.title}
                    </strong>
                    <small className="mt-0.5 block text-[11px] uppercase tracking-wide text-[#567184]">
                      {event.kind} · {new Date(event.date).toLocaleDateString("pt-BR")}
                    </small>
                  </span>
                </div>
              ))}
              {!events.length ? (
                <p className="text-xs text-[#567184]">Nenhuma atividade catalogada.</p>
              ) : null}
            </div>
          </section>
        </aside>
      </div>
    </section>
  );
}

function IntelligenceMetric({
  icon: Icon,
  label,
  value,
  detail,
  warning = false,
}: {
  icon: typeof UsersRound;
  label: string;
  value: number | string;
  detail: string;
  warning?: boolean;
}) {
  return (
    <div
      className={`rounded-2xl border bg-white p-4 ${warning ? "border-amber-200" : "border-[#d9e6ec]"}`}
    >
      <div className="flex items-center justify-between gap-3">
        <span
          className={`flex h-9 w-9 items-center justify-center rounded-xl ${warning ? "bg-amber-50 text-amber-600" : "bg-[#eaf5f7] text-[#2b859a]"}`}
        >
          <Icon className="h-4 w-4" />
        </span>
        <strong className="text-2xl font-black text-[#17364e]">{value}</strong>
      </div>
      <p className="mt-3 text-[11px] font-black uppercase tracking-wide text-[#526f82]">{label}</p>
      <p className="mt-1 text-[11px] text-[#567184]">{detail}</p>
    </div>
  );
}

function LocalSummaryCard({ summary }: { summary: NexoPersonIntelligenceSummary }) {
  return (
    <section
      className="rounded-[26px] border border-[#bcd9e1] bg-white p-5 shadow-[0_10px_28px_-22px_#173f58]"
      aria-live="polite"
      aria-label="Síntese estruturada local"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#e8f6f8] text-[#21869a]">
          <Sparkles className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className="text-[11px] font-black uppercase tracking-[.16em] text-[#5a9eb0]">
            Assistência local
          </p>
          <h2 className="mt-1 text-lg font-black text-[#17364e]">Síntese estruturada</h2>
          <p className="mt-2 text-[11px] leading-relaxed text-[#567184]">
            Rascunho baseado somente nos dados cadastrados. Não envia informações para serviços
            externos e não cria conclusões ou associações novas.
          </p>
        </div>
      </div>
      <dl className="mt-4 space-y-2 border-t border-[#edf2f5] pt-4 text-[11px]">
        <div className="flex items-start justify-between gap-3">
          <dt className="font-bold text-[#6a8494]">Pessoa</dt>
          <dd className="text-right font-semibold text-[#294b61]">{summary.subject.name}</dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="font-bold text-[#6a8494]">Localização</dt>
          <dd className="max-w-[62%] text-right font-semibold text-[#294b61]">
            {summary.subject.location}
          </dd>
        </div>
        <div className="flex items-start justify-between gap-3">
          <dt className="font-bold text-[#6a8494]">Fotografia de perfil</dt>
          <dd className="text-right font-semibold text-[#294b61]">
            {summary.subject.photoAvailable ? "Disponível" : "Não disponível"}
          </dd>
        </div>
      </dl>
      <SummaryGroup title="Vínculos registrados" empty="Nenhum vínculo atual registrado.">
        {summary.links.map((link) => (
          <li key={`${link.organization}:${link.status}`} className="rounded-lg bg-[#f6fafb] p-2.5">
            <strong className="block text-[#294b61]">{link.organization}</strong>
            <span className="mt-1 block text-[#6a8494]">
              {link.status} · {link.confidence}% · {link.evidence.label} · fonte: {link.source}
            </span>
          </li>
        ))}
      </SummaryGroup>
      <SummaryGroup
        title="Territórios relacionados"
        empty="Nenhum território relacionado no recorte."
      >
        {summary.territories.map((territory) => (
          <li
            key={`${territory.organization}:${territory.area}:${territory.classification}`}
            className="rounded-lg bg-[#f6fafb] p-2.5"
          >
            <strong className="block text-[#294b61]">
              {territory.area} · {territory.classification}
            </strong>
            <span className="mt-1 block text-[#6a8494]">
              {territory.organization} · {territory.confidence}% de confiança ·{" "}
              {territory.evidence.label}
            </span>
          </li>
        ))}
      </SummaryGroup>
      <SummaryGroup
        title="Procedimentos associados"
        empty="Nenhum procedimento associado no recorte."
      >
        {summary.procedures.map((procedure) => (
          <li
            key={`${procedure.type}:${procedure.number}`}
            className="rounded-lg bg-[#f6fafb] p-2.5"
          >
            <strong className="block text-[#294b61]">
              {procedure.type} · {procedure.number}
            </strong>
            <span className="mt-1 block text-[#6a8494]">{procedure.context}</span>
          </li>
        ))}
      </SummaryGroup>
      <div className="mt-4 border-t border-[#edf2f5] pt-4">
        <p className="text-[11px] font-black uppercase tracking-wide text-[#5a9eb0]">
          Cronologia rastreável
        </p>
        <p className="mt-1 text-[11px] leading-relaxed text-[#6a8494]">
          Datas identificadas no cadastro, no documento ou no vínculo. Nenhuma data de fato é
          inferida.
        </p>
        {summary.timeline.length ? (
          <ol className="mt-3 space-y-2">
            {summary.timeline.map((event) => (
              <li key={event.id} className="rounded-lg bg-[#f6fafb] p-2.5">
                <strong className="block text-[#294b61]">{event.label}</strong>
                <span className="mt-1 block text-[#6a8494]">
                  {new Date(event.date).toLocaleDateString("pt-BR")} ·{" "}
                  {TIMELINE_DATE_LABELS[event.dateType]}
                </span>
                <span className="mt-1 block text-[#567184]">{event.detail}</span>
                <span className="mt-1 block break-words text-[#6a8494]">Fonte: {event.source}</span>
                <span className="mt-1 block text-[#6a8494]">
                  Classificação: {event.evidence.label}
                </span>
              </li>
            ))}
          </ol>
        ) : (
          <p className="mt-2 text-[11px] text-[#6a8494]">Nenhuma data rastreável disponível.</p>
        )}
      </div>
      <SummaryGroup
        title="Lacunas para conferência"
        empty="Nenhuma lacuna operacional identificada."
      >
        {summary.gaps.map((gap) => (
          <li
            key={gap}
            className="flex items-start gap-2 rounded-lg bg-amber-50 p-2.5 text-amber-900"
          >
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>{gap}</span>
          </li>
        ))}
      </SummaryGroup>
      <SummaryGroup
        title="Divergências entre documentos"
        empty="Nenhuma divergência explícita entre alegações aceitas."
      >
        {summary.comparisons.map((comparison) => (
          <li
            key={comparison.field}
            className="rounded-lg border border-amber-200 bg-amber-50 p-2.5"
          >
            <strong className="block text-amber-950">{comparison.label}</strong>
            <span className="mt-1 block text-amber-900">
              As alternativas abaixo permanecem separadas para revisão humana; nenhuma foi escolhida
              automaticamente.
            </span>
            <ul className="mt-2 space-y-1 text-amber-950">
              {comparison.alternatives.map((alternative) => (
                <li key={`${alternative.document}:${alternative.page}:${alternative.value}`}>
                  {alternative.value} · {alternative.document}, p. {alternative.page} ·{" "}
                  {alternative.source}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </SummaryGroup>
      {summary.documents.length ? (
        <div className="mt-4 border-t border-[#edf2f5] pt-4">
          <p className="text-[11px] font-black uppercase tracking-wide text-[#5a9eb0]">
            Documentos preservados
          </p>
          <ul className="mt-2 space-y-2 text-[11px] text-[#567184]">
            {summary.documents.map((document) => (
              <li key={document} className="flex items-start gap-2">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#2b859a]" />
                <span className="break-words">{document}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function SummaryGroup({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: ReactNode;
}) {
  const hasItems = Array.isArray(children) ? children.length > 0 : Boolean(children);
  return (
    <div className="mt-4 border-t border-[#edf2f5] pt-4">
      <p className="text-[11px] font-black uppercase tracking-wide text-[#5a9eb0]">{title}</p>
      {hasItems ? (
        <ul className="mt-2 space-y-2">{children}</ul>
      ) : (
        <p className="mt-2 text-[11px] text-[#6a8494]">{empty}</p>
      )}
    </div>
  );
}

function PendingItem({ label, value, urgent }: { label: string; value: number; urgent: boolean }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-[#e3ebef] bg-[#f8fafb] p-3">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-black ${urgent ? "bg-amber-100 text-amber-700" : "bg-[#e7f2f5] text-[#397e92]"}`}
      >
        {value}
      </span>
      <span className="text-xs font-bold leading-relaxed text-[#536e80]">{label}</span>
    </div>
  );
}
