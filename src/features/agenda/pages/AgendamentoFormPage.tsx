import { useNavigate } from "@tanstack/react-router";
import {
  AlertTriangle,
  ArrowLeft,
  CalendarPlus,
  CheckCircle2,
  LoaderCircle,
  MessageCircle,
  Save,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useAppProfile } from "@/components/AppProfileContext";
import { canManageAgenda } from "@/lib/authz";
import {
  checarConflitos,
  createAgendamento,
  getAgendamentoById,
  listResponsaveis,
  updateAgendamento,
} from "@/lib/repositories/agendaRepository";
import {
  DURACOES_MINUTOS,
  INTIMACAO_STATUS_LABELS,
  INTIMACAO_VIA_LABELS,
  NATUREZAS_FREQUENTES,
  QUALIFICACAO_LABELS,
  TIPO_ATENDIMENTO_LABELS,
  formatDataHora,
  montarLinkWhatsapp,
  paraInputDateTime,
} from "../agendaConstants";
import type {
  AgendaConflito,
  AgendamentoRecord,
  IntimacaoStatus,
  IntimacaoVia,
  Qualificacao,
  ResponsavelOption,
  TipoAtendimento,
} from "../agendaTypes";

type Modo = "create" | "edit";

type FormState = {
  pessoaNome: string;
  pessoaTelefone: string;
  pessoaDocumento: string;
  qualificacao: Qualificacao;
  tipoAtendimento: TipoAtendimento;
  natureza: string;
  numeroBo: string;
  procedimentoNumero: string;
  inqueritoId: string;
  dataHora: string;
  duracaoMinutos: number;
  local: string;
  responsavelUserId: string;
  intimacaoStatus: IntimacaoStatus;
  intimacaoVia: IntimacaoVia | "";
  observacoes: string;
};

/** Próxima hora cheia — quase nunca se marca oitiva para "daqui a 7 minutos". */
function proximoHorarioSugerido() {
  const agora = new Date();
  agora.setMinutes(0, 0, 0);
  agora.setHours(agora.getHours() + 1);
  return paraInputDateTime(agora);
}

const ESTADO_INICIAL: FormState = {
  pessoaNome: "",
  pessoaTelefone: "",
  pessoaDocumento: "",
  qualificacao: "vitima",
  tipoAtendimento: "oitiva",
  natureza: "",
  numeroBo: "",
  procedimentoNumero: "",
  inqueritoId: "",
  dataHora: proximoHorarioSugerido(),
  duracaoMinutos: 30,
  local: "",
  responsavelUserId: "",
  intimacaoStatus: "pendente",
  intimacaoVia: "",
  observacoes: "",
};

function estadoDeRegistro(registro: AgendamentoRecord): FormState {
  return {
    pessoaNome: registro.pessoa_nome,
    pessoaTelefone: registro.pessoa_telefone ?? "",
    pessoaDocumento: registro.pessoa_documento ?? "",
    qualificacao: registro.qualificacao,
    tipoAtendimento: registro.tipo_atendimento,
    natureza: registro.natureza ?? "",
    numeroBo: registro.numero_bo ?? "",
    procedimentoNumero: registro.procedimento_numero ?? "",
    inqueritoId: registro.inquerito_id ?? "",
    dataHora: paraInputDateTime(registro.data_hora),
    duracaoMinutos: registro.duracao_minutos,
    local: registro.local ?? "",
    responsavelUserId: registro.responsavel_user_id ?? "",
    intimacaoStatus: registro.intimacao_status,
    intimacaoVia: registro.intimacao_via ?? "",
    observacoes: registro.observacoes ?? "",
  };
}

/**
 * Reagendar quem faltou: repete quem é a pessoa e o fato, mas pede um horário
 * novo — data antiga e intimação não fazem sentido carregar pra frente.
 */
function estadoDeReagendamento(registro: AgendamentoRecord): FormState {
  return {
    ...estadoDeRegistro(registro),
    dataHora: proximoHorarioSugerido(),
    intimacaoStatus: "pendente",
    intimacaoVia: "",
  };
}

function textoOuNulo(valor: string) {
  return valor.trim() || null;
}

