import {
  Building2,
  CalendarClock,
  Camera,
  CarFront,
  ChevronRight,
  ClipboardPenLine,
  Crown,
  ExternalLink,
  FileText,
  LockKeyhole,
  MapPin,
  MapPinned,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Unlink,
  UserCog,
  UserMinus,
  UserRound,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { BoRecord } from "@/features/bo/boTypes";
import type { InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import type {
  NexoOrganizacao,
  NexoHierarquiaEvento,
  NexoObservacao,
  NexoPessoa,
  NexoRegistroVinculado,
  NexoTerritorio,
  NexoVinculo,
  NexoVinculoManagementInput,
} from "../nexoTypes";
import { NEXO_PRESENTATION_DATA } from "../nexoPresentationData";
import {
  filterNexoOrganizationMembers,
  hasActiveMemberFilters,
  type NexoMemberFilters,
} from "../nexoMemberFilters";
import { getNexoPersonPhotoUrl, selectNexoRecords } from "../nexoSelectors";
import { NexoLinkForm, type NexoLinkInput } from "./NexoLinkForm";
import { NexoTerritoryMap } from "./NexoTerritoryMap";
import { NexoVehiclePanel } from "./NexoVehiclePanel";

type DossierTarget = { kind: "person"; id: string } | { kind: "organization"; id: string };
type Tab =
  | "resumo"
  | "vinculos"
  | "procedimentos"
  | "galeria"
  | "localizacao"
  | "veiculos"
  | "historico"
  | "observacoes";

const TAB_ICONS: Record<Tab, typeof UserRound> = {
  resumo: ShieldCheck,
  vinculos: UserCog,
  procedimentos: FileText,
  galeria: Camera,
  localizacao: MapPin,
  veiculos: CarFront,
  historico: CalendarClock,
  observacoes: ClipboardPenLine,
};

const TERRITORY_CATEGORY_LABELS: Record<NexoTerritorio["categoria"], string> = {
  area_influencia: "Área de influência",
  ponto_venda: "Ponto de venda",
  ponto_encontro: "Ponto de encontro",
  esconderijo: "Esconderijo",
  deposito: "Depósito",
  rota_operacional: "Rota operacional",
  outro: "Outro",
};

const LINK_LABELS = {
  confirmado: "Confirmado",
  provavel: "Provável",
  suspeito: "Suspeito",
  nao_confirmado: "Não confirmado",
  desvinculado: "Desvinculado",
};

const EMPTY_MEMBER_FILTERS: NexoMemberFilters = {
  busca: "",
  funcao: "",
  status: "",
  bairro: "",
  confiancaMinima: 0,
  procedimento: "todos",
};

function value(text: string | null | undefined) {
  return text?.trim() || "Não informado";
}

const LEADERSHIP_ROLE_PATTERN =
  /\b(lider|lideranca|chefe|comando|comandante|gerente|disciplina|tesoureir|responsavel|frente)\b/i;

function isLeadershipRole(role: string | null | undefined) {
  return Boolean(
    role && LEADERSHIP_ROLE_PATTERN.test(role.normalize("NFD").replace(/\p{Diacritic}/gu, "")),
  );
}

function normalizeRole(role: string | null | undefined) {
  return (role || "")
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

function leadershipRank(role: string | null | undefined) {
  const normalized = normalizeRole(role);
  if (/\bvice\b/.test(normalized)) return 2;
  if (/\b(lider|lideranca|comandante|comando|chefe)\b/.test(normalized)) return 0;
  if (/\b(gerente|responsavel|frente)\b/.test(normalized)) return 1;
  return 3;
}

function MemberFilterPanel({
  filters,
  roles,
  neighborhoods,
  resultCount,
  totalCount,
  onChange,
}: {
  filters: NexoMemberFilters;
  roles: string[];
  neighborhoods: string[];
  resultCount: number;
  totalCount: number;
  onChange: (filters: NexoMemberFilters) => void;
}) {
  const active = hasActiveMemberFilters(filters);
  const inputClass =
    "h-10 w-full rounded-xl border border-[#d9e5ec] bg-white px-3 text-xs font-semibold text-[#31546b] outline-none transition focus:border-[#61a9ba] focus:ring-2 focus:ring-[#61a9ba]/15";

  return (
    <div className="mt-5 rounded-2xl border border-[#dce8ee] bg-[#f6fafb] p-3 sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs font-black text-[#31566d]">
          <SlidersHorizontal className="h-4 w-4 text-[#218aa0]" /> Busca e filtros
          <span className="rounded-full bg-white px-2 py-0.5 text-[11px] text-[#6f8798] shadow-sm">
            {resultCount} de {totalCount}
          </span>
        </div>
        {active ? (
          <button
            type="button"
            onClick={() => onChange({ ...EMPTY_MEMBER_FILTERS })}
            className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[11px] font-black uppercase tracking-wide text-[#39758a] hover:bg-white"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Limpar filtros
          </button>
        ) : null}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-6">
        <label className="relative md:col-span-2 xl:col-span-2">
          <span className="sr-only">Buscar integrante</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#7790a0]" />
          <input
            value={filters.busca}
            onChange={(event) => onChange({ ...filters, busca: event.target.value })}
            placeholder="Nome, apelido, CPF, RG ou cargo"
            className={`${inputClass} pl-9`}
          />
        </label>
        <label>
          <span className="sr-only">Filtrar por cargo</span>
          <select
            value={filters.funcao}
            onChange={(event) => onChange({ ...filters, funcao: event.target.value })}
            className={inputClass}
          >
            <option value="">Todos os cargos</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por status</span>
          <select
            value={filters.status}
            onChange={(event) =>
              onChange({ ...filters, status: event.target.value as NexoMemberFilters["status"] })
            }
            className={inputClass}
          >
            <option value="">Todos os status</option>
            {Object.entries(LINK_LABELS).map(([status, label]) => (
              <option key={status} value={status}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por confiança</span>
          <select
            value={filters.confiancaMinima}
            onChange={(event) =>
              onChange({ ...filters, confiancaMinima: Number(event.target.value) })
            }
            className={inputClass}
          >
            <option value={0}>Qualquer confiança</option>
            <option value={50}>50% ou mais</option>
            <option value={70}>70% ou mais</option>
            <option value={90}>90% ou mais</option>
          </select>
        </label>
        <label>
          <span className="sr-only">Filtrar por bairro</span>
          <select
            value={filters.bairro}
            onChange={(event) => onChange({ ...filters, bairro: event.target.value })}
            className={inputClass}
          >
            <option value="">Todos os bairros</option>
            {neighborhoods.map((neighborhood) => (
              <option key={neighborhood} value={neighborhood}>
                {neighborhood}
              </option>
            ))}
          </select>
        </label>
        <label className="xl:col-start-5 xl:col-span-2">
          <span className="sr-only">Filtrar por procedimento</span>
          <select
            value={filters.procedimento}
            onChange={(event) =>
              onChange({
                ...filters,
                procedimento: event.target.value as NexoMemberFilters["procedimento"],
              })
            }
            className={inputClass}
          >
            <option value="todos">Com ou sem B.O./inquérito</option>
            <option value="com_procedimento">Com B.O. ou inquérito</option>
            <option value="sem_procedimento">Sem B.O. ou inquérito</option>
          </select>
        </label>
      </div>
    </div>
  );
}

function OrganizationMemberCard({
  person,
  link,
  leadership,
  onOpen,
  onManage,
  superiorName,
}: {
  person: NexoPessoa;
  link: NexoVinculo | undefined;
  leadership: boolean;
  onOpen: () => void;
  onManage?: () => void;
  superiorName?: string | null;
}) {
  const photoUrl = getNexoPersonPhotoUrl(person);
  return (
    <div
      className={`group relative flex w-full items-center gap-3 rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${
        leadership
          ? "border-[#b7dce4] bg-gradient-to-br from-[#102f48] to-[#1b536b] text-white shadow-[0_12px_30px_-20px_rgba(8,39,60,.8)]"
          : "border-[#dde8f0] bg-white hover:border-[#8fbecd]"
      }`}
    >
      <button
        type="button"
        onClick={onOpen}
        className="absolute inset-0 rounded-2xl"
        aria-label={`Abrir dossiê de ${person.nome}`}
      />
      {photoUrl ? (
        <img
          src={photoUrl}
          alt=""
          className={`h-12 w-12 rounded-xl object-cover ${leadership ? "ring-2 ring-[#70d6e4]/60" : ""}`}
        />
      ) : (
        <span
          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
            leadership ? "bg-white/12 text-[#7de0eb]" : "bg-[#e9f4f7] text-[#16879b]"
          }`}
        >
          {leadership ? <Crown className="h-5 w-5" /> : <UserRound className="h-5 w-5" />}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <strong className={`truncate text-sm ${leadership ? "text-white" : "text-[#1e405b]"}`}>
            {person.nome}
          </strong>
          {leadership ? (
            <span className="rounded-full bg-[#6dd8e6]/15 px-2 py-0.5 text-[11px] font-black uppercase tracking-wider text-[#8be5ef]">
              Liderança
            </span>
          ) : null}
        </span>
        <small className={`mt-1 block text-xs ${leadership ? "text-[#b8dce4]" : "text-[#567184]"}`}>
          {value(person.apelido)} · {value(link?.funcao)}
        </small>
        <small
          className={`mt-0.5 block text-[11px] ${leadership ? "text-[#8fc1ce]" : "text-[#567184]"}`}
        >
          {link ? LINK_LABELS[link.status] : "Sem status"} · Confiança {link?.confianca || 0}%
        </small>
        {superiorName ? (
          <small
            className={`mt-1 block text-[11px] ${leadership ? "text-[#b8dce4]" : "text-[#497c90]"}`}
          >
            Responde a {superiorName}
          </small>
        ) : null}
      </span>
      <span className="relative z-[1] flex shrink-0 items-center gap-1">
        {onManage ? (
          <button
            type="button"
            onClick={onManage}
            className={`rounded-lg p-2 transition ${leadership ? "bg-white/10 text-[#a8e6ee] hover:bg-white/20" : "bg-[#edf5f7] text-[#34788d] hover:bg-[#dcedf1]"}`}
            aria-label={`Gerenciar vínculo de ${person.nome}`}
            title="Alterar cargo e chefia, transferir ou remover"
          >
            <UserCog className="h-4 w-4" />
          </button>
        ) : null}
        <ChevronRight
          className={`h-4 w-4 transition group-hover:translate-x-0.5 ${leadership ? "text-[#8ed9e4]" : "text-[#567184]"}`}
        />
      </span>
    </div>
  );
}

function LeadershipTree({
  members,
  allMembers,
  onOpen,
  onManage,
}: {
  members: { person: NexoPessoa; link: NexoVinculo | undefined }[];
  allMembers: { person: NexoPessoa; link: NexoVinculo | undefined }[];
  onOpen: (person: NexoPessoa) => void;
  onManage: (person: NexoPessoa, link: NexoVinculo) => void;
}) {
  const ordered = [...members].sort((a, b) => {
    const rankDifference = leadershipRank(a.link?.funcao) - leadershipRank(b.link?.funcao);
    if (rankDifference) return rankDifference;
    return (b.link?.confianca || 0) - (a.link?.confianca || 0);
  });
  const byId = new Map(ordered.filter((item) => item.link).map((item) => [item.link!.id, item]));
  const allById = new Map(
    allMembers.filter((item) => item.link).map((item) => [item.link!.id, item]),
  );
  const roots = ordered.filter(
    ({ link }) => !link?.superior_vinculo_id || !byId.has(link.superior_vinculo_id),
  );
  const renderNode = (member: (typeof ordered)[number], visited: Set<string>): React.ReactNode => {
    if (!member.link || visited.has(member.link.id)) return null;
    const nextVisited = new Set(visited).add(member.link.id);
    const children = ordered.filter(({ link }) => link?.superior_vinculo_id === member.link!.id);
    return (
      <div key={member.link.id} className="min-w-[250px] flex-1">
        <OrganizationMemberCard
          person={member.person}
          link={member.link}
          leadership
          superiorName={allById.get(member.link.superior_vinculo_id || "")?.person.nome}
          onOpen={() => onOpen(member.person)}
          onManage={() => onManage(member.person, member.link!)}
        />
        {children.length ? (
          <div className="ml-5 mt-3 space-y-3 border-l-2 border-[#64b7c1] pl-5">
            {children.map((child) => (
              <div
                key={child.link?.id}
                className="relative before:absolute before:-left-5 before:top-9 before:h-px before:w-5 before:bg-[#64b7c1]"
              >
                {renderNode(child, nextVisited)}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    );
  };
  return (
    <div className="overflow-x-auto pb-1">
      <div className="grid min-w-[320px] gap-4 lg:grid-cols-2">
        {roots.map((member) => renderNode(member, new Set()))}
        {!roots.length && ordered.map((member) => renderNode(member, new Set()))}
      </div>
    </div>
  );
}

function factionHeaderTheme(color: string) {
  const normalized = /^#[0-9a-f]{6}$/i.test(color) ? color : "#173d5b";
  const channels = [1, 3, 5].map((index) =>
    Number.parseInt(normalized.slice(index, index + 2), 16),
  );
  const darker = `#${channels
    .map((channel) =>
      Math.round(channel * 0.68)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
  const luminance = (channels[0] * 299 + channels[1] * 587 + channels[2] * 114) / 255000;
  const darkText = luminance > 0.62;
  return {
    accent: normalized,
    background: `linear-gradient(125deg, ${normalized} 0%, ${darker} 100%)`,
    foreground: darkText ? "#102b3d" : "#ffffff",
    muted: darkText ? "rgba(16,43,61,.72)" : "rgba(255,255,255,.76)",
    surface: darkText ? "rgba(16,43,61,.1)" : "rgba(255,255,255,.14)",
    border: darkText ? "rgba(16,43,61,.2)" : "rgba(255,255,255,.28)",
  };
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-[#dce6ed] bg-white px-4 py-3.5 shadow-[0_3px_8px_-7px_#183f5450]">
      <dt className="text-[11px] font-bold uppercase tracking-wider text-[#567184]">{label}</dt>
      <dd className="mt-1 text-sm font-semibold text-[#243d52]">{children}</dd>
    </div>
  );
}

function LinkManagementDialog({
  person,
  link,
  organizations,
  people,
  onClose,
  onSave,
}: {
  person: NexoPessoa;
  link: NexoVinculo;
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
  onClose: () => void;
  onSave: (input: NexoVinculoManagementInput) => Promise<void>;
}) {
  const [organizationId, setOrganizationId] = useState(link.organizacao_id);
  const [status, setStatus] = useState<Exclude<NexoVinculo["status"], "desvinculado">>(
    link.status === "desvinculado" ? "nao_confirmado" : link.status,
  );
  const [role, setRole] = useState(link.funcao || "");
  const [confidence, setConfidence] = useState(link.confianca);
  const [source, setSource] = useState(link.fonte_resumo || "");
  const [superiorId, setSuperiorId] = useState(link.superior_vinculo_id || "");
  const [saving, setSaving] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [error, setError] = useState("");
  const isTransfer = organizationId !== link.organizacao_id;
  const possibleSuperiors = people.flatMap((item) =>
    item.id === person.id
      ? []
      : item.vinculos
          .filter(
            (candidate) =>
              candidate.organizacao_id === organizationId && candidate.status !== "desvinculado",
          )
          .filter((candidate) => {
            const links = people.flatMap((entry) => entry.vinculos);
            const byId = new Map(links.map((entry) => [entry.id, entry]));
            let cursor: NexoVinculo | undefined = candidate;
            const visited = new Set<string>();
            while (cursor && !visited.has(cursor.id)) {
              if (cursor.id === link.id) return false;
              visited.add(cursor.id);
              cursor = byId.get(cursor.superior_vinculo_id || "");
            }
            return true;
          })
          .map((candidate) => ({ person: item, link: candidate })),
  );

  async function persist(action: NexoVinculoManagementInput["acao"]) {
    setSaving(true);
    setError("");
    try {
      await onSave({
        vinculo_id: link.id,
        pessoa_id: person.id,
        acao: action,
        organizacao_id: organizationId,
        status,
        funcao: role,
        confianca: confidence,
        fonte_resumo: source,
        superior_vinculo_id: superiorId || null,
      });
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o vínculo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#061729]/65 p-4 backdrop-blur-sm"
      onMouseDown={onClose}
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void persist(isTransfer ? "transferir" : "atualizar");
        }}
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[calc(100vh-32px)] w-full max-w-2xl overflow-y-auto rounded-[24px] bg-white shadow-2xl"
      >
        <div className="flex items-start gap-3 border-b border-[#e1e9ef] p-5 sm:p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e7f3f6] text-[#197e96]">
            <UserCog className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-black uppercase tracking-[.16em] text-[#4b96a9]">
              Gestão de vínculo
            </span>
            <h3 className="mt-1 text-lg font-black text-[#173a54]">{person.nome}</h3>
            <p className="mt-1 text-xs text-[#758b9b]">
              Altere o cargo ou a chefia, transfira de facção ou encerre o vínculo atual.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-[#567184] hover:bg-[#f0f5f7]"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="grid gap-4 p-5 sm:grid-cols-2 sm:p-6">
          <label className="text-xs font-bold text-[#60798b]">
            Facção
            <select
              value={organizationId}
              onChange={(event) => {
                setOrganizationId(event.target.value);
                setSuperiorId("");
              }}
              className="mt-1 h-11 w-full rounded-xl border border-[#d5e3eb] bg-white px-3 text-sm text-[#1d3d55] outline-none focus:border-[#3197ab]"
            >
              {organizations.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-bold text-[#60798b] sm:col-span-2">
            Responde a
            <select
              value={superiorId}
              onChange={(event) => setSuperiorId(event.target.value)}
              className="mt-1 h-11 w-full rounded-xl border border-[#d5e3eb] bg-white px-3 text-sm text-[#1d3d55] outline-none focus:border-[#3197ab]"
            >
              <option value="">Sem superior definido</option>
              {possibleSuperiors.map((candidate) => (
                <option key={candidate.link.id} value={candidate.link.id}>
                  {candidate.person.nome} · {candidate.link.funcao || "Função não informada"}
                </option>
              ))}
            </select>
            <span className="mt-1 block font-normal text-[#567184]">
              Apenas integrantes ativos desta facção. O sistema impede relações circulares.
            </span>
          </label>
          <label className="text-xs font-bold text-[#60798b]">
            Cargo ou função
            <input
              value={role}
              onChange={(event) => setRole(event.target.value)}
              placeholder="Ex.: Líder, disciplina, membro"
              className="mt-1 h-11 w-full rounded-xl border border-[#d5e3eb] px-3 text-sm text-[#1d3d55] outline-none focus:border-[#3197ab]"
            />
          </label>
          <label className="text-xs font-bold text-[#60798b]">
            Situação
            <select
              value={status}
              onChange={(event) => setStatus(event.target.value as typeof status)}
              className="mt-1 h-11 w-full rounded-xl border border-[#d5e3eb] bg-white px-3 text-sm text-[#1d3d55] outline-none focus:border-[#3197ab]"
            >
              <option value="nao_confirmado">Não confirmado</option>
              <option value="suspeito">Suspeito</option>
              <option value="provavel">Provável</option>
              <option value="confirmado">Confirmado</option>
            </select>
          </label>
          <label className="text-xs font-bold text-[#60798b]">
            Confiança: {confidence}%
            <input
              type="range"
              min="0"
              max="100"
              value={confidence}
              onChange={(event) => setConfidence(Number(event.target.value))}
              className="mt-3 w-full accent-[#178ba2]"
            />
          </label>
          <label className="text-xs font-bold text-[#60798b] sm:col-span-2">
            Fonte ou justificativa
            <textarea
              value={source}
              onChange={(event) => setSource(event.target.value)}
              placeholder="Registre o fundamento da alteração"
              className="mt-1 min-h-24 w-full rounded-xl border border-[#d5e3eb] px-3 py-2 text-sm text-[#1d3d55] outline-none focus:border-[#3197ab]"
            />
          </label>
          {isTransfer ? (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed text-amber-800 sm:col-span-2">
              Ao salvar, o vínculo atual será encerrado com a data de hoje e um novo vínculo será
              aberto na facção escolhida.
            </p>
          ) : null}
          {error ? (
            <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700 sm:col-span-2">
              {error}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#e1e9ef] p-5 sm:px-6">
          <button
            type="button"
            disabled={saving}
            onClick={() => (confirmRemove ? void persist("remover") : setConfirmRemove(true))}
            className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition ${confirmRemove ? "border-red-600 bg-red-600 text-white" : "border-red-200 bg-red-50 text-red-600 hover:bg-red-100"}`}
          >
            <UserMinus className="h-4 w-4" />{" "}
            {confirmRemove ? "Confirmar remoção" : "Remover da facção"}
          </button>
          <button
            type="submit"
            disabled={saving || !organizationId}
            className="inline-flex items-center gap-2 rounded-xl bg-[#173d5b] px-5 py-2.5 text-xs font-black text-white shadow-lg shadow-[#173d5b]/15 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />{" "}
            {saving ? "Salvando…" : isTransfer ? "Transferir e salvar" : "Salvar alterações"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NotesPanel({
  target,
  preview,
  previewNotes = [],
  onPreviewNoteCreated,
}: {
  target: DossierTarget;
  preview: boolean;
  previewNotes?: NexoObservacao[];
  onPreviewNoteCreated?: (note: NexoObservacao) => void;
}) {
  const [notes, setNotes] = useState<NexoObservacao[]>([]);
  const [draft, setDraft] = useState("");
  const [composerOpen, setComposerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setError("");
    if (preview) {
      setNotes(
        previewNotes.filter((note) =>
          target.kind === "person"
            ? note.pessoa_id === target.id
            : note.organizacao_id === target.id,
        ),
      );
      return;
    }
    let cancelled = false;
    void import("@/lib/repositories/nexoRepository")
      .then((repo) =>
        repo.listNexoObservacoes(
          target.kind === "person" ? { pessoa_id: target.id } : { organizacao_id: target.id },
        ),
      )
      .then((items) => {
        if (!cancelled) setNotes(items);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "Não foi possível carregar as observações.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [preview, previewNotes, target.id, target.kind]);

  async function addNote() {
    const content = draft.trim();
    if (saving || !content) return;
    setSaving(true);
    setError("");
    try {
      const note = preview
        ? ({
            id: crypto.randomUUID(),
            pessoa_id: target.kind === "person" ? target.id : null,
            organizacao_id: target.kind === "organization" ? target.id : null,
            conteudo: content,
            created_at: new Date().toISOString(),
            created_by: "preview",
            autor: { nome: "Usuário demonstrativo" },
          } satisfies NexoObservacao)
        : await import("@/lib/repositories/nexoRepository").then((repo) =>
            repo.createNexoObservacao({
              ...(target.kind === "person"
                ? { pessoa_id: target.id }
                : { organizacao_id: target.id }),
              conteudo: content,
            }),
          );
      setNotes((current) => [note, ...current]);
      if (preview) onPreviewNoteCreated?.(note);
      setDraft("");
      setComposerOpen(false);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar a observação.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#dce7ee] bg-white p-5">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4f7] text-[#25859b]">
            <ClipboardPenLine className="h-5 w-5" />
          </span>
          <div>
            <h3 className="text-sm font-black text-[#1e405b]">Observações e relatórios</h3>
            <p className="mt-0.5 text-xs text-[#567184]">
              Anotações permanentes, organizadas por data, hora e responsável.
            </p>
          </div>
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => setComposerOpen((open) => !open)}
          className="inline-flex items-center gap-2 rounded-xl bg-[#173d5b] px-4 py-2.5 text-xs font-black text-white"
        >
          {composerOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}{" "}
          {composerOpen ? "Cancelar" : "Adicionar observação"}
        </button>
      </div>
      {composerOpen ? (
        <div className="rounded-2xl border border-[#c8dfe7] bg-[#f4f9fb] p-4 sm:p-5">
          <label className="text-xs font-black uppercase tracking-wider text-[#527386]">
            Nova anotação
          </label>
          <textarea
            autoFocus
            disabled={saving}
            maxLength={10000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="Escreva o relatório, atualização ou informação relevante…"
            className="mt-2 min-h-40 w-full rounded-xl border border-[#d3e1e9] bg-white px-4 py-3 text-sm leading-relaxed text-[#29475d] outline-none focus:border-[#3595a9]"
          />
          <div className="mt-3 flex items-center justify-between gap-3">
            <small className="text-[11px] text-[#567184]">
              {draft.length.toLocaleString("pt-BR")} / 10.000 caracteres
            </small>
            <button
              type="button"
              disabled={saving || !draft.trim()}
              onClick={() => void addNote()}
              className="inline-flex items-center gap-2 rounded-xl bg-[#16869d] px-4 py-2.5 text-xs font-black text-white disabled:opacity-50"
            >
              <Save className="h-4 w-4" /> {saving ? "Salvando…" : "Salvar observação"}
            </button>
          </div>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      ) : null}
      <div className="space-y-3">
        {notes.map((note) => (
          <article
            key={note.id}
            className="rounded-2xl border border-[#dfe8ee] bg-white p-4 sm:p-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#edf1f4] pb-3">
              <strong className="text-xs text-[#2d5268]">
                {note.autor?.nome || "Usuário do sistema"}
              </strong>
              <time
                dateTime={note.created_at}
                className="text-[11px] font-bold uppercase tracking-wide text-[#567184]"
              >
                {new Date(note.created_at).toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </time>
            </div>
            <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[#526d80]">
              {note.conteudo}
            </p>
          </article>
        ))}
        {!notes.length && !error ? (
          <div className="rounded-2xl border border-dashed border-[#d3e0e7] bg-white p-8 text-center">
            <ClipboardPenLine className="mx-auto h-7 w-7 text-[#567184]" />
            <p className="mt-2 text-sm font-bold text-[#718797]">Nenhuma observação registrada.</p>
            <p className="mt-1 text-xs text-[#567184]">
              Use “Adicionar observação” para iniciar o histórico.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function TerritoryMapDialog({
  territory,
  territories,
  organizations,
  onSelect,
  onClose,
}: {
  territory: NexoTerritorio;
  territories: NexoTerritorio[];
  organizations: NexoOrganizacao[];
  onSelect: (territory: NexoTerritorio) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-[#061729]/70 p-3 backdrop-blur-sm sm:p-6"
      onMouseDown={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Mapa de ${territory.bairro}`}
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[calc(100vh-24px)] w-full max-w-6xl overflow-y-auto rounded-[26px] bg-[#f6f9fb] shadow-2xl sm:max-h-[calc(100vh-48px)]"
      >
        <header className="sticky top-0 z-30 flex items-start gap-3 border-b border-[#dce7ed] bg-white/95 p-5 backdrop-blur sm:px-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#e5f3f6] text-[#167e97]">
            <MapPinned className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="text-[11px] font-black uppercase tracking-[.16em] text-[#4795a8]">
              Visualização territorial
            </span>
            <h3 className="mt-1 text-lg font-black text-[#173a54]">{territory.bairro}</h3>
            <p className="mt-1 text-xs text-[#758b9b]">
              {TERRITORY_CATEGORY_LABELS[territory.categoria]} · {territory.municipio}/
              {territory.uf}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar mapa"
            className="rounded-xl border border-[#d9e4ea] p-2 text-[#738999] hover:bg-[#f1f6f8]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="grid gap-4 p-4 sm:p-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <NexoTerritoryMap
            territories={territories}
            organizations={organizations}
            selectedId={territory.id}
            onSelect={onSelect}
          />
          <aside className="space-y-3">
            <div className="rounded-2xl border border-[#dce7ed] bg-white p-4">
              <h4 className="text-xs font-black uppercase tracking-wider text-[#315a72]">
                Dados do local
              </h4>
              <dl className="mt-3 space-y-3 text-xs">
                <div>
                  <dt className="font-bold text-[#567184]">Classificação</dt>
                  <dd className="mt-0.5 font-semibold capitalize text-[#39576b]">
                    {territory.classificacao.replaceAll("_", " ")}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-[#567184]">Endereço</dt>
                  <dd className="mt-0.5 font-semibold text-[#39576b]">
                    {territory.logradouro
                      ? `${territory.logradouro}${territory.numero ? `, ${territory.numero}` : ""}`
                      : "Não informado"}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-[#567184]">Referência</dt>
                  <dd className="mt-0.5 font-semibold text-[#39576b]">
                    {value(territory.ponto_referencia)}
                  </dd>
                </div>
                <div>
                  <dt className="font-bold text-[#567184]">Confiança e fonte</dt>
                  <dd className="mt-0.5 font-semibold text-[#39576b]">
                    {territory.confianca}% · {value(territory.fonte_resumo)}
                  </dd>
                </div>
              </dl>
              {territory.link_navegacao ? (
                <a
                  href={territory.link_navegacao}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#173d5b] px-4 py-2.5 text-xs font-black text-white"
                >
                  Abrir navegação <ExternalLink className="h-4 w-4" />
                </a>
              ) : null}
            </div>
            {territory.pontos.length >= 3 ? (
              <div className="rounded-2xl border border-[#bcdde4] bg-[#eaf6f8] p-4 text-xs leading-relaxed text-[#427183]">
                A área destacada representa os {territory.pontos.length} pontos marcados no
                cadastro. Clique em outra área do mapa para consultar seus dados.
              </div>
            ) : (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-relaxed text-amber-800">
                Este local não possui três pontos suficientes para formar uma área no mapa. Edite o
                cadastro e marque o perímetro para exibi-lo visualmente.
              </div>
            )}
          </aside>
        </div>
      </section>
    </div>
  );
}

function ProcedurePanel({
  target,
  preview,
  people,
  records,
  onRecordsChange,
}: {
  target: DossierTarget;
  preview: boolean;
  people: NexoPessoa[];
  records: NexoRegistroVinculado[];
  onRecordsChange?: (records: NexoRegistroVinculado[]) => void;
}) {
  const [allRecords, setAllRecords] = useState(records);
  const [cases, setCases] = useState<InqueritoRecord[]>([]);
  const [reports, setReports] = useState<BoRecord[]>([]);
  const [kind, setKind] = useState<"inquerito" | "bo">("inquerito");
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(!preview);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const scope = useMemo(
    () =>
      target.kind === "person"
        ? ({ kind: "pessoa", pessoaId: target.id } as const)
        : ({ kind: "organizacao", organizacaoId: target.id } as const),
    [target.id, target.kind],
  );
  const links = useMemo(
    () => selectNexoRecords(scope, people, allRecords),
    [scope, people, allRecords],
  );

  useEffect(() => setAllRecords(records), [records]);

  function updateRecords(next: NexoRegistroVinculado[]) {
    setAllRecords(next);
    onRecordsChange?.(next);
  }

  useEffect(() => {
    setError("");
    if (preview) {
      const catalog = [...NEXO_PRESENTATION_DATA.records, ...records];
      setCases(
        catalog
          .filter((item) => item.inquerito_id && item.inquerito)
          .map(
            (item) =>
              ({
                id: item.inquerito_id,
                numero_ppe: item.inquerito?.numero_ppe,
                tipo: item.inquerito?.tipo,
                situacao: item.inquerito?.situacao,
                tipificacao: null,
              }) as InqueritoRecord,
          ),
      );
      setReports(
        catalog
          .filter((item) => item.bo_id && item.bo)
          .map(
            (item) =>
              ({
                id: item.bo_id,
                numero_bo: item.bo?.numero_bo,
                infracao_penal: item.bo?.infracao_penal,
                status: item.bo?.status,
              }) as BoRecord,
          ),
      );
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void Promise.all([
      import("@/lib/repositories/inqueritosRepository").then((repo) => repo.listInqueritos()),
      import("@/lib/repositories/boRepository").then((repo) => repo.listBos()),
    ])
      .then(([foundCases, foundReports]) => {
        if (cancelled) return;
        setCases(foundCases);
        setReports(foundReports);
      })
      .catch((cause) => {
        if (!cancelled)
          setError(
            cause instanceof Error ? cause.message : "Não foi possível carregar os procedimentos.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [preview, records]);

  const matches = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("pt-BR");
    if (normalized.length < 2) return [];
    return [
      ...new Map((kind === "inquerito" ? cases : reports).map((item) => [item.id, item])).values(),
    ]
      .filter((item) => {
        const text =
          "numero_ppe" in item
            ? `${item.numero_ppe || ""} ${item.tipo || ""} ${item.tipificacao || ""}`
            : `${item.numero_bo} ${item.infracao_penal}`;
        return (
          text.toLocaleLowerCase("pt-BR").includes(normalized) &&
          !links.some(
            (link) =>
              (target.kind === "person"
                ? link.pessoa_id === target.id
                : link.organizacao_id === target.id) &&
              (kind === "inquerito" ? link.inquerito_id === item.id : link.bo_id === item.id),
          )
        );
      })
      .slice(0, 6);
  }, [cases, kind, links, query, reports, target.id, target.kind]);

  async function add(item: InqueritoRecord | BoRecord) {
    if (saving || loading) return;
    setSaving(true);
    setError("");
    try {
      const isCase = kind === "inquerito";
      const input = {
        ...(target.kind === "person" ? { pessoa_id: target.id } : { organizacao_id: target.id }),
        ...(isCase ? { inquerito_id: item.id } : { bo_id: item.id }),
      };
      const created = preview
        ? null
        : await import("@/lib/repositories/nexoIntegrationsRepository").then((repo) =>
            repo.createNexoRegistroVinculado(input),
          );
      updateRecords([
        {
          id: created?.id || crypto.randomUUID(),
          pessoa_id: target.kind === "person" ? target.id : null,
          organizacao_id: target.kind === "organization" ? target.id : null,
          inquerito_id: isCase ? item.id : null,
          bo_id: isCase ? null : item.id,
          observacao: null,
          created_at: created?.created_at || new Date().toISOString(),
          inquerito: isCase
            ? {
                numero_ppe: "numero_ppe" in item ? item.numero_ppe : null,
                tipo: "tipo" in item ? item.tipo : null,
                situacao: "situacao" in item ? item.situacao : null,
              }
            : null,
          bo: !isCase
            ? {
                numero_bo: ("numero_bo" in item ? item.numero_bo : "") ?? "",
                infracao_penal: ("infracao_penal" in item ? item.infracao_penal : "") ?? "",
                status: ("status" in item ? item.status : "") ?? "",
              }
            : null,
        },
        ...allRecords,
      ]);
      setQuery("");
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível vincular o procedimento.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function remove(linkId: string) {
    if (saving) return;
    if (confirmRemoveId !== linkId) {
      setConfirmRemoveId(linkId);
      return;
    }
    setSaving(true);
    setError("");
    try {
      if (!preview) {
        const repo = await import("@/lib/repositories/nexoIntegrationsRepository");
        await repo.deleteNexoRegistroVinculado(linkId);
      }
      updateRecords(allRecords.filter((item) => item.id !== linkId));
      setConfirmRemoveId(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível remover o vínculo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-[#6d8193]">
        {target.kind === "organization"
          ? "Procedimentos vinculados diretamente à facção e aos integrantes relacionados."
          : "Procedimentos vinculados somente a esta pessoa."}{" "}
        O vínculo é registrado sem alterar o B.O. ou o inquérito original.
      </p>
      {links.length ? (
        links.map((link) => {
          const isCase = Boolean(link.inquerito_id);
          const href = isCase ? `/inqueritos/${link.inquerito_id}` : `/bo/${link.bo_id}`;
          return (
            <div
              key={link.id}
              className="flex items-center gap-2 rounded-2xl border border-[#e2eaf1] bg-white p-2 transition-colors hover:border-[#a7cada]"
            >
              <a
                href={preview ? undefined : href}
                className="flex min-w-0 flex-1 items-center gap-3 p-2"
              >
                <span className="rounded-xl bg-[#ecf3f9] p-2 text-[#2d668b]">
                  <FileText className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <strong className="block text-sm font-black text-[#19334c]">
                    {isCase ? value(link.inquerito?.numero_ppe) : value(link.bo?.numero_bo)}
                  </strong>
                  <small className="mt-0.5 block truncate text-xs text-[#567184]">
                    {isCase
                      ? `${value(link.inquerito?.tipo)} · ${value(link.inquerito?.situacao)}`
                      : `${value(link.bo?.infracao_penal)} · ${value(link.bo?.status)}`}
                  </small>
                  {target.kind === "organization" ? (
                    <small className="mt-1 block text-[11px] font-semibold text-[#467e92]">
                      {link.pessoa_id
                        ? `Pessoa: ${people.find((person) => person.id === link.pessoa_id)?.nome || "Integrante"}`
                        : "Vínculo direto com a facção"}
                    </small>
                  ) : null}
                </span>
                <span className="rounded-full bg-[#edf4f8] px-2 py-1 text-[11px] font-bold text-[#42718e]">
                  {isCase ? "INQUÉRITO" : "B.O."}
                </span>
                <ChevronRight className="h-4 w-4 text-[#567184]" />
              </a>
              <button
                type="button"
                disabled={saving}
                onClick={() => void remove(link.id)}
                className={`inline-flex items-center gap-1 rounded-xl border px-3 py-2 text-[11px] font-black transition ${
                  confirmRemoveId === link.id
                    ? "border-red-300 bg-red-600 text-white"
                    : "border-red-100 bg-red-50 text-red-600 hover:border-red-200"
                }`}
              >
                <Unlink className="h-3.5 w-3.5" />
                {confirmRemoveId === link.id ? "Confirmar" : "Desvincular"}
              </button>
            </div>
          );
        })
      ) : (
        <div className="rounded-2xl border border-dashed border-[#d4e0e9] bg-white p-6 text-center text-sm text-[#567184]">
          Nenhum procedimento vinculado.
        </div>
      )}
      <div className="rounded-2xl border border-[#dce7ee] bg-[#f4f8fb] p-4">
        <strong className="text-sm text-[#203e57]">Vincular registro existente</strong>
        <div className="mt-3 flex gap-2">
          {(["inquerito", "bo"] as const).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => {
                setKind(item);
                setQuery("");
              }}
              className={`rounded-lg px-3 py-2 text-xs font-bold ${kind === item ? "bg-[#173d5b] text-white" : "bg-white text-[#6b8195]"}`}
            >
              {item === "bo" ? "B.O." : "Inquérito"}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Digite número ou assunto…"
          className="mt-3 h-11 w-full rounded-xl border border-[#d6e2eb] bg-white px-3 text-sm text-[#203e57] outline-none focus:border-[#3485a2]"
        />
        <div className="mt-2 space-y-1">
          {matches.map((item) => (
            <button
              key={item.id}
              type="button"
              disabled={saving || loading}
              onClick={() => void add(item)}
              className="flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-xs text-[#344f64] hover:bg-[#e8f5f8] disabled:opacity-50"
            >
              <span className="min-w-0 flex-1 truncate">
                {"numero_ppe" in item ? item.numero_ppe || "Sem nº PPE" : item.numero_bo} ·{" "}
                {"numero_ppe" in item ? item.tipificacao || item.tipo : item.infracao_penal}
              </span>
              <Plus className="h-4 w-4 text-[#177f9a]" />
            </button>
          ))}
        </div>
        {loading ? (
          <p role="status" className="mt-2 text-xs text-[#567184]">
            Carregando registros disponíveis…
          </p>
        ) : query.trim().length >= 2 && matches.length === 0 ? (
          <p className="mt-2 text-xs text-[#567184]">Nenhum registro disponível para essa busca.</p>
        ) : null}
      </div>
      {error ? (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function NexoDossier({
  target,
  organizations,
  people,
  territories,
  records,
  onProcedureRecordsChange,
  previewHierarchyEvents = [],
  previewNotes = [],
  onPreviewNoteCreated,
  preview,
  onClose,
  onOpen,
  onReport,
  onEdit,
  onUploadPhoto,
  onCreateLink,
  onManageLink,
  onCreatePersonForOrganization,
  onCreateTerritoryForOrganization,
  onDeleteTerritory,
}: {
  target: DossierTarget;
  organizations: NexoOrganizacao[];
  people: NexoPessoa[];
  territories: NexoTerritorio[];
  records: NexoRegistroVinculado[];
  onProcedureRecordsChange?: (records: NexoRegistroVinculado[]) => void;
  previewHierarchyEvents?: NexoHierarquiaEvento[];
  previewNotes?: NexoObservacao[];
  onPreviewNoteCreated?: (note: NexoObservacao) => void;
  preview: boolean;
  onClose: () => void;
  onOpen: (target: DossierTarget) => void;
  onReport: () => void;
  onEdit: (target: DossierTarget) => void;
  onUploadPhoto: (person: NexoPessoa, file: File) => Promise<void>;
  onCreateLink: (input: NexoLinkInput) => Promise<void>;
  onManageLink: (input: NexoVinculoManagementInput) => Promise<void>;
  onCreatePersonForOrganization: (organizationId: string) => void;
  onCreateTerritoryForOrganization: (organizationId: string) => void;
  onDeleteTerritory: (territoryId: string) => Promise<void>;
}) {
  const [tab, setTab] = useState<Tab>("resumo");
  const [expanded, setExpanded] = useState(target.kind === "organization");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [managedLink, setManagedLink] = useState<{ person: NexoPessoa; link: NexoVinculo } | null>(
    null,
  );
  const [savedHierarchyEvents, setSavedHierarchyEvents] = useState<NexoHierarquiaEvento[]>([]);
  const [hierarchyError, setHierarchyError] = useState("");
  const [selectedTerritory, setSelectedTerritory] = useState<NexoTerritorio | null>(null);
  const [removingTerritoryId, setRemovingTerritoryId] = useState<string | null>(null);
  const [territoryError, setTerritoryError] = useState("");

  async function removeTerritory(id: string) {
    if (removingTerritoryId) return;
    setRemovingTerritoryId(id);
    setTerritoryError("");
    try {
      await onDeleteTerritory(id);
      setSelectedTerritory((current) => (current?.id === id ? null : current));
    } catch (cause) {
      setTerritoryError(
        cause instanceof Error ? cause.message : "Não foi possível remover o local.",
      );
    } finally {
      setRemovingTerritoryId(null);
    }
  }
  const [memberFilters, setMemberFilters] = useState<NexoMemberFilters>({
    ...EMPTY_MEMBER_FILTERS,
  });
  const organization =
    target.kind === "organization" ? organizations.find((item) => item.id === target.id) : null;
  const person = target.kind === "person" ? people.find((item) => item.id === target.id) : null;
  const hierarchyEvents = preview
    ? previewHierarchyEvents.filter((event) =>
        person ? event.pessoa_id === person.id : event.organizacao_id === organization?.id,
      )
    : savedHierarchyEvents;
  useEffect(() => {
    if (preview) return;
    let active = true;
    import("@/lib/repositories/nexoRepository")
      .then((repo) =>
        repo.listNexoHierarquiaEventos(
          target.kind === "person" ? { pessoa_id: target.id } : { organizacao_id: target.id },
        ),
      )
      .then((events) => {
        if (active) {
          setSavedHierarchyEvents(events);
          setHierarchyError("");
        }
      })
      .catch((cause) => {
        if (active)
          setHierarchyError(
            cause instanceof Error ? cause.message : "Falha ao carregar histórico.",
          );
      });
    return () => {
      active = false;
    };
  }, [preview, target.id, target.kind, people]);
  const linkedPeople = organization
    ? people.filter((item) => item.vinculos.some((link) => link.organizacao_id === organization.id))
    : [];
  const linkedTerritories = organization
    ? territories.filter((item) => item.organizacao_id === organization.id)
    : [];
  const scopedRecords = selectNexoRecords(
    target.kind === "person"
      ? { kind: "pessoa", pessoaId: target.id }
      : { kind: "organizacao", organizacaoId: target.id },
    people,
    records,
  );
  const organizationLinks = organization
    ? linkedPeople.flatMap((item) =>
        item.vinculos.filter((link) => link.organizacao_id === organization.id),
      )
    : [];
  const organizationMembers = organization
    ? linkedPeople.map((person) => ({
        person,
        link: person.vinculos.find((entry) => entry.organizacao_id === organization.id),
      }))
    : [];
  const currentOrganizationMembers = organizationMembers.filter(
    ({ link }) => link?.status !== "desvinculado",
  );
  const filteredOrganizationMembers = filterNexoOrganizationMembers(
    organizationMembers,
    scopedRecords,
    memberFilters,
  );
  const filteredCurrentOrganizationMembers = filteredOrganizationMembers.filter(
    ({ link }) => link?.status !== "desvinculado",
  );
  const leadershipMembers = filteredCurrentOrganizationMembers.filter(({ link }) =>
    isLeadershipRole(link?.funcao),
  );
  const regularMembers = filteredCurrentOrganizationMembers.filter(
    ({ link }) => !isLeadershipRole(link?.funcao),
  );
  const formerMembers = filteredOrganizationMembers.filter(
    ({ link }) => link?.status === "desvinculado",
  );
  const memberRoles = Array.from(
    new Set(
      organizationMembers.flatMap(({ link }) => (link?.funcao?.trim() ? [link.funcao.trim()] : [])),
    ),
  ).sort((first, second) => first.localeCompare(second, "pt-BR"));
  const memberNeighborhoods = Array.from(
    new Set(
      organizationMembers.flatMap(({ person }) =>
        person.endereco?.bairro?.trim() ? [person.endereco.bairro.trim()] : [],
      ),
    ),
  ).sort((first, second) => first.localeCompare(second, "pt-BR"));
  const memberFiltersActive = hasActiveMemberFilters(memberFilters);
  const averageConfidence = organizationLinks.length
    ? Math.round(
        organizationLinks.reduce((total, link) => total + link.confianca, 0) /
          organizationLinks.length,
      )
    : 0;
  const timeline = [
    ...(organization
      ? [
          {
            id: `created-${organization.id}`,
            date: organization.created_at,
            title: "Dossiê da facção criado",
            detail: organization.nome,
          },
          ...linkedTerritories.map((territory) => ({
            id: `territory-${territory.id}`,
            date: territory.created_at,
            title: "Território relacionado",
            detail: `${territory.bairro} · ${territory.classificacao.replaceAll("_", " ")}`,
          })),
        ]
      : []),
    ...(person
      ? [
          {
            id: `created-${person.id}`,
            date: person.created_at,
            title: "Ficha individual criada",
            detail: person.nome,
          },
          ...person.vinculos
            .filter((link) => link.desde)
            .map((link) => ({
              id: `link-${link.id}`,
              date: link.desde || person.created_at,
              title: "Vínculo relacional registrado",
              detail: `${link.organizacao?.nome || "Facção"} · ${LINK_LABELS[link.status]}`,
            })),
        ]
      : []),
    ...scopedRecords.map((record) => ({
      id: `record-${record.id}`,
      date: record.created_at,
      title: record.inquerito_id ? "Inquérito relacionado" : "B.O. relacionado",
      detail: record.inquerito_id
        ? value(record.inquerito?.numero_ppe)
        : value(record.bo?.numero_bo),
    })),
    ...hierarchyEvents.map((event) => ({
      id: `hierarchy-${event.id}`,
      date: event.ocorrido_em,
      title:
        event.tipo === "entrada"
          ? "Entrada na hierarquia"
          : event.tipo === "saida"
            ? "Saída da facção"
            : "Hierarquia alterada",
      detail: `${event.pessoa_nome} · ${event.funcao_anterior || "Sem cargo"} → ${event.funcao_nova || "Sem cargo"}${event.superior_anterior_nome !== event.superior_novo_nome ? ` · Chefia: ${event.superior_anterior_nome || "Não definida"} → ${event.superior_novo_nome || "Não definida"}` : ""}`,
    })),
  ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const tabs: { id: Tab; label: string }[] =
    target.kind === "person"
      ? [
          { id: "resumo", label: "Visão geral" },
          { id: "vinculos", label: "Vínculos" },
          { id: "procedimentos", label: "B.O. e inquéritos" },
          { id: "galeria", label: "Galeria" },
          { id: "localizacao", label: "Localização" },
          { id: "veiculos", label: "Veículos" },
          { id: "historico", label: "Linha do tempo" },
          { id: "observacoes", label: "Observações" },
        ]
      : [
          { id: "resumo", label: "Visão geral" },
          { id: "vinculos", label: "Integrantes" },
          { id: "procedimentos", label: "B.O. e inquéritos" },
          { id: "localizacao", label: "Territórios" },
          { id: "veiculos", label: "Veículos" },
          { id: "historico", label: "Linha do tempo" },
          { id: "observacoes", label: "Observações" },
        ];

  useEffect(() => {
    setTab("resumo");
    setMemberFilters({ ...EMPTY_MEMBER_FILTERS });
  }, [target.id, target.kind]);
  if (!organization && !person) return null;
  const title = person?.nome || organization?.nome || "Dossiê";
  const organizationTheme = organization ? factionHeaderTheme(organization.cor) : null;

  if (person && !expanded) {
    const photoUrl = getNexoPersonPhotoUrl(person);
    return (
      <div
        className="fixed inset-0 z-[80] flex justify-end bg-[#061729]/55 backdrop-blur-sm"
        onMouseDown={onClose}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label={`Resumo de ${person.nome}`}
          onMouseDown={(event) => event.stopPropagation()}
          className="nexo-themed m-3 max-h-[calc(100dvh-24px)] w-[min(540px,calc(100vw-24px))] self-start overflow-y-auto rounded-[24px] border border-[#d8e5ec] bg-white shadow-[-24px_0_80px_rgba(5,25,46,.3)] sm:m-6 sm:max-h-[calc(100dvh-48px)]"
        >
          <div className="flex items-start gap-4 border-b border-[#e2eaf0] p-6">
            {photoUrl ? (
              <img
                src={photoUrl}
                alt={`Foto de ${person.nome}`}
                className="nexo-dossier-photo h-16 w-16 shrink-0 rounded-2xl border border-[#d5e6ec] object-cover"
              />
            ) : (
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-[#e5f1f5] text-[#167e97]">
                <UserRound className="h-6 w-6" />
              </span>
            )}
            <div className="min-w-0 flex-1">
              <span className="text-[11px] font-black uppercase tracking-[.18em] text-[#4b9bb0]">
                Prévia da pessoa
              </span>
              <h2 className="mt-1 text-xl font-black leading-tight text-[#15344e]">
                {person.nome}
              </h2>
              <p className="mt-1 text-sm text-[#72889a]">
                {person.apelido ? `“${person.apelido}”` : "Sem alcunha registrada"}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar resumo"
              className="rounded-xl border border-[#dce5ed] p-2 text-[#567184] hover:bg-[#f4f8fb]"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="p-6">
            <div className="rounded-2xl border border-[#dce9ef] bg-[#f4f9fb] p-5">
              <LockKeyhole className="h-6 w-6 text-[#287c96]" />
              <h3 className="mt-3 text-sm font-black text-[#1f425b]">Dados operacionais ocultos</h3>
              <p className="mt-2 text-xs leading-relaxed text-[#678092]">
                Identificação completa, vínculos, B.O., inquéritos, fotos e localização estão no
                dossiê individual.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setExpanded(true)}
              aria-expanded="false"
              className="nexo-action-primary mt-5 w-full"
            >
              <LockKeyhole className="h-4 w-4" /> Mostrar Informações Sigilosas
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-[#f6f9fc]" onMouseDown={onClose}>
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Dossiê de ${title}`}
        onMouseDown={(event) => event.stopPropagation()}
        className="nexo-dossier nexo-themed h-full w-full overflow-y-auto bg-[#eef3f7]"
        data-organization-theme={Boolean(organizationTheme)}
      >
        <header
          className={`nexo-dossier-header sticky top-0 z-10 border-b backdrop-blur ${organizationTheme ? "shadow-[0_14px_35px_-25px_rgba(0,0,0,.8)]" : "border-[#dbe5ee] bg-white/95"}`}
          style={
            organizationTheme
              ? {
                  background: organizationTheme.background,
                  borderColor: organizationTheme.border,
                  color: organizationTheme.foreground,
                }
              : undefined
          }
        >
          <div className="mx-auto grid max-w-[1500px] grid-cols-[minmax(0,1fr)_auto] items-start gap-4 px-5 pb-5 pt-6 sm:px-7 sm:pt-7 xl:grid-cols-[minmax(0,1fr)_auto_auto]">
            <div className="flex min-w-0 items-start gap-4">
              {person && getNexoPersonPhotoUrl(person) ? (
                <img
                  src={getNexoPersonPhotoUrl(person) || ""}
                  alt={`Foto de ${person.nome}`}
                  className="nexo-dossier-photo h-16 w-16 shrink-0 rounded-2xl object-cover sm:h-[72px] sm:w-[72px]"
                />
              ) : (
                <span
                  className={`flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${organizationTheme ? "border" : "bg-[#e5f1f5] text-[#167e97]"}`}
                  style={
                    organizationTheme
                      ? {
                          backgroundColor: organizationTheme.surface,
                          borderColor: organizationTheme.border,
                          color: organizationTheme.foreground,
                        }
                      : undefined
                  }
                >
                  {person ? <UserRound className="h-7 w-7" /> : <Building2 className="h-7 w-7" />}
                </span>
              )}
              <div className="min-w-0 flex-1">
                <span
                  className={`text-[11px] font-black uppercase tracking-[.2em] ${organizationTheme ? "" : "text-[#4b9bb0]"}`}
                  style={organizationTheme ? { color: organizationTheme.muted } : undefined}
                >
                  {person ? "Dossiê individual" : "Dossiê de facção"}
                </span>
                <h2
                  className={`mt-1 text-[25px] font-extrabold leading-tight tracking-[-.035em] sm:text-[30px] ${organizationTheme ? "" : "text-[#15344e]"}`}
                  style={organizationTheme ? { color: organizationTheme.foreground } : undefined}
                >
                  {title}
                </h2>
                <p
                  className={`mt-1 text-sm ${organizationTheme ? "" : "text-[#6e8294]"}`}
                  style={organizationTheme ? { color: organizationTheme.muted } : undefined}
                >
                  {person
                    ? person.apelido
                      ? `“${person.apelido}”`
                      : "Sem alcunha registrada"
                    : `${organization?.sigla || "Sem sigla"} · Risco ${organization?.nivel_risco}`}
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar dossiê"
              className={`col-start-2 row-start-1 rounded-xl xl:col-start-3 border p-2 transition ${organizationTheme ? "" : "border-[#dce5ed] text-[#567184] hover:bg-[#f4f8fb]"}`}
              style={
                organizationTheme
                  ? {
                      backgroundColor: organizationTheme.surface,
                      borderColor: organizationTheme.border,
                      color: organizationTheme.foreground,
                    }
                  : undefined
              }
            >
              <X className="h-5 w-5" />
            </button>
            <div className="col-span-2 flex flex-wrap items-center gap-2 xl:col-span-1 xl:col-start-2 xl:row-start-1">
              {person ? (
                <button
                  type="button"
                  onClick={() => setExpanded(false)}
                  className="inline-flex rounded-xl border border-[#dce5ed] px-3 py-2 text-xs font-bold text-[#567184] hover:bg-[#f4f8fb]"
                >
                  Voltar ao resumo
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => onEdit(target)}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black transition hover:brightness-105 ${organizationTheme ? "" : "border-[#cddce6] bg-white text-[#36566d] hover:bg-[#f4f8fb]"}`}
                style={
                  organizationTheme
                    ? {
                        backgroundColor: organizationTheme.surface,
                        borderColor: organizationTheme.border,
                        color: organizationTheme.foreground,
                      }
                    : undefined
                }
              >
                <Pencil className="h-4 w-4" /> Editar cadastro
              </button>
              <button
                type="button"
                onClick={onReport}
                className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-black shadow-lg transition hover:brightness-105 ${organizationTheme ? "" : "border-[#173d5b] bg-[#173d5b] text-white shadow-[#173d5b]/20"}`}
                style={
                  organizationTheme
                    ? {
                        backgroundColor: organizationTheme.foreground,
                        borderColor: organizationTheme.foreground,
                        color: organizationTheme.accent,
                        boxShadow: "0 10px 28px -14px rgba(0,0,0,.65)",
                      }
                    : undefined
                }
              >
                <Printer className="h-4 w-4" /> Gerar relatório
              </button>
            </div>
          </div>
          <nav
            aria-label="Seções do dossiê"
            className="nexo-dossier-navigation mx-auto flex max-w-[1500px] gap-1 overflow-x-auto px-5 sm:px-7"
          >
            {tabs.map((item) => {
              const Icon = TAB_ICONS[item.id];
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  aria-current={tab === item.id ? "page" : undefined}
                  className={`inline-flex min-h-12 shrink-0 items-center gap-2 whitespace-nowrap border-b-[3px] px-3 py-3 text-xs font-semibold transition ${
                    organizationTheme
                      ? tab === item.id
                        ? "border-current"
                        : "border-transparent opacity-70 hover:opacity-100"
                      : tab === item.id
                        ? "border-[#1597b1] text-[#1a6786]"
                        : "border-transparent text-[#567184] hover:text-[#436174]"
                  }`}
                  style={organizationTheme ? { color: organizationTheme.foreground } : undefined}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </header>
        <div className="mx-auto max-w-[1500px] space-y-5 p-5 sm:p-7">
          {tab === "resumo" && person ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="CPF">{value(person.cpf)}</Detail>
                <Detail label="RG">{value(person.rg)}</Detail>
                <Detail label={person.idade_aproximada ? "Idade estimada" : "Nascimento"}>
                  {person.idade_aproximada
                    ? person.idade_aproximada_valor != null
                      ? `${person.idade_aproximada_valor} anos`
                      : "Não informada"
                    : value(person.data_nascimento)}
                </Detail>
                <Detail label="Naturalidade">{value(person.naturalidade)}</Detail>
                <Detail label="Filiação materna">{value(person.nome_mae)}</Detail>
                <Detail label="Filiação paterna">{value(person.nome_pai)}</Detail>
                <Detail label="Telefone">{value(person.telefone)}</Detail>
                <Detail label="Ficha criada">{person.created_at.slice(0, 10)}</Detail>
                <Detail label="Nome social">{value(person.nome_social)}</Detail>
                <Detail label="Sexo">{value(person.sexo)}</Detail>
                <Detail label="Raça / cor">{value(person.raca_cor)}</Detail>
                <Detail label="Estado civil">{value(person.estado_civil)}</Detail>
                <Detail label="Nacionalidade">{value(person.nacionalidade)}</Detail>
                <Detail label="Escolaridade">{value(person.escolaridade)}</Detail>
                <Detail label="Profissão">{value(person.profissao)}</Detail>
                <Detail label="Identificação visual">
                  {[person.tipo_fisico, person.altura_cm ? `${person.altura_cm} cm` : null]
                    .filter(Boolean)
                    .join(" · ") || "Não informado"}
                </Detail>
              </div>
              <div className="rounded-2xl border border-[#dde8f0] bg-white p-5">
                <h3 className="flex items-center gap-2 text-sm font-black text-[#1e405b]">
                  <ShieldCheck className="h-4 w-4 text-[#1a9eaa]" /> Leitura analítica
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-[#5e7487]">
                  {value(person.observacoes)}
                </p>
                <p className="mt-4 text-xs font-semibold text-[#567184]">
                  {person.vinculos.length} vínculo(s) registrado(s) · {person.fotos.length} foto(s)
                  no álbum
                </p>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="rounded-2xl border border-[#dde8f0] bg-white p-5">
                  <h3 className="text-sm font-black text-[#1e405b]">Documentos adicionais</h3>
                  <div className="mt-3 space-y-2">
                    {(person.documentos_extras ?? []).map((documento) => (
                      <div
                        key={documento.id}
                        className="flex justify-between gap-3 rounded-xl bg-[#f5f8fa] px-3 py-2 text-xs"
                      >
                        <strong className="text-[#31536a]">{documento.tipo}</strong>
                        <span className="text-[#758a9b]">{documento.numero || "Sem número"}</span>
                      </div>
                    ))}
                    {!person.documentos_extras?.length ? (
                      <p className="text-xs text-[#567184]">Nenhum documento complementar.</p>
                    ) : null}
                  </div>
                </div>
                <div className="rounded-2xl border border-[#dde8f0] bg-white p-5">
                  <h3 className="text-sm font-black text-[#1e405b]">Contatos e redes sociais</h3>
                  <div className="mt-3 space-y-2">
                    {(person.contatos ?? []).map((contato) => (
                      <div
                        key={contato.id}
                        className="flex justify-between gap-3 rounded-xl bg-[#f5f8fa] px-3 py-2 text-xs"
                      >
                        <strong className="text-[#31536a]">
                          {contato.tipo}
                          {contato.whatsapp ? " · WhatsApp" : ""}
                        </strong>
                        <span className="text-[#758a9b]">{contato.valor || "Não informado"}</span>
                      </div>
                    ))}
                    {!person.contatos?.length ? (
                      <p className="text-xs text-[#567184]">Nenhum contato complementar.</p>
                    ) : null}
                  </div>
                </div>
              </div>
              {person.idade_aproximada ||
              person.em_situacao_rua ||
              person.usa_tornozeleira ||
              person.sinais_particulares ? (
                <div className="rounded-2xl border border-[#f1d7a7] bg-[#fffaf0] p-5">
                  <h3 className="text-sm font-black text-[#72501c]">
                    Observações de identificação
                  </h3>
                  <p className="mt-2 text-xs leading-relaxed text-[#806c4b]">
                    {[
                      person.idade_aproximada ? "idade aproximada" : null,
                      person.em_situacao_rua ? "situação de rua" : null,
                      person.usa_tornozeleira ? "tornozeleira eletrônica" : null,
                      person.sinais_particulares,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ) : null}
            </>
          ) : null}
          {tab === "resumo" && organization ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Detail label="Integrantes relacionados">{linkedPeople.length}</Detail>
                <Detail label="Áreas registradas">{linkedTerritories.length}</Detail>
                <Detail label="Procedimentos relacionados">{scopedRecords.length}</Detail>
                <Detail label="Confiança média">{averageConfidence}%</Detail>
              </div>
              <div className="rounded-2xl border border-[#dde8f0] bg-white p-5">
                <h3 className="text-sm font-black text-[#1e405b]">Síntese operacional</h3>
                <p className="mt-3 text-sm leading-relaxed text-[#5e7487]">
                  {value(organization.descricao)}
                </p>
                <div className="mt-4 rounded-xl bg-[#f4f8fb] p-3 text-xs text-[#677f93]">
                  <strong className="text-[#315772]">Área declarada:</strong>{" "}
                  {value(organization.area_atuacao)}
                </div>
              </div>
              <div className="rounded-2xl border border-[#dde8f0] bg-white p-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-black text-[#1e405b]">Pessoas vinculadas</h3>
                    <p className="mt-1 text-xs text-[#567184]">
                      Abra uma ficha individual para consultar os dados e procedimentos próprios.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreatePersonForOrganization(organization.id)}
                    className="inline-flex items-center gap-2 rounded-xl bg-[#173d5b] px-3 py-2 text-xs font-bold text-white hover:bg-[#205575]"
                  >
                    <Plus className="h-4 w-4" /> Cadastrar pessoa vinculada
                  </button>
                </div>
                {organizationMembers.length ? (
                  <MemberFilterPanel
                    filters={memberFilters}
                    roles={memberRoles}
                    neighborhoods={memberNeighborhoods}
                    resultCount={filteredOrganizationMembers.length}
                    totalCount={organizationMembers.length}
                    onChange={setMemberFilters}
                  />
                ) : null}
                {filteredCurrentOrganizationMembers.length ? (
                  <div className="mt-5 space-y-5">
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <Crown className="h-4 w-4 text-[#19889f]" />
                        <h4 className="text-[11px] font-black uppercase tracking-[.14em] text-[#315a72]">
                          Liderança
                        </h4>
                        <span className="rounded-full bg-[#e8f5f7] px-2 py-0.5 text-[11px] font-black text-[#27879a]">
                          {leadershipMembers.length}
                        </span>
                      </div>
                      {leadershipMembers.length ? (
                        <LeadershipTree
                          members={leadershipMembers}
                          allMembers={currentOrganizationMembers}
                          onOpen={(item) => onOpen({ kind: "person", id: item.id })}
                          onManage={(item, link) => setManagedLink({ person: item, link })}
                        />
                      ) : (
                        <div className="rounded-2xl border border-dashed border-[#cbdde6] bg-[#f7fafc] px-4 py-3 text-xs text-[#567184]">
                          Liderança ainda não identificada. Informe a função no vínculo do membro
                          para destacá-lo aqui.
                        </div>
                      )}
                    </section>
                    <section>
                      <div className="mb-3 flex items-center gap-2">
                        <UserRound className="h-4 w-4 text-[#698497]" />
                        <h4 className="text-[11px] font-black uppercase tracking-[.14em] text-[#587186]">
                          Demais integrantes
                        </h4>
                        <span className="rounded-full bg-[#eef3f6] px-2 py-0.5 text-[11px] font-black text-[#6b8191]">
                          {regularMembers.length}
                        </span>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {regularMembers.map(({ person: item, link }) => (
                          <OrganizationMemberCard
                            key={item.id}
                            person={item}
                            link={link}
                            superiorName={
                              currentOrganizationMembers.find(
                                (member) => member.link?.id === link?.superior_vinculo_id,
                              )?.person.nome
                            }
                            leadership={false}
                            onOpen={() => onOpen({ kind: "person", id: item.id })}
                            onManage={
                              link ? () => setManagedLink({ person: item, link }) : undefined
                            }
                          />
                        ))}
                      </div>
                    </section>
                  </div>
                ) : (
                  <p className="mt-4 text-sm text-[#567184]">
                    {memberFiltersActive
                      ? "Nenhum integrante ativo corresponde aos filtros selecionados."
                      : "Nenhuma pessoa relacionada até o momento."}
                  </p>
                )}
              </div>
              <p className="text-xs text-[#567184]">
                A presença de uma pessoa no dossiê depende de um vínculo registrado, com status e
                grau de confiança próprios.
              </p>
              <section className="overflow-hidden rounded-2xl border border-[#dde8f0] bg-white">
                <div className="flex flex-wrap items-center justify-between gap-3 p-5">
                  <div className="flex items-start gap-3">
                    <span
                      className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                      style={{ backgroundColor: organization.cor || "#3578a7" }}
                    >
                      <MapPinned className="h-5 w-5" />
                    </span>
                    <div>
                      <h3 className="text-sm font-black text-[#1e405b]">Mapa territorial</h3>
                      <p className="mt-1 text-xs text-[#567184]">
                        Locais e áreas de atuação de {organization.nome}, identificados pela cor da
                        facção.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => onCreateTerritoryForOrganization(organization.id)}
                    className="inline-flex items-center gap-2 rounded-xl border border-[#cbdde7] bg-white px-3 py-2 text-xs font-bold text-[#365a71] hover:bg-[#f3f8fa]"
                  >
                    <Plus className="h-4 w-4" /> Adicionar local
                  </button>
                </div>
                <div
                  className="h-1 w-full"
                  style={{ backgroundColor: organization.cor || "#3578a7" }}
                  aria-hidden="true"
                />
                <div className="p-3 sm:p-5">
                  <NexoTerritoryMap
                    territories={linkedTerritories}
                    organizations={[organization]}
                    selectedId={selectedTerritory?.id || null}
                    onSelect={setSelectedTerritory}
                    people={linkedPeople}
                    onPersonSelect={(item) => onOpen({ kind: "person", id: item.id })}
                  />
                </div>
              </section>
            </>
          ) : null}
          {tab === "vinculos" && person ? (
            <div className="space-y-3">
              <NexoLinkForm
                person={person}
                organizations={organizations}
                people={people}
                onSave={onCreateLink}
              />
              {person.vinculos.length ? (
                person.vinculos.map((link) => (
                  <div key={link.id} className="flex items-stretch gap-2">
                    <button
                      type="button"
                      onClick={() => onOpen({ kind: "organization", id: link.organizacao_id })}
                      className="min-w-0 flex-1 rounded-2xl border border-[#dde8f0] bg-white p-4 text-left hover:border-[#8fbecd]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <strong className="text-sm text-[#1e405b]">
                          {link.organizacao?.nome || "Facção"}
                        </strong>
                        <span className="rounded-full bg-[#edf5f8] px-2 py-1 text-[11px] font-bold text-[#367c91]">
                          {LINK_LABELS[link.status]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-[#567184]">
                        Função: {value(link.funcao)} · Confiança: {link.confianca}%
                      </p>
                      <p className="mt-3 text-xs leading-relaxed text-[#61778a]">
                        Fonte: {value(link.fonte_resumo)}
                      </p>
                    </button>
                    {link.status !== "desvinculado" ? (
                      <button
                        type="button"
                        onClick={() => setManagedLink({ person, link })}
                        className="flex w-14 shrink-0 items-center justify-center rounded-2xl border border-[#cfe1e8] bg-[#eef7f9] text-[#27788d] hover:bg-[#dceef2]"
                        aria-label={`Gerenciar vínculo com ${link.organizacao?.nome || "facção"}`}
                        title="Alterar cargo, transferir ou remover"
                      >
                        <UserCog className="h-5 w-5" />
                      </button>
                    ) : null}
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-[#d4e0e9] p-6 text-center text-sm text-[#567184]">
                  Nenhum vínculo com facção foi cadastrado.
                </div>
              )}
            </div>
          ) : null}
          {tab === "vinculos" && organization ? (
            <div className="space-y-6">
              {organizationMembers.length ? (
                <MemberFilterPanel
                  filters={memberFilters}
                  roles={memberRoles}
                  neighborhoods={memberNeighborhoods}
                  resultCount={filteredOrganizationMembers.length}
                  totalCount={organizationMembers.length}
                  onChange={setMemberFilters}
                />
              ) : null}
              {filteredOrganizationMembers.length ? (
                <>
                  <section className="rounded-[22px] border border-[#c9e1e7] bg-[#eef8fa] p-4 sm:p-5">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <Crown className="h-5 w-5 text-[#137e95]" />
                          <h3 className="text-sm font-black text-[#173f58]">Liderança da facção</h3>
                        </div>
                        <p className="mt-1 text-xs text-[#688596]">
                          Integrantes com função de comando ou responsabilidade operacional.
                        </p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#27879a] shadow-sm">
                        {leadershipMembers.length} identificado(s)
                      </span>
                    </div>
                    {leadershipMembers.length ? (
                      <LeadershipTree
                        members={leadershipMembers}
                        allMembers={currentOrganizationMembers}
                        onOpen={(item) => onOpen({ kind: "person", id: item.id })}
                        onManage={(item, link) => setManagedLink({ person: item, link })}
                      />
                    ) : (
                      <div className="rounded-2xl border border-dashed border-[#a9ced7] bg-white/70 p-5 text-center">
                        <Crown className="mx-auto h-6 w-6 text-[#7aa8b5]" />
                        <p className="mt-2 text-xs font-bold text-[#557687]">
                          Nenhuma liderança identificada até o momento.
                        </p>
                        <p className="mt-1 text-[11px] text-[#567184]">
                          Edite o membro e informe sua função no vínculo para posicioná-lo aqui.
                        </p>
                      </div>
                    )}
                  </section>

                  <section>
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-[#1e405b]">Demais integrantes</h3>
                        <p className="mt-1 text-xs text-[#567184]">
                          Membros operacionais e vínculos ainda sem função de liderança.
                        </p>
                      </div>
                      <span className="rounded-full bg-[#edf3f6] px-3 py-1 text-[11px] font-black text-[#667f91]">
                        {regularMembers.length}
                      </span>
                    </div>
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                      {regularMembers.map(({ person: item, link }) => (
                        <OrganizationMemberCard
                          key={item.id}
                          person={item}
                          link={link}
                          superiorName={
                            currentOrganizationMembers.find(
                              (member) => member.link?.id === link?.superior_vinculo_id,
                            )?.person.nome
                          }
                          leadership={false}
                          onOpen={() => onOpen({ kind: "person", id: item.id })}
                          onManage={link ? () => setManagedLink({ person: item, link }) : undefined}
                        />
                      ))}
                    </div>
                  </section>

                  {formerMembers.length ? (
                    <section className="border-t border-[#dde7ed] pt-5">
                      <h3 className="text-xs font-black uppercase tracking-wider text-[#567184]">
                        Vínculos encerrados · {formerMembers.length}
                      </h3>
                      <div className="mt-3 grid gap-3 opacity-70 md:grid-cols-2 xl:grid-cols-3">
                        {formerMembers.map(({ person: item, link }) => (
                          <OrganizationMemberCard
                            key={item.id}
                            person={item}
                            link={link}
                            leadership={false}
                            onOpen={() => onOpen({ kind: "person", id: item.id })}
                          />
                        ))}
                      </div>
                    </section>
                  ) : null}
                </>
              ) : (
                <p className="rounded-2xl border border-dashed border-[#d4e0e9] p-6 text-center text-sm text-[#567184]">
                  {memberFiltersActive
                    ? "Nenhum integrante corresponde aos filtros selecionados."
                    : "Nenhuma pessoa relacionada."}
                </p>
              )}
              <section className="mt-6 border-t border-[#dde7ed] pt-5">
                <div className="flex items-center gap-2">
                  <CalendarClock className="h-4 w-4 text-[#19889f]" />
                  <h3 className="text-xs font-black uppercase tracking-wider text-[#315a72]">
                    Histórico da hierarquia
                  </h3>
                </div>
                <p className="mt-1 text-xs text-[#567184]">
                  Mudanças de cargo, chefia e vínculo, com data e responsável.
                </p>
                {hierarchyError ? (
                  <p role="alert" className="mt-3 text-xs text-red-700">
                    {hierarchyError}
                  </p>
                ) : null}
                <div className="mt-3 space-y-2">
                  {hierarchyEvents.slice(0, 20).map((event) => (
                    <div
                      key={event.id}
                      className="rounded-xl border border-[#e0eaf0] bg-[#f9fbfc] p-3 text-xs"
                    >
                      <div className="flex flex-wrap justify-between gap-2 text-[#25475d]">
                        <strong>
                          {event.pessoa_nome} ·{" "}
                          {event.tipo === "entrada"
                            ? "Entrada"
                            : event.tipo === "saida"
                              ? "Saída"
                              : "Alteração"}
                        </strong>
                        <time>{new Date(event.ocorrido_em).toLocaleString("pt-BR")}</time>
                      </div>
                      <p className="mt-1 text-[#60798b]">
                        Cargo: {event.funcao_anterior || "Não informado"} →{" "}
                        {event.funcao_nova || "Não informado"}
                      </p>
                      {event.superior_anterior_nome !== event.superior_novo_nome ? (
                        <p className="mt-1 text-[#60798b]">
                          Responde a: {event.superior_anterior_nome || "Ninguém"} →{" "}
                          {event.superior_novo_nome || "Ninguém"}
                        </p>
                      ) : null}
                      <p className="mt-1 text-[#567184]">
                        Por {event.autor?.nome || "Usuário não identificado"}
                        {event.justificativa ? ` · ${event.justificativa}` : ""}
                      </p>
                    </div>
                  ))}
                  {!hierarchyEvents.length && !hierarchyError ? (
                    <p className="text-xs text-[#567184]">Nenhuma alteração registrada ainda.</p>
                  ) : null}
                </div>
              </section>
            </div>
          ) : null}
          {tab === "procedimentos" ? (
            <ProcedurePanel
              target={target}
              preview={preview}
              people={people}
              records={records}
              onRecordsChange={onProcedureRecordsChange}
            />
          ) : null}
          {tab === "historico" ? (
            <div className="rounded-2xl border border-[#dde8f0] bg-white p-5 sm:p-6">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#e8f4f7] text-[#25859b]">
                  <CalendarClock className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="text-sm font-black text-[#1e405b]">Linha do tempo operacional</h3>
                  <p className="mt-0.5 text-xs text-[#567184]">
                    Eventos catalogados para este dossiê.
                  </p>
                </div>
              </div>
              <div className="mt-6 space-y-1">
                {timeline.map((event, index) => (
                  <div key={event.id} className="relative flex gap-4 pb-5">
                    <div className="relative flex w-5 shrink-0 justify-center">
                      <span className="mt-1.5 h-3 w-3 rounded-full border-[3px] border-white bg-[#42a9bd] shadow-[0_0_0_3px_#dff1f4]" />
                      {index < timeline.length - 1 ? (
                        <span className="absolute bottom-[-2px] top-5 w-px bg-[#d8e7ec]" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 rounded-xl border border-[#e3ebef] bg-[#f9fbfc] p-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <strong className="text-sm text-[#29495f]">{event.title}</strong>
                        <time className="text-[11px] font-bold uppercase tracking-wide text-[#567184]">
                          {new Date(event.date).toLocaleDateString("pt-BR")}
                        </time>
                      </div>
                      <p className="mt-1 text-xs text-[#708697]">{event.detail}</p>
                    </div>
                  </div>
                ))}
                {!timeline.length ? (
                  <p className="rounded-xl border border-dashed border-[#d5e1e8] p-6 text-center text-sm text-[#567184]">
                    Nenhum evento catalogado.
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}
          <div hidden={tab !== "observacoes"}>
            <NotesPanel
              target={target}
              preview={preview}
              previewNotes={previewNotes}
              onPreviewNoteCreated={onPreviewNoteCreated}
            />
          </div>
          {tab === "galeria" && person ? (
            <div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h3 className="flex items-center gap-2 text-sm font-black text-[#1e405b]">
                    <Camera className="h-4 w-4" /> Álbum complementar
                  </h3>
                  <p className="mt-1 text-xs text-[#567184]">Fotos anexadas a esta ficha.</p>
                </div>
                <label className="cursor-pointer rounded-xl bg-[#173d5b] px-3 py-2 text-xs font-bold text-white">
                  <Plus className="mr-1 inline h-4 w-4" />{" "}
                  {uploading ? "Enviando…" : "Adicionar foto"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={uploading}
                    className="hidden"
                    onChange={async (event) => {
                      const file = event.target.files?.[0];
                      if (!file) return;
                      setUploading(true);
                      setUploadError("");
                      try {
                        await onUploadPhoto(person, file);
                      } catch (cause) {
                        setUploadError(
                          cause instanceof Error ? cause.message : "Falha ao enviar a foto.",
                        );
                      } finally {
                        setUploading(false);
                        event.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
              {uploadError ? (
                <p role="alert" className="mt-3 text-xs text-red-700">
                  {uploadError}
                </p>
              ) : null}
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {person.fotos.map((photo) => (
                  <figure
                    key={photo.id}
                    className="overflow-hidden rounded-xl border border-[#dde8f0] bg-white"
                  >
                    {photo.url ? (
                      <img
                        src={photo.url}
                        alt={photo.legenda || "Foto complementar"}
                        className="h-40 w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-40 items-center justify-center text-xs text-[#567184]">
                        Imagem protegida
                      </div>
                    )}
                    <figcaption className="p-2 text-xs text-[#5b7184]">
                      {value(photo.legenda)}
                    </figcaption>
                  </figure>
                ))}
              </div>
              {!person.fotos.length ? (
                <p className="mt-4 rounded-2xl border border-dashed border-[#d4e0e9] p-8 text-center text-sm text-[#567184]">
                  Álbum vazio. Adicione imagens complementares acima.
                </p>
              ) : null}
            </div>
          ) : null}
          {tab === "localizacao" && person ? (
            <div className="rounded-2xl border border-[#dde8f0] bg-white p-5">
              <h3 className="flex items-center gap-2 text-sm font-black text-[#1e405b]">
                <MapPin className="h-4 w-4 text-[#148ca5]" /> Endereço cadastrado
              </h3>
              {person.endereco ? (
                <div className="mt-4 space-y-2 text-sm text-[#536d80]">
                  <p className="font-semibold text-[#1e405b]">
                    {person.endereco.logradouro}, {value(person.endereco.numero)}
                  </p>
                  <p>
                    {value(person.endereco.bairro)} · {person.endereco.municipio}/
                    {person.endereco.uf}
                  </p>
                  <p>Referência: {value(person.endereco.ponto_referencia)}</p>
                  <p>Como chegar: {value(person.endereco.como_chegar)}</p>
                  {person.endereco.link_navegacao ? (
                    <a
                      href={person.endereco.link_navegacao}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-3 inline-flex items-center gap-2 rounded-xl bg-[#173d5b] px-4 py-2.5 text-xs font-bold text-white hover:bg-[#205575]"
                    >
                      <MapPin className="h-4 w-4" /> Abrir rota no aplicativo
                    </a>
                  ) : null}
                </div>
              ) : person.usar_local_faccao ? (
                <div className="mt-4 rounded-xl border border-[#cde3e9] bg-[#eef8fa] p-4 text-sm text-[#536f82]">
                  <strong className="block text-[#1e405b]">Referência territorial da facção</strong>
                  <p className="mt-2">
                    {person.vinculos[0]?.organizacao?.area_atuacao ||
                      "Endereço individual não informado."}
                  </p>
                </div>
              ) : (
                <p className="mt-4 text-sm text-[#567184]">Nenhum endereço cadastrado.</p>
              )}
            </div>
          ) : null}
          {tab === "localizacao" && organization ? (
            <div className="space-y-3">
              {territoryError ? (
                <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">
                  {territoryError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#d9e5ec] bg-white p-4">
                <div>
                  <h3 className="text-sm font-black text-[#1e405b]">
                    Territórios e pontos operacionais
                  </h3>
                  <p className="mt-1 text-xs text-[#567184]">
                    Bairros, endereços e locais relacionados à facção.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onCreateTerritoryForOrganization(organization.id)}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#173d5b] px-4 py-2.5 text-xs font-black text-white hover:bg-[#205575]"
                >
                  <Plus className="h-4 w-4" /> Adicionar local
                </button>
              </div>
              {linkedTerritories.length ? (
                linkedTerritories.map((territory) => (
                  <div
                    key={territory.id}
                    className="relative rounded-2xl border border-[#dde8f0] bg-white p-4 shadow-sm"
                  >
                    <button
                      type="button"
                      disabled={Boolean(removingTerritoryId)}
                      onClick={() => void removeTerritory(territory.id)}
                      aria-label={`Remover ${territory.bairro}`}
                      title="Remover local"
                      className="absolute right-3 top-3 rounded-lg border border-red-200 bg-red-50 p-1.5 text-red-600 hover:bg-red-100"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex flex-wrap items-center gap-2 pr-10">
                      <strong className="text-sm text-[#1e405b]">{territory.bairro}</strong>
                      <span className="rounded-full bg-[#fff1e8] px-2 py-1 text-[11px] font-black text-[#b45309]">
                        {TERRITORY_CATEGORY_LABELS[territory.categoria]}
                      </span>
                      <span className="rounded-full bg-[#edf5f8] px-2 py-1 text-[11px] font-bold text-[#367c91]">
                        {territory.classificacao.replaceAll("_", " ")}
                      </span>
                    </div>
                    {territory.logradouro ? (
                      <p className="mt-3 flex items-start gap-2 text-sm font-semibold text-[#37576d]">
                        <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-[#1689a1]" />
                        {territory.logradouro}
                        {territory.numero ? `, ${territory.numero}` : ""} · {territory.municipio}/
                        {territory.uf}
                      </p>
                    ) : null}
                    {territory.ponto_referencia ? (
                      <p className="mt-1 text-xs text-[#567184]">
                        Referência: {territory.ponto_referencia}
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-[#567184]">
                      Confiança {territory.confianca}% · Fonte: {value(territory.fonte_resumo)}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-[#edf2f5] pt-3">
                      <button
                        type="button"
                        onClick={() => setSelectedTerritory(territory)}
                        className="inline-flex items-center gap-2 rounded-xl bg-[#173d5b] px-3 py-2 text-xs font-black text-white hover:bg-[#205575]"
                      >
                        <MapPinned className="h-4 w-4" /> Ver no mapa
                      </button>
                      {territory.link_navegacao ? (
                        <a
                          href={territory.link_navegacao}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-xl border border-[#cfe0e8] bg-[#f2f8fa] px-3 py-2 text-xs font-bold text-[#19778f]"
                        >
                          Abrir navegação <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="rounded-2xl border border-dashed border-[#d4e0e9] p-6 text-center text-sm text-[#567184]">
                  Nenhuma área registrada para esta facção.
                </p>
              )}
            </div>
          ) : null}
          {tab === "veiculos" ? <NexoVehiclePanel target={target} preview={preview} /> : null}
        </div>
      </section>
      {managedLink ? (
        <LinkManagementDialog
          person={managedLink.person}
          link={managedLink.link}
          organizations={organizations}
          people={people}
          onClose={() => setManagedLink(null)}
          onSave={onManageLink}
        />
      ) : null}
      {selectedTerritory ? (
        <TerritoryMapDialog
          territory={selectedTerritory}
          territories={linkedTerritories}
          organizations={organizations}
          onSelect={setSelectedTerritory}
          onClose={() => setSelectedTerritory(null)}
        />
      ) : null}
    </div>
  );
}
