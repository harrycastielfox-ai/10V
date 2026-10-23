import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import {
  createRepresentacao,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { buildRequisicaoRepresentacaoPayload, isRequisicaoMovement } from "@/lib/requisicoes";
import {
  Check,
  ClipboardCheck,
  FileCheck2,
  FlaskConical,
  ListChecks,
  Mic,
  Plus,
  Scale,
  Send,
  X,
} from "lucide-react";

const REPORT_TYPES = [
  "Necroscópico",
  "Lesões Corporais",
  "Toxicológico",
  "Balística / Arma de Fogo",
  "Local de Crime",
  "Outro",
] as const;

const CHECKLIST_ITEMS = [
  { id: "peca", label: "Peça assinada", detail: "Pendente de assinatura", icon: FileCheck2 },
  { id: "oitiva", label: "Oitiva", detail: "Inquirição pendente", icon: Mic },
  { id: "ric", label: "RIC", detail: "Relatório de investigação", icon: ClipboardCheck },
  {
    id: "laudo-pericial",
    label: "Laudo pericial",
    detail: "Laudo solicitado",
    icon: FlaskConical,
  },
] as const;

type LaudoSolicitacao = {
  id: string;
  tipos: string[];
  recebidos: string[];
  protocolo: string;
  meio: string;
  observacao: string;
  criadoEm: string;
};

type Requisicao = {
  id: string;
  tipo: string;
  protocolo: string;
  meio: string;
  observacao: string;
  criadoEm: string;
  origem?: string;
  numeroDocumento?: string;
  recebidaEm?: string;
  prazoDias?: number | null;
  conteudo?: string;
  status?: string;
  prioridade?: string;
};

type DadosOperacionais = {
  checklist: Record<string, boolean>;
  laudosPendentes: string[];
  solicitacoesLaudo: LaudoSolicitacao[];
  requisicoes: Requisicao[];
};

type ModalKind = "pendencias-laudo" | "solicitar-laudo" | "requisicao" | null;

const EMPTY_DATA: DadosOperacionais = {
  checklist: {},
  laudosPendentes: [],
  solicitacoesLaudo: [],
  requisicoes: [],
};

function createId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
}

function readData(key: string): DadosOperacionais {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return EMPTY_DATA;
    const value = JSON.parse(raw) as Partial<DadosOperacionais>;
    const legacyItems = Array.isArray((value as { items?: unknown }).items)
      ? ((value as { items: Array<Record<string, unknown>> }).items ?? [])
      : [];
    const migratedLaudos: LaudoSolicitacao[] = [];
    const migratedRequisicoes: Requisicao[] = [];

    for (const item of legacyItems) {
      if ((item.kind !== "laudo" && item.kind !== "requisicao") || typeof item.title !== "string") {
        continue;
      }

      const detail = typeof item.detail === "string" ? item.detail : "";
      const parts = detail.split(" · ");
      const protocolo = parts.find((part) => part.startsWith("Protocolo: "))?.slice(11) ?? "";
      const meio = parts.find((part) => part.startsWith("Meio: "))?.slice(6) ?? "";
      const observacao = parts
        .filter((part) => !part.startsWith("Protocolo: ") && !part.startsWith("Meio: "))
        .filter((part) => part !== "Registro sem observações adicionais")
        .join(" · ");
      const criadoEm =
        typeof item.createdAt === "string" ? item.createdAt : new Date().toISOString();

      if (item.kind === "laudo") {
        migratedLaudos.push({
          id: typeof item.id === "string" ? item.id : createId(),
          tipos: [item.title],
          recebidos: [],
          protocolo,
          meio,
          observacao,
          criadoEm,
        });
      } else {
        migratedRequisicoes.push({
          id: typeof item.id === "string" ? item.id : createId(),
          tipo: item.title,
          protocolo,
          meio,
          observacao,
          criadoEm,
        });
      }
    }

    return {
      checklist: value.checklist && typeof value.checklist === "object" ? value.checklist : {},
      laudosPendentes: Array.isArray(value.laudosPendentes) ? value.laudosPendentes : [],
      solicitacoesLaudo: Array.isArray(value.solicitacoesLaudo)
        ? value.solicitacoesLaudo.map((item) => ({
            ...item,
            recebidos: Array.isArray(item.recebidos) ? item.recebidos : [],
          }))
        : migratedLaudos,
      requisicoes: Array.isArray(value.requisicoes) ? value.requisicoes : migratedRequisicoes,
    };
  } catch {
    return EMPTY_DATA;
  }
}

