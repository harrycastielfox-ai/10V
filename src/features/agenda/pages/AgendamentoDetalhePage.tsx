import { Link, useNavigate, useParams } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  LoaderCircle,
  MapPin,
  MessageCircle,
  Pencil,
  Phone,
  Trash2,
  UserRound,
  UserX,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useAppProfile } from "@/components/AppProfileContext";
import { canManageAgenda } from "@/lib/authz";
import {
  checarConflitos,
  getAgendamentoById,
  listAgendamentosPeriodo,
  softDeleteAgendamento,
  updateAgendamento,
} from "@/lib/repositories/agendaRepository";
import { AgendamentoStatusBadge } from "../components/AgendamentoStatusBadge";
import {
  DURACOES_MINUTOS,
  INTIMACAO_STATUS_LABELS,
  INTIMACAO_VIA_LABELS,
  QUALIFICACAO_LABELS,
  TIPO_ATENDIMENTO_LABELS,
  formatDataHora,
  formatHora,
  inicioDoDia,
  montarLinkWhatsapp,
  paraInputDateTime,
  somarDias,
} from "../agendaConstants";
import type { AgendaConflito, AgendamentoRecord, AgendamentoStatus } from "../agendaTypes";

export default function AgendamentoDetalhePage() {
  const { agendamentoId } = useParams({ from: "/agenda/$agendamentoId" });
  const navigate = useNavigate();
  const profile = useAppProfile();
  const podeGerenciar = canManageAgenda(profile);

  const [agendamento, setAgendamento] = useState<AgendamentoRecord | null>(null);
  const [relacionados, setRelacionados] = useState<AgendamentoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [excluindo, setExcluindo] = useState(false);
  const [confirmarExclusao, setConfirmarExclusao] = useState(false);
  const [aviso, setAviso] = useState("");

  const [remarcarAberto, setRemarcarAberto] = useState(false);
  const [novaDataHora, setNovaDataHora] = useState("");
  const [novaDuracao, setNovaDuracao] = useState(30);
  const [novoLocal, setNovoLocal] = useState("");
  const [remarcarSalvando, setRemarcarSalvando] = useState(false);
  const [remarcarConflitos, setRemarcarConflitos] = useState<AgendaConflito[]>([]);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro("");
    try {
      const registro = await getAgendamentoById(agendamentoId);
      if (!registro) throw new Error("Agendamento não encontrado.");
      setAgendamento(registro);

      // Quem mais foi convocado pelo mesmo fato — o escrivão precisa ver o grupo.
      const vinculo = registro.numero_bo?.trim();
      if (vinculo || registro.inquerito_id) {
        const base = inicioDoDia(new Date(registro.data_hora));
        const proximos = await listAgendamentosPeriodo({
          inicio: somarDias(base, -30).toISOString(),
          fim: somarDias(base, 30).toISOString(),
          limit: 200,
        });
        setRelacionados(
          proximos.filter(
            (item) =>
              item.id !== registro.id &&
              ((vinculo && item.numero_bo?.trim() === vinculo) ||
                (registro.inquerito_id && item.inquerito_id === registro.inquerito_id)),
          ),
        );
      } else {
        setRelacionados([]);
      }
    } catch {
      setErro("Não foi possível carregar este agendamento.");
    } finally {
      setLoading(false);
    }
  }, [agendamentoId]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  async function mudarStatus(status: AgendamentoStatus) {
    if (!podeGerenciar || !agendamento) return;
    setSalvando(true);
    setAviso("");
    try {
      const atualizado = await updateAgendamento(agendamento.id, { status });
      setAgendamento(atualizado);
      setAviso("Situação atualizada.");
    } catch {
      setAviso("Não foi possível atualizar a situação.");
    } finally {
      setSalvando(false);
    }
  }

  function abrirRemarcacao() {
    if (!agendamento) return;
    setNovaDataHora(paraInputDateTime(new Date(Date.now() + 60 * 60 * 1000)));
    setNovaDuracao(agendamento.duracao_minutos);
    setNovoLocal(agendamento.local ?? "");
    setRemarcarConflitos([]);
    setAviso("");
    setRemarcarAberto(true);
  }

  // Checa o novo horário do mesmo jeito que o formulário de marcação — não faz
  // sentido remarcar para um horário que cai no mesmo problema de antes.
  useEffect(() => {
    if (!remarcarAberto || !agendamento || !novaDataHora) {
      setRemarcarConflitos([]);
      return;
    }
    let cancelado = false;
    const timer = window.setTimeout(() => {
      void checarConflitos({
        dataHora: new Date(novaDataHora).toISOString(),
        duracaoMinutos: novaDuracao,
        responsavelUserId: agendamento.responsavel_user_id,
        numeroBo: agendamento.numero_bo,
        inqueritoId: agendamento.inquerito_id,
        qualificacao: agendamento.qualificacao,
        ignorarId: agendamento.id,
      })
        .then((itens) => {
          if (!cancelado) setRemarcarConflitos(itens);
        })
        .catch(() => {
          if (!cancelado) setRemarcarConflitos([]);
        });
    }, 400);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [remarcarAberto, agendamento, novaDataHora, novaDuracao]);

  async function confirmarRemarcacao() {
    if (!podeGerenciar || !agendamento || !novaDataHora) return;
    setRemarcarSalvando(true);
    setAviso("");
    try {
      const dataAntiga = formatDataHora(agendamento.data_hora);
      const historico = `Remarcado de ${dataAntiga} para ${formatDataHora(new Date(novaDataHora).toISOString())}.`;
      const atualizado = await updateAgendamento(agendamento.id, {
        data_hora: new Date(novaDataHora).toISOString(),
        duracao_minutos: novaDuracao,
        local: novoLocal.trim() || null,
        status: "agendado",
        observacoes: [agendamento.observacoes, historico].filter(Boolean).join("\n"),
      });
      setAgendamento(atualizado);
      setRemarcarAberto(false);
      setAviso("Atendimento remarcado.");
    } catch {
      setAviso("Não foi possível remarcar este atendimento.");
    } finally {
      setRemarcarSalvando(false);
    }
  }

  async function excluir() {
    if (!podeGerenciar || !agendamento) return;
    setExcluindo(true);
    try {
      await softDeleteAgendamento(agendamento.id);
      await navigate({ to: "/agenda", replace: true });
    } catch {
      setAviso("Não foi possível excluir este agendamento.");
      setExcluindo(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-info" />
      </div>
    );
  }

  if (erro || !agendamento) {
    return (
      <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
        {erro || "Agendamento não encontrado."}
      </div>
    );
  }

  const linkWhatsapp = montarLinkWhatsapp(
    agendamento.pessoa_telefone,
    agendamento.pessoa_nome,
    agendamento.data_hora,
  );
  const encerrado = agendamento.status === "cancelado" || agendamento.status === "remarcado";

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <header className="rounded-2xl border border-border/70 bg-card/60 p-5 lg:p-6">
        <button
          type="button"
          onClick={() => history.back()}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-info"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-mono text-sm font-black tracking-wide text-info">
                {agendamento.codigo}
              </p>
              <AgendamentoStatusBadge status={agendamento.status} />
              <span className="rounded-md border border-info/30 bg-info/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-info">
                {QUALIFICACAO_LABELS[agendamento.qualificacao]}
              </span>
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight">{agendamento.pessoa_nome}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {TIPO_ATENDIMENTO_LABELS[agendamento.tipo_atendimento]}
              {agendamento.natureza ? ` · ${agendamento.natureza}` : ""}
            </p>
          </div>
          {podeGerenciar ? (
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => {
                  setAviso("");
                  setConfirmarExclusao(true);
                }}
                aria-label="Excluir agendamento"
                title="Excluir agendamento"
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-destructive/35 bg-destructive/5 text-destructive transition hover:bg-destructive/10"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              <Link
                to="/agenda/editar/$agendamentoId"
                params={{ agendamentoId: agendamento.id }}
                className="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-semibold hover:border-info/40"
              >
                <Pencil className="h-4 w-4" /> Editar
              </Link>
            </div>
          ) : null}
        </div>
      </header>

      {aviso ? (
        <p className="rounded-xl border border-info/30 bg-info/10 p-3 text-sm">{aviso}</p>
      ) : null}

      <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <article className="rounded-2xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-5 py-4 text-info">
              <CalendarClock className="h-4 w-4" />
              <h2 className="text-xs font-black tracking-[0.14em]">DIA E HORÁRIO</h2>
            </header>
            <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
              <Dado
                label="Data e hora"
                valor={
                  <span className="text-base font-black text-info">
                    {formatDataHora(agendamento.data_hora)}
                  </span>
                }
              />
              <Dado label="Duração" valor={`${agendamento.duracao_minutos} minutos`} />
              <Dado label="Responsável" valor={agendamento.responsavel_nome ?? "Não definido"} />
              <Dado
                label="Local"
                valor={
                  agendamento.local ? (
                    <span className="inline-flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-info" /> {agendamento.local}
                    </span>
                  ) : (
                    "Não informado"
                  )
                }
              />
            </div>
          </article>

          <article className="rounded-2xl border border-border bg-card">
            <header className="flex items-center gap-2 border-b border-border px-5 py-4 text-info">
              <ClipboardList className="h-4 w-4" />
              <h2 className="text-xs font-black tracking-[0.14em]">FATO E PROCEDIMENTO</h2>
            </header>
            <div className="grid gap-x-6 gap-y-5 p-5 sm:grid-cols-2">
              <Dado label="Natureza" valor={agendamento.natureza ?? "Não informada"} />
              <Dado label="Número do B.O." valor={agendamento.numero_bo ?? "Não informado"} />
              <Dado
                label="Procedimento"
                valor={agendamento.procedimento_numero ?? "Não informado"}
              />
              {agendamento.inquerito_id ? (
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Inquérito vinculado
                  </span>
                  <Link
                    to="/inqueritos/$caseId"
                    params={{ caseId: agendamento.inquerito_id }}
                    className="mt-1 block text-sm font-semibold text-info hover:underline"
                  >
                    Abrir procedimento no SIPI →
                  </Link>
                </div>
              ) : null}
              {agendamento.observacoes ? (
                <div className="sm:col-span-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    Observações
                  </span>
                  <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">
                    {agendamento.observacoes}
                  </p>
                </div>
              ) : null}
            </div>
          </article>

          {relacionados.length ? (
            <article className="rounded-2xl border border-border bg-card">
              <header className="flex items-center justify-between gap-2 border-b border-border px-5 py-4">
                <div className="flex items-center gap-2 text-info">
                  <UserRound className="h-4 w-4" />
                  <h2 className="text-xs font-black tracking-[0.14em]">OUTROS DO MESMO FATO</h2>
                </div>
                <span className="text-[10px] text-muted-foreground">{relacionados.length}</span>
              </header>
              <div className="divide-y divide-border">
                {relacionados.map((item) => (
                  <Link
                    key={item.id}
                    to="/agenda/$agendamentoId"
                    params={{ agendamentoId: item.id }}
                    className="flex items-center gap-3 px-5 py-3 transition hover:bg-info/5"
                  >
                    <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-info">
                      {formatHora(item.data_hora)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong className="block truncate text-sm">{item.pessoa_nome}</strong>
                      <span className="text-[11px] text-muted-foreground">
                        {QUALIFICACAO_LABELS[item.qualificacao]} ·{" "}
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" }).format(
                          new Date(item.data_hora),
                        )}
                      </span>
                    </span>
                    <AgendamentoStatusBadge status={item.status} />
                  </Link>
                ))}
              </div>
            </article>
          ) : null}
        </div>

        <aside className="space-y-4">
          <article className="rounded-2xl border border-border bg-card p-5">
            <h2 className="text-xs font-black tracking-[0.14em] text-info">CONTATO</h2>
            <div className="mt-3 space-y-2 text-sm">
              <p className="flex items-center gap-2">
                <Phone className="h-4 w-4 shrink-0 text-info" />
                {agendamento.pessoa_telefone || "Telefone não informado"}
              </p>
              {agendamento.pessoa_documento ? (
                <p className="text-xs text-muted-foreground">
                  Documento: {agendamento.pessoa_documento}
                </p>
              ) : null}
            </div>

            <div className="mt-4 rounded-xl border border-border bg-background/50 p-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                Intimação
              </span>
              <p className="mt-1 text-sm font-semibold">
                {INTIMACAO_STATUS_LABELS[agendamento.intimacao_status]}
                {agendamento.intimacao_via
                  ? ` · ${INTIMACAO_VIA_LABELS[agendamento.intimacao_via]}`
                  : ""}
              </p>
            </div>

            {linkWhatsapp && !encerrado ? (
              <a
                href={linkWhatsapp}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-3 flex min-h-11 items-center justify-center gap-2 rounded-xl border border-success/60 bg-success/10 px-3 text-xs font-bold uppercase tracking-wider text-success transition hover:bg-success/20"
              >
                <MessageCircle className="h-4 w-4" /> Intimar por WhatsApp
              </a>
            ) : null}
          </article>

          {podeGerenciar ? (
            <article className="rounded-2xl border border-border bg-card p-5">
              <h2 className="text-xs font-black tracking-[0.14em] text-info">COMPARECIMENTO</h2>
              <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                {encerrado
                  ? "Este atendimento está encerrado. Remarque para reativá-lo com data nova, ou corrija a situação manualmente."
                  : "Registre o que aconteceu depois do horário marcado."}
              </p>
              <div className="mt-3 grid gap-2">
                <button
                  type="button"
                  disabled={salvando || agendamento.status === "compareceu"}
                  onClick={() => void mudarStatus("compareceu")}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-success/60 bg-success/10 px-3 text-xs font-bold uppercase tracking-wider text-success transition hover:bg-success/20 disabled:opacity-40"
                >
                  <CheckCircle2 className="h-4 w-4" /> Compareceu
                </button>
                <button
                  type="button"
                  disabled={salvando || agendamento.status === "nao_compareceu"}
                  onClick={() => void mudarStatus("nao_compareceu")}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-destructive/50 bg-destructive/8 px-3 text-xs font-bold uppercase tracking-wider text-destructive transition hover:bg-destructive/15 disabled:opacity-40"
                >
                  <UserX className="h-4 w-4" /> Não compareceu
                </button>
                <button
                  type="button"
                  disabled={salvando}
                  onClick={abrirRemarcacao}
                  className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-warning/50 bg-warning/8 px-3 text-xs font-bold uppercase tracking-wider text-warning transition hover:bg-warning/15 disabled:opacity-40"
                >
                  <CalendarClock className="h-4 w-4" /> Remarcar
                </button>
                <button
                  type="button"
                  disabled={salvando || agendamento.status === "cancelado"}
                  onClick={() => void mudarStatus("cancelado")}
                  className="flex min-h-10 items-center justify-center gap-2 rounded-xl border border-border px-3 text-[11px] font-semibold text-muted-foreground transition hover:border-destructive/40 hover:text-destructive disabled:opacity-40"
                >
                  Cancelar atendimento
                </button>
              </div>
            </article>
          ) : null}
        </aside>
      </section>

      {remarcarAberto ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-warning/35 bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                <CalendarClock className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Remarcar atendimento</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  Escolha o novo dia e horário de{" "}
                  <strong className="text-foreground">{agendamento.pessoa_nome}</strong>.
                </p>
              </div>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="sm:col-span-2">
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Nova data e hora <strong className="text-destructive">*</strong>
                </span>
                <input
                  type="datetime-local"
                  value={novaDataHora}
                  onChange={(evento) => setNovaDataHora(evento.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-warning/50"
                />
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Duração
                </span>
                <select
                  value={novaDuracao}
                  onChange={(evento) => setNovaDuracao(Number(evento.target.value))}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-warning/50"
                >
                  {DURACOES_MINUTOS.map((minutos) => (
                    <option key={minutos} value={minutos}>
                      {minutos} minutos
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
                  Local / sala
                </span>
                <input
                  value={novoLocal}
                  onChange={(evento) => setNovoLocal(evento.target.value)}
                  className="h-11 w-full rounded-xl border border-border bg-background px-3 text-sm outline-none focus:border-warning/50"
                />
              </label>
            </div>

            {remarcarConflitos.length ? (
              <div className="mt-4 rounded-xl border border-warning/40 bg-warning/8 p-3">
                <p className="flex items-center gap-2 text-xs font-bold text-warning">
                  <AlertTriangle className="h-3.5 w-3.5" /> Esse horário também tem gente marcada
                </p>
                <ul className="mt-1.5 space-y-1 text-[11px] text-muted-foreground">
                  {remarcarConflitos.map((item) => (
                    <li key={`${item.tipo}-${item.agendamento_id}`}>
                      <strong className="text-foreground">{item.pessoa_nome}</strong> (
                      {QUALIFICACAO_LABELS[item.qualificacao]})
                      {item.tipo === "confronto" ? " — mesmo fato" : " — mesmo responsável"}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            <p className="mt-4 rounded-xl border border-border bg-background/50 p-3 text-[11px] leading-relaxed text-muted-foreground">
              O horário anterior ({formatDataHora(agendamento.data_hora)}) fica registrado nas
              observações. A situação volta para "Agendado".
            </p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setRemarcarAberto(false)}
                disabled={remarcarSalvando}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void confirmarRemarcacao()}
                disabled={remarcarSalvando || !novaDataHora}
                className="inline-flex items-center gap-2 rounded-lg border border-warning/60 bg-warning/10 px-4 py-2 text-sm font-semibold text-warning transition hover:bg-warning/20 disabled:opacity-50"
              >
                {remarcarSalvando ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {remarcarSalvando ? "Remarcando..." : "Confirmar nova data"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmarExclusao ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-destructive/30 bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <AlertTriangle className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-lg font-bold">Excluir agendamento</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  O agendamento de{" "}
                  <strong className="text-foreground">{agendamento.pessoa_nome}</strong> sai da
                  agenda. O histórico fica preservado para auditoria.
                </p>
              </div>
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmarExclusao(false)}
                disabled={excluindo}
                className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void excluir()}
                disabled={excluindo}
                className="inline-flex items-center gap-2 rounded-lg bg-destructive px-4 py-2 text-sm font-semibold text-destructive-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                {excluindo ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
                {excluindo ? "Excluindo..." : "Confirmar exclusão"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Dado({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div>
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd className="mt-1 text-sm leading-relaxed text-foreground">{valor}</dd>
    </div>
  );
}
