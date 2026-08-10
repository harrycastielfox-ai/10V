import { Link } from "@tanstack/react-router";
import { CalendarClock, CalendarPlus, CheckCircle2, History, Search, UserX } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { StatCard } from "@/components/StatCard";
import { listAgendamentosPeriodo, listResponsaveis } from "@/lib/repositories/agendaRepository";
import { AgendamentoLinha } from "../components/AgendamentoLinha";
import { chaveDoDia, formatDiaExtenso, inicioDoDia, somarDias } from "../agendaConstants";
import type { AgendamentoRecord, ResponsavelOption } from "../agendaTypes";

type Janela = "30" | "60" | "90";

const JANELAS: Array<{ valor: Janela; label: string; dias: number }> = [
  { valor: "30", label: "Últimos 30 dias", dias: 30 },
  { valor: "60", label: "Últimos 60 dias", dias: 60 },
  { valor: "90", label: "Últimos 90 dias", dias: 90 },
];

type FiltroStatus = "todos" | "compareceu" | "nao_compareceu";

/**
 * O que já aconteceu — quem foi atendido e quem faltou. Diferente da Agenda do
 * dia e do Cronograma (que olham pra frente), aqui é registro do passado, pra
 * conferir histórico de uma pessoa ou de um B.O.
 */