function dateLabel(value: string) {
  const date = new Date(/^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T00:00:00` : value);
  return Number.isNaN(date.getTime())
    ? "Data indisponível"
    : new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(date);
}

function todayDateInputValue() {
  const today = new Date();
  today.setMinutes(today.getMinutes() - today.getTimezoneOffset());
  return today.toISOString().slice(0, 10);
}

function mapRequisitionMovement(movement: RepresentacaoRecord): Requisicao {
  const origin = movement.requisicao_origem ?? "";
  const receivedAt = movement.requisicao_data_recebimento ?? movement.data_protocolo ?? "";
  const content = movement.requisicao_conteudo ?? movement.observacoes_movimentacao ?? "";
  return {
    id: movement.id,
    tipo: origin || "Judicial/ministerial",
    protocolo: movement.requisicao_numero_documento ?? "",
    meio: origin,
    observacao: content,
    criadoEm: movement.created_at ?? receivedAt,
    origem: origin,
    numeroDocumento: movement.requisicao_numero_documento ?? "",
    recebidaEm: receivedAt,
    prazoDias: movement.requisicao_prazo_dias ?? null,
    conteudo: content,
    status: movement.status ?? "Pendente de cumprimento",
    prioridade: movement.prioridade_operacional ?? "Alta",
  };
}

export function ProcedureOperationsPanel({
  caseId,
  canEdit,
  numeroPpe,
  movimentacoes,
  onRequisitionCreated,
}: {
  caseId: string;
  canEdit: boolean;
  numeroPpe?: string | null;
  movimentacoes: RepresentacaoRecord[];
  onRequisitionCreated?: (movement: RepresentacaoRecord) => void;
}) {
  const storageKey = `sied:procedure-actions:${caseId}`;
  const [data, setData] = useState<DadosOperacionais>(EMPTY_DATA);
  const [ready, setReady] = useState(false);
  const [modal, setModal] = useState<ModalKind>(null);
  const [selectedReports, setSelectedReports] = useState<string[]>([]);
  const [protocol, setProtocol] = useState("");
  const [medium, setMedium] = useState("");
  const [notes, setNotes] = useState("");
  const [requisitionOrigin, setRequisitionOrigin] = useState("Poder Judiciário");
  const [otherRequisitionOrigin, setOtherRequisitionOrigin] = useState("");
  const [requisitionNumber, setRequisitionNumber] = useState("");
  const [requisitionReceivedAt, setRequisitionReceivedAt] = useState(todayDateInputValue);
  const [requisitionDeadlineDays, setRequisitionDeadlineDays] = useState("");
  const [requisitionContent, setRequisitionContent] = useState("");
  const [requisitionError, setRequisitionError] = useState("");
  const [savingRequisition, setSavingRequisition] = useState(false);
  const [otherReportType, setOtherReportType] = useState("");
  const [showAllReports, setShowAllReports] = useState(false);
  const [showAllRequisitions, setShowAllRequisitions] = useState(false);

  useEffect(() => {
    setData(readData(storageKey));
    setReady(true);
  }, [storageKey]);

  useEffect(() => {
    if (!ready) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(data));
    } catch {
      // The current view remains interactive if browser storage is unavailable.
    }
  }, [data, ready, storageKey]);

  const laudosSolicitados = useMemo(
    () => data.solicitacoesLaudo.flatMap((item) => item.tipos.map((tipo) => ({ ...item, tipo }))),
    [data.solicitacoesLaudo],
  );

  const requisicoes = useMemo(() => {
    const byId = new Map(data.requisicoes.map((item) => [item.id, item]));
    for (const movement of movimentacoes) {
      if (isRequisicaoMovement(movement)) byId.set(movement.id, mapRequisitionMovement(movement));
    }
    return [...byId.values()].sort((a, b) => {
      const dateA = new Date(a.recebidaEm || a.criadoEm).getTime();
      const dateB = new Date(b.recebidaEm || b.criadoEm).getTime();
      return dateB - dateA;
    });
  }, [data.requisicoes, movimentacoes]);

  const openModal = (kind: Exclude<ModalKind, null>) => {
    setProtocol("");
    setMedium("");
    setNotes("");
    setOtherReportType("");
    setRequisitionOrigin("Poder Judiciário");
    setOtherRequisitionOrigin("");
    setRequisitionNumber("");
    setRequisitionReceivedAt(todayDateInputValue());
    setRequisitionDeadlineDays("");
    setRequisitionContent("");
    setRequisitionError("");
    if (kind === "pendencias-laudo") setSelectedReports(data.laudosPendentes);
    if (kind === "solicitar-laudo") setSelectedReports(data.laudosPendentes);
    setModal(kind);
  };

  const toggleReport = (type: string) => {
    setSelectedReports((current) =>
      current.includes(type) ? current.filter((item) => item !== type) : [...current, type],
    );
  };

  const savePendingReports = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setData((current) => ({ ...current, laudosPendentes: selectedReports }));
    setModal(null);
  };

  const saveReportRequest = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedReports.length || !medium) return;
    setData((current) => ({
      ...current,
      laudosPendentes: current.laudosPendentes.filter((item) => !selectedReports.includes(item)),
      solicitacoesLaudo: [
        {
          id: createId(),
          tipos: selectedReports.map((type) =>
            type === "Outro" ? `Outro: ${otherReportType.trim()}` : type,
          ),
          recebidos: [],
          protocolo: protocol.trim(),
          meio: medium,
          observacao: notes.trim(),
          criadoEm: new Date().toISOString(),
        },
        ...current.solicitacoesLaudo,
      ],
    }));
    setModal(null);
  };

  const saveRequisition = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const deadlineDays = requisitionDeadlineDays.trim() ? Number(requisitionDeadlineDays) : null;
    const origin =
      requisitionOrigin === "Outro" ? otherRequisitionOrigin.trim() : requisitionOrigin;
    const content = requisitionContent.trim();
    if (
      !canEdit ||
      !origin ||
      !requisitionReceivedAt ||
      !content ||
      (deadlineDays !== null &&
        (!Number.isInteger(deadlineDays) || deadlineDays < 1 || deadlineDays > 3650))
    ) {
      return;
    }

    setSavingRequisition(true);
    setRequisitionError("");
    try {
      const movement = await createRepresentacao(
        buildRequisicaoRepresentacaoPayload({
          inqueritoId: caseId,
          numeroPpe,
          origem: origin,
          numeroDocumento: requisitionNumber,
          recebidaEm: requisitionReceivedAt,
          prazoDias: deadlineDays,
          conteudo: content,
        }),
      );
      onRequisitionCreated?.(movement);
      setModal(null);
    } catch (error) {
      const message = String((error as { message?: string } | null)?.message ?? "").toLowerCase();
      const code = String((error as { code?: string } | null)?.code ?? "");
      setRequisitionError(
        code === "PGRST204" || code === "42703" || message.includes("requisicao_")
          ? "Os campos de requisição ainda não estão disponíveis no banco. A migração precisa ser aplicada antes de salvar."
          : "Não foi possível registrar a requisição. Verifique sua sessão e a permissão de gravação.",
      );
    } finally {
      setSavingRequisition(false);
    }
  };

  const toggleReportReceived = (solicitacaoId: string, type: string) => {
    setData((current) => ({
      ...current,
      solicitacoesLaudo: current.solicitacoesLaudo.map((solicitacao) => {
        if (solicitacao.id !== solicitacaoId) return solicitacao;
        const recebidos = solicitacao.recebidos.includes(type)
          ? solicitacao.recebidos.filter((item) => item !== type)
          : [...solicitacao.recebidos, type];
        return { ...solicitacao, recebidos };
      }),
    }));
  };

  const modalTitle =
    modal === "pendencias-laudo"
      ? "Laudos pendentes"
      : modal === "solicitar-laudo"
        ? "Solicitar laudo"
        : "Registrar requisição";

  return (
    <div className="space-y-3">
      <section className="overflow-hidden rounded-lg border border-border/60 bg-card/70">
        <header className="flex items-center justify-between gap-2 border-b border-border/55 px-3 py-2.5">
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-primary">
            <ListChecks className="h-4 w-4" /> Controle de pendências
          </h2>
          <span className="shrink-0 text-[10px] font-bold text-muted-foreground">
            {CHECKLIST_ITEMS.filter((item) => data.checklist[item.id]).length}/
            {CHECKLIST_ITEMS.length}
          </span>
        </header>
        <div className="space-y-1.5 p-2">
          {CHECKLIST_ITEMS.map((item) => {
            const done = Boolean(data.checklist[item.id]);
            const Icon = item.icon;
            return (
              <div
                key={item.id}
                className={`flex items-center gap-2 rounded-md border px-2 py-2 ${done ? "border-emerald-500/30 bg-emerald-500/5" : "border-border/50 bg-background/35"}`}
              >
                <span
                  className={`grid h-8 w-8 shrink-0 place-items-center rounded-md border ${done ? "border-emerald-500/30 text-emerald-600" : "border-border/70 text-muted-foreground"}`}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-bold text-foreground">{item.label}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {done ? "Concluído" : item.detail}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!canEdit}
                  onClick={() =>
                    setData((current) => ({
                      ...current,
                      checklist: { ...current.checklist, [item.id]: !current.checklist[item.id] },
                    }))
                  }
                  className={`h-7 shrink-0 rounded border px-2 text-[10px] font-bold transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${done ? "border-border text-muted-foreground hover:bg-accent" : "border-primary/40 bg-primary/10 text-primary hover:bg-primary/15"}`}
                >
                  {done ? "Reabrir" : "Marcar"}
                </button>
              </div>
            );
          })}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border/60 bg-card/70">
        <header className="flex items-center gap-2 border-b border-border/55 px-3 py-2.5">
          <FlaskConical className="h-4 w-4 text-primary" />
          <h2 className="text-xs font-black uppercase tracking-[0.12em] text-primary">
            Controle pericial
          </h2>
        </header>
        <div className="space-y-3 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] font-semibold text-muted-foreground">
              {data.laudosPendentes.length} laudo(s) pendente(s) de solicitação
            </p>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!canEdit}
                onClick={() => openModal("pendencias-laudo")}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-[10px] font-bold text-foreground hover:bg-accent disabled:opacity-50"
              >
                <ListChecks className="h-3.5 w-3.5" /> Laudos pendentes
              </button>
              <button
                type="button"
                disabled={!canEdit || data.laudosPendentes.length === 0}
                onClick={() => openModal("solicitar-laudo")}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-emerald-600/40 bg-emerald-600 px-2 text-[10px] font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Send className="h-3.5 w-3.5" /> Solicitar laudo
                <span className="rounded bg-black/15 px-1.5 py-0.5 text-[9px]">
                  {data.laudosPendentes.length}
                </span>
              </button>
            </div>
          </div>

          {laudosSolicitados.length ? (
            <ul className="divide-y divide-border/55 rounded-md border border-border/60">
              {(showAllReports ? laudosSolicitados : laudosSolicitados.slice(0, 4)).map((item) => {
                const recebido = item.recebidos.includes(item.tipo);
                return (
                  <li key={`${item.id}-${item.tipo}`} className="px-2.5 py-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-[11px] font-bold text-foreground">Laudo {item.tipo}</p>
                        <span
                          className={`mt-1 inline-flex rounded border px-1.5 py-0.5 text-[9px] font-black uppercase ${recebido ? "border-emerald-600/35 bg-emerald-600/10 text-emerald-700" : "border-warning/35 bg-warning/10 text-warning"}`}
                        >
                          {recebido ? "Recebido" : "Aguardando laudo"}
                        </span>
                      </div>
                      <button
                        type="button"
                        disabled={!canEdit}
                        onClick={() => toggleReportReceived(item.id, item.tipo)}
                        className="shrink-0 rounded border border-border px-2 py-1 text-[9px] font-bold text-muted-foreground hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {recebido ? "Reabrir" : "Marcar recebido"}
                      </button>
                    </div>
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      {item.protocolo ? `Protocolo ${item.protocolo} · ` : ""}Solicitado em{" "}
                      {dateLabel(item.criadoEm)}
                    </p>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="border-t border-border/55 pt-2 text-[10px] text-muted-foreground">
              Nenhum laudo solicitado.
            </p>
          )}
          {laudosSolicitados.length > 4 ? (
            <button
              type="button"
              onClick={() => setShowAllReports((current) => !current)}
              className="mt-2 text-[10px] font-bold text-primary hover:underline"
            >
              {showAllReports
                ? "Mostrar recentes"
                : `Ver todos os ${laudosSolicitados.length} laudos`}
            </button>
          ) : null}
        </div>
      </section>

      <section className="overflow-hidden rounded-lg border border-border/60 bg-card/70">
        <header className="flex items-center gap-2 border-b border-border/55 px-3 py-2.5">
          <h2 className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-warning">
            <Scale className="h-4 w-4" /> Requisições judiciais/ministeriais
          </h2>
        </header>
        <div className="p-3">
          <p className="text-[10px] text-muted-foreground">
            {requisicoes.length
              ? `${requisicoes.length} requisição(ões) vinculada(s). O status do procedimento não muda.`
              : "Nenhuma pendente. O status do procedimento não muda com as requisições."}
          </p>
          {requisicoes.length ? (
            <ul className="mt-2 divide-y divide-border/55 border-t border-border/55">
              {(showAllRequisitions ? requisicoes : requisicoes.slice(0, 3)).map((item) => (
                <li key={item.id} className="py-2">
                  <p className="text-[11px] font-bold text-foreground">
                    {item.origem ? `Requisição · ${item.origem}` : `Requisição ${item.tipo}`}
                  </p>
                  <p className="mt-0.5 text-[10px] text-muted-foreground">
                    {item.numeroDocumento ? `Documento ${item.numeroDocumento} · ` : ""}
                    {item.recebidaEm ? dateLabel(item.recebidaEm) : dateLabel(item.criadoEm)}
                    {item.prazoDias ? ` · Prazo ${item.prazoDias} dias` : ""}
                    {item.status ? ` · ${item.status}` : ""}
                    {item.prioridade ? ` · Prioridade ${item.prioridade}` : ""}
                  </p>
                  {item.conteudo || item.observacao ? (
                    <p className="mt-1 line-clamp-2 text-[10px] leading-4 text-muted-foreground/80">
                      {item.conteudo || item.observacao}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : null}
          {requisicoes.length > 3 ? (
            <button
              type="button"
              onClick={() => setShowAllRequisitions((current) => !current)}
              className="mt-2 text-[10px] font-bold text-primary hover:underline"
            >
              {showAllRequisitions
                ? "Mostrar recentes"
                : `Ver todas as ${requisicoes.length} requisições`}
            </button>
          ) : null}
          <button
            type="button"
            disabled={!canEdit}
            onClick={() => openModal("requisicao")}
            className="mt-3 inline-flex h-8 items-center gap-1.5 rounded-md border border-warning/40 bg-warning/10 px-2.5 text-[10px] font-bold text-warning hover:bg-warning/15 disabled:opacity-50"
          >
            <Plus className="h-3.5 w-3.5" /> Registrar requisição
          </button>
        </div>
      </section>

      <Dialog.Root open={modal !== null} onOpenChange={(open) => !open && setModal(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-[2px]" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[101] max-h-[90vh] w-[calc(100vw-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-lg border border-border bg-card p-5 shadow-2xl focus:outline-none">
            <div className="flex items-start justify-between gap-4">
              <div>
                <Dialog.Title className="text-base font-bold text-foreground">
                  {modalTitle}
                </Dialog.Title>
                <Dialog.Description className="mt-1 text-xs leading-5 text-muted-foreground">
                  {modal === "pendencias-laudo"
                    ? "Selecione os laudos que ainda precisam ser requisitados."
                    : modal === "solicitar-laudo"
                      ? "Informe o meio e o protocolo da solicitação pericial."
                      : "A requisição fica vinculada ao inquérito, com status e prioridade próprios; a situação geral não muda."}
                </Dialog.Description>
              </div>
              <Dialog.Close asChild>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              </Dialog.Close>
            </div>

            {modal === "pendencias-laudo" ? (
              <form onSubmit={savePendingReports} className="mt-5 space-y-4">
                <fieldset>
                  <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Laudos necessários
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {REPORT_TYPES.map((type) => (
                      <label
                        key={type}
                        className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${selectedReports.includes(type) ? "border-primary/50 bg-primary/5 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:bg-accent/50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedReports.includes(type)}
                          onChange={() => toggleReport(type)}
                          className="accent-primary"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </fieldset>
                <div className="flex justify-end gap-2 border-t border-border/55 pt-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="h-9 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-accent"
                    >
                      Cancelar
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={!canEdit}
                    className="h-9 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    Salvar pendências
                  </button>
                </div>
              </form>
            ) : null}

            {modal === "solicitar-laudo" ? (
              <form onSubmit={saveReportRequest} className="mt-5 space-y-4">
                <fieldset>
                  <legend className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Tipos de perícia
                  </legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {REPORT_TYPES.map((type) => (
                      <label
                        key={type}
                        className={`flex min-h-10 cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${selectedReports.includes(type) ? "border-emerald-600/45 bg-emerald-600/5 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:bg-accent/50"}`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedReports.includes(type)}
                          onChange={() => toggleReport(type)}
                          className="accent-emerald-600"
                        />
                        {type}
                      </label>
                    ))}
                  </div>
                </fieldset>
                {selectedReports.includes("Outro") ? (
                  <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Especifique o laudo
                    <input
                      required
                      value={otherReportType}
                      onChange={(event) => setOtherReportType(event.target.value)}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground"
                    />
                  </label>
                ) : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Protocolo
                    <input
                      value={protocol}
                      onChange={(event) => setProtocol(event.target.value)}
                      placeholder="SEI, guia DPT, ofício..."
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground placeholder:text-muted-foreground/70"
                    />
                  </label>
                  <label className="space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Meio de solicitação
                    <select
                      required
                      value={medium}
                      onChange={(event) => setMedium(event.target.value)}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground"
                    >
                      <option value="">Selecione...</option>
                      <option>Ofício</option>
                      <option>SEI</option>
                      <option>Guia pericial</option>
                      <option>Outro</option>
                    </select>
                  </label>
                </div>
                <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Despacho / comentário (opcional)
                  <textarea
                    value={notes}
                    onChange={(event) => setNotes(event.target.value)}
                    rows={3}
                    placeholder="Ex.: requisitados laudos necroscópico e toxicológico ao IML"
                    className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground placeholder:text-muted-foreground/70"
                  />
                </label>
                <div className="flex justify-end gap-2 border-t border-border/55 pt-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="h-9 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-accent"
                    >
                      Cancelar
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={
                      !canEdit ||
                      !selectedReports.length ||
                      !medium ||
                      (selectedReports.includes("Outro") && !otherReportType.trim())
                    }
                    className="h-9 rounded-md bg-emerald-600 px-3 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Registrar solicitação
                  </button>
                </div>
              </form>
            ) : null}

            {modal === "requisicao" ? (
              <form onSubmit={saveRequisition} className="mt-5 space-y-3.5">
                <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Origem
                  <select
                    required
                    value={requisitionOrigin}
                    onChange={(event) => setRequisitionOrigin(event.target.value)}
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground"
                  >
                    <option>Poder Judiciário</option>
                    <option>Ministério Público</option>
                    <option>Outro órgão</option>
                    <option>Outro</option>
                  </select>
                </label>
                {requisitionOrigin === "Outro" ? (
                  <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Especifique a origem
                    <input
                      required
                      maxLength={120}
                      value={otherRequisitionOrigin}
                      onChange={(event) => setOtherRequisitionOrigin(event.target.value)}
                      placeholder="Nome do órgão ou da origem"
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground"
                    />
                  </label>
                ) : null}
                <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  Nº do ofício / documento (opcional)
                  <input
                    maxLength={120}
                    value={requisitionNumber}
                    onChange={(event) => setRequisitionNumber(event.target.value)}
                    placeholder="Ofício, processo ou documento"
                    className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground placeholder:text-muted-foreground/60"
                  />
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Recebida em
                    <input
                      required
                      type="date"
                      value={requisitionReceivedAt}
                      onChange={(event) => setRequisitionReceivedAt(event.target.value)}
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground"
                    />
                  </label>
                  <label className="space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Prazo em dias (opcional)
                    <input
                      type="number"
                      min={1}
                      max={3650}
                      step={1}
                      value={requisitionDeadlineDays}
                      onChange={(event) => setRequisitionDeadlineDays(event.target.value)}
                      placeholder="Sem prazo"
                      className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-normal normal-case tracking-normal text-foreground placeholder:text-muted-foreground/60"
                    />
                  </label>
                </div>
                <label className="block space-y-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  O que foi requisitado
                  <textarea
                    required
                    maxLength={5000}
                    value={requisitionContent}
                    onChange={(event) => setRequisitionContent(event.target.value)}
                    rows={4}
                    placeholder="Descreva objetivamente o pedido recebido"
                    className="w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm font-normal normal-case tracking-normal text-foreground placeholder:text-muted-foreground/60"
                  />
                  <p className="text-[10px] font-normal normal-case leading-4 tracking-normal text-muted-foreground/70">
                    Exemplos: oitivas, laudos, cópia de autos ou cumprimento de diligência.
                  </p>
                </label>
                {requisitionError ? (
                  <p
                    role="alert"
                    className="rounded-md border border-destructive/35 bg-destructive/5 px-3 py-2 text-xs text-destructive"
                  >
                    {requisitionError}
                  </p>
                ) : null}
                <div className="flex justify-end gap-2 border-t border-border/55 pt-3">
                  <Dialog.Close asChild>
                    <button
                      type="button"
                      className="h-9 rounded-md border border-border px-3 text-xs font-semibold text-muted-foreground hover:bg-accent"
                    >
                      Cancelar
                    </button>
                  </Dialog.Close>
                  <button
                    type="submit"
                    disabled={
                      !canEdit ||
                      savingRequisition ||
                      !requisitionContent.trim() ||
                      (requisitionOrigin === "Outro" && !otherRequisitionOrigin.trim()) ||
                      (Boolean(requisitionDeadlineDays) &&
                        (!Number.isInteger(Number(requisitionDeadlineDays)) ||
                          Number(requisitionDeadlineDays) < 1 ||
                          Number(requisitionDeadlineDays) > 3650))
                    }
                    className="h-9 rounded-md bg-primary px-3 text-xs font-bold text-primary-foreground hover:bg-primary/90 disabled:opacity-50"
                  >
                    {savingRequisition ? "Salvando..." : "Registrar requisição"}
                  </button>
                </div>
              </form>
            ) : null}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
