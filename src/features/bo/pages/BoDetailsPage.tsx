import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  ClipboardList,
  FileText,
  Link2,
  Pencil,
  Printer,
  Scale,
  Trash2,
  UserRound,
} from "lucide-react";
import { useAppProfile } from "@/components/AppProfileContext";
import { canManageBos } from "@/lib/authz";
import { getErrorCode, getErrorMessage } from "@/lib/errorMessage";
import { getBoById, softDeleteBo } from "@/lib/repositories/boRepository";
import { getInqueritoById, type InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import {
  getRepresentacaoById,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import type { BoRecord } from "../boTypes";
import { BoStatusBadge } from "../components/BoStatusBadge";

export default function BoDetailsPage({ boId }: { boId: string }) {
  const profile = useAppProfile();
  const navigate = useNavigate();
  const [record, setRecord] = useState<BoRecord | null>(null);
  const [inquerito, setInquerito] = useState<InqueritoRecord | null>(null);
  const [representacao, setRepresentacao] = useState<RepresentacaoRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void getBoById(boId)
      .then(async (item) => {
        if (cancelled) return;
        if (!item) {
          setError("B.O. não encontrado ou excluído.");
          return;
        }
        setRecord(item);
        if (item.inquerito_id) setInquerito(await getInqueritoById(item.inquerito_id));
        if (item.representacao_id) {
          setRepresentacao(await getRepresentacaoById(item.representacao_id));
        }
      })
      .catch((cause) => setError(getErrorMessage(cause, "Não foi possível carregar o B.O.")))
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [boId]);

  const remove = async () => {
    if (
      !record ||
      !window.confirm(`Excluir o B.O. ${record.numero_bo}? O evento ficará na auditoria.`)
    ) {
      return;
    }
    setDeleting(true);
    setError("");
    try {
      await softDeleteBo(record.id);
      navigate({ to: "/bo/boletins" });
    } catch (cause) {
      setError(getBoDeleteError(cause));
      setDeleting(false);
    }
  };

  if (loading)
    return <div className="bo-muted py-16 text-center text-sm">Carregando detalhes...</div>;
  if (!record) {
    return (
      <section className="bo-surface mx-auto max-w-xl rounded-2xl p-6 text-center">
        <h1 className="bo-title text-xl font-black">B.O. indisponível</h1>
        <p className="bo-muted mt-2 text-sm">{error}</p>
        <Link to="/bo/boletins" className="mt-5 inline-block text-sm font-bold text-violet-400">
          Voltar aos boletins
        </Link>
      </section>
    );
  }

  return (
    <article className="mx-auto max-w-6xl">
      <div className="bo-print-hide mb-4 flex items-center justify-between gap-3">
        <Link
          to="/bo/boletins"
          className="bo-muted inline-flex items-center gap-2 text-xs font-bold hover:text-[var(--bo-text)]"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar aos boletins
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="bo-control inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          {canManageBos(profile) ? (
            <>
              <Link
                to="/bo/$boId/editar"
                params={{ boId: record.id }}
                className="bo-control inline-flex h-10 items-center gap-2 rounded-xl px-4 text-xs font-bold"
              >
                <Pencil className="h-4 w-4" /> Editar
              </Link>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-red-400/25 bg-red-500/10 px-4 text-xs font-bold text-red-400"
              >
                <Trash2 className="h-4 w-4" /> {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="bo-print-hide mb-4 rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-300">
          {error}
        </div>
      ) : null}

      <header className="bo-detail-hero overflow-hidden rounded-2xl border border-violet-400/20 p-6 text-white shadow-2xl">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/10">
              <ClipboardList className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-violet-200/70">
                Boletim de Ocorrência
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight sm:text-3xl">
                B.O. {record.numero_bo}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-violet-100/75">
                {record.infracao_penal}
              </p>
            </div>
          </div>
          <BoStatusBadge status={record.status} />
        </div>
      </header>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          <DetailSection title="Informações do boletim" icon={FileText}>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <DetailField label="Nº do B.O." value={record.numero_bo} />
              <DetailField label="Responsável" value={record.responsavel_nome} />
              <DetailField label="Infração penal" value={record.infracao_penal} wide />
            </div>
          </DetailSection>

          <DetailSection title="Providências e observações" icon={CalendarClock}>
            <div className="space-y-3">
              <DetailField
                label="Diligências pendentes"
                value={record.diligencias_pendentes}
                empty="Nenhuma diligência informada."
                wide
              />
              <DetailField
                label="Observação"
                value={record.observacao}
                empty="Nenhuma observação informada."
                wide
              />
            </div>
          </DetailSection>
        </div>

        <aside className="space-y-5">
          <DetailSection title="Vínculos" icon={Link2}>
            {inquerito || representacao ? (
              <div className="space-y-3">
                {inquerito ? (
                  <LinkedCard
                    to="/inqueritos/$caseId"
                    params={{ caseId: inquerito.id }}
                    icon={FileText}
                    label="Inquérito vinculado"
                    title={inquerito.numero_ppe || "Sem número PPE"}
                    subtitle={[
                      inquerito.tipo_procedimento_normalizado || inquerito.tipo,
                      inquerito.situacao,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ) : null}
                {representacao ? (
                  <LinkedCard
                    to="/representacoes/$representacaoId"
                    params={{ representacaoId: representacao.id }}
                    icon={Scale}
                    label="Representação vinculada"
                    title={
                      representacao.processo_judicial || representacao.numero_ppe || "Sem número"
                    }
                    subtitle={[representacao.tipo, representacao.status]
                      .filter(Boolean)
                      .join(" · ")}
                  />
                ) : null}
              </div>
            ) : (
              <p className="bo-muted text-xs">Este B.O. não possui procedimento vinculado.</p>
            )}
          </DetailSection>

          <DetailSection title="Registro no sistema" icon={UserRound}>
            <div className="space-y-3">
              <DetailField label="Cadastrado em" value={formatDateTime(record.created_at)} />
              <DetailField label="Última atualização" value={formatDateTime(record.updated_at)} />
              <DetailField
                label="Origem"
                value={record.origem_registro === "google_sheets" ? "Planilha oficial" : "SIPI"}
              />
            </div>
          </DetailSection>
        </aside>
      </div>
    </article>
  );
}

function DetailSection({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof FileText;
  children: React.ReactNode;
}) {
  return (
    <section className="bo-surface rounded-2xl p-5">
      <div className="mb-4 flex items-center gap-3 border-b border-[var(--bo-border)] pb-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="bo-section-title text-sm font-black">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function DetailField({
  label,
  value,
  empty = "Não informado",
  wide,
}: {
  label: string;
  value?: string | null;
  empty?: string;
  wide?: boolean;
}) {
  return (
    <div className={`bo-flat-surface rounded-xl p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="bo-kicker block">{label}</span>
      <p className="bo-strong mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed">
        {value?.trim() || empty}
      </p>
    </div>
  );
}

function LinkedCard({
  to,
  params,
  icon: Icon,
  label,
  title,
  subtitle,
}: {
  to: string;
  params: Record<string, string>;
  icon: typeof FileText;
  label: string;
  title: string;
  subtitle: string;
}) {
  return (
    <Link
      to={to as never}
      params={params as never}
      className="bo-flat-surface flex gap-3 rounded-xl p-4"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-violet-500/10 text-violet-400">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <small className="bo-faint block text-[9px] font-black uppercase tracking-[0.12em]">
          {label}
        </small>
        <strong className="bo-strong mt-1 block truncate text-sm">{title}</strong>
        <span className="bo-muted mt-1 block text-xs">{subtitle || "Abrir detalhes"}</span>
      </span>
    </Link>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function getBoDeleteError(cause: unknown) {
  const code = getErrorCode(cause);
  const message = getErrorMessage(cause, "Não foi possível excluir o B.O.");

  if (code === "42501" || message.includes("bo_permission_denied")) {
    return "Seu perfil não tem permissão para excluir este B.O.";
  }
  if (message.toLowerCase().includes("row-level security")) {
    return "A exclusão foi bloqueada pela segurança do banco. Atualize a página e tente novamente.";
  }
  return message;
}