export default function HistoricoPage() {
  const [janela, setJanela] = useState<Janela>("30");
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>("todos");
  const [responsavelId, setResponsavelId] = useState("");
  const [responsaveis, setResponsaveis] = useState<ResponsavelOption[]>([]);
  const [busca, setBusca] = useState("");
  const [agendamentos, setAgendamentos] = useState<AgendamentoRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState("");

  useEffect(() => {
    let cancelado = false;
    void listResponsaveis()
      .then((data) => {
        if (!cancelado) setResponsaveis(data);
      })
      .catch(() => undefined);
    return () => {
      cancelado = true;
    };
  }, []);

  useEffect(() => {
    let cancelado = false;
    setLoading(true);
    setErro("");

    const dias = JANELAS.find((item) => item.valor === janela)?.dias ?? 30;
    const fim = somarDias(inicioDoDia(new Date()), 1);
    const inicio = somarDias(fim, -dias);

    void listAgendamentosPeriodo({
      inicio: inicio.toISOString(),
      fim: fim.toISOString(),
      responsavelUserId: responsavelId || null,
      limit: 500,
    })
      .then((data) => {
        if (!cancelado) setAgendamentos(data);
      })
      .catch((causa) => {
        console.error("[HistoricoPage] Falha ao carregar o histórico", causa);
        if (!cancelado) setErro("Não foi possível carregar o histórico.");
      })
      .finally(() => {
        if (!cancelado) setLoading(false);
      });

    return () => {
      cancelado = true;
    };
  }, [janela, responsavelId]);

  // Histórico é só o que já foi resolvido — "agendado"/"confirmado" ainda não
  // aconteceu, isso quem mostra é a Agenda do dia e o Cronograma.
  const encerrados = useMemo(
    () =>
      agendamentos.filter(
        (item) => item.status === "compareceu" || item.status === "nao_compareceu",
      ),
    [agendamentos],
  );

  const filtrados = useMemo(() => {
    let lista = encerrados;
    if (filtroStatus !== "todos") {
      lista = lista.filter((item) => item.status === filtroStatus);
    }
    const alvo = busca.trim().toLocaleLowerCase("pt-BR");
    if (alvo) {
      lista = lista.filter((item) =>
        [item.pessoa_nome, item.natureza ?? "", item.numero_bo ?? "", item.responsavel_nome ?? ""]
          .join(" ")
          .toLocaleLowerCase("pt-BR")
          .includes(alvo),
      );
    }
    // Mais recente primeiro — é assim que se procura "o que aconteceu ontem".
    return [...lista].sort(
      (a, b) => new Date(b.data_hora).getTime() - new Date(a.data_hora).getTime(),
    );
  }, [encerrados, filtroStatus, busca]);

  const totalCompareceu = useMemo(
    () => encerrados.filter((item) => item.status === "compareceu").length,
    [encerrados],
  );
  const totalFaltou = useMemo(
    () => encerrados.filter((item) => item.status === "nao_compareceu").length,
    [encerrados],
  );

  const grupos = useMemo(() => {
    const mapa = new Map<string, { titulo: string; itens: AgendamentoRecord[] }>();
    filtrados.forEach((item) => {
      const chave = chaveDoDia(item.data_hora);
      const atual = mapa.get(chave);
      if (atual) {
        atual.itens.push(item);
        return;
      }
      mapa.set(chave, { titulo: formatDiaExtenso(new Date(item.data_hora)), itens: [item] });
    });
    return Array.from(mapa.entries())
      .map(([chave, grupo]) => ({ chave, ...grupo }))
      .sort((a, b) => b.chave.localeCompare(a.chave));
  }, [filtrados]);

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-border/70 bg-card/60 p-5 lg:p-6">
        <div className="mb-2 inline-flex items-center gap-2 rounded-md border border-info/25 bg-info/10 px-2.5 py-1 text-[10px] font-bold tracking-[0.18em] text-info">
          MÓDULO AGENDAMENTO
        </div>
        <h1 className="text-3xl font-black tracking-tight">HISTÓRICO</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Atendimentos já encerrados — quem compareceu e quem não compareceu.
        </p>
      </header>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        <StatCard
          label="NO PERÍODO"
          value={encerrados.length}
          hint="Atendimentos encerrados"
          icon={History}
          tone="info"
        />
        <StatCard
          label="COMPARECERAM"
          value={totalCompareceu}
          hint="Presença confirmada"
          icon={CheckCircle2}
          tone="primary"
        />
        <StatCard
          label="NÃO COMPARECERAM"
          value={totalFaltou}
          hint="Faltaram ao horário"
          icon={UserX}
          tone="destructive"
        />
      </section>

      <section className="grid gap-3 rounded-2xl border border-border bg-card p-4 md:grid-cols-4">
        <label className="min-w-0">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Período
          </span>
          <select
            value={janela}
            onChange={(evento) => setJanela(evento.target.value as Janela)}
            className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-info/50"
          >
            {JANELAS.map((item) => (
              <option key={item.valor} value={item.valor}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="min-w-0">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Situação
          </span>
          <select
            value={filtroStatus}
            onChange={(evento) => setFiltroStatus(evento.target.value as FiltroStatus)}
            className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-info/50"
          >
            <option value="todos">Todos</option>
            <option value="compareceu">Compareceu</option>
            <option value="nao_compareceu">Não compareceu</option>
          </select>
        </label>

        <label className="min-w-0">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Responsável
          </span>
          <select
            value={responsavelId}
            onChange={(evento) => setResponsavelId(evento.target.value)}
            className="h-11 w-full rounded-lg border border-border bg-background/70 px-3 text-sm outline-none focus:border-info/50"
          >
            <option value="">Todos os servidores</option>
            {responsaveis.map((item) => (
              <option key={item.id} value={item.id}>
                {item.nome}
              </option>
            ))}
          </select>
        </label>

        <label className="relative min-w-0">
          <span className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Buscar
          </span>
          <Search className="absolute left-3 top-[34px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            placeholder="Nome, B.O. ou natureza..."
            className="h-11 w-full rounded-lg border border-border bg-background/70 pl-9 pr-3 text-sm outline-none focus:border-info/50"
          />
        </label>
      </section>

      {erro ? (
        <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {erro}
        </p>
      ) : null}

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">Carregando histórico...</p>
      ) : grupos.length ? (
        <div className="space-y-5">
          {grupos.map((grupo) => (
            <section key={grupo.chave} className="rounded-2xl border border-border bg-card">
              <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <CalendarClock className="h-4 w-4 shrink-0 text-info" />
                  <h2 className="truncate text-sm font-black capitalize">{grupo.titulo}</h2>
                </div>
                <span className="shrink-0 rounded-md border border-border bg-background px-2 py-0.5 text-[10px] font-bold tabular-nums text-muted-foreground">
                  {grupo.itens.length}
                </span>
              </header>
              <div className="space-y-2 p-3">
                {grupo.itens.map((agendamento, indice) => (
                  <div key={agendamento.id} className="relative">
                    <AgendamentoLinha
                      agendamento={agendamento}
                      ordem={indice + 1}
                      mostrarResponsavel
                    />
                    {agendamento.status === "nao_compareceu" ? (
                      <Link
                        to="/agenda/novo"
                        search={{ remarcarDe: agendamento.id }}
                        onClick={(evento) => evento.stopPropagation()}
                        className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 rounded-lg border border-warning/50 bg-warning/10 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wide text-warning transition hover:bg-warning/20"
                      >
                        <CalendarPlus className="h-3 w-3" /> Remarcar
                      </Link>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="flex min-h-64 flex-col items-center justify-center rounded-2xl border border-dashed border-border p-8 text-center">
          <History className="h-9 w-9 text-muted-foreground" />
          <strong className="mt-3 text-sm">Nada encerrado neste período</strong>
          <p className="mt-1 max-w-md text-xs leading-relaxed text-muted-foreground">
            Assim que um atendimento for marcado como "Compareceu" ou "Não compareceu", ele aparece
            aqui.
          </p>
        </div>
      )}
    </div>
  );
}
