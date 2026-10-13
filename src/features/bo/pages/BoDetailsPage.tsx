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
import { SipiPrintSheet, type SipiPrintSection } from "@/components/SipiPrintSheet";
import { canManageBos } from "@/lib/authz";
import { getErrorCode, getErrorMessage } from "@/lib/errorMessage";
import { getBoById, softDeleteBo } from "@/lib/repositories/boRepository";
import { getInqueritoById, type InqueritoRecord } from "@/lib/repositories/inqueritosRepository";
import {
  getRepresentacaoById,
  type RepresentacaoRecord,
} from "@/lib/repositories/representacoesRepository";
import { getBoStatusLabel, type BoRecord } from "../boTypes";
import { BoStatusBadge } from "../components/BoStatusBadge";

const BO_ORIGEM_LABELS: Record<BoRecord["origem_registro"], string> = {
  sipi: "SIED",
  google_sheets: "Planilha oficial",
  migrado: "Procedimento migrado",
};

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

  useEffect(() => {
    if (loading || !record) return;
    if (new URLSearchParams(window.location.search).get("print") !== "1") return;
    window.history.replaceState(null, "", window.location.pathname);
    const timer = window.setTimeout(() => window.print(), 150);
    return () => window.clearTimeout(timer);
  }, [loading, record]);

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
    return (
      <div className="py-16 text-center text-sm text-muted-foreground">Carregando detalhes...</div>
    );
  if (!record) {
    return (
      <section className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-6 text-center">
        <h1 className="text-xl font-black text-foreground">B.O. indisponível</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error}</p>
        <Link to="/bo/boletins" className="mt-5 inline-block text-sm font-bold text-purple">
          Voltar aos boletins
        </Link>
      </section>
    );
  }

  const statusLabel = getBoStatusLabel(record.status);
  const origemLabel = BO_ORIGEM_LABELS[record.origem_registro] ?? "SIED";
  const inqueritoResumo = inquerito
    ? [
        inquerito.numero_ppe || "Sem número PPE",
        inquerito.tipo_procedimento_normalizado || inquerito.tipo,
        inquerito.situacao,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const representacaoResumo = representacao
    ? [
        representacao.processo_judicial || representacao.numero_ppe || "Sem número",
        representacao.tipo,
        representacao.status,
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const printSections: SipiPrintSection[] = [
    {
      title: "Identificação do boletim",
      fields: [
        { label: "Nº do B.O.", value: record.numero_bo },
        { label: "Status", value: statusLabel },
        { label: "Responsável", value: record.responsavel_nome },
        { label: "Origem do registro", value: origemLabel },
        { label: "Infração penal", value: record.infracao_penal, wide: true },
      ],
    },
    {
      title: "Providências e observações",
      wide: true,
      narrative: true,
      fields: [
        { label: "Diligências pendentes", value: record.diligencias_pendentes, wide: true },
        { label: "Observação", value: record.observacao, wide: true },
      ],
    },
    {
      title: "Vínculos",
      fields: [
        { label: "Inquérito vinculado", value: inqueritoResumo, wide: true },
        { label: "Representação vinculada", value: representacaoResumo, wide: true },
      ],
    },
    {
      title: "Registro no sistema",
      fields: [
        { label: "Cadastrado em", value: formatDateTime(record.created_at) },
        { label: "Última atualização", value: formatDateTime(record.updated_at) },
        { label: "Origem", value: origemLabel },
      ],
    },
  ];

  return (
    <article className="sipi-print-document mx-auto max-w-6xl">
      <SipiPrintSheet
        variant="summary"
        documentTitle="Ficha de Boletim de Ocorrência"
        documentSubtitle="Cadastro, acompanhamento e vínculos com procedimentos do SIED"
        identifierLabel="B.O."
        identifier={record.numero_bo}
        summary={[
          { label: "Status", value: statusLabel },
          { label: "Responsável", value: record.responsavel_nome },
          { label: "Origem", value: origemLabel },
        ]}
        sections={printSections}
      />
      <div className="mb-4 flex items-center justify-between gap-3">
        <Link
          to="/bo/boletins"
          className="inline-flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar aos boletins
        </Link>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-bold hover:border-purple/40"
          >
            <Printer className="h-4 w-4" /> Imprimir
          </button>
          {canManageBos(profile) ? (
            <>
              <Link
                to="/bo/$boId/editar"
                params={{ boId: record.id }}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-border bg-card px-4 text-xs font-bold hover:border-purple/40"
              >
                <Pencil className="h-4 w-4" /> Editar
              </Link>
              <button
                type="button"
                onClick={remove}
                disabled={deleting}
                className="inline-flex h-10 items-center gap-2 rounded-xl border border-destructive/25 bg-destructive/10 px-4 text-xs font-bold text-destructive"
              >
                <Trash2 className="h-4 w-4" /> {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </>
          ) : null}
        </div>
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-destructive/25 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      ) : null}

      <header className="overflow-hidden rounded-2xl border border-border bg-card p-6">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
          <div className="flex items-start gap-4">
            <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-purple/25 bg-purple/12 text-purple">
              <ClipboardList className="h-6 w-6" />
            </span>
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-purple">
                Boletim de Ocorrência
              </p>
              <h1 className="mt-1 text-2xl font-black tracking-tight text-foreground sm:text-3xl">
                B.O. {record.numero_bo}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-muted-foreground">
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
              <p className="text-xs text-muted-foreground">
                Este B.O. não possui procedimento vinculado.
              </p>
            )}
          </DetailSection>

          <DetailSection title="Registro no sistema" icon={UserRound}>
            <div className="space-y-3">
              <DetailField label="Cadastrado em" value={formatDateTime(record.created_at)} />
              <DetailField label="Última atualização" value={formatDateTime(record.updated_at)} />
              <DetailField label="Origem" value={origemLabel} />
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
    <section className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-4 flex items-center gap-3 border-b border-border pb-4">
        <span className="flex size-9 items-center justify-center rounded-xl bg-purple/10 text-purple">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-sm font-black text-foreground">{title}</h2>
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
    <div className={`rounded-xl border border-border bg-muted/40 p-4 ${wide ? "sm:col-span-2" : ""}`}>
      <span className="block text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">
        {label}
      </span>
      <p className="mt-2 whitespace-pre-wrap text-sm font-semibold leading-relaxed text-foreground">
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
      className="flex gap-3 rounded-xl border border-border bg-muted/40 p-4 transition hover:border-purple/40"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-purple/10 text-purple">
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <small className="block text-[9px] font-black uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </small>
        <strong className="mt-1 block truncate text-sm text-foreground">{title}</strong>
        <span className="mt-1 block text-xs text-muted-foreground">
          {subtitle || "Abrir detalhes"}
        </span>
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