export function AgendamentoFormPage({
  modo,
  agendamentoId,
  remarcarDeId,
}: {
  modo: Modo;
  agendamentoId?: string;
  remarcarDeId?: string;
}) {
  const navigate = useNavigate();
  const profile = useAppProfile();
  const podeMarcar = canManageAgenda(profile);

  const [form, setForm] = useState<FormState>(ESTADO_INICIAL);
  const [responsaveis, setResponsaveis] = useState<ResponsavelOption[]>([]);
  const [conflitos, setConflitos] = useState<AgendaConflito[]>([]);
  const [loading, setLoading] = useState(modo === "edit");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState("");
  const [registroSalvo, setRegistroSalvo] = useState<AgendamentoRecord | null>(null);
  const [origemReagendamento, setOrigemReagendamento] = useState<AgendamentoRecord | null>(null);

  useEffect(() => {
    let cancelado = false;
    void listResponsaveis()
      .then((data) => {
        if (cancelado) return;
        setResponsaveis(data);
        // Quem está marcando normalmente é quem vai conduzir.
        setForm((atual) =>
          atual.responsavelUserId || modo === "edit"
            ? atual
            : {
                ...atual,
                responsavelUserId: data.some((r) => r.id === profile.id) ? profile.id : "",
              },
        );
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [modo, profile.id]);

  useEffect(() => {
    if (modo !== "create" || !remarcarDeId) return;
    let cancelado = false;
    void getAgendamentoById(remarcarDeId)
      .then((registro) => {
        if (!registro || cancelado) return;
        setOrigemReagendamento(registro);
        setForm(estadoDeReagendamento(registro));
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, [modo, remarcarDeId]);

  useEffect(() => {
    if (modo !== "edit" || !agendamentoId) return;
    let cancelado = false;
    void getAgendamentoById(agendamentoId)
      .then((registro) => {
        if (!registro) throw new Error("Agendamento não encontrado.");
        if (!cancelado) setForm(estadoDeRegistro(registro));
      })
      .catch(() => {
        if (!cancelado) setErro("Não foi possível carregar este agendamento.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });
    return () => {
      cancelado = true;
    };
  }, [modo, agendamentoId]);

  // Conflitos: consulta enquanto digita, sem travar o formulário.
  useEffect(() => {
    if (!form.dataHora) {
      setConflitos([]);
      return;
    }
    let cancelado = false;
    const timer = window.setTimeout(() => {
      void checarConflitos({
        dataHora: new Date(form.dataHora).toISOString(),
        duracaoMinutos: form.duracaoMinutos,
        responsavelUserId: form.responsavelUserId || null,
        numeroBo: form.numeroBo,
        inqueritoId: form.inqueritoId || null,
        qualificacao: form.qualificacao,
        ignorarId: agendamentoId ?? null,
      })
        .then((itens) => {
          if (!cancelado) setConflitos(itens);
        })
        .catch(() => {
          if (!cancelado) setConflitos([]);
        });
    }, 450);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [
    agendamentoId,
    form.dataHora,
    form.duracaoMinutos,
    form.inqueritoId,
    form.numeroBo,
    form.qualificacao,
    form.responsavelUserId,
  ]);

  const conflitosHorario = useMemo(
    () => conflitos.filter((item) => item.tipo === "horario"),
    [conflitos],
  );
  const conflitosConfronto = useMemo(
    () => conflitos.filter((item) => item.tipo === "confronto"),
    [conflitos],
  );

  function atualizar<K extends keyof FormState>(chave: K, valor: FormState[K]) {
    setForm((atual) => ({ ...atual, [chave]: valor }));
  }

  async function salvar() {
    if (!podeMarcar) {
      setErro("Seu perfil não pode marcar atendimentos.");
      return;
    }
    if (!form.pessoaNome.trim()) {
      setErro("Informe o nome de quem será atendido.");
      return;
    }
    if (!form.dataHora) {
      setErro("Informe a data e a hora do atendimento.");
      return;
    }

    setSalvando(true);
    setErro("");
    try {
      const payload = {
        pessoa_nome: form.pessoaNome.trim(),
        pessoa_telefone: textoOuNulo(form.pessoaTelefone),
        pessoa_documento: textoOuNulo(form.pessoaDocumento),
        qualificacao: form.qualificacao,
        tipo_atendimento: form.tipoAtendimento,
        natureza: textoOuNulo(form.natureza),
        numero_bo: textoOuNulo(form.numeroBo),
        procedimento_numero: textoOuNulo(form.procedimentoNumero),
        inquerito_id: form.inqueritoId || null,
        data_hora: new Date(form.dataHora).toISOString(),
        duracao_minutos: form.duracaoMinutos,
        local: textoOuNulo(form.local),
        responsavel_user_id: form.responsavelUserId || null,
        intimacao_status: form.intimacaoStatus,
        intimacao_via: form.intimacaoVia || null,
        observacoes: textoOuNulo(form.observacoes),
      };

      const salvo =
        modo === "edit" && agendamentoId
          ? await updateAgendamento(agendamentoId, payload)
          : await createAgendamento(payload);

      setRegistroSalvo(salvo);
    } catch (falha) {
      console.error("[AgendamentoForm] Falha ao salvar", falha);
      setErro("Não foi possível salvar o agendamento. Revise os dados e tente novamente.");
    } finally {
      setSalvando(false);
    }
  }

  function fecharConfirmacao() {
    if (!registroSalvo) return;
    void navigate({
      to: "/agenda/$agendamentoId",
      params: { agendamentoId: registroSalvo.id },
      replace: true,
    });
  }

  if (!podeMarcar) {
    return (
      <section className="mx-auto mt-10 max-w-xl rounded-2xl border border-info/30 bg-card p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-info/10 text-info">
          <ShieldAlert className="h-6 w-6" />
        </span>
        <h1 className="mt-4 text-xl font-black">Marcação não autorizada</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Seu perfil consulta a agenda, mas não pode marcar ou alterar atendimentos.
        </p>
      </section>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[45vh] items-center justify-center">
        <LoaderCircle className="h-6 w-6 animate-spin text-info" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <header className="rounded-2xl border border-border/70 bg-card/60 p-5 lg:p-6">
        <button
          type="button"
          onClick={() => history.back()}
          className="mb-4 inline-flex items-center gap-2 text-xs font-semibold text-muted-foreground hover:text-info"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <p className="text-[10px] font-bold tracking-[0.2em] text-info">MÓDULO AGENDAMENTO</p>
        <h1 className="mt-1 text-3xl font-black tracking-tight">
          {modo === "create" ? "Marcar atendimento" : "Editar agendamento"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Uma pessoa por horário. Para ouvir vítima e testemunhas do mesmo B.O., marque uma de cada
          vez.
        </p>
      </header>

      {erro ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      {origemReagendamento ? (
        <p className="rounded-xl border border-warning/35 bg-warning/10 p-3 text-sm text-warning">
          Reagendando <strong>{origemReagendamento.pessoa_nome}</strong> — não compareceu em{" "}
          {formatDataHora(origemReagendamento.data_hora)}. Escolha o novo horário abaixo.
        </p>
      ) : null}

      {conflitosConfronto.length ? (
        <section className="rounded-xl border border-destructive/45 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
            <div className="min-w-0">
              <h2 className="text-sm font-black text-destructive">
                Atenção: encontro de vítima com autor
              </h2>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Nesse horário já há alguém do outro lado do mesmo fato. Os dois vão esperar juntos.
                Se não for acareação, mude o horário.
              </p>
              <ul className="mt-2 space-y-1 text-xs">
                {conflitosConfronto.map((item) => (
                  <li key={item.agendamento_id}>
                    <strong>{item.pessoa_nome}</strong> ({QUALIFICACAO_LABELS[item.qualificacao]})
                    às {formatDataHora(item.data_hora)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      {conflitosHorario.length ? (
        <section className="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <div className="flex items-start gap-3">
            <Users className="mt-0.5 h-5 w-5 shrink-0 text-warning" />
            <div className="min-w-0">
              <h2 className="text-sm font-black text-warning">Servidor já ocupado nesse horário</h2>
              <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
                {conflitosHorario.map((item) => (
                  <li key={item.agendamento_id}>
                    <strong className="text-foreground">{item.pessoa_nome}</strong> às{" "}
                    {formatDataHora(item.data_hora)}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

      <form
        onSubmit={(evento) => evento.preventDefault()}
        className="space-y-6 rounded-2xl border border-border bg-card p-5 lg:p-6"
      >
        <Secao titulo="1. QUEM SERÁ ATENDIDO" descricao="A pessoa convocada e como falar com ela.">
          <Campo label="Nome completo" obrigatorio className="md:col-span-2">
            <input
              value={form.pessoaNome}
              onChange={(evento) => atualizar("pessoaNome", evento.target.value)}
              placeholder="Nome de quem foi convocado"
              className={entradaClasse}
            />
          </Campo>
          <Campo label="Qualificação">
            <select
              value={form.qualificacao}
              onChange={(evento) => atualizar("qualificacao", evento.target.value as Qualificacao)}
              className={entradaClasse}
            >
              {Object.entries(QUALIFICACAO_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Telefone">
            <input
              value={form.pessoaTelefone}
              onChange={(evento) => atualizar("pessoaTelefone", evento.target.value)}
              placeholder="(73) 9 0000-0000"
              className={entradaClasse}
            />
          </Campo>
          <Campo label="Documento (CPF/RG)">
            <input
              value={form.pessoaDocumento}
              onChange={(evento) => atualizar("pessoaDocumento", evento.target.value)}
              className={entradaClasse}
            />
          </Campo>
        </Secao>

        <Secao titulo="2. DIA E HORÁRIO" descricao="Quando e quem vai conduzir o atendimento.">
          <Campo label="Data e hora" obrigatorio>
            <input
              type="datetime-local"
              value={form.dataHora}
              onChange={(evento) => atualizar("dataHora", evento.target.value)}
              className={entradaClasse}
            />
          </Campo>
          <Campo label="Duração">
            <select
              value={form.duracaoMinutos}
              onChange={(evento) => atualizar("duracaoMinutos", Number(evento.target.value))}
              className={entradaClasse}
            >
              {DURACOES_MINUTOS.map((minutos) => (
                <option key={minutos} value={minutos}>
                  {minutos} minutos
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Responsável pelo atendimento">
            <select
              value={form.responsavelUserId}
              onChange={(evento) => atualizar("responsavelUserId", evento.target.value)}
              className={entradaClasse}
            >
              <option value="">Não definido</option>
              {responsaveis.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.nome}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Local / sala">
            <input
              value={form.local}
              onChange={(evento) => atualizar("local", evento.target.value)}
              placeholder="Ex.: Escrivania 1"
              className={entradaClasse}
            />
          </Campo>
        </Secao>

        <Secao
          titulo="3. SOBRE O QUE"
          descricao="O fato e o procedimento que originou a convocação."
        >
          <Campo label="Tipo de atendimento">
            <select
              value={form.tipoAtendimento}
              onChange={(evento) =>
                atualizar("tipoAtendimento", evento.target.value as TipoAtendimento)
              }
              className={entradaClasse}
            >
              {Object.entries(TIPO_ATENDIMENTO_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Natureza do fato">
            <input
              list="agenda-naturezas"
              value={form.natureza}
              onChange={(evento) => atualizar("natureza", evento.target.value)}
              placeholder="Ex.: Agressão / Lesão corporal"
              className={entradaClasse}
            />
            <datalist id="agenda-naturezas">
              {NATUREZAS_FREQUENTES.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </Campo>
          <Campo label="Número do B.O.">
            <input
              value={form.numeroBo}
              onChange={(evento) => atualizar("numeroBo", evento.target.value)}
              placeholder="Ex.: 00012345/2026"
              className={entradaClasse}
            />
            <span className="mt-1 block text-[11px] text-muted-foreground">
              É por ele que o sistema junta vítima, testemunhas e autor do mesmo fato.
            </span>
          </Campo>
          <Campo label="Número do procedimento">
            <input
              value={form.procedimentoNumero}
              onChange={(evento) => atualizar("procedimentoNumero", evento.target.value)}
              placeholder="IP, TCO, APF..."
              className={entradaClasse}
            />
          </Campo>
        </Secao>

        <Secao titulo="4. INTIMAÇÃO E OBSERVAÇÕES" descricao="A pessoa já foi avisada? Por onde?">
          <Campo label="Situação da intimação">
            <select
              value={form.intimacaoStatus}
              onChange={(evento) =>
                atualizar("intimacaoStatus", evento.target.value as IntimacaoStatus)
              }
              className={entradaClasse}
            >
              {Object.entries(INTIMACAO_STATUS_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Avisada por">
            <select
              value={form.intimacaoVia}
              onChange={(evento) => atualizar("intimacaoVia", evento.target.value as IntimacaoVia)}
              className={entradaClasse}
            >
              <option value="">Não informado</option>
              {Object.entries(INTIMACAO_VIA_LABELS).map(([valor, label]) => (
                <option key={valor} value={valor}>
                  {label}
                </option>
              ))}
            </select>
          </Campo>
          <Campo label="Observações" className="md:col-span-2">
            <textarea
              rows={3}
              value={form.observacoes}
              onChange={(evento) => atualizar("observacoes", evento.target.value)}
              placeholder="Precisa de intérprete, vem acompanhada, tem medida protetiva..."
              className={`${entradaClasse} h-auto py-2.5`}
            />
          </Campo>
        </Secao>

        <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={salvando}
            onClick={() => void salvar()}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-info/60 bg-info/10 px-5 text-sm font-semibold text-info transition hover:bg-info/20 disabled:opacity-50"
          >
            {salvando ? (
              <LoaderCircle className="h-4 w-4 animate-spin" />
            ) : modo === "create" ? (
              <CalendarPlus className="h-4 w-4" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {salvando
              ? "Salvando..."
              : modo === "create"
                ? "Marcar atendimento"
                : "Salvar alterações"}
          </button>
        </div>
      </form>

      {registroSalvo ? (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/75 p-4">
          <div className="w-full max-w-md rounded-2xl border border-success/35 bg-card p-5 shadow-2xl">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
                <CheckCircle2 className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <h2 className="text-lg font-bold">Atendimento marcado</h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  <strong className="text-foreground">{registroSalvo.pessoa_nome}</strong> —{" "}
                  {formatDataHora(registroSalvo.data_hora)}
                </p>
              </div>
            </div>

            {(() => {
              const linkWhatsapp = montarLinkWhatsapp(
                registroSalvo.pessoa_telefone,
                registroSalvo.pessoa_nome,
                registroSalvo.data_hora,
              );
              return (
                <>
                  <p className="mt-4 text-sm text-muted-foreground">
                    {linkWhatsapp
                      ? "Quer enviar o chamado pelo WhatsApp agora?"
                      : "Sem telefone cadastrado — não é possível enviar o chamado por WhatsApp."}
                  </p>
                  <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button
                      type="button"
                      onClick={fecharConfirmacao}
                      className="rounded-lg border border-border px-4 py-2 text-sm font-semibold transition hover:bg-accent"
                    >
                      Fechar
                    </button>
                    {linkWhatsapp ? (
                      <a
                        href={linkWhatsapp}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={fecharConfirmacao}
                        className="inline-flex items-center justify-center gap-2 rounded-lg border border-success/60 bg-success/10 px-4 py-2 text-sm font-semibold text-success transition hover:bg-success/20"
                      >
                        <MessageCircle className="h-4 w-4" /> Enviar chamado via WhatsApp
                      </a>
                    ) : null}
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const entradaClasse =
  "h-11 w-full rounded-xl border border-border bg-background/70 px-3 text-sm outline-none transition focus:border-info/50";

function Secao({
  titulo,
  descricao,
  children,
}: {
  titulo: string;
  descricao: string;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5">
        <h2 className="text-sm font-black tracking-[0.14em] text-info">{titulo}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{descricao}</p>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">{children}</div>
    </section>
  );
}

function Campo({
  label,
  obrigatorio = false,
  className = "",
  children,
}: {
  label: string;
  obrigatorio?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={className}>
      <span className="mb-1.5 block text-xs font-semibold text-muted-foreground">
        {label}
        {obrigatorio ? <strong className="ml-1 text-destructive">*</strong> : null}
      </span>
      {children}
    </label>
  );
}
